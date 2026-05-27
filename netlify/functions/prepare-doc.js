/**
 * Admin: place a prepared PDF into a client's cabinet.
 *
 *   POST /api/prepare-doc  (Authorization: Bearer <INTAKE_ADMIN_TOKEN>)
 *     { orderId }                       → generate the PDF from the order's
 *                                         stored formCode + formAnswers and
 *                                         attach it to the order.
 *     { orderId, pdfBase64, name }      → attach an already-prepared PDF
 *                                         (for orders with no formAnswers,
 *                                         e.g. guest portal submissions).
 *
 * Stored in the `imverica-files` store with source:'prepared' so the signed-in
 * client sees and downloads it from their cabinet (via account/upload GET).
 * Admin-only — clients never call this.
 */

const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const { encryptString, encryptBuffer } = require('./lib/crypto');
const fsSync = require('fs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// Two-factor admin auth (bearer token + TOTP). See lib/admin-auth.js.
const { isAdmin } = require('./lib/admin-auth');

function safeId(v) { return String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64); }

async function getStore(name) {
  try { return require('@netlify/blobs').getStore(name); } catch { return null; }
}

async function readOrder(orderId) {
  const id = safeId(orderId);
  const s = await getStore('imverica-intakes');
  if (s) { try { const v = await s.get(`orders/${id}.json`, { type: 'json' }); if (v) return v; } catch { /* fall */ } }
  try { return JSON.parse(await fs.readFile(path.join(os.tmpdir(), 'imverica-intakes', 'orders', `${id}.json`), 'utf8')); } catch { return null; }
}

// imverica-files storage (mirrors upload.js)
const FILES_DIR = path.join(os.tmpdir(), 'imverica-files');
function fsKey(key) { return safeId(key.replace(/\//g, '_')); }
async function readMeta(s, key) {
  if (s) { try { const v = await s.get(key, { type: 'json' }); if (v) return v; } catch { /* fall */ } }
  try { return JSON.parse(await fs.readFile(path.join(FILES_DIR, `${fsKey(key)}.json`), 'utf8')); } catch { return null; }
}
async function writeMeta(s, key, value) {
  if (s) { try { await s.setJSON(key, value); return; } catch { /* fall */ } }
  await fs.mkdir(FILES_DIR, { recursive: true });
  await fs.writeFile(path.join(FILES_DIR, `${fsKey(key)}.json`), JSON.stringify(value));
}
async function writeBlob(s, key, buf) {
  if (s) { try { await s.set(key, buf); return; } catch { /* fall */ } }
  await fs.mkdir(FILES_DIR, { recursive: true });
  await fs.writeFile(path.join(FILES_DIR, fsKey(key)), buf);
}

async function generatePdfBuffer(record, override) {
  const formCode = (override && override.formCode) || record.formCode;
  if (!formCode) throw new Error('Order has no formCode — attach a PDF directly instead.');
  const payload = {
    formCode,
    formType: formCode,
    formAnswers: (override && override.formAnswers) || record.formAnswers || {},
    contact: record.contact || {},
    answers: record.formAnswers || {}
  };
  const generate = require('./generate-pdf').handler;
  const res = await generate({ httpMethod: 'POST', headers: {}, body: JSON.stringify(payload) });
  if (res.statusCode !== 200 || !res.isBase64Encoded) {
    let msg = 'PDF generation failed';
    try { msg = JSON.parse(res.body).error || msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  return { buf: Buffer.from(res.body, 'base64'), formCode };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  if (!isAdmin(event)) return json(401, { ok: false, error: 'Unauthorized' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const orderId = safeId(body.orderId);
  if (!orderId) return json(400, { ok: false, error: 'Missing orderId' });

  const record = await readOrder(orderId);
  if (!record) return json(404, { ok: false, error: 'Order not found' });

  let buf, name;
  try {
    if (body.pdfBase64) {
      buf = Buffer.from(String(body.pdfBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
      name = String(body.name || `${record.formCode || 'document'}-prepared.pdf`).replace(/[^\w.\- ]/g, '_').slice(0, 120);
      if (!buf.length) return json(400, { ok: false, error: 'Empty PDF' });
    } else {
      const gen = await generatePdfBuffer(record, body);
      buf = gen.buf;
      name = `${gen.formCode}-prepared.pdf`;
    }
  } catch (err) {
    return json(422, { ok: false, error: err.message });
  }

  const filesStore = await getStore('imverica-files');
  const metaKey = `meta/${orderId}.json`;
  const meta = (await readMeta(filesStore, metaKey)) || { files: [] };
  const fileId = crypto.randomBytes(8).toString('hex');
  // Encrypt the PDF body so a Blobs leak yields opaque ciphertext, not
  // the client's prepared filing. Same format as upload.js uses.
  const encBuf = encryptBuffer(buf, event);
  await writeBlob(filesStore, `blob/${orderId}/${fileId}`, encBuf);
  meta.files.push({
    fileId,
    name: encryptString(name, event),
    type: encryptString('application/pdf', event),
    size: buf.length,
    uploadedAt: new Date().toISOString(),
    source: 'prepared',
    enc: true
  });
  await writeMeta(filesStore, metaKey, meta);

  return json(200, { ok: true, fileId, name, size: buf.length, source: 'prepared' });
};
