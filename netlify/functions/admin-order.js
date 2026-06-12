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

// Full case lifecycle (lib/case-status.js). Legacy new|in_review|ready still
// accepted via normalizeStatus aliases.
const { STATUSES, normalizeStatus, applyStatus } = require('./lib/case-status');
const { decryptRecord } = require('./lib/crypto');

// Keep in sync with intake.js — what was encrypted on write.
const PII_PATHS = ['contact.name', 'contact.email', 'contact.phone', 'serviceLabel', 'situation'];

// ===== Review request on completion =====
// The moment an order is marked completed we ask the client for a Google
// review — in their language, once per order. Fire-and-forget: never blocks
// the status update; skips cleanly without RESEND_API_KEY.
const REVIEW_URL = () => process.env.GOOGLE_REVIEW_URL
  || 'https://www.google.com/search?q=Imverica+Legal+Solutions+Sacramento+reviews';

const REVIEW_COPY = {
  en: {
    subject: 'Thank you from Imverica — one small favor?',
    body: (name) => `${name ? name + ', t' : 'T'}hank you for trusting Imverica Legal Solutions with your documents — your order is complete.

If you have one minute, a short Google review helps other families in our community find us:
${REVIEW_URL()}

Thank you!
Imverica Legal Solutions · +1 (916) 399-3992`
  },
  ru: {
    subject: 'Спасибо от Imverica — одна маленькая просьба',
    body: (name) => `${name ? name + ', с' : 'С'}пасибо, что доверили Imverica Legal Solutions подготовку ваших документов — ваш заказ завершён.

Если найдётся минута, короткий отзыв в Google помогает другим семьям из нашей общины найти нас:
${REVIEW_URL()}

Спасибо!
Imverica Legal Solutions · +1 (916) 399-3992`
  },
  uk: {
    subject: 'Дякуємо від Imverica — одне маленьке прохання',
    body: (name) => `${name ? name + ', д' : 'Д'}якуємо, що довірили Imverica Legal Solutions підготовку ваших документів — ваше замовлення завершено.

Якщо знайдеться хвилина, короткий відгук у Google допомагає іншим родинам з нашої громади знайти нас:
${REVIEW_URL()}

Дякуємо!
Imverica Legal Solutions · +1 (916) 399-3992`
  },
  es: {
    subject: 'Gracias de Imverica — ¿un pequeño favor?',
    body: (name) => `${name ? name + ', g' : 'G'}racias por confiar sus documentos a Imverica Legal Solutions — su orden está completa.

Si tiene un minuto, una breve reseña en Google ayuda a otras familias de nuestra comunidad a encontrarnos:
${REVIEW_URL()}

¡Gracias!
Imverica Legal Solutions · +1 (916) 399-3992`
  }
};

async function sendReviewRequest(record, event) {
  const key = process.env.RESEND_API_KEY;
  if (!key || record.reviewRequestedAt) return false;
  let contact = {};
  try { contact = (decryptRecord({ ...record }, PII_PATHS, event) || {}).contact || {}; } catch { contact = record.contact || {}; }
  const email = String(contact.email || '').trim();
  if (!email || !email.includes('@')) return false;
  const lang = ['ru', 'uk', 'es'].includes(record.language) ? record.language : 'en';
  const t = REVIEW_COPY[lang];
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.OTP_FROM_EMAIL || 'Imverica Legal Solutions <info@imverica.com>',
        to: [email],
        subject: t.subject,
        text: t.body(String(contact.name || '').split(' ')[0])
      })
    });
    if (res.ok) { record.reviewRequestedAt = new Date().toISOString(); return true; }
  } catch { /* fire-and-forget */ }
  return false;
}
const ALLOWED_STATUS = STATUSES;

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
  const hasQc = Array.isArray(body.qcChecks);
  const status = body.status !== undefined ? normalizeStatus(body.status) : null;
  if (!orderId) return json(400, { ok: false, error: 'Missing orderId' });
  if (body.status !== undefined && !status) return json(422, { ok: false, error: `status must be one of ${ALLOWED_STATUS.join(', ')}` });
  if (!status && !hasQc) return json(400, { ok: false, error: 'Nothing to update: provide status and/or qcChecks' });

  const store = await getStore();
  const record = await readOrder(store, orderId);
  if (!record) return json(404, { ok: false, error: 'Order not found' });

  if (status) {
    applyStatus(record, status, { by: 'admin', role: 'admin', note: body.note });
    if (status === 'completed') await sendReviewRequest(record, event);
  }
  if (hasQc) {
    // QC checklist state: the list of confirmed item texts. The final-PDF
    // endpoint compares its length against the canonical checklist before
    // opening the QC lock.
    record.qc = {
      items: body.qcChecks.map((x) => String(x).slice(0, 200)).slice(0, 40),
      by: 'admin',
      updatedAt: new Date().toISOString()
    };
    record.updatedAt = record.qc.updatedAt;
  }
  await writeOrder(store, orderId, record);

  return json(200, { ok: true, orderId, status: record.status, qc: record.qc || null, updatedAt: record.updatedAt, statusHistory: record.statusHistory });
};
