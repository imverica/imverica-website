'use strict';
/**
 * UD-120 — Verification by Landlord Regarding Rental Assistance (Unlawful
 * Detainer). REQUIRED to get a DEFAULT JUDGMENT in a residential nonpayment
 * case: the landlord verifies, under penalty of perjury, the rental-assistance
 * statements already made in UD-100 item 11. Filer = landlord (plaintiff),
 * In-Pro-Per. The substantive facts are on UD-100; this form is the sworn
 * verification + identity, so the fillable content is the caption, the
 * landlord's name (item 1), and the printed signer name (date/signature left
 * for the client). County-agnostic. Field names VERBATIM from extract ud-120.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;
const C = 'UD-120[0].Page1[0].Page1[0].P1Caption[0].';
const P1 = 'UD-120[0].Page1[0].Page1[0].';
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }

function ud_120FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);
  const hasAtty = !!pick(a, 'filer_bar_number');

  // Caption (In-Pro-Per landlord).
  v[C + 'AttyPartyInfo[0].Name[0]'] = plaintiff;
  v[C + 'AttyPartyInfo[0].Street[0]'] = clean(pick(a, 'plaintiff_address_line1', 'mailing_address_line1'), 80);
  v[C + 'AttyPartyInfo[0].City[0]'] = clean(pick(a, 'plaintiff_city', 'mailing_city'), 60);
  v[C + 'AttyPartyInfo[0].State[0]'] = clean(pick(a, 'plaintiff_state', 'state'), 20) || 'CA';
  v[C + 'AttyPartyInfo[0].Zip[0]'] = clean(pick(a, 'plaintiff_zip', 'mailing_zip'), 12);
  v[C + 'AttyPartyInfo[0].Phone[0]'] = clean(pick(a, 'plaintiff_phone', 'phone'), 30);
  v[C + 'AttyPartyInfo[0].Email[0]'] = clean(pick(a, 'plaintiff_email', 'email'), 120);
  if (hasAtty) v[C + 'AttyPartyInfo[0].AttyBarNo[0]'] = clean(a.filer_bar_number, 12);
  v[C + 'AttyPartyInfo[0].AttyFor[0]'] = hasAtty ? clean(pick(a, 'attorney_for'), 60) : 'In Pro Per (Self-Represented)';
  v[C + 'CourtInfo[0].CrtCounty[0]'] = clean(pick(a, 'court_county'), 60);
  v[C + 'CourtInfo[0].CrtStreet[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[C + 'CourtInfo[0].CrtCityZip[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[C + 'CourtInfo[0].CrtBranch[0]'] = clean(pick(a, 'court_branch_name'), 80);
  v[C + 'TitlePartyName[0].Party1[0]'] = plaintiff;
  v[C + 'TitlePartyName[0].Party2[0]'] = defList[0] || '';

  // Item 1 — "The landlord of the property at issue in this case is …".
  if (plaintiff) v[P1 + 'List1[0].item1[0].TextField1[0]'] = plaintiff;
  // Printed signer name (the declaration is signed + dated by the client).
  if (plaintiff) v[P1 + 'Sign[0].PrintName[0]'] = plaintiff;

  return Object.fromEntries(Object.entries(v).filter(([, val]) => typeof val === 'string' && val !== ''));
}
module.exports = { ud_120FieldValues };
