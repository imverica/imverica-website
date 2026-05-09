#!/usr/bin/env node
'use strict';
/**
 * Generates sample PDFs for every immigration form using fictional test data.
 * Output goes to generated-samples/.
 */

const fs = require('fs');
const path = require('path');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const PDF_DIR = path.resolve(__dirname, '../assets/form-cache/pdfs');
const LIB_DIR = path.resolve(__dirname, '../netlify/functions/lib');
const OUT_DIR = path.resolve(__dirname, '../generated-samples');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function req(filename) {
  const mod = require(path.join(LIB_DIR, filename));
  return Object.values(mod).find(v => typeof v === 'function');
}

// Fictional test applicant — Maria Gonzalez
const payload = {
  contact: { name: 'Maria Gonzalez', phone: '3105550189', email: 'maria.gonzalez@example.com' },
  formAnswers: {
    applicant_family_name: 'Gonzalez',
    applicant_given_name: 'Maria',
    applicant_middle_name: 'Elena',
    date_of_birth: '1988-03-15',
    sex: 'female',
    gender: 'female',
    marital_status: 'married',
    alien_number: '123456789',
    a_number: '123456789',
    uscis_online_account_number: '000123456789',
    ssn: '555001234',
    country_of_birth: 'Mexico',
    city_of_birth: 'Guadalajara',
    place_of_birth_city: 'Guadalajara',
    country_of_citizenship: 'Mexico',
    mailing_address_line1: '742 Evergreen Terrace',
    mailing_address_line2: 'Apt 3B',
    mailing_city: 'Springfield',
    mailing_state: 'IL',
    mailing_zip: '62701',
    current_address_line1: '742 Evergreen Terrace',
    current_city: 'Springfield',
    current_state: 'IL',
    current_zip: '62701',
    physical_address_line1: '742 Evergreen Terrace',
    physical_city: 'Springfield',
    physical_state: 'IL',
    physical_zip: '62701',
    address_line1: '742 Evergreen Terrace',
    address_unit: 'Apt 3B',
    city: 'Springfield',
    state: 'IL',
    zip_code: '62701',
    daytime_phone: '3105550189',
    phone: '3105550189',
    mobile_phone: '3105550189',
    email_address: 'maria.gonzalez@example.com',
    email: 'maria.gonzalez@example.com',
    passport_number: 'G12345678',
    passport_expiration: '2029-06-30',
    passport_country_of_issuance: 'Mexico',
    i94_number: '12345678901',
    date_of_arrival: '2019-08-22',
    last_arrival_date: '2019-08-22',
    date_of_last_entry: '2019-08-22',
    place_entry: 'Los Angeles, CA',
    port_of_entry_city: 'Los Angeles',
    port_of_entry_state: 'CA',
    visa_number: 'F1234567',
    status_at_last_entry: 'F-1',
    current_immigration_status: 'F-1',
    manner_of_last_entry: 'Air',
    status_expiration_date: 'D/S',
    authorized_stay_expires: 'D/S',
    admission_basis: 'nonimmigrant',
    paroled_as: '',
    eligibility_category_code: '(c)(3)(A)',
    eligibility_basis: 'asylee',
    i765_application_reason: 'initial',
    prior_ead: 'no',
    // Family
    father_family_name: 'Gonzalez',
    father_given_name: 'Carlos',
    father_middle_name: 'Antonio',
    father_dob: '1960-07-04',
    father_city_of_birth: 'Guadalajara',
    mother_family_name: 'Rodriguez',
    mother_given_name: 'Ana',
    mother_middle_name: 'Lucia',
    mother_dob: '1963-11-20',
    mother_city_of_birth: 'Guadalajara',
    spouse_family_name: 'Lopez',
    spouse_given_name: 'Juan',
    spouse_middle_name: 'Carlos',
    spouse_alien_number: '987654321',
    times_married: '1',
    // Physical/biographic
    height_feet: '5',
    height_inches: '6',
    weight_hundreds: '1',
    weight_tens: '3',
    weight_ones: '5',
    ethnicity: 'Hispanic/Latino',
    race: 'White',
    eye_color: 'brown',
    hair_color: 'brown',
    // Support / sponsorship
    sponsor_family_name: 'Gonzalez',
    sponsor_given_name: 'Carlos',
    sponsor_relationship: 'Father',
    sponsor_annual_income: '55000',
    household_size: '3',
    // Work / employer
    employer_name: 'Acme Corp',
    occupation: 'Engineer',
    currently_working: 'yes',
    worked_without_authorization: 'no',
    // Petition / beneficiary
    petition_previously_filed: 'no',
    petition_receipt_number: '',
    petition_date: '',
    petitioner_family_name: 'Gonzalez',
    petitioner_given_name: 'Carlos',
    petitioner_alien_number: '',
    petitioner_citizen: 'yes',
    beneficiary_family_name: 'Gonzalez',
    beneficiary_given_name: 'Maria',
    relationship_to_petitioner: 'Child',
    concurrent_filing: 'no',
    // Yes/no questions — safe defaults
    has_ssn: 'yes',
    ssn_ssa_consent: 'yes',
    in_removal_proceedings: 'no',
    prior_removal_order: 'no',
    ever_removed_excluded: 'no',
    same_address_five_years: 'yes',
    other_dob_used: 'no',
    has_prior_alien_number: 'no',
    physical_same_as_mailing: 'yes',
    petition_previously_filed: 'no',
    // Other names
    other_names_used: 'N/A',
    other_name_family: '',
    other_name_given: '',
    other_name_middle: '',
    safe_family_name: '',
    safe_given_name: '',
    safe_middle_name: '',
    // Interpreter/preparer
    interpreter_family_name: 'N/A',
    interpreter_given_name: 'N/A',
    interpreter_org_name: 'N/A',
    interpreter_language: 'Spanish',
    interpreter_or_preparer_needed: 'no',
    has_interpreter: 'no',
    has_preparer: 'no',
    preparer_family_name: 'N/A',
    preparer_given_name: 'N/A',
    preparer_business_name: 'N/A',
    applicant_statement: 'read English',
    // G-28 specific
    attorney_family_name: 'Smith',
    attorney_given_name: 'John',
    // Adoption / children
    child_family_name: 'Gonzalez',
    child_given_name: 'Sofia',
    child_dob: '2010-05-01',
    child_country_of_birth: 'Mexico',
    // Medical
    civil_surgeon_name: 'Dr. James Wilson',
    exam_date: '2024-01-15',
    // Travel
    travel_document_type: 'advance parole',
    // Entrepreneur
    startup_name: 'TechStart Inc',
    ein: '123456789',
    // N-400 specific
    date_became_permanent_resident: '2020-05-01',
    continuous_residence_start: '2019-08-22',
    // I-864
    petitioner_domicile: 'yes',
    // Prior alien numbers
    prior_alien_number_1: '',
    prior_alien_number_2: '',
    // In-care-of
    in_care_of_name: '',
    date_moved_in: '2019-09-01',
  }
};

