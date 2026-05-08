const fs = require('fs');
const path = require('path');
const flow = require('../netlify/functions/immigration-flow');

const ROOT = path.resolve(__dirname, '..');

async function callFlow(code) {
  const response = await flow.handler({
    httpMethod: 'GET',
    queryStringParameters: { code },
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

  const scriptCount = syntaxCheckInlineScripts();
  console.log(`index.html inline scripts syntax ok: ${scriptCount}`);
  console.log('immigration flow QA passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
