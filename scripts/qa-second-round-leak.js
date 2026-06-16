#!/usr/bin/env node
'use strict';
/**
 * Regression guard for the I-864-class leak across the 2nd-round forms:
 * interpreter/preparer contact fields must NEVER inherit the applicant's
 * address/phone/email. Fed a scenario with applicant phone+email but NO
 * interpreter and NO preparer, every interpreter/preparer contact field must
 * come back blank — and the form must still fill with zero skips.
 *
 *   node scripts/qa-second-round-leak.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const applicant = {
  applicant_family_name: 'Kovalenko', applicant_given_name: 'Olena', date_of_birth: '1990-03-15',
  country_of_birth: 'Ukraine', country_of_citizenship: 'Ukraine',
  daytime_phone: { countryCode: '+1', areaCode: '916', number: '5551234' }, phone: '9165551234',
  email_address: 'olena@example.com', email: 'olena@example.com', household_size: '3',
  spouse_family_name: 'Kovalenko', spouse_given_name: 'Olena'
};

// form slug, PDF slug, export fn, and the interpreter/preparer contact fields
// that must stay blank when no interpreter/preparer is supplied.
const FORMS = [
  ['i912', 'i-912', 'i_912FieldValues', ['P9_L4_DaytimeTelePhoneNumber1[0]', 'P10_L4_DaytimeTelePhoneNumber1[0]', 'P9_L5_EmailAddress[0]', 'P10_L6_EmailAddress[0]', 'P9_L3A_StreetNumberName[0]', 'P10_L3a_StreetNumberName[0]']],
  ['i821d', 'i-821d', 'i_821dFieldValues', ['P6_Line4_DayPhone[0]', 'P7_Line4_DayPhone[0]', 'P6_Line5_Email[0]', 'P7_Line6_Email[0]', 'P6_Line3a_Street[0]', 'P7_Line3a_Street[0]']],
  ['i130a', 'i-130a', 'i_130aFieldValues', ['Pt6Line4_DaytimePhoneNumber[0]', 'Pt6Line6_Email[0]']]
];

let checked = 0;
for (const [slug, pdfSlug, fnName, leakFields] of FORMS) {
  const mod = require(`../netlify/functions/lib/${slug}-pdf-map`);
  const fn = mod[fnName] || Object.values(mod).find((f) => typeof f === 'function');
  const v = fn({ formAnswers: applicant, contact: {} });
  const res = incrementalFillPdf(fs.readFileSync(path.resolve(__dirname, `../assets/form-cache/pdfs/${pdfSlug}.pdf`)), v, []);
  assert.strictEqual(res.skippedFields.length, 0, `${slug} fill skipped: ${JSON.stringify(res.skippedFields)}`);
  for (const f of leakFields) {
    assert.ok(!v[f], `${slug}: ${f} must be blank — applicant contact leaked into an interpreter/preparer field`);
  }
  console.log(`${slug}: ${res.filledFields.length} filled, 0 skipped, no applicant→interpreter/preparer leak`);
  checked++;
}
console.log(`2nd-round leak guard passed: ${checked} forms`);
