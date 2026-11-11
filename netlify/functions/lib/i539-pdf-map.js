'use strict';
// Form I-539 (edition 08/28/24), Application to Extend/Change Nonimmigrant
// Status. Field meanings come from the form's tooltips; several internal
// names mislead (the passport and I-94 items of Part 1 are named "SupA_...",
// the interpreter's name fields "P7_Line1_Preparer...").
//
// Not filled, because the wizard's answer does not match the form's item:
// the two status drop-down lists (the wizard takes free text), and the Part 4
// questions other than item 6 (the wizard does not ask them one by one).

const {
  clean, digits, dateMdY, usPhone, isYes, isNo,
  addressFields, addressAnswers, choice, helperFields, compact
} = require('./uscis-map-kit');

function i_539FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};

  // Part 1. Information About You
  v['P1Line1a_FamilyName[0]'] = clean(a.applicant_family_name, 60);
  v['P1_Line1b_GivenName[0]'] = clean(a.applicant_given_name, 60);
  v['P1_Line1c_MiddleName[0]'] = clean(a.applicant_middle_name, 60);
  v['Pt1Line2_AlienNumber[0]'] = digits(a.alien_number || a.a_number, 9);
  v['Pt1Line2_USCISOnlineAcctNumber[0]'] = digits(a.uscis_online_account_number, 12);
  Object.assign(v, addressFields(addressAnswers(a, 'mailing'), {
    street: 'Part2_Item11_StreetName[0]', city: 'Part2_Item11_City[0]', state: 'Part2_Item11_State[0]', zip: 'Part2_Item11_ZipCode[0]',
    unit: { apt: 'Part1_Item4_Unit[0]', ste: 'Part1_Item4_Unit[1]', flr: 'Part1_Item4_Unit[2]', number: 'Part1_Item4_Number[0]' }
  }));
  if (isYes(a.physical_same_as_mailing)) v['P1_checkbox5[1]'] = true;
  if (isNo(a.physical_same_as_mailing)) {
    v['P1_checkbox5[0]'] = true;
    Object.assign(v, addressFields(addressAnswers(a, 'physical'), {
      street: 'Part1_Item6_StreetName[0]', city: 'Part1_Item6_City[0]', state: 'Part1_Item6_State[0]', zip: 'Part1_Item6_ZipCode[0]',
      unit: { apt: 'Part1_Item6_Unit[0]', ste: 'Part1_Item6_Unit[1]', flr: 'Part1_Item6_Unit[2]', number: 'Part1_Item6_Number[0]' }
    }));
  }
  v['P1_Line6_CountryOfBirth[0]'] = clean(a.country_of_birth, 60);
  v['P1_Line7_CountryOfCitizenship[0]'] = clean(a.country_of_citizenship, 60);
  v['P1_Line8_DateOfBirth[0]'] = dateMdY(a.date_of_birth || a.dob || '');
  v['P1_Line9_SSN[0]'] = digits(a.ssn || a.social_security_number, 9);
  // Your most recent entry into the United States
  v['SupA_Line1i_DateOfArrival[0]'] = dateMdY(a.last_arrival_date);
  v['SupA_Line1j_ArrivalDeparture[0]'] = clean(a.i94_number, 11);
  v['SupA_Line1k_Passport[0]'] = clean(a.passport_number, 30);
  v['SupA_Line1m_CountryOfIssuance[0]'] = clean(a.passport_country_of_issuance, 60);
  v['SupA_Line1n_ExpDate[0]'] = dateMdY(a.passport_expiration);
  v['SupA_Line1p_DateExpires[0]'] = dateMdY(a.current_i94_expiration);

  // Part 2. Application Type
  Object.assign(v, choice(a.i539_request_type, {
    'reinstatement': 'P2_checkbox[2]',
    'extend stay in current status': 'P2_checkbox[0]',
    'change to another status': 'P2_checkbox[1]'
  }));
  if (isNo(a.dependents_included)) v['P2_checkbox4[0]'] = true;
  if (isYes(a.dependents_included)) v['P2_checkbox4[1]'] = true;

  // Part 4, item 6 (arrested or convicted since last entering the United
  // States): "No" follows from never having been arrested. "Yes" does not
  // say when, so it is left for review.
  if (isNo(a.i539_arrested_or_convicted)) v['P4_checkbox6_No[0]'] = true;

  // Part 5. Applicant's contact information
  v['P5_Line3_DaytimePhoneNumber[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
  v['P5_Line4_MobilePhoneNumber[0]'] = usPhone(a.mobile_phone);
  v['P5_Line5_EmailAddress[0]'] = clean(a.email_address || a.email || c.email, 38);

  // Part 6 (interpreter) and Part 7 (preparer)
  Object.assign(v, helperFields(a, {
    interpreter: { family: 'P7_Line1_PreparerFamilyName[0]', given: 'P7_Line1_PreparerGivenName[0]', business: 'P7_Line2_PreparerNameofBusinessorOrgName[0]', language: 'P7_Line6_Language[0]' },
    preparer: { family: 'P7_Line1a_PreparerFamilyName[0]', given: 'P7_Line1b_PreparerGivenName[0]', business: 'P7_Line2_BusinessName[0]' }
  }));

  return compact(v);
}

module.exports = { i_539FieldValues };
