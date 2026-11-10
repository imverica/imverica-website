'use strict';
/**
 * GET /api/form-preflight?form=I-485&lang=ru&interpreter=yes&preparer=no
 *
 * The "before you mail to USCIS" sheet for one form: signatures, the form
 * itself, payment, what goes in the envelope and mailing. General
 * information drawn from the form and USCIS filing guidance; it takes no
 * personal data and stores nothing. Returns { ok, sheet } or 404 for a form
 * without a sheet.
 */

const { buildPreflight, PREFLIGHT_FORMS } = require('./lib/uscis-preflight');

function json(statusCode, body, cache) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache || 'no-store' },
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });
  const query = event.queryStringParameters || {};
  const sheet = buildPreflight(query.form, {
    lang: query.lang,
    interpreter: query.interpreter,
    preparer: query.preparer
  });
  if (!sheet) return json(404, { ok: false, error: 'No sheet for this form', forms: PREFLIGHT_FORMS });
  return json(200, { ok: true, sheet }, 'public, max-age=600');
};
