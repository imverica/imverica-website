'use strict';
/**
 * QA — final-PDF workflow locks + flatten (lib/final-pdf.js).
 * Spec: client-approval lock, QC lock, flatten only after both open.
 * Run: node scripts/qa-final-pdf.js (exit 0 = pass)
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { assertFinalLocks, buildFinalPdf, finalEnabledForms } = require('../netlify/functions/lib/final-pdf');
const { QC_CHECKLISTS } = require('../netlify/functions/lib/form-registry');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { console.log('  ✓', m); pass++; } else { console.error('  ✗', m); fail++; } };

(async () => {
  console.log('\n=== final-PDF workflow QA ===\n');

  const fullQc = { items: QC_CHECKLISTS._generic.slice(), by: 'admin', updatedAt: new Date().toISOString() };

  // 1. Client-approval lock: any non-approved status is rejected.
  for (const status of ['new_request', 'in_preparation', 'ready_for_client_review', 'revision_requested', 'completed']) {
    let lock = null;
    try { assertFinalLocks({ status, qc: fullQc }); } catch (e) { lock = e.lock; }
    ok(lock === 'client-approval', `status "${status}" → client-approval lock`);
  }

  // 2. QC lock: approved but checklist incomplete.
  let lock = null;
  try { assertFinalLocks({ status: 'approved_by_client', qc: { items: fullQc.items.slice(0, 3) } }); } catch (e) { lock = e.lock; }
  ok(lock === 'qc', 'incomplete QC checklist → qc lock');
  lock = null;
  try { assertFinalLocks({ status: 'approved_by_client' }); } catch (e) { lock = e.lock; }
  ok(lock === 'qc', 'missing QC record → qc lock');

  // 3. Both locks open → no throw.
  let threw = false;
  try { assertFinalLocks({ status: 'approved_by_client', qc: fullQc }); } catch { threw = true; }
  ok(!threw, 'approved + full QC → locks open');

  // 4. Final enablement reflects the normalized templates on disk.
  const enabled = finalEnabledForms();
  ok(enabled.includes('I-765') && enabled.includes('I-589'), `final-enabled forms: ${enabled.join(', ')}`);

  // 5. buildFinalPdf flattens: 0 AcroForm fields, values baked in.
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tests/fixtures/test-i-765.json'), 'utf8'));
  const out = await buildFinalPdf('I-765', { formAnswers: fx.formAnswers, contact: fx.contact });
  ok(out.buffer.subarray(0, 5).toString('latin1') === '%PDF-', 'final output is a valid PDF');
  ok(out.filledFields >= fx.expect.minFilled, `filled ${out.filledFields} fields before flatten`);
  const doc = await PDFDocument.load(out.buffer, { ignoreEncryption: true });
  ok(doc.getForm().getFields().length === 0, 'AcroForm fully flattened (0 fields)');

  // 6. Unsupported form → clean 422-style error, never a fake final.
  let code422 = null;
  try { await buildFinalPdf('N-400', { formAnswers: {} }); } catch (e) { code422 = e.statusCode; }
  ok(code422 === 422, 'non-enabled form rejected with 422 (no normalized template)');

  console.log(`\n=== Passed: ${pass}  Failed: ${fail} ===\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
