'use strict';
// Form N-565, Application for Replacement Naturalization/Citizenship
// Document. Field meanings come from the form's tooltips and, for the
// unlabeled reason boxes of Part 3, from their order on the page.
//
// Not filled: the name printed on the current certificate (Part 1, item 1).
// The wizard asks for the current legal name only, and after a name change
// the two differ. "Gender change" is not one of the form's reasons as worded
// (item 2.f), so that answer ticks no box.

const {
  clean, digits, dateMdY, usPhone, lower,
  addressFields, addressAnswers, choice, helperFields, compact
} = require('./uscis-map-kit');

function n_565FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};
  const reason = lower(a.replacement_reason);

  // Part 1. Information from the current certificate or declaration
  // The date of birth on the certificate is the applicant's own unless the
  // certificate itself is wrong, which is what "USCIS error" may mean.
  if (reason !== 'uscis error') v['Pt1Line2_DateofBirthonCert[0]'] = dateMdY(a.date_of_birth || a.dob || '');
  v['_CountryOfBirth[0]'] = clean(a.country_of_birth, 60);
  // Item 4 asks for the former citizenship.
  if (!/^united states/i.test(clean(a.country_of_citizenship))) v['Line3_CountryOfCitizenship[0]'] = clean(a.country_of_citizenship, 60);
  v['P1Line4_CertificateNumber[0]'] = clean(a.certificate_number, 20);
  v['ANum[0]'] = digits(a.alien_number || a.a_number, 9);

  // Part 2. Current information about you
  v['P2_Line1_FamilyName[0]'] = clean(a.applicant_family_name, 60);
  v['Line1_GivenName[0]'] = clean(a.applicant_given_name, 60);
  v['Line1_MiddleName[0]'] = clean(a.applicant_middle_name, 60);
  Object.assign(v, addressFields(addressAnswers(a, 'mailing'), {
    street: 'P2Line3_StreetNumberName[0]', city: 'Pt2Line3_CityTown[0]', state: 'P2Line3_State[0]', zip: 'P2Line3_ZipCode[0]',
    province: 'P2Line3_Province[0]', postal: 'P2Line3_PostalCode[0]', country: 'P2Line3_Country[0]',
    unit: { number: 'P2Line3_AptSteFlrNumber[0]' }
  }));
  Object.assign(v, choice(a.marital_status, {
    're:single|never': 'Part2_Item5[1]',
    're:^married': 'Part2_Item5[0]',
    're:divorc': 'Part2_Item5[3]',
    're:widow': 'Part2_Item5[2]',
    're:annul': 'Part2_Item5[4]'
  }));

  // Part 3. Type of application
  Object.assign(v, choice(a.certificate_type, {
    'citizenship certificate': 'Part3_Item1[0]',        // 1.a
    'naturalization certificate': 'Part3_Item1[1]',     // 1.b
    'repatriation certificate': 'Part3_Item1[2]',       // 1.c
    'declaration of intention': 'Part3_Item1[3]'        // 1.d
  }));
  Object.assign(v, choice(reason, {
    'lost': 'Pt3CheckBox2a[0]',          // 2.a lost, stolen, or destroyed
    'stolen': 'Pt3CheckBox2a[0]',
    'damaged': 'Pt3CheckBox3[0]',        // 2.b mutilated
    'uscis error': 'Pt3CheckBox4[0]',    // 2.c typographical or clerical error by USCIS
    'name change': 'Pt3CheckBox5[0]',    // 2.d name has legally changed
    'other': 'Pt3CheckBox8a[0]'          // 2.g reason not listed
  }));

  // Part 9. Applicant's contact information
  v['Pt9Line3_DaytimeTelephoneNumber3[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
  v['Pt9Line4_MobileTelephoneNumber3[0]'] = usPhone(a.mobile_phone);
  v['Pt9Line5_Email[0]'] = clean(a.email_address || a.email || c.email, 60);

  // Part 10 (interpreter) and Part 11 (preparer)
  Object.assign(v, helperFields(a, {
    interpreter: { family: 'Pt10Line1_InterpreterFamilyName[0]', given: 'Pt10Line1_InterpreterGivenName[0]', business: 'Pt10Line2_NameofBusinessorOrgName[0]', language: 'Pt10_Iamfluent[0]' },
    preparer: { family: 'Pt11Line1_PreparerFamilyName[0]', given: 'Pt11Line1_PreparerGivenName[0]', business: 'Pt11Line2_BusinessName[0]' }
  }));

  return compact(v);
}

module.exports = { n_565FieldValues };
