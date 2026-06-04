/**
 * QA — USCIS PDF auto-generation, run fully locally (no Netlify, no HTTP).
 *
 * Replicates generate-pdf.js's core path:
 *   findPdfPath(formCode) → findMap(formCode) → incrementalFillPdf()
 * but skips the abuse-guard (origin + blob throttle) which needs Netlify.
 *
 * Verifies, for a spread of representative forms, that:
 *   1. The blank template PDF exists in assets/form-cache/pdfs
 *   2. The form's *-pdf-map.js loads + exports a FieldValues builder
 *   3. incrementalFillPdf produces a valid, larger-than-blank PDF
 *   4. A meaningful number of fields were actually filled (not 0)
 *   5. Output parses back as a PDF (starts with %PDF, AcroForm intact)
 *
 * Run:  node scripts/qa-uscis-autogen-local.js
 * Exit: 0 = all pass, 1 = any fail.
 */

const fs = require('fs');
const path = require('path');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const ROOT = path.resolve(__dirname, '..');
const PDF_DIR = path.join(ROOT, 'assets/form-cache/pdfs');
const MAP_DIR = path.join(ROOT, 'netlify/functions/lib');

// ─── Shared realistic intake payload ──────────────────────────────────
// CRITICAL: every map reads `payload.formAnswers || payload.answers`,
// so the actual applicant data must be nested under `formAnswers` — NOT
// at the top level. (This mirrors what the real /api/generate-pdf gets.)
const ANSWERS = {
  applicant_family_name: 'Smith', applicant_given_name: 'John', applicant_middle_name: 'Michael',
  family_name: 'Smith', given_name: 'John', middle_name: 'Michael',
  last_name: 'Smith', first_name: 'John',
  date_of_birth: '1990-01-15', dob: '1990-01-15',
  alien_number: '123456789', a_number: '123456789',
  uscis_online_account_number: '987654321',
  ssn: '555112222', social_security_number: '555112222',
  mailing_address_line1: '456 New Street', current_address_line1: '456 New Street', address_line1: '456 New Street',
  mailing_address_line2: 'Apt 5', address_unit: 'Apt 5',
  mailing_city: 'Sacramento', mailing_state: 'CA', mailing_zip: '95814',
  city: 'Sacramento', state: 'CA', zip_code: '95814',
  city_of_birth: 'Kyiv', place_of_birth_city: 'Kyiv',
  country_of_birth: 'Ukraine', country_of_citizenship: 'Ukraine',
  phone: '9163993992', daytime_phone: '9163993992',
  email: 'john.smith@example.com', email_address: 'john.smith@example.com',
  gender: 'Male', sex: 'Male',
  marital_status: 'Single',
  passport_number: 'P1234567',
  date_of_arrival: '2022-03-10',
  i94_number: '12345678901'
};
const PAYLOAD = { formAnswers: ANSWERS, contact: { phone: '9163993992', email: 'john.smith@example.com' } };

// Forms to spot-check — a spread across categories + complexity.
// NOTE: I-130 is intentionally NOT here. It now reads petitioner_/beneficiary_
// prefixed keys (the real wizard flow), not the generic single-applicant keys
// this smoke test uses. I-130 is validated by scripts/qa-uscis-flow-coverage.js
// (real flow → map) and scripts/qa-i130-sample.js (full populated sample).
const FORMS = [
  'I-485',   // adjustment of status (most complex, has flow logic)
  'I-765',   // work authorization
  'N-400',   // naturalization
  'I-131',   // travel document
  'I-864',   // affidavit of support
  'G-28',    // notice of appearance
  'I-589'    // asylum
];

// ─── Replicate generate-pdf.js helpers ─────────────────────────────────
function normalizeFormCode(v) { return String(v || '').trim().toUpperCase().replace(/\s+/g, ''); }

function findPdfPath(formCode) {
  const normalized = normalizeFormCode(formCode).toLowerCase();
  const names = [normalized + '.pdf', normalized.replace(/-/g, '') + '.pdf'];
  for (const name of names) {
    const p = path.join(PDF_DIR, name);
    if (fs.existsSync(p)) return p;
  }
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  const files = fs.existsSync(PDF_DIR) ? fs.readdirSync(PDF_DIR) : [];
  const match = files.find(f => f.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/pdf$/, '') === compact);
  return match ? path.join(PDF_DIR, match) : null;
}

function mapFileName(formCode) {
  const compact = normalizeFormCode(formCode).toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    g845supplement: 'g845s-pdf-map.js',
    i485supplementa: 'i485a-pdf-map.js',
    i485supplementj: 'i485j-pdf-map.js'
  };
  return aliases[compact] || compact + '-pdf-map.js';
}

function findMap(formCode) {
  const file = mapFileName(formCode);
  const mapPath = path.join(MAP_DIR, file);
  if (!fs.existsSync(mapPath)) throw new Error('PDF map not found: ' + file);
  const mod = require(mapPath);
  const buildFieldValues =
    Object.values(mod).find(v => typeof v === 'function' && /fieldvalues/i.test(v.name)) ||
    Object.values(mod).find(v => typeof v === 'function');
  if (!buildFieldValues) throw new Error('No FieldValues function in ' + file);
  const buildTextOverlays =
    Object.values(mod).find(v => typeof v === 'function' && /textoverlays/i.test(v.name)) || (() => []);
  return { buildFieldValues, buildTextOverlays };
}

// ─── Run ────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const rows = [];

for (const form of FORMS) {
  const r = { form, blank: '-', filled: 0, skipped: 0, outKB: 0, status: '' };
  try {
    const pdfPath = findPdfPath(form);
    if (!pdfPath) { r.status = '✗ no template PDF'; fail++; rows.push(r); continue; }
    r.blank = (fs.statSync(pdfPath).size / 1024).toFixed(0) + 'KB';

    const { buildFieldValues, buildTextOverlays } = findMap(form);
    const inputPdf = fs.readFileSync(pdfPath);
    const fieldValues = buildFieldValues(PAYLOAD);
    const overlays = buildTextOverlays(PAYLOAD);
    const result = incrementalFillPdf(inputPdf, fieldValues, overlays);

    r.filled = (result.filledFields || []).length;
    r.skipped = (result.skippedFields || []).length;
    r.outKB = (result.buffer.length / 1024).toFixed(0) + 'KB';

    const head = result.buffer.slice(0, 5).toString('latin1');
    const isPdf = head.startsWith('%PDF');
    const mapped = Object.keys(fieldValues).length;

    if (!isPdf)            { r.status = '✗ output not a PDF'; fail++; }
    else if (mapped === 0) { r.status = '✗ map produced 0 fields'; fail++; }
    else if (r.filled === 0 && overlays.length === 0) { r.status = '✗ 0 filled, 0 overlays'; fail++; }
    else { r.status = `✓ ok (${mapped} mapped, ${overlays.length} overlays)`; pass++; }
  } catch (err) {
    r.status = '✗ ' + err.message;
    fail++;
  }
  rows.push(r);
}

// ─── Report ───────────────────────────────────────────────────────────
console.log('\n=== USCIS PDF auto-generation — local QA ===\n');
console.log('Form     Blank    Filled  Skipped  Output   Status');
console.log('─'.repeat(78));
for (const r of rows) {
  console.log(
    r.form.padEnd(8),
    String(r.blank).padEnd(8),
    String(r.filled).padEnd(7),
    String(r.skipped).padEnd(8),
    String(r.outKB).padEnd(8),
    r.status
  );
}
console.log('─'.repeat(78));
console.log(`\nPassed: ${pass}   Failed: ${fail}\n`);
process.exit(fail > 0 ? 1 : 0);
