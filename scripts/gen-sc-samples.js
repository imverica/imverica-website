'use strict';
// Render the small-claims packet (SC-100 + MC-031 overflow) from ONE synthetic
// scenario (no PII) so the owner can open and inspect the output.
// Output → ~/Documents/SmallClaims/generated/
const fs = require('fs'), os = require('os'), path = require('path');
const { sc_100FieldValues } = require('../netlify/functions/lib/ca-sc100-map');
const { mc_031FieldValues } = require('../netlify/functions/lib/ca-mc031-map');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');

const TPL = path.resolve(__dirname, '..', 'assets', 'form-cache', 'ca-court');
const OUT = path.join(os.homedir(), 'Documents', 'SmallClaims', 'generated');
fs.mkdirSync(OUT, { recursive: true });

const scenario = {
  court_county: 'Sacramento', court_street_address: '301 Bicentennial Circle, Room 200', court_city_zip: 'Sacramento, CA 95826', court_branch_name: 'Carol Miller Justice Center',
  plaintiff_name: 'Ivan Petrov', plaintiff_phone: '9165550133', plaintiff_address_line1: '48 Maple Court', plaintiff_city: 'Sacramento', plaintiff_state: 'CA', plaintiff_zip: '95826', plaintiff_email: 'ivan.petrov@example.com',
  plaintiff2_name: 'Maria Petrova', plaintiff2_phone: '9165550134', plaintiff2_city: 'Sacramento', plaintiff2_zip: '95826', plaintiff2_email: 'maria.petrova@example.com',
  defendant_name: 'Sunrise Rentals LLC', defendant_phone: '9165557000', defendant_address_line1: '900 Market St', defendant_city: 'Fair Oaks', defendant_state: 'CA', defendant_zip: '95628',
  defendant_agent_name: 'John Doe', defendant_agent_title: 'Managing Member',
  claim_amount: '9800',
  claim_reason: 'Defendant leased a residential property to plaintiffs and failed to maintain it in a habitable condition. The water heater was shut off by the utility due to a hazardous condition and was not repaired for months. An inspection later confirmed electrical and plumbing code violations, including unsafe wiring, defective lighting, leaking fixtures, and a cracked toilet. The City issued a Notice and Order confirming the violations. Defendant failed to make timely repairs and the property was partially uninhabitable for the period stated.',
  claim_calculation: 'Rent refund: $7,000.00 (50% of rent paid Nov 2025 through Mar 2026 for habitability violations). Security deposit not returned: $2,800.00. Total: $9,800.00.',
  claim_date_started: '11/01/2025', claim_date_through: '04/28/2026', venue_zip: '95670', asked_to_pay: 'yes'
};

(async () => {
  const v = sc_100FieldValues({ formAnswers: scenario });
  const ov = v._overflow; delete v._overflow;
  const r1 = await fillCourtForm(fs.readFileSync(path.join(TPL, 'sc-100.pdf')), v);
  fs.writeFileSync(path.join(OUT, 'SC-100_sample.pdf'), r1.buffer);
  console.log('SC-100_sample —', r1.filled.length, 'fields,', r1.skipped.length, 'failed', ov ? '(item 3 → MC-031)' : '');
  if (ov) {
    const mc = mc_031FieldValues({ formAnswers: scenario, _overflow: ov });
    const r2 = await fillCourtForm(fs.readFileSync(path.join(TPL, 'mc-031.pdf')), mc);
    fs.writeFileSync(path.join(OUT, 'MC-031_sample.pdf'), r2.buffer);
    console.log('MC-031_sample —', r2.filled.length, 'fields,', r2.skipped.length, 'failed');
  }
  console.log('\nAll PDFs →', OUT);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
