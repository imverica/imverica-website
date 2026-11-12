'use strict';
// Form I-864A, Contract Between Sponsor and Household Member. The person
// answering the wizard is the household member (Part 1). Field meanings come
// from the form's tooltips.
//
// Not filled: Part 2 item 1 to 3 status boxes and Parts 3 to 5 about the
// sponsor (the wizard does not ask for them).

const {
  clean, digits, dateMdY, usPhone, lower, isYes, isNo,
  addressFields, addressAnswers, choice, helperFields, compact
} = require('./uscis-map-kit');

function i_864aFieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};

  // Part 1. Information about you (the household member)
  v['P1_Line1a_FamilyName[0]'] = clean(a.applicant_family_name, 60);
  v['P1_Line1b_GivenName[0]'] = clean(a.applicant_given_name, 60);
  v['P1_Line1c_MiddleName[0]'] = clean(a.applicant_middle_name, 60);
  Object.assign(v, addressFields(addressAnswers(a, 'mailing'), {
    street: 'P1_Line2_StreetNumberName[0]', city: 'P1_Line2_CityOrTown[0]', state: 'P1_Line2_State[0]', zip: 'P1_Line2_ZipCode[0]',
    province: 'P1_Line2_Province[0]', postal: 'P1_Line2_PostalCode[0]', country: 'P1_Line2_Country[0]',
    unit: { number: 'P1_Line2_AptSteFlrNumber[0]' }, max: { city: 20 }
  }));
  if (isYes(a.physical_same_as_mailing)) v['P1_Line3_CB[1]'] = true;
  if (isNo(a.physical_same_as_mailing)) {
    v['P1_Line3_CB[0]'] = true;
    Object.assign(v, addressFields(addressAnswers(a, 'physical'), {
      street: 'P1_Line4_StreetNumberName[0]', city: 'P1_Line4_CityOrTown[0]', state: 'P1_Line4_State[0]', zip: 'P1_Line4_ZipCode[0]',
      province: 'P1_Line4_Province[0]', postal: 'P1_Line4_PostalCode[0]', country: 'P1_Line4_Country[0]',
      unit: { number: 'P1_Line4_AptSteFlrNumber[0]' }, max: { city: 20 }
    }));
  }
  v['P1_Line5_DateOfBirth[0]'] = dateMdY(a.date_of_birth || a.dob || '');
  v['P1_Line6_CountryofBirth[0]'] = clean(a.country_of_birth, 60);
  v['P1_Line7_SSN[0]'] = digits(a.ssn || a.social_security_number, 9);
  v['P1_Line8_AlienNumber[0]'] = digits(a.alien_number || a.a_number, 9);
  v['P1_Line9_USCISOnlineAcctNumber[0]'] = digits(a.uscis_online_account_number, 12);

  // Part 2, item 3: relationship to the sponsor, when the answer names one
  // of the form's four kinds. Anything else is left for review.
  Object.assign(v, choice(a.relationship_to_sponsor, {
    're:^(spouse|wife|husband)$': 'P2_Line3_A_Relationship[0]',
    're:^(son|daughter|adult son|adult daughter|child)$': 'P2_Line3_A_Relationship[1]',
    're:^(parent|mother|father)$': 'P2_Line3_A_Relationship[2]',
    're:^(brother|sister|sibling)$': 'P2_Line3_A_Relationship[3]'
  }));
  // Part 3, item 7: current individual annual income.
  v['P3_Line2_CurrentIncome[0]'] = clean(a.household_member_income, 20);

  // Part 5, the promise: "I, THE HOUSEHOLD MEMBER (print name)". The field is
  // named "Part9_Iamfluent[0]".
  v['Part9_Iamfluent[0]'] = [clean(a.applicant_given_name, 60), clean(a.applicant_middle_name, 60), clean(a.applicant_family_name, 60)].filter(Boolean).join(' ');

  // Part 6. Statement and contact information
  const statement = lower(a.applicant_statement);
  if (/interpreter/.test(statement)) v['P6Line1b_language[0]'] = clean(a.applicant_statement_language, 40);
  const preparerName = [clean(a.preparer_given_name, 60), clean(a.preparer_family_name, 60)].filter(Boolean).join(' ');
  if (isYes(a.has_preparer) && preparerName) v['P6Line2_Attorney[0]'] = preparerName;
  v['P7Line5_DaytimeTelephoneNumber[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
  v['P7Line6_MobileTelephoneNumber[0]'] = usPhone(a.mobile_phone);
  v['P7Line7_EmailAddress[0]'] = clean(a.email_address || a.email || c.email, 38);

  // Part 8 (interpreter) and Part 9 (preparer)
  Object.assign(v, helperFields(a, {
    interpreter: { family: 'P8Line1a_InterpretersFamilyName[0]', given: 'P8Line1b_InterpretersGivenName[0]', business: 'P8Line2_InterpretersBusinessName[0]' },
    preparer: { family: 'P9Line1a_PreparersFamilyName[0]', given: 'P9Line1b_PreparersGivenName[0]', business: 'P9Line2_PreparersBusinessName[0]' }
  }));

  return compact(v);
}

module.exports = { i_864aFieldValues };
