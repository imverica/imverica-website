'use strict';
/**
 * UD-101 — Plaintiff's Mandatory Cover Sheet and Supplemental Allegations
 * (Unlawful Detainer). Mandatory for residential UD; filed WITH UD-100.
 * County-agnostic: court name/address/branch come from answers (works in all
 * 58 counties). In-Pro-Per: the caption's party block = the filer (no attorney).
 * Field names VERBATIM from scripts/extract-ca-fields.js ud-101.
 */

const { _fmt } = require('./ca-caption');
const { clean } = _fmt;

const P1 = 'UD-101[0].Page1[0].';
const P2 = 'UD-101[0].Page2[0].';
const C = P1 + 'P1Caption[0].';

function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function lc(v) { return String(v || '').toLowerCase(); }

function ud_101FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};

  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);
  const defInline = defList.slice(0, 2).join('; ') + (defList.length > 2 ? '; et al. (see Attachment)' : '');
  const hasAtty = !!pick(a, 'filer_bar_number');

  // ── Caption — In-Pro-Per party/atty block. ──
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

  // ── Party names (caption header + item 1 + page-2 running header). ──
  v[C + 'TitlePartyName[0].Party1[0]'] = plaintiff;
  v[C + 'TitlePartyName[0].Party2[0]'] = defList[0] || '';
  v[P1 + 'List1[0].item1[0].FillText1[0]'] = plaintiff;
  v[P1 + 'List1[0].item1[0].FillText2[0]'] = defInline;
  v[P2 + 'PxCaption[0].TitlePartyName[0].Party1[0]'] = plaintiff;
  v[P2 + 'PxCaption[0].TitlePartyName[0].Party2[0]'] = defList[0] || '';

  // ── Item 2a — residential (default for our clients) vs commercial. ──
  if (/commercial/.test(lc(pick(a, 'property_type')))) v[P1 + 'List2[0].Lia[0].Ch2[1]'] = true;
  else v[P1 + 'List2[0].Lia[0].Ch2[0]'] = true;

  // ── Item 12 — rental-assistance statements (required for nonpayment).
  //    Standard landlord answers: No / does not. ──
  const nonpayment = /pay rent|pay-or-quit|неуплат|оплат/.test(lc(pick(a, 'notice_type')));
  // Item 2b — is the action based (wholly/partly) on default in payment of rent?
  v[P1 + 'List2[0].Lib[0].Ch3[' + (nonpayment ? '0' : '1') + ']'] = true;
  if (nonpayment) {
    v[P1 + 'List12[0].CheckBox110[0]'] = true;
    v[P1 + 'List12[0].Lia[0].Yes25[1]'] = true;
    v[P1 + 'List12[0].Lib[0].Yes26[1]'] = true;
    v[P1 + 'List12[0].Lic[0].Yes27[1]'] = true;
    v[P1 + 'List12[0].Lid[0].Yes28[1]'] = true;
  }

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== '')));
}

module.exports = { ud_101FieldValues };
