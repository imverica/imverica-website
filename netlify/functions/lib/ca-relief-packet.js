'use strict';
/**
 * County-specific criminal-relief packet builder.
 *
 * Given a county + relief type (+ optional facts), returns the STANDARD packet
 * structure the courts use for that matter, clearly separated into:
 *   - requiredStatewide : statewide Judicial Council forms for this relief type
 *   - requiredLocal     : the county's own Superior Court forms for this type
 *   - optional          : supporting forms (declaration, proof of service, fee
 *                         waiver) that commonly accompany the filing
 *   - referenceOnly     : official documents with no client-fillable fields
 * Plus court-specific notes and, per form, whether Imverica can GENERATE it or
 * the client must DOWNLOAD it from the official court source.
 *
 * SOURCES: local forms come from assets/form-cache/ca-criminal-relief-index.json
 * (scraped from official county Superior Court sites). Statewide forms come from
 * the Judicial Council catalog. Nothing is invented — a relief type with no
 * statewide JC petition (probation, resentencing, warrant are filed by noticed
 * motion) lists no statewide "petition" and says so in the notes.
 *
 * UPL / LDA SAFETY: this restates the standard court form set for the matter.
 * It does NOT advise whether to file, choose a legal theory, or decide which
 * optional form a given case needs — the client and the facts do. Wording is
 * informational throughout.
 */

const { getAllCourtForm } = require('./ca-all-court-catalog');

let _index = null;
function index() {
  if (_index) return _index;
  try { _index = require('../../../assets/form-cache/ca-criminal-relief-index.json'); }
  catch { _index = { counties: [] }; }
  return _index;
}

const RELIEF_TYPES = ['probation-motion', 'record-cleanup', 'resentencing', 'warrant'];

const RELIEF_LABELS = {
  'probation-motion': 'Probation modification / termination motion',
  'record-cleanup': 'Record cleanup (dismissal / expungement)',
  'resentencing': 'Resentencing petition',
  'warrant': 'Warrant recall / quash'
};

// Statewide Judicial Council forms that ARE the standard vehicle for a relief
// type. Only record-cleanup has dedicated statewide petition+order forms; the
// others are filed by noticed motion (a declaration, not a JC petition form).
const STATEWIDE_REQUIRED = {
  'record-cleanup': ['CR-180', 'CR-181'],
  'probation-motion': [],
  'resentencing': [],
  'warrant': []
};

// Supporting forms commonly attached to any of these filings. Optional — the
// client decides which apply.
const OPTIONAL_SUPPORTING = {
  _all: ['MC-030', 'POS-040', 'FW-001'],
  'record-cleanup': ['CR-115']
};

// Court-specific / matter notes (informational, UPL-safe).
const NOTES = {
  'record-cleanup': [
    'Most California courts use the statewide CR-180 (Petition for Dismissal) and CR-181 (Order). Some counties also require a local cover sheet or use a local petition — both are listed below when published.',
    'Eligibility depends on the conviction, the sentence, and time elapsed — the client determines eligibility, not this tool.'
  ],
  'probation-motion': [
    'There is no statewide Judicial Council petition for modifying or terminating probation — it is requested by a noticed motion (a declaration plus, in many counties, a local form).',
    'Filing and notice rules vary by county; confirm them on the county Superior Court page linked below.'
  ],
  'resentencing': [
    'Resentencing requests depend on the statute (e.g., Penal Code §1170 subdivisions, Prop 47, Prop 64). There is no single statewide form; many counties publish a local petition.',
    'Which statute applies is a legal determination the client/counsel makes — this tool only assembles the standard forms.'
  ],
  'warrant': [
    'A bench-warrant recall/quash is generally requested by motion; few counties publish a dedicated form.',
    'Appearing or arranging counsel may be required — confirm with the county Superior Court.'
  ]
};

