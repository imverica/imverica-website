/**
 * Client cabinet data endpoint.
 *
 *   GET /api/account  (with imv_session cookie)
 *     → returns ONLY the intake orders whose contact.email matches the
 *       authenticated session email, with status/service/date. 401 if the
 *       session cookie is missing or invalid.
 *
 * Reads the same `imverica-intakes` Blobs store that intake.js writes, so a
 * signed-in client sees their own submissions without the admin token.
 */

const crypto = require('crypto');
const { ensureBlobs } = require('./lib/abuse-guard');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const { decryptRecord, emailHash } = require('./lib/crypto');

// Keep PII_PATHS in sync with intake.js — what was encrypted on write
// must be decrypted on read.
const PII_PATHS = [
  'contact.name',
  'contact.email',
  'contact.phone',
  'serviceLabel',
  'situation'
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/**
 * Return the HMAC secret used to verify session cookies.
 *
 * SECURITY: in production we refuse to fall back to a hard-coded dev secret —
 * doing so would let anyone with read access to this repo forge a session
 * cookie for any email. When SESSION_SECRET is missing on a non-localhost
 * host, this returns null and verifySession will fail closed, forcing
 * operators to set the env var on Netlify before any cabinet access works.
 */
function sessionSecret(event) {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 20) return secret;
  const host = String(event?.headers?.host || event?.headers?.Host || '');
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'imverica-dev-session-secret-change-me';
  }
  return null;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseCookie(header, name) {
  const raw = String(header || '');
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

function verifySession(token, event) {
  if (!token || !token.includes('.')) return null;
  const secret = sessionSecret(event);
  if (!secret) return null;
  const [body, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch { return null; }
  if (!payload || !payload.email || !payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

async function getStore() {
  try {
    const { getStore } = require('@netlify/blobs');
    return getStore('imverica-intakes');
  } catch { return null; }
}

async function listFromFs() {
  const dir = path.join(os.tmpdir(), 'imverica-intakes', 'orders');
  try {
    const files = await fs.readdir(dir);
    const out = [];
    for (const f of files) {
      try { out.push(JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))); } catch { /* skip */ }
    }
    return out;
  } catch { return []; }
}

// Try Blobs (production); fall back to the local filesystem (netlify dev),
// mirroring how intake.js persists records.
async function listRecords(store) {
  if (store) {
    try {
      const result = await store.list({ prefix: 'orders/' });
      const out = [];
      for (const blob of (result.blobs || [])) {
        try { out.push(await store.get(blob.key, { type: 'json' })); } catch { /* skip */ }
      }
      if (out.length) return out.filter(Boolean);
    } catch { /* fall through */ }
  }
  return listFromFs();
}

function summarize(record) {
  return {
    id: record.id,
    status: record.status || 'new',
    createdAt: record.createdAt,
    service: record.serviceLabel || record.service || '',
    situation: String(record.situation || '').slice(0, 600),
    formCode: record.formCode || ''
  };
}

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  const token = parseCookie(event.headers?.cookie || event.headers?.Cookie, 'imv_session');
  const session = verifySession(token, event);
  if (!session) return json(401, { ok: false, error: 'Not signed in' });

  let records;
  try {
    const store = await getStore();
    records = await listRecords(store);
  } catch (err) {
    console.error('account list failed:', err);
    return json(500, { ok: false, error: 'Could not load your account right now.' });
  }

  // Two-pass filter:
  //   1. New records carry emailHash (HMAC) we can compare without decrypting.
  //   2. Legacy plaintext records still have contact.email visible — match
  //      directly. Only decrypt the records that are owned by this session.
  const myHash = emailHash(session.email, event);
  const mineRaw = records.filter((r) => {
    if (!r) return false;
    if (r.emailHash) return r.emailHash === myHash;
    return r.contact && String(r.contact.email || '').toLowerCase() === session.email;
  });
  const mine = mineRaw
    .map((r) => decryptRecord(r, PII_PATHS, event))
    .map(summarize)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return json(200, { ok: true, email: session.email, orders: mine });
};
