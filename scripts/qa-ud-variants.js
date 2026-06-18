'use strict';
/**
 * UD packet variant matrix — asserts the fill maps flip the RIGHT fields across
 * the branches the wizard can produce (notice types, service methods, just
 * cause, TPA, overflow, jurisdiction, denial threshold, forfeiture election).
 * Pure logic check (no PDF render) — fast regression guard for the maps.
 * Synthetic data only (no PII). Run: node scripts/qa-ud-variants.js
 */
const ud100 = require('../netlify/functions/lib/ca-ud100-map').ud_100FieldValues;
const ud105 = require('../netlify/functions/lib/ca-ud105-map').ud_105FieldValues;
const cm010 = require('../netlify/functions/lib/ca-cm010-map').cm_010FieldValues;

const base = {
  plaintiff_name: 'P', defendant_name: 'D', plaintiff_type: 'individual',
  premises_address: '1 St, X, CA', premises_city: 'X', court_county: 'X',
  tenancy_start_date: '01/01/2025', rent_amount: '2000', agreement_type: 'written',
  notice_served_date: '02/01/2026', notice_expired_date: '02/04/2026'
};
const has = (v, k) => v[k] === true;
const find = (v, re) => Object.keys(v).filter((k) => re.test(k) && v[k] === true);
let fails = 0;
const chk = (name, cond) => { console.log((cond ? '  ok   ' : '  FAIL ') + name); if (!cond) fails++; };

console.log('\n[A] nonpayment / 3-day pay-or-quit / personal / at-fault / $10400 (limited)');
let v = ud100({ formAnswers: { ...base, amount_demanded: '10400', rent_due_amount: '10400', daily_rental_value: '86', notice_type: '3-day notice to pay rent or quit', service_method: 'personal', subject_to_tpa: 'yes', just_cause: 'at-fault', notice_election_forfeiture: 'yes' } });
chk('limited civil box', has(v, 'UD-100[0].Page1[0].CheckAll[0].Action[0]'));
chk('ActionDemand exceeds-10k', has(v, 'UD-100[0].Page1[0].CheckAll[0].ActionDemand[1]'));
chk('notice=3day-pay (Li1)', find(v, /List9.*Li1\[0\]\.SevenA16/).length === 1);
chk('service=personal (Li1 EightA12)', has(v, 'UD-100[0].Page3[0].List10[0].Lia[0].SubLista[0].Li1[0].EightA12[0]'));
chk('8a at-fault', has(v, 'UD-100[0].Page2[0].List8[0].Lia[0].#area[0].TwoAc[0]'));
chk('9d forfeiture elected', has(v, 'UD-100[0].Page3[0].List9[0].Lid[0].#area[0].SevenD[0]'));
chk('item20 prayer-c past-due', has(v, 'UD-100[0].Page4[0].List20[0].Lic[0].Seventeenc2[0]'));
chk('item20 prayer-e forfeiture', has(v, 'UD-100[0].Page4[0].List20[0].Lie[0].Seventeene[0]'));
chk('no overflow', !v._overflow);

console.log('\n[B] no-fault / 60-day / mail / month-to-month / TPA');
v = ud100({ formAnswers: { ...base, amount_demanded: '0', notice_type: '60-day notice to quit', service_method: 'mail', subject_to_tpa: 'yes', just_cause: 'no-fault', tenancy_type: 'month-to-month' } });
chk('notice=60day (Li3)', has(v, 'UD-100[0].Page2[0].List9[0].Lia[0].SubLista[0].Li3[0].SevenA16[0]'));
chk('service=mail (Li4)', has(v, 'UD-100[0].Page3[0].List10[0].Lia[0].SubLista[0].Li4[0].Eighta4[0]'));
chk('8b no-fault', has(v, 'UD-100[0].Page2[0].List8[0].Lib[0].#area[0].TwoAb[0]'));
chk('6a month-to-month', has(v, 'UD-100[0].Page2[0].List6[0].Lia[0].SubLista[0].Li1[0].SixA1[0]'));

