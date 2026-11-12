'use strict';
// Form N-600, Application for Certificate of Citizenship. Field meanings come
// from the form's tooltips. Internal names mislead here: "P8_Line4_Telephone"
// is the interpreter's phone, "P5_..." fields belong to a parent.
//
// Not filled: Part 1 (basis), Parts 3 to 7 (how citizenship was acquired,
// the U.S. citizen parents, physical presence, military service). The wizard
// takes those as free text; the form wants them item by item.

const {
  clean, digits, dateMdY, usPhone, lower, isYes, isNo,
  addressFields, addressAnswers, choice, helperFields, compact
} = require('./uscis-map-kit');

function n_600FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};

  // The A-Number box heads every page.
  const aNumber = digits(a.alien_number || a.a_number, 9);
  for (let i = 0; i <= 16; i += 1) v[`Line1_AlienNumber[${i}]`] = aNumber;

  // Part 2. Information about you
  v['Pt1Line1_FamilyName[0]'] = clean(a.applicant_family_name, 60);
  v['Pt1Line1_GivenName[0]'] = clean(a.applicant_given_name, 60);
  v['Pt1Line1_MiddleName[0]'] = clean(a.applicant_middle_name, 60);
  // Part 11 repeats the name from page 1.
  v['Pt1Line1_FamilyName[1]'] = clean(a.applicant_family_name, 60);
  v['Pt1Line1_GivenName[1]'] = clean(a.applicant_given_name, 60);
  v['Pt1Line1_MiddleName[1]'] = clean(a.applicant_middle_name, 60);
  v['P1_Line4_SSN[0]'] = digits(a.ssn || a.social_security_number, 9);
  v['P1_Line5_USCISELISAcctNumber[0]'] = digits(a.uscis_online_account_number, 12);
  v['P2_Line8_DateOfBirth[0]'] = dateMdY(a.date_of_birth || a.dob || '');
  v['P2_Line10_CountryOfBirth[0]'] = clean(a.country_of_birth, 60);
  // Item 8 asks for the prior citizenship.
  if (!/^united states/i.test(clean(a.country_of_citizenship))) v['P2_Line8_Country[0]'] = clean(a.country_of_citizenship, 60);
  if (lower(a.sex) === 'male') v['P2_Line9_Gender[0]'] = true;
  if (lower(a.sex) === 'female') v['P2_Line9_Gender[1]'] = true;
  Object.assign(v, addressFields(addressAnswers(a, 'mailing'), {
    street: 'P2_Line10_StreetName[0]', city: 'Pt2_Line10_City[0]', state: 'Pt2Line10_State[0]', zip: 'Pt2Line10_ZipCode[0]',
    province: 'Pt2Line10_Province[0]', postal: 'Pt2Line10_PostalCode[0]',
    unit: { number: 'P2_Line10_Number[0]' }, max: { city: 20 }
  }));
  // Item 12: physical address, only when it differs from the mailing address.
  if (isNo(a.physical_same_as_mailing)) {
    Object.assign(v, addressFields(addressAnswers(a, 'physical'), {
      street: 'P2_Line11_PhysicalStreetName[0]', city: 'Pt2Line11_City[0]', state: 'Pt2Line11_State[0]', zip: 'Pt2Line11_ZipCode[0]',
      province: 'Pt2Line11_Province[0]', postal: 'Pt2Line11_PostalCode[0]',
      unit: { number: 'P2_Line11_Number[0]' }, max: { city: 20 }
    }));
  }
  Object.assign(v, choice(a.marital_status, {
    're:single|never': 'P2_Line12_MaritalStatus[1]',
    're:^married': 'P2_Line12_MaritalStatus[3]',
    're:divorc': 'P2_Line12_MaritalStatus[0]',
    're:widow': 'P2_Line12_MaritalStatus[2]',
    're:separat': 'P2_Line12_MaritalStatus[4]',
    're:annul': 'P2_Line12_MaritalStatus[6]'
  }));

  // Part 8. Statement and contact information
  const statement = lower(a.applicant_statement);
  if (/read and understand english/.test(statement)) v['P8_Line1[0]'] = true;
  if (/interpreter/.test(statement)) {
    v['P8_Line1[1]'] = true;
    v['P8_Line1B_Language[0]'] = clean(a.applicant_statement_language, 40);
  }
  const preparerName = [clean(a.preparer_given_name, 60), clean(a.preparer_family_name, 60)].filter(Boolean).join(' ');
  if (isYes(a.has_preparer) && preparerName) {
    v['P8_Line2[0]'] = true;
    v['P8_Line2_Preparer[0]'] = preparerName;
  }
  v['P8_Line3[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
  v['P8_Line4[0]'] = usPhone(a.mobile_phone);
  v['P8_Line5[0]'] = clean(a.email_address || a.email || c.email, 60);

  // Part 9 (interpreter) and Part 10 (preparer)
  Object.assign(v, helperFields(a, {
    interpreter: { family: 'P9_Line1_FamilyName[0]', given: 'P9_Line1_GivenName[0]', business: 'P9_Line2[0]', language: 'P9_Language[0]' },
    preparer: { family: 'P10_Line1_PreparerFamilyName[0]', given: 'P10_Line1_PreparerGivenName[0]', business: 'P10_Line2_NameofBusinessorOrgName[0]' }
  }));

  return compact(v);
}

module.exports = { n_600FieldValues };
