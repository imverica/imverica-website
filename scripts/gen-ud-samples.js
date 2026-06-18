'use strict';
// Generate the full UD packet from one coherent SYNTHETIC scenario (no PII) so
// the owner can open and inspect the rendered PDFs. Output → ~/Documents/UD/generated/
const fs = require('fs'), os = require('os'), path = require('path');
const { PDFDocument } = require('pdf-lib');

const OUT = path.join(os.homedir(), 'Documents', 'UD', 'generated');
fs.mkdirSync(OUT, { recursive: true });
const TPL = path.resolve(__dirname, '..', 'assets', 'form-cache', 'ca-court');

const scenario = {
  plaintiff_name: 'Maria Gonzalez', landlord_name: 'Maria Gonzalez', plaintiff_type: 'individual',
  plaintiff_address_line1: '742 Evergreen Terrace', plaintiff_city: 'Fresno', plaintiff_state: 'CA', plaintiff_zip: '93721',
  plaintiff_phone: '559-555-0142', plaintiff_email: 'landlord@example.com',
  court_county: 'FRESNO', court_street_address: '1130 O Street', court_city_zip: 'Fresno 93721', court_branch_name: 'B.F. Sisk Courthouse',
  defendant_name: 'John Tenant', tenant_name: 'John Tenant', doe_defendants: 'yes', doe_count: '10',
  tenant_address_line1: '500 Rent Street', tenant_city: 'Fresno', tenant_zip: '93721', tenant_phone: '559-555-0199',
  premises_address: '500 Rent Street, Fresno, CA 93721', premises_city: 'Fresno', property_type: 'residential',
  amount_demanded: '10400', complaint_demand: '10400',
  tenancy_type: 'one year', tenancy_start_date: '06/01/2025', rent_amount: '2000', rent_frequency: 'monthly', rent_due_day: 'first',
  agreement_type: 'written', agreement_made_with: 'plaintiff', agreement_attached: 'no', other_occupants: 'unknown occupants',
  subject_to_tpa: 'yes', just_cause: 'at-fault',
  notice_type: '3-day notice to pay rent or quit', notice_served_date: '02/01/2026', notice_expired_date: '02/04/2026',
  notice_election_forfeiture: 'yes', notice_attached: 'yes', service_method: 'personal',
  rent_due_amount: '10400', daily_rental_value: '86.67',
  defenses: ['rent-control', 'tpa-noncompliance'],
  judgment_basis: 'default', judgment_scope: 'possession only'
};

function fillField(form, name, val) {
  const f = form.getField(name); const t = f.constructor.name;
  if (val === true) { if (t.includes('CheckBox')) f.check(); return; }
  if (t.includes('TextField')) { f.setText(String(val)); return; }
  if (t.includes('Dropdown') || t.includes('OptionList')) { try { f.select(String(val)); } catch { /* not a valid option */ } return; }
}

const forms = [
  ['ca-ud100', 'ud-100.pdf', 'UD-100_Complaint'],
  ['ca-sum130', 'sum-130.pdf', 'SUM-130_Summons'],
  ['ca-ud101', 'ud-101.pdf', 'UD-101_CoverSheet'],
  ['ca-cm010', 'cm-010.pdf', 'CM-010_CivilCoverSheet'],
  ['ca-pos010', 'pos-010.pdf', 'POS-010_ProofOfService'],
  ['ca-civ100', 'civ-100.pdf', 'CIV-100_RequestForDefault'],
  ['ca-ud110', 'ud-110.pdf', 'UD-110_Judgment'],
  ['ca-ud105', 'ud-105.pdf', 'UD-105_Answer_Tenant'],
  ['ca-pos030', 'pos-030.pdf', 'POS-030_ProofByMail']
];

(async () => {
  for (const [slug, tpl, outName] of forms) {
    const m = require('../netlify/functions/lib/' + slug + '-map');
    const v = m[Object.keys(m)[0]]({ formAnswers: scenario });
    delete v._overflow;
    const doc = await PDFDocument.load(fs.readFileSync(path.join(TPL, tpl)));
    const form = doc.getForm();
    let ok = 0;
    for (const [n, val] of Object.entries(v)) { try { fillField(form, n, val); ok++; } catch { /* skip */ } }
    fs.writeFileSync(path.join(OUT, outName + '.pdf'), await doc.save());
    console.log(outName, '—', ok, 'fields');
  }
  // MC-025 overflow demo (4 defendants).
  const { ud_100FieldValues } = require('../netlify/functions/lib/ca-ud100-map');
  const { mc_025FieldValues, bodyFromOverflow } = require('../netlify/functions/lib/ca-mc025-map');
  const ov = ud_100FieldValues({ formAnswers: { ...scenario, defendants: ['John Tenant', 'Jane Tenant', 'Bob Roe', 'Alice Doe'], notices_differ_per_defendant: 'yes' } })._overflow;
  const mc = mc_025FieldValues({ shortTitle: 'Gonzalez v. Tenant', caseNumber: '(not assigned)', attachmentNumber: ov.attachmentNumber, body: bodyFromOverflow(ov) });
  const mdoc = await PDFDocument.load(fs.readFileSync(path.join(TPL, 'mc-025.pdf')));
  const mform = mdoc.getForm();
  for (const [n, val] of Object.entries(mc)) { try { fillField(mform, n, val); } catch { /* skip */ } }
  fs.writeFileSync(path.join(OUT, 'MC-025_Attachment10c_overflow.pdf'), await mdoc.save());
  console.log('MC-025_Attachment10c_overflow — generated');
  console.log('\nAll PDFs →', OUT);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
