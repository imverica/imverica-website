const route = require('../netlify/functions/route');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function callRoute(q, county = '') {
  const response = await route.handler({
    httpMethod: 'GET',
    queryStringParameters: { q, county },
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
  await check('DUI expungement clean my record', { formCode: 'CR-180', service: 'civil', flowStatus: 'catalog-only' });
  await check('CR-180', { formCode: 'CR-180', service: 'civil', flowStatus: 'catalog-only' });
  await check('закрыть probate final distribution', { formCode: 'DE-295', service: 'probate', flowStatus: 'catalog-only' });
  await check('DE-295', { formCode: 'DE-295', service: 'probate', flowStatus: 'catalog-only' });

  const courtNeedsCounty = await callRoute('смол клейм нужно подать');
  assert(courtNeedsCounty.body.needsCounty === true, 'small claims must ask for filing county');
  assert(courtNeedsCounty.body.counties.length === 58, 'county prompt must list all 58 counties');

  const courtWithCounty = await callRoute('смол клейм нужно подать', 'sacramento');
  assert(courtWithCounty.body.needsCounty === false, 'selected filing county must resolve county prompt');
  assert(courtWithCounty.body.route.county === 'Sacramento', 'selected county must be carried into route');

  const countyInQuery = await callRoute('file small claims in Los Angeles County');
  assert(countyInQuery.body.needsCounty === false, 'county written in query must be detected');
  assert(countyInQuery.body.route.county === 'Los Angeles', 'query county must be normalized');

  const localNeedsCounty = await callRoute('LASC-ADM-080 request copies');
  assert(localNeedsCounty.body.needsCounty === true, 'local form code must require filing county confirmation');

  const localWithCounty = await callRoute('LASC-ADM-080 request copies', 'los-angeles');
  assert(localWithCounty.body.needsCounty === false, 'local form must resolve inside selected county');
  assert(localWithCounty.body.route.localFormId, 'resolved local form must include localFormId');

  const localWrongCounty = await callRoute('LASC-ADM-080 request copies', 'sacramento');
  assert(localWrongCounty.body.needsCounty === true, 'wrong county must not silently select another court form');
  assert(localWrongCounty.body.countyMismatch === true, 'wrong county must return an explicit mismatch');
  assert(!localWrongCounty.body.route.localFormId, 'county mismatch must not expose a usable localFormId');

  const immigrationNoCounty = await callRoute('ворк пермит');
  assert(immigrationNoCounty.body.needsCounty === false, 'USCIS route must not ask for county');

  const noRoute = await callRoute('zzzzzz nothing matches hopefully');
  assert(noRoute.response.statusCode === 404, `unknown query: expected 404, got ${noRoute.response.statusCode}`);
  console.log('route QA passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
