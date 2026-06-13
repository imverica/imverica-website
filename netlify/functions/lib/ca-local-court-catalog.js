'use strict';

const MANIFEST = require('../../../assets/form-cache/ca-local-court-manifest.json');

function normalizeCounty(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Source separation: every local form is explicitly tagged (scope:'local' +
// a human-readable sourceType + the county's Superior Court as the agency) so
// the UI can always distinguish it from a statewide Judicial Council form.
const FORMS = Object.freeze((MANIFEST.forms || []).map((form) => ({
  ...form,
  scope: 'local',
  sourceType: `Local county Superior Court form — ${form.county} County`,
  agency: `Superior Court of California, County of ${form.county}`
})));
const BY_ID = new Map(FORMS.map((form) => [form.id, form]));
const COUNTIES = Object.freeze((MANIFEST.counties || []).map((county) => ({ ...county })));

function listLocalCourtCounties() {
  return COUNTIES;
}

function listLocalCourtForms(county) {
  const countySlug = normalizeCounty(county);
  return FORMS.filter((form) => form.countySlug === countySlug).sort((a, b) =>
    (a.role === 'prepare' ? 0 : 1) - (b.role === 'prepare' ? 0 : 1) ||
    a.code.localeCompare(b.code) || a.title.localeCompare(b.title));
}

function searchLocalCourtForms(county, query, limit = 100) {
  const q = String(query || '').trim().toLowerCase();
  return listLocalCourtForms(county).filter((form) => !q ||
    form.code.toLowerCase().includes(q) ||
    form.title.toLowerCase().includes(q) ||
    String(form.category || '').toLowerCase().includes(q)).slice(0, limit);
}

function getLocalCourtForm(id) {
  return BY_ID.get(String(id || '')) || null;
}

function getLocalCourtSummary(county) {
  const forms = listLocalCourtForms(county);
  const preparableCount = forms.filter((form) => form.role === 'prepare').length;
  return {
    localTotal: forms.length,
    localPreparableCount: preparableCount,
    localReferenceCount: forms.length - preparableCount
  };
}

module.exports = {
  getLocalCourtForm,
  getLocalCourtSummary,
  listLocalCourtCounties,
  listLocalCourtForms,
  normalizeCounty,
  searchLocalCourtForms
};
