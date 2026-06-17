'use strict';
/**
 * UD-110 — Judgment, Unlawful Detainer. Filed by the landlord (mostly with the
 * default request) — pre-fills the caption + the "by default / clerk's judgment
 * for possession only" boxes. Money/possession details (items 4+) are entered
 * by the court. County-agnostic. Field names VERBATIM from extract ud-110.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;
const C = 'UD-110[0].Page1[0].P1Caption[0].';
const P1 = 'UD-110[0].Page1[0].';
const P2 = 'UD-110[0].Page2[0].';
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function lc(v) { return String(v || '').toLowerCase(); }

function ud_110FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);
  const hasAtty = !!pick(a, 'filer_bar_number');

  v[C + 'AttyPartyInfo[0].Name[0]'] = plaintiff;
  v[C + 'AttyPartyInfo[0].Street[0]'] = clean(pick(a, 'plaintiff_address_line1', 'mailing_address_line1'), 80);
  v[C + 'AttyPartyInfo[0].City[0]'] = clean(pick(a, 'plaintiff_city', 'mailing_city'), 60);
  v[C + 'AttyPartyInfo[0].State[0]'] = clean(pick(a, 'plaintiff_state'), 20);
  v[C + 'AttyPartyInfo[0].Zip[0]'] = clean(pick(a, 'plaintiff_zip'), 12);
  v[C + 'AttyPartyInfo[0].Phone[0]'] = clean(pick(a, 'plaintiff_phone', 'phone'), 30);
  v[C + 'AttyPartyInfo[0].Email[0]'] = clean(pick(a, 'plaintiff_email', 'email'), 120);
  v[C + 'AttyPartyInfo[0].AttyFor[0]'] = hasAtty ? clean(pick(a, 'attorney_for'), 60) : 'In Pro Per (Self-Represented)';
  v[C + 'CourtInfo[0].CrtCounty[0]'] = clean(pick(a, 'court_county'), 60);
  v[C + 'CourtInfo[0].CrtStreet[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[C + 'CourtInfo[0].CrtCityZip[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[C + 'CourtInfo[0].CrtBranch[0]'] = clean(pick(a, 'court_branch_name'), 80);
  v[C + 'TitlePartyName[0].Party1[0]'] = plaintiff;
  v[C + 'TitlePartyName[0].Party2[0]'] = defList[0] || '';
  v[P2 + 'PxCaption[0].TitlePartyName[0].Party1[0]'] = plaintiff;
  v[P2 + 'PxCaption[0].TitlePartyName[0].Party2[0]'] = defList[0] || '';

  // Title + item 1 — by default (the most common UD path) and, when the
  // landlord only seeks possession, a clerk's judgment for possession only.
  const byDefault = !/trial|contest/.test(lc(pick(a, 'judgment_basis')));
  if (byDefault) { v[C + 'FormTitle[0].RB2Choices[0]'] = true; v[P1 + 'List1[0].CheckBox1[0]'] = true; }
  if (/possession.?only|possession only/.test(lc(pick(a, 'judgment_scope'))) || byDefault) {
    v[C + 'FormTitle[0].RB2Choices[1]'] = true;
    v[P1 + 'List1[0].Lid[0].CheckBox10[0]'] = true;
  }

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== '')));
}
module.exports = { ud_110FieldValues };
