'use strict';
/**
 * QA — form fixtures (tests/fixtures/test-*.json) against the REAL maps + PDFs.
 *
 * For each fixture:
 *   - the form's field map builds values from formAnswers
 *   - required identity values land (name, country, address…)
 *   - dates are converted to the official mm/dd/yyyy format
 *   - the unit number is stripped of its keyword ("Apt 5" → "5") and the
 *     Apt/Ste/Flr selector value is emitted for the engine's state-matching
 *   - the engine fills the actual cached PDF with 0 skipped fields
 *   - the output parses as a PDF
 *
 * Run: node scripts/qa-form-fixtures.js (exit 0 = pass)
 */
const fs = require('fs');
const path = require('path');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { console.log('  ✓', m); pass++; } else { console.error('  ✗', m); fail++; } };

function mapModule(code) {
  const slug = code.toLowerCase().replace(/-/g, '');
  return require(`../netlify/functions/lib/${slug}-pdf-map.js`);
}

function runFixture(file) {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures', file), 'utf8'));
  console.log(`\n── ${fx.formCode} (${file}) ──`);
  const mod = mapModule(fx.formCode);
  const build = Object.values(mod).find((f) => typeof f === 'function');
  const values = build({ formAnswers: fx.formAnswers, contact: fx.contact });
  const entries = Object.entries(values);
  const blob = JSON.stringify(values);

  ok(entries.length >= fx.expect.minFilled, `map produced ${entries.length} values (≥${fx.expect.minFilled})`);
  for (const needle of fx.expect.valuesContain || []) {
    ok(blob.includes(needle), `values contain "${needle}"`);
  }
  if (fx.expect.dateFormat) {
    ok(blob.includes(fx.expect.dateFormat), `ISO date converted to official format ${fx.expect.dateFormat}`);
  }
  if (fx.expect.unitNumber) {
    const unitVal = entries.find(([k, v]) => /AptSteFlrNumber/i.test(k) && String(v) === fx.expect.unitNumber);
    ok(Boolean(unitVal), `unit number stripped to "${fx.expect.unitNumber}" (keyword removed)`);
    const radio = entries.find(([k, v]) => /_Unit\[\d\]/.test(k) && String(v) === 'APT');
    ok(Boolean(radio), 'Apt/Ste/Flr selector value emitted for engine state-matching');
  }
  if (fx.expect.sexField) {
    ok(entries.some(([k, v]) => k.includes(fx.expect.sexField) && v === true), `sex checkbox targets ${fx.expect.sexField}`);
  }

  // Fill the real cached PDF.
  const pdfPath = path.join(ROOT, 'assets/form-cache/pdfs', `${fx.formCode.toLowerCase()}.pdf`);
  ok(fs.existsSync(pdfPath), 'official cached PDF present');
  const out = incrementalFillPdf(fs.readFileSync(pdfPath), values, []);
  ok((out.skippedFields || []).length === 0, `engine fill: ${(out.filledFields || []).length} set, 0 skipped`);
  ok(out.buffer.subarray(0, 5).toString('latin1') === '%PDF-', 'output is a valid PDF');
  ok(out.buffer.length > 100000, `output size sane (${Math.round(out.buffer.length / 1024)} KB)`);
}

console.log('\n=== form fixtures QA ===');
for (const file of fs.readdirSync(path.join(ROOT, 'tests/fixtures')).filter((f) => f.startsWith('test-') && f.endsWith('.json'))) {
  try { runFixture(file); } catch (e) { console.error('  ✗ fixture crashed:', file, e.message); fail++; }
}
console.log(`\n=== Passed: ${pass}  Failed: ${fail} ===\n`);
process.exit(fail ? 1 : 0);
