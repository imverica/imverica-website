'use strict';
/**
 * POS-010 — Proof of Service of Summons. County-agnostic. We pre-fill the
 * caption, the documents served (Summons + Complaint), the party served, and
 * the address served. The manner of service, dates, and the server's own
 * declaration are completed by whoever actually serves the papers.
 * Field names VERBATIM from scripts/extract-ca-fields.js pos-010.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;
const C = 'POS-010[0].Page1[0].P1Caption[0].';
const P1 = 'POS-010[0].Page1[0].';
const P2 = 'POS-010[0].Page2[0].';
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }

function pos_010FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);
  const hasAtty = !!pick(a, 'filer_bar_number');

  // Caption (In-Pro-Per filer). TextField1 is the top "ATTORNEY OR PARTY
  // WITHOUT ATTORNEY (Name, State Bar number, and address)" box — it needs the
  // filer's NAME and address; "Nmae" (sic) is the separate "ATTORNEY FOR (Name)".
  const filerAddr = [clean(pick(a, 'plaintiff_address_line1', 'mailing_address_line1'), 80), [clean(pick(a, 'plaintiff_city', 'mailing_city'), 60), clean(pick(a, 'plaintiff_state'), 20), clean(pick(a, 'plaintiff_zip'), 12)].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  v[C + 'AttyPartyInfo[0].TextField1[0]'] = [plaintiff, filerAddr].filter(Boolean).join('\n');
  v[C + 'AttyPartyInfo[0].Nmae[0]'] = hasAtty ? clean(pick(a, 'attorney_for'), 60) : 'Plaintiff in Pro Per';
  v[C + 'AttyPartyInfo[0].Phone[0]'] = clean(pick(a, 'plaintiff_phone', 'phone'), 30);
  v[C + 'AttyPartyInfo[0].Email[0]'] = clean(pick(a, 'plaintiff_email', 'email'), 120);
  v[C + 'CourtInfo[0].CrtCounty[0]'] = clean(pick(a, 'court_county'), 60);
  v[C + 'CourtInfo[0].CrtStreet[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[C + 'CourtInfo[0].CrtCityZip[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[C + 'CourtInfo[0].CrtBranch[0]'] = clean(pick(a, 'court_branch_name'), 80);
  v[C + 'TitlePartyName[0].Party1[0]'] = plaintiff;
  v[C + 'TitlePartyName[0].Party2[0]'] = defList[0] || '';
  v[P2 + 'PxCaption[0].TitlePartyName[0].Party1[0]'] = plaintiff;
  v[P2 + 'PxCaption[0].TitlePartyName[0].Party2[0]'] = defList[0] || '';

  // Item 2 — documents served with the summons: the Summons itself + the
  // Complaint (both are served together to commence the action).
  v[P1 + 'List2[0].Lia[0].CheckBox1[0]'] = true;            // summons
  v[P1 + 'List2[0].Lib[0].CheckBox2[0]'] = true;            // complaint
  // Item 3a — party served = the defendant. Item 4 — address served = premises.
  v[P1 + 'List3[0].Lia[0].FillText1[0]'] = defList[0] || '';
  v[P1 + 'List4[0].item4[0].FillText18[0]'] = clean(pick(a, 'premises_address', 'rental_property_address'), 200);

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== '')));
}
module.exports = { pos_010FieldValues };
