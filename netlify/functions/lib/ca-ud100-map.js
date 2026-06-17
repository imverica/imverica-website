'use strict';
/**
 * UD-100 — Complaint, Unlawful Detainer (eviction). Filer = landlord/owner
 * (PLAINTIFF, party1); tenant = DEFENDANT (party2). Built for In-Pro-Per
 * landlords: the wizard ASKS the variant questions (tenancy type, notice type,
 * service method, just cause, amounts, dates) and this map fills the matching
 * checkboxes/fields. Field names VERBATIM from scripts/extract-ca-fields.js
 * ud-100 (186 fields); none invented. Verified field-by-field against the real
 * filed "Viktor Roman" complaint (scripts/verify-ud100-roman.js).
 *
 * Overflow rule (the form's own mechanism): >1 defendant with different
 * notices/dates/manner OR a name list that overflows → tick item 9f + 10c
 * ("see Attachment 10c") and surface `_overflow` so the packet builder appends
 * an MC-025 continuation page. Never silently drop a defendant or notice.
 */

const { buildCaption, _fmt } = require('./ca-caption');
const { clean } = _fmt;

const P1 = 'UD-100[0].Page1[0].';
const P2 = 'UD-100[0].Page2[0].';
const P3 = 'UD-100[0].Page3[0].';

function pick(a, ...keys) { for (const k of keys) if (a[k] != null && a[k] !== '') return a[k]; return ''; }
function money(v) { const s = String(v == null ? '' : v).replace(/[^0-9.]/g, ''); return s || ''; }
function lc(v) { return String(v || '').toLowerCase(); }
function truthy(v) { return /^(y|yes|true|1|да|так)/.test(lc(v)); }
function falsy(v) { return /^(n|no|false|0|нет|ні)/.test(lc(v)); }

const NOTICE_FIELD = {
  '3-day-pay-or-quit': P2 + 'List9[0].Lia[0].SubLista[0].Li1[0].SevenA16[0]',
  '30-day':            P2 + 'List9[0].Lia[0].SubLista[0].Li2[0].SevenA16[0]',
  '60-day':            P2 + 'List9[0].Lia[0].SubLista[0].Li3[0].SevenA16[0]',
  '3-day-quit':        P2 + 'List9[0].Lia[0].SubLista[0].Li4[0].SevenA16[0]',
  'cares-30-day':      P2 + 'List9[0].Lia[0].SubLista[0].Li5[0].SevenA16[0]',
  '3-day-covenants':   P2 + 'List9[0].Lia[0].SubLista[0].Li6[0].SevenA16[0]',
  '3-day-1946.2c':     P2 + 'List9[0].Lia[0].SubLista[0].Li7[0].SevenA16[0]'
};
function noticeKey(raw) {
  const s = lc(raw);
  if (/pay rent|pay-or-quit|pay or quit|неуплат|оплат/.test(s)) return '3-day-pay-or-quit';
  if (/cares/.test(s)) return 'cares-30-day';
  if (/covenant|perform/.test(s)) return '3-day-covenants';
  if (/1946\.?2|1946 ?\(c\)/.test(s)) return '3-day-1946.2c';
  if (/60/.test(s)) return '60-day';
  if (/30/.test(s)) return '30-day';
  if (/quit/.test(s)) return '3-day-quit';
  if (/^3|three/.test(s)) return '3-day-pay-or-quit';
  return '';
}
const SERVICE_FIELD = {
  personal: P3 + 'List10[0].Lia[0].SubLista[0].Li1[0].EightA12[0]',
  posting:  P3 + 'List10[0].Lia[0].SubLista[0].Li3[0].EightA3[0]',
  mail:     P3 + 'List10[0].Lia[0].SubLista[0].Li4[0].Eighta4[0]'
};
function serviceKey(raw) {
  const s = lc(raw);
  if (/personal|hand|лично/.test(s)) return 'personal';
  if (/post|nail|вывес/.test(s)) return 'posting';
  if (/mail|certified|почт/.test(s)) return 'mail';
  return '';
}

