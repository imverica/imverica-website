'use strict';
/**
 * CR-180 (Petition for Dismissal) + CR-181 (Order) statewide expungement fill
 * regression. Builds via the production registry (getBuilder) + fills the
 * decrypted templates via the engine; asserts 0 skipped, In-Pro-Per caption,
 * the §1203.4 (Item 2) checkbox logic, the conviction table, and CR-181 caption.
 * Synthetic data only (mirrors a real Placer DUI exemplar; no PII).
 * Run: node scripts/qa-cr180-fill.js
 */
const fs = require('fs');
const path = require('path');
const { getBuilder } = require('../netlify/functions/lib/ca-court-registry');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');

const CA = path.resolve(__dirname, '..', 'assets', 'form-cache', 'ca-court');
let fails = 0;
const chk = (n, c) => { console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + n); if (!c) fails++; };

const answers = {
  petitioner_name: 'IVAN PETROV', petitioner_address_line1: '1480 Morning Glory Ln',
  petitioner_city: 'Roseville', petitioner_state: 'CA', petitioner_zip: '95747',
  petitioner_phone: '(916) 555-0142', petitioner_email: 'ivan.petrov@example.com',
  case_number: '62-194275', county: 'Placer',
  court_street: '10820 Justice Center Drive', court_mailing: '10820 Justice Center Drive', court_city_zip: 'Roseville 95678',
  conviction_date: 'Mar 4, 2024',
  offenses: [
    { code: 'Vehicle Code', section: '23152(a)', type: 'Misdemeanor', eligible_17b: 'No', eligible_17d2: 'No' },
    { code: 'Vehicle Code', section: '23152(b)', type: 'Misdemeanor', eligible_17b: 'No', eligible_17d2: 'No' }
  ],
  relief_basis: '1203.4', item2_discharged: 'yes', item2_interests: 'yes',
  item2_narrative: 'Defendant completed all court-ordered requirements, paid all fines, had no probation violations, and probation was terminated early. Relief is requested in the interests of justice.'
};

(async () => {
  const b180 = getBuilder('CR-180'); const b181 = getBuilder('CR-181');
  chk('CR-180 + CR-181 registered in registry', Boolean(b180 && b181));
  const v = b180.build({ formAnswers: answers });

  // Caption / In-Pro-Per
  chk('caption name + In-Pro-Per', v['CR-180[0].Page1[0].P1Caption[0].AttyPartyInfo[0].Name[0]'] === 'IVAN PETROV'
    && v['CR-180[0].Page1[0].P1Caption[0].AttyPartyInfo[0].AttyFor[0]'] === 'IVAN PETROV, In Pro Per');
  chk('court county = PLACER, case number set', v['CR-180[0].Page1[0].P1Caption[0].CourtInfo[0].CrtCounty[0]'] === 'PLACER'
    && v['CR-180[0].Page1[0].P1Caption[0].HeaderSub[0].Stmp[0].CaseNumber[0].CaseNumber1[0]'] === '62-194275');
  // Item 1 conviction table
  chk('conviction date + row1/row2 offenses', v['CR-180[0].Page1[0].LI1[0].li1[0].ConvictionDate[0]'] === 'Mar 4, 2024'
    && v['CR-180[0].Page1[0].LI1[0].li1[0].ConvTable[0].Row1[0].Section1[0]'] === '23152(a)'
    && v['CR-180[0].Page1[0].LI1[0].li1[0].ConvTable[0].Row2[0].Section2[0]'] === '23152(b)'
    && v['CR-180[0].Page1[0].LI1[0].li1[0].ConvTable[0].Row1[0].Reduce1[0]'] === 'No');
  // Item 2 (§1203.4): main + 2b + 2c checked, 2a NOT
  chk('Item 2 (1203.4): main + 2b discharged + 2c interests checked, 2a NOT',
    v['CR-180[0].Page1[0].LI2[0].ProbationGranted[0]'] === true
    && v['CR-180[0].Page1[0].LI2[0].li2b[0].ProbationGrantedReason[0]'] === true
    && v['CR-180[0].Page1[0].LI2[0].li2c[0].ProbationGrantedReason[0]'] === true
    && v['CR-180[0].Page1[0].LI2[0].li2a[0].ProbationGrantedReason[0]'] !== true);
  chk('Item 2c narrative present', /interests of justice/i.test(v['CR-180[0].Page1[0].LI2[0].li2c[0].TextField6[0]'] || ''));
  chk('signature print name set, date blank', v['CR-180[0].Page3[0].SigName[0]'] === 'IVAN PETROV' && !v['CR-180[0].Page3[0].SigDate[0]']);

  // Engine fill (0 skipped) against the real decrypted templates.
  const tpl180 = path.join(CA, 'cr-180.pdf');
  if (!fs.existsSync(tpl180)) { console.log('  SKIP — cr-180.pdf template not on disk.'); }
  else {
    const res = await fillCourtForm(fs.readFileSync(tpl180), v);
    chk('CR-180 fills via engine, 0 skipped (filled=' + res.filled.length + ')', res.skipped.length === 0 && res.filled.length === Object.keys(v).length);
  }
  const v181 = b181.build({ formAnswers: answers });
  chk('CR-181 caption defendant + case number', v181['CR-181[0].Page1[0].Caption[0].TitlePartyName[0].Party1[0]'] === 'IVAN PETROV'
    && v181['CR-181[0].Page1[0].Caption[0].HeaderSub[0].CaseNumber[0].CaseNumber2[0]'] === '62-194275');
  const tpl181 = path.join(CA, 'cr-181.pdf');
  if (fs.existsSync(tpl181)) {
    const res2 = await fillCourtForm(fs.readFileSync(tpl181), v181);
    chk('CR-181 fills via engine, 0 skipped (filled=' + res2.filled.length + ')', res2.skipped.length === 0 && res2.filled.length === Object.keys(v181).length);
  }

  console.log('\n' + (fails ? ('*** ' + fails + ' FAILED ***') : 'ALL CR-180/181 CHECKS PASSED'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
