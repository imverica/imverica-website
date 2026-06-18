'use strict';
/**
 * CP10.5 — Prejudgment Claim of Right to Possession. Served (blank) WITH the
 * summons & complaint so an UNNAMED adult occupant can claim a right to
 * possession; it closes a common post-judgment loophole. KEY: this is the
 * occupant/CLAIMANT's form, NOT the landlord's. The landlord only pre-fills the
 * case caption + the premises address so the served copy is tied to the right
 * case — the claimant fills their own name/residence/agreement and signs.
 * County-agnostic. Field names VERBATIM from extract cp10-5 (note the literal
 * periods in names — pdf-lib needs them backslash-escaped).
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;
const H = 'topmostSubform[0].Page1[0].StdP1Header_sf[0].';
const P1 = 'topmostSubform[0].Page1[0].';
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }

function cp_105FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);

  // Case caption only (the claimant completes everything else).
  v[H + 'CourtInfo[0].CrtCounty_ft[0]'] = clean(pick(a, 'court_county'), 60);
  v[H + 'CourtInfo[0].Street_ft[0]'] = clean(pick(a, 'court_street_address'), 80);
  v[H + 'CourtInfo[0].CityZip_ft[0]'] = clean(pick(a, 'court_city_zip'), 80);
  v[H + 'CourtInfo[0].Branch_ft[0]'] = clean(pick(a, 'court_branch_name'), 80);
  v[H + 'TitlePartyName[0].Party1_ft[0]'] = plaintiff;
  v[H + 'TitlePartyName[0].Party2_ft[0]'] = defList[0] || '';
  // Premises subject to the claim (literal-period field name → escaped).
  v[P1 + 'TEXT\\.1\\.22[0]'] = clean(pick(a, 'premises_address', 'rental_property_address'), 200);

  return Object.fromEntries(Object.entries(v).filter(([, val]) => typeof val === 'string' && val !== ''));
}
module.exports = { cp_105FieldValues };
