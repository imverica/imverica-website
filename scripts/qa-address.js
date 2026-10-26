const suggest = require('../netlify/functions/address-suggest');
const verify = require('../netlify/functions/address-verify');
const { US_STATES_AND_TERRITORIES, stateSelectOptions } = require('../netlify/functions/lib/us-address');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function call(handler, event) {
  const response = await handler.handler(event);
  let body = {};
  try {
    body = JSON.parse(response.body || '{}');
  } catch {
    throw new Error('Response body is not JSON');
  }
  return { response, body };
}

async function main() {
  assert(US_STATES_AND_TERRITORIES.length >= 59, 'state/territory list is incomplete');
  assert(stateSelectOptions().includes('CA - California'), 'state dropdown is missing California');
  assert(stateSelectOptions().includes('PR - Puerto Rico'), 'state dropdown is missing Puerto Rico');

  const query = '100 Example Street, Example City, CA 00000';
  const suggested = await call(suggest, {
    httpMethod: 'GET',
    queryStringParameters: { q: query },
    headers: {}
  });
  assert(suggested.response.statusCode === 200, `address suggest expected 200, got ${suggested.response.statusCode}`);
  assert(suggested.body.ok === true, 'address suggest expected ok true');
  assert(Array.isArray(suggested.body.suggestions), 'address suggest should return suggestions array');
  assert(suggested.body.suggestions[0]?.city === 'Example City', 'address suggest should parse city');
  assert(suggested.body.suggestions[0]?.state === 'CA', 'address suggest should parse state');
  assert(suggested.body.suggestions[0]?.zip === '00000', 'address suggest should parse zip');

  const verified = await call(verify, {
    httpMethod: 'POST',
    queryStringParameters: {},
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      line1: '100 Example Street',
      city: 'Example City',
      state: 'CA',
      zip: '00000'
    })
  });
  assert(verified.response.statusCode === 200, `address verify expected 200, got ${verified.response.statusCode}`);
  assert(verified.body.ok === true, 'address verify expected ok true');
  assert(Array.isArray(verified.body.suggestions), 'address verify should return suggestions array');

  console.log('address QA passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
