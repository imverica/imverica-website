'use strict';
/**
 * QA — official form registry (lib/form-registry.js).
 * Run: node scripts/qa-form-registry.js (exit 0 = pass)
 */
const { getFormProfile, listFormProfiles } = require('../netlify/functions/lib/form-registry');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { console.log('  ✓', m); pass++; } else { console.error('  ✗', m); fail++; } };

console.log('\n=== form-registry QA ===\n');

// Spec priority forms must resolve with verified official sources.
const USCIS_PRIORITY = ['I-765', 'I-589', 'I-485', 'I-130', 'I-751', 'N-400', 'I-864', 'I-131', 'I-693', 'I-90'];
for (const code of USCIS_PRIORITY) {
  const p = getFormProfile(code);
  ok(p && p.agency === 'USCIS', `${code} resolves as USCIS`);
  ok(p && p.officialPageUrl && p.officialPageUrl.includes('uscis.gov'), `${code} has official uscis.gov source`);
  ok(p && p.editionDate, `${code} has an edition date`);
  ok(p && p.mapping_status === 'verified-map', `${code} mapping_status = verified-map`);
}

const EOIR = ['EOIR-28', 'EOIR-42A', 'EOIR-42B'];
for (const code of EOIR) {
  const p = getFormProfile(code);
  ok(p && p.agency === 'EOIR', `${code} resolves as EOIR`);
}

const CA = ['FL-100', 'FL-110', 'FL-120', 'FL-105', 'FL-150', 'SC-100', 'SC-104', 'SC-120', 'UD-100', 'UD-105', 'DV-100', 'CH-100', 'EA-100', 'NC-100', 'DE-111', 'GC-210'];
for (const code of CA) {
  const p = getFormProfile(code);
  ok(p && p.agency === 'California Judicial Council', `${code} resolves as CA Judicial Council`);
  ok(p && p.officialPageUrl && /courts\.ca\.gov/.test(p.officialPageUrl), `${code} has official courts.ca.gov source`);
}
ok(getFormProfile('FL-100').mapping_status === 'direct-schema', 'FL-100 is generatable (direct-schema)');
ok(getFormProfile('NC-100').mapping_status === 'direct-schema', 'NC-100 is generatable (downloaded this phase)');

// Checklists exist for the two MVP forms and only state document lists.
const i765 = getFormProfile('I-765');
ok(Array.isArray(i765.packetChecklist) && i765.packetChecklist.length >= 5, 'I-765 packet checklist present');
ok(Array.isArray(i765.qcChecklist) && i765.qcChecklist.length >= 5, 'I-765 QC checklist present');
const i589 = getFormProfile('I-589');
ok(Array.isArray(i589.packetChecklist) && i589.packetChecklist.some((x) => /no filing fee/i.test(x)), 'I-589 checklist notes no filing fee');

// Never invent: unknown forms are null, never fabricated.
ok(getFormProfile('XX-999') === null, 'unknown form returns null (never fabricated)');

// Form-number standard: every code in the registry keeps its hyphen.
const all = listFormProfiles();
ok(all.length > 300, `registry covers ${all.length} forms (>300)`);
ok(all.every((p) => /^[A-Z]+(-[0-9A-Z]+)+$|^[A-Z]+-[0-9]+[A-Z]?$/.test(p.code) || p.code.includes('-')), 'every code uses the official hyphenated number');
const blocked = all.filter((p) => p.mapping_status === 'blocked').length;
const verified = all.filter((p) => p.mapping_status === 'verified-map').length;
const direct = all.filter((p) => p.mapping_status === 'direct-schema').length;
console.log(`\n  coverage: ${verified} verified-map · ${direct} direct-schema · ${all.length - verified - direct - blocked} catalog-only · ${blocked} blocked`);

console.log(`\n=== Passed: ${pass}  Failed: ${fail} ===\n`);
process.exit(fail ? 1 : 0);