console.log('\n[C] covenant breach / 3-day perform-or-quit / posting / TPA-exempt');
v = ud100({ formAnswers: { ...base, amount_demanded: '0', notice_type: '3-day notice to perform covenants or quit', service_method: 'posting', subject_to_tpa: 'no' } });
chk('notice=covenants (Li6)', has(v, 'UD-100[0].Page2[0].List9[0].Lia[0].SubLista[0].Li6[0].SevenA16[0]'));
chk('service=posting (Li3 EightA3)', has(v, 'UD-100[0].Page3[0].List10[0].Lia[0].SubLista[0].Li3[0].EightA3[0]'));
chk('7a NOT subject to TPA', has(v, 'UD-100[0].Page2[0].List7[0].Lia[0].CBChoice1_cb1[0]'));

console.log('\n[D] multiple defendants → overflow MC-025');
v = ud100({ formAnswers: { ...base, defendants: ['Al', 'Bo', 'Cy', 'Di'], amount_demanded: '5000', notice_type: '3-day notice to pay rent or quit', service_method: 'personal', notices_differ_per_defendant: 'yes' } });
chk('9f overflow box', has(v, 'UD-100[0].Page3[0].List9[0].Lif[0].#area[0].SevenF[0]'));
chk('10c attachment box', has(v, 'UD-100[0].Page3[0].List10[0].LI3[0].#area[0].Eightc[0]'));
chk('_overflow has 4 defendants', v._overflow && v._overflow.defendants.length === 4);
chk('9a shows et al.', /et al\./.test(v['UD-100[0].Page2[0].List9[0].Lia[0].#area[0].fl1001\\.324[0]'] || ''));

console.log('\n[E] unlimited civil ($40k)');
v = ud100({ formAnswers: { ...base, amount_demanded: '40000', rent_due_amount: '40000', notice_type: '3-day notice to pay rent or quit', service_method: 'personal' } });
chk('unlimited box', has(v, 'UD-100[0].Page1[0].CheckAll[0].Action[1]'));
chk('NOT limited', !has(v, 'UD-100[0].Page1[0].CheckAll[0].Action[0]'));
const c = cm010({ formAnswers: { ...base, amount_demanded: '40000', property_type: 'residential' } });
chk('CM-010 unlimited (limited1[0])', has(c, 'CM-010[0].Page1[0].P1Caption[0].FormTitle[0].Civil[0].limited1[0]'));

console.log('\n[F] UD-105 denial threshold');
let a = ud105({ formAnswers: { plaintiff_name: 'P', tenant_name: 'D', rent_due_amount: '800' } });
chk('2a general denial (≤$1000)', has(a, 'UD-105[0].Page1[0].List2[0].Lia[0].Check1[0]'));
chk('NOT 2b specific', !has(a, 'UD-105[0].Page1[0].List2[0].Lib[0].Check1[0]'));
a = ud105({ formAnswers: { plaintiff_name: 'P', tenant_name: 'D', rent_due_amount: '9000' } });
chk('2b specific denial (>$1000)', has(a, 'UD-105[0].Page1[0].List2[0].Lib[0].Check1[0]'));

console.log('\n[G] forfeiture election OFF — 9d + prayer-e must NOT set');
v = ud100({ formAnswers: { ...base, amount_demanded: '10400', rent_due_amount: '10400', notice_type: '3-day notice to pay rent or quit', service_method: 'personal', notice_election_forfeiture: 'no' } });
chk('9d forfeiture NOT set', !has(v, 'UD-100[0].Page3[0].List9[0].Lid[0].#area[0].SevenD[0]'));
chk('prayer-e forfeiture NOT set', !has(v, 'UD-100[0].Page4[0].List20[0].Lie[0].Seventeene[0]'));

console.log('\n' + (fails ? ('*** ' + fails + ' FAILED ***') : 'ALL VARIANT CHECKS PASSED'));
process.exit(fails ? 1 : 0);
