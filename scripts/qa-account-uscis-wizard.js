#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const catalogEndpoint = require('../netlify/functions/uscis-flow-catalog');
const flowEndpoint = require('../netlify/functions/immigration-flow');
const directGeneratePdf = require('../netlify/functions/generate-pdf');
const accountGeneratePdf = require('../netlify/functions/generate-uscis-pdf');
const { signSession } = require('../netlify/functions/lib/session-auth');

const ROOT = path.resolve(__dirname, '..');
const PRIORITY = ['I-589', 'I-765', 'I-485', 'I-130', 'N-400', 'I-131', 'I-90', 'I-751', 'I-864', 'I-912'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function parseJson(response) {
  try {
    return JSON.parse(response.body || '{}');
  } catch {
    throw new Error(`response is not JSON: ${String(response.body || '').slice(0, 80)}`);
  }
}

function signedHeaders() {
  const headers = {
    host: 'localhost:8888',
    origin: 'http://localhost:8888'
  };
  headers.cookie = `imv_session=${signSession('uscis-wizard-qa@example.com', { headers })}`;
  return headers;
}

function checkInlineScripts(relPath) {
  const html = read(relPath);
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => {
      const attrs = match[1] || '';
      if (/\bsrc\s*=/.test(attrs)) return false;
      const type = attrs.match(/\btype=["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
      return !type || type === 'text/javascript' || type === 'module';
    })
    .map((match) => match[2])
    .filter((script) => script.trim());

  scripts.forEach((script, index) => {
    try {
      new Function(script);
    } catch (err) {
      throw new Error(`${relPath} inline script ${index + 1}: ${err.message}`);
    }
  });
  return scripts.length;
}

function i765Payload() {
  return {
    formCode: 'I-765',
    formAnswers: {
      i765_application_reason: 'Initial permission to accept employment',
      applicant_given_name: 'Ivan',
      applicant_family_name: 'Petrov',
      date_of_birth: '1990-04-12',
      city_of_birth: 'Kyiv',
      country_of_birth: 'Ukraine',
      country_of_citizenship: 'Ukraine',
      sex: 'Male',
      marital_status: 'Married',
      alien_number: 'A123456789',
      uscis_online_account_number: '123456789012',
      ssn: '123-45-6789',
      mailing_address_line1: '8305 Deer Spring Circle',
      mailing_address_line2: 'Apt 2',
      mailing_city: 'Antelope',
      mailing_state: 'CA - California',
      mailing_zip: '95843',
      physical_same_as_mailing: 'Yes',
      daytime_phone: {
        countryCode: '+1',
        areaCode: '916',
        number: '5551212'
      },
      email_address: 'ivan@example.com',
      current_immigration_status: 'Pending asylum',
      status_at_last_entry: 'Parolee',
      last_arrival_date: '2023-01-15',
      place_entry: 'San Francisco, CA',
      i94_number: '12345678901',
      passport_number: 'AB1234567',
      passport_country_of_issuance: 'Ukraine',
      passport_expiration: '2030-01-01',
      eligibility_category_code: 'c08',
      c8_arrested_or_convicted: 'No',
      prior_ead: 'No',
      applicant_statement: 'I can read and understand English',
      has_interpreter: 'No',
      has_preparer: 'No'
    },
    contact: {
      name: 'Ivan Petrov',
      phone: '+1 916 555 1212',
      email: 'ivan@example.com'
    }
  };
}

async function main() {
  const accountHtml = read('astro-site/public/account.html');
  const rootAccountHtml = read('account.html');
  const indexHtml = read('index.html');
  const wizardSource = read('astro-site/src/scripts/wizard.ts');
  const netlifyToml = read('netlify.toml');

  for (const [label, html] of [['astro account', accountHtml], ['root account', rootAccountHtml]]) {
    assert(html.includes('openUscisWizard'), `${label}: missing USCIS wizard opener`);
    assert(html.includes('/api/uscis-flow-catalog'), `${label}: missing USCIS catalog endpoint`);
    assert(html.includes('/api/generate-uscis-pdf'), `${label}: missing account-only PDF endpoint`);
    assert(html.includes('saveGeneratedDraft(blob'), `${label}: generated USCIS PDFs are not saved to My Documents`);
    assert(html.includes('tileUscisTitle'), `${label}: missing USCIS dashboard tile translations`);
    assert(html.includes('maybeOpenUscisFromUrl();'), `${label}: URL-open hook is not wired after dashboard load`);
    assert(html.includes('requestedUscisFormFromUrl'), `${label}: form-specific URL open is missing`);
    assert(!html.includes('/.netlify/functions/generate-pdf'), `${label}: must not call direct USCIS renderer`);
  }

  assert(indexHtml.includes('data-open-uscis-account'), 'public intake should link to account USCIS wizard');
  assert(wizardSource.includes('data-open-uscis-account'), 'Astro intake source should link to account USCIS wizard');
  assert(!indexHtml.includes('data-generate-pdf-draft'), 'legacy public index still exposes direct draft generation');
  assert(!wizardSource.includes('data-generate-pdf-draft'), 'Astro wizard source still exposes direct draft generation');
  assert(!wizardSource.includes('/.netlify/functions/generate-pdf'), 'Astro wizard source still calls direct USCIS renderer');

  assert(netlifyToml.includes('from = "/api/uscis-flow-catalog"'), 'netlify.toml missing USCIS catalog redirect');
  assert(netlifyToml.includes('from = "/api/generate-uscis-pdf"'), 'netlify.toml missing account USCIS generate redirect');
  assert(netlifyToml.includes('[functions."generate-uscis-pdf"]'), 'netlify.toml missing generate-uscis-pdf bundle config');

  const inlineScripts = checkInlineScripts('astro-site/public/account.html') + checkInlineScripts('account.html');

  const noSessionCatalog = await catalogEndpoint.handler({
    httpMethod: 'GET',
    headers: { host: 'localhost:8888' }
  });
  assert(noSessionCatalog.statusCode === 401, `catalog should require session, got ${noSessionCatalog.statusCode}`);

  const catalogResponse = await catalogEndpoint.handler({
    httpMethod: 'GET',
    headers: signedHeaders()
  });
  assert(catalogResponse.statusCode === 200, `catalog expected 200, got ${catalogResponse.statusCode}`);
  const catalog = parseJson(catalogResponse);
  assert(catalog.ok === true, 'catalog returned ok=false');
  assert(catalog.counts.total === 97, `expected 97 USCIS forms, got ${catalog.counts.total}`);
  assert(catalog.counts.preparable === 96, `expected 96 preparable USCIS forms, got ${catalog.counts.preparable}`);
  const blocked = catalog.forms.filter((form) => !form.preparable).map((form) => form.code);
  assert(blocked.length === 1 && blocked[0] === 'I-864W', `expected only I-864W blocked, got ${blocked.join(', ')}`);

  for (const code of PRIORITY) {
    const form = catalog.forms.find((item) => item.code === code);
    assert(form && form.preparable, `${code}: priority form should be preparable`);
    const flow = await flowEndpoint.handler({
      httpMethod: 'GET',
      queryStringParameters: { code, lang: 'en' },
      headers: {}
    });
    const body = parseJson(flow);
    assert(flow.statusCode === 200 && body.ok === true, `${code}: flow should load`);
    assert(Array.isArray(body.steps) && body.steps.length >= 5, `${code}: flow has too few steps`);
  }

  const payload = i765Payload();
  const directBlocked = await directGeneratePdf.handler({
    httpMethod: 'POST',
    headers: { origin: 'https://imverica.com', 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert(directBlocked.statusCode === 403, `direct USCIS renderer should be blocked, got ${directBlocked.statusCode}`);

  const noSessionGenerate = await accountGeneratePdf.handler({
    httpMethod: 'POST',
    headers: { host: 'localhost:8888', origin: 'http://localhost:8888', 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert(noSessionGenerate.statusCode === 401, `account USCIS generation should require session, got ${noSessionGenerate.statusCode}`);

  const generated = await accountGeneratePdf.handler({
    httpMethod: 'POST',
    headers: { ...signedHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert(generated.statusCode === 200, `account USCIS generation expected 200, got ${generated.statusCode}`);
  assert(generated.isBase64Encoded === true, 'account USCIS generation should return base64 PDF');
  assert(generated.headers['Content-Type'] === 'application/pdf', 'account USCIS generation should return application/pdf');
  const pdf = Buffer.from(generated.body, 'base64');
  assert(pdf.subarray(0, 5).toString('latin1') === '%PDF-', 'account USCIS output should start with PDF signature');

  console.log(JSON.stringify({
    ok: true,
    inlineScripts,
    counts: catalog.counts,
    blocked,
    generatedPdfBytes: pdf.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
