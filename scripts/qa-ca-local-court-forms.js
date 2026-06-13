#!/usr/bin/env node
'use strict';

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'local-ca-court-form-qa-secret';
process.env.COURT_PDF_QA = '1';

const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const manifest = require('../assets/form-cache/ca-local-court-manifest.json');
const courtFlow = require('../netlify/functions/court-flow');
const generateCourtPdf = require('../netlify/functions/generate-court-pdf');
const { getDirectCourtSchema } = require('../netlify/functions/lib/ca-court-direct-schema');
const { findLocalCourtTemplate, loadLocalCourtTemplate } = require('../netlify/functions/lib/ca-local-court-template');
const { signSession } = require('../netlify/functions/lib/session-auth');

const headers = { host: 'imverica.com', origin: 'https://imverica.com' };
headers.cookie = `imv_session=${signSession('local-court-qa@example.com', { headers })}`;
let pass = 0;
let fail = 0;
const ok = (message) => { console.log('  ✓', message); pass += 1; };
const bad = (message) => { console.error('  ✗', message); fail += 1; };

function answers(schema) {
  const output = {};
  for (const field of schema.steps.flatMap((step) => step.fields || [])) {
    if (field.type === 'checkbox') output[field.id] = true;
    else if (field.type === 'select' && field.options && field.options[0]) output[field.id] = field.options[0].value;
    else if (field.type === 'text' || field.type === 'textarea') output[field.id] = 'QA';
  }
  return output;
}

async function verify(form) {
  try {
    const file = findLocalCourtTemplate(form.countySlug, form.slug);
    if (!file || !fs.existsSync(file)) throw new Error('cached template missing');
    const schema = await getDirectCourtSchema(form.slug, form.title, {
      cacheKey: `local:${form.id}`,
      loadTemplate: () => loadLocalCourtTemplate(form.countySlug, form.slug, {
        url: form.officialPdfUrl,
        sha256: form.sourceSha256,
        referer: form.sourcePageUrl,
        cached: true
      })
    });
    if (!schema || schema.fieldCount !== form.fieldCount || !schema.fieldCount) throw new Error(`schema fields ${schema && schema.fieldCount} != ${form.fieldCount}`);
    const directFields = answers(schema);
    const flow = await courtFlow.handler({ httpMethod: 'GET', headers, queryStringParameters: { localId: form.id } });
    if (flow.statusCode !== 200) throw new Error(`flow status ${flow.statusCode}`);
    const generated = await generateCourtPdf.handler({
      httpMethod: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ localFormId: form.id, formCode: form.code, directFields })
    });
    if (generated.statusCode !== 200 || !generated.isBase64Encoded) throw new Error(`generation status ${generated.statusCode}`);
    const pdf = Buffer.from(generated.body, 'base64');
    if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('invalid PDF response');
    await PDFDocument.load(pdf, { ignoreEncryption: true });
    ok(`${form.county} ${form.code}: ${schema.fieldCount} fields → endpoint PDF → reload`);
  } catch (error) {
    bad(`${form.county} ${form.code}: ${error.message}`);
  }
}

async function main() {
  console.log('\n=== California county local forms QA ===\n');
  if (manifest.countyCount === 58 && manifest.counties.length === 58) ok('all 58 Superior Courts represented');
  else bad(`county coverage ${manifest.counties.length}/58`);
  if (manifest.formCount === manifest.forms.length) ok(`${manifest.formCount} local forms indexed`);
  else bad('manifest form count mismatch');
  const preparable = manifest.forms.filter((form) => form.role === 'prepare');
  const reference = manifest.forms.filter((form) => form.role !== 'prepare');
  if (preparable.length === manifest.preparableCount && reference.length === manifest.referenceCount) {
    ok(`${preparable.length} fillable + ${reference.length} reference forms classified`);
  } else bad('role totals are inconsistent');
  for (const form of preparable) await verify(form);
  console.log(`\n=== Passed: ${pass}   Failed: ${fail} ===\n`);
  process.exit(fail ? 1 : 0);
}

main();
