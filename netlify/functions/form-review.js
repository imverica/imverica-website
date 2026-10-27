'use strict';
/**
 * POST /api/form-review  { formCode, directFields, lang }
 *
 * Reviews the client's own answers before a draft is generated: arithmetic,
 * items that should agree with each other, blanks the form asks to fill and
 * the attachments it asks for. Returns { ok, issues: [{ kind, item, key, text }] }.
 * Requires the same signed session cookie as /api/court-flow. Nothing is stored.
 */

const { reviewFl150 } = require('./lib/fl150-review');
const { sessionFromEvent } = require('./lib/session-auth');

const HEADERS = { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json' };
const REVIEWERS = { 'FL-150': reviewFl150 };

function json(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  if (!sessionFromEvent(event)) return json(401, { ok: false, error: 'Not signed in' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const formCode = String(body.formCode || '').trim().toUpperCase();
  const reviewer = REVIEWERS[formCode];
  if (!reviewer) return json(200, { ok: true, formCode, issues: [] });
  const fields = body.directFields && typeof body.directFields === 'object' && !Array.isArray(body.directFields) ? body.directFields : {};
  const lang = ['en', 'ru', 'uk', 'es'].includes(body.lang) ? body.lang : 'en';
  return json(200, { ok: true, formCode, issues: reviewer(fields, lang) });
};
