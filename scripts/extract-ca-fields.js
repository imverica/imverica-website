#!/usr/bin/env node
'use strict';
/**
 * Dump every AcroForm field of a decrypted CA court form: name, type, and
 * the /TU tooltip (the human-readable label the court put on the field).
 *
 * Per project rule "labels from PDF only" — we build field maps from these
 * verbatim tooltips, never invented labels.
 *
 * Usage:
 *   node scripts/extract-ca-fields.js fl-100
 *   node scripts/extract-ca-fields.js fl-100 --json > fl-100-fields.json
 *   node scripts/extract-ca-fields.js fl-100 --grep Caption
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName } = require('pdf-lib');

const CA_DIR = path.resolve(__dirname, '../assets/form-cache/ca-court');

function tooltipOf(field) {
  try {
    const TU = field.acroField.dict.get(PDFName.of('TU'));
    return TU ? TU.decodeText() : '';
  } catch { return ''; }
}

function exportValuesOf(field) {
  // For checkboxes/radios, surface the on-state export value(s).
  try {
    if (typeof field.getOptions === 'function') return field.getOptions();
  } catch {}
  return [];
}

async function main() {
  const args = process.argv.slice(2);
  const slug = (args.find((a) => !a.startsWith('--')) || '').toLowerCase().replace(/\.pdf$/, '');
  const asJson = args.includes('--json');
  const grepIdx = args.indexOf('--grep');
  const grep = grepIdx >= 0 ? args[grepIdx + 1] : null;

  if (!slug) {
    console.error('Usage: node scripts/extract-ca-fields.js <slug> [--json] [--grep <substr>]');
    process.exit(1);
  }
  const pdfPath = path.join(CA_DIR, slug + '.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error('Not found (did you run decrypt-ca-forms.js?):', pdfPath);
    process.exit(1);
  }

  const doc = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
  const fields = doc.getForm().getFields();

  let rows = fields.map((f) => ({
    name: f.getName(),
    type: f.constructor.name.replace('PDF', '').replace('Field', ''),
    tooltip: tooltipOf(f),
    options: exportValuesOf(f)
  }));

  if (grep) {
    const re = new RegExp(grep, 'i');
    rows = rows.filter((r) => re.test(r.name) || re.test(r.tooltip));
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    return;
  }

  console.log(`\n${slug.toUpperCase()} — ${rows.length} fields\n`);
  for (const r of rows) {
    const opts = r.options && r.options.length ? '  {' + r.options.join('|') + '}' : '';
    console.log(`${r.type.padEnd(9)} ${r.name}`);
    if (r.tooltip) console.log(`          ↳ ${r.tooltip}${opts}`);
  }
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
