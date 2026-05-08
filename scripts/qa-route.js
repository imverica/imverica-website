const route = require('../netlify/functions/route');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function callRoute(q) {
  const response = await route.handler({
    httpMethod: 'GET',
    queryStringParameters: { q },
    headers: {}
  });

  let body = {};
  try {
    body = JSON.parse(response.body || '{}');
  } catch {
    throw new Error(`${q}: response body is not JSON`);
  }

  return { response, body };
}

async function check(q, expected) {
  const { response, body } = await callRoute(q);
  assert(response.statusCode === 200, `${q}: expected 200, got ${response.statusCode}`);
  assert(body.ok === true, `${q}: expected ok true`);
  assert(body.route, `${q}: missing route`);
  Object.entries(expected).forEach(([key, value]) => {
    assert(body.route[key] === value, `${q}: expected route.${key}=${value}, got ${body.route[key]}`);
  });
  console.log(`${q} -> ${body.route.formCode} / ${body.route.service} / ${body.route.flowStatus}`);
}

async function main() {
  await check('ворк пермит', { formCode: 'I-765', service: 'immigration', flowStatus: 'schema-ready' });
  await check('на свадьбу какие доки подают в USCIS?', { formCode: 'I-130', service: 'immigration', flowStatus: 'schema-ready' });
  await check('смол клейм нужно подать', { formCode: 'SC-100', service: 'civil', flowStatus: 'catalog-only' });
  await check('FL-300 custody support', { formCode: 'FL-300', service: 'family', flowStatus: 'catalog-only' });
  await check('CH-100 restraining order', { formCode: 'CH-100', service: 'restraining', flowStatus: 'catalog-only' });
  await check('UD-100 eviction tenant', { formCode: 'UD-100', service: 'ud', flowStatus: 'catalog-only' });

  const noRoute = await callRoute('zzzzzz nothing matches hopefully');
  assert(noRoute.response.statusCode === 404, `unknown query: expected 404, got ${noRoute.response.statusCode}`);
  console.log('route QA passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
