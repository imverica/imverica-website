#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { i_131FieldValues, i_131TextOverlays } = require('../netlify/functions/lib/i131-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const pdf = fs.readFileSync(path.join(__dirname, '../assets/form-cache/pdfs/i-131.pdf'));
const common = {
  i131_family_name: 'Kovalenko', i131_given_name: 'Olena', i131_middle_name: 'Ihorivna',
  i131_other_name1_family: 'Ivanenko', i131_other_name1_given: 'Olena', i131_other_name1_middle: 'Ihorivna',
  i131_mailing_address: { line1: '100 Main St', line2: 'Apt 5', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  i131_physical_same_as_mailing: 'No',
  i131_physical_address: { line1: '200 Oak Ave', line2: 'Suite 10', city: 'Roseville', state: 'CA', zip: '95678', country: 'United States' },
  i131_alien_number: '123456789', i131_country_of_birth: 'Ukraine', i131_country_of_citizenship: 'Ukraine',
  i131_gender: 'Female', i131_date_of_birth: '1988-03-15', i131_ssn: '555001234',
  i131_uscis_online_account_number: '123456789012', i131_class_of_admission: 'DT',
  i131_i94_number: '12345678901', i131_i94_expiration_date: '2026-09-30', i131_uspid: 'USPID123456',
  i131_ethnicity: 'Not Hispanic or Latino', i131_race: ['White'], i131_height_feet: '5',
  i131_height_inches: '6', i131_weight_pounds: '135', i131_eye_color: 'Blue', i131_hair_color: 'Brown',
  i131_exclusion_deportation_or_removal: 'No',
  i131_prior_reentry_or_refugee_document: 'Yes', i131_prior_reentry_or_refugee_date: '2024-02-01',
  i131_prior_reentry_or_refugee_disposition: 'Attached', i131_prior_advance_parole_document: 'Yes',
  i131_prior_advance_parole_date: '2024-03-01', i131_prior_advance_parole_disposition: 'Still in my possession',
  i131_requesting_replacement: 'Yes', i131_replacement_reason: 'Incorrect due to applicant error or changed information',
  i131_correction_fields: ['Name', 'Date of Birth'], i131_replacement_explanation: 'Corrected legal name and date of birth.',
  i131_replacement_receipt: 'IOE1234567890', i131_daytime_phone: '9165551212',
  i131_mobile_phone: '9165553434', i131_email: 'olena@example.com'
};

function renderScenario(name, answers, assertions) {
  const payload = { formAnswers: { ...common, ...answers } };
  const values = i_131FieldValues(payload);
  const overlays = i_131TextOverlays(payload);
  const generated = incrementalFillPdf(pdf, values, overlays);
  assert.strictEqual(generated.skippedFields.length, 0, `${name}: skipped fields: ${generated.skippedFields.join(', ')}`);
  assertions(values, overlays);
  return { filled: generated.filledFields.length, overlays: overlays.length };
}

const refugee = renderScenario('refugee', {
  i131_application_type: '2. Refugee Travel Document for a refugee or asylee', i131_refugee_status_yes_no: 'Yes',
  i131_delivery_option: 'U.S. Embassy, Consulate, USCIS international field office, or DHS office overseas',
  i131_delivery_overseas_city: 'Warsaw', i131_delivery_overseas_country: 'Poland', i131_pickup_notice_to_part2: 'No',
  i131_pickup_notice_address: { line1: '300 Pine St', line2: 'Floor 2', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  i131_pickup_notice_phone: '9165557777', i131_pickup_notice_email: 'notice@example.com',
  i131_country_of_refugee_status: 'Ukraine', i131_refugee_plan_country_travel: 'No', i131_refugee_returned_country: 'Yes',
  i131_refugee_passport_country: 'No', i131_refugee_benefit_country: 'No', i131_refugee_reacquired_nationality: 'No',
  i131_refugee_new_nationality: 'No', i131_refugee_status_other_country: 'No', i131_refugee_filing_before_departure: 'No',
  i131_refugee_currently_outside_us: 'Yes', i131_refugee_current_location: 'Warsaw, Poland',
  i131_refugee_countries_since_departure: 'Poland', i131_refugee_explanation: 'Returned once to arrange an emergency family evacuation.'
}, (values, overlays) => {
  assert.strictEqual(values['P6_Line3a_YesNo[0]'], true);
  assert.strictEqual(values['P4_Line7a[0]'], true);
  assert.strictEqual(values['Part13_Line3_PartNumber[0]'], '6');
  assert.deepStrictEqual(overlays[0], { page: 1, x: 67, y: 315, size: 10, text: 'X' });
});

const advanceParole = renderScenario('advance-parole', {
  i131_application_type: '5. Advance Parole Document for a person inside the United States',
  i131_advance_parole_basis: 'B. Pending Form I-589', i131_advance_parole_receipt_or_class: 'ZLA1234567890',
  i131_refugee_status_yes_no: 'No', i131_planned_departure_date: '2026-08-01',
  i131_purpose_of_travel: 'Visit an ill parent.', i131_countries_to_visit: 'Poland',
  i131_number_of_trips: 'One Trip', i131_expected_trip_length_days: '14'
}, (values, overlays) => {
  assert.strictEqual(values['P1_Line5B[0]'], 'ZLA1234567890');
  assert.strictEqual(values['P7_Line4_CB[0]'], true);
  assert.strictEqual(overlays.length, 1);
  assert.strictEqual(overlays[0].page, 2);
});

const initialParole = renderScenario('initial-parole', {
  i131_application_type: '6. Initial Parole Document under a specific program or process',
  i131_initial_parole_program: 'C. Intergovernmental Parole Referral', i131_initial_parole_agency: 'Department of State',
  i131_initial_parole_agency_email: 'official@example.gov', i131_refugee_status_yes_no: 'No',
  i131_for_beneficiary: 'I am filing for someone else', i131_beneficiary_family_name: 'Petrenko',
  i131_beneficiary_given_name: 'Andrii', i131_beneficiary_middle_name: 'Ivanovych',
  i131_beneficiary_other_name1_family: 'Petrov', i131_beneficiary_other_name1_given: 'Andrii',
  i131_beneficiary_date_of_birth: '1985-08-20', i131_beneficiary_country_of_birth: 'Ukraine',
  i131_beneficiary_country_of_citizenship: 'Ukraine', i131_beneficiary_daytime_phone: '9165559898',
  i131_beneficiary_email: 'andrii@example.com', i131_beneficiary_alien_number: '987654321',
  i131_beneficiary_mailing_address: { line1: '10 Shevchenko St', line2: 'Apt 8', city: 'Kyiv', state: 'Kyiv', zip: '01001', country: 'Ukraine' },
  i131_beneficiary_physical_address: { line1: '20 Franko St', line2: 'Apt 3', city: 'Lviv', state: 'Lviv', zip: '79000', country: 'Ukraine' },
  i131_beneficiary_class_of_admission: 'PAR', i131_beneficiary_i94_number: '10987654321',
  i131_parole_qualification_explanation: 'Urgent humanitarian parole request based on documented circumstances.',
  i131_expected_stay_us: '12 months', i131_intended_arrival_date_us: '2026-10-01',
  i131_intended_arrival_city: 'Warsaw', i131_intended_arrival_country: 'Poland'
}, (values, overlays) => {
  assert.strictEqual(values['P1_Line6C1[0]'], 'Department of State');
  assert.strictEqual(values['P2_Line16_FamilyName[0]'], 'Petrenko');
  assert.strictEqual(values['P2_Line24_Province[0]'], 'Kyiv');
  assert.strictEqual(overlays[0].page, 3);
});

const reparole = renderScenario('re-parole', {
  i131_application_type: '10. Re-parole under a specific program or process',
  i131_reparole_program: 'C. Ukrainian re-parole process', i131_reparole_admit_until: '2026-12-31',
  i131_refugee_status_yes_no: 'No', i131_for_beneficiary: 'I am filing for myself',
  i131_parole_qualification_explanation: 'Requesting a new period of parole under the Ukrainian re-parole process.',
  i131_expected_stay_us: '24 months', i131_request_reparole_ead: 'Yes'
}, (values, overlays) => {
  assert.strictEqual(values['CB_AppType[6]'], true);
  assert.strictEqual(values['P1_Line12_DateOfAdmission[0]'], '12/31/2026');
  assert.strictEqual(values['P9_Line1_EAD[0]'], true);
  assert.strictEqual(overlays.length, 0);
});

assert(!Object.prototype.hasOwnProperty.call(i_131FieldValues({ formAnswers: common }), 'Part10_Line4_DateofSignature[0]'), 'Draft generation must not pre-date the applicant signature');
console.log(`I-131 PDF map QA passed: refugee ${refugee.filled}+${refugee.overlays} overlay; advance parole ${advanceParole.filled}+${advanceParole.overlays}; initial parole ${initialParole.filled}+${initialParole.overlays}; re-parole ${reparole.filled}+${reparole.overlays}; 0 skipped`);
