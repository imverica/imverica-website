#!/usr/bin/env node
'use strict';
/**
 * Contract QA for the I-821 PDF map (Application for Temporary Protected Status).
 *
 * Locks the fixes that made I-821 actually generate:
 *   - the wizard's addressBlock (mailing_address / physical_address) fills the
 *     PDF (was reading legacy flat keys → address dropped out);
 *   - the TPS request type (initial_or_reregistration) marks Item 1;
 *   - physical_same_as_mailing copies the mailing address;
 *   - interpreter/preparer fields NEVER inherit the applicant's address/phone/
 *     email (the I-864-class leak), and DO fill from their own data;
 *   - the signature date is left blank.
 *
 *   node scripts/qa-i821-pdf-map.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { i_821FieldValues } = require('../netlify/functions/lib/i821-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const base = {
  initial_or_reregistration: 'Initial', tps_country: 'Ukraine',
  applicant_family_name: 'Kovalenko', applicant_given_name: 'Olena', date_of_birth: '1990-03-15',
  country_of_birth: 'Ukraine', country_of_citizenship: 'Ukraine', alien_number: '208924970', ssn: '555001234', sex: 'Female',
  mailing_address: { line1: '100 Main St', line2: 'Apt 5', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  physical_same_as_mailing: 'Yes',
  daytime_phone: { countryCode: '+1', areaCode: '916', number: '5551234' }, email_address: 'olena@example.com'
};

const v = i_821FieldValues({ formAnswers: base });
const pdf = fs.readFileSync(path.resolve(__dirname, '../assets/form-cache/pdfs/i-821.pdf'));
const res = incrementalFillPdf(pdf, v, []);

// 1. Fills cleanly.
assert.strictEqual(res.skippedFields.length, 0, `I-821 fill skipped fields: ${JSON.stringify(res.skippedFields)}`);
assert.ok(res.filledFields.length >= 24, `I-821 expected >= 24 filled fields, got ${res.filledFields.length}`);

// 2. TPS request type + designated country.
assert.strictEqual(v['Part1_Item1_ApplicationType[0]'], true, 'Initial TPS request type marked');
assert.strictEqual(v['Part1_TPScountry[0]'], 'Ukraine', 'Designated TPS country filled');

// 3. addressBlock fills (street + unit number + unit TYPE marked).
assert.strictEqual(v['Part2_Item4_StreetNumberName[0]'], '100 Main St', 'Mailing street from addressBlock');
assert.strictEqual(v['Part2_Item4_AptSteFlrNumber[0]'], '5', 'Mailing unit number');
assert.strictEqual(v['Part2_Item4_Unit[0]'], 'APT', 'Mailing unit TYPE marked');
assert.strictEqual(v['Part2_Item6_StreetNumberName[0]'], '100 Main St', 'physical_same_as_mailing copies mailing');

// 4. ANTI-LEAK: no interpreter/preparer → their fields stay blank (never the
//    applicant's address/phone/email).
assert.ok(!v['Part9_Item4_DaytimePhone[0]'], 'Interpreter phone must NOT inherit applicant phone');
assert.ok(!v['Part9_Item3_StreetNumberName[0]'], 'Interpreter address must NOT inherit applicant address');
assert.ok(!v['Part10_Item4_DaytimePhone[0]'], 'Preparer phone must NOT inherit applicant phone');

// 5. Signature date blank (not pre-stamped).
assert.ok(!v['Part9_Item6_DateofSignature[0]'], 'Signature date must stay blank');
assert.ok(!v['Part10_Item8b_DateofSignature[0]'], 'Preparer signature date must stay blank');

// 6. When an interpreter IS present, their own data fills.
const withInterp = i_821FieldValues({ formAnswers: { ...base, interpreter_family_name: 'Petrov', interpreter_phone: { countryCode: '+1', areaCode: '415', number: '7778888' }, interpreter_city: 'Oakland' } });
assert.strictEqual(withInterp['Part9_Item4_DaytimePhone[0]'], '4157778888', 'Interpreter phone fills from interpreter data');
assert.strictEqual(withInterp['Part9_Item3_CityOrTown[0]'], 'Oakland', 'Interpreter city fills from interpreter data');

console.log(`I-821 PDF map QA passed: ${res.filledFields.length} fields filled, 0 skipped; addressBlock + TPS type fill, no applicant→interpreter/preparer leak`);
