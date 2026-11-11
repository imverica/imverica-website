'use strict';
// Form I-90 (edition 01/20/25), Application to Replace Permanent Resident
// Card. Field names and what each one is were read from the form's own
// tooltips (scripts/qa-uscis-answer-routing.js re-checks them).
//
// Left for review because the wizard's answer does not pick one box on the
// form: "Replace lost, stolen, or damaged card" (2.a or 2.c), "Correct card
// error" (2.d or 2.e), the kind of accommodation in Part 4 (1.a, 1.b, 1.c),
// and the preparer's own statement in Part 7.

function clean(v, max = 300) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function digits(v, max = 30) { return clean(v, Math.max(80, max * 4)).replace(/\D/g, '').slice(0, max); }
function dateMdY(v) { const t = clean(v, 40); const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[2]}/${m[3]}/${m[1]}` : t; }
function stateCode(v) { const t = clean(v, 80); const m = t.match(/^([A-Z]{2})\b/); return m ? m[1] : t; }
function usPhone(v) { const r = digits(v, 20); return r.length === 11 && r.startsWith('1') ? r.slice(1) : r.slice(0, 10); }
function isYes(v) { return ['yes', 'true', 'да', 'так', 'sí', 'si'].includes(clean(v, 40).toLowerCase()); }
function isNo(v) { return ['no', 'false', 'нет', 'ні'].includes(clean(v, 40).toLowerCase()); }

// "Apt 5" -> the Apt. box and "5"; a bare "5" is taken as an apartment.
function unit(value, aptField, steField, flrField, numberField) {
  const text = clean(value, 40);
  if (!text) return {};
  const lower = text.toLowerCase();
  const box = /^(ste|suite)\b/.test(lower) ? steField : (/^(fl|flr|floor)\b/.test(lower) ? flrField : aptField);
  return {
    [box]: true,
    [numberField]: text.replace(/^(?:apt|apartment|ste|suite|flr|fl|floor|unit|#)\s*\.?\s*#?\s*/i, '').slice(0, 6)
  };
}

function usAddress(a, prefix, f) {
  const out = {
    [f.street]: clean(a[`${prefix}_address_line1`], 25),
    [f.city]: clean(a[`${prefix}_city`], 20),
    [f.state]: stateCode(a[`${prefix}_state`]),
    [f.zip]: digits(a[`${prefix}_zip`], 5),
    [f.country]: clean(a[`${prefix}_country`], 40)
  };
  return Object.assign(out, unit(a[`${prefix}_address_line2`], f.apt, f.ste, f.flr, f.unitNumber));
}

const STATUS_BOX = {
  'lawful permanent resident': 'P2_checkbox1[0]',
  'permanent resident in commuter status': 'P2_checkbox1[1]',
  'conditional permanent resident': 'P2_checkbox1[2]'
};
// Wizard reason -> Section A box (permanent resident, commuter) and
// Section B box (conditional resident). Only reasons that name one box.
const REASON_BOX = {
  'renew expiring or expired card': { a: 'P2_checkbox2[1]' },                              // 2.f
  'name or biographic change': { a: 'P2_checkbox2[0]', b: 'P2_checkbox3[3]' },             // 2.e / 3.e
  'never received card': { a: 'P2_checkbox2[6]', b: 'P2_checkbox3[0]' },                   // 2.b / 3.b
  'card issued but contains dhs error': { a: 'P2_checkbox2[4]', b: 'P2_checkbox3[2]' }     // 2.d / 3.d
};
const EYE_BOX = { blue: 0, green: 1, hazel: 2, pink: 3, maroon: 4, brown: 5, black: 6, unknown: 7, gray: 8 };
const HAIR_BOX = { bald: 0, blond: 1, gray: 2, sandy: 3, unknown: 4, white: 5, red: 6, brown: 7, black: 8 };
const RACE_BOX = {
  white: 'P3_checkbox7_White[0]',
  asian: 'P3_checkbox7_Asian[0]',
  'black or african american': 'P3_checkbox7_Black[0]',
  'american indian or alaska native': 'P3_checkbox7_Indian[0]',
  'native hawaiian or other pacific islander': 'P3_checkbox7_Hawaiian[0]'
};

function i_90FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};
  const lower = (key) => clean(a[key], 80).toLowerCase();

  // Part 1. Information About You
  const aNumber = digits(a.alien_number || a.a_number, 9);
  const family = clean(a.applicant_family_name, 60);
  const given = clean(a.applicant_given_name, 60);
  const middle = clean(a.applicant_middle_name, 60);
  v['P1_Line1_AlienNumber[0]'] = aNumber;
  v['P1_Line2_AcctIdentifier[0]'] = digits(a.uscis_online_account_number, 12);
  v['P1_Line3a_FamilyName[0]'] = family;
  v['P1_Line3b_GivenName[0]'] = given;
  v['P1_Line3c_MiddleName[0]'] = middle;
  // The Part 8 page repeats the name and A-Number from page 1.
  v['P1_Line1_AlienNumber[1]'] = aNumber;
  v['P1_Line3a_FamilyName[1]'] = family;
  v['P1_Line3b_GivenName[1]'] = given;
  v['P1_Line3c_MiddleName[1]'] = middle;

  Object.assign(v, usAddress(a, 'mailing', {
    street: 'P1_Line6b_StreetNumberName[0]', city: 'P1_Line6d_CityOrTown[0]', state: 'P1_Line6e_State[0]',
    zip: 'P1_Line6f_ZipCode[0]', country: 'P1_Line6i_Country[0]',
    apt: 'P1_checkbox6c_Unit[0]', ste: 'P1_checkbox6c_Unit[1]', flr: 'P1_checkbox6c_Unit[2]', unitNumber: 'P1_Line6c_AptSteFlrNumber[0]'
  }));
  // Item 7: only when the physical address differs from the mailing address.
  if (isNo(a.physical_same_as_mailing)) {
    Object.assign(v, usAddress(a, 'physical', {
      street: 'P1_Line7a_StreetNumberName[0]', city: 'P1_Line7c_CityOrTown[0]', state: 'P1_Line7d_State[0]',
      zip: 'P1_Line7e_ZipCode[0]', country: 'P1_Line7h_Country[0]',
      apt: 'P1_checkbox7b_Unit[0]', ste: 'P1_checkbox7b_Unit[1]', flr: 'P1_checkbox7b_Unit[2]', unitNumber: 'P1_Line7b_AptSteFlrNumber[0]'
    }));
  }

  if (lower('sex') === 'male') v['P1_Line8_male[0]'] = true;
  if (lower('sex') === 'female') v['P1_Line8_female[0]'] = true;
  v['P1_Line9_DateOfBirth[0]'] = dateMdY(a.date_of_birth || a.dob || '');
  v['P1_Line10_CityTownOfBirth[0]'] = clean(a.city_of_birth || a.place_of_birth_city, 38);
  v['P1_Line11_CountryofBirth[0]'] = clean(a.country_of_birth, 60);
  v['P1_Line12_MotherGivenName[0]'] = clean(a.mother_given_name, 60);
  v['P1_Line13_FatherGivenName[0]'] = clean(a.father_given_name, 60);
  v['P1_Line14_ClassOfAdmission[0]'] = clean(a.class_of_admission, 30);
  v['P1_Line15_DateOfAdmission[0]'] = dateMdY(a.date_of_admission);
  v['P1_Line16_SSN[0]'] = digits(a.ssn || a.social_security_number, 9);

  // Part 2. Application Type
  const status = lower('i90_application_type');
  if (STATUS_BOX[status]) v[STATUS_BOX[status]] = true;
  const reason = REASON_BOX[lower('i90_reason')];
  if (reason && STATUS_BOX[status]) {
    const box = status === 'conditional permanent resident' ? reason.b : reason.a;
    if (box) v[box] = true;
  }

  // Part 3. Processing Information
  v['P3_Line1_LocationAppliedVisa[0]'] = clean(a.i90_visa_or_adjustment_location, 38);
  v['P3_Line2_LocationIssuedVisa[0]'] = clean(a.i90_card_issued_location, 38);
  if (lower('ethnicity') === 'hispanic or latino') v['P3_checkbox6[1]'] = true;
  if (lower('ethnicity') === 'not hispanic or latino') v['P3_checkbox6[0]'] = true;
  for (const race of Array.isArray(a.race) ? a.race : [a.race]) {
    const box = RACE_BOX[clean(race, 80).toLowerCase()];
    if (box) v[box] = true;
  }
  v['P3_Line8_HeightFeet[0]'] = digits(a.height_feet, 1);
  v['P3_Line8_HeightInches[0]'] = digits(a.height_inches, 2);
  const weight = digits(a.weight_pounds || a.weight, 3).padStart(3, '0');
  if (Number(weight) > 0) {
    v['P3_Line9_HeightInches1[0]'] = weight[0];
    v['P3_Line9_HeightInches2[0]'] = weight[1];
    v['P3_Line9_HeightInches3[0]'] = weight[2];
  }
  const eye = EYE_BOX[lower('eye_color').replace(/\s*\/.*$/, '')];
  if (eye !== undefined) v[`P3_checkbox10[${eye}]`] = true;
  const hair = HAIR_BOX[lower('hair_color').replace(/\s*[/(].*$/, '')];
  if (hair !== undefined) v[`P3_checkbox11[${hair}]`] = true;

  // Part 4. Accommodations: the Yes / No answer only.
  if (isYes(a.disability_accommodation_needed)) v['P4_checkbox1[1]'] = true;
  if (isNo(a.disability_accommodation_needed)) v['P4_checkbox1[0]'] = true;

  // Part 5. Applicant's statement and contact information
  const viaInterpreter = /interpreter/.test(lower('applicant_statement'));
  if (/read and understand english/.test(lower('applicant_statement'))) v['P5_Checkbox1a[0]'] = true;
  if (viaInterpreter) {
    v['P5_Checkbox1b[0]'] = true;
    v['P5_Line1b_Language[0]'] = clean(a.applicant_statement_language, 40);
  }
  const preparerName = [clean(a.preparer_given_name, 60), clean(a.preparer_family_name, 60)].filter(Boolean).join(' ');
  if (isYes(a.has_preparer) && preparerName) {
    v['P5_Checkbox2[0]'] = true;
    v['P5_Line2_NameofRepresentative[0]'] = preparerName;
  }
  v['P5_Line3_DaytimePhoneNumber[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
  v['P5_Line4_MobilePhoneNumber[0]'] = usPhone(a.mobile_phone);
  v['P5_Line5_EmailAddress[0]'] = clean(a.email_address || a.email || c.email, 38);

  // Part 6. Interpreter
  if (!isNo(a.has_interpreter)) {
    v['P6_Line1a_InterpretersFamilyName[0]'] = clean(a.interpreter_family_name, 60);
    v['P6_Line1b_InterpretersGivenName[0]'] = clean(a.interpreter_given_name, 60);
    v['P6_Line2_NameofBusinessor[0]'] = clean(a.interpreter_business_name, 30);
    if (clean(a.interpreter_family_name) || viaInterpreter) v['P6_Language[0]'] = clean(a.applicant_statement_language, 40);
  }

  // Part 7. Preparer
  if (!isNo(a.has_preparer)) {
    v['P7_Line1a_FamilyName[0]'] = clean(a.preparer_family_name, 60);
    v['P7_Line1b_PreparersGivenName[0]'] = clean(a.preparer_given_name, 60);
    v['P7_Line2_NameofBusinessor[0]'] = clean(a.preparer_business_name, 34);
  }

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined && val !== null && val !== ''));
}

module.exports = { i_90FieldValues };
