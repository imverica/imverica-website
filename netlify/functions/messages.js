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
const MAX_ATTACHMENTS = 3;            // per message
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB raw (function body limit ~6MB)
// Reuse the same strict upload validation + AV hash lookup as upload.js so a
// chat attachment is held to identical safety standards (magic bytes, MIME
// allow-list, filename ban-list, VirusTotal hash check).
const { validateUpload, ALLOWED_MIME } = require('./lib/file-validator');
const { scanBuffer } = require('./lib/virus-scan');

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

// ----- attachment storage (chat file uploads) -----
// File bytes live in a separate Blobs store so the thread JSON stays small.
// Keyed by sha256(email)/<fileId>; bytes encrypted at rest with encryptBuffer.
// Download is gated in the GET handler by checking the fileId belongs to the
// caller's own thread.
const FILES_DIR = path.join(os.tmpdir(), 'imverica-message-files');
async function getFilesStore() { try { return require('@netlify/blobs').getStore('imverica-message-files'); } catch { return null; } }
function fileKey(email, fileId) { return `blob/${sha256(cleanEmail(email))}/${fileId}`; }
async function writeFileBlob(s, key, buf) {
  if (s) { try { await s.set(key, buf); return; } catch { /* fall */ } }
  await fs.mkdir(FILES_DIR, { recursive: true });
  await fs.writeFile(path.join(FILES_DIR, fsName(key)), buf);
}
async function readFileBlob(s, key) {
  if (s) { try { const v = await s.get(key, { type: 'arrayBuffer' }); if (v) return Buffer.from(v); } catch { /* fall */ } }
  try { return await fs.readFile(path.join(FILES_DIR, fsName(key))); } catch { return null; }
}

function sanitizeName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop().replace(/[^\w.\- ]/g, '_').slice(0, 120);
  return base || 'file';
}

/**
 * Validate + store an array of {name, type, dataBase64} attachments for one
 * client message. Returns { ok, attachments?, error? }. Each stored file is
 * AES-GCM encrypted; the returned metadata holds only {fileId, name, type,
 * size} (plaintext here — writeThread encrypts name/type before persisting).
 */
async function processAttachments(rawList, email, event) {
  if (!Array.isArray(rawList) || !rawList.length) return { ok: true, attachments: [] };
  if (rawList.length > MAX_ATTACHMENTS) return { ok: false, error: `Up to ${MAX_ATTACHMENTS} files per message.` };
  const s = await getFilesStore();
  const out = [];
  for (const raw of rawList) {
    const name = sanitizeName(raw && raw.name);
    const type = String((raw && raw.type) || '').toLowerCase();
    const data = String((raw && raw.dataBase64) || '').replace(/^data:[^;]+;base64,/, '');
    if (!data) return { ok: false, error: 'An attachment had no data.' };
    if (!ALLOWED_MIME.includes(type)) return { ok: false, error: 'Only PDF, JPG, PNG, or DOCX files are accepted.' };
    let buf;
    try { buf = Buffer.from(data, 'base64'); } catch { return { ok: false, error: 'Invalid attachment data.' }; }
    if (!buf.length) return { ok: false, error: 'An attachment was empty.' };
    if (buf.length > MAX_FILE_BYTES) return { ok: false, error: 'Attachment too large (max 4 MB).' };
    const validation = validateUpload(buf, name, type);
    if (!validation.ok) return { ok: false, error: validation.error };
    const scan = await scanBuffer(buf);
    if (scan.verdict === 'malicious' || scan.verdict === 'suspicious') {
      return { ok: false, error: 'An attachment was flagged by anti-virus. Please re-export from a clean source.' };
    }
    const fileId = crypto.randomBytes(8).toString('hex');
    await writeFileBlob(s, fileKey(email, fileId), encryptBuffer(buf, event));
    out.push({ fileId, name, type: type || 'application/octet-stream', size: buf.length });
  }
  return { ok: true, attachments: out };
}

/**
 * Encrypted-at-rest read: each message's `text` is stored as an
 * AES-256-GCM blob (see lib/crypto.encryptString). On read we decrypt
 * back to plain strings so the rest of the function (search, summary,
 * UI) works untouched. Legacy plaintext messages (no _v marker on the
 * thread) pass through unchanged.
 */
const { encryptString, decryptString, encryptBuffer, decryptBuffer } = require('./lib/crypto');

