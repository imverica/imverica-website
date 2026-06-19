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

  const cleanupNeedsCounty = await callRoute('DUI expungement clean my record');
  assert(cleanupNeedsCounty.body.needsCounty === true, 'natural-language record cleanup request must ask for filing county');

  const ambiguousProbate = await callRoute('probate');
  assert(ambiguousProbate.body.needsIntent === true, 'bare probate must ask what the client means');
  assert(!ambiguousProbate.body.route.formCode, 'bare probate must not preselect DE-111');
  assert(ambiguousProbate.body.intentOptions.length === 4, 'probate clarification must show four matter types');

  const russianProbate = await callRoute('мне нужен пробейт');
  assert(russianProbate.body.needsIntent === true, 'Russian probate request must ask what the client means');
  assert(russianProbate.body.intentOptions.some((option) => option.id === 'probation-motion'), 'Russian clarification must include criminal probation');

  const duiProbate = await callRoute('probate after DUI');
  assert(duiProbate.body.needsIntent === true, 'probate after DUI must clarify probate vs probation');

  const probationNeedsCounty = await route.handler({
    httpMethod: 'GET', queryStringParameters: { q: 'probate', intent: 'probation-motion' }, headers: {}
  }).then((response) => JSON.parse(response.body));
  assert(probationNeedsCounty.needsCounty === true, 'criminal probation selection must ask for filing county');

  const placerProbation = await route.handler({
    httpMethod: 'GET', queryStringParameters: { q: 'probate', intent: 'probation-motion', county: 'placer' }, headers: {}
  }).then((response) => JSON.parse(response.body));
  assert(placerProbation.route.formCode === 'PL-CR003', 'Placer probation motion must route to PL-CR003');
  assert(placerProbation.route.localFormId === 'placer:pl-cr003-criminal-defendants-91df299f', 'Placer probation route must retain local form id');

  const explicitProbation = await callRoute('terminate my DUI probation', 'placer');
  assert(explicitProbation.body.route.formCode === 'PL-CR003', 'explicit Placer DUI probation request must route to PL-CR003');

  // Regression guards: natural-language criminal phrasings that previously
  // slipped past the probation intent into the generic keyword scorer and
  // returned wrong forms (CR-100 "Fingerprint Form", small-claims SC-135).
  // These are the exact wrong-form-to-court misroutes.
  for (const q of ['criminal probation Placer county', 'criminal defendant motion Placer']) {
    const r = await route.handler({ httpMethod: 'GET', queryStringParameters: { q }, headers: {} })
      .then((response) => JSON.parse(response.body));
    assert(r.route.formCode === 'PL-CR003', `"${q}" must route to PL-CR003, got ${r.route.formCode}`);
    assert(!!r.route.localFormId, `"${q}" must retain the local form id`);
  }

  // Exact 58-county sweep. Matching a CR-* prefix is not enough: a statewide
  // form can share a code with an unrelated county form (Napa CR-100 is the
  // known collision). Compare the exact localFormId selected by the router
  // with the preferred form in the generated county/type index.
  const reliefIndex = require('../assets/form-cache/ca-criminal-relief-index.json');
  async function assertExpectedReliefRoute(county, reliefType, result, label) {
    const matches = county.forms.filter((form) => form.reliefType === reliefType);
    const expected = matches.find((form) => form.role === 'prepare') || matches[0] || null;
    const actual = result.route || {};

    if (expected) {
      assert(actual.localFormId === expected.id, `${label}: expected ${expected.id}, got ${actual.localFormId || 'none'}`);
      assert(actual.formCode === expected.code, `${label}: expected code ${expected.code}, got ${actual.formCode || 'none'}`);
      assert(actual.scope === 'local', `${label}: expected local scope`);
      return 'local';
    }
    // Record-clearing services we offer (dismissal, early probation termination,
    // resentencing) fall back to the statewide CR-180 intake so they never
    // dead-end; relief we don't prepare (warrant recall) stays no-local-form.
    if (['record-cleanup', 'probation-motion', 'resentencing'].includes(reliefType)) {
      assert(actual.formCode === 'CR-180', `${label}: expected statewide CR-180 fallback, got ${actual.formCode || 'none'}`);
      assert(!actual.localFormId, `${label}: statewide fallback must not carry a localFormId`);
      return 'fallback';
    }
    assert(!actual.formCode && !actual.localFormId, `${label}: no indexed local form, but router selected ${actual.formCode || actual.localFormId}`);
    assert(actual.flowStatus === 'county-known-no-local-form', `${label}: expected safe no-local-form result, got ${actual.flowStatus}`);
    return 'fallback';
  }

  async function sweepReliefType(reliefType) {
    let local = 0;
    let fallback = 0;
    for (const county of reliefIndex.counties) {
      const result = await route.handler({
        httpMethod: 'GET',
        queryStringParameters: { q: `criminal ${reliefType} ${county.name} county`, intent: reliefType, county: county.slug },
        headers: {}
      }).then((response) => JSON.parse(response.body));
      const kind = await assertExpectedReliefRoute(county, reliefType, result, `${county.name}/${reliefType}/intent`);
      if (kind === 'local') local++; else fallback++;
    }
    assert(local + fallback === reliefIndex.counties.length, `${reliefType} sweep must cover all 58 counties`);
    console.log(`${reliefType} 58-county exact sweep: ${local} indexed local, ${fallback} safe fallback, 0 wrong`);
  }
  for (const reliefType of ['probation-motion', 'record-cleanup', 'resentencing', 'warrant']) {
    await sweepReliefType(reliefType);
  }

  const naturalQueries = {
    'probation-motion': (county) => `terminate criminal probation in ${county.name} County`,
    'record-cleanup': (county) => `DUI expungement record cleanup in ${county.name} County`,
    resentencing: (county) => `Prop 47 resentencing petition in ${county.name} County`,
    warrant: (county) => `recall bench warrant in ${county.name} County`
  };
  for (const [reliefType, makeQuery] of Object.entries(naturalQueries)) {
    let local = 0;
    let fallback = 0;
    for (const county of reliefIndex.counties) {
      const result = await callRoute(makeQuery(county));
      const kind = await assertExpectedReliefRoute(county, reliefType, result.body, `${county.name}/${reliefType}/natural-language`);
      if (kind === 'local') local++; else fallback++;
    }
    console.log(`${reliefType} natural-language sweep: ${local} indexed local, ${fallback} safe fallback, 0 wrong`);
  }

  const napaProbation = await callRoute('criminal probation Napa county');
  assert(napaProbation.body.route.localFormId === 'napa:mandatory-1-ffb8bc19', 'Napa CR-100 collision must resolve to the county form by localFormId');

  const estateProbate = await route.handler({
    httpMethod: 'GET', queryStringParameters: { q: 'probate', intent: 'estate', county: 'placer' }, headers: {}
  }).then((response) => JSON.parse(response.body));
  assert(estateProbate.route.formCode === 'DE-111', 'estate selection must route to DE-111');

  const criminalIndex = require('../assets/form-cache/ca-criminal-relief-index.json');
  assert(criminalIndex.counties.length === 58, 'criminal relief inventory must contain all 58 counties');
  assert(probationNeedsCounty.counties.length === 58, 'criminal probation county selector must contain all 58 counties');
  assert(criminalIndex.counties.some((county) => county.slug === 'placer' && county.forms.some((form) => form.code === 'PL-CR003')), 'criminal relief inventory must include Placer PL-CR003');

  const noRoute = await callRoute('zzzzzz nothing matches hopefully');
  assert(noRoute.response.statusCode === 404, `unknown query: expected 404, got ${noRoute.response.statusCode}`);
  console.log('route QA passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
