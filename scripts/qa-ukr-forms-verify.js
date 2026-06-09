'use strict';
/**
 * QA — thorough verification of the U4U (I-134A) and TPS (I-821) generators
 * against REAL Ukrainian client data. For each form it:
 *   1. extracts the real PDF field names (same engine the filler uses),
 *   2. runs the pdf-map with a realistic payload,
 *   3. flags any mapped field name that DOES NOT exist in the PDF (dead map),
 *   4. fills the PDF and reports filled vs skipped,
 *   5. writes the filled PDF to /tmp for visual rendering.
 *
 * Run: node scripts/qa-ukr-forms-verify.js
 */
const fs = require('fs');
const path = require('path');
const { parsePdf, extractFieldObjects, incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const ROOT = path.resolve(__dirname, '..');
const PDF_DIR = path.join(ROOT, 'assets/form-cache/pdfs');

// Realistic Ukrainian U4U/TPS client (beneficiary) + a US supporter/preparer.
const answers = {
  applicant_family_name: 'Kovalenko',
  applicant_given_name: 'Oksana',
  applicant_middle_name: '',
  date_of_birth: '1990-03-15',
  sex: 'Female',
  marital_status: 'Married',
  alien_number: '241567890',
  uscis_online_account_number: '1234567890',
  ssn: '',                                  // newly-arrived Ukrainians usually have none
  city_of_birth: 'Kharkiv',
  country_of_birth: 'Ukraine',
  passport_number: 'FT512345',
  passport_country_of_issuance: 'Ukraine',
  passport_expiration: '2030-06-01',
  i94_number: '12345678901',
  current_immigration_status: 'Parolee (Uniting for Ukraine)',
  place_entry: 'New York, NY',
  authorized_stay_expires: '2026-08-01',
  status_expiration: '2026-08-01',
  // address (current US address in Sacramento)
  mailing_address_line1: '1234 K Street',
  mailing_address_line2: 'Apt 5',
  mailing_city: 'Sacramento',
  mailing_state: 'CA',
  mailing_zip: '95814',
  physical_address_line1: '1234 K Street',
  physical_address_line2: 'Apt 5',
  physical_city: 'Sacramento',
  physical_state: 'CA',
  physical_zip: '95814',
  daytime_phone: '9163993992',
  mobile_phone: '9163993992',
  email_address: 'oksana.k@example.com',
  // preparer = Imverica
  preparer_family_name: 'Imverica',
  preparer_given_name: 'Farukh',
  preparer_business_name: 'Imverica Legal Solutions',
  preparer_address_line1: '1234 K Street',
  preparer_city: 'Sacramento',
  preparer_state: 'CA',
  preparer_zip: '95814',
  preparer_country: 'United States',
  preparer_phone: '9163993992',
  preparer_email: 'info@imverica.com'
};
const contact = { name: 'Oksana Kovalenko', email: 'oksana.k@example.com', phone: '9163993992' };
const payload = { formAnswers: answers, contact };

const FORMS = [
  { code: 'I-134A', pdf: 'i-134a.pdf', map: '../netlify/functions/lib/i134a-pdf-map.js', fn: 'i_134aFieldValues' },
  { code: 'I-821',  pdf: 'i-821.pdf',  map: '../netlify/functions/lib/i821-pdf-map.js',  fn: 'i_821FieldValues' }
];

let totalDead = 0;
for (const form of FORMS) {
  console.log('\n========================================================');
  console.log('  ' + form.code + '   (' + form.pdf + ')');
  console.log('========================================================');
  const buf = fs.readFileSync(path.join(PDF_DIR, form.pdf));
  const parsed = parsePdf(buf);
  const realFields = extractFieldObjects(parsed);
  const realNames = new Set(realFields.keys());
  console.log('Real PDF fields:', realNames.size);

  const mod = require(form.map);
  const build = mod[form.fn] || Object.values(mod).find((x) => typeof x === 'function');
  const fieldValues = build(payload);
  const mapped = Object.keys(fieldValues);
  console.log('Mapped field values:', mapped.length);

  // Dead mappings: names the map sets that DON'T exist in the PDF.
  const dead = mapped.filter((k) => !realNames.has(k));
  if (dead.length) {
    totalDead += dead.length;
    console.log('\n  🔴 DEAD MAPPINGS (' + dead.length + ') — set but NOT in the PDF (silently lost):');
    dead.forEach((k) => console.log('     ✗ ' + k + '   = "' + String(fieldValues[k]).slice(0, 30) + '"'));
  } else {
    console.log('  ✅ every mapped field name exists in the PDF');
  }

  // Actually fill + report filled/skipped from the engine.
  const res = incrementalFillPdf(buf, fieldValues, []);
  console.log('\n  Engine fill: filled=' + (res.filledFields || []).length + '  skipped=' + (res.skippedFields || []).length);
  if ((res.skippedFields || []).length) {
    console.log('  skipped:', (res.skippedFields || []).slice(0, 12).join(', '));
  }
  const outPath = path.join('/tmp', form.code.toLowerCase().replace(/[^a-z0-9]/g, '') + '-filled.pdf');
  fs.writeFileSync(outPath, res.buffer);
  console.log('  → wrote ' + outPath);
}

console.log('\n========================================================');
console.log(totalDead ? `❌ ${totalDead} dead mapping(s) total — these fields never reach the PDF` : '✅ no dead mappings');
process.exit(0);
