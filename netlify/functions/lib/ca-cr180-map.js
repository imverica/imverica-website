'use strict';
/**
 * CR-180 (Petition for Dismissal) + CR-181 (Order for Dismissal) — STATEWIDE
 * Judicial Council forms (Pen. Code §§ 17(b), 17(d)(2), 1203.4, 1203.4a,
 * 1203.41, 1203.42, 1203.43, 1203.49). These are the record-cleanup /
 * expungement vehicle accepted in all CA counties (the 49 with no county-local
 * dismissal form route here). Filer = the defendant/petitioner, In-Pro-Per.
 *
 * Clean AcroForm with descriptive field names (no index-probe needed); mapping
 * verified against a real filed exemplar (Placer DUI, §1203.4 / Item 2). The
 * statute that applies (which Item) is the CLIENT's answer (`relief_basis`) — we
 * do not auto-decide eligibility (UPL/LDA). CR-181 is the proposed order: we
 * fill only the caption; the GRANTS/DENIES body is court use, left blank.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;

const P1 = 'CR-180[0].Page1[0].';
const CAP = P1 + 'P1Caption[0].';
const ATTY = CAP + 'AttyPartyInfo[0].';
const CRT = CAP + 'CourtInfo[0].';
const LI1 = P1 + 'LI1[0].li1[0].';
const ROW = (n) => `${LI1}ConvTable[0].Row${n}[0].`;
const LI2 = P1 + 'LI2[0].';
const P2 = 'CR-180[0].Page2[0].';
const P3 = 'CR-180[0].Page3[0].';

function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function lc(v) { return String(v || '').toLowerCase(); }
function truthy(v) { return /^(y|yes|true|1|да|так)$/.test(lc(v)) || v === true; }
function yn(v) { return truthy(v) ? 'Yes' : (/^(n|no|нет|ні)/.test(lc(v)) ? 'No' : clean(v, 8)); }

// Shared caption used by both CR-180 and CR-181 (different field roots).
function captionInto(v, a, roots) {
  const name = clean(pick(a, 'petitioner_name', 'defendant_name', 'client_name'), 120);
  v[roots.name] = name;
  v[roots.street] = clean(pick(a, 'petitioner_address_line1', 'address_line1', 'mailing_address_line1'), 120);
  v[roots.city] = clean(pick(a, 'petitioner_city', 'city', 'mailing_city'), 60);
  v[roots.state] = clean(pick(a, 'petitioner_state', 'state'), 20) || 'CA';
  v[roots.zip] = clean(pick(a, 'petitioner_zip', 'zip', 'mailing_zip'), 12);
  v[roots.phone] = clean(pick(a, 'petitioner_phone', 'phone'), 30);
  v[roots.email] = clean(pick(a, 'petitioner_email', 'email'), 120);
  v[roots.attyFor] = name ? `${name}, In Pro Per` : 'Defendant in Pro Per';
  v[roots.crtCounty] = clean(pick(a, 'county', 'court_county'), 60).toUpperCase();
  v[roots.crtStreet] = clean(pick(a, 'court_street', 'court_address'), 120);
  v[roots.crtMailing] = clean(pick(a, 'court_mailing', 'court_street', 'court_address'), 120);
  v[roots.crtCityZip] = clean(pick(a, 'court_city_zip'), 80);
  v[roots.defendant] = name;
  v[roots.caseNumber] = clean(pick(a, 'case_number'), 40);
  return name;
}

function cr_180FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};

  const name = captionInto(v, a, {
    name: ATTY + 'Name[0]', street: ATTY + 'Street[0]', city: ATTY + 'City[0]', state: ATTY + 'State[0]',
    zip: ATTY + 'Zip[0]', phone: ATTY + 'Phone[0]', email: ATTY + 'Email[0]', attyFor: ATTY + 'AttyFor[0]',
    crtCounty: CRT + 'CrtCounty[0]', crtStreet: CRT + 'CrtStreet[0]', crtMailing: CRT + 'CrtMailingAdd[0]',
    crtCityZip: CRT + 'CrtCityZip[0]', defendant: CAP + 'TitlePartyName[0].Defendant[0]',
    caseNumber: CAP + 'HeaderSub[0].Stmp[0].CaseNumber[0].CaseNumber1[0]'
  });
  // Running caption on pages 2 & 3.
  v[P2 + 'pXCaption[0].Defendant[0]'] = name;
  v[P2 + 'pXCaption[0].CaseNumber1[0]'] = clean(pick(a, 'case_number'), 40);
  v[P3 + 'pXCaption[0].Defendant[0]'] = name;
  v[P3 + 'pXCaption[0].CaseNumber1[0]'] = clean(pick(a, 'case_number'), 40);

  // ── Item 1: conviction date + offense table (up to 5 rows) ──
  v[LI1 + 'ConvictionDate[0]'] = clean(pick(a, 'conviction_date', 'convicted_on'), 30);
  const offenses = Array.isArray(a.offenses) ? a.offenses : [];
  offenses.slice(0, 5).forEach((o, i) => {
    const n = i + 1; const r = ROW(n);
    v[`${r}Code${n}[0]`] = clean(o.code, 30);
    v[`${r}Section${n}[0]`] = clean(o.section, 30);
    v[`${r}TypeOff${n}[0]`] = clean(o.type || o.level, 20);
    v[`${r}Reduce${n}[0]`] = yn(o.eligible_17b);            // col: eligible for reduction to misd (17b)
    v[`${r}Offense${n}[0]`] = yn(o.eligible_17d2);          // col: eligible for reduction to infraction (17d2)
  });

  // ── Relief basis (the client's answer decides which Item — not us) ──
  const basis = lc(pick(a, 'relief_basis', 'relief_type', 'statute'));

  // Item 2 — felony/misd WITH probation granted (§1203.4).
  if (/1203\.4\b|probation|item2|^2$/.test(basis) || /1203\.4(?!a)/.test(basis)) {
    v[LI2 + 'ProbationGranted[0]'] = true;
    if (truthy(pick(a, 'item2_fulfilled', 'probation_fulfilled'))) v[LI2 + 'li2a[0].ProbationGrantedReason[0]'] = true;
    if (truthy(pick(a, 'item2_discharged', 'probation_discharged_early'))) v[LI2 + 'li2b[0].ProbationGrantedReason[0]'] = true;
    if (truthy(pick(a, 'item2_interests', 'interests_of_justice'))) v[LI2 + 'li2c[0].ProbationGrantedReason[0]'] = true;
    const narr = clean(pick(a, 'item2_narrative', 'interests_narrative', 'relief_narrative'), 1200);
    if (narr) { v[LI2 + 'li2c[0].ProbationGrantedReason[0]'] = true; v[LI2 + 'li2c[0].TextField6[0]'] = narr; }
  }
  // Item 3 — misd/infraction with sentence other than probation (§1203.4a).
  if (/1203\.4a|item3|no.?probation/.test(basis)) {
    v[P2 + 'LI3[0].OffenseWSentence[0]'] = true;
    if (truthy(pick(a, 'item3_honest_life'))) v[P2 + 'LI3[0].li3a[0].ProbationNotGrantedReason[0]'] = true;
    const n3 = clean(pick(a, 'item3_narrative', 'relief_narrative'), 1200);
    if (truthy(pick(a, 'item3_interests')) || n3) v[P2 + 'LI3[0].li3b[0].ProbationNotGrantedReason[0]'] = true;
    if (n3) v[P2 + 'LI3[0].li3b[0].TextField6[0]'] = n3;
  }
  // Item 4 — §647(b) human-trafficking victim (§1203.49).
  if (/1203\.49|item4|traffick|647/.test(basis)) {
    v[P2 + 'LI4[0].li4[0].OffenseWSentence[0]'] = true;
    const n4 = clean(pick(a, 'item4_narrative', 'relief_narrative'), 1200);
    if (n4) v[P2 + 'LI4[0].li4[0].TextField6[0]'] = n4;
  }
  // Item 5 — felony county jail / state prison (§1203.41).
  if (/1203\.41|item5|felony.?jail/.test(basis)) {
    v[P2 + 'LI5[0].CheckBox19[0]'] = true;
    const opt = lc(pick(a, 'item5_option'));
    if (/a|jail.?with/.test(opt)) v[P2 + 'LI5[0].li5a[0].FelonyNotUnderSup[0]'] = true;
    else if (/b|jail.?without/.test(opt)) v[P2 + 'LI5[0].li5b[0].FelonyNotUnderSup[0]'] = true;
    else if (/c|prison/.test(opt)) v[P2 + 'LI5[0].li5c[0].FelonyNotUnderSup[0]'] = true;
    const n5 = clean(pick(a, 'item5_narrative', 'relief_narrative'), 1200);
    if (n5) v[P2 + 'LI5[0].li5c[0].T66[0]'] = n5;
  }
  // Item 6 — felony prison eligible post-2011 (§1203.42).
  if (/1203\.42|item6/.test(basis)) {
    v[P3 + 'LI6[0].li6[0].OffenseWSentence[0]'] = true;
    const n6 = clean(pick(a, 'item6_narrative', 'relief_narrative'), 1200);
    if (n6) v[P3 + 'LI6[0].li6[0].T66[0]'] = n6;
  }
  // Item 7 — deferred entry of judgment (§1203.43).
  if (/1203\.43|item7|deferred|dej/.test(basis)) {
    v[P3 + 'LI7[0].OffenseWSentence[0]'] = true;
    v[P3 + 'LI7[0].DateField1[0]'] = clean(pick(a, 'item7_dismissal_date', 'deferred_dismissal_date'), 30);
    const rec = lc(pick(a, 'item7_records'));
    if (/avail|7a/.test(rec)) v[P3 + 'LI7[0].li7a[0].Petitioner[0]'] = true;
    else if (/declar|7b/.test(rec)) {
      v[P3 + 'LI7[0].li7b[0].Petitioner[0]'] = true;
      const att = lc(pick(a, 'item7_attached'));
      if (/has.?not|not/.test(att)) v[P3 + 'LI7[0].li7b[0].LI7b[0].li7b2[0].CheckBox3[0]'] = true;
      else if (/has|attached/.test(att)) v[P3 + 'LI7[0].li7b[0].LI7b[0].li7b1[0].CheckBox3[0]'] = true;
    }
  }

  // ── Signature: print name; date left blank for the client to date at signing
  //    (matches the exemplar) unless explicitly supplied. ──
  v[P3 + 'SigName[0]'] = name;
  const sd = clean(pick(a, 'signature_date', 'executed_on'), 30);
  if (sd) v[P3 + 'SigDate[0]'] = sd;

  return Object.fromEntries(Object.entries(v).filter(([, x]) => x === true || (typeof x === 'string' && x !== '')));
}

// CR-181 — Order for Dismissal (proposed order): caption only; GRANTS/DENIES
// body is for the court, left blank.
function cr_181FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const C = 'CR-181[0].Page1[0].Caption[0].';
  const AT = C + 'AttyPartyInfo[0].';
  const CI = C + 'CourtInfo[0].';
  captionInto(v, a, {
    name: AT + 'Name[0]', street: AT + 'Street[0]', city: AT + 'City[0]', state: AT + 'State[0]',
    zip: AT + 'Zip[0]', phone: AT + 'Phone[0]', email: AT + 'Email[0]', attyFor: AT + 'AttyFor[0]',
    crtCounty: CI + 'CrtCounty[0]', crtStreet: CI + 'CrtStreet[0]', crtMailing: CI + 'CrtMailingAdd[0]',
    crtCityZip: CI + 'CrtCityZip[0]', defendant: C + 'TitlePartyName[0].Party1[0]',
    caseNumber: C + 'HeaderSub[0].CaseNumber[0].CaseNumber2[0]'
  });
  v['CR-181[0].Page2[0].P2Header[0].CaseNumber2[0]'] = clean(pick(a, 'case_number'), 40);
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x === true || (typeof x === 'string' && x !== '')));
}

module.exports = { cr_180FieldValues, cr_181FieldValues };
