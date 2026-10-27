// Forms with a legal document / unlawful detainer assistant block: the
// block is filled with the registration, "did" is ticked, every field exists
// in the template, and the address comes only from LDA_ADDRESS.
// Run: node scripts/qa-lda-disclosure.js
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { applyLdaDisclosure, BLOCKS, LDA_FORMS } = require('../netlify/functions/lib/lda-disclosure');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');

let failures = 0;
function check(ok, label) {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}

(async () => {
  for (const slug of LDA_FORMS) {
    const pdf = fs.readFileSync(path.join(__dirname, '..', 'assets/form-cache/ca-court', `${slug}.pdf`));
    const names = new Set((await PDFDocument.load(pdf, { ignoreEncryption: true })).getForm().getFields().map((field) => field.getName()));
    for (const [key, name] of Object.entries(BLOCKS[slug])) check(names.has(name), `${slug}: ${key} field exists`);
    const withAddress = applyLdaDisclosure(slug, {}, { LDA_ADDRESS: '100 Test Plaza, Sacramento, CA 95814' });
    check(withAddress.values[BLOCKS[slug].did] === true && withAddress.values[BLOCKS[slug].didNot] === false, `${slug}: "did" ticked`);
    check(withAddress.values[BLOCKS[slug].regNo] === '2026-010' && withAddress.missing.length === 0, `${slug}: registration filled`);
    const filled = await fillCourtForm(pdf, withAddress.values);
    check(filled.skipped.length === 0, `${slug}: fills without skipped fields`);
    const noAddress = applyLdaDisclosure(slug, {}, {});
    check(JSON.stringify(noAddress.missing) === '["address"]' && !(BLOCKS[slug].address in noAddress.values), `${slug}: no address without LDA_ADDRESS`);
  }
  check(applyLdaDisclosure('ud-100', { a: 1 }, { LDA_DISCLOSURE: 'off' }).values.a === 1 && Object.keys(applyLdaDisclosure('ud-100', {}, { LDA_DISCLOSURE: 'off' }).values).length === 0, 'LDA_DISCLOSURE=off');
  check(Object.keys(applyLdaDisclosure('fl-100', {}, {}).values).length === 0, 'forms without the block are untouched');
  console.log(failures ? `${failures} failed` : `LDA disclosure QA passed (${LDA_FORMS.length} forms)`);
  process.exit(failures ? 1 : 0);
})();
