'use strict';
/**
 * SC-100 — Plaintiff's Claim and ORDER to Go to Small Claims Court.
 *
 * Distinct structure from family-law forms: a combined court block
 * (CaptionRight.County.CourtInfo), plaintiff + defendant detail blocks on
 * page 2, the claim amount, and a short "why the defendant owes" reason.
 * Self-contained (does not use the shared caption registry) because its
 * caption layout differs from the petition forms.
 *
 * Field names + labels verbatim from extract-ca-fields.js sc-100.
 */

const { _fmt } = require('./ca-caption');
const { clean, usPhone, stateCode, digits } = _fmt;

function money(v) {
  const n = clean(v, 20).replace(/[^0-9.]/g, '');
  if (!n) return '';
  const num = Number(n);
  return isFinite(num) ? num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n;
}

function sc_100FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const PR = 'SC-100[0].Page1[0].CaptionRight[0].';
  const P2 = 'SC-100[0].Page2[0].';
  const v = {};

  // ── Court + case (page 1 caption, right side) ──
  const courtBlock = [
    clean(a.court_county ? 'County of ' + a.court_county : '', 60),
    clean(a.court_street_address, 80),
    clean(a.court_city_zip, 80),
    clean(a.court_branch_name, 80)
  ].filter(Boolean).join('\n');
  if (courtBlock) v[PR + 'County[0].CourtInfo[0]'] = courtBlock;
  v[PR + 'CN[0].CaseNumber[0]'] = clean(a.case_number, 30);

  // ── Plaintiff (the person filing) — page 2 block 1 ──
  const pb = P2 + 'List1[0].Item1[0].';
  v[pb + 'PlaintiffName1[0]'] = clean(a.plaintiff_name || a.petitioner_name, 120);
  v[pb + 'PlaintiffPhone1[0]'] = usPhone(a.plaintiff_phone || a.phone);
  v[pb + 'PlaintiffAddress1[0]'] = clean(a.plaintiff_address_line1 || a.mailing_address_line1, 80);
  v[pb + 'PlaintiffCity1[0]'] = clean(a.plaintiff_city || a.mailing_city, 60);
  v[pb + 'PlaintiffState1[0]'] = stateCode(a.plaintiff_state || a.mailing_state);
  v[pb + 'PlaintiffZip1[0]'] = digits(a.plaintiff_zip || a.mailing_zip, 10);

  // ── Defendant (who is being sued) — page 2 block 2 ──
  const db = P2 + 'List2[0].item2[0].';
  v[db + 'DefendantName1[0]'] = clean(a.defendant_name, 120);
  v[db + 'DefendantPhone1[0]'] = usPhone(a.defendant_phone);
  v[db + 'DefendantAddress1[0]'] = clean(a.defendant_address_line1, 80);
  v[db + 'DefendantCity1[0]'] = clean(a.defendant_city, 60);
  v[db + 'DefendantState1[0]'] = stateCode(a.defendant_state);
  v[db + 'DefendantZip1[0]'] = digits(a.defendant_zip, 10);

  // ── Claim amount + reason (page 2) ──
  v[P2 + 'List3[0].PlaintiffClaimAmount1[0]'] = money(a.claim_amount);
  v[P2 + 'List3[0].Lia[0].FillField2[0]'] = clean(a.claim_reason, 300); // why the defendant owes

  return Object.fromEntries(
    Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== ''))
  );
}

module.exports = { sc_100FieldValues };
