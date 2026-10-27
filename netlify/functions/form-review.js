'use strict';
/**
 * POST /api/form-review  { formCode, directFields?, formAnswers?, lang }
 *
 * Reviews the client's own answers before a draft is generated: arithmetic,
 * items that should agree with each other, gaps and overlaps in date
 * histories, blanks the form asks to fill and the attachments it asks for.
 * Returns { ok, issues: [{ kind, item, key, text }] }. Nothing is stored.
 *
 * Signed-in clients (portal) pass straight through; the public intake wizard
 * has no session, so those requests must come from the site and are
 * rate-limited per IP.
 */

const { reviewFl150 } = require('./lib/fl150-review');
const { reviewHistory, HISTORY_FORMS } = require('./lib/history-review');
const { reviewTotals, TOTALS_COURT_FORMS, TOTALS_ANSWER_FORMS } = require('./lib/totals-review');
const { sessionFromEvent } = require('./lib/session-auth');
const { originGuard, throttleOrReject, ensureBlobs } = require('./lib/abuse-guard');

const HEADERS = { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json' };

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function json(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  if (!sessionFromEvent(event)) {
    ensureBlobs(event);
    const originReject = originGuard(event);
    if (originReject) return originReject;
    const throttleReject = await throttleOrReject(event, { action: 'form-review', limit: 60, windowSec: 300 });
    if (throttleReject) return throttleReject;
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const formCode = String(body.formCode || '').trim().toUpperCase();
  const lang = ['en', 'ru', 'uk', 'es'].includes(body.lang) ? body.lang : 'en';
  if (formCode === 'FL-150') return json(200, { ok: true, formCode, issues: reviewFl150(plainObject(body.directFields), lang) });
  if (HISTORY_FORMS.includes(formCode)) return json(200, { ok: true, formCode, issues: reviewHistory(formCode, plainObject(body.formAnswers), lang) });
  if (TOTALS_COURT_FORMS.includes(formCode)) return json(200, { ok: true, formCode, issues: reviewTotals(formCode, plainObject(body.directFields), lang) });
  if (TOTALS_ANSWER_FORMS.includes(formCode)) return json(200, { ok: true, formCode, issues: reviewTotals(formCode, plainObject(body.formAnswers), lang) });
  return json(200, { ok: true, formCode, issues: [] });
};
