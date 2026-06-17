'use strict';
/**
 * SUM-130 — Summons (Unlawful Detainer-Eviction). Filed WITH UD-100 to start
 * the case. The summons has its own layout (not the standard caption): NOTICE
 * TO DEFENDANT (all defendants), YOU ARE BEING SUED BY PLAINTIFF, the court
 * name+address, and the plaintiff's own name/address/phone (In-Pro-Per).
 * Field names VERBATIM from scripts/extract-ca-fields.js sum-130.
 *
 * Overflow: all defendants + "DOES 1 to N" go in the NOTICE TO DEFENDANT box;
 * if the list is long we append "(see Attachment)" + surface `_overflow`.
 */

const { _fmt } = require('./ca-caption');
const { clean } = _fmt;

const P1 = 'SUM-130[0].Page1[0].';
const P2 = 'SUM-130[0].Page2[0].';

function pick(a, ...keys) { for (const k of keys) if (a[k] != null && a[k] !== '') return a[k]; return ''; }

function sum_130FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};

  const plaintiff = clean(pick(a, 'plaintiff_name', 'landlord_name', 'petitioner_name'), 120);
  const defList = Array.isArray(a.defendants) && a.defendants.length
    ? a.defendants.map((d) => clean(typeof d === 'string' ? d : (d && d.name), 120)).filter(Boolean)
    : [clean(pick(a, 'defendant_name', 'tenant_name', 'respondent_name'), 120)].filter(Boolean);

  // NOTICE TO DEFENDANT — every tenant/occupant + DOES (true names unknown).
  let noticeTo = defList.slice(0, 6).join(', ');
  if (a.doe_defendants || defList.length) noticeTo += (noticeTo ? ', and ' : '') + 'DOES 1 to ' + (pick(a, 'doe_count') || '10');
  if (defList.length > 6) noticeTo += ' (see Attachment)';
  if (noticeTo) {
    v[P1 + 'Header[0].caseTitle[0].defendant[0]'] = clean(noticeTo, 400);
    v[P2 + 'Header[0].defendant[0].defendant[0]'] = defList[0] || noticeTo;
  }
  if (plaintiff) {
    v[P1 + 'Header[0].caseTitle[0].plaintiff[0]'] = plaintiff;
    v[P2 + 'Header[0].plaintiff[0].plaintiff[0]'] = plaintiff;
  }

  // Court name + address (item 1).
  const courtName = 'Superior Court of California, County of ' + clean(pick(a, 'court_county'), 60);
  const courtAddr = [clean(pick(a, 'court_street_address'), 80), clean(pick(a, 'court_city_zip'), 80), clean(pick(a, 'court_branch_name'), 80)].filter(Boolean).join(', ');
  if (clean(pick(a, 'court_county'), 60)) v[P1 + 'List1[0].item1[0].FillText6[0]'] = clean(courtName + (courtAddr ? ', ' + courtAddr : ''), 300);

  // Plaintiff without an attorney — name, address, phone (In-Pro-Per) (item 2).
  const contact = [
    plaintiff,
    clean(pick(a, 'plaintiff_address_line1', 'petitioner_address_line1', 'mailing_address_line1'), 80),
    [clean(pick(a, 'plaintiff_city', 'petitioner_city', 'mailing_city'), 60), clean(pick(a, 'plaintiff_state', 'petitioner_state'), 20), clean(pick(a, 'plaintiff_zip', 'petitioner_zip'), 12)].filter(Boolean).join(', '),
    clean(pick(a, 'plaintiff_phone', 'petitioner_phone', 'phone'), 30)
  ].filter(Boolean).join(', ');
  if (contact) v[P1 + 'List2[0].item2[0].FillText7[0]'] = clean(contact, 300);

  const out = Object.fromEntries(Object.entries(v).filter(([, val]) => typeof val === 'string' && val !== ''));
  if (defList.length > 6) out._overflow = { form: 'MC-025', title: 'Attachment — Additional Defendants', defendants: defList };
  return out;
}

module.exports = { sum_130FieldValues };
