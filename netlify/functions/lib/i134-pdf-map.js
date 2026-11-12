'use strict';
// Form I-134 (edition 01/20/25), Declaration of Financial Support. The wizard
// asks about the supporter (sponsor_*, Part 2) and the beneficiary
// (principal_immigrant_*, Part 3). Field meanings come from the form's
// tooltips and, where tooltips are missing, from the label printed next to
// each field.
//
// The form reuses short names between parts: the supporter's mailing and
// physical address, date and place of birth share them with the
// beneficiary's. The supporter's copies are addressed by full name; the
// short name reaches the beneficiary's. Likewise the contact fields of
// Part 4 (beneficiary) carry the "P5[0]." prefix, while the short names
// reach Part 5 (supporter).
//
// Not filled: the other-names rows (one free-text answer does not split into
// family/given/middle), the table of dependents (item 15) and signatures.
// The dependents answer goes to Part 8 instead.

const {
  clean, digits, dateMdY, usPhone, lower, isYes, isNo,
  addressFields, addressAnswers, choice, helperFields, compact
} = require('./uscis-map-kit');

const SUPPORTER_MAILING = 'form1[0].#subform[0].Part2_Item11_';
const SUPPORTER_PHYSICAL = 'form1[0].PG2[0].sfPhysicalAddress[0].Part2_Item11_';
const SUPPORTER_PAGE2 = 'form1[0].PG2[0].';
const FOR_SELF = 'Myself as the beneficiary';

const ASSET_TYPES = [
  'Checking - Bank Account', 'Savings - Bank Account', 'Annuities', 'Stocks, Bonds, Certificates of Deposit',
  'Retirement or Educational Account', 'Real Estate Holdings', 'Personal Property (net value)'
];

function money(v) { return clean(v, 20).replace(/^\$\s*/, ''); }

