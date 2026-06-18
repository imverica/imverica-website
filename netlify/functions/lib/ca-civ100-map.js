'use strict';
/**
 * CIV-100 — Request for Entry of Default (Application to Enter Default).
 * Used when the tenant files no Answer by the deadline: the landlord asks the
 * clerk to enter default + a clerk's judgment for possession (restitution of
 * the premises) and to include all tenants/subtenants/occupants.
 * County-agnostic. Field names VERBATIM from extract-ca-fields.js civ-100.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;
const C = 'CIV-100[0].Page1[0].P1Caption[0].';
const P1 = 'CIV-100[0].Page1[0].';
const P2 = 'CIV-100[0].Page2[0].';
const P3 = 'CIV-100[0].Page3[0].';
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function money(v) { const s = String(v == null ? '' : v).replace(/[^0-9.]/g, ''); return s || ''; }

function civ_100FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);
  const hasAtty = !!pick(a, 'filer_bar_number');

  // Caption (In-Pro-Per).
  v[C + 'AttyInfo[0].AttyName[0]'] = plaintiff;
  v[C + 'AttyInfo[0].AttyStreet[0]'] = clean(pick(a, 'plaintiff_address_line1', 'mailing_address_line1'), 80);
  v[C + 'AttyInfo[0].AttyCity[0]'] = clean(pick(a, 'plaintiff_city', 'mailing_city'), 60);
  v[C + 'AttyInfo[0].AttyState[0]'] = clean(pick(a, 'plaintiff_state'), 20);
  v[C + 'AttyInfo[0].AttyZip[0]'] = clean(pick(a, 'plaintiff_zip'), 12);
  v[C + 'AttyInfo[0].Phone[0]'] = clean(pick(a, 'plaintiff_phone', 'phone'), 30);
  v[C + 'AttyInfo[0].Email[0]'] = clean(pick(a, 'plaintiff_email', 'email'), 120);
  v[C + 'AttyInfo[0].AttyFor[0]'] = hasAtty ? clean(pick(a, 'attorney_for'), 60) : 'In Pro Per (Self-Represented)';
  v[C + 'CourtInfo[0].CrtCounty[0]'] = clean(pick(a, 'court_county'), 60);
  v[C + 'CourtInfo[0].Street[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[C + 'CourtInfo[0].CityZip[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[C + 'TitlePartyName[0].Party1[0]'] = plaintiff;
  v[C + 'TitlePartyName[0].Party2[0]'] = defList[0] || '';
  v[P2 + 'pXHeader[0].TitlePartyName[0].Party1[0]'] = plaintiff;
  v[P2 + 'pXHeader[0].TitlePartyName[0].Party2[0]'] = defList[0] || '';
  v[P3 + 'pXHeader[0].TitlePartyName[0].Party1[0]'] = plaintiff;
  v[P3 + 'pXHeader[0].TitlePartyName[0].Party2[0]'] = defList[0] || '';

  // Form title — request BOTH Entry of Default and Clerk's Judgment (the UD
  // default-for-possession path: clerk enters the default, then a clerk's
  // judgment for restitution of the premises under CCP § 1169).
  v[C + 'FormTitle[0].CheckBox12436234346[0]'] = true;   // Entry of Default
  v[C + 'FormTitle[0].CheckBox12345125q[0]'] = true;     // Clerk's Judgment
  // Item 1 — instructions to the clerk.
  // 1b — name of the party who filed the complaint (the plaintiff).
  if (plaintiff) v[P1 + 'List1[0].Lib[0].FillText99[0]'] = plaintiff;
  // 1c — enter default of the named defendant(s).
  if (defList.length) {
    v[P1 + 'List1[0].Lic[0].CheckBox9[0]'] = true;
    v[P1 + 'List1[0].Lic[0].TextField6[0]'] = defList.join('; ');
  }
  // Item 1e — enter clerk's judgment for restitution of the premises (possession)
  // + include all tenants/subtenants/occupants (UD default for possession).
  v[P1 + 'List1[0].Lie[0].CheckBox7[0]'] = true;
  v[P1 + 'List1[0].Lie[0].LIE[0].SubLi1[0].CheckBox6[0]'] = true;
  v[P1 + 'List1[0].Lie[0].LIE[0].SubLi1[0].CheckBox5[0]'] = true;
  // Demand of the complaint (amount + credits) when seeking past-due rent.
  const due = money(pick(a, 'rent_due_amount', 'amount_owed', 'amount_demanded'));
  if (due) v[P1 + 'List2[0].SubLia[0].FillText68[0]'] = due;

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== '')));
}
module.exports = { civ_100FieldValues };
