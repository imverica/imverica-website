'use strict';
/**
 * QA — CA court form auto-generation, fully local.
 *
 * Pipeline under test, per registered form:
 *   intake answers → <form>-map → ca-court-fill (pdf-lib) → filled PDF
 *
 * For each form verifies: decrypted template present, map produces a
 * healthy field count, fill reports 0 skips, output is a valid larger PDF,
 * and (FL-100) caption read-back survives save+reload. Writes each filled
 * PDF to decks/.build/ for optional visual inspection.
 *
 * Run:  node scripts/qa-ca-court-autogen.js
 * Exit: 0 = pass, 1 = fail.
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');
const { getBuilder, listForms } = require('../netlify/functions/lib/ca-court-registry');

const CA_DIR = path.resolve(__dirname, '../assets/form-cache/ca-court');
const OUT_DIR = path.resolve(__dirname, '../decks/.build');

// Shared intake covering family-law + landlord/tenant + small-claims keys.
const ANSWERS = {
  // family law
  case_type: 'dissolution', relationship_type: 'marriage',
  petitioner_first_name: 'John', petitioner_middle_name: 'Michael', petitioner_last_name: 'Smith',
  respondent_first_name: 'Jane', respondent_middle_name: 'Anne', respondent_last_name: 'Smith',
  petitioner_address_line1: '456 New Street, Apt 5',
  petitioner_city: 'Sacramento', petitioner_state: 'CA', petitioner_zip: '95814',
  petitioner_phone: '9163993992', petitioner_email: 'john.smith@example.com',
  date_of_marriage: '2015-06-20', date_of_separation: '2025-11-01',
  petitioner_meets_residency: 'yes', petitioner_residence_county: 'Sacramento County',
  minor_children: [
    { name: 'Emma Smith', birthdate: '2017-03-12', age: '9' },
    { name: 'Liam Smith', birthdate: '2019-08-30', age: '6' }
  ],
  // court
  court_county: 'Sacramento', court_street_address: '3341 Power Inn Road',
  court_city_zip: 'Sacramento, CA 95826', court_branch_name: 'Family Relations Courthouse',
  case_number: '26FL01234',
  // landlord / tenant (UD-100)
  plaintiff_name: 'Acme Properties LLC', defendant_name: 'Robert Tenant',
  plaintiff_address_line1: '100 Owner Ave', plaintiff_city: 'Sacramento', plaintiff_state: 'CA', plaintiff_zip: '95814',
  plaintiff_phone: '9165550100',
  premises_address: '789 Rental Rd, Unit 3, Sacramento, CA 95820',
  // small claims (SC-100)
  defendant_address_line1: '789 Rental Rd, Unit 3', defendant_city: 'Sacramento', defendant_state: 'CA', defendant_zip: '95820',
  defendant_phone: '9165550199',
  claim_amount: '4500', claim_reason: 'Unpaid rent for November and December 2025 plus late fees.'
};
const PAYLOAD = { formAnswers: ANSWERS, contact: { name: 'John Michael Smith', phone: '9163993992', email: 'john.smith@example.com' } };

// Minimum sensible mapped-field count per form (sanity floor).
const MIN_FIELDS = { 'fl-100': 20, 'fl-120': 12, 'fl-110': 4, 'ud-100': 12, 'sc-100': 12 };

let pass = 0, fail = 0;
const ok = (m) => { console.log('    ✓', m); pass++; };
const bad = (m) => { console.error('    ✗', m); fail++; };

async function testForm(slug) {
  console.log(`\n── ${slug.toUpperCase()} ──`);
  const tmpl = path.join(CA_DIR, slug + '.pdf');
  if (!fs.existsSync(tmpl)) { bad(`template missing (run decrypt-ca-forms.js ${slug})`); return; }

  const entry = getBuilder(slug);
  if (!entry) { bad('no builder registered'); return; }

  const fieldValues = entry.build(PAYLOAD);
  const n = Object.keys(fieldValues).length;
  const floor = MIN_FIELDS[slug] || 4;
  if (n >= floor) ok(`map produced ${n} fields (≥${floor})`);
  else bad(`map produced only ${n} fields (expected ≥${floor})`);

  const res = await fillCourtForm(fs.readFileSync(tmpl), fieldValues);

  if (res.skipped.length === 0) ok(`fill: ${res.filled.length} set, 0 skipped`);
  else bad(`fill skipped ${res.skipped.length}: ${res.skipped.map((s) => s.name.split('.').pop()).join(', ')}`);

  // Validity = parses as a PDF AND a sample filled text value survives a
  // save+reload. (Size isn't a valid check: pdf-lib strips the XFA layer,
  // so a correctly-filled form can be SMALLER than the encrypted original.)
  const isPdf = res.buffer.slice(0, 5).toString('latin1').startsWith('%PDF');
  let readBackOk = false;
  try {
    const form = (await PDFDocument.load(res.buffer, { ignoreEncryption: true })).getForm();
    const sampleName = (res.filled || []).find((n) => {
      try { return form.getField(n).constructor.name === 'PDFTextField'; } catch { return false; }
    });
    if (sampleName) readBackOk = (form.getTextField(sampleName).getText() || '') !== '';
  } catch { /* readBackOk stays false */ }

  if (isPdf && readBackOk) ok('valid PDF, filled value survives reload');
  else bad(`output invalid (pdf=${isPdf}, readback=${readBackOk})`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, slug + '-qa.pdf'), res.buffer);
}

async function readbackFL100() {
  console.log('\n── FL-100 read-back ──');
  const res = await fillCourtForm(
    fs.readFileSync(path.join(CA_DIR, 'fl-100.pdf')),
    getBuilder('fl-100').build(PAYLOAD)
  );
  const form = (await PDFDocument.load(res.buffer, { ignoreEncryption: true })).getForm();
  const checks = [
    ['FL-100[0].Page1[0].CaptionP1_sf[0].TitlePartyName[0].Party1_ft[0]', 'Smith, John Michael'],
    ['FL-100[0].Page1[0].CaptionP1_sf[0].CaseNumber[0].CaseNumber_ft[0]', '26FL01234']
  ];
  for (const [name, exp] of checks) {
    let got = ''; try { got = form.getTextField(name).getText() || ''; } catch {}
    got === exp ? ok(`read-back ${name.split('.').pop()} = "${got}"`) : bad(`read-back got "${got}" expected "${exp}"`);
  }
  for (const [name, label] of [
    ['FL-100[0].Page1[0].CaptionP1_sf[0].FormTitle[0].DissolutionOf_cb[0]', 'Dissolution'],
    ['FL-100[0].Page1[0].WeAreMarried_cb[0]', 'We are married']
  ]) {
    let c = false; try { c = form.getCheckBox(name).isChecked(); } catch {}
    c ? ok(`checkbox "${label}" checked`) : bad(`checkbox "${label}" not checked`);
  }
}

async function main() {
  console.log('\n=== CA court auto-generation QA ===');
  console.log('registered forms:', listForms().join(', '));
  for (const slug of listForms()) await testForm(slug);
  await readbackFL100();
  console.log(`\n=== Passed: ${pass}   Failed: ${fail} ===`);
  console.log('artifacts → decks/.build/<form>-qa.pdf\n');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e.stack || e.message); process.exit(1); });
