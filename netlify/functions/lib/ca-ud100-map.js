'use strict';
/**
 * UD-100 — Complaint, Unlawful Detainer (eviction).
 *
 * Filer = landlord/owner (PLAINTIFF, party1); tenant = DEFENDANT (party2).
 * We fill the caption + the plaintiff/defendant "alleges" lines + the
 * premises address. The substantive grounds (notice type, rent owed,
 * service of notice) are detailed legal allegations left for attorney
 * review — they drive the outcome and need judgment, not raw intake.
 *
 * Field names + labels verbatim from extract-ca-fields.js ud-100.
 */

const { buildCaption, _fmt } = require('./ca-caption');
const { clean } = _fmt;

function fl_or(v, ...keys) { for (const k of keys) if (v[k]) return v[k]; return ''; }

function ud_100FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const P1 = 'UD-100[0].Page1[0].';

  // Caption with landlord=plaintiff, tenant=defendant roles.
  const v = buildCaption('ud-100', a, { party1: 'plaintiff', party2: 'defendant' });

  // "PLAINTIFF (name each):" / "alleges causes of action against DEFENDANT (name each):"
  const plaintiff = clean(a.plaintiff_name || a.landlord_name || a.petitioner_name, 120);
  const defendant = clean(a.defendant_name || a.tenant_name || a.respondent_name, 120);
  if (plaintiff) v[P1 + 'List1[0].item1[0].FillText1[0]'] = plaintiff;     // PLAINTIFF (name each):
  if (defendant) v[P1 + 'List1[0].item1[0].FillText2[0]'] = defendant;     // alleges ... against DEFENDANT (name each):

  // Premises address (item 4 "located at"). Intake key: premises_address.
  const premises = clean(a.premises_address || a.rental_property_address, 200);
  if (premises) {
    // The premises field is List3/Lia FillText6 on page 1 (verbatim name).
    v[P1 + 'List3[0].Lia[0].FillText6[0]'] = premises;
  }

  return Object.fromEntries(
    Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== ''))
  );
}

module.exports = { ud_100FieldValues };