// [formCode, pdfSlug, mapFile]
const FORMS = [
  ['AR-11', 'ar-11', 'ar11-pdf-map'],
  ['G-28', 'g-28', 'g28-pdf-map'],
  ['G-28I', 'g-28i', 'g28i-pdf-map'],
  ['G-325A', 'g-325a', 'g325a-pdf-map'],
  ['G-639', 'g-639', 'g639-pdf-map'],
  ['G-845', 'g-845', 'g845-pdf-map'],
  ['G-845 Supplement', 'g-845-supplement', 'g845s-pdf-map'],
  ['G-884', 'g-884', 'g884-pdf-map'],
  ['G-1041', 'g-1041', 'g1041-pdf-map'],
  ['G-1041A', 'g-1041a', 'g1041a-pdf-map'],
  ['G-1055', 'g-1055', 'g1055-pdf-map'],
  ['G-1145', 'g-1145', 'g1145-pdf-map'],
  ['G-1256', 'g-1256', 'g1256-pdf-map'],
  ['G-1450', 'g-1450', 'g1450-pdf-map'],
  ['G-1566', 'g-1566', 'g1566-pdf-map'],
  ['G-1650', 'g-1650', 'g1650-pdf-map'],
  ['I-9', 'i-9', 'i9-pdf-map'],
  ['I-90', 'i-90', 'i90-pdf-map'],
  ['I-102', 'i-102', 'i102-pdf-map'],
  ['I-129', 'i-129', 'i129-pdf-map'],
  ['I-129CWR', 'i-129cwr', 'i129cwr-pdf-map'],
  ['I-129F', 'i-129f', 'i129f-pdf-map'],
  ['I-129S', 'i-129s', 'i129s-pdf-map'],
  ['I-130', 'i-130', 'i130-pdf-map'],
  ['I-130A', 'i-130a', 'i130a-pdf-map'],
  ['I-131', 'i-131', 'i131-pdf-map'],
  ['I-131A', 'i-131a', 'i131a-pdf-map'],
  ['I-134', 'i-134', 'i134-pdf-map'],
  ['I-134A', 'i-134a', 'i134a-pdf-map'],
  ['I-140', 'i-140', 'i140-pdf-map'],
  ['I-191', 'i-191', 'i191-pdf-map'],
  ['I-192', 'i-192', 'i192-pdf-map'],
  ['I-193', 'i-193', 'i193-pdf-map'],
  ['I-212', 'i-212', 'i212-pdf-map'],
  ['I-290B', 'i-290b', 'i290b-pdf-map'],
  ['I-360', 'i-360', 'i360-pdf-map'],
  ['I-361', 'i-361', 'i361-pdf-map'],
  ['I-363', 'i-363', 'i363-pdf-map'],
  ['I-407', 'i-407', 'i407-pdf-map'],
  ['I-485', 'i-485', 'i485-pdf-map'],
  ['I-485 Supplement A', 'i-485-supplement-a', 'i485a-pdf-map'],
  ['I-485 Supplement J', 'i-485-supplement-j', 'i485j-pdf-map'],
  ['I-508', 'i-508', 'i508-pdf-map'],
  ['I-526', 'i-526', 'i526-pdf-map'],
  ['I-526E', 'i-526e', 'i526e-pdf-map'],
  ['I-539', 'i-539', 'i539-pdf-map'],
  ['I-539A', 'i-539a', 'i539a-pdf-map'],
  ['I-589', 'i-589', 'i589-pdf-map'],
  ['I-590', 'i-590', 'i590-pdf-map'],
  ['I-600', 'i-600', 'i600-pdf-map'],
  ['I-600A', 'i-600a', 'i600a-pdf-map'],
  ['I-601', 'i-601', 'i601-pdf-map'],
  ['I-601A', 'i-601a', 'i601a-pdf-map'],
  ['I-602', 'i-602', 'i602-pdf-map'],
  ['I-612', 'i-612', 'i612-pdf-map'],
  ['I-687', 'i-687', 'i687-pdf-map'],
  ['I-690', 'i-690', 'i690-pdf-map'],
  ['I-693', 'i-693', 'i693-pdf-map'],
  ['I-694', 'i-694', 'i694-pdf-map'],
  ['I-698', 'i-698', 'i698-pdf-map'],
  ['I-730', 'i-730', 'i730-pdf-map'],
  ['I-751', 'i-751', 'i751-pdf-map'],
  ['I-765', 'i-765', 'i765-pdf-map'],
  ['I-765V', 'i-765v', 'i765v-pdf-map'],
  ['I-800', 'i-800', 'i800-pdf-map'],
  ['I-800A', 'i-800a', 'i800a-pdf-map'],
  ['I-817', 'i-817', 'i817-pdf-map'],
  ['I-821', 'i-821', 'i821-pdf-map'],
  ['I-821D', 'i-821d', 'i821d-pdf-map'],
  ['I-824', 'i-824', 'i824-pdf-map'],
  ['I-829', 'i-829', 'i829-pdf-map'],
  ['I-864', 'i-864', 'i864-pdf-map'],
  ['I-864A', 'i-864a', 'i864a-pdf-map'],
  ['I-864EZ', 'i-864ez', 'i864ez-pdf-map'],
  ['I-865', 'i-865', 'i865-pdf-map'],
  ['I-881', 'i-881', 'i881-pdf-map'],
  ['I-907', 'i-907', 'i907-pdf-map'],
  ['I-912', 'i-912', 'i912-pdf-map'],
  ['I-914', 'i-914', 'i914-pdf-map'],
  ['I-918', 'i-918', 'i918-pdf-map'],
  ['I-929', 'i-929', 'i929-pdf-map'],
  ['I-941', 'i-941', 'i941-pdf-map'],
  ['I-942', 'i-942', 'i942-pdf-map'],
  ['I-956', 'i-956', 'i956-pdf-map'],
  ['I-956F', 'i-956f', 'i956f-pdf-map'],
  ['I-956G', 'i-956g', 'i956g-pdf-map'],
  ['I-956H', 'i-956h', 'i956h-pdf-map'],
  ['I-956K', 'i-956k', 'i956k-pdf-map'],
  ['N-300', 'n-300', 'n300-pdf-map'],
  ['N-336', 'n-336', 'n336-pdf-map'],
  ['N-400', 'n-400', 'n400-pdf-map'],
  ['N-470', 'n-470', 'n470-pdf-map'],
  ['N-565', 'n-565', 'n565-pdf-map'],
  ['N-600', 'n-600', 'n600-pdf-map'],
  ['N-600K', 'n-600k', 'n600k-pdf-map'],
  ['N-648', 'n-648', 'n648-pdf-map'],
];

let ok = 0;
let fail = 0;

for (const [code, slug, mapFile] of FORMS) {
  const pdfPath = path.join(PDF_DIR, `${slug}.pdf`);
  if (!fs.existsSync(pdfPath)) {
    console.log(`SKIP ${code}: PDF not found`);
    continue;
  }

  try {
    const fn = req(`${mapFile}.js`);
    if (!fn) throw new Error(`No function exported from ${mapFile}`);

    const pdfBuf = fs.readFileSync(pdfPath);
    const fieldValues = fn(payload);
    const result = incrementalFillPdf(pdfBuf, fieldValues);
    const outSlug = slug.replace(/\//g, '-');
    const outPath = path.join(OUT_DIR, `sample-${outSlug}.pdf`);
    fs.writeFileSync(outPath, result.buffer);
    console.log(`OK  ${code}: ${result.filledFields.length} filled, ${result.skippedFields.length} skipped`);
    ok++;
  } catch (err) {
    console.error(`ERR ${code}: ${err.message}`);
    fail++;
  }
}

console.log(`\nDone: ${ok} generated, ${fail} failed`);
