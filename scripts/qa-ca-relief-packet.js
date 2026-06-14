'use strict';
/**
 * QA — county-specific criminal-relief packet builder (lib/ca-relief-packet.js).
 * Across all 58 counties × 4 relief types: every packet is structurally valid,
 * forms are correctly separated (statewide vs local), generatable/download is
 * set, and no unrelated/wrong form leaks in.
 * Run: node scripts/qa-ca-relief-packet.js  (exit 0 = pass)
 */
const { RELIEF_TYPES, buildReliefPacket } = require('../netlify/functions/lib/ca-relief-packet');
const index = require('../assets/form-cache/ca-criminal-relief-index.json');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { console.error('  ✗', m); fail++; } };

// Forms that must never appear in a criminal-relief packet (unrelated).
const FORBIDDEN = new Set(['CR-100', 'SC-100', 'SC-135', 'AR-11', 'G-1055', 'FL-100', 'UD-100']);

console.log('\n=== CA relief packet QA (58 counties × 4 types) ===\n');

let built = 0;
const totals = { generatable: 0, local: 0, statewide: 0 };
for (const county of index.counties) {
  for (const reliefType of RELIEF_TYPES) {
    const pkt = buildReliefPacket(county.slug, reliefType);
    ok(pkt, `${county.name}/${reliefType}: packet built`);
    if (!pkt) continue;
    built++;
    const s = pkt.sections;
    // structural integrity
    ok(s && s.requiredStatewide && s.requiredLocal && s.optional && s.referenceOnly,
      `${county.name}/${reliefType}: all four sections present`);
    const everyForm = [...s.requiredStatewide, ...s.requiredLocal, ...s.optional, ...s.referenceOnly];
    for (const f of everyForm) {
      // Title is the required identifier; a few legitimate local forms have no
      // printed code (e.g. hand-seeded Sacramento reference docs).
      ok(f.title && f.scope && f.source, `${county.name}/${reliefType}: form ${f.code || '(no code)'} fully shaped`);
      // FORBIDDEN codes are only wrong as STATEWIDE forms — a county's own local
      // form may share a code (Napa local CR-100 ≠ statewide CR-100).
      ok(!(FORBIDDEN.has(f.code) && f.scope !== 'local'), `${county.name}/${reliefType}: no statewide forbidden form (${f.code})`);
      ok(f.source === 'generate' ? f.generatable : !f.generatable, `${county.name}/${reliefType}: ${f.code || '(no code)'} source/generatable consistent`);
    }
    // separation: statewide section holds only statewide scope; local only local
    ok(s.requiredStatewide.every((f) => f.scope === 'statewide'), `${county.name}/${reliefType}: statewide section is all statewide`);
    ok(s.requiredLocal.every((f) => f.scope === 'local' && f.localFormId), `${county.name}/${reliefType}: local section is all local w/ id`);
    ok(s.referenceOnly.every((f) => f.source === 'download'), `${county.name}/${reliefType}: reference items are download-only`);
    // record-cleanup must include the statewide CR-180/CR-181 vehicle
    if (reliefType === 'record-cleanup') {
      const codes = s.requiredStatewide.map((f) => f.code);
      ok(codes.includes('CR-180') && codes.includes('CR-181'), `${county.name}/record-cleanup: includes CR-180 + CR-181`);
    }
    // optional always offers the declaration + proof of service + fee waiver
    const optCodes = s.optional.map((f) => f.code);
    ok(['MC-030', 'POS-040', 'FW-001'].every((c) => optCodes.includes(c)), `${county.name}/${reliefType}: standard supporting forms offered`);
    totals.generatable += pkt.counts.generatable;
    totals.local += pkt.counts.requiredLocal;
    totals.statewide += pkt.counts.requiredStatewide;
  }
}

// Unknown county / bad relief type → null (never a fabricated packet).
ok(buildReliefPacket('atlantis', 'record-cleanup') === null, 'unknown county returns null');
ok(buildReliefPacket('placer', 'nonsense') === null, 'unknown relief type returns null');

// Spot-check: Placer probation-motion → its PL-CR003 local form present.
const placer = buildReliefPacket('placer', 'probation-motion');
ok(placer && placer.sections.requiredLocal.some((f) => /CR003/i.test(f.code)), 'Placer probation packet includes PL-CR003');

console.log(`\nbuilt ${built} packets (58×4=232 expected) | local forms: ${totals.local} | statewide: ${totals.statewide} | generatable slots: ${totals.generatable}`);
console.log(`\n=== Passed: ${pass}  Failed: ${fail} ===\n`);
process.exit(fail ? 1 : 0);
