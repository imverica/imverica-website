'use strict';
/**
 * UD-105 — Answer, Unlawful Detainer (the TENANT's response). Here the filer is
 * the DEFENDANT/tenant (In-Pro-Per): the caption's party block is the tenant,
 * party1 = plaintiff (landlord), party2 = defendant (tenant). General Denial is
 * allowed ONLY when the complaint demands ≤ $1,000; otherwise the tenant uses
 * specific denials. Affirmative defenses are driven by the wizard's `defenses`
 * answers (the tenant picks which apply) — never auto-asserted.
 * Field names VERBATIM from extract-ca-fields.js ud-105.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;
const C = 'UD-105[0].Page1[0].P1Caption[0].';
const P1 = 'UD-105[0].Page1[0].';
const P2 = 'UD-105[0].Page2[0].';
const P3 = 'UD-105[0].Page3[0].';
const P4 = 'UD-105[0].Page4[0].';
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function money(v) { return Number(String(v == null ? '' : v).replace(/[^0-9.]/g, '')) || 0; }

// Affirmative-defense code → checkbox (extend as more are wired).
const DEFENSE_FIELD = {
  'rent-over-1-year': P1 + 'List3[0].li3d[0].Check8[0]',
  'rent-control':     P2 + 'List3[0].Lih[0].Check14[0]',
  'tpa-noncompliance': P2 + 'List3[0].li2i[0].Check15[0]',
  'nonpayment-rental-assistance': P2 + 'List3[0].l3m[0].Check38[0]'
};

function ud_105FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  // Plaintiff = landlord (party1). The filer = the answering tenant (party2).
  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name'), 120);
  const tenant = clean(pick(a, 'tenant_name', 'defendant_name', 'filer_name', 'respondent_name'), 120);
  const hasAtty = !!pick(a, 'filer_bar_number');

  // Caption — the tenant is In-Pro-Per.
  v[C + 'AttyPartyInfo[0].Name[0]'] = tenant;
  v[C + 'AttyPartyInfo[0].Street[0]'] = clean(pick(a, 'tenant_address_line1', 'defendant_address_line1', 'mailing_address_line1', 'premises_address'), 80);
  v[C + 'AttyPartyInfo[0].City[0]'] = clean(pick(a, 'tenant_city', 'mailing_city', 'premises_city'), 60);
  v[C + 'AttyPartyInfo[0].State[0]'] = clean(pick(a, 'tenant_state', 'state'), 20) || 'CA';
  v[C + 'AttyPartyInfo[0].Zip[0]'] = clean(pick(a, 'tenant_zip', 'mailing_zip'), 12);
  v[C + 'AttyPartyInfo[0].Phone[0]'] = clean(pick(a, 'tenant_phone', 'phone'), 30);
  v[C + 'AttyPartyInfo[0].Email[0]'] = clean(pick(a, 'tenant_email', 'email'), 120);
  v[C + 'AttyPartyInfo[0].AttyFor[0]'] = hasAtty ? clean(pick(a, 'attorney_for'), 60) : 'In Pro Per (Self-Represented)';
  v[C + 'CourtInfo[0].CrtCounty[0]'] = clean(pick(a, 'court_county'), 60);
  v[C + 'CourtInfo[0].CrtStreet[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[C + 'CourtInfo[0].CrtCityZip[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[C + 'CourtInfo[0].CrtBranch[0]'] = clean(pick(a, 'court_branch_name'), 80);
  v[C + 'TitlePartyName[0].Party1[0]'] = plaintiff;
  v[C + 'TitlePartyName[0].Party2[0]'] = tenant;
  // Running caption header on pages 2, 3 & 4.
  for (const P of [P2, P3, P4]) {
    v[P + 'PxCaption[0].TitlePartyName[0].Party1[0]'] = plaintiff;
    v[P + 'PxCaption[0].TitlePartyName[0].Party2[0]'] = tenant;
  }

  // Item 1 — name every defendant for whom this answer is filed.
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [tenant].filter(Boolean);
  if (defList.length) v[P1 + 'List1[0].item1[0].FillField1[0]'] = defList.join('; ');

  // Item 2 — DENIALS (check ONLY one). General Denial (2a) is allowed ONLY
  // when the complaint demands ≤ $1,000; otherwise the tenant must use
  // Specific Denials (2b). Default to 2b when the demand is unknown — it is
  // always permitted, whereas 2a is the restricted box. The disputed
  // paragraph numbers in 2b(1) come from the wizard (the tenant states which
  // allegations are false — we never decide that for them).
  const demand = money(pick(a, 'rent_due_amount', 'amount_demanded', 'complaint_demand'));
  if (demand && demand <= 1000) {
    v[P1 + 'List2[0].Lia[0].Check1[0]'] = true;                  // 2a General Denial
  } else {
    v[P1 + 'List2[0].Lib[0].Check1[0]'] = true;                  // 2b Specific Denials
    const disputed = clean(pick(a, 'denied_paragraphs', 'disputed_paragraphs', 'specific_denials'), 600);
    if (disputed) v[P1 + 'List2[0].Lib[0].SubListb[0].Li1[0].Subitem1[0].Lia[0].FillField2[0]'] = disputed;
  }

  // Item 3 — affirmative defenses the tenant asserts (from the wizard).
  const defenses = Array.isArray(a.defenses) ? a.defenses : String(pick(a, 'defenses') || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const d of defenses) { const f = DEFENSE_FIELD[d]; if (f) v[f] = true; }

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== '')));
}
module.exports = { ud_105FieldValues };
