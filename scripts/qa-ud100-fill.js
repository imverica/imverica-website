'use strict';
// Regression: fill UD-100 from wizard answers (synthetic scenario).
// Fills the decrypted UD-100 template from wizard-style answers and reports
// which fields/checkboxes were set, plus any that failed.  node scripts/qa-ud100-fill.js
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { ud_100FieldValues } = require('../netlify/functions/lib/ca-ud100-map');

// A synthetic UD scenario, expressed the way the wizard would collect them.
const answers = {
  plaintiff_name: 'Maria Gonzalez',
  plaintiff_address_line1: '742 Evergreen Terrace', plaintiff_city: 'Fresno', plaintiff_state: 'CA', plaintiff_zip: '93721',
  plaintiff_phone: '559-555-0142', plaintiff_email: 'landlord@example.com',
  court_county: 'FRESNO', court_street_address: '1130 O Street', court_city_zip: 'Fresno 93721', court_branch_name: 'B.F. Sisk Courthouse',
  defendant_name: 'John Tenant', doe_defendants: true, doe_count: '10',
  plaintiff_type: 'individual', plaintiff_interest: 'owner',
  premises_address: '500 Rent Street, Fresno, CA 93721', premises_city: 'Fresno',
  amount_demanded: '10400',
  tenancy_type: 'one year', tenancy_start_date: '06/01/2025', rent_amount: '2000',
  rent_frequency: 'monthly', rent_due_day: 'first',
  agreement_type: 'written', agreement_made_with: 'plaintiff', agreement_attached: 'no',
  subject_to_tpa: 'yes', just_cause: 'at-fault', other_occupants: 'unknown occupants',
  notice_type: '3-day notice to pay rent or quit', notice_served_date: '02/01/2026', notice_expired_date: '02/04/2026',
  notice_election_forfeiture: 'yes', notice_attached: 'yes',
  service_method: 'personal',
  rent_due_amount: '10400', daily_rental_value: '86.67'
};

const v = ud_100FieldValues({ formAnswers: answers });
const overflow = v._overflow; delete v._overflow;

const pdfPath = path.resolve(__dirname, '../assets/form-cache/ca-court/ud-100.pdf');
(async () => {
  const doc = await PDFDocument.load(fs.readFileSync(pdfPath));
  const form = doc.getForm();
  let setText = 0, setCheck = 0; const failed = [];
  for (const [name, val] of Object.entries(v)) {
    try {
      const f = form.getField(name);
      const t = f.constructor.name;
      if (val === true && t.includes('CheckBox')) { f.check(); setCheck++; }
      else if (t.includes('TextField')) { f.setText(String(val)); setText++; }
      else if (val === true) { try { f.check(); setCheck++; } catch { failed.push(name + ' (not a checkbox)'); } }
      else failed.push(name + ' (' + t + ')');
    } catch (e) { failed.push(name + ' — ' + e.message.split('\n')[0]); }
  }
  fs.writeFileSync('/tmp/ud100-sample.pdf', await doc.save());
  console.log('UD-100 fill — text set:', setText, '| checkboxes set:', setCheck, '| failed:', failed.length);
  if (failed.length) console.log('FAILED:\n  ' + failed.join('\n  '));
  console.log('overflow:', overflow ? 'Attachment ' + overflow.attachmentNumber + ' (' + overflow.defendants.length + ' defendant(s))' : 'none (single defendant, single notice) ✓');
  console.log('-> /tmp/ud100-sample.pdf');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
