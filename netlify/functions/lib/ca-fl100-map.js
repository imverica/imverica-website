'use strict';
/**
 * FL-100 — Petition (Marriage/Domestic Partnership) field map.
 *
 * Maps Imverica intake answers → FL-100 AcroForm field names. All field
 * names + the labels in comments are taken VERBATIM from the form's /TU
 * tooltips (see scripts/extract-ca-fields.js fl-100). No invented labels.
 *
 * Scope: this map fills the objective, intake-derivable parts of FL-100:
 *   - Caption (party/attorney/court/case number)        [universal block]
 *   - Form title (dissolution / legal separation / nullity × marriage/DP)
 *   - Legal relationship + residency requirement boxes
 *   - Dates of marriage + separation
 *   - Minor children (none, or up to 4: name / birth date / age)
 *
 * It intentionally does NOT auto-decide the relief sections (property
 * division, spousal support, attorney fees, grounds for nullity). Those
 * require legal judgment and are left for the supervising attorney to
 * complete — consistent with Imverica's LDA + attorney-supervision model.
 *
 * Consumed by generate-court-pdf via lib/ca-court-fill.js (pdf-lib).
 */

const P1 = 'FL-100[0].Page1[0].';
const CAP = P1 + 'CaptionP1_sf[0].';

// ─── tiny formatters (mirror the USCIS maps' style) ────────────────────
function clean(v, max = 200) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}
function dateMdY(v) {
  const t = clean(v, 40);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  return t;
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
// Build "LAST, First Middle" as courts caption parties.
function partyName(a, who) {
  const last = clean(a[`${who}_last_name`] || a[`${who}_family_name`], 60);
  const first = clean(a[`${who}_first_name`] || a[`${who}_given_name`], 60);
  const mid = clean(a[`${who}_middle_name`], 60);
  if (last && (first || mid)) return `${last}, ${[first, mid].filter(Boolean).join(' ')}`.trim();
  return clean(a[`${who}_name`] || a[`${who}_full_name`] || [first, mid, last].filter(Boolean).join(' '), 120);
}

function truthy(v) {
  const t = clean(v, 20).toLowerCase();
  return ['yes', 'true', 'да', 'так', 'sí', 'si', '1', 'on', 'checked'].includes(t) || v === true;
}

function fl_100FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};

  // ── Caption: attorney / self-represented party info ──────────────────
  // Imverica clients are typically self-represented (in pro per). We fill
  // the party's own contact block; bar number stays blank unless provided.
  const filerName = partyName(a, 'petitioner') || clean(c.name, 120);
  v[CAP + 'AttyInfo[0].AttyName_ft[0]'] = clean(a.petitioner_name || c.name, 80);            // NAME:
  v[CAP + 'AttyInfo[0].AttyFirm_ft[0]'] = clean(a.filer_firm_name, 80);                       // FIRM NAME:
  v[CAP + 'AttyInfo[0].AttyStreet_ft[0]'] = clean(a.petitioner_address_line1 || a.mailing_address_line1, 80); // STREET ADDRESS:
  v[CAP + 'AttyInfo[0].AttyCity_ft[0]'] = clean(a.petitioner_city || a.mailing_city, 60);     // CITY:
  v[CAP + 'AttyInfo[0].AttyState_ft[0]'] = stateCode(a.petitioner_state || a.mailing_state);  // STATE:
  v[CAP + 'AttyInfo[0].AttyZip_ft[0]'] = digits(a.petitioner_zip || a.mailing_zip, 10);       // ZIP CODE:
  v[CAP + 'AttyInfo[0].Phone_ft[0]'] = usPhone(a.petitioner_phone || a.phone || c.phone);     // TELEPHONE NO.:
  v[CAP + 'AttyInfo[0].Email_ft[0]'] = clean(a.petitioner_email || a.email || c.email, 120);  // E-MAIL ADDRESS:
  v[CAP + 'AttyInfo[0].BarNo_ft[0]'] = clean(a.filer_bar_number, 12);                          // STATE BAR NUMBER:
  // ATTORNEY FOR (name): self-represented unless a firm/bar number given.
  v[CAP + 'AttyInfo[0].AttyFor_ft[0]'] = clean(a.filer_bar_number ? a.attorney_for : 'In Pro Per (Self-Represented)', 60);

  // ── Caption: court ───────────────────────────────────────────────────
  v[CAP + 'CourtInfo[0].CrtCounty_ft[0]'] = clean(a.court_county, 60).toUpperCase();           // SUPERIOR COURT ... COUNTY OF
  v[CAP + 'CourtInfo[0].Street_ft[0]'] = clean(a.court_street_address, 80);                     // STREET ADDRESS:
  v[CAP + 'CourtInfo[0].MailingAdd_ft[0]'] = clean(a.court_mailing_address, 80);                // MAILING ADDRESS:
  v[CAP + 'CourtInfo[0].CityZip_ft[0]'] = clean(a.court_city_zip, 80);                          // CITY AND ZIP CODE:
  v[CAP + 'CourtInfo[0].Branch_ft[0]'] = clean(a.court_branch_name, 80);                        // BRANCH NAME:

  // ── Caption: parties + case number ───────────────────────────────────
  v[CAP + 'TitlePartyName[0].Party1_ft[0]'] = partyName(a, 'petitioner');                      // PETITIONER:
  v[CAP + 'TitlePartyName[0].Party2_ft[0]'] = partyName(a, 'respondent');                      // RESPONDENT:
  v[CAP + 'CaseNumber[0].CaseNumber_ft[0]'] = clean(a.case_number, 30);                         // CASE NUMBER:

  // ── Form title: what is being requested × relationship type ──────────
  // case_type ∈ {dissolution|divorce, legal_separation, nullity}
  // relationship ∈ {marriage, domestic_partnership}
  const caseType = clean(a.case_type, 40).toLowerCase();
  const rel = clean(a.relationship_type, 40).toLowerCase();
  const isMarriage = /marriage|brak|matrimonio|шлюб|брак/.test(rel) || (!rel);
  const isDP = /domestic|partner|партн/.test(rel);
  if (/dissolution|divorce|развод|divorcio/.test(caseType)) {
    v[CAP + 'FormTitle[0].DissolutionOf_cb[0]'] = true;                                         // Dissolution (Divorce) of:
    if (isMarriage) v[CAP + 'FormTitle[0].Marriage_cb[0]'] = true;                              //   Marriage
    if (isDP) v[CAP + 'FormTitle[0].DomesticPartnership_cb[0]'] = true;                         //   Domestic Partnership
  } else if (/legal.?separation|раздел|separac/.test(caseType)) {
    v[CAP + 'FormTitle[0].LegalSeparationOf_cb[0]'] = true;                                     // Legal Separation of:
    if (isMarriage) v[CAP + 'FormTitle[0].Marriage_cb[2]'] = true;
    if (isDP) v[CAP + 'FormTitle[0].DomesticPartnership_cb[2]'] = true;
  } else if (/nullity|annul|аннул|nulidad/.test(caseType)) {
    v[CAP + 'FormTitle[0].NullityOf_cb[0]'] = true;                                             // Nullity of:
    if (isMarriage) v[CAP + 'FormTitle[0].Marriage_cb[1]'] = true;
    if (isDP) v[CAP + 'FormTitle[0].DomesticPartnership_cb[1]'] = true;
  }
  if (truthy(a.is_amended)) v[CAP + 'FormTitle[0].Amended_cb[0]'] = true;                       // AMENDED

  // ── 1. Legal relationship ────────────────────────────────────────────
  if (isMarriage) v[P1 + 'WeAreMarried_cb[0]'] = true;                                          // We are married.
  if (isDP && truthy(a.dp_established_in_ca)) v[P1 + 'DPEstablishedInCalifornia[0]'] = true;
  if (isDP && !truthy(a.dp_established_in_ca) && a.dp_established_in_ca !== undefined) {
    v[P1 + 'DPNOTEstablishedinCA_cb[0]'] = true;
  }

  // ── 2. Residence requirements ────────────────────────────────────────
  if (truthy(a.petitioner_meets_residency)) v[P1 + 'PetitionerMeetsResidencyReqs_cb[0]'] = true;
  if (truthy(a.respondent_meets_residency)) v[P1 + 'RespondentMeetsResidencyReqs_cb[0]'] = true;
  v[P1 + 'PetitionersResidence_tf[0]'] = clean(a.petitioner_residence_county, 60);              // Petitioner lives in (specify):
  v[P1 + 'RespondentsResidence_tf[0]'] = clean(a.respondent_residence_county, 60);              // Respondent lives in (specify):

  // ── 3. Statistical facts: dates ──────────────────────────────────────
  v[P1 + 'DateOfMarriage_dt[0]'] = dateMdY(a.date_of_marriage);                                 // Date of marriage (specify):
  v[P1 + 'DateOfSeparation_dt[0]'] = dateMdY(a.date_of_separation);                             // Date of separation (specify):

  // ── 4. Minor children ────────────────────────────────────────────────
  const children = Array.isArray(a.minor_children) ? a.minor_children.slice(0, 4) : [];
  if (truthy(a.no_minor_children) || (a.minor_children !== undefined && children.length === 0)) {
    v[P1 + 'ThereAreNoMinorChildren_cb[0]'] = true;                                             // There are no minor children.
  } else if (children.length) {
    v[P1 + 'MinorChildren_sf[0].MinorChildrenList_cb[0]'] = true;                               // The minor children are:
    const slots = [
      { name: 'Child1Name_tf[0]', dob: 'Child1Birthdate_dt[0]', age: 'Child1Age_tf[0]' },
      { name: 'Child2Name_tf[0]', dob: 'Child2Birthdate_dt[0]', age: 'Child2Age_tf[0]' },
      { name: 'Child3Name_tf[0]', dob: 'Child3Date_dt[0]',      age: 'Child3Age_tf[0]' },
      { name: 'Child4Name_tf[0]', dob: 'Child4Birthdate_dt[0]', age: 'Child4Age_tf[0]' }
    ];
    children.forEach((child, i) => {
      const s = slots[i]; if (!s) return;
      v[P1 + 'MinorChildren_sf[0].' + s.name] = clean(child.name || child.child_name, 60);
      v[P1 + 'MinorChildren_sf[0].' + s.dob] = dateMdY(child.birthdate || child.dob);
      v[P1 + 'MinorChildren_sf[0].' + s.age] = clean(child.age, 3);
    });
    if (Array.isArray(a.minor_children) && a.minor_children.length > 4) {
      v[P1 + 'MinorChildren_sf[0].Attachment4b[0]'] = true;                                     // continued on Attachment 4b.
    }
  }

  // Drop empties so the engine reports an honest filled count.
  return Object.fromEntries(
    Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== ''))
  );
}

module.exports = { fl_100FieldValues };
