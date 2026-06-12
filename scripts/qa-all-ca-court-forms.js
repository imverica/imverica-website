#!/usr/bin/env node
'use strict';

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'all-ca-court-form-qa-secret';
process.env.COURT_PDF_QA = '1';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField
} = require('pdf-lib');
const courtFlow = require('../netlify/functions/court-flow');
const generateCourtPdf = require('../netlify/functions/generate-court-pdf');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');
const { getDirectCourtSchema, sanitizeDirectFields } = require('../netlify/functions/lib/ca-court-direct-schema');
const { signSession } = require('../netlify/functions/lib/session-auth');
const {
  getSmallClaimsCatalog,
  listPreparableSmallClaimsSlugs
} = require('../netlify/functions/lib/ca-small-claims-catalog');
const { listPreparableFamilyLawSlugs } = require('../netlify/functions/lib/ca-family-law-catalog');
const {
  getAllCourtCatalogSummary,
  listAllCourtForms,
  listPreparableAllCourtForms
} = require('../netlify/functions/lib/ca-all-court-catalog');
const { findCourtTemplate } = require('../netlify/functions/lib/ca-court-template');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = require('../assets/form-cache/ca-court-manifest.json');
const directSlugs = [...new Set([
  ...listPreparableSmallClaimsSlugs(),
  ...listPreparableFamilyLawSlugs()
])];
const directSet = new Set(directSlugs);
const headers = { host: 'imverica.com', origin: 'https://imverica.com' };
headers.cookie = `imv_session=${signSession('all-court-qa@example.com', { headers })}`;

let pass = 0;
let fail = 0;
const ok = (message) => { console.log('  ✓', message); pass++; };
const bad = (message) => { console.error('  ✗', message); fail++; };

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function rawAnswers(schema) {
  const raw = {};
  for (const field of schema.steps.flatMap((step) => step.fields || [])) {
    if (field.type === 'checkbox') raw[field.id] = true;
    else if (field.type === 'select') {
      if (field.options && field.options[0]) raw[field.id] = field.options[0].value;
    } else {
      let value = 'QA';
      if (Number.isFinite(field.maxLength) && field.maxLength > 0) value = value.slice(0, field.maxLength);
      raw[field.id] = value;
    }
  }
  return raw;
}

function forbiddenWizardField(field) {
  const value = `${field.id} ${field.label}`;
  return /\.(Order|CrtOrder|Clerk|ClerkCertificate|Judge|JudicialOfficer|CourtUse|CourtOnly|ClerkUse)\[\d+\]/i.test(field.id) ||
    /(?:^|\.)(?:Clerk|Clert)(?:Sub|Cert|Certificate|Signature|Sig|Name|Date)?(?:\[|\.|$)/i.test(field.id) ||
    /(?:^|\.)(?:JudgeSign|JudgeSignature(?:Date)?|JudicialOfficer|HearingJudge|NameOfJudicialOfficer|Temp_Judge)(?:\[|\.|$)/i.test(field.id) ||
    /(?:DateClerkSig|ClerkSignature|ClerkCertificate|ClerkName|JudgeSignatureDate)/i.test(field.id) ||
    /^(clerk\s*,?\s*by|judge|judicial officer|trial date|trial time|trial department|date mailed by clerk)\b/i.test(field.label) ||
    /\bclerk\s+to\s+(?:insert|complete)\b/i.test(value);
}

function json(response) {
  try { return JSON.parse(response.body); } catch { return {}; }
}

function flowEvent(code) {
  return { httpMethod: 'GET', headers, queryStringParameters: code ? { code } : {} };
}

function generationEvent(code, directFields) {
  return {
    httpMethod: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ formCode: code, directFields })
  };
}

async function verifyTemplate(record) {
  const sourceFile = path.join(ROOT, record.sourceFile);
  const decryptedFile = path.join(ROOT, record.decryptedFile);
  if (!fs.existsSync(sourceFile) || !fs.existsSync(decryptedFile)) {
    bad(`${record.code}: source or decrypted template missing`);
    return;
  }
  const source = fs.readFileSync(sourceFile);
  const decrypted = fs.readFileSync(decryptedFile);
  if (sha256(source) !== record.sourceSha256 || sha256(decrypted) !== record.decryptedSha256) {
    bad(`${record.code}: manifest hash mismatch`);
    return;
  }
  try {
    const document = await PDFDocument.load(decrypted, { ignoreEncryption: true });
    const fields = document.getForm().getFields();
    if (fields.length !== record.fieldCount || !fields.length) throw new Error(`field count ${fields.length} != ${record.fieldCount}`);

    if (!directSet.has(record.slug)) {
      const sample = fields.find((field) => field instanceof PDFTextField || field instanceof PDFCheckBox || field instanceof PDFRadioGroup);
      if (!sample) throw new Error('no fillable sample field');
      let value = 'QA';
      if (sample instanceof PDFCheckBox) value = true;
      else if (sample instanceof PDFRadioGroup) value = { radio: sample.getOptions()[0] };
      const filled = await fillCourtForm(decrypted, { [sample.getName()]: value });
      if (filled.filled.length !== 1 || filled.skipped.length) throw new Error('generic fill failed');
    }
    ok(`${record.code}: official template valid (${fields.length} fields)`);
  } catch (error) {
    bad(`${record.code}: ${error.message}`);
  }
}

