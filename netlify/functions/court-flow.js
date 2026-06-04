'use strict';
/**
 * GET /api/court-flow
 * GET /api/court-flow?code=SC-100
 *
 * Serves the cabinet-only Small Claims catalog or a fillable field schema.
 * Every request requires the same signed session cookie as /api/account.
 */

const { getCourtSchema, listCourtSchemas } = require('./lib/ca-court-flow-schema');
const { getDirectCourtSchema } = require('./lib/ca-court-direct-schema');
const { getSmallClaimsCatalog, getSmallClaimsForm } = require('./lib/ca-small-claims-catalog');
const { getFamilyLawCatalog, getFamilyLawForm } = require('./lib/ca-family-law-catalog');
const { sessionFromEvent } = require('./lib/session-auth');

const HEADERS = { 'Cache-Control': 'private, no-store' };

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });
  if (!sessionFromEvent(event)) return json(401, { ok: false, error: 'Not signed in' });

  const category = (event.queryStringParameters && event.queryStringParameters.category) || '';
  const code = (event.queryStringParameters && event.queryStringParameters.code) || '';

  // No code → return the requested catalog. Small claims stays the default
  // so existing cabinet behavior is unchanged.
  if (!code) {
    if (category === 'family-law') return json(200, { ok: true, ...getFamilyLawCatalog() });
    return json(200, { ok: true, ...getSmallClaimsCatalog() });
  }

  // A specific form → serve its direct field schema. Check both catalogs
  // (SC- and FL- codes never collide), then fall back to the legacy
  // mapped schema for the original 5 forms.
  const catalogForm = getSmallClaimsForm(code) || getFamilyLawForm(code);
  if (catalogForm) {
    if (catalogForm.role !== 'prepare') {
      return json(409, {
        ok: false,
        error: 'This official document is not a client-prepared form',
        form: catalogForm
      });
    }
    const schema = await getDirectCourtSchema(catalogForm.code.toLowerCase(), catalogForm.title);
    if (!schema) return json(404, { ok: false, error: 'Fillable template not found', code: catalogForm.code });
    return json(200, { ok: true, form: catalogForm, ...schema });
  }

  const schema = getCourtSchema(code);
  if (!schema) {
    return json(404, { ok: false, error: 'Court form not supported', code, supported: listCourtSchemas() });
  }

  return json(200, { ok: true, ...schema });
};
