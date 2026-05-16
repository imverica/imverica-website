const fs = require('fs');
const path = require('path');
const flow = require('../netlify/functions/immigration-flow');

const ROOT = path.resolve(__dirname, '..');

async function callFlow(code, lang = 'en') {
  const response = await flow.handler({
    httpMethod: 'GET',
    queryStringParameters: { code, lang },
    headers: {}
  });

  let body = {};
  try {
    body = JSON.parse(response.body || '{}');
  } catch (err) {
    throw new Error(`${code}: response body is not JSON`);
  }

  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function syntaxCheckInlineScripts() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((script) => script.trim());

  scripts.forEach((script, index) => {
    try {
      new Function(script);
    } catch (err) {
      throw new Error(`index.html inline script ${index + 1}: ${err.message}`);
    }
  });

  return scripts.length;
}

async function main() {
  const codes = ['I-765', 'I-485', 'I-130', 'I-131', 'I-589', 'I-864', 'I-912', 'N-400', 'AR-11'];

  for (const code of codes) {
    const { response, body } = await callFlow(code);
    assert(response.statusCode === 200, `${code}: expected 200, got ${response.statusCode}`);
    assert(body.ok === true, `${code}: expected ok true`);
    assert(body.code === code, `${code}: code mismatch`);
    assert(body.schemaVersion, `${code}: missing schemaVersion`);
    assert(Array.isArray(body.steps) && body.steps.length >= 5, `${code}: missing schema steps`);
    assert(body.steps.every((step) => Array.isArray(step.fields) && step.fields.length), `${code}: every step must have fields`);
    assert(body.official && typeof body.official === 'object', `${code}: missing official summary`);
    console.log(`${code}: ${body.steps.length} steps, official status ${body.official.status || 'unknown'}`);
  }

  const invalid = await callFlow('NOPE-999');
  assert(invalid.response.statusCode === 404, `invalid code: expected 404, got ${invalid.response.statusCode}`);

  const localized = await callFlow('I-765', 'ru');
  assert(/Назначение формы|Основание/.test(localized.body.steps[0].title + localized.body.steps[1].title), 'ru localization missing for I-765 flow');

  const i765Address = localized.body.steps.find((step) => step.id === 'address_contact');
  assert(i765Address, 'I-765: missing address/contact step');
  const mailingAddress = i765Address.fields.find((field) => field.id === 'mailing_address');
  const daytimePhone = localized.body.steps.find((step) => step.id === 'contact_info')?.fields.find((field) => field.id === 'daytime_phone');
  assert(mailingAddress?.type === 'addressBlock', 'I-765: mailing address should use structured address block');
  assert(mailingAddress?.parts?.state === 'mailing_state', 'I-765: address block should map mailing state key');
  assert(mailingAddress?.stateOptions?.includes('CA - California'), 'I-765: state select should include California');
  assert(mailingAddress?.stateOptions?.includes('PR - Puerto Rico'), 'I-765: state select should include territories');
  assert(daytimePhone?.type === 'phone', 'I-765: phone should be split phone field');
  const i765Category = localized.body.steps.find((step) => step.id === 'i765_eligibility_category');
  assert(i765Category?.fields.some((field) => field.id === 'c8_arrested_or_convicted'), 'I-765: missing c8 arrest/conviction question');
  const i765Order = localized.body.steps.map((step) => step.id);
  assert(i765Order.indexOf('i765_application_reason') < i765Order.indexOf('applicant'), 'I-765: reason for applying should come before applicant fields');
  assert(i765Order.indexOf('applicant') < i765Order.indexOf('i765_work_permit_basis'), 'I-765: applicant fields should come before eligibility-category questions');
  assert(i765Order.indexOf('i765_eligibility_category') < i765Order.indexOf('i765_applicant_statement'), 'I-765: eligibility category should come before applicant statement');
  assert(i765Order.indexOf('i765_applicant_statement') < i765Order.indexOf('contact_info'), 'I-765: applicant statement should come before contact info');
  const i765Evidence = localized.body.steps.find((step) => step.id === 'documents_interpreter_choice');
  assert(i765Evidence?.fields.some((field) => field.id === 'has_interpreter'), 'I-765: missing interpreter question');
  assert(i765Evidence?.fields.some((field) => field.id === 'has_preparer'), 'I-765: missing preparer question');

  const n400 = await callFlow('N-400', 'ru');
  const n400Order = n400.body.steps.map((step) => step.id);
  assert(n400Order.indexOf('n400_eligibility_basis') < n400Order.indexOf('n400_legal_name'), 'N-400: eligibility must come before applicant name');
  assert(n400Order.indexOf('n400_legal_name') < n400Order.indexOf('n400_biographic_ethnicity_race'), 'N-400: applicant identity must come before biographic fields');
  assert(n400Order.indexOf('n400_biographic_colors') < n400Order.indexOf('n400_current_address'), 'N-400: biographic fields must come before residence fields');
  assert(n400Order.indexOf('n400_address_history') < n400Order.indexOf('n400_employment_history'), 'N-400: address history must come before employment history');
  assert(n400Order.indexOf('n400_employment_history') < n400Order.indexOf('n400_trips_outside_us'), 'N-400: employment history must come before travel history');
  assert(n400Order.indexOf('n400_trips_outside_us') < n400Order.indexOf('n400_citizenship_voting'), 'N-400: travel history must come before Part 9 eligibility questions');
  assert(n400Order.indexOf('n400_oath_questions') < n400Order.indexOf('n400_applicant_contact'), 'N-400: oath questions must come before applicant contact');
  const n400Fields = n400.body.steps.flatMap((step) => step.fields || []);
  assert(n400Fields.find((field) => field.id === 'addresses_last_five_years')?.type === 'addressHistory', 'N-400: address history should be structured');
  assert(n400Fields.find((field) => field.id === 'employment_school_last_five_years')?.type === 'employmentHistory', 'N-400: employment history should be structured');
  assert(n400Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'N-400: daytime phone should be split phone field');

  const i130a = await callFlow('I-130A', 'en');
  const i130 = await callFlow('I-130', 'en');
  const i130Order = i130.body.steps.map((step) => step.id);
  assert(i130Order.indexOf('i130_relationship') < i130Order.indexOf('i130_petitioner_numbers'), 'I-130: relationship must come before petitioner details');
  assert(i130Order.indexOf('i130_petitioner_numbers') < i130Order.indexOf('i130_beneficiary_numbers'), 'I-130: petitioner details must come before beneficiary details');
  assert(i130Order.indexOf('i130_beneficiary_numbers') < i130Order.indexOf('i130_petitioner_statement'), 'I-130: beneficiary details must come before petitioner statement');
  const i130Fields = i130.body.steps.flatMap((step) => step.fields || []);
  assert(i130Fields.find((field) => field.id === 'petitioner_mailing_address')?.type === 'addressBlock', 'I-130: petitioner mailing address should be structured');
  assert(i130Fields.find((field) => field.id === 'beneficiary_current_address')?.type === 'addressBlock', 'I-130: beneficiary current address should be structured');

  const i130aOrder = i130a.body.steps.map((step) => step.id);
  assert(i130aOrder.indexOf('i130a_spouse_numbers') < i130aOrder.indexOf('i130a_spouse_current_address'), 'I-130A: spouse identity must come before address history');
  assert(i130aOrder.indexOf('i130a_spouse_prior_address_1') < i130aOrder.indexOf('i130a_spouse_birth_sex'), 'I-130A: residence history must follow form order before biographic details');
  assert(i130aOrder.indexOf('i130a_spouse_current_employment') < i130aOrder.indexOf('i130a_spouse_statement'), 'I-130A: employment history must come before statement');
  const i130aFields = i130a.body.steps.flatMap((step) => step.fields || []);
  assert(i130aFields.find((field) => field.id === 'spouse_residence_history')?.type === 'addressHistory', 'I-130A: spouse residence history should be structured');
  assert(i130aFields.find((field) => field.id === 'spouse_employment_history')?.type === 'employmentHistory', 'I-130A: spouse employment history should be structured');

  const i131 = await callFlow('I-131', 'en');
  const i131Order = i131.body.steps.map((step) => step.id);
  assert(i131Order.indexOf('i131_application_type') < i131Order.indexOf('i131_applicant_name'), 'I-131: application type must come before applicant information');
  assert(i131Order.indexOf('i131_applicant_name') < i131Order.indexOf('i131_beneficiary_status'), 'I-131: applicant information must come before beneficiary information');
  assert(i131Order.indexOf('i131_beneficiary_status') < i131Order.indexOf('i131_biographic_ethnicity_race'), 'I-131: beneficiary information must come before biographic information');
  assert(i131Order.indexOf('i131_biographic_colors') < i131Order.indexOf('i131_prior_document_history'), 'I-131: biographic information must come before prior document history');
  assert(i131Order.indexOf('i131_advance_parole_trip') < i131Order.indexOf('i131_applicant_contact'), 'I-131: travel details must come before applicant contact');
  const i131Fields = i131.body.steps.flatMap((step) => step.fields || []);
  assert(i131Fields.find((field) => field.id === 'i131_mailing_address')?.type === 'addressBlock', 'I-131: mailing address should be structured');
  assert(i131Fields.find((field) => field.id === 'i131_beneficiary_address')?.type === 'addressBlock', 'I-131: beneficiary address should be structured');
  assert(i131Fields.find((field) => field.id === 'i131_daytime_phone')?.type === 'phone', 'I-131: daytime phone should be split phone field');

  const g325a = await callFlow('G-325A', 'en');
  const biographicHistory = g325a.body.steps.find((step) => step.id === 'biographic_history');
  assert(biographicHistory?.fields.find((field) => field.id === 'g325a_residence_history')?.type === 'addressHistory', 'G-325A: residence history should be structured');
  assert(biographicHistory?.fields.find((field) => field.id === 'g325a_employment_history')?.type === 'employmentHistory', 'G-325A: employment history should be structured');

  const scriptCount = syntaxCheckInlineScripts();
  console.log(`index.html inline scripts syntax ok: ${scriptCount}`);
  console.log('immigration flow QA passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
