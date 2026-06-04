'use strict';
/**
 * Registry of California court forms that Imverica can auto-generate.
 *
 * Maps a normalized form slug → the field-builder function from its map
 * module. The generate-court-pdf endpoint (and QA) look up the builder
 * here, load the matching decrypted template from
 * assets/form-cache/ca-court/<slug>.pdf, run the builder over the intake
 * payload, and fill via lib/ca-court-fill.js.
 *
 * To add a form: decrypt it (scripts/decrypt-ca-forms.js), write a
 * <slug>-map.js, and register the builder below.
 */

const REGISTRY = {
  // Family law — dissolution / legal separation / nullity
  'fl-100': () => require('./ca-fl100-map').fl_100FieldValues,   // Petition
  'fl-120': () => require('./ca-fl120-map').fl_120FieldValues,   // Response
  'fl-110': () => require('./ca-fl110-map').fl_110FieldValues,   // Summons
  // Landlord / tenant
  'ud-100': () => require('./ca-ud100-map').ud_100FieldValues,   // Unlawful Detainer complaint
  // Small claims
  'sc-100': () => require('./ca-sc100-map').sc_100FieldValues    // Plaintiff's Claim
};

function normalizeSlug(formCode) {
  return String(formCode || '').trim().toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^([a-z]+)-?(\d.*)$/, '$1-$2'); // "FL100" / "fl 100" → "fl-100"
}

function getBuilder(formCode) {
  const slug = normalizeSlug(formCode);
  const loader = REGISTRY[slug];
  if (!loader) return null;
  return { slug, build: loader() };
}

function listForms() { return Object.keys(REGISTRY); }

module.exports = { getBuilder, listForms, normalizeSlug };
