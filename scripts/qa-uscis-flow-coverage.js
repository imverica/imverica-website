'use strict';
/**
 * QA — USCIS flow → map → PDF coverage gate.
 *
 * For each candidate form: build its immigration flow schema, synthesize an
 * answer for EVERY flow field id, run the form's pdf-map over those answers,
 * fill the cached template, and measure how many PDF fields actually get
 * filled (with 0 skips). A form is "enable-ready" only if its own question
 * flow feeds its map well — otherwise enabling the draft button would hand
 * the client a near-empty PDF.
 *
 * This is the safety gate before widening canGeneratePdfDraft.
 *
 * Run:  node scripts/qa-uscis-flow-coverage.js
 *       node scripts/qa-uscis-flow-coverage.js --min 12   (custom threshold)
 */

const fs = require('fs');
const path = require('path');
const { buildImmigrationFlow } = require('../netlify/functions/lib/immigration-flow-schema');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const ROOT = path.resolve(__dirname, '..');
const PDF_DIR = path.join(ROOT, 'assets/form-cache/pdfs');
const MAP_DIR = path.join(ROOT, 'netlify/functions/lib');

// Forms with hand-authored specific flows (from buildImmigrationFlow).
const CANDIDATES = ['I-485', 'I-765', 'I-130', 'I-130A', 'I-131', 'I-90', 'I-589',
  'I-864', 'I-912', 'I-751', 'I-539', 'I-821', 'I-821D', 'N-400'];

const minArg = process.argv.indexOf('--min');
const MIN_FILLED = minArg >= 0 ? Number(process.argv[minArg + 1]) : 10;

// ---- replicate generate-pdf.js form lookup ----
function norm(v) { return String(v || '').trim().toUpperCase().replace(/\s+/g, ''); }
function pdfPath(code) {
  const n = norm(code).toLowerCase();
  for (const name of [n + '.pdf', n.replace(/-/g, '') + '.pdf']) {
    const p = path.join(PDF_DIR, name); if (fs.existsSync(p)) return p;
  }
  const compact = n.replace(/[^a-z0-9]/g, '');
  const files = fs.existsSync(PDF_DIR) ? fs.readdirSync(PDF_DIR) : [];
  const m = files.find((f) => f.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/pdf$/, '') === compact);
  return m ? path.join(PDF_DIR, m) : null;
}
function mapFile(code) {
  const compact = norm(code).toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = { g845supplement: 'g845s-pdf-map.js', i485supplementa: 'i485a-pdf-map.js', i485supplementj: 'i485j-pdf-map.js' };
  return aliases[compact] || compact + '-pdf-map.js';
}
function loadMap(code) {
  const p = path.join(MAP_DIR, mapFile(code));
  if (!fs.existsSync(p)) return null;
  const mod = require(p);
  const build = Object.values(mod).find((v) => typeof v === 'function' && /fieldvalues/i.test(v.name)) || Object.values(mod).find((v) => typeof v === 'function');
  const overlays = Object.values(mod).find((v) => typeof v === 'function' && /textoverlays/i.test(v.name)) || (() => []);
  return build ? { build, overlays } : null;
}

// Synthesize an answer for every field in a flow schema.
function synthValue(field) {
  const type = field.type || 'text';
  if (type === 'date') return '1990-06-15';
  if (type === 'select' || type === 'radio') {
    const opt = (field.options || [])[0];
    return opt ? (opt.value != null ? opt.value : opt) : 'Yes';
  }
  if (type === 'checkbox' || type === 'checkboxes') {
    const opt = (field.options || [])[0];
    return opt ? [opt.value != null ? opt.value : opt] : ['Yes'];
  }
  if (type === 'number') return '2';
  if (/email/i.test(field.id)) return 'client@example.com';
  if (/phone/i.test(field.id)) return '9163993992';
  if (/zip/i.test(field.id)) return '95814';
  if (/state/i.test(field.id)) return 'CA';
  if (/country/i.test(field.id)) return 'Ukraine';
  if (/(^|_)(a_?number|alien)/i.test(field.id)) return '123456789';
  if (/ssn|social/i.test(field.id)) return '555112222';
  return 'Test ' + String(field.id || 'value').replace(/_/g, ' ').slice(0, 24);
}

function answersFromFlow(flow) {
  const a = {};
  for (const step of (flow.steps || [])) {
    for (const f of (step.fields || [])) {
      if (!f.id) continue;
      // addressBlock stores values under its part KEYS (e.g. *_line1, *_city),
      // not under the block id — maps read the parts, so synth must populate them.
      if (f.type === 'addressBlock' && f.parts) {
        a[f.parts.line1] = '456 Test Street';
        if (f.parts.line2) a[f.parts.line2] = 'Apt 5';
        a[f.parts.city] = 'Sacramento';
        a[f.parts.state] = 'CA';
        a[f.parts.zip] = '95814';
        if (f.parts.country) a[f.parts.country] = 'United States';
        continue;
      }
      a[f.id] = synthValue(f);
    }
  }
  return a;
}

let pass = 0, fail = 0;
const rows = [];

for (const code of CANDIDATES) {
  const r = { code, fields: 0, filled: 0, skipped: 0, status: '' };
  try {
    const flow = buildImmigrationFlow(code, {}, {});
    const answers = answersFromFlow(flow);
    r.fields = Object.keys(answers).length;

    const map = loadMap(code);
    const pp = pdfPath(code);
    if (!map) { r.status = 'NO MAP'; fail++; rows.push(r); continue; }
    if (!pp) { r.status = 'NO PDF'; fail++; rows.push(r); continue; }

    const payload = { formCode: code, formAnswers: answers, contact: { email: 'client@example.com', phone: '9163993992' } };
    const fieldValues = map.build(payload);
    const overlays = map.overlays(payload) || [];
    const res = incrementalFillPdf(fs.readFileSync(pp), fieldValues, overlays);
    r.filled = (res.filledFields || []).length;
    r.skipped = (res.skippedFields || []).length;
    const mapped = Object.keys(fieldValues).length;

    if (res.buffer.slice(0, 5).toString('latin1') !== '%PDF-') { r.status = 'BAD PDF'; fail++; }
    else if (r.skipped > 0) { r.status = `${r.skipped} SKIPPED`; fail++; }
    else if (r.filled < MIN_FILLED) { r.status = `LOW (${r.filled}<${MIN_FILLED})`; fail++; }
    else { r.status = `OK (${mapped} mapped, ${overlays.length} overlays)`; pass++; }
  } catch (e) {
    r.status = 'ERR ' + String(e.message).slice(0, 40);
    fail++;
  }
  rows.push(r);
}

console.log('\n=== USCIS flow → map → PDF coverage ===  (min filled = ' + MIN_FILLED + ')\n');
console.log('Form     FlowQs  Filled  Skipped  Status');
console.log('─'.repeat(70));
for (const r of rows) {
  console.log(r.code.padEnd(8), String(r.fields).padEnd(7), String(r.filled).padEnd(7), String(r.skipped).padEnd(8), r.status);
}
console.log('─'.repeat(70));
console.log(`\nEnable-ready: ${pass}   Not-ready: ${fail}\n`);
// Print the ready list as a JS array for canGeneratePdfDraft.
const ready = rows.filter((r) => r.status.startsWith('OK')).map((r) => r.code);
console.log('Ready forms:', JSON.stringify(ready));
process.exit(0); // informational — never fails the run
