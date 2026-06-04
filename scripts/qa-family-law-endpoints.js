'use strict';
/**
 * QA — family-law via the real court-flow + generate-court-pdf handlers
 * (session-gated), plus small-claims regression. Local, mocked Netlify events.
 *
 * Run:  node scripts/qa-family-law-endpoints.js   (exit 0 = pass)
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'imverica-dev-session-secret-change-me-please';

const courtFlow = require('../netlify/functions/court-flow');
const generate = require('../netlify/functions/generate-court-pdf');
const { signSession } = require('../netlify/functions/lib/session-auth');

let pass = 0, fail = 0;
const ok = (m) => { console.log('  ✓', m); pass++; };
const bad = (m) => { console.error('  ✗', m); fail++; };

const baseHeaders = { host: 'imverica.com', origin: 'https://imverica.com' };
const cookie = () => 'imv_session=' + signSession('client@example.com', { headers: baseHeaders });

function flowEvent(qs, withSession = true) {
  return {
    httpMethod: 'GET',
    queryStringParameters: qs,
    headers: { ...baseHeaders, ...(withSession ? { cookie: cookie() } : {}) }
  };
}
function genEvent(body, withSession = true) {
  return {
    httpMethod: 'POST',
    headers: { ...baseHeaders, 'content-type': 'application/json', ...(withSession ? { cookie: cookie() } : {}) },
    body: JSON.stringify(body)
  };
}
const J = (r) => { try { return JSON.parse(r.body); } catch { return {}; } };

async function main() {
  console.log('\n=== Family-law endpoints + small-claims regression ===\n');

  // court-flow: family-law catalog
  let r = await courtFlow.handler(flowEvent({ category: 'family-law' }));
  let b = J(r);
  if (r.statusCode === 200 && b.category === 'family-law' && b.forms.some((f) => f.code === 'FL-150')) ok('court-flow ?category=family-law → family-law catalog');
  else bad(`family-law catalog failed: ${r.statusCode}`);

  // court-flow: regression — no category → small claims (unchanged)
  r = await courtFlow.handler(flowEvent({}));
  b = J(r);
  if (r.statusCode === 200 && b.forms.some((f) => f.code === 'SC-100')) ok('court-flow (no category) → small-claims catalog (regression OK)');
  else bad('small-claims catalog regression broke');

  // court-flow: family-law form schema
  r = await courtFlow.handler(flowEvent({ code: 'FL-150' }));
  b = J(r);
  if (r.statusCode === 200 && b.mode === 'direct' && b.fieldCount > 50 && b.form && b.form.code === 'FL-150') ok(`court-flow ?code=FL-150 → direct schema (${b.fieldCount} fields)`);
  else bad(`FL-150 schema failed: ${r.statusCode} fieldCount=${b.fieldCount}`);

  // court-flow: 401 without session
  r = await courtFlow.handler(flowEvent({ category: 'family-law' }, false));
  if (r.statusCode === 401) ok('court-flow without session → 401');
  else bad(`expected 401, got ${r.statusCode}`);

  // generate-court-pdf: family-law directMode
  const directFields = {
    'FL-150[0].Page1[0].Attorney[0].AttyName[0]': 'John Smith'
  };
  // fetch the real schema to pick a couple valid field ids
  const schema = J(await courtFlow.handler(flowEvent({ code: 'FL-150' })));
  const someText = [];
  for (const step of (schema.steps || [])) for (const f of step.fields) if (f.type === 'text' && someText.length < 3) someText.push(f.id);
  const realFields = {};
  someText.forEach((id, i) => { realFields[id] = 'QA Value ' + i; });

  r = await generate.handler(genEvent({ formCode: 'FL-150', directFields: realFields }));
  if (r.statusCode === 200 && r.isBase64Encoded && (r.headers['Content-Type'] || '').includes('pdf')) ok('generate-court-pdf FL-150 directMode → 200 PDF');
  else bad(`FL-150 generate failed: ${r.statusCode} (${(r.body || '').slice(0, 100)})`);

  // generate-court-pdf: 401 without session
  r = await generate.handler(genEvent({ formCode: 'FL-150', directFields: realFields }, false));
  if (r.statusCode === 401) ok('generate-court-pdf without session → 401');
  else bad(`expected 401, got ${r.statusCode}`);

  // generate-court-pdf: small-claims regression (directMode)
  const scSchema = J(await courtFlow.handler(flowEvent({ code: 'SC-100' })));
  const scFields = {};
  let n = 0;
  for (const step of (scSchema.steps || [])) for (const f of step.fields) if (f.type === 'text' && n < 2) { scFields[f.id] = 'QA'; n++; }
  r = await generate.handler(genEvent({ formCode: 'SC-100', directFields: scFields }));
  if (r.statusCode === 200 && r.isBase64Encoded) ok('generate-court-pdf SC-100 directMode → 200 PDF (regression OK)');
  else bad(`SC-100 regression failed: ${r.statusCode}`);

  console.log(`\n=== Passed: ${pass}   Failed: ${fail} ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e.stack || e.message); process.exit(1); });
