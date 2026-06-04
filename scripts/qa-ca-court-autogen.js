'use strict';
/**
 * QA — CA court form auto-generation (FL-100 reference), fully local.
 *
 * Pipeline under test:
 *   intake answers → ca-fl100-map → ca-court-fill (pdf-lib) → filled PDF
 *
 * Verifies:
 *   1. The decrypted template exists (decrypt-ca-forms.js was run)
 *   2. The map produces a healthy field count from a realistic divorce intake
 *   3. ca-court-fill sets every mapped field with 0 unexpected skips
 *   4. Output is a valid PDF, larger than the blank
 *   5. Read-back: caption values (petitioner, case #) survive a save+reload
 *
 * Run:  node scripts/qa-ca-court-autogen.js
 * Exit: 0 = pass, 1 = fail.
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');
const { fl_100FieldValues } = require('../netlify/functions/lib/ca-fl100-map');

const CA_DIR = path.resolve(__dirname, '../assets/form-cache/ca-court');

// Realistic uncontested-divorce-with-kids intake.
const PAYLOAD = {
  formAnswers: {
    case_type: 'dissolution',
    relationship_type: 'marriage',
    petitioner_first_name: 'John', petitioner_middle_name: 'Michael', petitioner_last_name: 'Smith',
    respondent_first_name: 'Jane', respondent_middle_name: 'Anne', respondent_last_name: 'Smith',
    petitioner_address_line1: '456 New Street, Apt 5',
    petitioner_city: 'Sacramento', petitioner_state: 'CA', petitioner_zip: '95814',
    petitioner_phone: '9163993992', petitioner_email: 'john.smith@example.com',
    court_county: 'Sacramento',
    court_street_address: '3341 Power Inn Road',
    court_city_zip: 'Sacramento, CA 95826',
    court_branch_name: 'William R. Ridgeway Family Relations Courthouse',
    case_number: '26FL01234',
    petitioner_meets_residency: 'yes',
    petitioner_residence_county: 'Sacramento County',
    date_of_marriage: '2015-06-20',
    date_of_separation: '2025-11-01',
    minor_children: [
      { name: 'Emma Smith', birthdate: '2017-03-12', age: '9' },
      { name: 'Liam Smith', birthdate: '2019-08-30', age: '6' }
    ]
  },
  contact: { name: 'John Michael Smith', phone: '9163993992', email: 'john.smith@example.com' }
};

let pass = 0, fail = 0;
const ok = (m) => { console.log('  ✓', m); pass++; };
const bad = (m) => { console.error('  ✗', m); fail++; };

async function main() {
  console.log('\n=== CA court auto-generation — FL-100 reference QA ===\n');

  const tmpl = path.join(CA_DIR, 'fl-100.pdf');
  if (!fs.existsSync(tmpl)) {
    bad('Decrypted fl-100.pdf missing — run: node scripts/decrypt-ca-forms.js');
    return finish();
  }
  ok('Decrypted FL-100 template present');

  const fieldValues = fl_100FieldValues(PAYLOAD);
  const mappedCount = Object.keys(fieldValues).length;
  console.log('  → map produced', mappedCount, 'fields');
  if (mappedCount >= 20) ok(`Map filled a healthy ${mappedCount} fields`);
  else bad(`Map only produced ${mappedCount} fields (expected ≥20)`);

  const blankSize = fs.statSync(tmpl).size;
  const result = await fillCourtForm(fs.readFileSync(tmpl), fieldValues);

  console.log('  → filled', result.filled.length, '/ skipped', result.skipped.length);
  if (result.skipped.length) console.log('     skips:', result.skipped.map((s) => s.name.split('.').pop()).join(', '));

  if (result.skipped.length === 0) ok('0 fields skipped (all mapped names matched the PDF)');
  else bad(`${result.skipped.length} fields skipped — field-name mismatch`);

  if (result.buffer.slice(0, 5).toString('latin1').startsWith('%PDF')) ok('Output is a valid PDF');
  else bad('Output is not a PDF');

  if (result.buffer.length > blankSize) ok(`Output larger than blank (${(blankSize/1024).toFixed(0)}KB → ${(result.buffer.length/1024).toFixed(0)}KB)`);
  else bad('Output not larger than blank');

  // Read-back through a fresh load.
  const doc = await PDFDocument.load(result.buffer, { ignoreEncryption: true });
  const form = doc.getForm();
  const checks = [
    ['FL-100[0].Page1[0].CaptionP1_sf[0].TitlePartyName[0].Party1_ft[0]', 'Smith, John Michael'],
    ['FL-100[0].Page1[0].CaptionP1_sf[0].TitlePartyName[0].Party2_ft[0]', 'Smith, Jane Anne'],
    ['FL-100[0].Page1[0].CaptionP1_sf[0].CaseNumber[0].CaseNumber_ft[0]', '26FL01234'],
    ['FL-100[0].Page1[0].CaptionP1_sf[0].CourtInfo[0].CrtCounty_ft[0]', 'SACRAMENTO']
  ];
  for (const [name, expect] of checks) {
    let got = '';
    try { got = form.getTextField(name).getText() || ''; } catch (e) { got = '<err>'; }
    if (got === expect) ok(`read-back ${name.split('.').pop()} = "${got}"`);
    else bad(`read-back ${name.split('.').pop()} = "${got}" (expected "${expect}")`);
  }

  // Checkbox read-back: dissolution + marriage should be checked.
  for (const [name, label] of [
    ['FL-100[0].Page1[0].CaptionP1_sf[0].FormTitle[0].DissolutionOf_cb[0]', 'Dissolution'],
    ['FL-100[0].Page1[0].CaptionP1_sf[0].FormTitle[0].Marriage_cb[0]', 'Marriage'],
    ['FL-100[0].Page1[0].WeAreMarried_cb[0]', 'We are married']
  ]) {
    let checked = false;
    try { checked = form.getCheckBox(name).isChecked(); } catch (e) {}
    if (checked) ok(`checkbox "${label}" is checked`);
    else bad(`checkbox "${label}" NOT checked`);
  }

  // Write the artifact for visual inspection.
  const outDir = path.resolve(__dirname, '../decks/.build');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'fl-100-qa.pdf'), result.buffer);
  console.log('\n  artifact → decks/.build/fl-100-qa.pdf');

  finish();
}

function finish() {
  console.log(`\nPassed: ${pass}   Failed: ${fail}\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e.stack || e.message); process.exit(1); });
