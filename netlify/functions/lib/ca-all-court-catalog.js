'use strict';

const RAW_CATALOG = require('../../../assets/form-cache/ca-forms-catalog.json');
const { getSmallClaimsForm } = require('./ca-small-claims-catalog');
const { getFamilyLawForm } = require('./ca-family-law-catalog');

// These official PDFs do not expose party-fillable AcroForm fields to the
// current engine. Keep them searchable as reference documents, but never
// advertise or submit them as generated client drafts.
const REFERENCE_ONLY = new Map([
  ['CR-290', 'This official court document has no party-fillable PDF fields.'],
  ['FL-192', 'This is an official child-support rights notice, not a client-fillable draft.']
]);

function normalizeCourtCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function decorate(raw) {
  const code = normalizeCourtCode(raw.code);
  const curated = getSmallClaimsForm(code) || getFamilyLawForm(code);
  const referenceDescription = REFERENCE_ONLY.get(code);
  const role = curated?.role || (referenceDescription ? 'info' : 'prepare');

  return {
    code,
    slug: raw.slug || code.toLowerCase(),
    title: String(raw.title || code).replace(/\s*\([A-Z]+-\d+[A-Z]?\)$/, ''),
    category: raw.categoryName || raw.category || '',
    categoryCode: raw.category || '',
    fieldCount: Number.isFinite(raw.fieldCount) ? raw.fieldCount : null,
    role,
    // Source separation: every statewide form is explicitly tagged so the UI
    // can show whether a form is a statewide Judicial Council form or a local
    // county Superior Court form (which carry scope:'local' + a county).
    scope: 'statewide',
    sourceType: 'Statewide Judicial Council form',
    agency: 'California Judicial Council',
    description: curated?.description || referenceDescription || '',
    officialPageUrl: curated?.officialPageUrl || `https://selfhelp.courts.ca.gov/jcc-form/${code}`
  };
}

const FORMS = Object.freeze((RAW_CATALOG.forms || []).map(decorate));
const BY_CODE = new Map(FORMS.map((form) => [form.code, form]));

function listAllCourtForms() {
  return FORMS;
}

function listPreparableAllCourtForms() {
  return FORMS.filter((form) => form.role === 'prepare');
}

function getAllCourtForm(code) {
  return BY_CODE.get(normalizeCourtCode(code)) || null;
}

function searchAllCourtForms(query, limit = 60) {
  const q = String(query || '').trim().toLowerCase();
  const matches = q
    ? FORMS.filter((form) =>
      form.code.toLowerCase().includes(q) ||
      form.title.toLowerCase().includes(q) ||
      form.category.toLowerCase().includes(q))
    : FORMS;
  return matches.slice(0, limit);
}

function getAllCourtCatalogSummary() {
  const preparableCount = listPreparableAllCourtForms().length;
  return {
    total: FORMS.length,
    preparableCount,
    referenceCount: FORMS.length - preparableCount
  };
}

module.exports = {
  FORMS,
  getAllCourtCatalogSummary,
  getAllCourtForm,
  listAllCourtForms,
  listPreparableAllCourtForms,
  normalizeCourtCode,
  searchAllCourtForms
};
