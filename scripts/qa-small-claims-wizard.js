#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');
const { findCourtTemplate } = require('../netlify/functions/lib/ca-court-template');
const { getDirectCourtSchema } = require('../netlify/functions/lib/ca-court-direct-schema');
const {
  FORMS,
  getSmallClaimsCatalog,
  listPreparableSmallClaimsSlugs
} = require('../netlify/functions/lib/ca-small-claims-catalog');

let pass = 0;
let fail = 0;
const ok = (message) => { console.log('  ✓', message); pass++; };
const bad = (message) => { console.error('  ✗', message); fail++; };

async function verifyPreparableForm(slug) {
  const form = FORMS.find((entry) => entry.code.toLowerCase() === slug);
  const template = findCourtTemplate(slug);
  if (!template) {
    bad(`${slug}: decrypted template missing`);
    return;
  }
  const schema = await getDirectCourtSchema(slug, form.title);
  const fields = schema && schema.steps.flatMap((step) => step.fields);
  if (!fields || !fields.length) {
    bad(`${slug}: no client-fillable fields`);
    return;
  }
  if (fields.some((field) => field.type === 'button')) {
    bad(`${slug}: button leaked into wizard schema`);
    return;
  }

  const sample = fields.find((field) => field.type === 'text' || field.type === 'textarea');
  if (!sample) {
    bad(`${slug}: no text field available for fill QA`);
    return;
  }
  const result = await fillCourtForm(fs.readFileSync(template), { [sample.id]: 'Wizard QA' });
  if (result.filled.length === 1 && result.skipped.length === 0) {
    ok(`${slug}: ${fields.length} wizard fields, direct fill succeeds`);
  } else {
    bad(`${slug}: direct fill failed (${result.skipped.map((entry) => entry.reason).join(', ')})`);
  }
}

async function main() {
  console.log('\n=== Small Claims cabinet wizard QA ===\n');

  const catalog = getSmallClaimsCatalog();
  const preparable = listPreparableSmallClaimsSlugs();
  if (catalog.forms.length === 43) ok('catalog includes all 43 current Small Claims documents');
  else bad(`catalog expected 43 forms, got ${catalog.forms.length}`);
  if (preparable.length === 28) ok('28 client/server-prepared forms are enabled');
  else bad(`expected 28 preparable forms, got ${preparable.length}`);
  if (catalog.forms.every((entry) => ['prepare', 'court', 'info'].includes(entry.role))) ok('every catalog entry has a preparation role');
  else bad('catalog contains an entry without a preparation role');

  for (const slug of preparable) await verifyPreparableForm(slug);

  const account = fs.readFileSync(path.resolve(__dirname, '../astro-site/public/account.html'), 'utf8');
  const legacy = fs.readFileSync(path.resolve(__dirname, '../astro-site/public/court-forms.html'), 'utf8');
  if (account.includes('openSmallClaimsWizard()') && account.includes('/api/court-flow') && account.includes('directFields')) {
    ok('wizard is embedded in the personal account');
  } else {
    bad('personal account is missing Small Claims wizard wiring');
  }
  if (legacy.includes('/account.html?open=small-claims') && !legacy.includes('generate-court-pdf')) {
    ok('legacy public page redirects to the cabinet');
  } else {
    bad('legacy public page still exposes generation');
  }

  console.log(`\n=== Passed: ${pass}   Failed: ${fail} ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((error) => {
  console.error('FATAL', error.stack || error.message);
  process.exit(1);
});
