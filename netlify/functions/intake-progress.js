/**
 * Intake progress — server-side auto-save for the long wizard.
 *
 * The old flow saved wizard state to localStorage only. That worked while
 * the same browser session was alive, but a network drop / device change
 * / "clear browsing data" wiped everything and the client had to start
 * from question one. This endpoint lets the wizard sync its draft to
 * the server every few seconds so the client can pick up where they
 * left off — on any device, after any timeout.
 *
 * Endpoints:
 *   GET  /api/intake-progress?orderId=…   → { ok, progress }
 *   POST /api/intake-progress             → body { orderId, state }
 *   DELETE /api/intake-progress?orderId=… → wipe (e.g. after submission)
 *
 * All operations require an imv_session cookie (same as upload.js /
 * account.js) and verify the order belongs to that session's email.
 * The serialized wizard state is encrypted at rest with the same
 * DATA_ENCRYPTION_KEY used for everything else (PII paths in intake
 * answers, file blobs, etc.).
 */

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const { originGuard, throttleOrReject, ensureBlobs } = require('./lib/abuse-guard');
const { encryptString, decryptString, emailHash } = require('./lib/crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie'
};

// Wizard state is small text — a few KB of JSON. Cap aggressively so a
// hostile session cannot pad blob storage with megabytes of garbage.
const MAX_BODY_BYTES = 256 * 1024;
const MAX_STATE_BYTES = 200 * 1024;

function json(statusCode, body, extra = {}) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) };
}

function progressStore() {
  return getStore('imverica-intake-progress');
}

function safeOrderId(id) {
  const s = String(id || '').trim().toUpperCase();
  return /^IMV-\d{8}-[A-F0-9]{8,32}$/.test(s) ? s : '';
}

// Session verification — reuse the same HMAC scheme as auth.js. We don't
// import auth.js directly to keep this function's cold-start fast.
function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return '';
  const parts = String(cookieHeader).split(';');
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) return part.slice(eq + 1).trim();
  }
  return '';
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s) {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function verifySession(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const body = parts[0];
  const sig = parts[1];
  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(unb64url(body).toString('utf8'));
    if (!payload || !payload.email || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

// Confirms the requesting session owns the order. Reads the intake blob
// store and compares emailHash against the session's email.
async function sessionOwnsOrder(session, orderId, event) {
  if (!session || !orderId) return false;
  try {
    const intakeStore = getStore('imverica-intakes');
    const order = await intakeStore.get(`order/${orderId}.json`, { type: 'json' });
    if (!order) return false;
    return order.emailHash === emailHash(session.email, event);
  } catch (e) {
    return false;
  }
}

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  // Origin guard for state-changing verbs only (GET is safe).
  if (['POST', 'DELETE'].includes(event.httpMethod)) {
    const reject = originGuard(event);
    if (reject) return { ...reject, headers: { ...CORS, ...reject.headers } };
  }

  // Per-IP throttle. Saves run constantly during typing — allow generous
  // headroom; the 60 / 1 min ceiling still kills any runaway script that
  // forgot to debounce.
  const throttleReject = await throttleOrReject(event, {
    action: 'intake-progress',
    limit: 60,
    windowSec: 60
  });
  if (throttleReject) return { ...throttleReject, headers: { ...CORS, ...throttleReject.headers } };

  // Authenticate.
  const cookie = event.headers?.cookie || event.headers?.Cookie || '';
  const session = verifySession(parseCookie(cookie, 'imv_session'));
  if (!session) return json(401, { ok: false, error: 'Not signed in' });

  const q = event.queryStringParameters || {};

  if (event.httpMethod === 'GET') {
    const orderId = safeOrderId(q.orderId);
    if (!orderId) return json(400, { ok: false, error: 'Missing orderId' });
    if (!(await sessionOwnsOrder(session, orderId, event))) return json(403, { ok: false, error: 'Not your order' });

    let record;
    try { record = await progressStore().get(`progress/${orderId}.json`, { type: 'json' }); }
    catch (e) { record = null; }
    if (!record) return json(200, { ok: true, progress: null });

    let state = null;
    try { state = JSON.parse(decryptString(record.encState, event)); }
    catch (e) { state = null; }
    return json(200, { ok: true, progress: { state, updatedAt: record.updatedAt || 0, version: record.version || 1 } });
  }

  if (event.httpMethod === 'POST') {
    if (Buffer.byteLength(event.body || '', 'utf8') > MAX_BODY_BYTES) {
      return json(413, { ok: false, error: 'Progress payload too large' });
    }
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { ok: false, error: 'Invalid JSON' }); }

    const orderId = safeOrderId(body.orderId);
    if (!orderId) return json(400, { ok: false, error: 'Missing orderId' });
    if (!(await sessionOwnsOrder(session, orderId, event))) return json(403, { ok: false, error: 'Not your order' });

    const stateBlob = JSON.stringify(body.state || {});
    if (stateBlob.length > MAX_STATE_BYTES) {
      return json(413, { ok: false, error: 'State too large; please contact support.' });
    }

    const encState = encryptString(stateBlob, event);
    const record = {
      orderId,
      encState,
      updatedAt: Date.now(),
      version: (Number(body.version) || 0) + 1
    };
    try { await progressStore().setJSON(`progress/${orderId}.json`, record); }
    catch (e) { return json(500, { ok: false, error: 'Could not save progress.' }); }
    return json(200, { ok: true, updatedAt: record.updatedAt, version: record.version });
  }

  if (event.httpMethod === 'DELETE') {
    const orderId = safeOrderId(q.orderId);
    if (!orderId) return json(400, { ok: false, error: 'Missing orderId' });
    if (!(await sessionOwnsOrder(session, orderId, event))) return json(403, { ok: false, error: 'Not your order' });
    try { await progressStore().delete(`progress/${orderId}.json`); }
    catch (e) {}
    return json(200, { ok: true });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
