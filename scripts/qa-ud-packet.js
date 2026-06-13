'use strict';
/**
 * QA — California Unlawful Detainer packet completeness.
 *
 * Guards the highest-stakes failure mode: an incomplete or wrong set of forms
 * reaching the court clerk. Asserts that every form in the authoritative UD
 * packet spec (lib/ud-packet-spec.js) is in the catalog, is generatable, and
 * that the mandatory filing forms (Summons, Complaint, mandatory cover sheet,
 * civil cover sheet) are all present. Also fills each form end-to-end to prove
 * the template really produces a PDF.
 *
 * Run: node scripts/qa-ud-packet.js  (exit 0 = pass)
 */
const fs = require('fs');
const path = require('path');
const { buildUdPacket, allSpecCodes } = require('../netlify/functions/lib/ud-packet-spec');
const { getAllCourtForm } = require('../netlify/functions/lib/ca-all-court-catalog');
const { getDirectCourtSchema } = require('../netlify/functions/lib/ca-court-direct-schema');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { console.log('  ✓', m); pass++; } else { console.error('  ✗', m); fail++; } };

// The forms a residential UD filing cannot be opened without.
const MANDATORY_TO_FILE = ['CM-010', 'SUM-130', 'UD-100', 'UD-101'];
// Forms that complete the case through eviction.
const CRITICAL_DOWNSTREAM = ['CIV-100', 'UD-110', 'EJ-130'];

(async () => {
  console.log('\n=== California Unlawful Detainer packet QA ===\n');

  // 1. Spec ↔ catalog completeness.
  const codes = allSpecCodes();
  const missing = codes.filter((c) => !getAllCourtForm(c));
  ok(missing.length === 0, `every spec form is in the catalog (${codes.length} forms)` + (missing.length ? ` — MISSING: ${missing.join(', ')}` : ''));
  const notGen = codes.filter((c) => { const f = getAllCourtForm(c); return f && f.role !== 'prepare'; });
  ok(notGen.length === 0, 'every spec form is generatable (role:prepare)' + (notGen.length ? ` — NOT: ${notGen.join(', ')}` : ''));

  // 2. The clerk-window mandatory set.
  for (const c of MANDATORY_TO_FILE) {
    const f = getAllCourtForm(c);
    ok(f && f.role === 'prepare', `mandatory-to-file present + generatable: ${c} — ${f ? f.title.slice(0, 40) : 'MISSING'}`);
  }
  // 3. Downstream critical forms.
  for (const c of CRITICAL_DOWNSTREAM) {
    const f = getAllCourtForm(c);
    ok(f && f.role === 'prepare', `downstream form present: ${c} — ${f ? f.title.slice(0, 40) : 'MISSING'}`);
  }

  // 4. Stage ordering sanity: file → serve → respond → default/trial → enforce.
  const pkt = buildUdPacket(getAllCourtForm);
  const order = pkt.stages.map((s) => s.id);
  ok(JSON.stringify(order) === JSON.stringify(['file', 'serve', 'respond', 'default', 'trial', 'enforce']), `stages in correct order: ${order.join(' → ')}`);
  // The summons must live in the FILE stage (served at the start, never later).
  const fileCodes = pkt.stages.find((s) => s.id === 'file').forms.map((f) => f.code);
  ok(fileCodes.includes('SUM-130') && fileCodes.includes('UD-100') && fileCodes.includes('UD-101'),
    'FILE stage carries SUM-130 + UD-100 + UD-101');
  // The writ must live in the ENFORCE stage (only after judgment).
  const enforceCodes = pkt.stages.find((s) => s.id === 'enforce').forms.map((f) => f.code);
  ok(enforceCodes.includes('EJ-130'), 'ENFORCE stage carries EJ-130 (writ of possession)');
  // UD-105 (Answer) is the tenant's form — must not sit in a landlord filing stage.
  ok(pkt.stages.find((s) => s.id === 'respond').forms.some((f) => f.code === 'UD-105' && f.who === 'tenant'),
    'UD-105 (Answer) is correctly the tenant form in the RESPOND stage');

  // 5. End-to-end generation of every generatable spec form.
  const slugFor = (c) => (getAllCourtForm(c).slug || c.toLowerCase());
  for (const c of codes) {
    const f = getAllCourtForm(c);
    if (!f || f.role !== 'prepare') continue;
    const slug = slugFor(c);
    const tpl = path.join(ROOT, 'assets/form-cache/ca-court', `${slug}.pdf`);
    if (!fs.existsSync(tpl)) { ok(false, `${c}: decrypted template present`); continue; }
    try {
      const schema = await getDirectCourtSchema(slug, f.title, {});
      const vals = {};
      (schema.fields || []).filter((x) => x.type === 'text').slice(0, 4).forEach((x, i) => { vals[x.id] = 'QA ' + (i + 1); });
      const out = await fillCourtForm(fs.readFileSync(tpl), vals);
      const buf = out.buffer || out;
      ok(Buffer.isBuffer(buf) && buf.subarray(0, 5).toString() === '%PDF-' && schema.fieldCount > 0,
        `${c} generates (${schema.fieldCount} fields → ${Math.round(buf.length / 1024)} KB)`);
    } catch (e) { ok(false, `${c} generation: ${e.message}`); }
  }

  console.log(`\n=== Passed: ${pass}  Failed: ${fail} ===\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
