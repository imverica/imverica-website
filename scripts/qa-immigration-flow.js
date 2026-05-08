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
  const mailingState = i765Address.fields.find((field) => field.id === 'mailing_state');
  const mailingAddress = i765Address.fields.find((field) => field.id === 'mailing_address_line1');
  const daytimePhone = i765Address.fields.find((field) => field.id === 'daytime_phone');
  assert(mailingAddress?.type === 'addressAutocomplete', 'I-765: mailing address should use address autocomplete');
  assert(mailingState?.type === 'select', 'I-765: state should be a select field');
  assert(mailingState?.options?.includes('CA - California'), 'I-765: state select should include California');
  assert(mailingState?.options?.includes('PR - Puerto Rico'), 'I-765: state select should include territories');
  assert(daytimePhone?.type === 'phone', 'I-765: phone should be split phone field');

  const n400 = await callFlow('N-400', 'ru');
  const n400Naturalization = n400.body.steps.find((step) => step.id === 'naturalization');
  assert(n400Naturalization, 'N-400: missing naturalization step');
  assert(n400Naturalization.fields.find((field) => field.id === 'addresses_last_five_years')?.type === 'addressHistory', 'N-400: address history should be structured');
  assert(n400Naturalization.fields.find((field) => field.id === 'employment_school_last_five_years')?.type === 'employmentHistory', 'N-400: employment history should be structured');

  const i130a = await callFlow('I-130A', 'en');
  const spouseBio = i130a.body.steps.find((step) => step.id === 'spouse_biographic');
  assert(spouseBio?.fields.find((field) => field.id === 'spouse_residence_history')?.type === 'addressHistory', 'I-130A: spouse residence history should be structured');
  assert(spouseBio?.fields.find((field) => field.id === 'spouse_employment_history')?.type === 'employmentHistory', 'I-130A: spouse employment history should be structured');

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
