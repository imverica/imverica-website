'use strict';
/**
 * UD-116 — Declaration for Default Judgment by Court (Unlawful Detainer). Used
 * at the DEFAULT stage when the landlord seeks a judgment BY THE COURT (e.g.
 * money + possession) on a written declaration instead of a hearing. It
 * restates the case facts under penalty of perjury, so it mirrors the UD-100
 * intake. Filer = landlord (plaintiff), In-Pro-Per.
 *
 * We pre-fill the caption, identity (item 1), property (item 2), the agreement
 * (item 4), the notice (item 6), service (item 7), the notice-expiry date
 * (item 9), the fair-rental amount (item 10), and the judgment requested
 * (item 15: past-due rent + possession + forfeiture). Left for the client:
 * the holdover-damages CALCULATION (item 12 — dates/days/total), attorney fees
 * (item 13 — In-Pro-Per has none), exact court costs (item 14), and the
 * signature/date — those need figures/choices that aren't part of intake.
 * Field names VERBATIM from extract ud-116.
 */
const { _fmt } = require('./ca-caption');
const { clean, money } = _fmt;
const C = 'UD-116[0].Page1[0].StdP1Header_sf[0].';
const P1 = 'UD-116[0].Page1[0].';
const P2 = 'UD-116[0].Page2[0].';
const P3 = 'UD-116[0].Page3[0].';
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function lc(v) { return String(v || '').toLowerCase(); }
function falsy(v) { return /^(n|no|false|0|нет|ні)/.test(lc(v)); }

// Item 6 notice rows (Page2 List6 SubLia Li1..Li6).
const N6 = {
  '3-day-pay-or-quit': 'Li1', '3-day-covenants': 'Li2', '3-day-quit': 'Li4',
  '30-day': 'Li5', '60-day': 'Li6'
};
function noticeKey(raw) {
  const s = lc(raw);
  if (/pay rent|pay-or-quit|pay or quit|неуплат|оплат/.test(s)) return '3-day-pay-or-quit';
  if (/covenant|perform/.test(s)) return '3-day-covenants';
  if (/60/.test(s)) return '60-day';
  if (/30/.test(s)) return '30-day';
  if (/quit/.test(s)) return '3-day-quit';
  if (/^3|three/.test(s)) return '3-day-pay-or-quit';
  return '';
}

