'use strict';
/**
 * San Diego CRM-319 (Petition to Terminate Probation) In-Pro-Per hand-map
 * regression. Fills the cached decrypted blank via the production engine and
 * asserts 0 failed fields + the key checkbox logic (felony vs misdemeanor,
 * 4th-Amendment-waiver / CPO, warrant, statutory max-term, court division) and
 * that the caption is In-Pro-Per (no attorney). Synthetic data only (no PII).
 * Run: node scripts/qa-crm319-fill.js
 */
const fs = require('fs');
const path = require('path');
const { crm_319FieldValues } = require('../netlify/functions/lib/ca-crm319-map');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');

const TPL = path.resolve(__dirname, '..', 'astro-site', 'public', 'ca-local-templates', 'san-diego', 'crm-319-petition-to-terminate-probation.pdf');
const CB = 'topmostSubform[0].Page1[0].Petitioner_is_currently_serving_the_sentence_imposed_in_custody_or_on_parole_probation_mandatory_supervision_or';

let fails = 0;
const chk = (name, cond) => { console.log('  ' + (cond ? 'ok  ' : 'FAIL') + ' ' + name); if (!cond) fails++; };

const base = {
  petitioner_name: 'Ivan Petrov', petitioner_address_line1: '742 Ocean View Dr', petitioner_city: 'San Diego', petitioner_state: 'CA', petitioner_zip: '92101',
  petitioner_phone: '6195550142', petitioner_email: 'ivan.petrov@example.com', court_division: 'central',
  case_number: 'SCD299001', date_of_birth: '05/25/1980', conviction_offenses: 'Penal Code 242 (battery)',
  sentenced_date: '06/03/2004', probation_years: '3'
};

(async () => {
  // The decrypted blank lives in Netlify Blobs in prod and is gitignored
  // locally — skip cleanly (don't fail CI) when it isn't present on disk.
  if (!fs.existsSync(TPL)) {
    console.log('  SKIP — cached CRM-319 template not present on disk (lives in Netlify Blobs).');
    process.exit(0);
  }
  // Misdemeanor + 4A waiver + one-year, no CPO/warrant/felony.
  const a = { ...base, conviction_level: 'misdemeanor', fourth_amendment_waiver: 'yes', criminal_protective_order: 'no', outstanding_warrant: 'no', max_probation_term: 'one' };
  const v = crm_319FieldValues({ formAnswers: a });
  const res = await fillCourtForm(fs.readFileSync(TPL), v);
  chk('fills via engine, 0 failed (filled=' + res.filled.length + ')', res.filled.length > 0 && res.skipped.length === 0);
  chk('In-Pro-Per (no attorney): AttyFor = "Petitioner in Pro Per"', v['topmostSubform[0].Page1[0].TextField292[1]'] === 'Petitioner in Pro Per');
  chk('Central division checked', v['topmostSubform[0].Page1[0].Education[0]'] === true);
  chk('misdemeanor checked, felony NOT', v[CB + '[1]'] === true && v[CB + '[0]'] !== true);
  chk('4th Amendment Waiver checked, CPO NOT', v[CB + '[2]'] === true && v[CB + '[6]'] !== true);
  chk('outstanding warrant NOT checked', v[CB + '[7]'] !== true);
  chk('one-year max-term checked, two/three NOT', v[CB + '[3]'] === true && v[CB + '[4]'] !== true && v[CB + '[5]'] !== true);
  chk('print name set, declaration Date left blank', v['topmostSubform[0].Page1[0].TextField29[8]'] === 'Ivan Petrov' && !v['topmostSubform[0].Page1[0].TextField29[7]']);

  // Felony + warrant + three-year variant flips the right boxes.
  const b = { ...base, conviction_level: 'felony', outstanding_warrant: 'yes', max_probation_term: 'two', court_division: 'south' };
  const v2 = crm_319FieldValues({ formAnswers: b });
  chk('felony variant: felony checked, misd NOT, warrant checked, two-year, South div',
    v2[CB + '[0]'] === true && v2[CB + '[1]'] !== true && v2[CB + '[7]'] === true && v2[CB + '[4]'] === true && v2['topmostSubform[0].Page1[0].Education[3]'] === true);

  console.log('\n' + (fails ? ('*** ' + fails + ' FAILED ***') : 'ALL CRM-319 CHECKS PASSED'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
