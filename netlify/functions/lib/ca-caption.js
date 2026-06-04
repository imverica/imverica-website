'use strict';
/**
 * Shared caption builder for California Judicial Council forms.
 *
 * Every CA court form carries the same top "caption" block — filer/attorney
 * info, court, parties, case number — but each form names those fields
 * differently (FL-100 uses CaptionP1_sf, FL-120 Caption_sf, FL-105
 * P1Caption, UD-100 p1Caption, SC-100 CaptionRight, …). This module holds
 * a per-form REGISTRY mapping each semantic caption slot to that form's
 * actual AcroForm field name, plus buildCaption() which fills them from a
 * single standardized intake shape.
 *
 * All field names are taken verbatim from each form's AcroForm (see
 * scripts/extract-ca-fields.js). Per project rule, nothing is invented.
 *
 * Standard intake keys consumed (under payload.formAnswers):
 *   filer_name / petitioner_name / plaintiff_name      → party1 + atty NAME
 *   respondent_name / defendant_name                   → party2
 *   filer_firm_name, filer_bar_number, attorney_for
 *   petitioner_address_line1, petitioner_city, _state, _zip, _phone, _email
 *     (mailing_* used as fallback)
 *   court_county, court_street_address, court_mailing_address,
 *     court_city_zip, court_branch_name
 *   case_number
 */

// ── formatters (shared with the per-form maps) ────────────────────────
function clean(v, max = 200) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}
function stateCode(v) {
  const t = clean(v, 80);
  const m = t.match(/^([A-Za-z]{2})\b/);
  return m ? m[1].toUpperCase() : t.slice(0, 2).toUpperCase();
}
function digits(v, max = 20) { return clean(v, 80).replace(/\D/g, '').slice(0, max); }
function usPhone(v) {
  const d = digits(v, 11);
  const x = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return x.length === 10 ? `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}` : clean(v, 20);
}
function partyName(a, who) {
  const last = clean(a[`${who}_last_name`] || a[`${who}_family_name`], 60);
  const first = clean(a[`${who}_first_name`] || a[`${who}_given_name`], 60);
  const mid = clean(a[`${who}_middle_name`], 60);
  if (last && (first || mid)) return `${last}, ${[first, mid].filter(Boolean).join(' ')}`.trim();
  return clean(a[`${who}_name`] || a[`${who}_full_name`] || [first, mid, last].filter(Boolean).join(' '), 120);
}

// ── Per-form caption field-name registry ──────────────────────────────
// `null` means the form has no field for that slot.
const REG = {
  'fl-100': captionStd('FL-100[0].Page1[0].CaptionP1_sf[0].', 'TitlePartyName', '_ft'),
  'fl-120': captionStd('FL-120[0].Page1[0].Caption_sf[0].', 'TitlePartyName', '_ft'),
  'ud-100': captionStd('UD-100[0].Page1[0].p1Caption[0].', 'TitlePartyName', '_ft', {
    caseNumber: 'UD-100[0].Page1[0].p1Caption[0].captionSub[0].CaseNumber[0].CaseNumber_ft[0]'
  }),
  // FL-105 uses a distinct sub-naming: AttyInfo.Name/Phone/Email (no _ft),
  // CrtInfo.Crt* prefix, ProbateParty.Party1/Party2, CaseNo.CaseNumber.
  'fl-105': (() => {
    const C = 'FL-105[0].Page1[0].P1Caption[0].';
    return {
      attyName: C + 'AttyInfo[0].Name[0]',
      attyFirm: C + 'AttyInfo[0].AttyFirm[0]',
      attyStreet: C + 'AttyInfo[0].AttyStreet[0]',
      attyCity: C + 'AttyInfo[0].AttyCity[0]',
      attyState: C + 'AttyInfo[0].AttyState[0]',
      attyZip: C + 'AttyInfo[0].AttyZip[0]',
      attyPhone: C + 'AttyInfo[0].Phone[0]',
      attyFax: C + 'AttyInfo[0].Fax[0]',
      attyEmail: C + 'AttyInfo[0].Email[0]',
      attyFor: null,
      attyBarNo: C + 'AttyInfo[0].BarNo_ft[0]',
      courtCounty: C + 'CrtInfo[0].CrtCounty[0]',
      courtStreet: C + 'CrtInfo[0].CrtStreet[0]',
      courtMailing: C + 'CrtInfo[0].CrtMailingAdd[0]',
      courtCityZip: C + 'CrtInfo[0].CrtCityZip[0]',
      courtBranch: C + 'CrtInfo[0].CrtBranch[0]',
      party1: C + 'ProbateParty[0].Party1[0]',
      party2: C + 'ProbateParty[0].Party2[0]',
      caseNumber: C + 'CaseNo[0].CaseNumber[0]'
    };
  })()
};

