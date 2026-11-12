'use strict';
// Form I-129F, Petition for Alien Fiancé(e). The person answering the wizard
// is the petitioner (Part 1, "Information About You"). Field meanings come
// from the form's tooltips.
//
// Not filled: everything about the beneficiary (Part 2) and the petitioner's
// parents, earlier marriages, addresses and jobs for the last five years.
// The wizard does not ask for them yet; it asks one line each for the
// beneficiary's name and the classification, which fit no single item.

const {
  clean, digits, dateMdY, usPhone, lower, isYes, isNo,
  addressFields, addressAnswers, choice, helperFields, compact
} = require('./uscis-map-kit');

function i_129fFieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};

  // Part 1. Information about you (the petitioner)
  v['Pt1Line1_AlienNumber[0]'] = digits(a.alien_number || a.a_number, 9);
  v['Pt1Line2_AcctIdentifier[0]'] = digits(a.uscis_online_account_number, 12);
  v['Pt1Line3_SSN[0]'] = digits(a.ssn || a.social_security_number, 9);
  v['Pt1Line6a_FamilyName[0]'] = clean(a.applicant_family_name, 30);
  v['Pt1Line6b_GivenName[0]'] = clean(a.applicant_given_name, 18);
  v['Pt1Line6c_MiddleName[0]'] = clean(a.applicant_middle_name, 18);
  Object.assign(v, addressFields(addressAnswers(a, 'mailing'), {
    street: 'Pt1Line8_StreetNumberName[0]', city: 'Pt1Line8_CityOrTown[0]', state: 'Pt1Line8_State[0]', zip: 'Pt1Line8_ZipCode[0]',
    province: 'Pt1Line8_Province[0]', postal: 'Pt1Line8_PostalCode[0]', country: 'Pt1Line8_Country[0]',
    unit: { number: 'Pt1Line8_AptSteFlrNumber[0]' }, max: { street: 25, city: 20 }
  }));
  if (isYes(a.physical_same_as_mailing)) v['Pt1Line8j_Checkboxes[0]'] = true;
  if (isNo(a.physical_same_as_mailing)) {
    v['Pt1Line8j_Checkboxes[1]'] = true;
    Object.assign(v, addressFields(addressAnswers(a, 'physical'), {
      street: 'Pt1Line9_StreetNumberName[0]', city: 'Pt1Line9_CityOrTown[0]', state: 'Pt1Line9_State[0]', zip: 'Pt1Line9_ZipCode[0]',
      province: 'Pt1Line9_Province[0]', postal: 'Pt1Line9_PostalCode[0]', country: 'Pt1Line9_Country[0]',
      unit: { number: 'Pt1Line9_AptSteFlrNumber[0]' }, max: { street: 25, city: 20 }
    }));
  }
  if (lower(a.sex) === 'male') v['Pt1Line21_Checkbox[0]'] = true;
  if (lower(a.sex) === 'female') v['Pt1Line21_Checkbox[1]'] = true;
  v['Pt1Line22_DateofBirth[0]'] = dateMdY(a.date_of_birth || a.dob || '');
  Object.assign(v, choice(a.marital_status, {
    're:widow': 'Pt1Line23_Checkbox[0]',
    're:divorc': 'Pt1Line23_Checkbox[1]',
    're:single|never': 'Pt1Line23_Checkbox[2]',
    're:^married': 'Pt1Line23_Checkbox[3]'
  }));
  v['Pt1Line24_CityTownOfBirth[0]'] = clean(a.city_of_birth, 20);
  v['Pt1Line25_ProvinceOrStateOfBirth[0]'] = clean(a.state_or_province_of_birth, 20);
  v['Pt1Line26_CountryOfCitzOrNationality[0]'] = clean(a.country_of_birth, 60);   // item 26, country of birth

  // Part 5. Petitioner's contact information
  v['Pt5Line1_DaytimePhoneNumber1[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
  v['Pt5Line2_MobileNumber1[0]'] = usPhone(a.mobile_phone);
  v['Pt5Line3_Email[0]'] = clean(a.email_address || a.email || c.email, 60);

  // Part 6 (interpreter) and Part 7 (preparer)
  Object.assign(v, helperFields(a, {
    interpreter: { family: 'Pt6Line1_InterpreterFamilyName[0]', given: 'Pt6Line1_InterpreterGivenName[0]', business: 'Pt6Line2_NameofBusinessorOrgName[0]', language: 'Pt6_NameOfLanguage[0]' },
    preparer: { family: 'Pt7Line1_PreparerFamilyName[0]', given: 'Pt7Line1b_PreparerGivenName[0]', business: 'Pt7Line2_NameofBusinessorOrgName[0]' }
  }));

  return compact(v);
}

module.exports = { i_129fFieldValues };
