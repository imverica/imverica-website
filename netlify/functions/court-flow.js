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
const {
  getAllCourtCatalogSummary,
  getAllCourtForm,
  searchAllCourtForms
} = require('./lib/ca-all-court-catalog');
const {
  getLocalCourtForm,
  getLocalCourtSummary,
  listLocalCourtCounties,
  searchLocalCourtForms
} = require('./lib/ca-local-court-catalog');
const { loadLocalCourtTemplate } = require('./lib/ca-local-court-template');
const { buildUdPacket } = require('./lib/ud-packet-spec');
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
  const localId = (event.queryStringParameters && event.queryStringParameters.localId) || '';
  const county = (event.queryStringParameters && event.queryStringParameters.county) || '';

  if (localId) {
    const form = getLocalCourtForm(localId);
    if (!form) return json(404, { ok: false, error: 'Local court form not found', localId });
    if (form.role !== 'prepare') {
      return json(409, { ok: false, error: 'This local document is reference-only', form });
    }
    const schema = await getDirectCourtSchema(form.slug, form.title, {
      cacheKey: `local:${form.id}`,
      loadTemplate: () => loadLocalCourtTemplate(form.countySlug, form.slug, {
        url: form.officialPdfUrl,
        sha256: form.sourceSha256,
        referer: form.sourcePageUrl,
        cached: Boolean(form.cachedTemplate)
      })
    });
    if (!schema || !schema.fieldCount) return json(404, { ok: false, error: 'Fillable local template not found', localId });
    return json(200, { ok: true, form, ...schema });
  }

  // No code → return the requested catalog. Small claims stays the default
  // so existing cabinet behavior is unchanged.
  if (!code) {
    if (category === 'family-law') return json(200, { ok: true, ...getFamilyLawCatalog() });
    if (category === 'unlawful-detainer' || category === 'ud') {
      // The eviction packet, grouped by stage (file → serve → respond →
      // default → trial → enforce) with live availability per form, PLUS the
      // shared curated intakes: ONE landlord questionnaire feeds every
      // landlord-side form (via formAnswers + the hand-maps); the tenant
      // questionnaire feeds the Answer (UD-105).
      return json(200, {
        ok: true,
        category: 'unlawful-detainer',
        ...buildUdPacket(getAllCourtForm),
        intake: { landlord: getCourtSchema('ud-100'), tenant: getCourtSchema('ud-105') }
      });
    }
    if (category === 'all') {
      const q = (event.queryStringParameters && event.queryStringParameters.q) || '';
      const localForms = county ? searchLocalCourtForms(county, q) : [];
      const statewideForms = searchAllCourtForms(q, Math.max(0, 100 - localForms.length));
      return json(200, {
        ok: true,
        category: 'all',
        county,
        counties: listLocalCourtCounties(),
        forms: [...localForms, ...statewideForms],
        ...getAllCourtCatalogSummary(),
        ...getLocalCourtSummary(county)
      });
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
  const anyForm = getAllCourtForm(code);
  if (anyForm) {
    if (anyForm.role !== 'prepare') {
      return json(409, {
        ok: false,
        error: 'This official document is reference-only or completed by the court',
        form: anyForm
      });
    }
    const schema = await getDirectCourtSchema(anyForm.slug, anyForm.title);
    if (schema) return json(200, { ok: true, form: anyForm, ...schema });
  }

  const schema = getCourtSchema(code);
  if (!schema) {
    return json(404, { ok: false, error: 'Court form not supported', code, supported: listCourtSchemas() });
  }

  return json(200, { ok: true, ...schema });
};
