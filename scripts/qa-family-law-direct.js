'use strict';
/**
 * QA — family-law catalog + direct-schema + fill, fully local.
 *
 * For every "prepare" family-law form:
 *   - its decrypted template exists
 *   - getDirectCourtSchema extracts a non-empty, paged field schema
 *   - sanitizeDirectFields accepts a synthesized answer set
 *   - fillCourtForm produces a valid PDF whose values survive reload
 *
 * Also checks catalog integrity (roles, task grouping) and that court/info
 * forms are correctly NOT preparable.
 *
 * Run:  node scripts/qa-family-law-direct.js
 * Exit: 0 = pass, 1 = fail.
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { getFamilyLawCatalog, getFamilyLawForm, listPreparableFamilyLawSlugs } = require('../netlify/functions/lib/ca-family-law-catalog');
const { getDirectCourtSchema, sanitizeDirectFields } = require('../netlify/functions/lib/ca-court-direct-schema');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');
const { findCourtTemplate } = require('../netlify/functions/lib/ca-court-template');

let pass = 0, fail = 0;
const ok = (m) => { console.log('  ✓', m); pass++; };
const bad = (m) => { console.error('  ✗', m); fail++; };

// Synthesize raw directFields answers for a schema (every field on every page).
// Respect each text field's maxLength — the real UI enforces it via the
// rendered maxlength attribute, so a faithful test must too. (Otherwise an
// over-long synthetic value trips pdf-lib's max-length guard and the field
// is skipped — a test artifact, not an engine fault.)
function synthRaw(schema) {
  const raw = {};
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'checkbox') raw[f.id] = true;
      else if (f.type === 'select') { if (f.options && f.options[0]) raw[f.id] = f.options[0].value; }
      else {
        let v = 'QA ' + (f.label || 'value').slice(0, 20);
        if (Number.isFinite(f.maxLength) && f.maxLength > 0) v = v.slice(0, f.maxLength);
        raw[f.id] = v;
      }
    }
  }
  return raw;
}

async function main() {
  console.log('\n=== Family-law catalog + direct-schema QA ===\n');

  const catalog = getFamilyLawCatalog();

  // Catalog integrity
  if (catalog.category === 'family-law') ok('catalog tagged category=family-law');
  else bad('catalog category wrong');
  if (Array.isArray(catalog.tasks) && catalog.tasks.length >= 5) ok(`catalog has ${catalog.tasks.length} tasks`);
  else bad('catalog tasks missing');
  const totalFormCount = catalog.tasks.reduce((n, t) => n + t.formCount, 0);
  if (totalFormCount === catalog.forms.length) ok(`every form belongs to a task (${catalog.forms.length})`);
  else bad(`task formCount sum ${totalFormCount} != forms ${catalog.forms.length}`);

  // Lookup + normalization
  if (getFamilyLawForm('fl-150') && getFamilyLawForm('FL150') && getFamilyLawForm(' fl-150 ')) ok('getFamilyLawForm normalizes code variants');
  else bad('code normalization broken');

  const prepareSlugs = listPreparableFamilyLawSlugs();
  console.log('  → preparable family-law forms:', prepareSlugs.length);

  // Per-form: template + direct schema + fill
  for (const slug of prepareSlugs) {
    const tmpl = findCourtTemplate(slug);
    if (!tmpl) { bad(`${slug}: decrypted template missing`); continue; }

    const schema = await getDirectCourtSchema(slug, slug.toUpperCase());
    if (!schema || !schema.steps || schema.fieldCount === 0) { bad(`${slug}: empty direct schema`); continue; }

    const raw = synthRaw(schema);
    const sanitized = await sanitizeDirectFields(slug, raw);
    const sn = Object.keys(sanitized).length;
    if (sn === 0) { bad(`${slug}: sanitize produced 0 fields from ${Object.keys(raw).length} raw`); continue; }

    const res = await fillCourtForm(fs.readFileSync(tmpl), sanitized);
    const isPdf = res.buffer.slice(0, 5).toString('latin1').startsWith('%PDF');

    // read-back one text value
    let readOk = false;
    try {
      const form = (await PDFDocument.load(res.buffer, { ignoreEncryption: true })).getForm();
      const textName = (res.filled || []).find((n) => { try { return form.getField(n).constructor.name === 'PDFTextField'; } catch { return false; } });
      if (textName) readOk = (form.getTextField(textName).getText() || '') !== '';
      else readOk = res.filled.length > 0; // checkbox-only forms
    } catch { readOk = false; }

    if (isPdf && res.skipped.length === 0 && readOk) {
      ok(`${slug.padEnd(7)} ${String(schema.fieldCount).padStart(3)} fields → ${sn} sanitized → ${res.filled.length} filled, 0 skipped`);
    } else {
      bad(`${slug}: pdf=${isPdf} skipped=${res.skipped.length} readback=${readOk}`);
    }
  }

  // Negative: court/info forms must NOT be preparable
  const courtForm = getFamilyLawCatalog().forms.find((f) => f.role !== 'prepare');
  if (!courtForm) ok('(no court/info-only forms in this catalog — all party-prepared)');
  else if (!listPreparableFamilyLawSlugs().includes(courtForm.code.toLowerCase())) ok(`${courtForm.code} (role=${courtForm.role}) correctly excluded from preparable`);
  else bad(`${courtForm.code} should not be preparable`);

  console.log(`\n=== Passed: ${pass}   Failed: ${fail} ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e.stack || e.message); process.exit(1); });
