'use strict';
/**
 * Shared pieces for hand-written USCIS field maps: value clean-up and the
 * blocks every form repeats (a U.S. address with its Apt/Ste/Flr boxes, a
 * choice between check boxes, the interpreter and preparer names).
 *
 * A map names the PDF field for each answer. Which field is which comes from
 * the form's own tooltips; scripts/qa-uscis-answer-routing.js re-checks it.
 */

function clean(v, max = 300) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function digits(v, max = 30) { return clean(v, Math.max(80, max * 4)).replace(/\D/g, '').slice(0, max); }
function dateMdY(v) {
  const t = clean(v, 40);
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : t;
}
function stateCode(v) {
  const t = clean(v, 80);
  const m = t.match(/^([A-Z]{2})\b/);
  return m ? m[1] : t;
}
function usPhone(v) {
  const r = digits(v, 20);
  return r.length === 11 && r.startsWith('1') ? r.slice(1) : r.slice(0, 10);
}
function lower(v) { return clean(v, 200).toLowerCase(); }
function isYes(v) { return ['yes', 'true', 'да', 'так', 'sí', 'si'].includes(lower(v)); }
function isNo(v) { return ['no', 'false', 'нет', 'ні'].includes(lower(v)); }

// "Apt 5" -> the Apt. box and "5"; a bare "5" is taken as an apartment.
function unitFields(value, spec) {
  const text = clean(value, 40);
  if (!text || !spec) return {};
  const kind = /^(ste|suite)\b/i.test(text) ? 'ste' : (/^(fl|flr|floor)\b/i.test(text) ? 'flr' : 'apt');
  const out = {};
  if (spec[kind]) out[spec[kind]] = true;
  if (spec.number) out[spec.number] = text.replace(/^(?:apt|apartment|ste|suite|flr|fl|floor|unit|#)\s*\.?\s*#?\s*/i, '').slice(0, spec.max || 6);
  return out;
}

/**
 * One address. `source` holds the answers for line1, line2, city, state, zip,
 * country; `spec` names the PDF fields: { street, city, state, zip, country,
 * province, postal, unit: { apt, ste, flr, number, max }, max: { street, city } }.
 * A U.S. address fills state + ZIP; a foreign one fills province + postal code.
 */
function addressFields(source, spec) {
  const src = source || {};
  if (!clean(src.line1)) return {};
  const max = spec.max || {};
  const country = clean(src.country, 60);
  const foreign = Boolean(country) && !/^(united states|usa|u\.s\.a?\.?|us)$/i.test(country);
  const out = {};
  if (spec.street) out[spec.street] = clean(src.line1, max.street || 34);
  if (spec.city) out[spec.city] = clean(src.city, max.city || 28);
  if (foreign) {
    if (spec.province) out[spec.province] = clean(src.state, 20);
    if (spec.postal) out[spec.postal] = clean(src.zip, 9);
  } else {
    if (spec.state) out[spec.state] = stateCode(src.state);
    if (spec.zip) out[spec.zip] = digits(src.zip, 5);
  }
  if (spec.country) out[spec.country] = country;
  return Object.assign(out, unitFields(src.line2, spec.unit));
}

// The wizard's answers for an address block: prefix_address_line1, prefix_city ...
function addressAnswers(a, prefix) {
  return {
    line1: a[`${prefix}_address_line1`],
    line2: a[`${prefix}_address_line2`],
    city: a[`${prefix}_city`],
    state: a[`${prefix}_state`],
    zip: a[`${prefix}_zip`],
    country: a[`${prefix}_country`]
  };
}

// Tick the one box that matches the answer. `boxes` maps lowercase answers
// (or a RegExp source prefixed with "re:") to field names.
function choice(value, boxes) {
  const answer = lower(value);
  if (!answer) return {};
  for (const [key, field] of Object.entries(boxes)) {
    const hit = key.startsWith('re:') ? new RegExp(key.slice(3), 'i').test(answer) : key === answer;
    if (hit && field) return { [field]: true };
  }
  return {};
}

function yesNoFields(value, yesField, noField) {
  if (isYes(value) && yesField) return { [yesField]: true };
  if (isNo(value) && noField) return { [noField]: true };
  return {};
}

/**
 * Interpreter and preparer names and business names, only when the client did
 * not answer "No" to having one. spec: { interpreter: { family, given,
 * business, language }, preparer: { family, given, business } }.
 */
function helperFields(a, spec) {
  const out = {};
  const i = spec.interpreter;
  if (i && !isNo(a.has_interpreter)) {
    if (i.family) out[i.family] = clean(a.interpreter_family_name, 60);
    if (i.given) out[i.given] = clean(a.interpreter_given_name, 60);
    if (i.business) out[i.business] = clean(a.interpreter_business_name || a.interpreter_org_name, 34);
    if (i.language && clean(a.interpreter_family_name)) out[i.language] = clean(a.interpreter_language || a.applicant_statement_language, 40);
  }
  const p = spec.preparer;
  if (p && !isNo(a.has_preparer)) {
    if (p.family) out[p.family] = clean(a.preparer_family_name, 60);
    if (p.given) out[p.given] = clean(a.preparer_given_name, 60);
    if (p.business) out[p.business] = clean(a.preparer_business_name, 34);
  }
  return out;
}

// Drop empty values so blank answers leave the field untouched.
function compact(values) {
  return Object.fromEntries(Object.entries(values).filter(([, val]) => val !== undefined && val !== null && val !== ''));
}

module.exports = {
  clean, digits, dateMdY, stateCode, usPhone, lower, isYes, isNo,
  unitFields, addressFields, addressAnswers, choice, yesNoFields, helperFields, compact
};
