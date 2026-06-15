#!/usr/bin/env node
'use strict';
/**
 * Contract QA for the I-130 PDF map (Petition for Alien Relative).
 *
 * I-130's #1 failure mode is petitioner/beneficiary leakage: the PETITIONER
 * (the filer) belongs in Part 2 and the BENEFICIARY (the relative) in Part 4.
 * A regression that routes one into the other's boxes still fills the form with
 * "0 skipped", so coverage counts alone cannot catch it. This test uses
 * DISTINCT petitioner/beneficiary identities and asserts each lands only in its
 * own official field — plus date format, sex checkboxes, and the Apt/Ste/Flr
 * unit-type marker (the systemic "number filled but type unticked" bug).
 *
 *   node scripts/qa-i130-pdf-map.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { i_130FieldValues } = require('../netlify/functions/lib/i130-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

// Petitioner and beneficiary are deliberately different in every shared trait
// (family name, DOB, sex, country of birth) so any cross-contamination fails.
const answers = {
  relationship_to_beneficiary: 'Spouse', child_relationship_basis: 'Not applicable',
  petitioner_family_name: 'Smith', petitioner_given_name: 'John', petitioner_middle_name: 'Michael',
  petitioner_alien_number: '123456789', petitioner_uscis_online_account_number: '987654321012', petitioner_ssn: '555112222',
  petitioner_sex: 'Male', petitioner_city_of_birth: 'Sacramento', petitioner_country_of_birth: 'United States', petitioner_date_of_birth: '1988-04-12',
  petitioner_mailing_address_line1: '456 New Street', petitioner_mailing_address_line2: 'Apt 5', petitioner_mailing_city: 'Sacramento', petitioner_mailing_state: 'CA', petitioner_mailing_zip: '95814', petitioner_mailing_country: 'United States',
  petitioner_physical_same_as_mailing: 'Yes', petitioner_current_address_from: '2021-06-01',
  petitioner_number_of_marriages: '1', petitioner_marital_status: 'Married', petitioner_current_marriage_date: '2015-06-20', petitioner_current_marriage_place: 'Reno, NV',
  petitioner_status: 'U.S. citizen', petitioner_ethnicity: 'Not Hispanic or Latino', petitioner_race: ['White'],
  petitioner_current_employment: [{ name: 'Acme Corp', occupation: 'Engineer', line1: '1 Market St', city: 'San Francisco', state: 'CA', zip: '94105', country: 'United States', from: '2021-07-01', to: 'PRESENT' }],
  petitioner_daytime_phone: '9163993992', petitioner_email_address: 'john@example.com',
  beneficiary_family_name: 'Kovalenko', beneficiary_given_name: 'Olena', beneficiary_middle_name: 'Ivanivna',
  beneficiary_alien_number: '098765432', beneficiary_sex: 'Female', beneficiary_city_of_birth: 'Kyiv', beneficiary_country_of_birth: 'Ukraine', beneficiary_date_of_birth: '1992-09-30',
  beneficiary_current_address_line1: '12 Khreshchatyk St', beneficiary_current_city: 'Kyiv', beneficiary_current_state: 'Kyiv', beneficiary_current_zip: '01001', beneficiary_current_country: 'Ukraine',
  beneficiary_number_of_marriages: '1', beneficiary_marital_status: 'Married'
};

const v = i_130FieldValues({ formAnswers: answers });

// 1. End-to-end fill against the real (raw USCIS) PDF — every mapped key must
//    correspond to a field that actually exists, i.e. zero skips.
const pdf = fs.readFileSync(path.resolve(__dirname, '../assets/form-cache/pdfs/i-130.pdf'));
const res = incrementalFillPdf(pdf, v, []);
assert.strictEqual(res.skippedFields.length, 0, `I-130 fill skipped fields: ${JSON.stringify(res.skippedFields)}`);
assert.ok(res.filledFields.length >= 40, `I-130 expected >= 40 filled fields, got ${res.filledFields.length}`);

// 2. Anti-leakage: petitioner identity ONLY in Part 2, beneficiary ONLY in Part 4.
assert.strictEqual(v['Pt2Line4a_FamilyName[0]'], 'Smith', 'Petitioner family name must be in Part 2');
assert.strictEqual(v['Pt4Line4a_FamilyName[0]'], 'Kovalenko', 'Beneficiary family name must be in Part 4');
assert.notStrictEqual(v['Pt2Line4a_FamilyName[0]'], v['Pt4Line4a_FamilyName[0]'], 'Petitioner and beneficiary names must not collapse together');
assert.strictEqual(v['Pt2Line7_CountryofBirth[0]'], 'United States', 'Petitioner country of birth in Part 2');
assert.strictEqual(v['Pt4Line8_CountryOfBirth[0]'], 'Ukraine', 'Beneficiary country of birth in Part 4');

// 3. Dates land in the correct part and are MM/DD/YYYY.
assert.strictEqual(v['Pt2Line8_DateofBirth[0]'], '04/12/1988', 'Petitioner DOB (Part 2) formatted MM/DD/YYYY');
assert.strictEqual(v['Pt4Line9_DateOfBirth[0]'], '09/30/1992', 'Beneficiary DOB (Part 4) formatted MM/DD/YYYY');

// 4. Sex checkboxes: the selected box true, the opposite box NOT set, per part.
assert.strictEqual(v['Pt2Line9_Male[0]'], true, 'Petitioner Male checkbox set in Part 2');
assert.ok(!v['Pt2Line9_Female[0]'], 'Petitioner Female checkbox must not be set');
assert.strictEqual(v['Pt4Line9_Female[0]'], true, 'Beneficiary Female checkbox set in Part 4');
assert.ok(!v['Pt4Line9_Male[0]'], 'Beneficiary Male checkbox must not be set');

// 5. Apt/Ste/Flr: the unit number is filled AND the unit TYPE is marked APT
//    (string-match engine sets all 3 widgets; renderer ticks only the match).
assert.strictEqual(v['Pt2Line10_AptSteFlrNumber[0]'], '5', 'Unit number filled');
assert.strictEqual(v['Pt2Line10_Unit[0]'], 'APT', 'Unit TYPE must be marked APT, not left blank');

console.log(`I-130 PDF map QA passed: ${res.filledFields.length} fields filled, 0 skipped; petitioner↔Part2 / beneficiary↔Part4 verified`);