function ud_100FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};

  // ── Caption (In-Pro-Per: party = filer, no attorney). Reads
  //    plaintiff_address_line1/city/state/zip/phone/email + court_* keys. ──
  const v = buildCaption('ud-100', a, { party1: 'plaintiff', party2: 'defendant' });

  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);
  const defenInline = defList.slice(0, 2).join('; ');

  // ── Caption party names + running header on pages 2 & 3. ──
  if (plaintiff) {
    v[P1 + 'List1[0].item1[0].FillText1[0]'] = plaintiff;
    v[P2 + 'Header[0].TitlePartyName[0].Party1_ft[0]'] = plaintiff;
    v[P3 + 'Header[0].TitlePartyName[0].Party1_ft[0]'] = plaintiff;
  }
  if (defenInline) {
    v[P1 + 'List1[0].item1[0].FillText2[0]'] = defenInline + (defList.length > 2 ? '; et al. (see Attachment)' : '');
    v[P2 + 'Header[0].TitlePartyName[0].Party2_ft[0]'] = defList[0];
    v[P3 + 'Header[0].TitlePartyName[0].Party2_ft[0]'] = defList[0];
  }
  // DOES 1 to N (true names unknown).
  if (a.doe_defendants || defList.length > 2) {
    v[P1 + 'p1Caption[0].TitlePartyName[0].Does[0]'] = true;
    v[P1 + 'p1Caption[0].TitlePartyName[0].FillText140[0]'] = String(pick(a, 'doe_count') || '10');
  }

  // ── Form title: COMPLAINT (default) vs AMENDED. ──
  if (truthy(a.is_amended)) v[P1 + 'p1Caption[0].FormTitle[0].Complaint[1]'] = true;
  else v[P1 + 'p1Caption[0].FormTitle[0].Complaint[0]'] = true;

  // ── Jurisdiction (item: limited ≤ $35k / unlimited). Demand drives the box. ──
  const demand = Number(money(pick(a, 'amount_demanded', 'rent_due_amount', 'amount_owed'))) || 0;
  if (demand > 35000) v[P1 + 'CheckAll[0].Action[1]'] = true;        // unlimited
  else {
    v[P1 + 'CheckAll[0].Action[0]'] = true;                          // limited
    v[P1 + 'CheckAll[0].ActionDemand[' + (demand > 10000 ? '1' : '0') + ']'] = true;
  }

  // ── Item 2 — plaintiff type. ──
  const ptype = lc(pick(a, 'plaintiff_type', 'landlord_type'));
  if (/partner/.test(ptype)) v[P1 + 'List2[0].Lia[0].SubLista[0].Lii4[0].TwoA[0]'] = true;
  else if (/corp/.test(ptype)) v[P1 + 'List2[0].Lia[0].SubLista[0].Lii5[0].TwoA[0]'] = true;
  else v[P1 + 'List2[0].Lia[0].SubLista[0].Lii1[0].TwoA[0]'] = true;  // individual (default)

  // ── Item 3 — premises + within-city / within-county. ──
  const premises = clean(pick(a, 'premises_address', 'rental_property_address'), 200);
  if (premises) v[P1 + 'List3[0].Lia[0].FillText6[0]'] = premises;
  const city = clean(pick(a, 'premises_city'), 60);
  if (city) {
    v[P1 + 'List3[0].Lib[0].SubListb[0].Lii1[0].Four[0]'] = true;      // within the city limits of
    v[P1 + 'List3[0].Lib[0].SubListb[0].Lii1[0].FillText10[0]'] = city;
  }

  // ── Item 4 — plaintiff's interest (as owner by default). ──
  if (!/(other)/.test(lc(pick(a, 'plaintiff_interest')))) v[P1 + 'List4[0].item4[0].Four1[0]'] = true;

  // ── Item 6 — the agreement. ──
  const tStart = clean(pick(a, 'tenancy_start_date', 'lease_start_date'), 30);
  if (tStart) v[P2 + 'List6[0].Lia[0].DateField12[0]'] = tStart;
  const tType = lc(pick(a, 'tenancy_type'));
  if (/month/.test(tType)) v[P2 + 'List6[0].Lia[0].SubLista[0].Li1[0].SixA1[0]'] = true;
  else if (tType) {
    v[P2 + 'List6[0].Lia[0].SubLista[0].Li1[0].SixA1[1]'] = true;       // other tenancy
    v[P2 + 'List6[0].Lia[0].SubLista[0].Li1[0].FillText116[0]'] = clean(pick(a, 'tenancy_type_specify', 'tenancy_type'), 60);
  }
  const rent = money(pick(a, 'rent_amount', 'monthly_rent'));
  if (rent) v[P2 + 'List6[0].Lia[0].SubLista[0].Li2[0].dollar[0]'] = rent;
  // payable frequency + due day (default monthly / first).
  if (!/other/.test(lc(pick(a, 'rent_frequency'))) || /month/.test(lc(a.rent_frequency))) v[P2 + 'List6[0].Lia[0].SubLista[0].Li2[0].SixA2[0]'] = true;
  if (!/other/.test(lc(pick(a, 'rent_due_day'))) || /first|1st/.test(lc(a.rent_due_day))) v[P2 + 'List6[0].Lia[0].SubLista[0].Li3[0].SixA3[0]'] = true;
  // 6b — written/oral + who made it (default written / plaintiff).
  const oral = /oral/.test(lc(pick(a, 'agreement_type')));
  v[P2 + 'List6[0].Lib[0].SixB[' + (oral ? '1' : '0') + ']'] = true;
  if (!/(agent|predecessor|other)/.test(lc(pick(a, 'agreement_made_with')))) v[P2 + 'List6[0].Lib[0].SubListb[0].Li1[0].SixB14[0]'] = true;
  // 6c — other occupants not named in 6a.
  const occ = clean(pick(a, 'other_occupants'), 80);
  if (occ) {
    v[P2 + 'List6[0].Lic[0].SixC[0]'] = true;
    v[P2 + 'List6[0].Lic[0].SubListc[0].Li3[0].FillText113[0]'] = occ;   // Other (specify)
  }
  // 6e attached vs 6f not attached. Default residential nonpayment → 6f(2).
  const nonpayment = noticeKey(pick(a, 'notice_type')) === '3-day-pay-or-quit';
  if (truthy(a.agreement_attached)) v[P2 + 'List6[0].Lie[0].SixE[0]'] = true;
  else if (falsy(a.agreement_attached) || nonpayment) {
    v[P2 + 'List6[0].Lif[0].#area[0].SixF[0]'] = true;
    if (nonpayment) v[P2 + 'List6[0].Lif[0].SubListf[0].Li2[0].SixF124[0]'] = true;        // solely for nonpayment
    else v[P2 + 'List6[0].Lif[0].SubListf[0].Li1[0].SixF123[0]'] = true;                   // not in possession
  }

  // ── Item 7 — Tenant Protection Act 2019. ──
  const tpa = lc(pick(a, 'subject_to_tpa', 'tpa'));
  if (/no|exempt|not/.test(tpa)) {
    v[P2 + 'List7[0].Lia[0].CBChoice1_cb1[0]'] = true;
    const sub = clean(pick(a, 'tpa_exempt_subpart'), 80); if (sub) v[P2 + 'List7[0].Lia[0].FillText206[0]'] = sub;
  } else if (tpa) v[P2 + 'List7[0].Lib[0].CBChoice1_cb1[0]'] = true;

  // ── Item 8 — just cause (only when TPA applies). ──
  const jc = lc(pick(a, 'just_cause'));
  if (/at.?fault/.test(jc)) v[P2 + 'List8[0].Lia[0].#area[0].TwoAc[0]'] = true;
  else if (/no.?fault/.test(jc)) v[P2 + 'List8[0].Lib[0].#area[0].TwoAb[0]'] = true;

  // ── Item 9 — the notice. ──
  const nk = noticeKey(pick(a, 'notice_type'));
  if (nk && NOTICE_FIELD[nk]) v[NOTICE_FIELD[nk]] = true;
  const expired = clean(pick(a, 'notice_expired_date'), 30);
  if (expired) v[P3 + 'List9[0].Lib[0].SubListb[0].Li1[0].DateField45[0]'] = expired;
  if (!falsy(a.notice_election_forfeiture)) v[P3 + 'List9[0].Lid[0].#area[0].SevenD[0]'] = true;   // election of forfeiture (default yes)
  if (!falsy(a.notice_attached)) v[P3 + 'List9[0].Lie[0].#area[0].SevenE[0]'] = true;              // copy attached as Exhibit 2 (default yes)

  // ── Item 10 — how served. ──
  const sk = serviceKey(pick(a, 'service_method'));
  if (sk && SERVICE_FIELD[sk]) v[SERVICE_FIELD[sk]] = true;
  const served = clean(pick(a, 'notice_served_date', 'service_date'), 30);
  if (served && sk === 'personal') v[P3 + 'List10[0].Lia[0].SubLista[0].Li1[0].DateField21[0]'] = served;

  // ── Item 11 — rental-assistance statements (required for nonpayment). The
  //    standard landlord answers: has not received / does not have. ──
  if (nonpayment) {
    v[P3 + 'List11[0].#area[0].CheckBox110[0]'] = true;
    v[P3 + 'List11[0].Lia[0].#area[0].Correspond[1]'] = true;   // 11a has NOT received
    v[P3 + 'List11[0].Lib[0].#area[0].After[1]'] = true;        // 11b has NOT received
    v[P3 + 'List11[0].Lic[0].#area[0].Correspond2[1]'] = true;  // 11c does NOT have
    v[P3 + 'List11[0].Lid[0].#area[0].After2[1]'] = true;       // 11d does NOT have
  }

  // ── Items 13/14 — amounts. ──
  const due = money(pick(a, 'rent_due_amount', 'amount_owed'));
  if (due) v[P3 + 'List13[0].item12[0].#area[0].FillText209[0]'] = due;
  const daily = money(pick(a, 'daily_rental_value', 'fair_rental_value_per_day'));
  if (daily) v[P3 + 'List14[0].item13[0].#area[0].FillText208[0]'] = daily;

  // ── OVERFLOW → Attachment 10c. ──
  const differ = truthy(pick(a, 'notices_differ_per_defendant'));
  if (differ || defList.length > 2) {
    v[P3 + 'List9[0].Lif[0].#area[0].SevenF[0]'] = true;
    v[P3 + 'List10[0].LI3[0].#area[0].Eightc[0]'] = true;
    v._overflow = {
      form: 'MC-025', attachmentNumber: '10c',
      title: 'Attachment 10c — Service of Notice on Each Defendant',
      defendants: defList, note: 'Provide items 9a–e and 10 for each defendant and notice.'
    };
  }

  return Object.fromEntries(
    Object.entries(v).filter(([k, val]) => k === '_overflow' || val === true || (typeof val === 'string' && val !== ''))
  );
}

module.exports = { ud_100FieldValues };
