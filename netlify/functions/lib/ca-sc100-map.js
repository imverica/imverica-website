'use strict';
/**
 * SC-100 — Plaintiff's Claim and ORDER to Go to Small Claims Court.
 *
 * Full fill for an In-Pro-Per plaintiff (or two joint plaintiffs): caption +
 * case name, item 1 (up to two plaintiffs; >2 → check the SC-100A box), item 2
 * (defendant + optional agent), item 3 (amount + why + dates + calculation,
 * with overflow → MC-031 "Attached Declaration"), items 4–10 (asked-to-pay,
 * venue, zip, fee-dispute, public-entity, 12-claims, the over-$2,500 question
 * DERIVED from the amount), and item 11 (declaration print names).
 *
 * Item 10 note: the over-$2,500 box is driven by the claim amount — a common
 * filer mistake is to leave it "No" on a >$2,500 claim; we set it correctly.
 *
 * Field names + labels verbatim from extract-ca-fields.js sc-100.
 */

const { _fmt } = require('./ca-caption');
const { clean, usPhone, stateCode, digits, money } = _fmt;

function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function lc(v) { return String(v || '').toLowerCase(); }
function truthy(v) { return /^(y|yes|true|1|да|так)/.test(lc(v)); }
function falsy(v) { return /^(n|no|false|0|нет|ні)/.test(lc(v)); }
function amount(v) { return Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0; }
function lastToken(n) { const t = clean(n, 120).split(/\s+/).filter(Boolean); return t.length ? t[t.length - 1] : ''; }

// Normalize plaintiffs into [{name,phone,address,city,state,zip,email}]; the
// face of SC-100 holds two, the rest go on SC-100A.
function plaintiffList(a) {
  if (Array.isArray(a.plaintiffs) && a.plaintiffs.length) {
    return a.plaintiffs.map((p) => (typeof p === 'string' ? { name: p } : (p || {}))).filter((p) => clean(p.name, 120));
  }
  const out = [{
    name: pick(a, 'plaintiff_name', 'petitioner_name'), phone: pick(a, 'plaintiff_phone', 'phone'),
    address: pick(a, 'plaintiff_address_line1', 'mailing_address_line1'), city: pick(a, 'plaintiff_city', 'mailing_city'),
    state: pick(a, 'plaintiff_state', 'mailing_state'), zip: pick(a, 'plaintiff_zip', 'mailing_zip'), email: pick(a, 'plaintiff_email', 'email')
  }];
  if (pick(a, 'plaintiff2_name')) {
    out.push({
      name: pick(a, 'plaintiff2_name'), phone: pick(a, 'plaintiff2_phone'), address: pick(a, 'plaintiff2_address_line1'),
      city: pick(a, 'plaintiff2_city'), state: pick(a, 'plaintiff2_state'), zip: pick(a, 'plaintiff2_zip'), email: pick(a, 'plaintiff2_email')
    });
  }
  return out.filter((p) => clean(p.name, 120));
}

