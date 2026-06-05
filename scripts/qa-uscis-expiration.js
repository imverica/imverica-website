#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'assets/form-cache/manifest.json');

const USER_FACING_FORMS = [
  'I-485',
  'I-765',
  'N-400',
  'I-751',
  'I-90',
  'I-539',
  'I-864',
  'I-130',
  'I-131'
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const uscisForms = (manifest.forms || []).filter((form) => form.agency === 'uscis');
  const cached = uscisForms.filter((form) => form.cacheStatus === 'cached');
  const recognized = cached.filter((form) => form.expirationStatus && form.expirationStatus !== 'unknown');

  assert(uscisForms.length >= 90, `expected at least 90 USCIS catalog forms, got ${uscisForms.length}`);
  assert(cached.length >= 90, `expected at least 90 cached USCIS PDFs, got ${cached.length}`);
  assert(recognized.length >= 70, `expected expiration dates on at least 70 cached USCIS PDFs, got ${recognized.length}`);

  const byCode = new Map(uscisForms.map((form) => [form.code, form]));
  for (const code of USER_FACING_FORMS) {
    const form = byCode.get(code);
    assert(form, `${code}: missing from USCIS manifest`);
    assert(form.cacheStatus === 'cached', `${code}: expected cached status, got ${form.cacheStatus}`);
    assert(form.expirationDate, `${code}: missing expirationDate`);
    assert(/^\d{2}\/\d{2}\/\d{4}$/.test(form.expirationDate), `${code}: invalid expirationDate ${form.expirationDate}`);
    assert(form.expirationDateIso, `${code}: missing expirationDateIso`);
    assert(['current', 'expires-soon', 'expired'].includes(form.expirationStatus), `${code}: invalid expirationStatus ${form.expirationStatus}`);
  }

  const counts = uscisForms.reduce((acc, form) => {
    acc[form.expirationStatus || 'missing'] = (acc[form.expirationStatus || 'missing'] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    ok: true,
    uscisForms: uscisForms.length,
    cached: cached.length,
    expirationStatusCounts: counts
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
