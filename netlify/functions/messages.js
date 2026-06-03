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
const { ensureBlobs } = require('./lib/abuse-guard');
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

// Two-factor admin auth (bearer token + TOTP). See lib/admin-auth.js.
const { isAdmin } = require('./lib/admin-auth');

// ----- storage -----
const DIR = path.join(os.tmpdir(), 'imverica-messages');
async function getStore() { try { return require('@netlify/blobs').getStore('imverica-messages'); } catch { return null; } }
function threadKey(email) { return `thread/${sha256(email)}.json`; }
function fsName(key) { return key.replace(/[^A-Za-z0-9_-]/g, '_'); }

/**
 * Encrypted-at-rest read: each message's `text` is stored as an
 * AES-256-GCM blob (see lib/crypto.encryptString). On read we decrypt
 * back to plain strings so the rest of the function (search, summary,
 * UI) works untouched. Legacy plaintext messages (no _v marker on the
 * thread) pass through unchanged.
 */
const { encryptString, decryptString } = require('./lib/crypto');

function decryptThread(thread, event) {
  if (!thread || !Array.isArray(thread.messages)) return thread;
  if (!thread._v) return thread; // legacy plaintext
  return {
    ...thread,
    messages: thread.messages.map((m) => ({ ...m, text: decryptString(m.text, event) }))
  };
}

