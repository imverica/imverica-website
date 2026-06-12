'use strict';
/**
 * Scheduled case nudges — recover stalled orders automatically.
 *
 * Runs daily (netlify.toml schedule). Two rules, both client-facing, both in
 * the client's language, capped at 2 nudges per order with ≥5 days between:
 *
 *   waiting_for_documents > 48h → "we're waiting for your documents" + portal link
 *   quote_sent           > 48h → "your quote is ready, reply or pay" + portal link
 *
 * Why not "abandoned wizard" emails: anonymous wizard drafts live in
 * localStorage only (the email arrives at the last step), so the server never
 * sees them. These two statuses are where real, reachable leads stall.
 *
 * Manual trigger for testing: GET with the admin token.
 */

const { ensureBlobs } = require('./lib/abuse-guard');
const { decryptRecord } = require('./lib/crypto');
const { normalizeStatus } = require('./lib/case-status');
const { isAdmin } = require('./lib/admin-auth');

const PII_PATHS = ['contact.name', 'contact.email', 'contact.phone', 'serviceLabel', 'situation'];
const NUDGE_STATUSES = ['waiting_for_documents', 'quote_sent'];
const MIN_AGE_MS = 48 * 3600 * 1000;        // stalled for 48h
const MIN_GAP_MS = 5 * 24 * 3600 * 1000;    // ≥5 days between nudges
const MAX_NUDGES = 2;
const PORTAL = 'https://imverica.com/account.html';

const COPY = {
  waiting_for_documents: {
    en: ['Imverica — we are waiting for your documents', (n) => `${n ? n + ', w' : 'W'}e're ready to continue preparing your order, but we're still missing documents from you.\n\nUpload them in your portal: ${PORTAL}\n\nQuestions? Reply to this email or call +1 (916) 399-3992.\nImverica Legal Solutions`],
    ru: ['Imverica — ждём ваши документы', (n) => `${n ? n + ', м' : 'М'}ы готовы продолжить подготовку вашего заказа, но нам всё ещё не хватает документов от вас.\n\nЗагрузите их в личном кабинете: ${PORTAL}\n\nВопросы? Ответьте на это письмо или позвоните +1 (916) 399-3992.\nImverica Legal Solutions`],
    uk: ['Imverica — чекаємо на ваші документи', (n) => `${n ? n + ', м' : 'М'}и готові продовжити підготовку вашого замовлення, але нам досі бракує документів від вас.\n\nЗавантажте їх в особистому кабінеті: ${PORTAL}\n\nЗапитання? Дайте відповідь на цей лист або зателефонуйте +1 (916) 399-3992.\nImverica Legal Solutions`],
    es: ['Imverica — esperamos sus documentos', (n) => `${n ? n + ', e' : 'E'}stamos listos para continuar preparando su orden, pero aún nos faltan documentos suyos.\n\nSúbalos en su portal: ${PORTAL}\n\n¿Preguntas? Responda a este correo o llame al +1 (916) 399-3992.\nImverica Legal Solutions`]
  },
  quote_sent: {
    en: ['Imverica — your quote is waiting', (n) => `${n ? n + ', y' : 'Y'}our flat-fee quote is ready and waiting in your portal. Reply to this email with any questions, or confirm and we'll start preparing right away.\n\n${PORTAL}\n\nImverica Legal Solutions · +1 (916) 399-3992`],
    ru: ['Imverica — ваша смета ждёт ответа', (n) => `${n ? n + ', в' : 'В'}аша фиксированная смета готова и ждёт в личном кабинете. Ответьте на это письмо с вопросами — или подтвердите, и мы сразу начнём подготовку.\n\n${PORTAL}\n\nImverica Legal Solutions · +1 (916) 399-3992`],
    uk: ['Imverica — ваш кошторис чекає на відповідь', (n) => `${n ? n + ', в' : 'В'}аш фіксований кошторис готовий і чекає в особистому кабінеті. Дайте відповідь на цей лист із запитаннями — або підтвердьте, і ми одразу почнемо підготовку.\n\n${PORTAL}\n\nImverica Legal Solutions · +1 (916) 399-3992`],
    es: ['Imverica — su cotización está esperando', (n) => `${n ? n + ', s' : 'S'}u cotización de tarifa fija está lista en su portal. Responda a este correo con cualquier pregunta, o confirme y comenzaremos de inmediato.\n\n${PORTAL}\n\nImverica Legal Solutions · +1 (916) 399-3992`]
  }
};

async function getStore() {
  try { return require('@netlify/blobs').getStore('imverica-intakes'); } catch { return null; }
}

async function sendEmail(key, to, subject, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.OTP_FROM_EMAIL || 'Imverica Legal Solutions <info@imverica.com>',
      to: [to],
      subject,
      text
    })
  });
  return res.ok;
}

async function runNudges(event) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: true, skipped: 'no RESEND_API_KEY' };
  const store = await getStore();
  if (!store) return { ok: true, skipped: 'no blobs store' };

  const now = Date.now();
  const sent = [];
  let scanned = 0;
  let result;
  try { result = await store.list({ prefix: 'orders/' }); } catch { return { ok: false, error: 'list failed' }; }

  for (const blob of (result.blobs || []).slice(0, 400)) {
    let record;
    try { record = await store.get(blob.key, { type: 'json' }); } catch { continue; }
    if (!record) continue;
    scanned++;

    const status = normalizeStatus(record.status) || '';
    if (!NUDGE_STATUSES.includes(status)) continue;

    // Stalled long enough? Measure from the LAST status change, not creation.
    const lastChange = (record.statusHistory || []).slice(-1)[0];
    const sinceMs = now - Date.parse(lastChange?.at || record.updatedAt || record.createdAt || 0);
    if (!(sinceMs > MIN_AGE_MS)) continue;

    // Nudge budget: max 2, ≥5 days apart, and never for a different status
    // than the one the previous nudge was about (status changed → reset).
    const nudges = record.nudges && record.nudges.status === status ? record.nudges : { status, count: 0, lastAt: 0 };
    if (nudges.count >= MAX_NUDGES) continue;
    if (nudges.lastAt && now - Date.parse(nudges.lastAt) < MIN_GAP_MS) continue;

    let contact = {};
    try { contact = (decryptRecord({ ...record }, PII_PATHS, event) || {}).contact || {}; } catch { contact = record.contact || {}; }
    const email = String(contact.email || '').trim();
    if (!email.includes('@')) continue;

    const lang = ['ru', 'uk', 'es'].includes(record.language) ? record.language : 'en';
    const [subject, body] = COPY[status][lang];
    const ok = await sendEmail(key, email, subject, body(String(contact.name || '').split(' ')[0]));
    if (ok) {
      record.nudges = { status, count: nudges.count + 1, lastAt: new Date().toISOString() };
      try { await store.setJSON(blob.key, record); } catch { /* keep going */ }
      sent.push({ id: record.id, status, nudge: record.nudges.count });
    }
  }
  return { ok: true, scanned, sent };
}

exports.handler = async function (event) {
  ensureBlobs(event);
  // Scheduled invocations arrive without HTTP semantics; manual GET needs admin.
  const isScheduled = !event.httpMethod || event.httpMethod === 'POST' && !event.headers?.authorization;
  if (event.httpMethod === 'GET' && !isAdmin(event)) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Unauthorized' }) };
  }
  const out = await runNudges(event);
  console.log('[case-nudges]', JSON.stringify(out));
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) };
};
