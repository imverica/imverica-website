#!/usr/bin/env node
'use strict';
/**
 * Generate a COMPLETE California divorce-with-children packet (petitioner side),
 * flattened, merged into one PDF. Demo data = John & Jane Smith, Sacramento.
 *
 * Mapped forms (hand maps): FL-100 Petition, FL-110 Summons.
 * Direct-schema forms (filled here by id-leaf + label): FL-105 UCCJEA,
 * FL-150 Income & Expense, FL-142 Assets & Debts, FL-141 Disclosure decl,
 * FL-117 Notice & Acknowledgment of Receipt.
 *
 * Output: ~/Desktop/Divorce-Packet-Smith-FULL.pdf  (+ /tmp/divorce-full.pdf)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { fillAndFlattenCourtForm } = require('../netlify/functions/lib/ca-court-fill');
const { getDirectCourtSchema } = require('../netlify/functions/lib/ca-court-direct-schema');
const { getBuilder } = require('../netlify/functions/lib/ca-court-registry');

const CA = path.resolve(__dirname, '../assets/form-cache/ca-court');

// ---- Demo profile -------------------------------------------------------
const P = {
  petName: 'John Michael Smith', petFirst: 'John', petMid: 'Michael', petLast: 'Smith',
  resName: 'Jane Anne Smith', resFirst: 'Jane', resMid: 'Anne', resLast: 'Smith',
  street: '456 New Street, Apt 5', city: 'Sacramento', state: 'CA', zip: '95814',
  phone: '(916) 399-3992', email: 'john.smith@example.com',
  court: 'SACRAMENTO', crtStreet: '3341 Power Inn Road', crtCityZip: 'Sacramento, CA 95826',
  crtBranch: 'Family Relations Courthouse', caseNo: '26FL01234', shortTitle: 'Smith v. Smith',
  marriage: '06/20/2015', separation: '11/01/2025', signDate: '11/15/2025',
  kids: [
    { name: 'Emma Smith', dob: '03/12/2017', place: 'Sacramento, CA' },
    { name: 'Liam Smith', dob: '08/30/2019', place: 'Sacramento, CA' }
  ],
  occupation: 'Warehouse Supervisor', employer: 'Acme Distribution Inc.',
  employerAddr: '900 Industrial Blvd, Sacramento, CA 95826',
  age: '40', education: '4 years of college',
  grossMonth: '5800', netMonth: '4450',
};
const MD = (s) => s; // dates already mm/dd/yyyy

// ---- Shared caption (every JC form) — LABEL-driven so it works across the
// different id-leaf naming each form uses (AttyInfo / AttyPartyInfo / AddInfo /
// StdP1Header…). Court-vs-party address is disambiguated by id prefix. --------
function caption(leaf, label) {
  const L = leaf.toLowerCase();
  const lb = (label || '').toLowerCase().replace(/[._:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const inCourt = /crtinfo|courtinfo/.test(L);
  const inParty = /attyinfo|attypartyinfo|addinfo|othercontact/.test(L) && !inCourt;

  // Combined "ATTORNEY OR PARTY WITHOUT ATTORNEY (name and address)" single box.
  if (/attorney or party without attorney/.test(lb) || /partyattyaddinfo/.test(L))
    return `${P.petName}\n${P.street}\n${P.city}, ${P.state} ${P.zip}\nTel: ${P.phone}`;

  // Court block first (so court street/city win over party).
  if (inCourt || /superior court of california/.test(lb)) {
    if (/county/.test(lb) || /crtcounty/.test(L)) return P.court;
    if (/branch/.test(lb)) return P.crtBranch;
    if (/mailing/.test(lb)) return P.crtStreet;
    if (/city and zip|cityzip/.test(L) || /city and zip/.test(lb)) return P.crtCityZip;
    if (/street/.test(lb)) return P.crtStreet;
    return undefined;
  }

  // Party names + case identifiers.
  if (/^petitioner$/.test(lb) || /\bparty1\b/.test(L)) return P.petName;
  if (/^respondent$/.test(lb) || /\bparty2\b/.test(L)) return P.resName;
  if (/other par|^party[345]/.test(lb) || /\bparty[345]\b/.test(L)) return '';
  if (/case ?number/.test(lb) || /casenumber|caseno/.test(L)) return P.caseNo;
  if (/case ?name|short ?title/.test(lb) || /shorttitle|casename/.test(L)) return P.shortTitle;
  if (/state bar/.test(lb)) return '';

  // Party contact block (separate fields).
  if (inParty || /attyname|attystreet|attycity|attystate|attyzip/.test(L)) {
    if (/firm/.test(lb)) return '';
    if (/attorney for/.test(lb)) return 'Self-Represented (Petitioner)';
    if (/fax/.test(lb)) return '';
    if (/e-?mail|email/.test(lb)) return P.email;
    if (/phone|telephone/.test(lb)) return P.phone;
    if (/street/.test(lb)) return P.street;
    if (/^city$/.test(lb) || /attycity/.test(L)) return P.city;
    if (/^state$/.test(lb) || /attystate/.test(L)) return P.state;
    if (/zip/.test(lb)) return P.zip;
    if (/^name$/.test(lb) || /attyname/.test(L)) return P.petName;
  }
  return undefined;
}

// ---- Per-form body ------------------------------------------------------
function body(slug, leaf, label, field) {
  const L = leaf.toLowerCase();
  const lb = (label || '').toLowerCase();

  if (slug === 'fl-105') {
    if (/party\.partyrepcb/.test(L)) return true;             // "a party to this proceeding"
    if (/numchildren/.test(L)) return String(P.kids.length);
    const m = L.match(/table\.row(\d)\./);
    if (m) { const k = P.kids[+m[1] - 1]; if (k) {
      if (/textfield7|textfield8/.test(L)) return k.name;
      if (/textfield1/.test(L) && /date of birth/.test(lb)) return k.dob;
      if (/textfield2/.test(L) && /place of birth/.test(lb)) return k.place;
    }}
    if (/table3a\.row1\.from1/.test(L)) return P.kids[0].dob;
    if (/table3a\.row1\.to1?/.test(L) && /to/.test(lb)) return 'Present';
    if (/table3a\.row1\.residence1/.test(L)) return P.city + ', ' + P.state;
    if (/table3a\.row1\.personstreet1/.test(L)) return P.petName + ' & ' + P.resName + ' (parents), ' + P.street + ', ' + P.city + ' ' + P.state + ' ' + P.zip;
    if (/table3a\.row1\.relationship1/.test(L)) return 'Parents';
    if (/list3\.li1\.onemanycb/.test(L)) return true;         // one residence for all children
  }

  if (slug === 'fl-150') {
    // Clearly-labeled employment / pay fields (exact-match the real labels).
    if (/^employer$/.test(lb)) return P.employer;
    if (/employer.?s address/.test(lb)) return P.employerAddr;
    if (/employer.?s phone/.test(lb)) return P.phone;
    if (/date job started/.test(lb)) return '06/01/2018';
    if (/hours per week/.test(lb)) return '40';
    if (/i get paid/.test(lb)) return '5,800';
    if (/my age is/.test(lb)) return P.age;
    if (/years of college completed/.test(lb)) return '4';
    if (/number of exemptions/.test(lb)) return '1';
    if (/other party.?s income/.test(lb) && /gross monthly/.test(lb)) return '3,500';
    if (/occupation/.test(lb)) return P.occupation;
    if (/print name/.test(lb)) return P.petName;
  }

  if (slug === 'fl-142') {
    // Field numbering varies per List, so target by (List number + label).
    const m = L.match(/list(\d+)\.li1/);
    if (!m) {
      if (/signame|print name/.test(L) || /print name/.test(lb)) return P.petName;
      if (/sigdate/.test(L) || (/^date$/.test(lb) && /sign/.test(L))) return P.signDate;
      return undefined;
    }
    const n = +m[1];
    const ASSETS = {
      1:  { desc: 'Family residence — 456 New Street, Apt 5, Sacramento, CA 95814', fmv: '480,000', owed: '310,000' },
      2:  { desc: 'Furniture, appliances, and household goods', fmv: '8,000' },
      4:  { desc: '2019 Toyota RAV4 (loan through Acme CU)', fmv: '19,000', owed: '9,200' },
      5:  { desc: 'Wells Fargo savings, acct ending 1234', fmv: '11,000' },
      6:  { desc: 'Wells Fargo checking, acct ending 5678', fmv: '4,500' },
      12: { desc: 'Acme Distribution 401(k) plan', fmv: '42,000' }
    };
    const DEBTS = {
      19: { desc: 'Federal student loans (Nelnet), acct ending 4321', owing: '14,000' },
      23: { desc: 'Chase Visa credit card, acct ending 9012', owing: '7,500' }
    };
    if (n === 18) { // totals row
      if (/total1/.test(L)) return '564,500';   // total fair market value
      if (/total2/.test(L)) return '319,200';   // total owed / encumbrances
      return undefined;
    }
    const a = ASSETS[n], d = DEBTS[n];
    if (a) {
      if (/current gross fair market value/.test(lb)) return a.fmv;
      if (/amount of money owed/.test(lb)) return a.owed || undefined;
      if (/^\d+\.\s/.test(lb)) return a.desc;            // the category description field
    }
    if (d) {
      if (/total owing/.test(lb)) return d.owing;
      if (/^\d+\.\s/.test(lb)) return d.desc;
    }
  }

  if (slug === 'fl-141') {
    if (/petitioner/.test(lb) && /preliminary/.test(lb)) return true;
    if (/date/.test(lb)) return P.separation;
  }

  if (slug === 'fl-117') {
    if (/date.*mailed|date this/.test(lb)) return P.separation;
  }
  return undefined;
}

async function fillDirect(slug, title) {
  const schema = await getDirectCourtSchema(slug, title);
  const vals = {};
  let filled = 0;
  for (const st of schema.steps || []) for (const f of st.fields || []) {
    const leaf = f.id.split('.').slice(-3).join('.').replace(/\[\d+\]/g, '');
    let v = caption(leaf, f.label);
    if (v === undefined) v = body(slug, leaf, f.label, f);
    if (v === undefined || v === '' || v === false) continue;
    vals[f.id] = v; filled++;
  }
  const res = await fillAndFlattenCourtForm(fs.readFileSync(path.join(CA, slug + '.pdf')), vals);
  return { buffer: res.buffer, filled };
}

async function fillMapped(slug) {
  const A = {
    case_type: 'dissolution', relationship_type: 'marriage',
    petitioner_first_name: P.petFirst, petitioner_middle_name: P.petMid, petitioner_last_name: P.petLast,
    respondent_first_name: P.resFirst, respondent_middle_name: P.resMid, respondent_last_name: P.resLast,
    petitioner_address_line1: P.street, petitioner_city: P.city, petitioner_state: P.state, petitioner_zip: P.zip,
    petitioner_phone: '9163993992', petitioner_email: P.email,
    date_of_marriage: '2015-06-20', date_of_separation: '2025-11-01',
    petitioner_meets_residency: 'yes', petitioner_residence_county: 'Sacramento County',
    minor_children: [{ name: 'Emma Smith', birthdate: '2017-03-12', age: '9' }, { name: 'Liam Smith', birthdate: '2019-08-30', age: '6' }],
    court_county: 'Sacramento', court_street_address: P.crtStreet, court_city_zip: P.crtCityZip,
    court_branch_name: P.crtBranch, case_number: P.caseNo
  };
  const res = await fillAndFlattenCourtForm(fs.readFileSync(path.join(CA, slug + '.pdf')),
    getBuilder(slug).build({ formAnswers: A, contact: { name: P.petName, phone: '9163993992', email: P.email } }));
  return { buffer: res.buffer, filled: 'mapped' };
}

(async () => {
  const order = [
    ['fl-100', 'Petition', 'mapped'],
    ['fl-110', 'Summons', 'mapped'],
    ['fl-105', 'Declaration Under UCCJEA', 'direct'],
    ['fl-150', 'Income and Expense Declaration', 'direct'],
    ['fl-142', 'Schedule of Assets and Debts', 'direct'],
    ['fl-141', 'Declaration Regarding Service of Declaration of Disclosure', 'direct'],
    ['fl-117', 'Notice and Acknowledgment of Receipt', 'direct']
  ];
  const out = await PDFDocument.create();
  for (const [slug, title, kind] of order) {
    const r = kind === 'mapped' ? await fillMapped(slug) : await fillDirect(slug, title);
    const d = await PDFDocument.load(r.buffer, { ignoreEncryption: true });
    (await out.copyPages(d, d.getPageIndices())).forEach((p) => out.addPage(p));
    console.log(`  ${slug.toUpperCase().padEnd(7)} ${d.getPageCount()}p  filled=${r.filled}`);
  }
  const bytes = await out.save();
  fs.writeFileSync('/tmp/divorce-full.pdf', bytes);
  fs.writeFileSync(os.homedir() + '/Desktop/Divorce-Packet-Smith-FULL.pdf', bytes);
  console.log(`\n  PACKET: ${(bytes.length / 1024 | 0)}KB · ${(await PDFDocument.load(bytes)).getPageCount()} pages → ~/Desktop/Divorce-Packet-Smith-FULL.pdf`);
})().catch((e) => { console.error('FATAL', e.stack || e.message); process.exit(1); });
