const fs = require('fs');
const path = require('path');
const { i485FieldValues, i485TextOverlays } = require('../netlify/functions/lib/i485-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const ROOT = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const formAnswers = {
  applicant_given_name: 'Yana',
  applicant_family_name: 'Hovdan',
  date_of_birth: '1990-01-19',
  city_of_birth: 'Mykolaiv',
  country_of_birth: 'Ukraine',
  country_of_citizenship: 'Ukraine',
  sex: 'Female',
  marital_status: 'Divorced',
  alien_number: 'A208924970',
  uscis_online_account_number: '123456789012',

  mailing_address_line1: '15 164 ST SW',
  mailing_address_line2: 'Apt B35',
  mailing_city: 'Bothell',
  mailing_state: 'WA - Washington',
  mailing_zip: '98012',
  physical_same_as_mailing: 'Yes',
  date_moved_in: '2025-02-15',
  daytime_phone: { countryCode: '+1', areaCode: '253', number: '4097210' },
  email_address: 'yana@example.com',

  admission_basis: 'Paroled',
  paroled_as: 'PAROLED',
  date_of_last_entry: '2016-02-29',
  manner_of_last_entry: 'ASYLEE',
  current_immigration_status: 'ASYLEE',
  authorized_stay_expires: 'D/S',
  status_expiration_date: 'D/S',
  visa_number: 'N/A',
  last_arrival_date: '2016-02-29',
  place_entry: 'San Ysidro, CA',
  i94_number: '77692068933',
  passport_number: 'FE079723',
  passport_country_of_issuance: 'Ukraine',
  passport_expiration: '2026-01-19',

  same_address_five_years: 'No',
  prior_us_addresses: [
    {
      from: '2021-01-01',
      to: '2025-02-14',
      line1: '14919 41st Ave',
      line2: 'Apt C3',
      city: 'Bothell',
      state: 'WA',
      zip: '98012',
      country: 'United States'
    }
  ],
  last_foreign_address: [
    {
      from: '2010-02-05',
      to: '2016-02-21',
      line1: 'Volodarskogo 80',
      city: 'Mykolaiv',
      state: 'Mykolaiv Oblast',
      country: 'Ukraine'
    }
  ],
  has_ssn: 'Yes',
  ssn: '671842359',
  ssn_ssa_consent: 'No',

  petition_previously_filed: 'No',
  concurrent_filing: 'No',
  eligibility_basis: 'asylee',
  currently_working: 'Yes',
  worked_without_authorization: 'No',
  current_employment_history: [
    {
      from: '2024-10-01',
      name: 'DELUX DELIVERY LLC',
      occupation: 'SELF-EMPLOYED DRIVER'
    }
  ],
  foreign_employment_history: [
    {
      from: '2015-10-22',
      to: '2016-02-19',
      name: 'TRUCKING COMPANY',
      occupation: 'ACCOUNTANT'
    }
  ],

  father_family_name: 'SERHIEIEV',
  father_given_name: 'OLEKSY',
  father_dob: '1965-11-27',
  father_city_of_birth: 'Ukraine',
  mother_family_name: 'SERHIEIEVA',
  mother_given_name: 'IRYNA',
  mother_birth_family_name: 'IVANTSOVA',
  mother_birth_given_name: 'IRYNA',
  mother_dob: '1970-06-04',
  mother_city_of_birth: 'Ukraine',

  times_married: '1',
  spouse_family_name: 'NONE',
  prior_spouse_family_name: 'HOVDAN',
  prior_spouse_given_name: 'VOLODYMYR',
  prior_spouse_dob: '1986-09-19',
  prior_spouse_country_of_birth: 'Ukraine',
  prior_spouse_country_of_citizenship: 'Ukraine',
  prior_spouse_marriage_date: '2007-09-28',
  prior_spouse_marriage_city: 'Malolepetykha Village',
  prior_spouse_marriage_state: 'Velyka Lepetykha District Kherson Oblast',
  prior_spouse_marriage_country: 'Ukraine',
  prior_spouse_marriage_end_city: 'Velyka Lepetykha District',
  prior_spouse_marriage_end_state: 'Kherson Oblast',
  prior_spouse_marriage_end_country: 'Ukraine',
  prior_spouse_marriage_end_date: '2010-04-27',
  prior_spouse_marriage_end_type: 'Divorced',

  total_children: '1',
  child1_family_name: 'HOVDAN',
  child1_given_name: 'ANASTASIIA',
  child1_alien_number: '208924971',
  child1_dob: '2008-04-18',
  child1_country_of_birth: 'Ukraine',
  child1_relationship: 'BIOLOGICAL CHILD',
  child1_applying_with_you: 'No',
  child2_family_name: 'NOT APPLICABLE',

  ethnicity: 'Not Hispanic or Latino',
  race: ['White'],
  height_feet: '5',
  height_inches: '4',
  weight_lbs: '135',
  eye_color: 'Brown',
  hair_color: 'Brown',

  Pt9Line10_YesNo: 'No',
  Pt9Line11_YesNo: 'No',
  Pt9Line12_YesNo: 'No',
  Pt9Line63_YesNo: 'Yes'
};

