/**
 * Client document upload for the cabinet — session + owner gated.
 *
 *   POST /api/upload   { orderId, name, type, dataBase64 }  (session cookie)
 *     → stores the file against an order the signed-in client owns.
 *   GET  /api/upload?orderId=IMV-...                         (session cookie)
 *     → lists files attached to that order (owner only).
 *   GET  /api/upload?orderId=IMV-...&fileId=...              (session cookie)
 *     → downloads one file (owner only).
 *   DELETE /api/upload?orderId=IMV-...&fileId=...            (session cookie)
 *     → removes one file (owner only).
 *
 * Files live in the `imverica-files` Blobs store; metadata per order in
 * `meta/{orderId}.json`. Falls back to the local filesystem under netlify dev.
 * Ownership is enforced by checking the intake record's contact.email against
 * the session email — a client can only touch their own orders' files.
 */

const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB raw (function body limit ~6MB)
const MAX_FILES_PER_ORDER = 20;
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'heic', 'webp'];
const ALLOWED_TYPE = /^(application\/pdf|image\/(jpeg|png|heic|webp)|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/;

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
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

// ----- storage (Blobs with fs fallback) -----
async function store(name) {
  try { return require('@netlify/blobs').getStore(name); } catch { return null; }
}
function safeId(value) { return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64); }

async function readJson(s, key, fallbackDir) {
  if (s) { try { const v = await s.get(key, { type: 'json' }); if (v) return v; } catch { /* fall */ } }
  try { return JSON.parse(await fs.readFile(path.join(fallbackDir, `${safeId(key.replace(/\//g, '_'))}.json`), 'utf8')); } catch { return null; }
}
async function writeJson(s, key, value, fallbackDir) {
  if (s) { try { await s.setJSON(key, value); return; } catch { /* fall */ } }
  await fs.mkdir(fallbackDir, { recursive: true });
  await fs.writeFile(path.join(fallbackDir, `${safeId(key.replace(/\//g, '_'))}.json`), JSON.stringify(value));
}
async function writeBlob(s, key, buf, fallbackDir) {
  if (s) { try { await s.set(key, buf); return; } catch { /* fall */ } }
  await fs.mkdir(fallbackDir, { recursive: true });
  await fs.writeFile(path.join(fallbackDir, safeId(key.replace(/\//g, '_'))), buf);
}
async function readBlob(s, key, fallbackDir) {
  if (s) { try { const v = await s.get(key, { type: 'arrayBuffer' }); if (v) return Buffer.from(v); } catch { /* fall */ } }
  try { return await fs.readFile(path.join(fallbackDir, safeId(key.replace(/\//g, '_')))); } catch { return null; }
}
async function deleteBlob(s, key, fallbackDir) {
  if (s) { try { await s.delete(key); return; } catch { /* fall */ } }
  try { await fs.unlink(path.join(fallbackDir, safeId(key.replace(/\//g, '_')))); } catch { /* ignore */ }
}

const FILES_DIR = path.join(os.tmpdir(), 'imverica-files');

// ----- ownership: does this order belong to the session email? -----
async function ownsOrder(email, orderId) {
  const id = safeId(orderId);
  if (!id) return false;
  const s = await store('imverica-intakes');
  let record = null;
  if (s) { try { record = await s.get(`orders/${id}.json`, { type: 'json' }); } catch { /* fall */ } }
  if (!record) {
    try { record = JSON.parse(await fs.readFile(path.join(os.tmpdir(), 'imverica-intakes', 'orders', `${id}.json`), 'utf8')); } catch { /* none */ }
  }
  return Boolean(record && record.contact && String(record.contact.email || '').toLowerCase() === email);
}

function sanitizeName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop().replace(/[^\w.\- ]/g, '_').slice(0, 120);
  return base || 'file';
}
function extOf(name) { return (String(name).split('.').pop() || '').toLowerCase(); }

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const session = verifySession(parseCookie(event.headers?.cookie || event.headers?.Cookie, 'imv_session'));
  if (!session) return json(401, { ok: false, error: 'Not signed in' });

  const q = event.queryStringParameters || {};
  const orderId = safeId(q.orderId || (event.body ? (() => { try { return JSON.parse(event.body).orderId; } catch { return ''; } })() : ''));
  if (!orderId) return json(400, { ok: false, error: 'Missing orderId' });
  if (!(await ownsOrder(session.email, orderId))) return json(403, { ok: false, error: 'Not your order' });

  const filesStore = await store('imverica-files');
  const metaKey = `meta/${orderId}.json`;

  if (event.httpMethod === 'GET') {
    const meta = (await readJson(filesStore, metaKey, FILES_DIR)) || { files: [] };
    const fileId = safeId(q.fileId);
    if (!fileId) {
      return json(200, { ok: true, files: meta.files.map((f) => ({ fileId: f.fileId, name: f.name, type: f.type, size: f.size, uploadedAt: f.uploadedAt, source: f.source || 'client' })) });
    }
    const entry = meta.files.find((f) => f.fileId === fileId);
    if (!entry) return json(404, { ok: false, error: 'File not found' });
    const buf = await readBlob(filesStore, `blob/${orderId}/${fileId}`, FILES_DIR);
    if (!buf) return json(404, { ok: false, error: 'File not found' });
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': entry.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${entry.name.replace(/"/g, '')}"`
      },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  }

  if (event.httpMethod === 'DELETE') {
    const fileId = safeId(q.fileId);
    if (!fileId) return json(400, { ok: false, error: 'Missing fileId' });
    const meta = (await readJson(filesStore, metaKey, FILES_DIR)) || { files: [] };
    const entry = meta.files.find((f) => f.fileId === fileId);
    if (entry && entry.source === 'prepared') {
      return json(403, { ok: false, error: 'Documents prepared by Imverica cannot be deleted here.' });
    }
    meta.files = meta.files.filter((f) => f.fileId !== fileId);
    await writeJson(filesStore, metaKey, meta, FILES_DIR);
    await deleteBlob(filesStore, `blob/${orderId}/${fileId}`, FILES_DIR);
    return json(200, { ok: true });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
    const name = sanitizeName(body.name);
    const type = String(body.type || '').toLowerCase();
    const data = String(body.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!data) return json(400, { ok: false, error: 'No file data' });
    if (!ALLOWED_EXT.includes(extOf(name)) || (type && !ALLOWED_TYPE.test(type))) {
      return json(415, { ok: false, error: 'Unsupported file type. Use PDF, JPG, PNG, or DOCX.' });
    }
    let buf;
    try { buf = Buffer.from(data, 'base64'); } catch { return json(400, { ok: false, error: 'Invalid file data' }); }
    if (!buf.length) return json(400, { ok: false, error: 'Empty file' });
    if (buf.length > MAX_FILE_BYTES) return json(413, { ok: false, error: 'File too large (max 4 MB).' });

    const meta = (await readJson(filesStore, metaKey, FILES_DIR)) || { files: [] };
    if (meta.files.length >= MAX_FILES_PER_ORDER) return json(409, { ok: false, error: 'Too many files on this request.' });

    const fileId = crypto.randomBytes(8).toString('hex');
    await writeBlob(filesStore, `blob/${orderId}/${fileId}`, buf, FILES_DIR);
    meta.files.push({ fileId, name, type: type || 'application/octet-stream', size: buf.length, uploadedAt: new Date().toISOString(), source: 'client' });
    await writeJson(filesStore, metaKey, meta, FILES_DIR);
    return json(200, { ok: true, fileId, name, size: buf.length });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
