#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { n_400FieldValues } = require('../netlify/functions/lib/n400-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const answers = {
  basis_for_naturalization: 'General Provision',
  alien_number: '123456789',
  applicant_family_name: 'Gonzalez',
  applicant_given_name: 'Maria',
  applicant_middle_name: 'Elena',
  date_of_birth: '1988-03-15',
  green_card_date: '2018-05-10',
  sex: 'Female',
  country_of_birth: 'Mexico',
  country_of_citizenship: 'Mexico',
  n400_parent_citizen_before_18: 'No',
  n400_n648_disability_exception: 'No',
  n400_ssa_card_update: 'Yes',
  n400_ssa_disclosure_consent: 'Yes',
  ssn: '555001234',
  ethnicity: 'Not Hispanic or Latino',
  race: ['White'],
  height_feet: '5',
  height_inches: '6',
  weight_pounds: '135',
  eye_color: 'Brown',
  hair_color: 'Black',
  n400_current_physical_address: { line1: '100 Main St', line2: 'Apt 2', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  n400_current_address_from: '2024-01-01',
  physical_same_as_mailing: 'Yes',
  addresses_last_five_years: [
    { line1: '200 Oak St', city: 'Roseville', state: 'CA', zip: '95678', country: 'United States', from: '2022-01-01', to: '2023-12-31' }
  ],
  marital_status: 'Married',
  n400_p9_1_claimed_citizen: 'No',
  n400_p9_3_overdue_taxes: 'No',
  n400_p9_7b_genocide: 'No',
  n400_p9_15a_unarrested_crime: 'No',
  n400_p9_15b_arrested_charged: 'No',
  n400_p9_31_support_constitution: 'Yes',
  n400_p9_32_understand_oath: 'Yes',
  n400_p9_33_unable_oath: 'No',
  n400_p9_34_willing_oath: 'Yes',
  daytime_phone: '9165551212',
  email_address: 'maria@example.com'
};

const values = n_400FieldValues({ formAnswers: answers });
assert.strictEqual(values['P2_Line1_FamilyName[0]'], 'Gonzalez', 'Applicant family name must fill Part 2, not the read-only Part 14 copy');
assert.strictEqual(values['P2_Line1_GivenName[0]'], 'Maria');
assert.strictEqual(values['P2_Line8_DateOfBirth[0]'], '03/15/1988');
assert.strictEqual(values['P2_Line9_DateBecamePermanentResident[0]'], '05/10/2018');
assert.strictEqual(values['Line12b_SSN[0]'], '555001234');
assert.strictEqual(values['P12_Line3_Telephone[0]'], '9165551212', 'Applicant phone must fill applicant contact, not interpreter contact');
assert.strictEqual(values['P12_Line5_Email[0]'], 'maria@example.com');
assert.strictEqual(values['P4_Line1_StreetName[0]'], '100 Main St');
assert.strictEqual(values['P4_Line1_DatesofResidence[1]'], '01/01/2024');
assert.strictEqual(values['P4_Line3_PhysicalAddress1[0]'], '200 Oak St');
assert.strictEqual(values['P4_Line3_From1[1]'], '12/31/2023');
assert.strictEqual(values['P9_Line1[0]'], true, 'Part 9 Item 1 No widget must be selected');
assert.strictEqual(values['[0]'], true, 'Part 9 Item 7.b No widget must be selected');
assert.strictEqual(values['P12_Line31[1]'], true, 'Part 9 Item 31 Yes widget must be selected');
assert(!Object.prototype.hasOwnProperty.call(values, 'P2_Line1_FamilyName[1]'), 'Mapper must not write the read-only Additional Information name copy');
assert(!Object.prototype.hasOwnProperty.call(values, 'P14_Line4_Telephone[0]'), 'Applicant phone must not leak into interpreter fields');
assert(!Object.prototype.hasOwnProperty.call(values, 'Part15DateofSignature[1]'), 'Draft generation must not pre-date the oath signature');

const pdfPath = path.join(__dirname, '../assets/form-cache/pdfs/n-400.pdf');
const generated = incrementalFillPdf(fs.readFileSync(pdfPath), values);
assert(generated.filledFields.includes('P2_Line1_FamilyName[0]'));
assert(generated.filledFields.includes('P9_Line1[0]'));
assert(generated.filledFields.includes('P12_Line31[1]'));
assert.strictEqual(generated.skippedFields.length, 0, `Unexpected skipped N-400 fields: ${generated.skippedFields.join(', ')}`);

console.log(`N-400 PDF map QA passed: ${generated.filledFields.length} fields filled, 0 skipped`);
