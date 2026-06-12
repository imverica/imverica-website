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
const path = require('path');

// ===== Full statewide catalog (345 forms, ca-forms-catalog.json) =====
// Search endpoint for the cabinet's "All California forms" mode; any form with
// a template in the static store is preparable via the direct schema.
let _allCatalog = null;
function allFormsCatalog() {
  if (_allCatalog) return _allCatalog;
  try {
    const raw = require(path.resolve(__dirname, '..', '..', 'assets/form-cache/ca-forms-catalog.json'));
    _allCatalog = (raw.forms || []).map((f) => ({
      code: f.code,
      slug: f.slug || String(f.code || '').toLowerCase(),
      title: String(f.title || f.code).replace(/\s*\([A-Z]+-\d+[A-Z]?\)$/, ''), // strip trailing "(FL-100)" duplicates
      category: f.categoryName || f.category || '',
      fieldCount: f.fieldCount || null,
      role: 'prepare'
    }));
  } catch { _allCatalog = []; }
  return _allCatalog;
}
function searchAllForms(query) {
  const q = String(query || '').trim().toLowerCase();
  const all = allFormsCatalog();
  if (!q) return all.slice(0, 60);
  return all.filter((f) =>
    f.code.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
  ).slice(0, 60);
}
function getAllCatalogForm(code) {
  const c = String(code || '').trim().toUpperCase();
  return allFormsCatalog().find((f) => f.code === c) || null;
}

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
    if (category === 'all') {
      const q = (event.queryStringParameters && event.queryStringParameters.q) || '';
      return json(200, { ok: true, category: 'all', forms: searchAllForms(q), total: allFormsCatalog().length });
    }
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

  // Statewide long tail: any of the 345 cataloged Judicial Council forms with
  // a template in the static store is preparable through the direct schema.
  const anyForm = getAllCatalogForm(code);
  if (anyForm) {
    const schema = await getDirectCourtSchema(anyForm.slug, anyForm.title);
    if (schema) return json(200, { ok: true, form: anyForm, ...schema });
  }

  const schema = getCourtSchema(code);
  if (!schema) {
    return json(404, { ok: false, error: 'Court form not supported', code, supported: listCourtSchemas() });
  }

  return json(200, { ok: true, ...schema });
};
