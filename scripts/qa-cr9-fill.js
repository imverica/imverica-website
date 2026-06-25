'use strict';
/**
 * Sacramento CR-9 (Petition and Order Pursuant to Penal Code §§ 1203.3, 17(b))
 * overlay fill regression. CR-9 is a FLAT scanned PDF (no AcroForm fields), so
 * it is filled by coordinate overlay (lib/ca-cr9-overlay.js). This asserts the
 * checkbox logic (defendant-in-pro-per, felony vs misdemeanor, 1203.3
 * termination vs 17(b) reduction), that court-use sections are never touched,
 * and that the engine produces a PDF against the cached blank.
 * Synthetic data only (no PII). Run: node scripts/qa-cr9-fill.js
 */
const fs = require('fs');
const path = require('path');
const { cr_9Overlays, cr_9FillFlat } = require('../netlify/functions/lib/ca-cr9-overlay');

const TPL = path.resolve(__dirname, '..', 'astro-site', 'public', 'ca-local-templates', 'sacramento', 'cr-9-petition-to-terminate-probation.pdf');

let fails = 0;
const chk = (n, c) => { console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + n); if (!c) fails++; };
const has = (ov, k) => ov.some((o) => o.key === k);
const txt = (ov, k) => { const o = ov.find((x) => x.key === k); return o ? o.text : undefined; };

const base = {
  petitioner_name: 'Ivan Petrov', petitioner_address_line1: '742 Evergreen Ter',
  petitioner_city: 'Sacramento', petitioner_zip: '95814', petitioner_phone: '(916) 555-0142',
  case_number: '24FE001234', date_of_birth: '05/25/1985', convicted_on: '03/04/2024',
  violation_sections: 'Veh. Code 23152(a), 23152(b)', executed_on: '06/21/2026'
};

(async () => {
  // Variant A: misdemeanor + default (terminate probation under 1203.3).
  const a = cr_9Overlays({ formAnswers: { ...base, conviction_level: 'misdemeanor', terminate_probation: 'yes' } });
  chk('A: filer = defendant In Pro Per', has(a, 'cb_defendant') && txt(a, 'attorney_for') === 'Ivan Petrov, In Pro Per');
  chk('A: misdemeanor checked, felony NOT', has(a, 'cb_misd') && !has(a, 'cb_felony'));
  chk('A: 1203.3 termination checked, 17b NOT', has(a, 'cb_1203') && !has(a, 'cb_17b'));
  chk('A: caption + declaration text present',
    txt(a, 'defendant_name') === 'Ivan Petrov' && txt(a, 'case_number') === '24FE001234' && txt(a, 'print_name') === 'Ivan Petrov');

  // Variant B: felony + 17(b) reduction, NO probation termination.
  const b = cr_9Overlays({ formAnswers: { ...base, conviction_level: 'felony', terminate_probation: 'no', reduce_felony_17b: 'yes' } });
  chk('B: felony checked, misd NOT', has(b, 'cb_felony') && !has(b, 'cb_misd'));
  chk('B: 17b checked, 1203.3 NOT', has(b, 'cb_17b') && !has(b, 'cb_1203'));

  // Court-use sections (HEARING / ORDER / judge) are never overlaid.
  chk('court-use sections never overlaid', !a.some((o) => /hearing|order|judge|grant|den/i.test(o.key)));

  // Render against the cached blank (skip cleanly if not on disk — lives in Blobs).
  if (!fs.existsSync(TPL)) {
    console.log('  SKIP — cached CR-9 blank not on disk (lives in Netlify Blobs).');
  } else {
    const res = await cr_9FillFlat(fs.readFileSync(TPL), { formAnswers: { ...base, conviction_level: 'misdemeanor', terminate_probation: 'yes' } });
    chk('fills via engine, 0 skipped, PDF produced', res.skipped.length === 0 && res.buffer.length > 1000 && res.filled.length >= 14);
  }

  console.log('\n' + (fails ? ('*** ' + fails + ' FAILED ***') : 'ALL CR-9 CHECKS PASSED'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
