'use strict';
/**
 * QA — generate a fully-populated I-130 sample and report coverage.
 * Renders nothing; writes decks/.build/i130-sample.pdf for visual review.
 *
 *   node scripts/qa-i130-sample.js
 */
const fs = require('fs');
const path = require('path');
const { i_130FieldValues } = require('../netlify/functions/lib/i130-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const A = {
  relationship_to_beneficiary: 'Spouse', child_relationship_basis: 'Not applicable',
  petitioner_family_name: 'Smith', petitioner_given_name: 'John', petitioner_middle_name: 'Michael',
  petitioner_alien_number: '123456789', petitioner_uscis_online_account_number: '987654321012', petitioner_ssn: '555112222',
  petitioner_sex: 'Male', petitioner_city_of_birth: 'Sacramento', petitioner_country_of_birth: 'United States', petitioner_date_of_birth: '1988-04-12',
  petitioner_mailing_address_line1: '456 New Street', petitioner_mailing_address_line2: 'Apt 5', petitioner_mailing_city: 'Sacramento', petitioner_mailing_state: 'CA', petitioner_mailing_zip: '95814', petitioner_mailing_country: 'United States',
  petitioner_physical_same_as_mailing: 'Yes', petitioner_current_address_from: '2021-06-01',
  petitioner_prior_address: [{ line1: '99 Old Road', city: 'Reno', state: 'NV', zip: '89501', country: 'United States', from: '2018-03-01', to: '2021-05-31' }],
  petitioner_number_of_marriages: '1', petitioner_marital_status: 'Married', petitioner_current_marriage_date: '2015-06-20', petitioner_current_marriage_place: 'Reno, NV',
  petitioner_status: 'U.S. citizen', petitioner_ethnicity: 'Not Hispanic or Latino', petitioner_race: ['White'], petitioner_weight_lbs: '180',
  petitioner_parent1_full_name: 'Robert Smith', petitioner_parent2_full_name: 'Mary Smith',
  petitioner_current_employment: [{ name: 'Acme Corp', occupation: 'Engineer', line1: '1 Market St', city: 'San Francisco', state: 'CA', zip: '94105', country: 'United States', from: '2021-07-01', to: 'PRESENT' }],
  petitioner_prior_employment: [{ name: 'Globex LLC', occupation: 'Analyst', line1: '50 Pine St', city: 'Reno', state: 'NV', zip: '89501', country: 'United States', from: '2018-04-01', to: '2021-06-15' }],
  petitioner_daytime_phone: '9163993992', petitioner_email_address: 'john@example.com',
  beneficiary_family_name: 'Smith', beneficiary_given_name: 'Olena', beneficiary_middle_name: 'Ivanivna',
  beneficiary_alien_number: '098765432', beneficiary_sex: 'Female', beneficiary_city_of_birth: 'Kyiv', beneficiary_country_of_birth: 'Ukraine', beneficiary_date_of_birth: '1992-09-30',
  beneficiary_current_address_line1: '12 Khreshchatyk St', beneficiary_current_city: 'Kyiv', beneficiary_current_state: 'Kyiv', beneficiary_current_zip: '01001', beneficiary_current_country: 'Ukraine',
  beneficiary_number_of_marriages: '1', beneficiary_marital_status: 'Married',
  beneficiary_daytime_phone: '380441234567', beneficiary_email_address: 'olena@example.com',
  beneficiary_passport_or_travel_document: 'FZ123456', beneficiary_passport_country: 'Ukraine', beneficiary_passport_expiration: '2030-05-15',
  beneficiary_current_employment: [{ name: 'Kyiv Bank', occupation: 'Teller', line1: '5 Bank St', city: 'Kyiv', state: 'Kyiv', zip: '01002', country: 'Ukraine', from: '2019-01-15', to: 'PRESENT' }]
};

const fv = i_130FieldValues({ formAnswers: A });
const pdf = fs.readFileSync(path.resolve(__dirname, '../assets/form-cache/pdfs/i-130.pdf'));
const res = incrementalFillPdf(pdf, fv, []);
const out = path.resolve(__dirname, '../decks/.build/i130-sample.pdf');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, res.buffer);

console.log('mapped:', Object.keys(fv).length, '| filled:', res.filledFields.length, '| skipped:', res.skippedFields.length);
if (res.skippedFields.length) console.log('SKIPPED:', JSON.stringify(res.skippedFields));
console.log('adoption fields set (should be none):', Object.keys(fv).filter((k) => /Pt1Line[34]/.test(k)));
console.log('ethnicity set:', Object.keys(fv).filter((k) => /Ethnicity/.test(k)), '(expect [0] = Not Hispanic)');
process.exit(res.skippedFields.length ? 1 : 0);
