#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { i_751FieldValues } = require('../netlify/functions/lib/i751-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const answers = {
  i751_filing_type: 'Joint petition with my spouse',
  applicant_family_name: 'Kovalenko', applicant_given_name: 'Olena', applicant_middle_name: 'Ihorivna',
  i751_other_name1_family: 'Ivanenko', i751_other_name1_given: 'Olena',
  date_of_birth: '1988-03-15', country_of_birth: 'Ukraine', country_of_citizenship: 'Ukraine',
  alien_number: '123456789', ssn: '555001234', uscis_online_account_number: '123456789012',
  marriage_status_now: 'Married', current_marriage_date: '2021-06-10', i751_place_of_marriage: 'Sacramento, California, United States',
  conditional_green_card_expiration: '2026-09-01',
  mailing_address: { line1: '100 Main St', line2: 'Apt 5', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  physical_same_as_mailing: 'No',
  physical_address: { line1: '200 Oak Ave', line2: 'Suite 10', city: 'Roseville', state: 'CA', zip: '95678', country: 'United States' },
  i751_in_removal_proceedings: 'Yes', i751_nonattorney_fee_paid: 'Yes', i751_criminal_history: 'Yes',
  i751_different_current_marriage: 'No', i751_other_residences_since_lpr: 'Yes', i751_spouse_government_abroad: 'No',
  residence_history: [{ line1: '50 Pine St', line2: 'Apt 2', city: 'Davis', state: 'CA', zip: '95616', country: 'United States', from: '2022-01-01', to: '2023-01-01' }],
  i751_removal_details: 'Removal proceedings explanation.', i751_nonattorney_fee_details: 'Paid a document assistant for typing support.',
  i751_criminal_history_details: 'Citation was dismissed.',
  i751_ethnicity: 'Not Hispanic or Latino', i751_race: ['White'], i751_height_feet: '5', i751_height_inches: '6',
  i751_weight_pounds: '135', i751_eye_color: 'Blue', i751_hair_color: 'Brown',
  i751_part4_relationship: 'Spouse or former spouse', spouse_family_name: 'Kovalenko', spouse_given_name: 'Andrii', spouse_middle_name: 'Petrovych',
  spouse_date_of_birth: '1985-08-20', spouse_ssn: '555009999', spouse_alien_number: '987654321',
  i751_spouse_address: { line1: '200 Oak Ave', line2: 'Suite 10', city: 'Roseville', state: 'CA', zip: '95678', country: 'United States' },
  total_children: 5, i751_more_than_five_children: 'Yes', i751_additional_children: 'Child 6: Petro Kovalenko, DOB 01/01/2020, A000000006, lives with petitioner, not applying.',
  i751_accommodation_for_self: 'Yes', i751_accommodation_for_spouse: 'No', i751_accommodation_for_children: 'Yes',
  i751_accommodation_types: ['Deaf or hard of hearing', 'Other disability or impairment'],
  i751_deaf_accommodation: 'ASL interpreter', i751_other_accommodation: 'Extra time at interview.',
  i751_applicant_statement: 'An interpreter read every question and answer to me', i751_applicant_statement_language: 'Ukrainian',
  i751_preparer_name_for_statement: 'Jane Smith', daytime_phone: '9165551212', mobile_phone: '9165553434', email_address: 'olena@example.com',
  i751_spouse_statement: 'I can read and understand English', i751_spouse_daytime_phone: '9165559999', i751_spouse_email: 'andrii@example.com',
  has_interpreter: 'Yes', interpreter_family_name: 'Shevchenko', interpreter_given_name: 'Maria', interpreter_business_name: 'Imverica',
  i751_interpreter_address: { line1: '300 Capitol Mall', line2: 'Suite 100', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  interpreter_daytime_phone: '9165557777', interpreter_email: 'interpreter@example.com', interpreter_language: 'Ukrainian',
  has_preparer: 'Yes', preparer_family_name: 'Smith', preparer_given_name: 'Jane', preparer_business_name: 'Imverica Legal Solutions',
  i751_preparer_address: { line1: '300 Capitol Mall', line2: 'Suite 100', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  preparer_daytime_phone: '9165558888', preparer_fax: '9165556666', preparer_email: 'preparer@example.com',
  i751_preparer_is_attorney: 'No', i751_preparer_representation_extends: 'No',
  i751_additional_information: 'Extra case notes for Part 11.'
};

for (let number = 1; number <= 5; number += 1) {
  Object.assign(answers, {
    [`i751_child${number}_family_name`]: 'Kovalenko',
    [`i751_child${number}_given_name`]: `Child${number}`,
    [`i751_child${number}_dob`]: `201${number}-01-0${number}`,
    [`i751_child${number}_alien_number`]: `12345678${number}`,
    [`i751_child${number}_lives_with_you`]: number % 2 ? 'Yes' : 'No',
    [`i751_child${number}_applying_with_you`]: number <= 2 ? 'Yes' : 'No',
    [`i751_child${number}_address`]: { line1: `${number} Child St`, line2: 'Apt 1', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' }
  });
}

const values = i_751FieldValues({ formAnswers: answers });
assert.strictEqual(values['Pt1Line1a_FamilyName[0]'], 'Kovalenko');
assert.strictEqual(values['Pt3Line1[0]'], true);
assert.strictEqual(values['Line17_Checkbox[0]'], true);
assert.strictEqual(values['P3_checkbox10[0]'], true);
assert.strictEqual(values['Part4_Relationship[1]'], true);
assert.strictEqual(values['Line1a_FamilyName3[0]'], 'Kovalenko');
assert.strictEqual(values['Line13a_FamilyName[3]'], 'Kovalenko');
assert.strictEqual(values['Pt6Line4a_chbx[0]'], true);
assert.strictEqual(values['P5_Line3_DaytimePhoneNumber[0]'], '9165551212');
assert.strictEqual(values['P7_Line1a_FamilyName[0]'], 'Smith');
assert.strictEqual(values['P8_Line3b_PartNumber[0]'], '1');
assert(!Object.prototype.hasOwnProperty.call(values, 'P5_Line6b_DateofSignature[0]'), 'Draft generation must not pre-date petitioner signature');
assert(!Object.prototype.hasOwnProperty.call(values, 'P7_Line8b_DateofSignature[0]'), 'Draft generation must not pre-date preparer signature');

const generated = incrementalFillPdf(fs.readFileSync(path.join(__dirname, '../assets/form-cache/pdfs/i-751.pdf')), values);
assert.strictEqual(generated.skippedFields.length, 0, `Unexpected skipped I-751 fields: ${generated.skippedFields.join(', ')}`);
console.log(`I-751 PDF map QA passed: ${generated.filledFields.length} fields filled, 0 skipped`);
