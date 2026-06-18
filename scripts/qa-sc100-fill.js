'use strict';
/**
 * Small Claims (SC-100 + MC-031) hand-map regression. Proves both forms resolve
 * through ca-court-registry and fill via the production engine with 0 failed
 * fields, plus the key logic: item-10 over-$2,500 is DERIVED from the amount,
 * a long item-3 overflows to MC-031, and the MC-031 declarant role is
 * Plaintiff (single) vs Other:Plaintiffs (joint). Synthetic data only (no PII).
 * Run: node scripts/qa-sc100-fill.js
 */
const fs = require('fs');
const path = require('path');
const { getBuilder } = require('../netlify/functions/lib/ca-court-registry');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');
const { mc_031FieldValues } = require('../netlify/functions/lib/ca-mc031-map');
const { sc_100FieldValues } = require('../netlify/functions/lib/ca-sc100-map');

const TPL = path.resolve(__dirname, '..', 'assets', 'form-cache', 'ca-court');
const base = {
  court_county: 'Sacramento', court_street_address: '301 Bicentennial Circle', court_city_zip: 'Sacramento, CA 95826',
  plaintiff_name: 'Ivan Petrov', plaintiff_phone: '9165550133', plaintiff_city: 'Sacramento', plaintiff_zip: '95826',
  defendant_name: 'Sunrise Rentals LLC', defendant_city: 'Fair Oaks', defendant_zip: '95628',
  claim_date_started: '11/01/2025', claim_date_through: '04/28/2026', venue_zip: '95670'
};
const longReason = 'Defendant failed to maintain the property in a habitable condition for an extended period. '.repeat(6);

let fails = 0;
const chk = (name, cond) => { console.log('  ' + (cond ? 'ok  ' : 'FAIL') + ' ' + name); if (!cond) fails++; };

(async () => {
  // 1) SC-100 + MC-031 fill via the registry + engine, 0 failed.
  for (const code of ['SC-100', 'MC-031']) {
    const entry = getBuilder(code);
    const fv = entry.build({ formAnswers: { ...base, plaintiff2_name: 'Maria Petrova', claim_amount: '9800', claim_reason: longReason, claim_calculation: 'Rent refund $7,000.00 + deposit $2,800.00 = $9,800.00' } });
    delete fv._overflow;
    const res = await fillCourtForm(fs.readFileSync(path.join(TPL, entry.slug + '.pdf')), fv);
    chk(code + ' fills via registry+engine, 0 failed (filled=' + res.filled.length + ')', res.filled.length > 0 && res.skipped.length === 0);
  }

  // 2) Item 10 — derived from amount.
  const big = sc_100FieldValues({ formAnswers: { ...base, plaintiff_name: 'A', claim_amount: '9800', claim_reason: 'x' } });
  const small = sc_100FieldValues({ formAnswers: { ...base, plaintiff_name: 'A', claim_amount: '900', claim_reason: 'x' } });
  chk('item10 = Yes when amount > $2,500', big['SC-100[0].Page4[0].List10[0].li10[0].Checkbox63[0]'] === true);
  chk('item10 = No when amount <= $2,500', small['SC-100[0].Page4[0].List10[0].li10[0].Checkbox63[1]'] === true);

  // 3) Overflow → MC-031 only when item 3 is long.
  const ovr = sc_100FieldValues({ formAnswers: { ...base, plaintiff_name: 'A', claim_amount: '9800', claim_reason: longReason } });
  const noOvr = sc_100FieldValues({ formAnswers: { ...base, plaintiff_name: 'A', claim_amount: '900', claim_reason: 'Short reason.' } });
  chk('long item 3 → overflow + "need more space" box', !!ovr._overflow && ovr['SC-100[0].Page3[0].List3[0].Checkbox1[0]'] === true);
  chk('short item 3 → no overflow', !noOvr._overflow);

  // 4) MC-031 declarant role: single vs joint plaintiffs.
  const one = mc_031FieldValues({ formAnswers: { plaintiff_name: 'Solo Plaintiff', defendant_name: 'D', claim_reason: 'x' } });
  const two = mc_031FieldValues({ formAnswers: { plaintiff_name: 'A', plaintiff2_name: 'B', defendant_name: 'D', claim_reason: 'x' } });
  chk('MC-031 single → Plaintiff box', one.CheckBox6 === true && !one.Ck6);
  chk('MC-031 joint → Other:Plaintiffs', two.Ck6 === true && two.FillText13 === 'Plaintiffs');

  console.log('\n' + (fails ? ('*** ' + fails + ' FAILED ***') : 'ALL SMALL-CLAIMS CHECKS PASSED'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
