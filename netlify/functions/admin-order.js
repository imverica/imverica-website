/**
 * Admin: update an intake order's status.
 *
 *   POST /api/admin-order  (Authorization: Bearer <INTAKE_ADMIN_TOKEN>)
 *     { orderId, status }   status ∈ new | in_review | ready
 *
 * Reads/writes the same `imverica-intakes` Blobs store that intake.js uses
 * (fs fallback for local dev). Does not modify intake.js. The client cabinet
 * reflects the new status on next load (badge: Received / In review / Ready).
 */

const os = require('os');
const { ensureBlobs } = require('./lib/abuse-guard');
const path = require('path');
const fs = require('fs/promises');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

const ALLOWED_STATUS = ['new', 'in_review', 'ready'];

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// Two-factor admin auth (bearer token + TOTP). See lib/admin-auth.js.
const { isAdmin } = require('./lib/admin-auth');

function safeId(v) { return String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64); }

async function getStore() {
  try { return require('@netlify/blobs').getStore('imverica-intakes'); } catch { return null; }
}

const FS_DIR = path.join(os.tmpdir(), 'imverica-intakes', 'orders');

async function readOrder(store, id) {
  const key = `orders/${id}.json`;
  if (store) { try { const v = await store.get(key, { type: 'json' }); if (v) return v; } catch { /* fall */ } }
  try { return JSON.parse(await fs.readFile(path.join(FS_DIR, `${id}.json`), 'utf8')); } catch { return null; }
}

async function writeOrder(store, id, record) {
  const key = `orders/${id}.json`;
  if (store) { try { await store.setJSON(key, record); return; } catch { /* fall */ } }
  await fs.mkdir(FS_DIR, { recursive: true });
  await fs.writeFile(path.join(FS_DIR, `${id}.json`), JSON.stringify(record, null, 2));
}

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  if (!isAdmin(event)) return json(401, { ok: false, error: 'Unauthorized' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const orderId = safeId(body.orderId);
  const status = String(body.status || '').trim();
  if (!orderId) return json(400, { ok: false, error: 'Missing orderId' });
  if (!ALLOWED_STATUS.includes(status)) return json(422, { ok: false, error: `status must be one of ${ALLOWED_STATUS.join(', ')}` });

  const store = await getStore();
  const record = await readOrder(store, orderId);
  if (!record) return json(404, { ok: false, error: 'Order not found' });

  record.status = status;
  record.updatedAt = new Date().toISOString();
  await writeOrder(store, orderId, record);

  return json(200, { ok: true, orderId, status, updatedAt: record.updatedAt });
};
