#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const draft = require('../netlify/functions/pdf-draft');
const { parsePdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_PDF = path.join(ROOT, 'assets/form-cache/pdfs/i-765.pdf');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasXfaValue(xml, fieldName, value) {
  const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<${escapedField}\\s*>${escapedValue}</${escapedField}>`).test(xml);
}

async function callDraft(payload) {
  return await draft.handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function sampleI765Payload() {
  return {
    formCode: 'I-765',
    formAnswers: {
      i765_application_reason: 'Initial permission to accept employment',
      applicant_given_name: 'Ivan',
      applicant_family_name: 'Petrov',
      applicant_middle_name: 'A',
      date_of_birth: '1990-04-12',
      city_of_birth: 'Kyiv',
      state_or_province_of_birth: 'Kyiv Oblast',
      country_of_birth: 'Ukraine',
      country_of_citizenship: 'Ukraine',
      sex: 'Male',
      marital_status: 'Married',
      alien_number: 'A123456789',
      uscis_online_account_number: '123456789012',
      ssn: '123-45-6789',
      mailing_address_line1: '8305 Deer Spring Circle',
      mailing_address_line2: 'Apt 2',
      mailing_city: 'Antelope',
      mailing_state: 'CA - California',
      mailing_zip: '95843',
      physical_same_as_mailing: 'Yes',
      daytime_phone: {
        countryCode: '+1',
        areaCode: '916',
        number: '5551212'
      },
      email_address: 'ivan@example.com',
      current_immigration_status: 'Pending asylum',
      status_at_last_entry: 'Parolee',
      last_arrival_date: '2023-01-15',
      place_entry: 'San Francisco, CA',
      i94_number: '12345678901',
      passport_number: 'AB1234567',
      passport_country_of_issuance: 'Ukraine',
      passport_expiration: '2030-01-01',
      eligibility_category_code: '(c)(8)',
      prior_ead: 'No',
      applicant_statement: 'I can read and understand English',
      pending_application_receipt: 'IOE1234567890'
    },
    contact: {
      name: 'Ivan Petrov',
      phone: '+1 916 555 1212',
      email: 'ivan@example.com'
    }
  };
}

async function main() {
  const response = await callDraft(sampleI765Payload());
  assert(response.statusCode === 200, `expected 200, got ${response.statusCode}`);
  assert(response.isBase64Encoded === true, 'draft PDF response should be base64 encoded');
  assert(response.headers['Content-Type'] === 'application/pdf', 'draft should return application/pdf');
  assert(Number(response.headers['X-Imverica-Filled-Fields']) >= 25, 'draft should fill expected I-765 fields');
  assert(Number(response.headers['X-Imverica-Skipped-Fields']) === 0, 'draft should not skip mapped fields');

  const output = Buffer.from(response.body, 'base64');
  const source = fs.readFileSync(SOURCE_PDF);
  const text = output.toString('latin1');
  assert(output.subarray(0, 5).toString('latin1') === '%PDF-', 'draft should start with PDF signature');
  assert(output.length > source.length, 'draft should append an incremental PDF update');
  assert(/xref\s+\d+\s+\d+/.test(text.slice(-30000)), 'draft should include an incremental xref table');
  assert(/\/NeedAppearances true/.test(text.slice(-60000)), 'draft should request viewer-generated field appearances');
  assert(!/^<<>>\/MaxLen/m.test(text.slice(-60000)), 'draft should not corrupt field dictionaries');

  const parsedOutput = parsePdf(output);
  const datasets = parsedOutput.objects
    .filter((object) => object.objectNumber === 154 && object.source === 'inflated-stream')
    .at(-1)?.body || '';
  const template = parsedOutput.objects
    .filter((object) => object.objectNumber === 152 && object.source === 'inflated-stream')
    .at(-1)?.body || '';
  assert(hasXfaValue(datasets, 'Line1a_FamilyName', 'Petrov'), 'draft should fill XFA family name for visible PDF viewers');
  assert(hasXfaValue(datasets, 'Line1b_GivenName', 'Ivan'), 'draft should fill XFA given name for visible PDF viewers');
  assert(hasXfaValue(datasets, 'Line4b_StreetNumberName', '8305 Deer Spring Circle'), 'draft should fill XFA mailing street for visible PDF viewers');
  assert(hasXfaValue(datasets, 'Part1_Checkbox', '1'), 'draft should select I-765 initial permission reason');
  assert(hasXfaValue(datasets, 'Line18a_CityTownOfBirth', 'Kyiv'), 'draft should fill birth city');
  assert(hasXfaValue(datasets, 'Line18b_CityTownOfBirth', 'Kyiv Oblast'), 'draft should fill birth state/province');
  assert(hasXfaValue(datasets, 'Line18c_CountryOfBirth', 'Ukraine'), 'draft should fill birth country');
  assert(hasXfaValue(datasets, 'Line9_Checkbox', 'Y'), 'draft should select male sex');
  assert(hasXfaValue(datasets, 'Line10_Checkbox', 'Married'), 'draft should select married marital status');
  assert(hasXfaValue(datasets, 'Line20d_CountryOfIssuance', 'Ukraine'), 'draft should fill passport/travel document issuing country');
  assert(hasXfaValue(datasets, 'place_entry', 'San Francisco, CA'), 'draft should fill place of last U.S. arrival');
  assert(hasXfaValue(datasets, 'Pt3Line1Checkbox', 'A'), 'draft should select English applicant statement');
  assert(hasXfaValue(datasets, 'Pt3Line3_DaytimePhoneNumber1', '9165551212'), 'draft should normalize daytime phone to USCIS digits only');
  assert(hasXfaValue(datasets, 'Pt3Line4_MobileNumber1', '9165551212'), 'draft should normalize mobile phone to USCIS digits only');
  assert(!datasets.includes('+1 916'), 'draft should not write phone with country code or spaces');
  const birthCityField = parsedOutput.objects.filter((object) => object.objectNumber === 483).at(-1)?.body || '';
  const birthProvinceField = parsedOutput.objects.filter((object) => object.objectNumber === 484).at(-1)?.body || '';
  assert(/\/AP\s*<<\s*\/N\s+\d+\s+0\s+R\s*>>/.test(birthCityField), 'birth city field should include a visible appearance stream');
  assert(/\/AP\s*<<\s*\/N\s+\d+\s+0\s+R\s*>>/.test(birthProvinceField), 'birth province field should include a visible appearance stream');
  assert(/name="Line18a_CityTownOfBirth"[\s\S]*?<bind match="global"\/>/.test(template), 'birth city XFA template should bind to datasets');
  assert(/name="Line18b_CityTownOfBirth"[\s\S]*?<bind match="global"\/>/.test(template), 'birth province XFA template should bind to datasets');

  const missing = await callDraft({ formCode: 'I-765', formAnswers: {} });
  assert(missing.statusCode === 422, `missing required fields expected 422, got ${missing.statusCode}`);
  const missingBody = JSON.parse(missing.body || '{}');
  assert(missingBody.fields.includes('applicant_given_name'), 'missing validation should list applicant_given_name');

  const unsupported = await callDraft({ formCode: 'I-485', formAnswers: {} });
  assert(unsupported.statusCode === 422, `unsupported form expected 422, got ${unsupported.statusCode}`);

  console.log(`PDF draft QA passed: ${response.headers['X-Imverica-Filled-Fields']} I-765 fields filled, output ${output.length} bytes`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
