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
  // Unlawful Detainer (eviction) packet — In-Pro-Per, staged (see
  // lib/ud-packet-spec.js). FILE → SERVE → RESPOND → DEFAULT → ENFORCE.
  'ud-100': () => require('./ca-ud100-map').ud_100FieldValues,   // Complaint
  'sum-130': () => require('./ca-sum130-map').sum_130FieldValues, // Summons—Eviction
  'ud-101': () => require('./ca-ud101-map').ud_101FieldValues,   // Mandatory cover sheet
  'cm-010': () => require('./ca-cm010-map').cm_010FieldValues,   // Civil case cover sheet
  'cp10-5': () => require('./ca-cp105-map').cp_105FieldValues,   // Prejudgment Claim of Right to Possession
  'pos-010': () => require('./ca-pos010-map').pos_010FieldValues, // Proof of Service of Summons
  'ud-105': () => require('./ca-ud105-map').ud_105FieldValues,   // Answer (tenant/defendant)
  'civ-100': () => require('./ca-civ100-map').civ_100FieldValues, // Request for Entry of Default
  'ud-116': () => require('./ca-ud116-map').ud_116FieldValues,   // Declaration for Default Judgment by Court
  'ud-110': () => require('./ca-ud110-map').ud_110FieldValues,   // Judgment
  'ud-120': () => require('./ca-ud120-map').ud_120FieldValues,   // Verification re rental assistance
  'pos-030': () => require('./ca-pos030-map').pos_030FieldValues, // Proof of Service by Mail
  'ej-130': () => require('./ca-ej130-map').ej_130FieldValues,   // Writ of Execution / Possession
  // Small claims
  'sc-100': () => require('./ca-sc100-map').sc_100FieldValues,   // Plaintiff's Claim
  // Generic attachment used as SC-100 item 3 overflow (and other declarations)
  'mc-031': () => require('./ca-mc031-map').mc_031FieldValues,   // Attached Declaration

  // Criminal record cleanup (statewide expungement — the 49 counties with no
  // county-local dismissal form route here).
  'cr-180': () => require('./ca-cr180-map').cr_180FieldValues,   // Petition for Dismissal
  'cr-181': () => require('./ca-cr180-map').cr_181FieldValues    // Order for Dismissal (proposed)
};

function normalizeSlug(formCode) {
  const raw = String(formCode || '').trim().toLowerCase().replace(/\s+/g, '');
  // CP10.5 is the one form whose code/template don't fit the "<alpha>-<num>"
  // shape ("CP10.5" / "cp-10.5" → template cp10-5.pdf).
  if (/^cp-?10\.?5$/.test(raw)) return 'cp10-5';
  return raw.replace(/^([a-z]+)-?(\d.*)$/, '$1-$2'); // "FL100" / "fl 100" → "fl-100"
}

function getBuilder(formCode) {
  const slug = normalizeSlug(formCode);
  const loader = REGISTRY[slug];
  if (!loader) return null;
  return { slug, build: loader() };
}

function listForms() { return Object.keys(REGISTRY); }

module.exports = { getBuilder, listForms, normalizeSlug };
