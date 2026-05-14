#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const generatePdf = require('../netlify/functions/generate-pdf');
const { i485FieldValues, i485TextOverlays } = require('../netlify/functions/lib/i485-pdf-map');
const { i765FieldValues } = require('../netlify/functions/lib/i765-pdf-map');
const { parsePdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const ROOT = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function acroFormObject(parsed) {
  const root = parsed.trailer.root ? parsed.byObjectNumber.get(parsed.trailer.root.objectNumber) : null;
  const match = root?.body.match(/\/AcroForm\s+(\d+)\s+(\d+)\s+R/);
  return match ? parsed.byObjectNumber.get(Number(match[1])) : null;
}

async function callGeneratePdf(payload) {
  return await generatePdf.handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function assertPdfResponse(response, formCode, sourcePdfName) {
  assert(response.statusCode === 200, `${formCode} expected 200, got ${response.statusCode}`);
  assert(response.isBase64Encoded === true, `${formCode} should return a base64 PDF`);
  assert(response.headers['Content-Type'] === 'application/pdf', `${formCode} should return application/pdf`);

  const output = Buffer.from(response.body, 'base64');
  const source = fs.readFileSync(path.join(ROOT, 'assets/form-cache/pdfs', sourcePdfName));
  const tail = output.toString('latin1').slice(-100000);

  assert(output.subarray(0, 5).toString('latin1') === '%PDF-', `${formCode} output should start with PDF signature`);
  assert(output.length > source.length, `${formCode} output should append an incremental update`);
  assert(/\/Type\s*\/XRef/.test(tail), `${formCode} output should include an incremental xref stream`);
  assert(!/^<<>>\/MaxLen/m.test(tail), `${formCode} output should not corrupt field dictionaries`);

  const parsed = parsePdf(output);
  const acroForm = acroFormObject(parsed);
  assert(acroForm && !/\/XFA\b/.test(acroForm.body), `${formCode} AcroForm should not contain XFA`);
  assert(/\/NeedAppearances\s+false/.test(acroForm.body), `${formCode} should use generated appearances`);

  return output.length;
}

function i765Payload() {
  return {
    formCode: 'I-765',
    formAnswers: {
      i765_application_reason: 'Initial permission to accept employment',
      applicant_given_name: 'Ivan',
      applicant_family_name: 'Petrov',
      other_names_used: 'No',
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
      eligibility_category_code: 'c08',
      c8_arrested_or_convicted: 'No',
      prior_ead: 'No',
      applicant_statement: 'I can read and understand English',
      pending_application_receipt: 'IOE1234567890',
      interpreter_or_preparer_needed: 'No',
      has_interpreter: 'No',
      has_preparer: 'No'
    },
    contact: {
      name: 'Ivan Petrov',
      phone: '+1 916 555 1212',
      email: 'ivan@example.com'
    }
  };
}

async function main() {
  const scenario = require('../form-scenarios/i-485-asylee.json');
  const i485Payload = {
    formCode: 'I-485',
    formAnswers: scenario.fields,
    contact: {}
  };

  const i485Values = i485FieldValues(i485Payload);
  const i485Overlays = i485TextOverlays(i485Payload);
  assert(Object.keys(i485Values).length >= 400, `I-485 endpoint payload should map at least 400 fields, got ${Object.keys(i485Values).length}`);
  assert(i485Overlays.length >= 13, `I-485 endpoint payload should map at least 13 overlays, got ${i485Overlays.length}`);

  const i485Response = await callGeneratePdf(i485Payload);
  const i485Bytes = assertPdfResponse(i485Response, 'I-485', 'i-485.pdf');

  const i765 = i765Payload();
  const i765Values = i765FieldValues(i765);
  assert(Object.keys(i765Values).length >= 50, `I-765 endpoint payload should map at least 50 fields, got ${Object.keys(i765Values).length}`);

  const i765Response = await callGeneratePdf(i765);
  const i765Bytes = assertPdfResponse(i765Response, 'I-765', 'i-765.pdf');

  const supportingForms = [
    {
      formCode: 'AR-11',
      pdfName: 'ar-11.pdf',
      minimumBytes: 100000,
      payload: {
        formCode: 'AR-11',
        formAnswers: {
          applicant_given_name: 'Yana',
          applicant_family_name: 'Hovdan',
          date_of_birth: '1990-01-19',
          alien_number: 'A208924970',
          previous_address_line1: '14919 41st Ave',
          previous_unit_type: 'Apt',
          previous_address_unit: 'C3',
          previous_city: 'Bothell',
          previous_state: 'WA',
          previous_zip: '98012',
          present_address_line1: '15 164 ST SW',
          present_unit_type: 'Apt',
          present_address_unit: 'B35',
          present_city: 'Bothell',
          present_state: 'WA',
          present_zip: '98012',
          mailing_address_line1: '15 164 ST SW',
          mailing_unit_type: 'Apt',
          mailing_address_unit: 'B35',
          mailing_city: 'Bothell',
          mailing_state: 'WA',
          mailing_zip: '98012'
        },
        contact: { name: 'Yana Hovdan' }
      }
    },
    {
      formCode: 'G-1145',
      pdfName: 'g-1145.pdf',
      minimumBytes: 50000,
      payload: {
        formCode: 'G-1145',
        formAnswers: {
          daytime_phone: { countryCode: '+1', areaCode: '253', number: '4097210' },
          email_address: 'yana@example.com'
        },
        contact: {
          phone: '+1 253 409 7210',
          email: 'yana@example.com'
        }
      }
    },
    {
      formCode: 'G-1450',
      pdfName: 'g-1450.pdf',
      minimumBytes: 50000,
      payload: {
        formCode: 'G-1450',
        formAnswers: {
          email_address: 'payer@example.com'
        },
        contact: {
          email: 'payer@example.com'
        }
      }
    }
  ];

  const supportingResults = {};
  for (const form of supportingForms) {
    const response = await callGeneratePdf(form.payload);
    const bytes = assertPdfResponse(response, form.formCode, form.pdfName);
    assert(bytes > form.minimumBytes, `${form.formCode} generated PDF should not be suspiciously small`);
    supportingResults[form.formCode] = { bytes };
  }

  console.log(JSON.stringify({
    ok: true,
    forms: {
      'I-485': {
        mappedFields: Object.keys(i485Values).length,
        overlays: i485Overlays.length,
        bytes: i485Bytes
      },
      'I-765': {
        mappedFields: Object.keys(i765Values).length,
        bytes: i765Bytes
      },
      ...supportingResults
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