async function verifyDirectForm(form) {
  const { code, slug } = form;
  try {
    const schema = await getDirectCourtSchema(slug, code);
    const fields = schema.steps.flatMap((step) => step.fields || []);
    if (!fields.length || fields.length !== schema.fieldCount) throw new Error('empty or inconsistent wizard schema');
    const forbidden = fields.filter(forbiddenWizardField);
    if (forbidden.length) throw new Error(`court-only fields leaked: ${forbidden.map((field) => field.label).join(', ')}`);

    const raw = rawAnswers(schema);
    const sanitized = await sanitizeDirectFields(slug, raw);
    if (Object.keys(sanitized).length !== Object.keys(raw).length) {
      throw new Error(`sanitizer truncated fields: ${Object.keys(raw).length} -> ${Object.keys(sanitized).length}`);
    }

    const response = await courtFlow.handler(flowEvent(code));
    const endpointSchema = json(response);
    if (response.statusCode !== 200 || endpointSchema.fieldCount !== schema.fieldCount) throw new Error(`court-flow status=${response.statusCode}`);

    const generated = await generateCourtPdf.handler(generationEvent(code, raw));
    const pdf = Buffer.from(generated.body || '', 'base64');
    if (generated.statusCode !== 200 || !generated.isBase64Encoded || pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new Error(`generation status=${generated.statusCode}`);
    }

    const output = await PDFDocument.load(pdf, { ignoreEncryption: true });
    const outputForm = output.getForm();
    let readback = false;
    for (const [name, value] of Object.entries(sanitized)) {
      try {
        const outputField = outputForm.getField(name);
        if (outputField instanceof PDFTextField && outputField.getText() === String(value)) readback = true;
        else if (outputField instanceof PDFCheckBox && outputField.isChecked() === Boolean(value)) readback = true;
        else if (outputField instanceof PDFRadioGroup && outputField.getSelected() === value.radio) readback = true;
        else if (outputField instanceof PDFDropdown && outputField.getSelected().includes(value.dropdown)) readback = true;
      } catch {}
      if (readback) break;
    }
    if (!readback) throw new Error('generated values did not survive PDF reload');

    ok(`${code}: ${fields.length} wizard fields → full endpoint PDF → readback`);
  } catch (error) {
    bad(`${code}: ${error.message}`);
  }
}

async function verifyBlockedForm(form) {
  const flow = await courtFlow.handler(flowEvent(form.code));
  const generated = await generateCourtPdf.handler(generationEvent(form.code, { anything: 'value' }));
  if (flow.statusCode === 409 && generated.statusCode === 403) {
    ok(`${form.code}: ${form.role} document blocked from client generation`);
  } else {
    bad(`${form.code}: expected flow=409/generate=403, got ${flow.statusCode}/${generated.statusCode}`);
  }
}

async function main() {
  console.log('\n=== All California court forms QA ===\n');

  if (MANIFEST.formCount === 61 && MANIFEST.failedCount === 0) ok('official manifest covers 61 healthy site templates');
  else bad(`manifest count/failures unexpected: ${MANIFEST.formCount}/${MANIFEST.failedCount}`);
  if (directSlugs.length === 49) ok('49 cabinet wizard forms registered');
  else bad(`expected 49 cabinet wizard forms, got ${directSlugs.length}`);

  const allForms = listAllCourtForms();
  const preparableForms = listPreparableAllCourtForms();
  const summary = getAllCourtCatalogSummary();
  if (summary.total === 345 && allForms.length === 345) ok('statewide catalog contains 345 unique official forms');
  else bad(`expected 345 statewide forms, got ${summary.total}/${allForms.length}`);
  if (summary.preparableCount === preparableForms.length && summary.preparableCount + summary.referenceCount === summary.total) {
    ok(`${summary.preparableCount} preparable + ${summary.referenceCount} reference/court forms classified`);
  } else {
    bad('statewide role totals are inconsistent');
  }

  const missingTemplates = allForms.filter((form) => !findCourtTemplate(form.slug));
  if (!missingTemplates.length) ok('every statewide catalog entry has a deployed PDF template');
  else bad(`missing statewide templates: ${missingTemplates.map((form) => form.code).join(', ')}`);

  for (const record of MANIFEST.forms) await verifyTemplate(record);
  for (const form of preparableForms) await verifyDirectForm(form);

  const blocked = new Map();
  for (const form of allForms.filter((entry) => entry.role !== 'prepare')) blocked.set(form.code, form);
  for (const form of getSmallClaimsCatalog().forms.filter((entry) => entry.role !== 'prepare')) blocked.set(form.code, form);
  for (const form of blocked.values()) await verifyBlockedForm(form);

  console.log(`\n=== Passed: ${pass}   Failed: ${fail} ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((error) => {
  console.error(`FATAL: ${error.stack || error.message}`);
  process.exit(1);
});
