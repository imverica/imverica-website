'use strict';
/**
 * CM-010 — Civil Case Cover Sheet. Filed WITH UD-100 to start the case.
 * For an unlawful detainer the case type is "Unlawful Detainer — Residential
 * (32)" or "Commercial (31)". County-agnostic; In-Pro-Per caption.
 * Field names VERBATIM from scripts/extract-ca-fields.js cm-010.
 */

const { _fmt } = require('./ca-caption');
const { clean } = _fmt;

const C = 'CM-010[0].Page1[0].P1Caption[0].';
const L1 = 'CM-010[0].Page1[0].List1[0].Li8[0].';

function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function lc(v) { return String(v || '').toLowerCase(); }

function cm_010FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};

  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);
  const hasAtty = !!pick(a, 'filer_bar_number');

  // ── Caption — In-Pro-Per. ──
  v[C + 'AttyPartyInfo[0].Name[0]'] = plaintiff;
  v[C + 'AttyPartyInfo[0].Street[0]'] = clean(pick(a, 'plaintiff_address_line1', 'petitioner_address_line1', 'mailing_address_line1'), 80);
  v[C + 'AttyPartyInfo[0].City[0]'] = clean(pick(a, 'plaintiff_city', 'petitioner_city', 'mailing_city'), 60);
  v[C + 'AttyPartyInfo[0].State[0]'] = clean(pick(a, 'plaintiff_state', 'petitioner_state'), 20);
  v[C + 'AttyPartyInfo[0].Zip[0]'] = clean(pick(a, 'plaintiff_zip', 'petitioner_zip'), 12);
  v[C + 'AttyPartyInfo[0].Phone[0]'] = clean(pick(a, 'plaintiff_phone', 'petitioner_phone', 'phone'), 30);
  v[C + 'AttyPartyInfo[0].Email[0]'] = clean(pick(a, 'plaintiff_email', 'petitioner_email', 'email'), 120);
  v[C + 'AttyPartyInfo[0].AttyFor[0]'] = hasAtty ? clean(pick(a, 'attorney_for'), 60) : 'In Pro Per (Self-Represented)';
  if (hasAtty) v[C + 'AttyPartyInfo[0].AttyBarNo[0]'] = clean(a.filer_bar_number, 12);

  // ── Court (county-agnostic). ──
  v[C + 'CourtInfo[0].CrtCounty[0]'] = clean(pick(a, 'court_county'), 60);
  v[C + 'CourtInfo[0].CrtStreet[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[C + 'CourtInfo[0].CrtCityZip[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[C + 'CourtInfo[0].CrtBranch[0]'] = clean(pick(a, 'court_branch_name'), 80);

  // ── Case name (CM-010 has a single "CASE NAME:" line: Plaintiff v. Defendant). ──
  v[C + 'TitlePartyName[0].Party1[0]'] = plaintiff + (defList[0] ? ' v. ' + defList[0] : '');

  // ── Limited vs Unlimited (same threshold as UD-100 jurisdiction): demand
  //    ≤ $35,000 → Limited; otherwise Unlimited. ──
  const demand = Number(String(pick(a, 'amount_demanded', 'rent_due_amount', 'amount_owed') || '').replace(/[^0-9.]/g, '')) || 0;
  v[C + 'FormTitle[0].Civil[0].limited1[' + (demand > 35000 ? '0' : '1') + ']'] = true;

  // ── Item 1 — case type: Unlawful Detainer (Residential 32 / Commercial 31). ──
  if (/commercial/.test(lc(pick(a, 'property_type')))) v[L1 + 'CheckBox31[0]'] = true;
  else v[L1 + 'CheckBox32[0]'] = true;  // residential (default)

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== '')));
}

module.exports = { cm_010FieldValues };
