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
const { ensureBlobs } = require('./lib/abuse-guard');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

const MAX_FILE_BYTES = 4 * 1024 * 1024;    // per-request body cap (Netlify fn body ~6MB)
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;  // assembled file cap — large files arrive chunked
const MAX_CHUNKS = 12;                      // ceiling on chunk count (25MB / ~2MB+)
const MAX_FILES_PER_ORDER = 20;
// Strict upload validation lives in lib/file-validator.js — it checks
// magic bytes, MIME allow-list, filename ban-list, and double-extension
// tricks like `report.pdf.exe`. Anything not on the list is rejected.
const { validateUpload, ALLOWED_MIME } = require('./lib/file-validator');
// Defence-in-depth: also ask VirusTotal whether the SHA-256 of the file
// is already known-bad. Falls back to skipped/allow if VT is not
// configured or unreachable — see lib/virus-scan.js for the contract.
const { scanBuffer } = require('./lib/virus-scan');

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
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
// Encrypted records store emailHash (HMAC) — match against that without
// decrypting the email. Legacy plaintext records still have contact.email
// in the clear, so fall back to direct comparison for them.
const { emailHash, encryptString, decryptString, encryptBuffer, decryptBuffer } = require('./lib/crypto');

async function ownsOrder(email, orderId, event) {
  const id = safeId(orderId);
  if (!id) return false;
  const s = await store('imverica-intakes');
  let record = null;
  if (s) { try { record = await s.get(`orders/${id}.json`, { type: 'json' }); } catch { /* fall */ } }
  if (!record) {
    try { record = JSON.parse(await fs.readFile(path.join(os.tmpdir(), 'imverica-intakes', 'orders', `${id}.json`), 'utf8')); } catch { /* none */ }
  }
  if (!record) return false;
  if (record.emailHash) return record.emailHash === emailHash(email, event);
  // Legacy plaintext: compare directly.
  return Boolean(record.contact && String(record.contact.email || '').toLowerCase() === email);
}

function sanitizeName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop().replace(/[^\w.\- ]/g, '_').slice(0, 120);
  return base || 'file';
}