function decryptThread(thread, event) {
  if (!thread || !Array.isArray(thread.messages)) return thread;
  if (!thread._v) return thread; // legacy plaintext
  return {
    ...thread,
    messages: thread.messages.map((m) => ({
      ...m,
      text: decryptString(m.text, event),
      // Attachment filename + MIME are PII (often contain the client's name
      // or document type) so they are stored encrypted like message text.
      ...(Array.isArray(m.attachments)
        ? { attachments: m.attachments.map((a) => ({ ...a, name: decryptString(a.name, event), type: decryptString(a.type, event) })) }
        : {})
    }))
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
    messages: (thread.messages || []).map((m) => ({
      ...m,
      text: encryptString(m.text, event),
      ...(Array.isArray(m.attachments)
        ? { attachments: m.attachments.map((a) => ({ ...a, name: encryptString(a.name, event), type: encryptString(a.type, event) })) }
        : {})
    }))
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

async function appendMessage(s, email, from, text, event, attachments) {
  const thread = await readThread(s, email, event);
  if (!Array.isArray(thread.messages)) thread.messages = [];
  const msg = { id: crypto.randomBytes(6).toString('hex'), from, text, ts: new Date().toISOString() };
  if (Array.isArray(attachments) && attachments.length) msg.attachments = attachments;
  thread.messages.push(msg);
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
async function notifyOwnerOfClientMessage(clientEmail, text, attachments) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[messages] RESEND_API_KEY not set — skipping owner notification email');
    return { sent: false, skipped: true };
  }
  // Build Resend attachment objects {filename, content(base64)} from the
  // raw uploaded files so the owner sees the documents directly in Gmail.
  const mailAttachments = (Array.isArray(attachments) ? attachments : [])
    .map((a) => ({
      filename: String((a && a.name) || 'attachment').split(/[\\/]/).pop().replace(/[^\w.\- ]/g, '_').slice(0, 120),
      content: String((a && a.dataBase64) || '').replace(/^data:[^;]+;base64,/, '')
    }))
    .filter((a) => a.content);
  const ownerInboxes = (process.env.MESSAGES_NOTIFY_TO || 'imverica@gmail.com,info@imverica.com')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const fromAddr = process.env.MESSAGES_FROM || 'Imverica Messages <messages@imverica.com>';
  // Replies land at a per-thread token address served by Resend Inbound.
  // We default to the predefined `estutkal.resend.app` subdomain because
  // imverica.com's root MX points at Zoho (info@imverica.com) and the
  // free Resend plan only allows one custom domain (already taken by
  // imverica.com for outbound). The predefined `*@<id>.resend.app`
  // address fires the `email.received` webhook → /api/messages-inbound.
  // Override via MESSAGES_REPLY_DOMAIN once a paid plan / custom domain
  // is in place (e.g. reply.imverica.com).
  const replyDomain = process.env.MESSAGES_REPLY_DOMAIN || 'estutkal.resend.app';
  const replyLocalPart = process.env.MESSAGES_REPLY_LOCAL || 'reply';
  const replyTo = `${replyLocalPart}+${threadToken(clientEmail)}@${replyDomain}`;
  const subject = `New portal message from ${clientEmail}`;
  const portalLink = (process.env.URL || 'https://imverica.com')
    + '/admin.html#messages=' + encodeURIComponent(clientEmail);

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;line-height:1.55;color:#1a2238;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f1c2f;">New message in client portal</h2>
      <p style="margin:0 0 8px;"><strong>From:</strong> ${escapeHtml(clientEmail)}</p>
      <div style="margin:14px 0;padding:14px 16px;background:#f3f6fb;border-left:3px solid #1a2e4a;border-radius:0 6px 6px 0;font-size:14.5px;white-space:pre-wrap;">${text ? escapeHtml(text) : '<em style="color:#8a93a3;">(no text — see attached file' + (mailAttachments.length > 1 ? 's' : '') + ')</em>'}</div>
      ${mailAttachments.length ? `<p style="margin:0 0 12px;font-size:13px;color:#1a2e4a;">📎 <strong>${mailAttachments.length}</strong> attachment${mailAttachments.length > 1 ? 's' : ''}: ${mailAttachments.map((a) => escapeHtml(a.filename)).join(', ')}</p>` : ''}
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
        ...(mailAttachments.length ? { attachments: mailAttachments } : {}),
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

    // Attachment download: ?file=<fileId>. Authorize by confirming the
    // fileId is referenced by a message in THIS caller's thread, then stream
    // the decrypted bytes with hardened, no-inline headers (mirrors upload.js).
    const fileId = String(q.file || '').replace(/[^a-f0-9]/gi, '').slice(0, 32);
    if (fileId) {
      let att = null;
      for (const m of (thread.messages || [])) {
        if (Array.isArray(m.attachments)) { const f = m.attachments.find((a) => a.fileId === fileId); if (f) { att = f; break; } }
      }
      if (!att) return json(404, { ok: false, error: 'File not found' });
      const fs2 = await getFilesStore();
      const enc = await readFileBlob(fs2, fileKey(email, fileId));
      if (!enc) return json(404, { ok: false, error: 'File not found' });
      const buf = decryptBuffer(enc, event);
      if (!buf) return json(500, { ok: false, error: 'Could not decrypt file.' });
      return {
        statusCode: 200,
        headers: {
          ...CORS,
          'Content-Type': att.type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${String(att.name).replace(/"/g, '')}"`,
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Cache-Control': 'private, no-store'
        },
        body: buf.toString('base64'),
        isBase64Encoded: true
      };
    }

    return json(200, { ok: true, email, messages: thread.messages || [] });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
    const text = cleanText(body.text);
    if (!isValidEmail(email)) return json(400, { ok: false, error: 'Missing email' });

    // Validate + persist attachments (if any). A message may be attachments
    // only (no text) or text only, but not empty.
    let stored = [];
    if (Array.isArray(body.attachments) && body.attachments.length) {
      const res = await processAttachments(body.attachments, email, event);
      if (!res.ok) return json(415, { ok: false, error: res.error });
      stored = res.attachments;
    }
    if (!text && !stored.length) return json(422, { ok: false, error: 'Message is empty.' });

    const thread = await appendMessage(s, email, admin ? 'staff' : 'client', text, event, stored);
    // When the CLIENT sends, notify the owner via email so they can
    // reply directly from Gmail (Resend Inbound routes the reply back
    // into the same thread via /api/messages-inbound). When STAFF sends
    // from the admin console, no email goes out — staff is already
    // actively in the conversation. Attachments ride along as real email
    // attachments so the owner sees them in Gmail.
    if (!admin) {
      notifyOwnerOfClientMessage(email, text, stored.length ? body.attachments : []).catch((e) => console.error('[messages] notify:', e));
    }
    return json(200, { ok: true, email, messages: thread.messages });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
