#!/usr/bin/env node
'use strict';
/**
 * QA — /api/generate-court-pdf endpoint (local, mocked Netlify event).
 *
 * Mirrors scripts/qa-generate-pdf-endpoint.js (the USCIS endpoint test).
 * Verifies the JSON/PDF response contract + edge cases without Netlify.
 *
 * Run:  node scripts/qa-generate-court-pdf-endpoint.js
 * Exit: 0 = pass, 1 = fail.
 */

const { PDFDocument } = require('pdf-lib');
const endpoint = require('../netlify/functions/generate-court-pdf');
const { signSession } = require('../netlify/functions/lib/session-auth');

let pass = 0, fail = 0;
const ok = (m) => { console.log('  ✓', m); pass++; };
const bad = (m) => { console.error('  ✗', m); fail++; };

async function call(payload, method = 'POST', raw = null, authenticated = true) {
  const sessionEvent = { headers: { host: 'localhost:8888' } };
  const token = signSession('court-qa@example.com', sessionEvent);
  return endpoint.handler({
    httpMethod: method,
    // Same-origin browser request from the site — originGuard requires a
    // trusted Origin on POST (CSRF protection). The wizard runs on imverica.com.
    // No client-IP header on purpose: ipThrottle early-returns "allowed"
    // when it can't identify the caller, so the shared blob-backed throttle
    // (which needs the Netlify runtime) is skipped in this local test.
    headers: {
      'content-type': 'application/json',
      'origin': 'https://imverica.com',
      host: 'localhost:8888',
      ...(authenticated ? { cookie: `imv_session=${token}` } : {})
    },
    body: raw !== null ? raw : JSON.stringify(payload)
  });
}

const FL100_PAYLOAD = {
  formCode: 'FL-100',
  formAnswers: {
    case_type: 'dissolution', relationship_type: 'marriage',
    petitioner_first_name: 'John', petitioner_last_name: 'Smith',
    respondent_first_name: 'Jane', respondent_last_name: 'Smith',
    court_county: 'Sacramento', case_number: '26FL01234',
    date_of_marriage: '2015-06-20', date_of_separation: '2025-11-01'
  }
};

async function main() {
  console.log('\n=== /api/generate-court-pdf endpoint QA ===\n');

  // 1. Cabinet session is mandatory.
  {
    const r = await call(FL100_PAYLOAD, 'POST', null, false);
    if (r.statusCode === 401) ok('unsigned request → 401');
    else bad(`unsigned request expected 401, got ${r.statusCode}`);
  }

  // 2. Happy path — FL-100
  {
    const r = await call(FL100_PAYLOAD);
    if (r.statusCode === 200) ok('FL-100 → 200');
    else bad(`FL-100 expected 200, got ${r.statusCode} (${r.body && r.body.slice(0, 120)})`);

    if (r.isBase64Encoded === true) ok('response is base64-encoded');
    else bad('response should be base64-encoded');

    if (r.headers && r.headers['Content-Type'] === 'application/pdf') ok('Content-Type application/pdf');
    else bad('Content-Type should be application/pdf');

    if (r.statusCode === 200) {
      const buf = Buffer.from(r.body, 'base64');
      if (buf.subarray(0, 5).toString('latin1') === '%PDF-') ok('body is a valid PDF');
      else bad('body should start with %PDF-');
      // re-parse + confirm a caption value landed
      try {
        const form = (await PDFDocument.load(buf, { ignoreEncryption: true })).getForm();
        const v = form.getTextField('FL-100[0].Page1[0].CaptionP1_sf[0].CaseNumber[0].CaseNumber_ft[0]').getText();
        if (v === '26FL01234') ok('filled case number survives reload');
        else bad(`case number read-back = "${v}"`);
      } catch (e) { bad('could not reload/parse output PDF: ' + e.message.slice(0, 60)); }
    }
  }

  // 3. SC-100 (different structure) happy path
  {
    const r = await call({
      formCode: 'SC-100',
      formAnswers: {
        plaintiff_name: 'Acme LLC', defendant_name: 'Bob Tenant',
        court_county: 'Sacramento', case_number: '26SC0001',
        claim_amount: '4500', claim_reason: 'Unpaid rent'
      }
    });
    if (r.statusCode === 200 && r.isBase64Encoded) ok('SC-100 → 200 PDF');
    else bad(`SC-100 expected 200 PDF, got ${r.statusCode}`);
  }

  // 4. Direct Small Claims field fill.
  {
    const r = await call({
      formCode: 'SC-105',
      directFields: {
        'SC-105[0].Page1[0].RightCaption[0].CSENO[0].CaseNumber[0]': '26SC00999'
      }
    });
    if (r.statusCode === 200 && r.isBase64Encoded) ok('SC-105 direct fields → 200 PDF');
    else bad(`SC-105 direct fields expected 200 PDF, got ${r.statusCode}`);
  }

  // 5. Court-only forms cannot be generated as client drafts.
  {
    const r = await call({ formCode: 'SC-105A', directFields: { anything: 'value' } });
    if (r.statusCode === 403) ok('court-only SC-105A → 403');
    else bad(`court-only SC-105A expected 403, got ${r.statusCode}`);
  }

  // 6. Unknown form → 404 + supported list
  {
    const r = await call({ formCode: 'XY-999', formAnswers: { foo: 'bar' } });
    const body = safeJson(r.body);
    if (r.statusCode === 404) ok('unknown form → 404');
    else bad(`unknown form expected 404, got ${r.statusCode}`);
    if (body && Array.isArray(body.supported) && body.supported.includes('fl-100')) ok('404 lists supported forms');
    else bad('404 should list supported forms');
  }

  // 7. Missing formCode → 400
  {
    const r = await call({ formAnswers: { foo: 'bar' } });
    if (r.statusCode === 400) ok('missing formCode → 400');
    else bad(`missing formCode expected 400, got ${r.statusCode}`);
  }

  // 8. Bad JSON → 400
  {
    const r = await call(null, 'POST', '{not valid json');
    if (r.statusCode === 400) ok('bad JSON → 400');
    else bad(`bad JSON expected 400, got ${r.statusCode}`);
  }

  // 9. Empty answers → still 200: FL-100 has sensible defaults
  // (self-represented + marriage), so it produces a minimal draft rather
  // than nothing. The 422 guard only fires when a map yields literally 0
  // fields. This matches the USCIS endpoint, which fills signature dates
  // even on sparse input.
  {
    const r = await call({ formCode: 'FL-100', formAnswers: {} });
    if (r.statusCode === 200) ok('empty answers → 200 (map defaults → minimal draft)');
    else bad(`empty answers expected 200, got ${r.statusCode}`);
  }

  // 10. Wrong method → 405
  {
    const r = await call(FL100_PAYLOAD, 'GET');
    if (r.statusCode === 405) ok('GET → 405');
    else bad(`GET expected 405, got ${r.statusCode}`);
  }

  // 11. formType alias works
  {
    const r = await call({ formType: 'FL-100', formAnswers: FL100_PAYLOAD.formAnswers });
    if (r.statusCode === 200) ok('formType alias accepted');
    else bad(`formType alias expected 200, got ${r.statusCode}`);
  }

  console.log(`\n=== Passed: ${pass}   Failed: ${fail} ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

main().catch((e) => { console.error('FATAL', e.stack || e.message); process.exit(1); });