// ----- Google Drive mirror -----
// Best-effort: every client upload is also copied into a Drive folder owned
// by imverica@gmail.com so the team can browse incoming docs without logging
// into the admin console. Folder structure:
//   {GDRIVE_PARENT_FOLDER_ID}
//     └─ {YYYY-MM-DD} · {client name or email}
//         └─ {original-file-name}
// Requires env vars GDRIVE_SERVICE_ACCOUNT_JSON (full SA key JSON, raw string)
// and GDRIVE_PARENT_FOLDER_ID. See SETUP-DRIVE.md for the 5-minute setup.
function b64urlBuf(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function getDriveAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlBuf(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64urlBuf(Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })));
  const sigInput = `${header}.${claim}`;
  const sig = crypto.createSign('RSA-SHA256').update(sigInput).sign(creds.private_key);
  const jwt = `${sigInput}.${b64urlBuf(sig)}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  if (!r.ok) throw new Error(`drive token http ${r.status}`);
  const j = await r.json();
  return j.access_token;
}
async function ensureDriveSubfolder(accessToken, parentId, folderName) {
  // Find or create. Quote-escape single quotes for the query.
  const safeName = folderName.replace(/'/g, "\\'");
  const q = `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const search = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (search.ok) {
    const sj = await search.json();
    if (sj.files && sj.files[0] && sj.files[0].id) return sj.files[0].id;
  }
  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
  });
  if (!create.ok) throw new Error(`drive mkdir http ${create.status}`);
  const cj = await create.json();
  return cj.id;
}
async function uploadFileToDriveFolder(accessToken, folderId, fileName, buffer, mimeType) {
  const boundary = 'imverica-' + crypto.randomBytes(8).toString('hex');
  const metaJson = JSON.stringify({ name: fileName, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  });
  if (!r.ok) throw new Error(`drive upload http ${r.status}`);
  return await r.json();
}
async function mirrorToDrive({ orderId, fileName, buffer, mimeType, clientName, clientEmail }) {
  const rawJson = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
  const parentId = process.env.GDRIVE_PARENT_FOLDER_ID;
  if (!rawJson || !parentId) return null; // not configured — silently skip
  let creds;
  try { creds = JSON.parse(rawJson); } catch (e) { console.error('drive: bad SA JSON', e.message); return null; }
  if (!creds.client_email || !creds.private_key) {
    console.error('drive: SA JSON missing client_email/private_key');
    return null;
  }
  try {
    const token = await getDriveAccessToken(creds);
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const personLabel = (clientName || clientEmail || orderId).replace(/[\\/]/g, '_').slice(0, 80);
    const folderName = `${date} · ${personLabel}`;
    const folderId = await ensureDriveSubfolder(token, parentId, folderName);
    return await uploadFileToDriveFolder(token, folderId, fileName, buffer, mimeType);
  } catch (err) {
    console.error('drive mirror failed', err && err.message ? err.message : err);
    return null;
  }
}
async function loadOrderRecord(orderId, event) {
  const id = safeId(orderId);
  if (!id) return null;
  const s = await store('imverica-intakes');
  let raw = null;
  if (s) {
    try { raw = await s.get(`orders/${id}.json`, { type: 'json' }); } catch { /* fall */ }
  }
  if (!raw) {
    try { raw = JSON.parse(await fs.readFile(path.join(os.tmpdir(), 'imverica-intakes', 'orders', `${id}.json`), 'utf8')); } catch { return null; }
  }
  // Decrypt PII fields so callers (e.g. Drive mirror that needs the client
  // name for folder labels) see plaintext. Legacy records pass through.
  if (raw && raw._v) {
    const out = JSON.parse(JSON.stringify(raw));
    if (out.contact) {
      out.contact.name = decryptString(out.contact.name, event);
      out.contact.email = decryptString(out.contact.email, event);
      out.contact.phone = decryptString(out.contact.phone, event);
    }
    return out;
  }
  return raw;
}
function extOf(name) { return (String(name).split('.').pop() || '').toLowerCase(); }

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const session = verifySession(parseCookie(event.headers?.cookie || event.headers?.Cookie, 'imv_session'), event);
  if (!session) return json(401, { ok: false, error: 'Not signed in' });

  const q = event.queryStringParameters || {};
  const rawOrderId = String(q.orderId || (event.body ? (() => { try { return JSON.parse(event.body).orderId; } catch { return ''; } })() : ''));
  // "general" = each signed-in client's own document bucket, NOT tied to a formal
  // request — so they can upload before opening one. It maps to a per-user id
  // derived from the session (HMAC of the email), owned by definition.
  const isGeneral = rawOrderId === 'general';
  const orderId = isGeneral ? ('gen-' + safeId(emailHash(session.email, event))) : safeId(rawOrderId);
  if (!orderId) return json(400, { ok: false, error: 'Missing orderId' });
  if (!isGeneral && !(await ownsOrder(session.email, orderId, event))) return json(403, { ok: false, error: 'Not your order' });

  const filesStore = await store('imverica-files');
  const metaKey = `meta/${orderId}.json`;

  // Helper to expose a file entry to the client UI — decrypts the filename
  // and mime if they were stored encrypted, keeping the wire format stable.
  function publicEntry(f) {
    return {
      fileId: f.fileId,
      name: typeof f.name === 'object' && f.name?._enc ? decryptString(f.name, event) : (f.name || ''),
      type: typeof f.type === 'object' && f.type?._enc ? decryptString(f.type, event) : (f.type || ''),
      size: f.size,
      uploadedAt: f.uploadedAt,
      source: f.source || 'client'
    };
  }

  if (event.httpMethod === 'GET') {
    const meta = (await readJson(filesStore, metaKey, FILES_DIR)) || { files: [] };
    const fileId = safeId(q.fileId);
    if (!fileId) {
      return json(200, { ok: true, files: meta.files.map(publicEntry) });
    }
    const entry = meta.files.find((f) => f.fileId === fileId);
    if (!entry) return json(404, { ok: false, error: 'File not found' });
    let buf = await readBlob(filesStore, `blob/${orderId}/${fileId}`, FILES_DIR);
    if (!buf) return json(404, { ok: false, error: 'File not found' });
    // If the entry is marked encrypted, decrypt back to original bytes.
    // Legacy plaintext uploads (no entry.enc flag) pass through.
    if (entry.enc) {
      const plain = decryptBuffer(buf, event);
      if (!plain) return json(500, { ok: false, error: 'Could not decrypt file. Please contact support.' });
      buf = plain;
    }
    const pub = publicEntry(entry);
    // Lock the response so a hostile uploaded file can never be rendered
    // inline by the browser even if a cookie leak / typo somewhere served
    // it as text/html. The four headers below cover stored-XSS, MIME
    // sniffing, embedding via <iframe>, and inline script execution.
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

  // Take a COMPLETE file buffer (single-shot or reassembled from chunks) and run
  // it through the full security pipeline: magic-byte validation → VirusTotal
  // hash scan → encrypt-at-rest → store + metadata → best-effort Drive mirror.
  async function finalizeUpload(buf, name, type) {
    if (!buf.length) return json(400, { ok: false, error: 'Empty file' });
    if (buf.length > MAX_TOTAL_BYTES) return json(413, { ok: false, error: 'File too large (max 25 MB).' });

    const validation = validateUpload(buf, name, type);
    if (!validation.ok) return json(415, { ok: false, error: validation.error, code: validation.code });

    const scan = await scanBuffer(buf);
    if (scan.verdict === 'malicious') {
      console.warn('upload: blocked by VT, hash flagged as malicious by', scan.stats?.malicious, 'engines');
      return json(415, { ok: false, error: 'This file is flagged as malicious by anti-virus engines. Please re-export from a clean source.', code: 'vt-malicious' });
    }
    if (scan.verdict === 'suspicious') {
      console.warn('upload: blocked by VT, hash flagged as suspicious by', scan.stats?.suspicious, 'engines');
      return json(415, { ok: false, error: 'This file is flagged as suspicious by anti-virus engines. Please verify and re-upload.', code: 'vt-suspicious' });
    }

    const meta = (await readJson(filesStore, metaKey, FILES_DIR)) || { files: [] };
    if (meta.files.length >= MAX_FILES_PER_ORDER) return json(409, { ok: false, error: 'Too many files on this request.' });

    const fileId = crypto.randomBytes(8).toString('hex');
    // Encrypt the file body at rest. iv||tag||ciphertext is one blob;
    // entry.enc=true tells the GET path it needs decryptBuffer.
    const encBuf = encryptBuffer(buf, event);
    await writeBlob(filesStore, `blob/${orderId}/${fileId}`, encBuf, FILES_DIR);
    meta.files.push({
      fileId,
      // Filename + mime are PII (client names, doc category) → encrypted too.
      name: encryptString(name, event),
      type: encryptString(type || 'application/octet-stream', event),
      size: buf.length,
      uploadedAt: new Date().toISOString(),
      source: 'client',
      enc: true
    });
    await writeJson(filesStore, metaKey, meta, FILES_DIR);

    try {
      const record = await loadOrderRecord(orderId, event);
      const driveRes = await mirrorToDrive({
        orderId, fileName: name, buffer: buf, mimeType: type || 'application/octet-stream',
        clientName: record && record.contact ? record.contact.name : '', clientEmail: session.email
      });
      if (driveRes && driveRes.id) {
        meta.files[meta.files.length - 1].driveFileId = driveRes.id;
        if (driveRes.webViewLink) meta.files[meta.files.length - 1].driveLink = driveRes.webViewLink;
        await writeJson(filesStore, metaKey, meta, FILES_DIR);
      }
    } catch (e) { console.error('mirrorToDrive threw', e && e.message ? e.message : e); }

    return json(200, { ok: true, fileId, name, size: buf.length });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
    const name = sanitizeName(body.name);
    const type = String(body.type || '').toLowerCase();
    const data = String(body.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!data) return json(400, { ok: false, error: 'No file data' });
    // Quick MIME pre-check; full magic-byte verification happens in
    // finalizeUpload once the whole file is in hand.
    if (!ALLOWED_MIME.includes(type)) {
      return json(415, { ok: false, error: 'Only PDF, JPG, PNG, or DOCX files are accepted.' });
    }
    let part;
    try { part = Buffer.from(data, 'base64'); } catch { return json(400, { ok: false, error: 'Invalid file data' }); }
    if (!part.length) return json(400, { ok: false, error: 'Empty file' });
    // Each request body must stay under the function limit — large files are
    // split client-side into chunks of this size or less.
    if (part.length > MAX_FILE_BYTES) return json(413, { ok: false, error: 'Upload chunk too large.' });

    // ---- Chunked upload (files larger than one ~6MB function body) ----
    // Client sends sequential chunks sharing an uploadId; we buffer each in
    // Blobs and reassemble on the final chunk, then run the full pipeline.
    const uploadId = safeId(body.uploadId);
    const totalChunks = parseInt(body.totalChunks, 10) || 0;
    if (uploadId && totalChunks > 1) {
      if (totalChunks > MAX_CHUNKS) return json(413, { ok: false, error: 'File too large (max 25 MB).' });
      const chunkIndex = parseInt(body.chunkIndex, 10);
      if (!(chunkIndex >= 0 && chunkIndex < totalChunks)) return json(400, { ok: false, error: 'Bad chunk index' });
      await writeBlob(filesStore, `chunks/${orderId}/${uploadId}/${chunkIndex}`, part, FILES_DIR);
      if (chunkIndex < totalChunks - 1) return json(200, { ok: true, received: chunkIndex }); // wait for the rest
      // Final chunk → reassemble in order, then clean up the temp chunks.
      const parts = [];
      let total = 0;
      for (let i = 0; i < totalChunks; i++) {
        const p = await readBlob(filesStore, `chunks/${orderId}/${uploadId}/${i}`, FILES_DIR);
        if (!p) return json(409, { ok: false, error: 'A piece of the upload was lost in transit. Please try again.' });
        parts.push(p); total += p.length;
      }
      for (let i = 0; i < totalChunks; i++) await deleteBlob(filesStore, `chunks/${orderId}/${uploadId}/${i}`, FILES_DIR);
      if (total > MAX_TOTAL_BYTES) return json(413, { ok: false, error: 'File too large (max 25 MB).' });
      return await finalizeUpload(Buffer.concat(parts), name, type);
    }

    // ---- Single-shot (files that fit in one request body) ----
    return await finalizeUpload(part, name, type);
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
