/**
 * Passwordless OTP auth for the Imverica client cabinet.
 *
 *   POST /api/auth { action: 'request-otp', email }
 *     → generates a 6-digit code, stores its SHA-256 hash in Netlify Blobs
 *       (10-min expiry, attempt + rate-limit counters), emails it via Resend.
 *       In dev (no RESEND_API_KEY) the code is logged and returned so the
 *       flow is testable locally.
 *
 *   POST /api/auth { action: 'verify-otp', email, code }
 *     → verifies the code (single-use, expiry + attempt limits) and, on
 *       success, sets an HMAC-signed httpOnly session cookie.
 *
 *   POST /api/auth { action: 'logout' }
 *     → clears the session cookie.
 *
 * No passwords are stored. The session token is a stateless HMAC of
 * {email, exp} signed with SESSION_SECRET — no server session store needed.
 */

const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

const OTP_TTL_MS = 10 * 60 * 1000;        // code valid 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;            // per code
const MAX_REQUESTS_PER_WINDOW = 5;        // request-otp throttle
const REQUEST_WINDOW_MS = 60 * 60 * 1000; // per hour
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body)
  };
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 180);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sessionSecret() {
  return process.env.SESSION_SECRET || 'imverica-dev-session-secret-change-me';
}

function signSession(email) {
  const payload = { email, exp: Date.now() + SESSION_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', sessionSecret()).update(body).digest());
  return `${body}.${sig}`;
}

async function otpStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore('imverica-otps');
}

function otpKey(email) {
  return `otp/${sha256(email)}.json`;
}

// Storage falls back to the local filesystem whenever the Blobs store is
// unavailable (null) or an op throws — so it works under `netlify dev`
// (no Blobs sandbox) and in production (Blobs) without an env-var guess.
function fsPath(key) {
  const os = require('os');
  const path = require('path');
  return path.join(os.tmpdir(), 'imverica-otps', `${sha256(key)}.json`);
}

async function readState(store, key) {
  if (store) {
    try { return (await store.get(key, { type: 'json' })) || null; } catch { /* fall through */ }
  }
  try { return JSON.parse(await require('fs/promises').readFile(fsPath(key), 'utf8')); } catch { return null; }
}

async function writeState(store, key, value) {
  if (store) {
    try { await store.setJSON(key, value); return; } catch { /* fall through */ }
  }
  const fs = require('fs/promises');
  const path = require('path');
  await fs.mkdir(path.dirname(fsPath(key)), { recursive: true });
  await fs.writeFile(fsPath(key), JSON.stringify(value));
}

async function deleteState(store, key) {
  if (store) {
    try { await store.delete(key); return; } catch { /* fall through */ }
  }
  try { await require('fs/promises').unlink(fsPath(key)); } catch { /* ignore */ }
}

async function sendOtpEmail(email, code) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.OTP_FROM_EMAIL || 'Imverica Legal Solutions <login@imverica.com>';
  if (!key) {
    // No provider configured — caller decides whether to surface the code
    // (local only) or treat it as a misconfiguration (deployed host).
    console.log(`[auth] DEV OTP for ${email}: ${code}`);
    return { sent: false, dev: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} is your Imverica sign-in code`,
      text:
        `Your Imverica client portal sign-in code is: ${code}\n\n` +
        `It expires in 10 minutes. If you did not request this, you can ignore this email.\n\n` +
        `Imverica Legal Solutions — not a law firm; document preparation only.`
    })
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
  return { sent: true };
}

function isLocalHost(event) {
  const host = String(event.headers?.host || event.headers?.Host || '');
  return host.includes('localhost') || host.includes('127.0.0.1');
}

function sessionCookie(token, event, { clear = false } = {}) {
  const secure = isLocalHost(event) ? '' : ' Secure;';
  const maxAge = clear ? 0 : Math.floor(SESSION_TTL_MS / 1000);
  const value = clear ? '' : token;
  return `imv_session=${value}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const action = String(body.action || '');

  if (action === 'logout') {
    return json(200, { ok: true }, { 'Set-Cookie': sessionCookie('', event, { clear: true }) });
  }

  const email = cleanEmail(body.email);
  if (!isValidEmail(email)) return json(422, { ok: false, error: 'Please enter a valid email address.' });

  const store = await otpStore().catch(() => null);
  const key = otpKey(email);

  if (action === 'request-otp') {
    const now = Date.now();
    const prev = (await readState(store, key)) || {};
    let windowStart = prev.windowStart || now;
    let requests = prev.requests || 0;
    if (now - windowStart > REQUEST_WINDOW_MS) { windowStart = now; requests = 0; }
    if (requests >= MAX_REQUESTS_PER_WINDOW) {
      return json(429, { ok: false, error: 'Too many code requests. Please wait a while and try again.' });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const state = {
      codeHash: sha256(`${email}:${code}`),
      exp: now + OTP_TTL_MS,
      attempts: 0,
      windowStart,
      requests: requests + 1
    };
    await writeState(store, key, state);

    let dev = false;
    try {
      const result = await sendOtpEmail(email, code);
      dev = Boolean(result.dev);
    } catch (err) {
      console.error('OTP email failed:', err);
      return json(502, { ok: false, error: 'Could not send the code right now. Please try again shortly.' });
    }

    // If no provider is configured AND this is a deployed host (not localhost),
    // that's a misconfiguration — never leak the code in the response.
    if (dev && !isLocalHost(event)) {
      return json(503, { ok: false, error: 'Sign-in email is not configured yet. Please contact us at +1 (916) 399-3992.' });
    }

    // Locally (no provider) we return the code so the flow is testable.
    return json(200, { ok: true, sent: true, ...(dev && isLocalHost(event) ? { devCode: code } : {}) });
  }

  if (action === 'verify-otp') {
    const code = String(body.code || '').replace(/\D/g, '').slice(0, 6);
    const state = await readState(store, key);
    if (!state || !state.codeHash) return json(400, { ok: false, error: 'No active code. Request a new one.' });
    if (Date.now() > state.exp) { await deleteState(store, key); return json(400, { ok: false, error: 'Code expired. Request a new one.' }); }
    if (state.attempts >= MAX_VERIFY_ATTEMPTS) { await deleteState(store, key); return json(429, { ok: false, error: 'Too many attempts. Request a new code.' }); }

    if (sha256(`${email}:${code}`) !== state.codeHash) {
      state.attempts += 1;
      await writeState(store, key, state);
      return json(401, { ok: false, error: 'Incorrect code. Please try again.' });
    }

    await deleteState(store, key); // single-use
    const token = signSession(email);
    return json(200, { ok: true, email }, { 'Set-Cookie': sessionCookie(token, event) });
  }

  return json(400, { ok: false, error: 'Unknown action' });
};
