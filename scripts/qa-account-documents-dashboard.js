#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ACCOUNT = path.join(ROOT, 'astro-site/public/account.html');
const NETLIFY = path.join(ROOT, 'netlify.toml');
const GENERATED_FN = path.join(ROOT, 'netlify/functions/generated-documents.js');
const STATUS_FN = path.join(ROOT, 'netlify/functions/forms-status.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

async function main() {
  const account = read(ACCOUNT);
  const netlify = read(NETLIFY);
  const generatedFn = read(GENERATED_FN);
  const statusFn = require(STATUS_FN);

  assert(!account.includes('id="uscis-status-panel"'), 'client account dashboard must not expose the internal USCIS status monitor');
  assert(!account.includes('/api/forms-status'), 'client account dashboard must not call the internal forms-status endpoint');
  assert(!account.includes('Official form monitor'), 'client account dashboard must not show internal form-monitor copy');
  assert(!account.includes('USCIS forms status'), 'client account dashboard must not show internal USCIS status copy');
  assert(account.includes('/api/generated-documents'), 'My Documents does not call /api/generated-documents');
  assert(account.includes('saveGeneratedDraft(blob'), 'Small Claims wizard does not save generated PDFs');
  assert(account.includes('mdTagGenerated'), 'My Documents has no generated-file tag');

  assert(netlify.includes('from = "/api/forms-status"'), 'netlify.toml is missing internal /api/forms-status redirect');
  assert(netlify.includes('from = "/api/generated-documents"'), 'netlify.toml is missing /api/generated-documents redirect');

  assert(generatedFn.includes("getStore('imverica-generated-documents')"), 'generated documents function uses wrong store');
  assert(generatedFn.includes('encryptBuffer(buf, event)'), 'generated documents are not encrypted at rest');
  assert(generatedFn.includes('Content-Disposition'), 'generated downloads do not force attachment');

  const response = await statusFn.handler({ httpMethod: 'GET' });
  assert(response.statusCode === 200, `forms-status returned ${response.statusCode}`);
  const body = JSON.parse(response.body);
  assert(body.ok, 'forms-status returned ok=false');
  assert(body.uscis.counts.total >= 90, `expected at least 90 USCIS forms, got ${body.uscis.counts.total}`);
  assert(body.uscis.counts.cached >= 90, `expected at least 90 cached USCIS forms, got ${body.uscis.counts.cached}`);
  assert(body.uscis.counts.current >= 70, `expected at least 70 current USCIS forms, got ${body.uscis.counts.current}`);
  assert(Array.isArray(body.uscis.urgent), 'forms-status urgent list is not an array');
  assert(body.uscis.urgent.every((item) => item.code && item.expirationStatus), 'urgent entries are missing code/status');

  console.log(JSON.stringify({
    ok: true,
    formsStatus: body.uscis.counts,
    urgent: body.uscis.urgent.map((item) => `${item.code}:${item.expirationStatus}`)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
