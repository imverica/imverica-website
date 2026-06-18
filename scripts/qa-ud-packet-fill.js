'use strict';
/**
 * UD packet — precise In-Pro-Per HAND-MAP path regression. Distinct from
 * qa-ud-packet.js (which checks direct-schema generatability + staging): this
 * proves every UD form code resolves through ca-court-registry to its hand-map
 * + decrypted template and fills via the production engine (ca-court-fill) with
 * ZERO failed fields. Synthetic data only (no PII). Run:
 *   node scripts/qa-ud-packet-fill.js
 */
const fs = require('fs');
const path = require('path');
const { getBuilder, normalizeSlug } = require('../netlify/functions/lib/ca-court-registry');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');

const TPL = path.resolve(__dirname, '..', 'assets', 'form-cache', 'ca-court');
const scenario = {
  plaintiff_name: 'Maria Gonzalez', landlord_name: 'Maria Gonzalez', plaintiff_type: 'individual',
  plaintiff_address_line1: '742 Evergreen Terrace', plaintiff_city: 'Fresno', plaintiff_state: 'CA', plaintiff_zip: '93721',
  plaintiff_phone: '559-555-0142', plaintiff_email: 'landlord@example.com',
  court_county: 'FRESNO', court_street_address: '1130 O Street', court_city_zip: 'Fresno 93721', court_branch_name: 'B.F. Sisk Courthouse',
  defendant_name: 'John Tenant', tenant_name: 'John Tenant', tenant_address_line1: '500 Rent Street', tenant_city: 'Fresno', tenant_zip: '93721', tenant_phone: '559-555-0199',
  doe_defendants: 'yes', doe_count: '10', premises_address: '500 Rent Street, Fresno, CA 93721', premises_city: 'Fresno', property_type: 'residential',
  amount_demanded: '10400', rent_due_amount: '10400', daily_rental_value: '86.67',
  tenancy_type: 'one year', tenancy_start_date: '06/01/2025', rent_amount: '2000', agreement_type: 'written', agreement_made_with: 'plaintiff',
  subject_to_tpa: 'yes', just_cause: 'at-fault', notice_type: '3-day notice to pay rent or quit',
  notice_served_date: '02/01/2026', notice_expired_date: '02/04/2026', notice_election_forfeiture: 'yes', notice_attached: 'yes',
  service_method: 'personal', defenses: ['rent-control']
};
// Every form code the UD packet routes through the hand-map registry.
const CODES = ['UD-100', 'SUM-130', 'UD-101', 'CM-010', 'CP10.5', 'POS-010', 'UD-105', 'CIV-100', 'UD-116', 'UD-110', 'UD-120', 'POS-030', 'EJ-130'];

(async () => {
  let fails = 0;
  for (const code of CODES) {
    const entry = getBuilder(code);
    if (!entry || typeof entry.build !== 'function') { console.log('  FAIL ' + code + ' — no registry builder'); fails++; continue; }
    const tpl = path.join(TPL, entry.slug + '.pdf');
    if (!fs.existsSync(tpl)) { console.log('  FAIL ' + code + ' — template ' + entry.slug + '.pdf missing'); fails++; continue; }
    const fv = entry.build({ formAnswers: scenario });
    delete fv._overflow;
    const res = await fillCourtForm(fs.readFileSync(tpl), fv);
    const ok = res.filled.length > 0 && res.skipped.length === 0;
    if (!ok) fails++;
    console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + code.padEnd(8) + ' filled=' + String(res.filled.length).padStart(3) + ' failed=' + res.skipped.length
      + (res.skipped.length ? ' ' + JSON.stringify(res.skipped.slice(0, 2)) : ''));
  }
  console.log('\n' + (fails ? ('*** ' + fails + ' FAILED ***') : 'ALL 13 UD FORMS FILL VIA REGISTRY + ENGINE, 0 FAILED'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
