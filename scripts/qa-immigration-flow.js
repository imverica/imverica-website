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
  const codes = ['I-765', 'I-485', 'I-130', 'I-131', 'I-90', 'I-589', 'I-751', 'I-864', 'I-912', 'N-400', 'AR-11'];

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

  const i90 = await callFlow('I-90', 'en');
  const i90Order = i90.body.steps.map((step) => step.id);
  assert(i90Order.indexOf('i90_numbers') < i90Order.indexOf('i90_legal_name'), 'I-90: numbers must come before applicant name');
  assert(i90Order.indexOf('i90_legal_name') < i90Order.indexOf('i90_mailing_address'), 'I-90: applicant name must come before mailing address');
  assert(i90Order.indexOf('i90_mailing_address') < i90Order.indexOf('i90_birth_sex'), 'I-90: address must come before birth and sex');
  assert(i90Order.indexOf('i90_birth_place') < i90Order.indexOf('i90_application_type'), 'I-90: biographic fields must come before Part 2 application type');
  assert(i90Order.indexOf('i90_reason') < i90Order.indexOf('i90_biographic_ethnicity_race'), 'I-90: reason must come before biographic Part 3 fields');
  assert(i90Order.indexOf('i90_biographic_colors') < i90Order.indexOf('i90_applicant_statement'), 'I-90: biographic fields must come before applicant statement');
  const i90Fields = i90.body.steps.flatMap((step) => step.fields || []);
  assert(i90Fields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-90: mailing address should be structured');
  assert(i90Fields.find((field) => field.id === 'physical_address')?.type === 'addressBlock', 'I-90: physical address should be structured');
  assert(i90Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-90: daytime phone should be split phone field');

  const i589 = await callFlow('I-589', 'en');
  const i589Order = i589.body.steps.map((step) => step.id);
  assert(i589Order.indexOf('i589_applicant_numbers') < i589Order.indexOf('i589_legal_name'), 'I-589: numbers must come before applicant name');
  assert(i589Order.indexOf('i589_legal_name') < i589Order.indexOf('i589_residential_address'), 'I-589: applicant identity must come before address');
  assert(i589Order.indexOf('i589_contact') < i589Order.indexOf('i589_birth_sex_marital'), 'I-589: contact must come before birth/status fields');
  assert(i589Order.indexOf('i589_last_entry') < i589Order.indexOf('i589_spouse_included'), 'I-589: entry/status must come before spouse/children');
  assert(i589Order.indexOf('i589_children_summary') < i589Order.indexOf('i589_asylum_basis'), 'I-589: family information must come before asylum basis');
  assert(i589Order.indexOf('i589_asylum_basis') < i589Order.indexOf('i589_harm_summary'), 'I-589: basis must come before harm narrative');
  assert(i589Order.indexOf('i589_prior_applications') < i589Order.indexOf('i589_statement_contact'), 'I-589: prior applications/security must come before statement');
  const i589Fields = i589.body.steps.flatMap((step) => step.fields || []);
  assert(i589Fields.find((field) => field.id === 'i589_residential_address')?.type === 'addressBlock', 'I-589: residential address should be structured');
  assert(i589Fields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-589: mailing address should be structured');
  assert(i589Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-589: daytime phone should be split phone field');
  assert(i589Fields.find((field) => field.id === 'asylum_basis')?.type === 'checkboxes', 'I-589: asylum basis should be checkboxes');

  const i864 = await callFlow('I-864', 'en');
  const i864Order = i864.body.steps.map((step) => step.id);
  assert(i864Order.indexOf('i864_sponsor_basis') < i864Order.indexOf('i864_principal_immigrant'), 'I-864: sponsor basis must come before principal immigrant');
  assert(i864Order.indexOf('i864_principal_address') < i864Order.indexOf('i864_sponsor_name'), 'I-864: principal immigrant details must come before sponsor details');
  assert(i864Order.indexOf('i864_sponsor_mailing_address') < i864Order.indexOf('i864_sponsor_birth'), 'I-864: sponsor address must come before sponsor birth/status');
  assert(i864Order.indexOf('i864_household_size') < i864Order.indexOf('i864_current_income'), 'I-864: household size must come before current income');
  assert(i864Order.indexOf('i864_tax_returns') < i864Order.indexOf('i864_assets'), 'I-864: tax returns must come before assets');
  assert(i864Order.indexOf('i864_assets') < i864Order.indexOf('i864_sponsor_contact'), 'I-864: assets must come before sponsor contact');
  const i864Fields = i864.body.steps.flatMap((step) => step.fields || []);
  assert(i864Fields.find((field) => field.id === 'principal_immigrant_mailing_address')?.type === 'addressBlock', 'I-864: principal immigrant mailing address should be structured');
  assert(i864Fields.find((field) => field.id === 'sponsor_mailing_address')?.type === 'addressBlock', 'I-864: sponsor mailing address should be structured');
  assert(i864Fields.find((field) => field.id === 'sponsor_physical_address')?.type === 'addressBlock', 'I-864: sponsor physical address should be structured');
  assert(i864Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-864: daytime phone should be split phone field');

  const i912 = await callFlow('I-912', 'en');
  const i912Order = i912.body.steps.map((step) => step.id);
  assert(i912Order.indexOf('i912_request_type') < i912Order.indexOf('i912_primary_applicant_name'), 'I-912: request type must come before applicant name');
  assert(i912Order.indexOf('i912_mailing_address') < i912Order.indexOf('i912_basis'), 'I-912: address/contact must come before fee waiver basis');
  assert(i912Order.indexOf('i912_basis') < i912Order.indexOf('i912_household_size'), 'I-912: basis must come before household details');
  assert(i912Order.indexOf('i912_household_income') < i912Order.indexOf('i912_assets'), 'I-912: income must come before assets');
  assert(i912Order.indexOf('i912_financial_hardship') < i912Order.indexOf('i912_applicant_statement'), 'I-912: hardship must come before applicant statement');
  const i912Fields = i912.body.steps.flatMap((step) => step.fields || []);
  assert(i912Fields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-912: mailing address should be structured');
  assert(i912Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-912: daytime phone should be split phone field');
  assert(i912Fields.find((field) => field.id === 'fee_waiver_basis')?.type === 'checkboxes', 'I-912: fee waiver basis should be checkboxes');

  const i751 = await callFlow('I-751', 'en');
  const i751Order = i751.body.steps.map((step) => step.id);
  assert(i751Order.indexOf('i751_filing_type') < i751Order.indexOf('i751_conditional_resident_name'), 'I-751: filing type must come before resident name');
  assert(i751Order.indexOf('i751_mailing_address') < i751Order.indexOf('i751_marriage_status'), 'I-751: resident address must come before relationship details');
  assert(i751Order.indexOf('i751_marriage_status') < i751Order.indexOf('i751_spouse_name'), 'I-751: marriage status must come before spouse details');
  assert(i751Order.indexOf('i751_marriage_details') < i751Order.indexOf('i751_children'), 'I-751: marriage details must come before children');
  assert(i751Order.indexOf('i751_criminal_history') < i751Order.indexOf('i751_relationship_evidence'), 'I-751: criminal history must come before evidence');
  const i751Fields = i751.body.steps.flatMap((step) => step.fields || []);
  assert(i751Fields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-751: mailing address should be structured');
  assert(i751Fields.find((field) => field.id === 'physical_address')?.type === 'addressBlock', 'I-751: physical address should be structured');
  assert(i751Fields.find((field) => field.id === 'residence_history')?.type === 'addressHistory', 'I-751: residence history should be structured');
  assert(i751Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-751: daytime phone should be split phone field');

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
