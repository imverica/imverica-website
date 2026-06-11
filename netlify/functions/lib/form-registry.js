'use strict';
/**
 * Official form registry (Phase 4) — one verified profile per supported form.
 *
 * HARD RULE: nothing here is invented. Every value is taken from:
 *   - assets/form-cache/manifest.json          (USCIS/EOIR: official page+PDF
 *     URLs, edition date, expiration — scraped from uscis.gov / justice.gov)
 *   - assets/form-cache/ca-court-manifest.json (CA Judicial Council: official
 *     URLs, effective date, AcroForm field count — from courts.ca.gov)
 *   - assets/form-cache/ca-forms-catalog.json  (the wider CA catalog)
 *   - the actual presence of a render-verified field map
 *     (netlify/functions/lib/<slug>-pdf-map.js or the CA direct-schema path)
 *
 * mapping_status:
 *   'verified-map'  — a hand-verified field map exists (USCIS/EOIR engine)
 *   'direct-schema' — CA decrypted AcroForm is read live (field-label schema)
 *   'catalog-only'  — we know the official source but cannot fill it yet
 *   'blocked'       — field names cannot be verified (per spec: never fake)
 *
 * Checklists are included ONLY for forms where we maintain them (I-765, I-589
 * to start) — they restate the official instructions' standard document list,
 * they do not decide anything for a client (LDA/UPL safe wording).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return null; }
}

let _cache = null;
function loadSources() {
  if (_cache) return _cache;
  const uscis = readJson('assets/form-cache/manifest.json') || { forms: [] };
  const caManifest = readJson('assets/form-cache/ca-court-manifest.json') || { forms: [] };
  const caCatalog = readJson('assets/form-cache/ca-forms-catalog.json') || { forms: [] };
  _cache = { uscis, caManifest, caCatalog };
  return _cache;
}

function slugOf(code) { return String(code || '').trim().toLowerCase(); }

function hasUscisMap(code) {
  const slug = slugOf(code).replace(/-/g, '');
  return fs.existsSync(path.join(__dirname, `${slug}-pdf-map.js`));
}

function hasCaTemplate(code) {
  return fs.existsSync(path.join(ROOT, 'assets/form-cache/ca-court', `${slugOf(code)}.pdf`));
}

// Static, instruction-derived document checklists for the forms we actively
// support end-to-end. Wording is informational ("commonly included"), never
// advisory. Extend per form as each one is verified.
const PACKET_CHECKLISTS = {
  'I-765': [
    'Form I-765 with every applicable section completed',
    'Two identical passport-style photos (2x2", taken within 30 days)',
    'Copy of Form I-94 (front and back) or passport admission stamp, if any',
    'Copy of passport biographic page, if available',
    'Copy of any previous Employment Authorization Document (front and back)',
    'Evidence for the eligibility category marked in Item 27 (e.g. asylum receipt for (c)(8))',
    'Filing fee or fee exemption evidence per the current USCIS fee schedule'
  ],
  'I-589': [
    'Form I-589 with all parts completed and supplements as needed',
    'One copy of the applicant’s passport / travel documents, if available',
    'Copy of Form I-94, if any',
    'Applicant’s written declaration describing the claim',
    'Available supporting evidence (identity, country conditions, corroboration)',
    'One additional copy of the complete packet for the record (per instructions)',
    'No filing fee for Form I-589'
  ]
};

const QC_CHECKLISTS = {
  // Generic QC applies to every generated packet; forms can extend it.
  _generic: [
    'Client legal name spelled identically on every form and document',
    'Date of birth consistent across all pages',
    'A-Number (if any) present and identical everywhere it appears',
    'Current mailing address complete, with Apt/Ste/Flr type marked',
    'Every required signature line identified for the client',
    'All client uploads attached and legible',
    'Form edition date current per the official source at preparation time',
    'Client reviewed and approved the packet before finalization'
  ]
};

function uscisProfile(entry) {
  const code = entry.code;
  return {
    code,
    title: entry.resolvedTitle || entry.title || code,
    agency: entry.agency === 'eoir' ? 'EOIR' : 'USCIS',
    category: entry.category || 'immigration',
    officialPageUrl: entry.officialPageUrl || null,
    officialPdfUrl: entry.officialPdfUrl || null,
    editionDate: entry.editionDate || null,
    expirationDate: entry.expirationDateIso || null,
    expirationStatus: entry.expirationStatus || 'unknown',
    // Fees change on the USCIS fee schedule — we link, never hardcode.
    filingFeeUrl: 'https://www.uscis.gov/g-1055',
    signatureRequirements: null, // verified per-form as flows are built out
    requiredUploads: PACKET_CHECKLISTS[code] ? PACKET_CHECKLISTS[code].slice(1) : null,
    packetChecklist: PACKET_CHECKLISTS[code] || null,
    qcChecklist: QC_CHECKLISTS._generic,
    mapping_status: hasUscisMap(code) ? 'verified-map' : (entry.cacheStatus === 'cached' ? 'catalog-only' : 'blocked'),
    cachedPdf: entry.cachedPdfUrl || null
  };
}

function caProfile(catEntry, manEntry) {
  const code = catEntry.code;
  const generatable = hasCaTemplate(code);
  return {
    code,
    title: (manEntry && manEntry.title) || catEntry.title || code,
    agency: 'California Judicial Council',
    category: catEntry.categoryName || catEntry.category || 'california-court',
    officialPageUrl: catEntry.officialPageUrl || (manEntry && manEntry.officialPageUrl) || `https://selfhelp.courts.ca.gov/jcc-form/${code}`,
    officialPdfUrl: catEntry.pdfUrl || (manEntry && manEntry.officialPdfUrl) || null,
    editionDate: (manEntry && manEntry.effectiveDate) || null,
    expirationDate: null, // JC forms use revision cycles, not expirations
    expirationStatus: 'n/a',
    filingFeeUrl: 'https://courts.ca.gov/courts/fee-schedules',
    signatureRequirements: null,
    requiredUploads: null,
    packetChecklist: null,
    qcChecklist: QC_CHECKLISTS._generic,
    mapping_status: generatable ? 'direct-schema' : 'catalog-only',
    fieldCount: (manEntry && manEntry.fieldCount) || catEntry.fieldCount || null
  };
}

// EOIR forms are not yet in the local cache — only their official DOJ pages
// are recorded (stable, verifiable URLs). Everything else stays null and
// mapping_status is 'blocked' until each PDF is researched (spec: never fake).
const EOIR_STATIC = {
  'EOIR-28': 'https://www.justice.gov/eoir/page/file/eoir28instructions/dl',
  'EOIR-29': 'https://www.justice.gov/eoir/form-eoir-29',
  'EOIR-33': 'https://www.justice.gov/eoir/form-eoir-33-eoir-immigration-court-listing',
  'EOIR-40': 'https://www.justice.gov/eoir/page/file/904291/dl',
  'EOIR-42A': 'https://www.justice.gov/eoir/page/file/904301/dl',
  'EOIR-42B': 'https://www.justice.gov/eoir/page/file/904306/dl'
};

function eoirProfile(code) {
  return {
    code,
    title: code,
    agency: 'EOIR',
    category: 'immigration-court',
    officialPageUrl: 'https://www.justice.gov/eoir/list-downloadable-eoir-forms',
    officialPdfUrl: EOIR_STATIC[code] || null,
    editionDate: null,
    expirationDate: null,
    expirationStatus: 'unknown',
    filingFeeUrl: 'https://www.justice.gov/eoir/list-downloadable-eoir-forms',
    signatureRequirements: null,
    requiredUploads: null,
    packetChecklist: null,
    qcChecklist: QC_CHECKLISTS._generic,
    mapping_status: 'blocked'
  };
}

function getFormProfile(codeRaw) {
  const code = String(codeRaw || '').trim().toUpperCase();
  if (!code) return null;
  const { uscis, caManifest, caCatalog } = loadSources();

  // manifest.json covers every cached form, including CA court templates —
  // only treat genuinely federal agencies via the USCIS profile path.
  const u = (uscis.forms || []).find((f) => f.code === code && ['uscis', 'eoir', 'irs', 'state-dept', 'dos'].includes(String(f.agency || '').toLowerCase()));
  if (u) return uscisProfile(u);

  if (EOIR_STATIC[code]) return eoirProfile(code);

  const cat = (caCatalog.forms || []).find((f) => f.code === code);
  const man = (caManifest.forms || []).find((f) => f.code === code);
  if (cat || man) return caProfile(cat || { code }, man);

  return null;
}

function listFormProfiles(filter) {
  const { uscis, caCatalog } = loadSources();
  const codes = new Set();
  (uscis.forms || []).forEach((f) => codes.add(f.code));
  (caCatalog.forms || []).forEach((f) => codes.add(f.code));
  let out = [...codes].sort().map(getFormProfile).filter(Boolean);
  if (filter && filter.agency) out = out.filter((p) => p.agency === filter.agency);
  if (filter && filter.mapping_status) out = out.filter((p) => p.mapping_status === filter.mapping_status);
  return out;
}

module.exports = { getFormProfile, listFormProfiles, PACKET_CHECKLISTS, QC_CHECKLISTS };
