/**
 * Client profile - stored ENCRYPTED at rest (AES-256-GCM).
 *
 *   GET  /api/profile            (imv_session cookie) -> own profile (decrypted)
 *   POST /api/profile { firstName, lastName, phone, legalName } -> save (encrypted)
 *
 * PII never lands in storage as plaintext: each profile is encrypted with a key
 * derived from DATA_ENCRYPTION_KEY (fallback: SESSION_SECRET). Even with raw
 * access to the Blobs store, the record is ciphertext - only this function,
 * holding the env key, can read it. Keyed by sha256(email).
 */

const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function sha256hex(v) { return crypto.createHash('sha256').update(String(v)).digest('hex'); }

function cleanField(v, max) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max || 120);
}

// ----- session (mirrors account.js) -----
// SECURITY: refuse the dev fallback on a deployed host. Without SESSION_SECRET
// set on Netlify, verifySession returns null and the endpoint fails closed.
function sessionSecret(event) {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 20) return secret;
  const host = String(event?.headers?.host || event?.headers?.Host || '');
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'imverica-dev-session-secret-change-me';
  }
  return null;
}
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function parseCookie(header, name) {
  for (const part of String(header || '').split(';')) {
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
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch { return null; }
  if (!payload || !payload.email || !payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

// Profile encryption + storage are shared with auth.js (TOTP fields).
// See lib/profile-store.js for the AES-256-GCM envelope format.
const { readProfile, updateProfile } = require('./lib/profile-store');
const { ensureBlobs } = require('./lib/abuse-guard');

const NAME_OK = /[A-Za-zÀ-ɏЀ-ӿ]/;

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  // CRITICAL: connect @netlify/blobs to the current Lambda context. Without
  // this, getStore() in profile-store.js throws MissingBlobsEnvironmentError
  // and silently falls back to the ephemeral /tmp filesystem — every cold
  // start loses the user's profile and the UI re-asks for their name.
  ensureBlobs(event);

  const session = verifySession(parseCookie(event.headers && (event.headers.cookie || event.headers.Cookie), 'imv_session'), event);
  if (!session) return json(401, { ok: false, error: 'Not signed in' });
  const email = session.email;

  if (event.httpMethod === 'GET') {
    const profile = await readProfile(email);
    // Don't leak the TOTP secret to the client. Surface only the boolean
    // flags so the UI can show "2FA enabled / disabled".
    let safe = null;
    if (profile) {
      const { totpSecret, totpPendingSecret, recoveryCodesHashed, ...rest } = profile;
      safe = { ...rest, totpEnabled: Boolean(profile.totpEnabledAt) };
    }
    return json(200, { ok: true, email, profile: safe });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { ok: false, error: 'Invalid JSON' }); }
    const firstName = cleanField(body.firstName, 60);
    const lastName = cleanField(body.lastName, 60);
    const legalName = cleanField(body.legalName, 160);
    const phoneDigits = String(body.phone || '').replace(/\D/g, '');
    if (!NAME_OK.test(firstName)) return json(422, { ok: false, error: 'Please enter your first name.' });
    if (!NAME_OK.test(lastName)) return json(422, { ok: false, error: 'Please enter your last name.' });
    if (phoneDigits.length < 10 || phoneDigits.length > 15) return json(422, { ok: false, error: 'Please enter a valid phone number.' });

    const patch = {
      firstName, lastName, legalName,
      phone: phoneDigits.length === 10 ? `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}` : phoneDigits
    };
    const merged = await updateProfile(email, patch);
    // Same projection rules as the GET path: never leak the TOTP secret.
    const { totpSecret, totpPendingSecret, recoveryCodesHashed, ...rest } = merged;
    return json(200, { ok: true, profile: { ...rest, totpEnabled: Boolean(merged.totpEnabledAt) } });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
