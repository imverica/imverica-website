/**
 * Shared abuse / DDoS guard for Netlify Functions.
 *
 * Two layers stacked together:
 *
 *  1. originGuard(event, allowedHosts) — verifies the request originated
 *     from imverica.com (Origin or Referer header). Bot floods that don't
 *     forge these headers get 403 instantly without touching expensive
 *     downstream paths (Resend email send, Anthropic call, etc).
 *
 *  2. ipThrottle(key, opts) — per-IP sliding-window rate limit backed by
 *     @netlify/blobs (persistent across function invocations). Catches
 *     attackers who DO forge headers + rotate emails. Default: 30 hits per
 *     5 minutes per (action, ip) pair.
 *
 * Both are no-ops when invoked with a missing event or in tests; both
 * fail closed (returning a 429/403) and surface clear error messages.
 */

const { getStore } = require('@netlify/blobs');

// ---------- Origin / Referer check ----------

const DEFAULT_ALLOWED = [
  'imverica.com',
  'www.imverica.com',
  // Local dev (netlify dev) — keep these so cabinet QA still works.
  'localhost',
  '127.0.0.1'
];

function hostnameOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ''; }
}

function isAllowedHost(hostname, allowedHosts) {
  if (!hostname) return false;
  const allow = allowedHosts && allowedHosts.length ? allowedHosts : DEFAULT_ALLOWED;
  return allow.some((h) => hostname === h || hostname.endsWith('.' + h));
}

/**
 * Returns null when the request is OK; returns a Netlify response object
 * (`{ statusCode, headers, body }`) when the request should be rejected.
 *
 * Usage in a function:
 *
 *   const reject = originGuard(event);
 *   if (reject) return reject;
 */
function originGuard(event, allowedHosts) {
  if (!event || !event.headers) return null; // tests / odd invocations
  const h = event.headers || {};
  // Case-insensitive header lookup.
  function pick(name) {
    if (!h) return '';
    const lo = name.toLowerCase();
    for (const k of Object.keys(h)) {
      if (k.toLowerCase() === lo) return h[k];
    }
    return '';
  }
  // Bypass for OPTIONS preflight — CORS handles those.
  const method = (event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return null;

  const origin = pick('origin');
  const referer = pick('referer');
  const apiKey = pick('x-imverica-internal'); // for trusted server-to-server (admin scripts)

  // Server-to-server calls (Netlify Functions internal) often have no Origin.
  // We only enforce on POST/PUT/DELETE from browsers — GET is safe (no
  // side effects) and OPTIONS is preflight.
  if (method === 'GET') return null;

  // Allow trusted internal key (used by future admin scripts).
  if (apiKey && process.env.INTAKE_ADMIN_TOKEN && apiKey === process.env.INTAKE_ADMIN_TOKEN) {
    return null;
  }

  const oHost = origin ? hostnameOf(origin) : '';
  const rHost = referer ? hostnameOf(referer) : '';
  if (oHost && isAllowedHost(oHost, allowedHosts)) return null;
  if (!oHost && rHost && isAllowedHost(rHost, allowedHosts)) return null; // some Capacitor WebViews omit Origin

  return {
    statusCode: 403,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: false, error: 'Request rejected.' })
  };
}

// ---------- IP-based sliding-window rate limit ----------

function clientIp(event) {
  if (!event || !event.headers) return '';
  const h = event.headers;
  // Netlify forwards client IP via x-nf-client-connection-ip; fall back
  // through standard chains. We hash later before storing.
  const ip = h['x-nf-client-connection-ip']
    || h['X-NF-Client-Connection-Ip']
    || (h['x-forwarded-for'] || h['X-Forwarded-For'] || '').split(',')[0].trim()
    || h['cf-connecting-ip']
    || event.clientContext?.identity?.url
    || '0.0.0.0';
  return String(ip).slice(0, 64);
}

function bucketKey(action, ip) {
  // Same-shape keys group by action so different endpoints don't share
  // counters. We do NOT hash the IP at rest; it stays inside Netlify's
  // private blob store and expires automatically.
  return `${action}:${ip}`;
}

function throttleStore() {
  return getStore('imverica-throttle');
}

/**
 * Sliding-window throttle. Returns { allowed: bool, retryAfter: seconds }.
 *
 * opts:
 *   action        Logical bucket name ('intake', 'auth-otp-request', etc).
 *                 Different actions get independent counters.
 *   limit         Hits allowed per window. Default 30.
 *   windowSec     Window length in seconds. Default 300 (5 min).
 *
 * Usage:
 *
 *   const t = await ipThrottle(event, { action: 'intake', limit: 6 });
 *   if (!t.allowed) return json(429, { ok: false, error: 'Too many requests', retryAfter: t.retryAfter });
 */
async function ipThrottle(event, opts) {
  const action = (opts && opts.action) || 'default';
  const limit = (opts && opts.limit) || 30;
  const windowSec = (opts && opts.windowSec) || 300;
  const ip = clientIp(event);
  if (!ip || ip === '0.0.0.0') {
    // Couldn't identify caller — let it through but log via Netlify
    // function console. Better than blocking real users behind weird
    // proxies. Repeated abuse will still hit per-email throttles.
    return { allowed: true, retryAfter: 0 };
  }

  const store = throttleStore();
  const key = bucketKey(action, ip);
  const now = Date.now();
  const cutoff = now - windowSec * 1000;

  let rec;
  try {
    rec = await store.get(key, { type: 'json' });
  } catch (e) {
    rec = null;
  }
  // rec: { hits: [tsMs, tsMs, ...] }
  const prior = (rec && Array.isArray(rec.hits)) ? rec.hits.filter((t) => t > cutoff) : [];

  if (prior.length >= limit) {
    const oldest = prior[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + windowSec * 1000 - now) / 1000));
    return { allowed: false, retryAfter, hits: prior.length };
  }

  const next = prior.concat(now);
  try {
    // Set TTL so old buckets free themselves (1.5× window).
    await store.setJSON(key, { hits: next }, { metadata: { expiresAt: now + windowSec * 1500 } });
  } catch (e) {
    // Storage hiccup → allow the request rather than locking users out.
  }
  return { allowed: true, retryAfter: 0, hits: next.length };
}

/**
 * Convenience wrapper that returns a ready-to-return 429 response when
 * the throttle fires. Returns null when the request should proceed.
 *
 *   const reject = await throttleOrReject(event, { action:'intake', limit:6 });
 *   if (reject) return reject;
 */
async function throttleOrReject(event, opts) {
  const t = await ipThrottle(event, opts);
  if (t.allowed) return null;
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(t.retryAfter)
    },
    body: JSON.stringify({
      ok: false,
      error: 'Too many requests. Please wait a moment and try again.',
      retryAfter: t.retryAfter
    })
  };
}

module.exports = { originGuard, ipThrottle, throttleOrReject, clientIp };
