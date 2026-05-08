#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'netlify/functions/forms/immigration.json');
const MANIFEST_PATH = path.join(ROOT, 'assets/form-cache/manifest.json');
const MAP_DIR = path.join(ROOT, 'netlify/functions/pdf-maps/uscis');
const REPORT_PATH = path.join(ROOT, 'netlify/functions/pdf-maps/uscis-report.json');
const endpoint = require('../netlify/functions/uscis-pdf-map');

const PRIORITY_CODES = ['I-765', 'I-485', 'N-400', 'I-130', 'I-131', 'I-912'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function safeSlug(value) {
  return normalizeCode(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function callEndpoint(code) {
  const response = await endpoint.handler({
    httpMethod: 'GET',
    queryStringParameters: { code },
    headers: {}
  });

  let body = {};
  try {
    body = JSON.parse(response.body || '{}');
  } catch {
    throw new Error(`${code}: endpoint response is not JSON`);
  }

  return { response, body };
}

async function main() {
  const catalog = readJson(CATALOG_PATH);
  const manifest = readJson(MANIFEST_PATH);
  const report = readJson(REPORT_PATH);
  const codes = [...new Set((catalog.forms || []).map((form) => normalizeCode(form.code)).filter(Boolean))].sort();
  const cachedUscis = new Map((manifest.forms || [])
    .filter((form) => form.agency === 'uscis')
    .map((form) => [normalizeCode(form.code), form]));

  assert(report.schemaVersion === 'uscis-pdf-map.scaffold.v1', 'report schema version mismatch');
  assert(report.summary.totalCatalogForms === codes.length, 'report total does not match USCIS catalog');
  assert(report.summary.cachedForms === 96, `expected 96 cached USCIS PDFs, got ${report.summary.cachedForms}`);
  assert(report.missingPdfCodes.includes('I-864W'), 'I-864W should be reported as missing PDF');

  for (const code of codes) {
    const filePath = path.join(MAP_DIR, `${safeSlug(code)}.json`);
    assert(fs.existsSync(filePath), `${code}: missing map scaffold`);

    const map = readJson(filePath);
    const cached = cachedUscis.get(code);
    assert(map.schemaVersion === 'uscis-pdf-map.scaffold.v1', `${code}: schema version mismatch`);
    assert(map.code === code, `${code}: code mismatch`);
    assert(Array.isArray(map.fields), `${code}: fields must be an array`);
    assert(Array.isArray(map.mappings), `${code}: mappings must be an array`);
    assert(map.fieldInventory && typeof map.fieldInventory.fieldCount === 'number', `${code}: missing field inventory`);
    assert(map.fields.length === map.fieldInventory.fieldCount, `${code}: field count mismatch`);

    const names = map.fields.map((field) => field.pdfFieldName);
    assert(names.length === new Set(names).size, `${code}: duplicate PDF field names`);

    if (cached?.cacheStatus === 'cached') {
      assert(map.status === 'scaffold', `${code}: cached PDF should have scaffold status`);
      assert(map.source.cachedPdfUrl, `${code}: missing cached PDF URL`);
    } else {
      assert(map.status === 'missing_pdf', `${code}: non-cached PDF should have missing_pdf status`);
      assert(map.fieldInventory.needsPdfCache === true, `${code}: missing PDF should request cache`);
    }
  }

  for (const code of PRIORITY_CODES) {
    const map = readJson(path.join(MAP_DIR, `${safeSlug(code)}.json`));
    assert(map.fieldInventory.fieldCount > 0, `${code}: priority form should have extracted fields`);
    assert(map.fieldInventory.needsManualMapping === true, `${code}: scaffold should require manual mapping`);
  }

  const i765 = await callEndpoint('I-765');
  assert(i765.response.statusCode === 200, `I-765 endpoint expected 200, got ${i765.response.statusCode}`);
  assert(i765.body.ok === true, 'I-765 endpoint should return ok true');
  assert(i765.body.map.code === 'I-765', 'I-765 endpoint code mismatch');
  assert(i765.body.map.fieldInventory.fieldCount > 0, 'I-765 endpoint should include fields');

  const missing = await callEndpoint('I-864W');
  assert(missing.response.statusCode === 200, `I-864W endpoint expected 200, got ${missing.response.statusCode}`);
  assert(missing.body.map.status === 'missing_pdf', 'I-864W endpoint should expose missing_pdf scaffold');

  const invalid = await callEndpoint('NOPE-999');
  assert(invalid.response.statusCode === 404, `invalid endpoint expected 404, got ${invalid.response.statusCode}`);

  console.log(`USCIS PDF map QA passed: ${codes.length} forms, ${report.summary.totalExtractedFields} extracted PDF fields`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