function sc_100FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const PR = 'SC-100[0].Page1[0].CaptionRight[0].';
  const P2 = 'SC-100[0].Page2[0].';
  const P3 = 'SC-100[0].Page3[0].';
  const P4 = 'SC-100[0].Page4[0].';
  const v = {};

  const plaintiffs = plaintiffList(a);
  const defName = clean(pick(a, 'defendant_name', 'respondent_name'), 120);
  const pNames = plaintiffs.map((p) => clean(p.name, 120)).filter(Boolean).join('; ');
  const caseName = clean(pick(a, 'case_name'), 60)
    || (((plaintiffs[0] && lastToken(plaintiffs[0].name)) || '') + ' v. ' + (lastToken(defName) || defName)).trim();

  // ── Court + case (page 1 caption) ──
  const courtBlock = [
    clean(a.court_county ? 'County of ' + a.court_county : '', 60),
    clean(a.court_street_address, 80), clean(a.court_city_zip, 80), clean(a.court_branch_name, 80)
  ].filter(Boolean).join('\n');
  if (courtBlock) v[PR + 'County[0].CourtInfo[0]'] = courtBlock;
  v[PR + 'CN[0].CaseNumber[0]'] = clean(a.case_number, 30);
  v[PR + 'CN[0].CaseName[0]'] = caseName;
  // Running caption (pages 2–4).
  for (const P of [P2, P3, P4]) {
    v[P + 'PxCaption[0].Plaintiff[0]'] = pNames;
    v[P + 'PxCaption[0].CaseNumber[0]'] = clean(a.case_number, 30);
  }

  // ── Item 1 — plaintiff(s) ──
  const ib = P2 + 'List1[0].Item1[0].';
  const p1 = plaintiffs[0] || {};
  v[ib + 'PlaintiffName1[0]'] = clean(p1.name, 120);
  v[ib + 'PlaintiffPhone1[0]'] = usPhone(p1.phone);
  v[ib + 'PlaintiffAddress1[0]'] = clean(p1.address, 80);
  v[ib + 'PlaintiffCity1[0]'] = clean(p1.city, 60);
  v[ib + 'PlaintiffState1[0]'] = stateCode(p1.state);
  v[ib + 'PlaintiffZip1[0]'] = digits(p1.zip, 10);
  v[ib + 'EmailAdd1[0]'] = clean(p1.email, 120);
  if (plaintiffs[1]) {
    const p2 = plaintiffs[1];
    v[ib + 'PlaintiffName2[0]'] = clean(p2.name, 120);
    v[ib + 'PlaintiffPhone2[0]'] = usPhone(p2.phone);
    v[ib + 'PlaintiffAddress2[0]'] = clean(p2.address, 80);
    v[ib + 'PlaintiffCity2[0]'] = clean(p2.city, 60);
    v[ib + 'PlaintiffState2[0]'] = stateCode(p2.state);
    v[ib + 'PlaintiffZip2[0]'] = digits(p2.zip, 10);
    v[ib + 'EmailAdd2[0]'] = clean(p2.email, 120);
  }
  if (plaintiffs.length > 2) v[ib + 'Checkbox1[0]'] = true;   // more than two → SC-100A

  // ── Item 2 — defendant (+ optional agent for an entity) ──
  const db = P2 + 'List2[0].item2[0].';
  v[db + 'DefendantName1[0]'] = defName;
  v[db + 'DefendantPhone1[0]'] = usPhone(pick(a, 'defendant_phone'));
  v[db + 'DefendantAddress1[0]'] = clean(pick(a, 'defendant_address_line1'), 80);
  v[db + 'DefendantCity1[0]'] = clean(pick(a, 'defendant_city'), 60);
  v[db + 'DefendantState1[0]'] = stateCode(pick(a, 'defendant_state'));
  v[db + 'DefendantZip1[0]'] = digits(pick(a, 'defendant_zip'), 10);
  const agent = clean(pick(a, 'defendant_agent_name'), 120);
  if (agent) {
    v[db + 'DefendantName2[0]'] = agent;
    v[db + 'DefendantJob1[0]'] = clean(pick(a, 'defendant_agent_title'), 80);
  }

  // ── Item 3 — amount + reason; dates + calculation; overflow → MC-031 ──
  const amt = amount(pick(a, 'claim_amount', 'amount_demanded'));
  v[P2 + 'List3[0].PlaintiffClaimAmount1[0]'] = money(amt);
  const reason = clean(pick(a, 'claim_reason'), 1500);
  const calc = clean(pick(a, 'claim_calculation', 'claim_calc'), 1000);
  // The face of SC-100 has short lines for "why" (3a) and "how calculated"
  // (3c). If either is long, move the full text to MC-031 and tick item 3's
  // "need more space" box so nothing is dropped.
  const overflow = reason.length > 360 || calc.length > 300 || truthy(a.use_attachment);
  v[P2 + 'List3[0].Lia[0].FillField2[0]'] = overflow
    ? (reason.slice(0, 200).replace(/\s+\S*$/, '') + '… (see Attachment MC-031, “SC-100, Item 3”)')
    : reason;
  v[P3 + 'List3[0].Lib[0].Date2[0]'] = clean(pick(a, 'claim_date_started', 'date_started'), 30);
  v[P3 + 'List3[0].Lib[0].Date3[0]'] = clean(pick(a, 'claim_date_through', 'date_through'), 30);
  if (!overflow && calc) v[P3 + 'List3[0].Lic[0].FillField1[0]'] = calc;
  if (overflow) {
    v[P3 + 'List3[0].Checkbox1[0]'] = true;   // "need more space" → MC-031 attached
    v._overflow = {
      form: 'MC-031', attachmentTitle: 'SC-100, Item 3', title: 'SC-100, Item 3',
      body: [reason, calc ? '\nHow the amount was calculated:\n' + calc : ''].filter(Boolean).join('\n')
    };
  }

  // ── Item 4 — asked the defendant to pay before suing? (default: yes) ──
  if (falsy(pick(a, 'asked_to_pay'))) {
    v[P3 + 'List4[0].Item4[0].Checkbox50[1]'] = true;   // No
    v[P3 + 'List4[0].Item4[0].FillField2[0]'] = clean(pick(a, 'asked_to_pay_explain'), 300);
  } else {
    v[P3 + 'List4[0].Item4[0].Checkbox50[0]'] = true;   // Yes
  }

  // ── Item 5 — venue. Row "a" (where the defendant lives/does business, where
  //    property was damaged, injury, or a contract was made) is the catch-all
  //    that fits the vast majority of small claims; default to it. ──
  v[P3 + 'List5[0].Lia[0].Checkbox5cb[0]'] = true;
  // ── Item 6 — zip of the place checked in item 5 ──
  v[P3 + 'List6[0].item6[0].ZipCode1[0]'] = digits(pick(a, 'venue_zip', 'premises_zip', 'defendant_zip'), 10);

  // ── Item 7 — attorney-client fee dispute? (default: no) ──
  if (truthy(pick(a, 'attorney_fee_dispute'))) v[P3 + 'List7[0].item7[0].Checkbox60[0]'] = true;
  else v[P3 + 'List7[0].item7[0].Checkbox60[1]'] = true;

  // ── Item 8 — suing a public entity? (default: no) ──
  if (truthy(pick(a, 'suing_public_entity'))) {
    v[P3 + 'List8[0].item8[0].Checkbox61[0]'] = true;
    const cd = clean(pick(a, 'public_entity_claim_date'), 30);
    if (cd) { v[P3 + 'List8[0].item8[0].Checkbox14[0]'] = true; v[P3 + 'List8[0].item8[0].Date4[0]'] = cd; }
  } else v[P3 + 'List8[0].item8[0].Checkbox61[1]'] = true;

  // ── Item 9 — filed >12 small claims in 12 months? (default: no) ──
  if (truthy(pick(a, 'filed_over_12_claims'))) v[P4 + 'List9[0].Item9[0].Checkbox62[0]'] = true;
  else v[P4 + 'List9[0].Item9[0].Checkbox62[1]'] = true;

  // ── Item 10 — claim for more than $2,500? DERIVED from the amount. ──
  v[P4 + 'List10[0].li10[0].Checkbox63[' + (amt > 2500 ? '0' : '1') + ']'] = true;

  // ── Item 11 — declaration: print name(s); the client dates + signs. ──
  if (plaintiffs[0]) v[P4 + 'Sign[0].PlaintiffName1[0]'] = clean(plaintiffs[0].name, 120);
  if (plaintiffs[1]) v[P4 + 'Sign[0].PlaintiffName2[0]'] = clean(plaintiffs[1].name, 120);

  return Object.fromEntries(
    Object.entries(v).filter(([k, val]) => k === '_overflow' || val === true || (typeof val === 'string' && val !== ''))
  );
}

module.exports = { sc_100FieldValues };