// Standard caption shape used by FL-100 / FL-120 / UD-100.
function captionStd(base, partyGroup, suf, overrides = {}) {
  const A = base + 'AttyInfo[0].';
  const Ct = base + 'CourtInfo[0].';
  const P = base + partyGroup + '[0].';
  return Object.assign({
    attyName: A + 'AttyName' + suf + '[0]',
    attyFirm: A + 'AttyFirm' + suf + '[0]',
    attyStreet: A + 'AttyStreet' + suf + '[0]',
    attyCity: A + 'AttyCity' + suf + '[0]',
    attyState: A + 'AttyState' + suf + '[0]',
    attyZip: A + 'AttyZip' + suf + '[0]',
    attyPhone: A + 'Phone' + suf + '[0]',
    attyFax: A + 'Fax' + suf + '[0]',
    attyEmail: A + 'Email' + suf + '[0]',
    attyFor: A + 'AttyFor' + suf + '[0]',
    attyBarNo: A + 'BarNo' + suf + '[0]',
    courtCounty: Ct + 'CrtCounty' + suf + '[0]',
    courtStreet: Ct + 'Street' + suf + '[0]',
    courtMailing: Ct + 'MailingAdd' + suf + '[0]',
    courtCityZip: Ct + 'CityZip' + suf + '[0]',
    courtBranch: Ct + 'Branch' + suf + '[0]',
    party1: P + 'Party1' + suf + '[0]',
    party2: P + 'Party2' + suf + '[0]',
    caseNumber: base + 'CaseNumber[0].CaseNumber' + suf + '[0]'
  }, overrides);
}

/**
 * Build the caption field-values for a given form slug.
 * `roles` lets a form relabel parties: { party1: 'plaintiff', party2: 'defendant' }
 * (defaults petitioner/respondent).
 */
function buildCaption(slug, answers = {}, roles = {}) {
  const reg = REG[String(slug).toLowerCase()];
  if (!reg) return {};
  const a = answers;
  const p1role = roles.party1 || 'petitioner';
  const p2role = roles.party2 || 'respondent';

  const out = {};
  const set = (slot, value) => {
    const field = reg[slot];
    if (field && value !== undefined && value !== null && value !== '') out[field] = value;
  };

  set('attyName', clean(a[`${p1role}_name`] || a.filer_name || a.petitioner_name, 80));
  set('attyFirm', clean(a.filer_firm_name, 80));
  set('attyStreet', clean(a[`${p1role}_address_line1`] || a.petitioner_address_line1 || a.mailing_address_line1, 80));
  set('attyCity', clean(a[`${p1role}_city`] || a.petitioner_city || a.mailing_city, 60));
  set('attyState', stateCode(a[`${p1role}_state`] || a.petitioner_state || a.mailing_state));
  set('attyZip', digits(a[`${p1role}_zip`] || a.petitioner_zip || a.mailing_zip, 10));
  set('attyPhone', usPhone(a[`${p1role}_phone`] || a.petitioner_phone || a.phone));
  set('attyEmail', clean(a[`${p1role}_email`] || a.petitioner_email || a.email, 120));
  set('attyBarNo', clean(a.filer_bar_number, 12));
  set('attyFor', clean(a.filer_bar_number ? a.attorney_for : 'In Pro Per (Self-Represented)', 60));

  set('courtCounty', clean(a.court_county, 60).toUpperCase());
  set('courtStreet', clean(a.court_street_address, 80));
  set('courtMailing', clean(a.court_mailing_address, 80));
  set('courtCityZip', clean(a.court_city_zip, 80));
  set('courtBranch', clean(a.court_branch_name, 80));

  set('party1', partyName(a, p1role) || partyName(a, 'petitioner'));
  set('party2', partyName(a, p2role) || partyName(a, 'respondent'));
  set('caseNumber', clean(a.case_number, 30));

  return out;
}

// ── Shared dissolution/legal-separation/nullity form-title block ──────
// Used by FL-100 (Petition) and FL-120 (Response) — identical field tree
// under their respective caption sub-form. Pass the FormTitle base, e.g.
//   "FL-100[0].Page1[0].CaptionP1_sf[0].FormTitle[0]."
function dissolutionTitleFields(formTitleBase, answers = {}) {
  const a = answers;
  const caseType = clean(a.case_type, 40).toLowerCase();
  const rel = clean(a.relationship_type, 40).toLowerCase();
  const isDP = /domestic|partner|партн/.test(rel);
  const isMarriage = !isDP; // default marriage unless DP explicitly stated
  const v = {};
  const B = formTitleBase;
  if (/dissolution|divorce|развод|divorcio/.test(caseType)) {
    v[B + 'DissolutionOf_cb[0]'] = true;
    if (isMarriage) v[B + 'Marriage_cb[0]'] = true;
    if (isDP) v[B + 'DomesticPartnership_cb[0]'] = true;
  } else if (/legal.?separation|раздел|separac/.test(caseType)) {
    v[B + 'LegalSeparationOf_cb[0]'] = true;
    if (isMarriage) v[B + 'Marriage_cb[2]'] = true;
    if (isDP) v[B + 'DomesticPartnership_cb[2]'] = true;
  } else if (/nullity|annul|аннул|nulidad/.test(caseType)) {
    v[B + 'NullityOf_cb[0]'] = true;
    if (isMarriage) v[B + 'Marriage_cb[1]'] = true;
    if (isDP) v[B + 'DomesticPartnership_cb[1]'] = true;
  }
  const truthy = (x) => x === true || ['yes', 'true', 'да', '1'].includes(clean(x, 10).toLowerCase());
  if (truthy(a.is_amended)) v[B + 'Amended_cb[0]'] = true;
  return v;
}

module.exports = {
  buildCaption, dissolutionTitleFields, REG,
  _fmt: { clean, stateCode, digits, usPhone, partyName }
};
