'use strict';
/**
 * UD-110 — Judgment, Unlawful Detainer. Filed by the landlord (mostly with the
 * default request) — pre-fills the caption + the "by default / clerk's judgment
 * for possession only" boxes. Money/possession details (items 4+) are entered
 * by the court. County-agnostic. Field names VERBATIM from extract ud-110.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;
const C = 'UD-110[0].Page1[0].P1Caption[0].';
const P1 = 'UD-110[0].Page1[0].';
const P2 = 'UD-110[0].Page2[0].';
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function lc(v) { return String(v || '').toLowerCase(); }

function ud_110FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);
  const hasAtty = !!pick(a, 'filer_bar_number');

  v[C + 'AttyPartyInfo[0].Name[0]'] = plaintiff;
  v[C + 'AttyPartyInfo[0].Street[0]'] = clean(pick(a, 'plaintiff_address_line1', 'mailing_address_line1'), 80);
  v[C + 'AttyPartyInfo[0].City[0]'] = clean(pick(a, 'plaintiff_city', 'mailing_city'), 60);
  v[C + 'AttyPartyInfo[0].State[0]'] = clean(pick(a, 'plaintiff_state'), 20);
  v[C + 'AttyPartyInfo[0].Zip[0]'] = clean(pick(a, 'plaintiff_zip'), 12);
  v[C + 'AttyPartyInfo[0].Phone[0]'] = clean(pick(a, 'plaintiff_phone', 'phone'), 30);
  v[C + 'AttyPartyInfo[0].Email[0]'] = clean(pick(a, 'plaintiff_email', 'email'), 120);
  v[C + 'AttyPartyInfo[0].AttyFor[0]'] = hasAtty ? clean(pick(a, 'attorney_for'), 60) : 'In Pro Per (Self-Represented)';
  v[C + 'CourtInfo[0].CrtCounty[0]'] = clean(pick(a, 'court_county'), 60);
  v[C + 'CourtInfo[0].CrtStreet[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[C + 'CourtInfo[0].CrtCityZip[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[C + 'CourtInfo[0].CrtBranch[0]'] = clean(pick(a, 'court_branch_name'), 80);
  v[C + 'TitlePartyName[0].Party1[0]'] = plaintiff;
  v[C + 'TitlePartyName[0].Party2[0]'] = defList[0] || '';
  v[P2 + 'PxCaption[0].TitlePartyName[0].Party1[0]'] = plaintiff;
  v[P2 + 'PxCaption[0].TitlePartyName[0].Party2[0]'] = defList[0] || '';

  // Title + item 1 — by default (the most common UD path) and, when the
  // landlord only seeks possession, a clerk's judgment for possession only.
  const byDefault = !/trial|contest/.test(lc(pick(a, 'judgment_basis')));
  const possessionOnly = /possession.?only|possession only/.test(lc(pick(a, 'judgment_scope'))) || byDefault;
  // CCP § 1169: the clerk may enter a default judgment for possession only.
  const clerksJudgment = byDefault && possessionOnly;
  if (byDefault) { v[C + 'FormTitle[0].RB2Choices[0]'] = true; v[P1 + 'List1[0].CheckBox1[0]'] = true; }
  if (possessionOnly) v[C + 'FormTitle[0].RB2Choices[1]'] = true;        // possession only
  if (clerksJudgment) {
    v[C + 'FormTitle[0].Ch91[0]'] = true;                                // by clerk (title)
    v[P1 + 'List1[0].Lid[0].CheckBox10[0]'] = true;                      // 1d clerk's judgment
    v[P2 + 'Title2[0].Ch91[0]'] = true;                                  // entered by the clerk (page 2)
  }

  // Items 3–5 — the operative possession judgment (landlord prepares; clerk
  // enters). Judgment is FOR plaintiff and AGAINST the defendant(s); the
  // plaintiff is entitled to possession of the premises; and it binds all
  // occupants. Money (item 6) is left blank — a clerk's judgment under § 1169
  // is for possession (and costs) only; damages need a separate hearing.
  if (byDefault) {
    if (plaintiff) {
      v[P2 + 'List3[0].Lia[0].CheckBox41[0]'] = true;                    // 3a judgment for plaintiff
      v[P2 + 'List3[0].Lia[0].FillText12[0]'] = plaintiff;
    }
    if (defList.length) v[P2 + 'List3[0].Lia[0].FillText11[0]'] = defList.join('; ');  // against defendant(s)
    v[P2 + 'List4[0].item4[0].RB2Choice29[0]'] = true;                   // 4 possession → plaintiff (item 3a)
    const premises = clean(pick(a, 'premises_address', 'rental_property_address'), 200);
    if (premises) v[P2 + 'List4[0].item4[0].FillText4[0]'] = premises;
    v[P2 + 'List5[0].item5[0].CBChoice26[0]'] = true;                    // 5 applies to all occupants
  }

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== '')));
}
module.exports = { ud_110FieldValues };
