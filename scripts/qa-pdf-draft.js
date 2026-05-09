#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const draft = require('../netlify/functions/pdf-draft');
const { parsePdf } = require('../netlify/functions/lib/pdf-incremental-fill');
const { i765FieldValues } = require('../netlify/functions/lib/i765-pdf-map');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_PDF = path.join(ROOT, 'assets/form-cache/pdfs/i-765.pdf');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function acroFormObject(parsed) {
  const root = parsed.trailer.root ? parsed.byObjectNumber.get(parsed.trailer.root.objectNumber) : null;
  const match = root?.body.match(/\/AcroForm\s+(\d+)\s+(\d+)\s+R/);
  return match ? parsed.byObjectNumber.get(Number(match[1])) : null;
}

function renderQuickLookSmoke(pdfPath) {
  const quickLook = '/usr/bin/qlmanage';
  if (!fs.existsSync(quickLook)) return;
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imverica-pdf-render-'));
  execFileSync(quickLook, ['-t', '-s', '900', '-o', outputDir, pdfPath], {
    cwd: ROOT,
    timeout: 15000,
    stdio: 'pipe'
  });
  const pngs = fs.readdirSync(outputDir).filter((file) => file.endsWith('.png'));
  assert(pngs.length > 0, 'draft should render a Quick Look PNG thumbnail');
  const png = fs.statSync(path.join(outputDir, pngs[0]));
  assert(png.size > 50000, 'draft Quick Look thumbnail should not be empty');
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
  const payload = sampleI765Payload();
  const fieldValues = i765FieldValues(payload);
  assert(!('Line1c_MiddleName[0]' in fieldValues), 'blank middle name should not be written');
  assert(fieldValues['Line2a_FamilyName[0]'] === 'N/A', 'no other names should write N/A');
  assert(fieldValues['Pt2Line5_AptSteFlrNumber[0]'] === '2', 'unit field should contain only the apartment number');
  assert(fieldValues['Line7_AlienNumber[0]'] === '123456789', 'A-number should keep all 9 digits after removing the A prefix');
  assert(fieldValues['Line12b_SSN[0]'] === '123456789', 'SSN should keep all 9 digits after removing hyphens');
  assert(fieldValues['Line8_ElisAccountNumber[0]'] === '123456789012', 'USCIS online account number should be digits only');
  assert(fieldValues['Line17a_CountryOfBirth[0]'] === 'Ukraine', 'first citizenship country should be filled');
  assert(!('Line17b_CountryOfBirth[0]' in fieldValues), 'second citizenship country should stay blank unless provided');
  assert(fieldValues['section_1[0]'] === 'c' && fieldValues['section_2[0]'] === '8', 'c08 should normalize to category (c)(8)');
  assert(!('section_3[0]' in fieldValues), 'c08 should not fill a third category segment');
  assert(fieldValues['PtLine29_YesNo[0]'] === false && fieldValues['PtLine29_YesNo[1]'] === true, 'c8 crime-history item 30 should select No');
  assert(fieldValues['Pt4Line1a_InterpreterFamilyName[0]'] === 'N/A', 'no interpreter should write N/A');
  assert(fieldValues['Pt5Line1a_PreparerFamilyName[0]'] === 'N/A', 'no preparer should write N/A');

  const response = await callDraft(payload);
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
  assert(/\/Type\s*\/XRef/.test(text.slice(-80000)), 'draft should append an incremental xref stream');
  assert(!/^<<>>\/MaxLen/m.test(text.slice(-60000)), 'draft should not corrupt field dictionaries');

  const parsedOutput = parsePdf(output);
  const acroForm = acroFormObject(parsedOutput);
  assert(acroForm && !/\/XFA\b/.test(acroForm.body), 'draft AcroForm should remove XFA so browser and mobile viewers use widget appearances');
  assert(/\/NeedAppearances\s+false/.test(acroForm.body), 'draft should rely on generated appearance streams');
  const birthCityField = parsedOutput.objects.filter((object) => object.objectNumber === 483).at(-1)?.body || '';
  const birthProvinceField = parsedOutput.objects.filter((object) => object.objectNumber === 484).at(-1)?.body || '';
  assert(/\/AP\s*<<\s*\/N\s+\d+\s+0\s+R\s*>>/.test(birthCityField), 'birth city field should include a visible appearance stream');
  assert(/\/AP\s*<<\s*\/N\s+\d+\s+0\s+R\s*>>/.test(birthProvinceField), 'birth province field should include a visible appearance stream');
  const tempPdfPath = path.join(os.tmpdir(), `imverica-i-765-draft-${Date.now()}.pdf`);
  fs.writeFileSync(tempPdfPath, output);
  renderQuickLookSmoke(tempPdfPath);

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
