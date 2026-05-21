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
function sessionSecret() { return process.env.SESSION_SECRET || 'imverica-dev-session-secret-change-me'; }
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function parseCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}
function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', sessionSecret()).update(body).digest());
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch { return null; }
  if (!payload || !payload.email || !payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

// ----- AES-256-GCM field encryption -----
function dataKey() {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'imverica-dev-data-key';
  return crypto.createHash('sha256').update(secret).digest();
}
function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return { enc: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}
function decrypt(blob) {
  if (!blob || blob.enc !== 1) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey(), Buffer.from(blob.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
    const out = Buffer.concat([decipher.update(Buffer.from(blob.data, 'base64')), decipher.final()]);
    return JSON.parse(out.toString('utf8'));
  } catch { return null; }
}

// ----- storage (Blobs + fs fallback) -----
const DIR = path.join(os.tmpdir(), 'imverica-profiles');
async function getStore() { try { return require('@netlify/blobs').getStore('imverica-profiles'); } catch { return null; } }
function key(email) { return `profile/${sha256hex(email)}.json`; }
function fsName(k) { return k.replace(/[^A-Za-z0-9_-]/g, '_'); }

async function readBlob(s, email) {
  const k = key(email);
  if (s) { try { const v = await s.get(k, { type: 'json' }); if (v) return v; } catch (e) { /* fall */ } }
  try { return JSON.parse(await fs.readFile(path.join(DIR, `${fsName(k)}.json`), 'utf8')); } catch (e) { return null; }
}
async function writeBlob(s, email, value) {
  const k = key(email);
  if (s) { try { await s.setJSON(k, value); return; } catch (e) { /* fall */ } }
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, `${fsName(k)}.json`), JSON.stringify(value));
}

const NAME_OK = /[A-Za-zÀ-ɏЀ-ӿ]/;

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const session = verifySession(parseCookie(event.headers && (event.headers.cookie || event.headers.Cookie), 'imv_session'));
  if (!session) return json(401, { ok: false, error: 'Not signed in' });
  const email = session.email;
  const store = await getStore();

  if (event.httpMethod === 'GET') {
    const profile = decrypt(await readBlob(store, email)) || null;
    return json(200, { ok: true, email, profile });
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

    const profile = {
      firstName, lastName, legalName,
      phone: phoneDigits.length === 10 ? `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}` : phoneDigits,
      email,
      updatedAt: new Date().toISOString()
    };
    await writeBlob(store, email, encrypt(profile));
    return json(200, { ok: true, profile });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