function ud_116FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);
  const defInline = defList.join('; ');
  const hasAtty = !!pick(a, 'filer_bar_number');

  // ── Caption (In-Pro-Per). TextField1 = the top name+address box. ──
  const filerAddr = [clean(pick(a, 'plaintiff_address_line1', 'mailing_address_line1'), 80), [clean(pick(a, 'plaintiff_city', 'mailing_city'), 60), clean(pick(a, 'plaintiff_state'), 20), clean(pick(a, 'plaintiff_zip'), 12)].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  v[C + 'AttyPartyInfo[0].TextField1[0]'] = [plaintiff, filerAddr].filter(Boolean).join('\n');
  v[C + 'AttyPartyInfo[0].Phone[0]'] = clean(pick(a, 'plaintiff_phone', 'phone'), 30);
  v[C + 'AttyPartyInfo[0].Email[0]'] = clean(pick(a, 'plaintiff_email', 'email'), 120);
  v[C + 'AttyPartyInfo[0].Attorney[0]'] = hasAtty ? clean(pick(a, 'attorney_for'), 60) : 'Plaintiff in Pro Per';
  v[C + 'CourtInfo[0].CrtCounty_ft[0]'] = clean(pick(a, 'court_county'), 60);
  v[C + 'CourtInfo[0].Street_ft[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[C + 'CourtInfo[0].CityZip_ft[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[C + 'CourtInfo[0].Branch_ft[0]'] = clean(pick(a, 'court_branch_name'), 80);
  v[C + 'TitlePartyName[0].Party1_ft[0]'] = plaintiff;
  v[C + 'TitlePartyName[0].Party2_ft[0]'] = defInline;
  // Running caption pages 2 & 3.
  for (const P of [P2, P3]) {
    v[P + 'Header[0].TitlePartyName[0].Party1_ft[0]'] = plaintiff;
    v[P + 'Header[0].TitlePartyName[0].Party2_ft[0]'] = defInline;
  }

  // ── Item 1 — declarant identity (the plaintiff). ──
  if (plaintiff) v[P1 + 'List1[0].FillText1[0]'] = plaintiff;
  v[P1 + 'List1[0].Lia[0].OneA[0]'] = true;                     // "I am the plaintiff"

  // ── Item 2 — property. ──
  v[P1 + 'List2[0].item2[0].FillText3[0]'] = clean(pick(a, 'premises_address', 'rental_property_address'), 200);

  // ── Item 4 — the agreement (mirrors UD-100 item 6). ──
  const oral = /oral/.test(lc(pick(a, 'agreement_type')));
  v[P1 + 'List4[0].Four[' + (oral ? '1' : '0') + ']'] = true;   // written / oral
  v[P1 + 'List4[0].Lia[0].DateField2[0]'] = clean(pick(a, 'tenancy_start_date', 'lease_start_date'), 30);
  v[P1 + 'List4[0].Lia[0].TextField5[0]'] = defInline;
  const tType = lc(pick(a, 'tenancy_type'));
  if (/month/.test(tType)) v[P1 + 'List4[0].Lia[0].SubLia[0].Li1[0].FourA1[0]'] = true;
  else if (tType) {
    v[P1 + 'List4[0].Lia[0].SubLia[0].Li1[0].FourA1[1]'] = true;
    v[P1 + 'List4[0].Lia[0].SubLia[0].Li1[0].Field6[0]'] = clean(pick(a, 'tenancy_type_specify', 'tenancy_type'), 60);
  }
  const rent = money(pick(a, 'rent_amount', 'monthly_rent'));
  if (rent) v[P1 + 'List4[0].Lia[0].SubLia[0].Li2[0].Field8[0]'] = rent;
  v[P1 + 'List4[0].Lia[0].SubLia[0].Li2[0].FourA2freq[0]'] = true;   // monthly
  v[P1 + 'List4[0].Lia[0].SubLia[0].Li2[0].FourA2due[0]'] = true;    // first of month

  // ── Item 6 — the notice (Page 2). ──
  const nk = noticeKey(pick(a, 'notice_type'));
  if (nk && N6[nk]) {
    v[P2 + 'List6[0].Lia[0].SixA[0]'] = true;
    v[P2 + 'List6[0].Lia[0].SubLia[0].' + N6[nk] + '[0].SixA16[0]'] = true;
  }
  if (nk === '3-day-pay-or-quit') {
    const due = money(pick(a, 'rent_due_amount', 'amount_owed'));
    if (due) {
      v[P2 + 'List6[0].Lib[0].SixB[0]'] = true;
      v[P2 + 'List6[0].Lib[0].DecimalField3[0]'] = due;
    }
  }

  // ── Item 7 — service of the notice (Page 2). ──
  v[P2 + 'List7[0].Lia[0].TextField23[0]'] = defInline;
  const sm = lc(pick(a, 'service_method'));
  const served = clean(pick(a, 'notice_served_date', 'service_date'), 30);
  if (/personal|hand|лично/.test(sm)) { v[P2 + 'List7[0].Lia[0].SubLia[0].Li1[0].SevenA13[0]'] = true; if (served) v[P2 + 'List7[0].Lia[0].SubLia[0].Li1[0].DateField6[0]'] = served; }
  else if (/substitut/.test(sm)) { v[P2 + 'List7[0].Lia[0].SubLia[0].Li2[0].SevenA13[0]'] = true; if (served) v[P2 + 'List7[0].Lia[0].SubLia[0].Li2[0].DateField7[0]'] = served; }
  else if (/post|nail|вывес/.test(sm)) { v[P2 + 'List7[0].Lia[0].SubLia[0].Li3[0].SevenA13[0]'] = true; if (served) v[P2 + 'List7[0].Lia[0].SubLia[0].Li3[0].DateField8[0]'] = served; }

  // ── Item 9 — date the notice period expired. ──
  v[P2 + 'List9[0].item9[0].DateField9[0]'] = clean(pick(a, 'notice_expired_date'), 30);

  // ── Item 10 — fair rental value (amount only; the valuation METHOD is a
  //    client choice, left unchecked). ──
  const daily = money(pick(a, 'daily_rental_value', 'fair_rental_value_per_day'));
  if (daily) v[P2 + 'List10[0].DecimalField4[0]'] = daily;

  // ── Item 11 — tenant still in possession (default assumption for a UD
  //    default judgment; if they had vacated there'd be no possession claim). ──
  if (!falsy(pick(a, 'tenant_in_possession'))) v[P2 + 'List11[0].Lib[0].ElevenAB[0]'] = true;

  // ── Item 15 — judgment requested. ──
  v[P3 + 'List15[0].Fifteen[0]'] = true;
  const due = money(pick(a, 'rent_due_amount', 'amount_owed'));
  if (nk === '3-day-pay-or-quit' && due) {
    v[P3 + 'List15[0].Lia[0].FifteenA[0]'] = true;                          // money judgment
    v[P3 + 'List15[0].Lia[0].Table[0].limited11[0]'] = true;               // past-due rent
    v[P3 + 'List15[0].Lia[0].Table[0].EXPN[0]'] = due;
  }
  v[P3 + 'List15[0].Lib[0].FifteenB[0]'] = true;                            // possession of the premises
  if (!falsy(pick(a, 'notice_election_forfeiture'))) v[P3 + 'List15[0].Lic[0].FifteenCa[0]'] = true;  // forfeiture of the lease
  // Printed signer name (date/signature completed by the client).
  if (plaintiff) v[P3 + 'Sign[0].FillText56[0]'] = plaintiff;

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== '')));
}
module.exports = { ud_116FieldValues };
