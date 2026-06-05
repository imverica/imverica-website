/**
 * Account-scoped generated document archive.
 *
 *   POST /api/generated-documents     { name, type, dataBase64, formCode, title, category }
 *     -> stores a wizard-generated draft under the signed-in email.
 *   GET  /api/generated-documents
 *     -> lists generated drafts for the signed-in email.
 *   GET  /api/generated-documents?fileId=...
 *     -> downloads one generated draft.
 *
 * Unlike /api/upload, these documents are not tied to an intake order. They
 * belong to the account itself, so court/USCIS wizards can keep their drafts
 * visible in "My documents" even before the client has a service request.
 */

const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const { ensureBlobs } = require('./lib/abuse-guard');
const { emailHash, encryptString, decryptString, encryptBuffer, decryptBuffer } = require('./lib/crypto');
const { validateUpload, ALLOWED_MIME } = require('./lib/file-validator');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_GENERATED_FILES = 50;
const DIR = path.join(os.tmpdir(), 'imverica-generated-documents');

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

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
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || !payload.email || !payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

async function store() {
  try { return require('@netlify/blobs').getStore('imverica-generated-documents'); } catch { return null; }
}

function safeId(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

function sanitizeName(name) {
  const base = String(name || 'document.pdf').split(/[\\/]/).pop().replace(/[^\w.\- ]/g, '_').slice(0, 140);
  return base || 'document.pdf';
}

async function readJson(s, key) {
  if (s) {
    try { const v = await s.get(key, { type: 'json' }); if (v) return v; } catch { /* fall */ }
  }
  try { return JSON.parse(await fs.readFile(path.join(DIR, `${safeId(key.replace(/\//g, '_'))}.json`), 'utf8')); } catch { return null; }
}

async function writeJson(s, key, value) {
  if (s) {
    try { await s.setJSON(key, value); return; } catch { /* fall */ }
  }
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, `${safeId(key.replace(/\//g, '_'))}.json`), JSON.stringify(value));
}

async function readBlob(s, key) {
  if (s) {
    try { const v = await s.get(key, { type: 'arrayBuffer' }); if (v) return Buffer.from(v); } catch { /* fall */ }
  }
  try { return await fs.readFile(path.join(DIR, safeId(key.replace(/\//g, '_')))); } catch { return null; }
}

async function writeBlob(s, key, buf) {
  if (s) {
    try { await s.set(key, buf); return; } catch { /* fall */ }
  }
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, safeId(key.replace(/\//g, '_'))), buf);
}

function publicEntry(entry, event) {
  return {
    fileId: entry.fileId,
    name: typeof entry.name === 'object' && entry.name?._enc ? decryptString(entry.name, event) : (entry.name || ''),
    type: typeof entry.type === 'object' && entry.type?._enc ? decryptString(entry.type, event) : (entry.type || ''),
    size: entry.size,
    uploadedAt: entry.uploadedAt,
    source: 'generated',
    category: entry.category || '',
    formCode: entry.formCode || '',
    title: typeof entry.title === 'object' && entry.title?._enc ? decryptString(entry.title, event) : (entry.title || '')
  };
}

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const session = verifySession(parseCookie(event.headers?.cookie || event.headers?.Cookie, 'imv_session'), event);
  if (!session) return json(401, { ok: false, error: 'Not signed in' });

  const ownerHash = emailHash(session.email, event);
  const s = await store();
  const metaKey = `meta/${ownerHash}.json`;
  const meta = (await readJson(s, metaKey)) || { files: [] };

  if (event.httpMethod === 'GET') {
    const fileId = safeId((event.queryStringParameters || {}).fileId);
    if (!fileId) {
      const files = meta.files
        .map((entry) => publicEntry(entry, event))
        .sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
      return json(200, { ok: true, files });
    }

    const entry = meta.files.find((item) => item.fileId === fileId);
    if (!entry) return json(404, { ok: false, error: 'File not found' });
    let buf = await readBlob(s, `blob/${ownerHash}/${fileId}`);
    if (!buf) return json(404, { ok: false, error: 'File not found' });
    if (entry.enc) {
      const plain = decryptBuffer(buf, event);
      if (!plain) return json(500, { ok: false, error: 'Could not decrypt file. Please contact support.' });
      buf = plain;
    }
    const pub = publicEntry(entry, event);
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': pub.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${String(pub.name).replace(/"/g, '')}"`,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store'
      },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
    const name = sanitizeName(body.name);
    const type = String(body.type || 'application/pdf').toLowerCase();
    const data = String(body.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!data) return json(400, { ok: false, error: 'No file data' });
    if (!ALLOWED_MIME.includes(type)) return json(415, { ok: false, error: 'Only PDF, JPG, PNG, or DOCX files are accepted.' });

    let buf;
    try { buf = Buffer.from(data, 'base64'); } catch { return json(400, { ok: false, error: 'Invalid file data' }); }
    if (!buf.length) return json(400, { ok: false, error: 'Empty file' });
    if (buf.length > MAX_FILE_BYTES) return json(413, { ok: false, error: 'File too large (max 4 MB).' });

    const validation = validateUpload(buf, name, type);
    if (!validation.ok) return json(415, { ok: false, error: validation.error, code: validation.code });

    const fileId = crypto.randomBytes(8).toString('hex');
    const encBuf = encryptBuffer(buf, event);
    await writeBlob(s, `blob/${ownerHash}/${fileId}`, encBuf);

    meta.files = Array.isArray(meta.files) ? meta.files : [];
    meta.files.unshift({
      fileId,
      name: encryptString(name, event),
      type: encryptString(type || 'application/octet-stream', event),
      title: encryptString(String(body.title || ''), event),
      size: buf.length,
      uploadedAt: new Date().toISOString(),
      source: 'generated',
      category: String(body.category || '').slice(0, 40),
      formCode: String(body.formCode || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40),
      enc: true
    });
    meta.files = meta.files.slice(0, MAX_GENERATED_FILES);
    await writeJson(s, metaKey, meta);

    return json(200, { ok: true, fileId, name, size: buf.length });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
