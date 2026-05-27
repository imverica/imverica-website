/**
 * VirusTotal hash lookup — second defence-in-depth layer for uploads.
 *
 * Strategy: we never submit a file body to VirusTotal (it would expose
 * client documents to a third party). Instead we compute the SHA-256 of
 * the buffer and ask VT whether the hash is already known. If the file
 * has been flagged by ≥1 engine as malicious (or by ≥3 as suspicious),
 * we reject the upload. If VT has never seen the hash (404), we accept —
 * it could be a one-off legitimate document, and submitting an unknown
 * file is privacy-sensitive.
 *
 * Fail-open posture: if VIRUSTOTAL_API_KEY is missing, the network is
 * down, the rate limit is hit, or the API returns 5xx, we log a warning
 * and ALLOW the upload. That keeps the cabinet usable when VT is unhappy
 * while still catching the obvious known-bad files when it works.
 *
 * Rate limit (free tier): 4 requests/min, 500/day, 15K/month — generous
 * for a low-traffic cabinet but worth caching the verdict per hash in
 * memory across warm invocations of the same Netlify Function.
 */

const crypto = require('crypto');

const VT_TIMEOUT_MS = 6000;            // hard ceiling so we don't stall uploads
const MAX_SUSPICIOUS = 3;              // tolerate 1-2 over-eager engines
const MAX_MALICIOUS = 1;               // any AV calling it malicious wins

// In-process cache (lives until the function container is recycled).
// Hash → { verdict: 'clean' | 'malicious' | 'suspicious' | 'unknown', ts }
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;   // 30 min — recheck eventually

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function fetchWithTimeout(url, init, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function classifyStats(stats) {
  const m = Number(stats?.malicious || 0);
  const s = Number(stats?.suspicious || 0);
  if (m >= MAX_MALICIOUS) return 'malicious';
  if (s >= MAX_SUSPICIOUS) return 'suspicious';
  return 'clean';
}

/**
 * @returns {Promise<{verdict: 'clean'|'malicious'|'suspicious'|'unknown'|'skipped', stats?: object}>}
 */
async function scanBuffer(buf) {
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) return { verdict: 'skipped' };
  if (!Buffer.isBuffer(buf) || !buf.length) return { verdict: 'skipped' };

  const hash = sha256(buf);
  const cached = cache.get(hash);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return { verdict: cached.verdict };

  try {
    const res = await fetchWithTimeout(
      `https://www.virustotal.com/api/v3/files/${hash}`,
      { headers: { 'x-apikey': key, Accept: 'application/json' } },
      VT_TIMEOUT_MS
    );
    if (res.status === 404) {
      cache.set(hash, { verdict: 'unknown', ts: Date.now() });
      return { verdict: 'unknown' };
    }
    if (!res.ok) {
      console.warn(`virus-scan: VT lookup HTTP ${res.status} for ${hash.slice(0, 12)}…; failing open.`);
      return { verdict: 'skipped' };
    }
    const data = await res.json();
    const stats = data?.data?.attributes?.last_analysis_stats || null;
    const verdict = stats ? classifyStats(stats) : 'unknown';
    cache.set(hash, { verdict, ts: Date.now() });
    return { verdict, stats };
  } catch (err) {
    console.warn('virus-scan: VT lookup failed; failing open:', err.message || err);
    return { verdict: 'skipped' };
  }
}

module.exports = { scanBuffer, sha256 };
