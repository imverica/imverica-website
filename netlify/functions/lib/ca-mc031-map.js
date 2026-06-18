'use strict';
/**
 * MC-031 — Attached Declaration. The generic continuation/declaration page
 * attached to another Judicial Council form when a field overflows — for small
 * claims, it carries SC-100 item 3 (the full "why the defendant owes" + how the
 * amount was calculated) when it doesn't fit on the face of the claim.
 *
 * Field names are unlabeled and top-level (no form prefix) — verified by
 * index-probe (fill markers → render → read positions):
 *   FillText10 = Plaintiff/Petitioner caption   FillText9 = Defendant/Respondent
 *   FillText11 = Case Number                      FillText8 = body (title + text)
 *   FillText7  = TYPE OR PRINT NAME               FillText14 = Date
 *   FillText13 = "Other (Specify)" text
 *   CheckBox6 = Plaintiff   Ck6 = Other   (CheckBox61 Attorney-for, CheckBx6
 *   Petitioner, ChckBox6 Defendant, Chck6 Respondent)
 * NoticeHeader1/NoticeFooter1 are the red privacy banner — left blank.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;
function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }

function plaintiffNames(a) {
  if (Array.isArray(a.plaintiffs) && a.plaintiffs.length) {
    return a.plaintiffs.map((p) => clean(typeof p === 'string' ? p : (p && p.name), 120)).filter(Boolean);
  }
  return [pick(a, 'plaintiff_name', 'petitioner_name'), pick(a, 'plaintiff2_name')]
    .map((n) => clean(n, 120)).filter(Boolean);
}

function mc_031FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const ov = payload._overflow || a._overflow || null;
  const v = {};

  const plaintiffs = plaintiffNames(a);
  const defName = clean(pick(a, 'defendant_name', 'respondent_name'), 120);

  // Caption.
  v.FillText10 = plaintiffs.join('; ');
  v.FillText9 = defName;
  v.FillText11 = clean(pick(a, 'case_number'), 30);

  // Title + body. Prefer an explicit declaration body / the overflow payload;
  // otherwise assemble SC-100 item 3 from the claim facts.
  const title = clean((ov && ov.title) || pick(a, 'attachment_title'), 80) || 'SC-100, Item 3';
  let body = clean((ov && ov.body) || pick(a, 'declaration_body'), 4000);
  if (!body) {
    const reason = clean(pick(a, 'claim_reason'), 3000);
    const calc = clean(pick(a, 'claim_calculation', 'claim_calc'), 1000);
    body = [reason, calc ? 'How the amount was calculated:\n' + calc : ''].filter(Boolean).join('\n\n');
  }
  v.FillText8 = (title ? title + '\n\n' : '') + body;

  // Declarant: one plaintiff → "Plaintiff"; joint plaintiffs → "Other: Plaintiffs".
  v.FillText7 = plaintiffs.join('; ');
  if (plaintiffs.length > 1) { v.Ck6 = true; v.FillText13 = 'Plaintiffs'; }
  else v.CheckBox6 = true;

  return Object.fromEntries(
    Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== ''))
  );
}

module.exports = { mc_031FieldValues };