const payload = {
  formCode: 'I-485',
  formAnswers,
  contact: {
    name: 'Yana Hovdan',
    phone: '+1 253 409 7210',
    email: 'yana@example.com'
  }
};

const values = i485FieldValues(payload);
const overlays = i485TextOverlays(payload);

assert(Object.keys(values).length >= 175, `expected at least 175 fields from frontend I-485 intake, got ${Object.keys(values).length}`);
assert(overlays.length >= 7, `expected at least 7 text overlays from frontend I-485 intake, got ${overlays.length}`);

assertEqual(values['Pt1Line1_FamilyName[0]'], 'Hovdan', 'applicant family name');
assertEqual(values['Pt1Line6_CB_Sex[0]'], true, 'female checkbox');
assertEqual(values['Pt6Line1_MaritalStatus[0]'], true, 'divorced checkbox uses PDF value 0');
assertEqual(values['P1Line12_I94[0]'], '77692068933', 'I-94 number');
assertEqual(values['Pt1Line10_CityTown[0]'], 'San Ysidro', 'place entry city split');
assertEqual(values['Pt1Line10_State[0]'], 'CA', 'place entry state split');
assertEqual(values['Pt1Line18_YN[0]'], true, 'physical address same as mailing: yes');
assertEqual(values['Pt1Line18_last5yrs_YN[1]'], true, 'same address five years: no');
assertEqual(values['Pt1Line19_YN[1]'], true, 'has SSN checkbox uses PDF yes value');
assertEqual(values['Pt1Line19_SSN[0]'], '671842359', 'SSN digits');
assertEqual(values['Pt4Line5_YN[1]'], true, 'currently working yes');
assertEqual(values['Pt4Line6_YN[0]'], true, 'unauthorized work no');
assertEqual(values['Pt7Line2_Race[4]'], true, 'race white checkbox');
assertEqual(values['Pt7Line5_Eyecolor[2]'], true, 'brown eye color checkbox');
assertEqual(values['Pt7Line6_Haircolor[3]'], true, 'brown hair color checkbox');
assertEqual(values['Pt9Line10_YesNo[0]'], true, 'Part 9 No maps to PDF no option');
assertEqual(values['Pt9Line10_YesNo[1]'], false, 'Part 9 No unsets yes option');
assertEqual(values['Pt9Line63_YesNo[1]'], true, 'Part 9 Yes maps to PDF yes option');

const inputPdf = fs.readFileSync(path.join(ROOT, 'assets/form-cache/pdfs/i-485.pdf'));
const result = incrementalFillPdf(inputPdf, values, overlays);
assert(result.filledFields.length >= 175, `expected at least 175 I-485 fields filled, got ${result.filledFields.length}`);
assertEqual(result.skippedFields.length, 0, 'frontend I-485 intake should not skip mapped fields');

console.log(JSON.stringify({
  ok: true,
  mappedFields: Object.keys(values).length,
  filledFields: result.filledFields.length,
  overlayFields: overlays.length,
  skippedFields: result.skippedFields.length
}, null, 2));
