'use strict';
// Form I-821 (edition 01/20/25), Application for Temporary Protected Status.
// Field meanings come from the form's tooltips and positions. The form
// reuses short names: item 10 (date of birth) and item 18 (date of marriage)
// are both "Part2_Item10_DateOfBirth[0]", item 7 (A-Number) shares its name
// with the header of Part 11. Those two are addressed by full name.
//
// Not filled: Part 7 (eligibility questions). The wizard asks two summary
// questions; the form asks each one separately, so the boxes are left for
// the client's own answers.

const {
  clean, digits, dateMdY, usPhone, lower, isYes, isNo,
  addressFields, addressAnswers, choice, helperFields, compact
} = require('./uscis-map-kit');

const PAGE2 = 'form1[0].Page02[0].';

function i_821FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};

  // Part 1. Type of Application. A late initial filing is still an initial
  // (first time) application, item 1.a.
  Object.assign(v, choice(a.initial_or_reregistration, {
    'initial tps': 'Part1_Item1_ApplicationType[0]',
    'late initial filing': 'Part1_Item1_ApplicationType[0]',
    're-registration': 'Part1_Item1_ApplicationType[1]'
  }));
  v['Part1_TPScountry[0]'] = clean(a.tps_country, 60);

  // Part 2. Information About You
  v['Part2_Item1_FamilyName[0]'] = clean(a.applicant_family_name, 60);
  v['Part2_Item1_GivenName[0]'] = clean(a.applicant_given_name, 60);
  v['Part2_Item1_MiddleName[0]'] = clean(a.applicant_middle_name, 60);
  Object.assign(v, addressFields(addressAnswers(a, 'mailing'), {
    street: 'Part2_Item4_StreetNumberName[0]', city: 'Part2_Item4_CityOrTown[0]', state: 'Part2_Item4_State[0]', zip: 'Part2_Item4_ZipCode[0]',
    unit: { apt: 'Part2_Item4_Unit[0]', ste: 'Part2_Item4_Unit[1]', flr: 'Part2_Item4_Unit[2]', number: 'Part2_Item4_AptSteFlrNumber[0]' },
    max: { city: 20 }
  }));
  if (isYes(a.physical_same_as_mailing)) v['Part2_Item5_YN[0]'] = true;
  if (isNo(a.physical_same_as_mailing)) {
    v['Part2_Item5_YN[1]'] = true;
    Object.assign(v, addressFields(addressAnswers(a, 'physical'), {
      street: 'Part2_Item6_StreetNumberName[0]', city: 'Part2_Item6_CityOrTown[0]', state: 'Part2_Item6_State[0]', zip: 'Part2_Item6_ZipCode[0]',
      unit: { apt: 'Part2_Item6_Unit[0]', ste: 'Part2_Item6_Unit[1]', flr: 'Part2_Item6_Unit[2]', number: 'Part2_Item6_AptSteFlrNumber[0]' },
      max: { city: 20 }
    }));
  }
  const aNumber = digits(a.alien_number || a.a_number, 9);
  v[`${PAGE2}Part2_Item7_AlienNumber[0]`] = aNumber;   // item 7
  v['Part2_Item7_AlienNumber[0]'] = aNumber;            // Part 11 repeats it
  v['Part2_Item8_AcctIdentifier[0]'] = digits(a.uscis_online_account_number, 12);
  v['Part2_Item9_SocialSecurityNumber[0]'] = digits(a.ssn || a.social_security_number, 9);
  v[`${PAGE2}Part2_Item10_DateOfBirth[0]`] = dateMdY(a.date_of_birth || a.dob || '');   // item 10
  if (lower(a.sex) === 'male') v['Part2_Item12_Sex[0]'] = true;
  if (lower(a.sex) === 'female') v['Part2_Item12_Sex[1]'] = true;
  v['Part2_Item13_CityOrTown[0]'] = clean(a.city_of_birth, 20);
  v['Part2_Item14_CountryofBirth[0]'] = clean(a.country_of_birth, 60);
  v['Part2_Item16a[0]'] = clean(a.country_of_citizenship, 60);
  Object.assign(v, choice(a.marital_status, {
    're:single|never': 'Part2_Item17_MaritalStatus[0]',
    're:^married': 'Part2_Item17_MaritalStatus[1]',
    're:divorc': 'Part2_Item17_MaritalStatus[2]',
    're:widow': 'Part2_Item17_MaritalStatus[3]',
    're:separat': 'Part2_Item17_MaritalStatus[4]',
    're:annul': 'Part2_Item17_MaritalStatus[5]'
  }));
  // U.S. entry information and current status
  v['P2_Line7_DateOfBirth[0]'] = dateMdY(a.last_arrival_date);              // item 19, date of last entry
  v['Part2_Item22_I94[0]'] = clean(a.i94_number, 11);                       // item 23
  v['Part2_Item22_Passport[0]'] = clean(a.passport_number, 30);             // item 25
  v['Part2_Item24_CountryofIssuance[0]'] = clean(a.passport_country_of_issuance, 60);
  v['Part2_Item24_PassportExpiration[0]'] = dateMdY(a.passport_expiration);
  v['Part2_Item25_ImmigrationStatus[0]'] = clean(a.current_immigration_status, 60);   // item 31

  // Part 8. Applicant's statement and contact information
  const preparerName = [clean(a.preparer_given_name, 60), clean(a.preparer_family_name, 60)].filter(Boolean).join(' ');
  if (isYes(a.has_preparer) && preparerName) {
    v['Part8_Item2_Preparer[0]'] = true;
    v['Part8_Item2_PrepName[0]'] = preparerName;
  }
  v['Part8_Item3_DayPhone[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
  v['Part8_Item4_MobilePhone[0]'] = usPhone(a.mobile_phone);
  v['Part8_Item5_Email[0]'] = clean(a.email_address || a.email || c.email, 60);

  // Part 9 (interpreter) and Part 10 (preparer)
  Object.assign(v, helperFields(a, {
    interpreter: { family: 'Part9_Item1_FamilyName[0]', given: 'Part9_Item1_GivenName[1]', business: 'Part9_Item2_OrgName[0]' },
    preparer: { family: 'Part10_Item1_FamilyName[0]', given: 'Part10_Item1_GivenName[0]', business: 'Part10_Item2_OrgName[0]' }
  }));

  return compact(v);
}

module.exports = { i_821FieldValues };
