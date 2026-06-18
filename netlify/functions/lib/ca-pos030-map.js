'use strict';
/**
 * POS-030 — Proof of Service by First-Class Mail (Civil). County-agnostic.
 * Pre-fills caption + parties; the documents mailed, person served, address,
 * and mailing date are completed by whoever mails the papers.
 * Field names VERBATIM from extract-ca-fields.js pos-030.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;
const C = 'POS-030[0].Page1[0].P1Caption[0].';
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }

function pos_030FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);
  const hasAtty = !!pick(a, 'filer_bar_number');

  // TextField1 = top "ATTORNEY OR PARTY WITHOUT ATTORNEY (Name ... and
  // address)" box (filer name + address); Name[0] is the "ATTORNEY FOR (Name)".
  const filerAddr = [clean(pick(a, 'plaintiff_address_line1', 'mailing_address_line1'), 80), [clean(pick(a, 'plaintiff_city', 'mailing_city'), 60), clean(pick(a, 'plaintiff_state'), 20), clean(pick(a, 'plaintiff_zip'), 12)].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  v[C + 'AttyPartyInfo[0].TextField1[0]'] = [plaintiff, filerAddr].filter(Boolean).join('\n');
  v[C + 'AttyPartyInfo[0].Name[0]'] = hasAtty ? clean(pick(a, 'attorney_for'), 60) : 'Plaintiff in Pro Per';
  v[C + 'AttyPartyInfo[0].Phone[0]'] = clean(pick(a, 'plaintiff_phone', 'phone'), 30);
  v[C + 'AttyPartyInfo[0].Email[0]'] = clean(pick(a, 'plaintiff_email', 'email'), 120);
  v[C + 'CourtInfo[0].CrtCounty[0]'] = clean(pick(a, 'court_county'), 60);
  v[C + 'CourtInfo[0].CrtStreet[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[C + 'CourtInfo[0].CrtCityZip[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[C + 'CourtInfo[0].CrtBranch[0]'] = clean(pick(a, 'court_branch_name'), 80);
  v[C + 'TitlePartyName[0].Party1[0]'] = plaintiff;
  v[C + 'TitlePartyName[0].Party2[0]'] = defList[0] || '';

  return Object.fromEntries(Object.entries(v).filter(([, val]) => typeof val === 'string' && val !== ''));
}
module.exports = { pos_030FieldValues };
