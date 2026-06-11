'use strict';
/**
 * QA — USCIS packet generator (lib/uscis-packet.js) using the test fixtures.
 * Verifies section order per Phase 11, page counts, valid output, and that
 * the form pages inside the packet still carry the filled values.
 * Run: node scripts/qa-uscis-packet.js (exit 0 = pass)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildUscisPacket } = require('../netlify/functions/lib/uscis-packet');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { console.log('  ✓', m); pass++; } else { console.error('  ✗', m); fail++; } };

function textOf(pdfPath, from, to) {
  try {
    const args = [];
    if (from) args.push('-f', String(from));
    if (to) args.push('-l', String(to));
    return execFileSync('pdftotext', [...args, pdfPath, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString();
  } catch { return null; } // poppler not installed — text checks soft-skip
}

(async () => {
  console.log('\n=== USCIS packet QA ===');

  for (const [file, expectSections] of [
    ['test-i-765.json', ['cover', 'form', 'checklist', 'evidence-index', 'review-instructions', 'filing-instructions']],
    ['test-i-589.json', ['cover', 'form', 'evidence-index', 'declaration-placeholder', 'country-conditions-placeholder', 'review-instructions', 'filing-instructions']]
  ]) {
    const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures', file), 'utf8'));
    console.log(`\n── ${fx.formCode} packet ──`);
    const out = await buildUscisPacket(fx.formCode, { formAnswers: fx.formAnswers, contact: fx.contact });

    ok(out.buffer.subarray(0, 5).toString('latin1') === '%PDF-', 'output is a valid PDF');
    ok(JSON.stringify(out.sections) === JSON.stringify(expectSections), `sections in spec order: ${out.sections.join(' → ')}`);
    ok(out.filledFields >= fx.expect.minFilled, `form inside packet carries ${out.filledFields} filled fields`);
    ok(out.pages >= expectSections.length + 1, `page count sane (${out.pages})`);

    const outPath = path.join(ROOT, 'decks/.build', `${fx.formCode.toLowerCase()}-packet-qa.pdf`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, out.buffer);

    const text = textOf(outPath);
    if (text) {
      ok(text.includes('DRAFT'), 'DRAFT banner present');
      ok(text.includes('not a law firm') || text.includes('not legal advice'), 'UPL-safe wording present');
      ok(text.includes('Kovalenko'), 'client name appears in packet');
      ok(text.includes(fx.formCode), 'official hyphenated form number appears');
      if (fx.formCode === 'I-589') ok(/no filing fee/i.test(text), 'I-589 no-fee note present');
      // Advisory-wording scan covers OUR pages only (cover + accessory tail) —
      // the official government form's own printed text legitimately says
      // "you must file" and is not Imverica wording.
      const accessoryTail = out.pages - (expectSections.length - 2); // sections minus cover+form, 1 page each
      const ours = (textOf(outPath, 1, 1) || '') + (textOf(outPath, accessoryTail + 1) || '');
      ok(!/you (should|must) file|we recommend/i.test(ours), 'no advisory wording on Imverica pages');
    } else {
      console.log('  (pdftotext unavailable — text assertions skipped)');
    }
    console.log(`  → wrote ${path.relative(ROOT, outPath)}`);
  }

  console.log(`\n=== Passed: ${pass}  Failed: ${fail} ===\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
