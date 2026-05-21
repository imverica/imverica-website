/**
 * Client ↔ firm messaging for the cabinet.
 *
 * Client (imv_session cookie):
 *   GET  /api/messages              → own thread
 *   POST /api/messages { text }     → append a message from the client
 *
 * Staff (Authorization: Bearer <INTAKE_ADMIN_TOKEN>):
 *   GET  /api/messages?email=...    → that client's thread
 *   POST /api/messages { email, text } → reply as staff
 *   GET  /api/messages?inbox=1      → list threads (email + last message + count)
 *
 * One thread per client email, stored in Blobs `imverica-messages`
 * (thread/{sha256(email)}.json), fs fallback for local dev. No interpretation
 * or advice is added by the server — it only relays what each side types.
 */

const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

const MAX_TEXT = 4000;
const MAX_MESSAGES = 500;

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function sha256(v) { return crypto.createHash('sha256').update(String(v)).digest('hex'); }
function cleanEmail(v) { return String(v || '').trim().toLowerCase().slice(0, 180); }
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
function cleanText(v) { return String(v || "").replace(/\u0000/g, "").trim().slice(0, MAX_TEXT); }

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

function isAdmin(event) {
  const token = process.env.INTAKE_ADMIN_TOKEN;
  if (!token) return false;
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return bearer === token || (event.queryStringParameters?.token || '') === token;
}

// ----- storage -----
const DIR = path.join(os.tmpdir(), 'imverica-messages');
async function getStore() { try { return require('@netlify/blobs').getStore('imverica-messages'); } catch { return null; } }
function threadKey(email) { return `thread/${sha256(email)}.json`; }
function fsName(key) { return key.replace(/[^A-Za-z0-9_-]/g, '_'); }

async function readThread(s, email) {
  const key = threadKey(email);
  if (s) { try { const v = await s.get(key, { type: 'json' }); if (v) return v; } catch { /* fall */ } }
  try { return JSON.parse(await fs.readFile(path.join(DIR, `${fsName(key)}.json`), 'utf8')); } catch { return { email, messages: [] }; }
}
async function writeThread(s, email, thread) {
  const key = threadKey(email);
  if (s) { try { await s.setJSON(key, thread); return; } catch { /* fall */ } }
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, `${fsName(key)}.json`), JSON.stringify(thread));
}
async function listThreads(s) {
  if (s) {
    try {
      const res = await s.list({ prefix: 'thread/' });
      const out = [];
      for (const b of (res.blobs || [])) { try { out.push(await s.get(b.key, { type: 'json' })); } catch { /* skip */ } }
      return out.filter(Boolean);
    } catch { /* fall */ }
  }
  try {
    const files = await fs.readdir(DIR);
    const out = [];
    for (const f of files) { try { out.push(JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8'))); } catch { /* skip */ } }
    return out;
  } catch { return []; }
}

function summarizeThread(t) {
  const last = t.messages[t.messages.length - 1];
  return { email: t.email, count: t.messages.length, last: last ? { from: last.from, text: last.text.slice(0, 120), ts: last.ts } : null };
}

async function appendMessage(s, email, from, text) {
  const thread = await readThread(s, email);
  if (!Array.isArray(thread.messages)) thread.messages = [];
  thread.messages.push({ id: crypto.randomBytes(6).toString('hex'), from, text, ts: new Date().toISOString() });
  if (thread.messages.length > MAX_MESSAGES) thread.messages = thread.messages.slice(-MAX_MESSAGES);
  thread.email = email;
  await writeThread(s, email, thread);
  return thread;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const admin = isAdmin(event);
  const session = admin ? null : verifySession(parseCookie(event.headers?.cookie || event.headers?.Cookie, 'imv_session'));
  if (!admin && !session) return json(401, { ok: false, error: 'Not signed in' });

  const s = await getStore();
  const q = event.queryStringParameters || {};

  // resolve which thread we operate on
  let email;
  if (admin) {
    email = cleanEmail(q.email);
    if (event.httpMethod === 'POST') { try { email = cleanEmail(JSON.parse(event.body || '{}').email) || email; } catch { /* keep */ } }
  } else {
    email = session.email; // client can only touch their own thread
  }

  if (event.httpMethod === 'GET') {
    if (admin && q.inbox) {
      const threads = (await listThreads(s)).map(summarizeThread)
        .sort((a, b) => String(b.last?.ts || '').localeCompare(String(a.last?.ts || '')));
      return json(200, { ok: true, threads });
    }
    if (!isValidEmail(email)) return json(400, { ok: false, error: 'Missing email' });
    const thread = await readThread(s, email);
    return json(200, { ok: true, email, messages: thread.messages || [] });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
    const text = cleanText(body.text);
    if (!text) return json(422, { ok: false, error: 'Message is empty.' });
    if (!isValidEmail(email)) return json(400, { ok: false, error: 'Missing email' });
    const thread = await appendMessage(s, email, admin ? 'staff' : 'client', text);
    return json(200, { ok: true, email, messages: thread.messages });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
