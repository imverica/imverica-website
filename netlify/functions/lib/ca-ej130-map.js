'use strict';
/**
 * EJ-130 — Writ of Execution, used in an Unlawful Detainer as the WRIT OF
 * POSSESSION OF REAL PROPERTY. The ENFORCEMENT form: once a judgment for
 * possession is entered and any stay expires, the clerk issues this and the
 * sheriff posts a Notice to Vacate + performs the lockout. Filer = landlord
 * (the judgment creditor), In-Pro-Per.
 *
 * The writ references the JUDGMENT, which doesn't exist at intake — so we
 * pre-fill only the carryover facts: caption, form type (possession of real
 * property), the sheriff's county, judgment creditor (plaintiff) + debtor
 * (defendant), and the property description. Left for after the judgment: the
 * judgment-entered date, the dollar amounts (items 11–19), the case number,
 * and the clerk's certification. County-agnostic. Field names VERBATIM from
 * extract ej-130.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;
const C = 'EJ-130[0].Page1[0].StdP1Header[0].';
const P1 = 'EJ-130[0].Page1[0].';
const P3 = 'EJ-130[0].Page3[0].';
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function amount(v) { return Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0; }

function ej_130FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);

  // ── Caption (In-Pro-Per; the filer is the original judgment creditor). ──
  v[C + 'AttyInfo[0].AttyName[0]'] = plaintiff;
  v[C + 'AttyInfo[0].AttyStreet[0]'] = clean(pick(a, 'plaintiff_address_line1', 'mailing_address_line1'), 80);
  v[C + 'AttyInfo[0].AttyCity[0]'] = clean(pick(a, 'plaintiff_city', 'mailing_city'), 60);
  v[C + 'AttyInfo[0].AttyState[0]'] = clean(pick(a, 'plaintiff_state', 'state'), 20) || 'CA';
  v[C + 'AttyInfo[0].AttyZip[0]'] = clean(pick(a, 'plaintiff_zip', 'mailing_zip'), 12);
  v[C + 'AttyInfo[0].Phone[0]'] = clean(pick(a, 'plaintiff_phone', 'phone'), 30);
  v[C + 'AttyInfo[0].Email[0]'] = clean(pick(a, 'plaintiff_email', 'email'), 120);
  v[C + 'AttyInfo[0].CB\\.AttyFor[1]'] = true;                  // ORIGINAL JUDGMENT CREDITOR
  v[C + 'CourtInfo[0].CrtCounty[0]'] = clean(pick(a, 'court_county'), 60);
  v[C + 'CourtInfo[0].Street[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[C + 'CourtInfo[0].CityZip[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[C + 'CourtInfo[0].Branch[0]'] = clean(pick(a, 'court_branch_name'), 80);
  v[C + 'TitlePartyName[0].Party1[0]'] = plaintiff;
  v[C + 'TitlePartyName[0].Party2[0]'] = defList.join('; ');
  // Running caption header on pages 2 & 3 (CaptionPx).
  for (const P of ['EJ-130[0].Page2[0].', 'EJ-130[0].Page3[0].']) {
    v[P + 'CaptionPx[0].TitlePartyName[0].Party1[0]'] = plaintiff;
    v[P + 'CaptionPx[0].TitlePartyName[0].Party2[0]'] = defList.join('; ');
  }
  // Limited vs unlimited (same $35k threshold as the complaint).
  const demand = amount(pick(a, 'amount_demanded', 'rent_due_amount', 'amount_owed'));
  v[C + 'captionSub[0].CaseDef[0].CB03[' + (demand > 35000 ? '1' : '0') + ']'] = true;

  // ── Form title — POSSESSION OF → Real Property (writ of possession). ──
  v[C + 'FormTitle[0].C1[1]'] = true;                          // POSSESSION OF
  v[C + 'FormTitle[0].CB\\.0\\.01[1]'] = true;                  // Real Property

  // ── Body — the parties + the property (the judgment data is post-entry). ──
  v[P1 + 'top[0].li1[0].FillText74[0]'] = clean(pick(a, 'court_county'), 60);   // Sheriff of the County of
  v[P1 + 'top[0].li3[0].FillText75[0]'] = plaintiff;                            // judgment creditor name
  v[P1 + 'top[0].li3[0].serverType[0]'] = true;                                 // original judgment creditor
  v[P1 + 'leftSub[0].li4[0].FillText90[0]'] = defList.join('; ');               // judgment debtor(s)
  v[P1 + 'leftSub[0].li7[0].LI1[0].li7a[0].NoticeOfSale[0]'] = true;            // sale notice NOT requested (UD possession)
  v[P1 + 'rightSub[0].li9[0].writPoss[0]'] = true;                              // Writ of Possession info on next page

  // ── Item 25 — Writ of Possession: possession of real property + property. ──
  v['EJ-130[0].Page2[0].List25[0].li25a[0].CB25possession[0]'] = true;
  v[P3 + 'List25cont[0].li25e[0].FillText138[0]'] = clean(pick(a, 'premises_address', 'rental_property_address'), 200);
  v[P3 + 'List25cont[0].li25e[0].CB_25eBelowAttachment[0]'] = true;             // property described below

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== '')));
}
module.exports = { ej_130FieldValues };