async function readThread(s, email, event) {
  const key = threadKey(email);
  let raw = null;
  if (s) { try { raw = await s.get(key, { type: 'json' }); } catch { /* fall */ } }
  if (!raw) {
    try { raw = JSON.parse(await fs.readFile(path.join(DIR, `${fsName(key)}.json`), 'utf8')); } catch { return { email, messages: [] }; }
  }
  return decryptThread(raw, event);
}
async function writeThread(s, email, thread, event) {
  // Encrypt every message text before persisting; mark with _v so future
  // readers know to decrypt.
  const encryptedThread = {
    ...thread,
    _v: 2,
    messages: (thread.messages || []).map((m) => ({ ...m, text: encryptString(m.text, event) }))
  };
  const key = threadKey(email);
  if (s) { try { await s.setJSON(key, encryptedThread); return; } catch { /* fall */ } }
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, `${fsName(key)}.json`), JSON.stringify(encryptedThread));
}
async function listThreads(s, event) {
  let raws = [];
  if (s) {
    try {
      const res = await s.list({ prefix: 'thread/' });
      for (const b of (res.blobs || [])) { try { raws.push(await s.get(b.key, { type: 'json' })); } catch { /* skip */ } }
    } catch { /* fall */ }
  }
  if (!raws.length) {
    try {
      const files = await fs.readdir(DIR);
      for (const f of files) { try { raws.push(JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8'))); } catch { /* skip */ } }
    } catch { /* keep empty */ }
  }
  return raws.filter(Boolean).map((t) => decryptThread(t, event));
}

function summarizeThread(t) {
  const last = t.messages[t.messages.length - 1];
  return { email: t.email, count: t.messages.length, last: last ? { from: last.from, text: last.text.slice(0, 120), ts: last.ts } : null };
}

async function appendMessage(s, email, from, text, event) {
  const thread = await readThread(s, email, event);
  if (!Array.isArray(thread.messages)) thread.messages = [];
  thread.messages.push({ id: crypto.randomBytes(6).toString('hex'), from, text, ts: new Date().toISOString() });
  if (thread.messages.length > MAX_MESSAGES) thread.messages = thread.messages.slice(-MAX_MESSAGES);
  thread.email = email;
  await writeThread(s, email, thread, event);
  return thread;
}

// ----- Owner notification via Resend -----
// Reply-To is a per-thread token (12 chars of sha256(email)) so Resend
// Inbound (or any other inbound provider) can route the owner's reply
// back to the right portal thread via messages-inbound.js.
const THREAD_TOKEN_LEN = 12;
function threadToken(email) {
  return sha256(cleanEmail(email)).slice(0, THREAD_TOKEN_LEN);
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}
async function notifyOwnerOfClientMessage(clientEmail, text) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[messages] RESEND_API_KEY not set — skipping owner notification email');
    return { sent: false, skipped: true };
  }
  const ownerInboxes = (process.env.MESSAGES_NOTIFY_TO || 'imverica@gmail.com,info@imverica.com')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const fromAddr = process.env.MESSAGES_FROM || 'Imverica Messages <messages@imverica.com>';
  // Replies in Gmail land at this address. Cloudflare Email Routing
  // is configured on imverica.com to catch `replies+*@imverica.com`
  // and forward to a Worker which POSTs to /api/messages-inbound.
  // No subdomain → no extra DNS zone setup needed.
  const replyDomain = process.env.MESSAGES_REPLY_DOMAIN || 'imverica.com';
  const replyLocalPart = process.env.MESSAGES_REPLY_LOCAL || 'replies';
  const replyTo = `${replyLocalPart}+${threadToken(clientEmail)}@${replyDomain}`;
  const subject = `New portal message from ${clientEmail}`;
  const portalLink = (process.env.URL || 'https://imverica.com')
    + '/admin.html#messages=' + encodeURIComponent(clientEmail);

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;line-height:1.55;color:#1a2238;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f1c2f;">New message in client portal</h2>
      <p style="margin:0 0 8px;"><strong>From:</strong> ${escapeHtml(clientEmail)}</p>
      <div style="margin:14px 0;padding:14px 16px;background:#f3f6fb;border-left:3px solid #1a2e4a;border-radius:0 6px 6px 0;font-size:14.5px;white-space:pre-wrap;">${escapeHtml(text)}</div>
      <p style="margin:14px 0 4px;font-size:13px;color:#4a5a6e;">
        <strong>Reply by simply replying to this email</strong> — your reply will appear in the client's portal automatically.<br>
        Or open the conversation in admin: <a href="${portalLink}" style="color:#1a2e4a;">${portalLink}</a>
      </p>
      <hr style="border:0;border-top:1px solid #e6e6e6;margin:18px 0;">
      <p style="font-size:11.5px;color:#8a93a3;margin:0;">
        This message originates from the Imverica client portal at imverica.com/account. The client has consented to electronic communication. Imverica is not a law firm; do not include legal advice in replies.
      </p>
    </div>
  `;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddr,
        to: ownerInboxes,
        reply_to: replyTo,
        subject,
        html,
        headers: {
          // Helps inbound webhooks identify the thread even if the
          // owner's mail client drops the Reply-To and replies to From:.
          'X-Imverica-Thread': threadToken(clientEmail),
          'X-Imverica-Client-Email': clientEmail
        }
      })
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[messages] Resend notification failed', r.status, detail.slice(0, 200));
      return { sent: false, error: `Resend ${r.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('[messages] notification error:', err.message || err);
    return { sent: false, error: 'network' };
  }
}

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const admin = isAdmin(event);
  const session = admin ? null : verifySession(parseCookie(event.headers?.cookie || event.headers?.Cookie, 'imv_session'), event);
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
      const threads = (await listThreads(s, event)).map(summarizeThread)
        .sort((a, b) => String(b.last?.ts || '').localeCompare(String(a.last?.ts || '')));
      return json(200, { ok: true, threads });
    }
    if (!isValidEmail(email)) return json(400, { ok: false, error: 'Missing email' });
    const thread = await readThread(s, email, event);
    return json(200, { ok: true, email, messages: thread.messages || [] });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
    const text = cleanText(body.text);
    if (!text) return json(422, { ok: false, error: 'Message is empty.' });
    if (!isValidEmail(email)) return json(400, { ok: false, error: 'Missing email' });
    const thread = await appendMessage(s, email, admin ? 'staff' : 'client', text, event);
    // When the CLIENT sends, notify the owner via email so they can
    // reply directly from Gmail (Resend Inbound routes the reply back
    // into the same thread via /api/messages-inbound). When STAFF sends
    // from the admin console, no email goes out — staff is already
    // actively in the conversation.
    if (!admin) {
      notifyOwnerOfClientMessage(email, text).catch((e) => console.error('[messages] notify:', e));
    }
    return json(200, { ok: true, email, messages: thread.messages });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