function i_134FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};
  const forSelf = clean(a.i134_filing_for) === FOR_SELF;
  const forOther = clean(a.i134_filing_for) === 'Another individual who is the beneficiary';

  // Part 1. Basis for filing
  if (forSelf) v['Pt3Line17[1]'] = true;
  if (forOther) v['Pt3Line17[0]'] = true;

  // Part 2. The individual agreeing to financially support the beneficiary
  v['Pt1Line1_FamilyName[0]'] = clean(a.sponsor_family_name, 60);
  v['Pt1Line1_GivenName[0]'] = clean(a.sponsor_given_name, 60);
  v['Pt1Line1_MiddleName[0]'] = clean(a.sponsor_middle_name, 60);
  Object.assign(v, addressFields(addressAnswers(a, 'sponsor_mailing'), {     // item 3
    street: `${SUPPORTER_MAILING}StreetName[0]`, city: `${SUPPORTER_MAILING}City[0]`, state: `${SUPPORTER_MAILING}State[0]`, zip: `${SUPPORTER_MAILING}ZipCode[0]`,
    province: `${SUPPORTER_MAILING}Province[0]`, postal: `${SUPPORTER_MAILING}PostalCode[0]`, country: `${SUPPORTER_MAILING}Country[0]`,
    unit: { apt: 'Part2_Line3_Unit[0]', ste: 'Part2_Line3_Unit[1]', flr: 'Part2_Line3_Unit[2]', number: 'Part2_Line3_Number[0]' }
  }));
  if (isYes(a.sponsor_physical_same_as_mailing)) v['Pt2_Line4_CB[0]'] = true;   // item 4
  if (isNo(a.sponsor_physical_same_as_mailing)) {
    v['Pt2_Line4_CB[1]'] = true;
    Object.assign(v, addressFields(addressAnswers(a, 'sponsor_physical'), {    // item 5
      street: `${SUPPORTER_PHYSICAL}StreetName[0]`, city: `${SUPPORTER_PHYSICAL}City[0]`, state: `${SUPPORTER_PHYSICAL}State[0]`, zip: `${SUPPORTER_PHYSICAL}ZipCode[0]`,
      province: `${SUPPORTER_PHYSICAL}Province[0]`, postal: `${SUPPORTER_PHYSICAL}PostalCode[0]`, country: `${SUPPORTER_PHYSICAL}Country[0]`,
      unit: { apt: 'Part2_Line5_Unit[0]', ste: 'Part2_Line5_Unit[1]', flr: 'Part2_Line5_Unit[2]', number: 'Part2_Line5_Number[0]' }
    }));
  }
  v[`${SUPPORTER_PAGE2}#area[0].P2_Line8_DateOfBirth[0]`] = dateMdY(a.sponsor_date_of_birth);   // item 6
  v[`${SUPPORTER_PAGE2}Part2_Item6_City[0]`] = clean(a.sponsor_city_of_birth, 30);               // item 7
  v[`${SUPPORTER_PAGE2}Part2_Item6_Province[0]`] = clean(a.sponsor_state_of_birth, 30);
  v[`${SUPPORTER_PAGE2}Part2_Item6_Country[0]`] = clean(a.sponsor_country_of_birth, 40);
  v['Pt1Line5_AlienNumber[0]'] = digits(a.sponsor_alien_number, 9);                            // item 8
  v['Pt1Line10_OnlineAccountNumber[0]'] = digits(a.sponsor_uscis_online_account_number, 12);   // item 9
  Object.assign(v, choice(a.sponsor_status, {                                                  // item 10
    'u.s. citizen': 'P2_Line10_ImmigrationStatus[0]',
    'u.s. national': 'P2_Line10_ImmigrationStatus[2]',
    'lawful permanent resident': 'P2_Line10_ImmigrationStatus[1]',
    'nonimmigrant': 'P2_Line10_ImmigrationStatus[3]',
    'asylee': 'P2_Line10_ImmigrationStatus[4]',
    'refugee': 'P2_Line10_ImmigrationStatus[5]',
    'parolee': 'P2_Line10_ImmigrationStatus[6]',
    'tps holder': 'P2_Line10_ImmigrationStatus[7]',
    're:^deferred action': 'P2_Line10_ImmigrationStatus[8]',
    'other': 'P2_Line10_ImmigrationStatus[9]'
  }));
  if (lower(a.sponsor_status) === 'other') v['P3_Line10_Other[0]'] = clean(a.sponsor_status_other, 60);
  if (!forSelf) v['P2_Line11_Beneficiary[0]'] = clean(a.sponsor_relationship_to_beneficiary, 60);   // item 11
  const employment = lower(a.i134_employment_status);                                          // item 12
  if (employment === 'employed') {
    v['StatusEmployment_CB[0]'] = true;
    v['EmploymentType[0]'] = clean(a.sponsor_occupation, 40);
    v['NameOfEmployer[0]'] = clean(a.sponsor_employer_name, 60);
  }
  if (employment === 'self-employed') {
    v['StatusEmployment_CB[1]'] = true;
    v['SelfEmploymentType[0]'] = clean(a.sponsor_self_employed_as, 40);
  }
  if (employment === 'unemployed or not employed') v['StatusEmployment_CB[2]'] = true;
  if (employment === 'retired') v['StatusEmployment_CB[3]'] = true;
  if (employment === 'other') {
    v['StatusEmployment_CB[4]'] = true;
    v['OtherEmployment[0]'] = clean(a.i134_employment_other, 60);
  }

  // Financial information, items 13 to 17
  v['P3_Line13[0]'] = digits(a.i134_other_obligations_count, 3);
  v['P3_Line14[0]'] = digits(a.i134_dependents_count, 3);
  v['Pt3Line116_Annual[0]'] = money(a.current_annual_income);
  let row = 0;
  let total = 0;
  let totalKnown = true;
  for (const n of [1, 2, 3]) {
    const type = clean(a[`i134_asset${n}_type`]);
    const amount = money(a[`i134_asset${n}_amount`]);
    if (!ASSET_TYPES.includes(type) || !amount) continue;
    row += 1;
    v[`Pt3Line${row}Cell${row}_TypeofAssetDropDownList[0]`] = type;
    v[`Pt3Line${row}Cell${row}_Amount[0]`] = amount;
    const number = Number(amount.replace(/,/g, ''));
    if (Number.isFinite(number)) total += number; else totalKnown = false;
  }
  if (row && totalKnown) v['Pt3Line9Cell9_Total[0]'] = String(Math.round(total * 100) / 100);

  // Items 18 and 19: specific contributions (only when filing for another person)
  if (!forSelf) {
    if (isYes(a.i134_specific_contributions)) v['Pt2_Line18_CB[0]'] = true;
    if (isNo(a.i134_specific_contributions)) v['Pt2_Line18_CB[1]'] = true;
    if (isYes(a.i134_specific_contributions)) v['form1[0].P8[0].Pt4Line1b_language[0]'] = clean(a.i134_contributions_description, 600);
  }

  // Part 3. The beneficiary (skipped when filing for oneself)
  if (!forSelf) {
    v['Pt3Line1_FamilyName[0]'] = clean(a.principal_immigrant_family_name, 60);
    v['Pt3Line1_GivenName[0]'] = clean(a.principal_immigrant_given_name, 60);
    v['Pt3Line1_MiddleName[0]'] = clean(a.principal_immigrant_middle_name, 60);
    v['P2_Line8_DateOfBirth[0]'] = dateMdY(a.principal_immigrant_date_of_birth);   // item 3
    if (lower(a.principal_immigrant_sex) === 'male') v['Pt3_Line4_Sex_CB[0]'] = true;
    if (lower(a.principal_immigrant_sex) === 'female') v['Pt3_Line4_Sex_CB[1]'] = true;
    v['Pt3Line5_AlienNumber[0]'] = digits(a.principal_immigrant_alien_number, 9);
    v['Part2_Item6_City[0]'] = clean(a.principal_immigrant_city_of_birth, 30);     // item 6
    v['Part2_Item6_Province[0]'] = clean(a.principal_immigrant_state_of_birth, 30);
    v['Part2_Item6_Country[0]'] = clean(a.principal_immigrant_country_of_birth, 40);
    v['P2_Line8_Country[0]'] = clean(a.principal_immigrant_country_of_citizenship, 40);   // item 7
    Object.assign(v, choice(a.principal_immigrant_marital_status, {               // item 8
      'single, never married': 'Pt3_Line8_MaritalStatus[0]',
      'married': 'Pt3_Line8_MaritalStatus[1]',
      'divorced': 'Pt3_Line8_MaritalStatus[2]',
      'widowed': 'Pt3_Line8_MaritalStatus[3]',
      'legally separated': 'Pt3_Line8_MaritalStatus[4]',
      'marriage annulled': 'Pt3_Line8_MaritalStatus[5]',
      'other': 'Pt3_Line8_MaritalStatus[6]'
    }));
    if (lower(a.principal_immigrant_marital_status) === 'other') v['Pt3_Line8_MaritalStatusOther[0]'] = clean(a.principal_immigrant_marital_status_other, 40);
    Object.assign(v, addressFields(addressAnswers(a, 'principal_immigrant_mailing'), {   // item 9
      street: 'Part2_Item11_StreetName[0]', city: 'Part2_Item11_City[0]', state: 'Part2_Item11_State[0]', zip: 'Part2_Item11_ZipCode[0]',
      province: 'Part2_Item11_Province[0]', postal: 'Part2_Item11_PostalCode[0]', country: 'Part2_Item11_Country[0]',
      unit: { apt: 'Part3_Item9_Unit[0]', ste: 'Part3_Item9_Unit[1]', flr: 'Part3_Item9_Unit[2]', number: 'Part3_Item9_Number[0]' }
    }));
    if (isYes(a.principal_immigrant_physical_same_as_mailing)) v['Pt3_Line10_CB[0]'] = true;   // item 10
    if (isNo(a.principal_immigrant_physical_same_as_mailing)) {
      v['Pt3_Line10_CB[1]'] = true;
      Object.assign(v, addressFields(addressAnswers(a, 'principal_immigrant_physical'), {   // item 11
        street: 'P2_Line10_StreetName[0]', city: 'Pt2_Line10_City[0]', state: 'Pt2Line10_State[0]', zip: 'Pt2Line10_ZipCode[0]',
        province: 'Pt2Line10_Province[0]', postal: 'Pt2Line10_PostalCode[0]', country: 'Pt2Line10_Country[0]',
        unit: { apt: 'P2_Line10_Unit[2]', ste: 'P2_Line10_Unit[1]', flr: 'P2_Line10_Unit[0]', number: 'P2_Line10_Number[0]' }
      }));
    }
    v['Pt3_Line12_DateFrom[0]'] = dateMdY(a.beneficiary_stay_from);                       // item 12
    if (lower(a.beneficiary_stay_end) === 'end date') {
      v['Pt2Line12_Date[0]'] = true;
      v['Pt3_Line12_DateTo[0]'] = dateMdY(a.beneficiary_stay_to);
    }
    if (lower(a.beneficiary_stay_end) === 'no end date') v['Pt2Line12_NoDate[0]'] = true;
  }

  // Statement and contact information: Part 4 when the beneficiary files for
  // themselves, Part 5 when the supporter files for someone else.
  const statement = lower(a.i864_sponsor_statement);
  const preparerName = [clean(a.preparer_given_name, 60), clean(a.preparer_family_name, 60)].filter(Boolean).join(' ');
  if (forSelf) {
    if (/read and understand english/.test(statement)) v['Pt4Line1a_Checkboxa[0]'] = true;
    if (/interpreter/.test(statement)) {
      v['Pt4Line1b_Checkboxb[0]'] = true;
      v['Pt4Line1b_language[0]'] = clean(a.i864_sponsor_statement_language, 40);
    }
    if (isYes(a.has_preparer) && preparerName) {
      v['form1[0].P5[0].Part4_Line2_ReqServCheckbox[0]'] = true;
      v['Pt4Line2_RepresentativeName[0]'] = preparerName;
    }
    v['form1[0].P5[0].Part4_Line3_DaytimePhoneNumber3[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
    v['form1[0].P5[0].Part4_Line4_SafePhoneNumber3[0]'] = usPhone(a.mobile_phone);
    v['form1[0].P5[0].Part4_Line5_EmailAddress[0]'] = clean(a.email_address || a.email || c.email, 60);
  } else if (forOther) {
    if (/read and understand english/.test(statement)) v['Pt5_Line1_CB[0]'] = true;
    if (/interpreter/.test(statement)) {
      v['Pt5_Line1_CB[1]'] = true;
      v['Pt5_Line1b_language[0]'] = clean(a.i864_sponsor_statement_language, 40);
    }
    if (isYes(a.has_preparer) && preparerName) {
      v['Part4_Line2_ReqServCheckbox[0]'] = true;
      v['Pt5_Line2_RepresentativeName[0]'] = preparerName;
    }
    v['Part4_Line3_DaytimePhoneNumber3[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
    v['Part4_Line4_SafePhoneNumber3[0]'] = usPhone(a.mobile_phone);
    v['Part4_Line5_EmailAddress[0]'] = clean(a.email_address || a.email || c.email, 60);
  }

  // Part 6 (interpreter) and Part 7 (preparer). The preparer's fields are
  // named "P4_Line1_Interpreter...".
  Object.assign(v, helperFields(a, {
    interpreter: { family: 'Pt6Line1_InterpreterFamilyName[0]', given: 'Pt6Line1_InterpreterGivenName[0]', business: 'Pt6Line2_BusinessOrOrgName[0]', language: 'P4_Line6_Language[0]' },
    preparer: { family: 'P4_Line1_InterpreterFamilyName[0]', given: 'P4_Line1_InterpreterGivenName[0]', business: 'P4_Line2_NameofBusinessorOrgName[0]' }
  }));
  if (isYes(a.has_interpreter)) {
    v['P3_Line4_DaytimeTelePhoneNumber[0]'] = usPhone(a.interpreter_daytime_phone);
    v['P3_Line5_MobileTelePhoneNumber[0]'] = usPhone(a.interpreter_mobile_phone);
    v['P3_Line6_Email[0]'] = clean(a.interpreter_email, 60);
  }
  if (isYes(a.has_preparer)) {
    v['Pt7Line4_DaytimeTelephoneNum[0]'] = usPhone(a.preparer_daytime_phone);
    v['Pt7Line3_MobileTelephoneNum[0]'] = usPhone(a.preparer_mobile_phone);
    v['Pt7Line6_Email[0]'] = clean(a.preparer_email, 60);
  }

  // Part 8. Additional information: the person's name heads the page, then
  // the dependents (Part 2, item 15) and the client's own notes.
  const extra = [];
  const dependents = clean(a.i134_dependents, 1200);
  if (dependents) extra.push(['2', '15', dependents]);
  const notes = clean(a.i864_additional_information, 1200);
  if (notes) extra.push(['', '', notes]);
  if (extra.length) {
    v['form1[0].P13[0].Pt1Line1_FamilyName[0]'] = clean(a.sponsor_family_name, 60);
    v['form1[0].P13[0].Pt1Line1_GivenName[0]'] = clean(a.sponsor_given_name, 60);
    v['form1[0].P13[0].Pt1Line1_MiddleName[0]'] = clean(a.sponsor_middle_name, 60);
    const slots = [
      ['Pt9Line3b_PartNumber[0]', 'Pt9Line3c_ItemNumber[0]', 'Pt9Line3d_AdditionalInfo[0]'],
      ['Pt9Line4b_PartNumber[0]', 'Pt9Line4c_ItemNumber[0]', 'Pt9Line3d_AdditionalInfo[1]']
    ];
    extra.slice(0, slots.length).forEach(([part, item, text], i) => {
      const [p, it, t] = slots[i];
      v[p] = part;
      v[it] = item;
      v[t] = text;
    });
  }

  return compact(v);
}

module.exports = { i_134FieldValues };
