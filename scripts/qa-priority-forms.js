const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PRIORITY = [
  'i-130', 'i-485', 'i-765', 'n-400', 'i-589',
  'i-131', 'i-134a', 'i-601a', 'i-821d', 'i-90',
  'i-130a', 'i-751', 'i-864', 'i-129f', 'g-28',
  'i-821', 'i-485-supplement-j', 'i-485-supplement-a'
];

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function qaForm(form) {
  const qPath = `questionnaires/${form}.questionnaire.json`;
  const mPath = `overlay-maps/normalized/${form}.json`;
  if (!fs.existsSync(qPath)) return { form, ok: false, error: 'NO_QUESTIONNAIRE' };
  if (!fs.existsSync(mPath)) return { form, ok: false, error: 'NO_MAP' };

  const q = loadJson(qPath);
  const m = loadJson(mPath);

  // Check no duplicates in questionnaire
  const qKeys = q.pages.flatMap(p => (p.fields || []).map(f => f.key));
  const seen = {};
  const dupes = qKeys.filter(k => seen[k] ? true : !(seen[k] = true));

  // Map key coverage
  const mKeys = new Set((m.fields || []).map(f => f.key));
  const qKeysSet = new Set(qKeys);

  // Keys in questionnaire but missing from map
  const orphanQ = [...qKeysSet].filter(k => !mKeys.has(k));
  // Keys in map but missing from questionnaire (these wouldn't get user values)
  const orphanM = [...mKeys].filter(k => k && !qKeysSet.has(k));

  // Generate test data + PDF
  spawnSync('node', ['scripts/generate-test-answers.js', form], { stdio: 'pipe' });
  const ans = `answers/${form}-all-fields.answers.json`;
  const pdfGen = spawnSync('node', ['scripts/generate-form-pdf.js', form, ans], { stdio: 'pipe' });
  const pdfPath = `generated-filled/${form}-output.pdf`;
  const pdfOk = pdfGen.status === 0 && fs.existsSync(pdfPath);
  const pdfSize = pdfOk ? fs.statSync(pdfPath).size : 0;

  return {
    form,
    ok: dupes.length === 0 && pdfOk,
    qFields: qKeys.length,
    qUnique: qKeysSet.size,
    mFields: (m.fields || []).length,
    mUnique: mKeys.size,
    duplicates: dupes.length,
    orphanQ: orphanQ.length,
    orphanM: orphanM.filter(k => k !== '').length,
    pdfSizeKB: Math.round(pdfSize / 1024)
  };
}

function main() {
  const results = PRIORITY.map(qaForm);
  console.log('Form'.padEnd(22), 'qFields qUnique mFields mUnique dupes orphQ orphM pdfKB ok');
  console.log('-'.repeat(95));
  results.forEach(r => {
    if (r.error) {
      console.log(r.form.padEnd(22), 'ERROR:', r.error);
      return;
    }
    console.log(
      r.form.padEnd(22),
      String(r.qFields).padStart(7),
      String(r.qUnique).padStart(7),
      String(r.mFields).padStart(7),
      String(r.mUnique).padStart(7),
      String(r.duplicates).padStart(5),
      String(r.orphanQ).padStart(5),
      String(r.orphanM).padStart(5),
      String(r.pdfSizeKB).padStart(5),
      r.ok ? 'PASS' : 'FAIL'
    );
  });
  const passed = results.filter(r => r.ok).length;
  console.log(`\n${passed}/${results.length} passed`);
}

main();