function shapeForm(form, scope) {
  // form: either a catalog form (statewide) or an index entry (local).
  const role = form.role || 'prepare';
  const generatable = role === 'prepare';
  return {
    code: form.code,
    title: form.title,
    scope,
    role,
    fieldCount: form.fieldCount ?? null,
    source: generatable ? 'generate' : 'download',
    generatable,
    localFormId: scope === 'local' ? form.id : undefined,
    officialPdfUrl: form.officialPdfUrl || null,
    officialPageUrl: form.officialPageUrl || (scope === 'statewide' && form.code ? `https://selfhelp.courts.ca.gov/jcc-form/${form.code}` : null)
  };
}

function statewideForms(codes) {
  return codes.map((c) => getAllCourtForm(c)).filter(Boolean).map((f) => shapeForm(f, 'statewide'));
}

function normalizeCounty(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * @param {string} countyRaw    county name or slug
 * @param {string} reliefType   one of RELIEF_TYPES
 * @param {object} facts        optional { cannotAffordFees, ... } — only used to
 *                              annotate which optional forms are likely relevant
 * @returns {object|null}
 */
function buildReliefPacket(countyRaw, reliefType, facts = {}) {
  if (!RELIEF_TYPES.includes(reliefType)) return null;
  const slug = normalizeCounty(countyRaw);
  const county = index().counties.find((c) => c.slug === slug);
  if (!county) return null;

  const local = (county.forms || []).filter((f) => f.reliefType === reliefType);
  const requiredLocal = local.filter((f) => f.role === 'prepare').map((f) => shapeForm(f, 'local'));
  const referenceLocal = local.filter((f) => f.role !== 'prepare').map((f) => shapeForm(f, 'local'));

  const requiredStatewide = statewideForms(STATEWIDE_REQUIRED[reliefType] || []);
  const optionalCodes = [...(OPTIONAL_SUPPORTING._all || []), ...(OPTIONAL_SUPPORTING[reliefType] || [])];
  const optional = statewideForms(optionalCodes).map((f) => ({
    ...f,
    note: f.code === 'FW-001' ? 'Only if the client cannot afford court fees.'
      : f.code === 'POS-040' ? 'Proof that the prosecuting agency was served.'
        : f.code === 'MC-030' ? 'The declaration that states the request and supporting facts.'
          : f.code === 'CR-115' ? 'Asset statement, if a fee or restitution issue applies.'
            : undefined
  }));

  // Statewide reference-only items (e.g. an information sheet) would go here;
  // currently none are required per relief type, so reference is local-only.
  const referenceOnly = referenceLocal;

  const notes = [...(NOTES[reliefType] || [])];
  if (county.botBlocked) notes.push(`${county.name} County's site blocks automated access — local forms may be incomplete; confirm on the official county page.`);
  if (!requiredStatewide.length && !requiredLocal.length) {
    notes.push(`No dedicated petition form is published for this matter in ${county.name} County; it is filed by noticed motion using the supporting forms below.`);
  }

  return {
    matter: 'California criminal post-judgment relief',
    reliefType,
    reliefLabel: RELIEF_LABELS[reliefType],
    county: county.name,
    countySlug: county.slug,
    jurisdiction: `Superior Court of California, County of ${county.name}`,
    sections: { requiredStatewide, requiredLocal, optional, referenceOnly },
    counts: {
      requiredStatewide: requiredStatewide.length,
      requiredLocal: requiredLocal.length,
      optional: optional.length,
      referenceOnly: referenceOnly.length,
      generatable: [...requiredStatewide, ...requiredLocal, ...optional].filter((f) => f.generatable).length
    },
    courtNotes: notes,
    disclaimer: 'Standard set of California court forms for this matter — document preparation at the client’s direction. Not legal advice, and not a determination of eligibility or which forms a particular case requires.'
  };
}

module.exports = { RELIEF_TYPES, RELIEF_LABELS, buildReliefPacket, normalizeCounty };
