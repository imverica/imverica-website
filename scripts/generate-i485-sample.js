#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');
const { i485FieldValues } = require('../netlify/functions/lib/i485-pdf-map');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_PDF = path.join(ROOT, 'assets/form-cache/pdfs/i-485.pdf');
const OUTPUT_DIR = path.join(ROOT, 'generated-samples');
const OUTPUT_PDF = path.join(OUTPUT_DIR, 'sample-i-485-test.pdf');

// Maria Kovalchuk — U-1 nonimmigrant adjusting status under INA 245(m)
function samplePayload() {
  return {
    formAnswers: {
      // Part 1 — Identity
      applicant_family_name: 'Kovalchuk',
      applicant_given_name: 'Maria',
      applicant_middle_name: 'Oleksandrivna',
      date_of_birth: '1985-03-15',
      other_dob_used: 'No',
      sex: 'Female',

      // Part 1 — A-Number
      alien_number: 'A209876543',
      has_prior_alien_number: 'No',

      // Part 1 — Birth / Citizenship
      city_of_birth: 'Lviv',
      country_of_birth: 'Ukraine',
      country_of_citizenship: 'Ukraine',
      uscis_online_account_number: '210000987654',

      // Part 1 — Passport / Entry
      passport_number: 'FN123456',
      passport_expiration: '2028-06-30',
      passport_country_of_issuance: 'Ukraine',
      visa_number: 'U1234567',
      port_of_entry_city: 'New York',
      port_of_entry_state: 'NY',
      date_of_arrival: '2021-05-01',
      // U-1 status authorized for duration of status
      status_expiration_date: 'D/S',
      status_at_last_entry: 'U-1',
      admission_basis: 'nonimmigrant',
      i94_number: '12345678901',
      date_of_last_entry: '2021-05-01',
      manner_of_last_entry: 'U-1 nonimmigrant',
      current_immigration_status: 'U-1 nonimmigrant (victim of qualifying criminal activity)',
      authorized_stay_expires: 'D/S',

      // Part 1 — No removal proceedings
      in_removal_proceedings: 'No',
      prior_removal_order: 'No',
      ever_removed_excluded: 'No',

      // Part 1 — SSN
      has_ssn: 'Yes',
      ssn: '987654321',
      ssn_ssa_consent: 'Yes',

      // Part 1 — Current address (same for 5+ years)
      mailing_address_line1: '8305 Deer Spring Circle',
      mailing_address_line2: 'Apt 14',
      mailing_city: 'Sacramento',
      mailing_state: 'CA',
      mailing_zip: '95843',
      same_address_five_years: 'No',

      // Part 1 — Prior address (before current address)
      prior_address_line1: '412 Oak Street',
      prior_city: 'New York',
      prior_state: 'NY',
      prior_zip: '10001',
      prior_country: 'United States',
      prior_date_from: '2021-05-01',
      prior_date_to: '2022-08-01',

      // Part 2 — Eligibility: U nonimmigrant adjusting under INA 245(m)
      eligibility_basis: 'U nonimmigrant adjusting status under 245(m)',
      petition_previously_filed: 'Yes',
      petition_receipt_number: 'IOE2100123456',
      petition_date: '2021-01-15',
      petitioner_family_name: 'Kovalchuk',
      petitioner_given_name: 'Maria',
      concurrent_filing: 'No',

      // Part 4 — Employment
      currently_working: 'Yes',
      worked_without_authorization: 'No',
      employer_name: 'Sacramento Community Services Inc.',

      // Part 5 — Parents
      father_family_name: 'Kovalchuk',
      father_given_name: 'Mykola',
      father_middle_name: 'Ivanovych',
      father_dob: '1958-07-22',
      father_city_of_birth: 'Lviv',
      mother_family_name: 'Kovalchuk',
      mother_given_name: 'Oksana',
      mother_middle_name: 'Mykhailivna',
      mother_dob: '1961-11-04',
      mother_city_of_birth: 'Lviv',

      // Part 6 — Marital status
      marital_status: 'Single',
      times_married: '0',

      // Part 7 — Biographic
      ethnicity: 'Not Hispanic or Latino',
      race: 'White',
      height_feet: '5',
      height_inches: '4',
      weight_hundreds: '',
      weight_tens: '2',
      weight_ones: '5',
      eye_color: 'Brown',
      hair_color: 'Brown',

      // Contact
      daytime_phone: { areaCode: '916', number: '5551234' },
      mobile_phone: { areaCode: '916', number: '5551234' },
      email_address: 'maria.kovalchuk@example.com'
    },
    contact: {
      name: 'Maria Kovalchuk',
      phone: '9165551234',
      email: 'maria.kovalchuk@example.com'
    }
  };
}

function main() {
  if (!fs.existsSync(SOURCE_PDF)) {
    console.error(`Source PDF not found: ${SOURCE_PDF}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const payload = samplePayload();
  const fieldValues = i485FieldValues(payload);
  const sourcePdf = fs.readFileSync(SOURCE_PDF);
  const result = incrementalFillPdf(sourcePdf, fieldValues);

  fs.writeFileSync(OUTPUT_PDF, result.buffer);

  const filledCount = result.filledFields.length;
  const skippedCount = result.skippedFields.length;

  console.log(`I-485 sample generated: ${OUTPUT_PDF}`);
  console.log(`  Filled fields : ${filledCount}`);
  console.log(`  Skipped fields: ${skippedCount}`);
  console.log(`  Output size   : ${result.buffer.length} bytes`);

  if (skippedCount > 0) {
    console.log('\nSkipped (not found in PDF):');
    for (const f of result.skippedFields) console.log(`  - ${f}`);
  }
}

main();
