#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { i_589FieldValues } = require('../netlify/functions/lib/i589-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const answers = {
  alien_number: '123456789',
  ssn: '555001234',
  uscis_online_account_number: '123456789012',
  applicant_family_name: 'Kovalenko',
  applicant_given_name: 'Olena',
  applicant_middle_name: 'Ihorivna',
  other_names_used: 'Olena Ivanenko',
  i589_residential_address: { line1: '100 Main St', line2: 'Apt 5', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  daytime_phone: '9165551212',
  physical_same_as_mailing: 'No',
  mailing_address: { line1: '200 Oak Ave', line2: 'Suite 10', city: 'Roseville', state: 'CA', zip: '95678', country: 'United States' },
  sex: 'Female',
  marital_status: 'Married',
  date_of_birth: '1988-03-15',
  city_of_birth: 'Kyiv',
  country_of_birth: 'Ukraine',
  country_of_citizenship: 'Ukraine',
  i589_nationality_at_birth: 'Ukraine',
  i589_ethnic_or_tribal_group: 'Ukrainian',
  i589_religion: 'Christian',
  i589_court_proceedings: 'I have never been in Immigration Court proceedings',
  i589_date_last_left_country: '2023-04-01',
  i94_number: '12345678901',
  date_last_entered_us: '2023-04-10',
  place_entry: 'Los Angeles, CA',
  current_immigration_status: 'Parolee',
  authorized_stay_expires: '2025-04-09',
  i589_has_earlier_entries: 'Yes',
  i589_entry2_date: '2019-06-01',
  i589_entry2_place: 'New York, NY',
  i589_entry2_status: 'B-2 visitor',
  i589_has_third_entry: 'Yes',
  i589_entry3_date: '2017-05-01',
  i589_entry3_place: 'Chicago, IL',
  i589_entry3_status: 'B-2 visitor',
  passport_country_of_issuance: 'Ukraine',
  passport_number: 'FA123456',
  i589_travel_document_number: 'TD123456',
  passport_expiration: '2030-01-01',
  i589_native_language: 'Ukrainian',
  i589_fluent_in_english: 'Yes',
  i589_other_fluent_languages: 'Russian',
  spouse_passport_number: 'FB654321',
  spouse_ssn: '555009999',
  spouse_family_name: 'Kovalenko',
  spouse_given_name: 'Andrii',
  spouse_middle_name: 'Petrovych',
  spouse_other_names_used: 'None',
  spouse_date_of_birth: '1985-08-20',
  spouse_date_of_marriage: '2012-09-01',
  spouse_place_of_marriage: 'Kyiv, Ukraine',
  spouse_city_of_birth: 'Lviv',
  spouse_country_of_birth: 'Ukraine',
  spouse_country_of_citizenship: 'Ukraine',
  spouse_ethnic_or_tribal_group: 'Ukrainian',
  spouse_sex: 'Male',
  i589_spouse_in_us: 'Yes',
  spouse_place_entry: 'Los Angeles, CA',
  spouse_date_last_entered_us: '2023-04-10',
  spouse_i94_number: '10987654321',
  spouse_status_last_admitted: 'Parolee',
  spouse_current_status: 'Parolee',
  spouse_authorized_stay_expires: '2025-04-09',
  spouse_in_immigration_court: 'No',
  i589_spouse_included: 'Yes',
  total_children: 4,
  asylum_basis: ['Race', 'Religion', 'Nationality', 'Political opinion', 'Membership in a particular social group', 'Torture Convention'],
  i589_past_harm_yes_no: 'Yes',
  i589_past_harm_details: 'Past harm details.',
  i589_future_harm_yes_no: 'Yes',
  i589_future_harm_details: 'Future fear details.',
  i589_foreign_accusation_yes_no: 'Yes',
  i589_foreign_accusation_details: 'Foreign detention details.',
  i589_organization_membership_yes_no: 'Yes',
  i589_organization_membership_details: 'Organization details.',
  i589_current_organization_participation_yes_no: 'No',
  i589_torture_fear_yes_no: 'Yes',
  i589_torture_fear_details: 'Torture fear details.',
  i589_prior_asylum_application: 'Yes',
  i589_prior_asylum_details: 'Prior application details.',
  i589_traveled_through_other_country: 'Yes',
  i589_other_country_lawful_status: 'No',
  i589_third_country_details: 'Third-country details.',
  i589_participated_in_persecution: 'No',
  i589_returned_to_feared_country: 'Yes',
  i589_returned_to_feared_country_details: 'Return trip details.',
  i589_filing_more_than_one_year_after_arrival: 'Yes',
  i589_one_year_explanation: 'One-year explanation.',
  i589_us_crime_or_arrest: 'No',
  i589_name_native_alphabet: 'Олена Коваленко',
  i589_family_assisted: 'Yes',
  i589_family_assistance_details: 'Andrii Kovalenko, spouse; Maria Kovalenko, child',
  has_preparer: 'Yes',
  i589_received_low_cost_legal_list: 'Yes',
  preparer_family_name: 'Smith',
  preparer_given_name: 'Jane',
  preparer_daytime_phone: '9165559999',
  i589_preparer_address: { line1: '300 Capitol Mall', line2: 'Suite 100', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' }
};

for (let number = 1; number <= 4; number += 1) {
  Object.assign(answers, {
    [`child${number}_alien_number`]: `12345678${number}`,
    [`child${number}_passport_number`]: `PC00000${number}`,
    [`child${number}_marital_status`]: 'Single',
    [`child${number}_ssn`]: `55500000${number}`,
    [`child${number}_family_name`]: 'Kovalenko',
    [`child${number}_given_name`]: `Child${number}`,
    [`child${number}_dob`]: `201${number}-01-0${number}`,
    [`child${number}_city_of_birth`]: 'Kyiv',
    [`child${number}_country_of_birth`]: 'Ukraine',
    [`child${number}_country_of_citizenship`]: 'Ukraine',
    [`child${number}_ethnic_or_tribal_group`]: 'Ukrainian',
    [`child${number}_sex`]: number % 2 ? 'Female' : 'Male',
    [`child${number}_in_us`]: 'Yes',
    [`child${number}_place_entry`]: 'Los Angeles, CA',
    [`child${number}_date_last_entered_us`]: '2023-04-10',
    [`child${number}_i94_number`]: `1000000000${number}`,
    [`child${number}_status_last_admitted`]: 'Parolee',
    [`child${number}_current_status`]: 'Parolee',
    [`child${number}_authorized_stay_expires`]: '2025-04-09',
    [`child${number}_in_immigration_court`]: 'No',
    [`child${number}_included`]: 'Yes'
  });
}

const values = i_589FieldValues({ formAnswers: answers });
assert.strictEqual(values['PtAILine4_LastName[0]'], 'Kovalenko');
assert.strictEqual(values['DateTimeField1[0]'], '03/15/1988');
assert.strictEqual(values['CheckBox3[0]'], true);
assert.strictEqual(values['TextField14[0]'], 'Past harm details.');
assert.strictEqual(values['PCL5_TextField[0]'], 'One-year explanation.');
assert.strictEqual(values['TextField20[1]'], 'Олена Коваленко');
assert.strictEqual(values['ChildLast4[0]'], 'Kovalenko');
assert.strictEqual(values['PtAIILine21_Yes4[0]'], true);
assert(!Object.prototype.hasOwnProperty.call(values, 'DateTimeField48[0]'), 'Draft generation must not pre-date the applicant signature');

const pdfPath = path.join(__dirname, '../assets/form-cache/pdfs/i-589.pdf');
const generated = incrementalFillPdf(fs.readFileSync(pdfPath), values);
assert(generated.filledFields.includes('PtAILine4_LastName[0]'));
assert(generated.filledFields.includes('TextField20[1]'));
assert(generated.filledFields.includes('PCL5_TextField[0]'));
assert(generated.filledFields.includes('PtAIILine21_Yes4[0]'));
assert.strictEqual(generated.skippedFields.length, 0, `Unexpected skipped I-589 fields: ${generated.skippedFields.join(', ')}`);

console.log(`I-589 PDF map QA passed: ${generated.filledFields.length} fields filled, 0 skipped`);
