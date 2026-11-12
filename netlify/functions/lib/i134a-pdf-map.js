'use strict';
// Form I-134A (edition 07/11/23), Online Request to be a Supporter and
// Declaration of Financial Support. USCIS takes this form online only; the
// PDF is marked "SAMPLE - DO NOT SUBMIT", so the filled copy is a worksheet
// to type from. Part 2 is the beneficiary (principal_immigrant_* answers),
// Part 3 the supporter (sponsor_* answers). Field meanings come from the
// tooltips and the label printed next to each field.
//
// Not filled: other-names rows, the beneficiary's own income and asset
// tables, other persons the supporter filed for, and signatures. The
// supporter's dependents go to Part 8.

const {
  clean, digits, dateMdY, usPhone, lower, isYes, isNo,
  addressFields, addressAnswers, choice, helperFields, compact
} = require('./uscis-map-kit');

const ASSET_TYPES = [
  'Checking - Bank Account', 'Savings - Bank Account', 'Annuities', 'Stocks, Bonds, Certificates of Deposit',
  'Retirement or Educational Account', 'Real Estate Holdings', 'Personal Property (net value)'
];
// The drop-down values of Part 1 start with a space.
const PROCESSES = ['Parole Process', 'Family Reunification Parole Process'];
const PAROLE_COUNTRIES = ['Cuba', 'Haiti', 'Nicaragua', 'Ukraine', 'Venezuela'];
const FRP_NATIONALITIES = ['Colombia', 'Cuba', 'El Salvador', 'Guatemala', 'Haiti', 'Honduras'];

function money(v) { return clean(v, 20).replace(/^\$\s*/, ''); }
// The beneficiary is often abroad: keep a foreign number whole (the field
// takes 15 digits) and trim only a U.S. one.
function anyPhone(v) {
  const d = digits(v, 20);
  return d.length === 10 || (d.length === 11 && d.startsWith('1')) ? usPhone(d) : d.slice(0, 15);
}
function fullName(given, middle, family) { return [given, middle, family].map((x) => clean(x, 40)).filter(Boolean).join(' '); }
function sexBoxes(value, prefix) {
  return choice(value, { male: `${prefix}[0]`, female: `${prefix}[1]`, x: `${prefix}[2]` });
}

function i_134aFieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};
  const forSelf = clean(a.i134_filing_for) === 'Myself as the beneficiary';
  const forOther = clean(a.i134_filing_for) === 'Another individual who is the beneficiary';

  // Part 1. Basis for filing
  if (forSelf) v['Pt1_Line1[0]'] = true;
  if (forOther) v['Pt1_Line1[1]'] = true;
  const processName = clean(a.i134a_filing_under);
  if (PROCESSES.includes(processName)) v['P1_Line2_filing[0]'] = ` ${processName}`;
  if (processName === PROCESSES[0] && PAROLE_COUNTRIES.includes(clean(a.i134a_parole_country))) v['P1_Line3_Country[0]'] = ` ${clean(a.i134a_parole_country)}`;
  if (processName === PROCESSES[1]) {
    if (FRP_NATIONALITIES.includes(clean(a.i134a_frp_nationality))) v['P1_Line3_Nationality[0]'] = ` ${clean(a.i134a_frp_nationality)}`;
    v['P1_Line4_InvitationNumber[0]'] = clean(a.i134a_invitation_number, 30);
    v['P1_Line5_TotalFamilyMem[0]'] = digits(a.i134a_family_members_total, 3);
  }

  // Part 2. The beneficiary
  for (const i of [0, 1]) {   // [1] heads Part 8
    v[`P2_Line1_FamilyName[${i}]`] = clean(a.principal_immigrant_family_name, 60);
    v[`P2_Line1_GivenName[${i}]`] = clean(a.principal_immigrant_given_name, 60);
    v[`P2_Line1_MiddleName[${i}]`] = clean(a.principal_immigrant_middle_name, 60);
  }
  v['P1_Line4_Grant[0]'] = clean(a.beneficiary_parole_reason, 900);                   // item 4
  v['P2_Line3_DateOfBirth[0]'] = dateMdY(a.principal_immigrant_date_of_birth);   // item 5
  Object.assign(v, sexBoxes(a.principal_immigrant_sex, 'P2_Line4_Gender'));      // item 6
  v['P2_Line5_AlienNumber[0]'] = digits(a.principal_immigrant_alien_number, 9);  // item 7
  v['P2_Line6_CityOrTown[0]'] = clean(a.principal_immigrant_city_of_birth, 30);  // item 8
  v['P2_Line6_StateOrProvince[0]'] = clean(a.principal_immigrant_state_of_birth, 30);
  v['P2_Line6_Country[0]'] = clean(a.principal_immigrant_country_of_birth, 40);
  v['P2_Line7_CountryOfCitizen[0]'] = clean(a.principal_immigrant_country_of_citizenship, 40);   // item 9
  v['P2_Line8_PassportNumber[0]'] = clean(a.principal_immigrant_passport_number, 30);            // passport
  v['P2_Line8_CountryPassportIssue[0]'] = clean(a.principal_immigrant_passport_country, 40);
  v['P2_Line8_ExpirationDate[0]'] = dateMdY(a.principal_immigrant_passport_expiration);
  Object.assign(v, choice(a.principal_immigrant_marital_status, {                // marital status
    'single, never married': 'P2_Line9_MaritalStatus[0]',
    'married': 'P2_Line9_MaritalStatus[1]',
    'divorced': 'P2_Line9_MaritalStatus[2]',
    'widowed': 'P2_Line9_MaritalStatus[3]',
    'legally separated': 'P2_Line9_MaritalStatus[4]',
    'marriage annulled': 'P2_Line9_MaritalStatus[5]',
    'other': 'P2_Line9_MaritalStatus[6]'
  }));
  if (lower(a.principal_immigrant_marital_status) === 'other') v['P2_Line9_MaritalStatusOther[0]'] = clean(a.principal_immigrant_marital_status_other, 40);
  Object.assign(v, addressFields(addressAnswers(a, 'principal_immigrant_mailing'), {   // item 12
    street: 'P2_Line10_StreetName[0]', city: 'P2_Line10_City[0]', state: 'P2_Line10_State[0]', zip: 'P2_Line10_ZipCode[0]',
    province: 'P2_Line10_Province[0]', postal: 'P2_Line10_PostalCode[0]', country: 'P2_Line10_Country[0]',
    unit: { apt: 'P2_Line10_Unit[0]', ste: 'P2_Line10_Unit[1]', flr: 'P2_Line10_Unit[2]', number: 'P2_Line10_Number[0]' }
  }));
  if (isYes(a.principal_immigrant_physical_same_as_mailing)) v['P2_Line_11[0]'] = true;   // item 13
  if (isNo(a.principal_immigrant_physical_same_as_mailing)) {
    v['P2_Line_11[1]'] = true;
    Object.assign(v, addressFields(addressAnswers(a, 'principal_immigrant_physical'), {   // item 14
      street: 'P2_Line12_PhysicalStreetName[0]', city: 'P2_Line12_City[0]', state: 'P2_Line12_State[0]', zip: 'P2_Line12_ZipCode[0]',
      province: 'P2_Line12_Province[0]', postal: 'P2_Line12_PostalCode[0]', country: 'P2_Line12_Country[0]',
      unit: { apt: 'P2_Line12_Unit[0]', ste: 'P2_Line12_Unit[1]', flr: 'P2_Line12_Unit[2]', number: 'P2_Line12_Number[0]' }
    }));
  }
  // Items 15 to 17. A beneficiary filing for themselves gave the same
  // numbers in the statement step.
  v['P2_Line13_DaytimePhoneNumber[0]'] = anyPhone(a.principal_immigrant_daytime_phone || (forSelf ? a.daytime_phone : ''));
  v['P2_Line14_MobilePhoneNumber[0]'] = anyPhone(a.principal_immigrant_mobile_phone || (forSelf ? a.mobile_phone : ''));
  v['P2_Line15_EmailAddress[0]'] = clean(a.principal_immigrant_email || (forSelf ? a.email_address : ''), 60);
  v['P2_Line16_DateFrom[0]'] = dateMdY(a.beneficiary_stay_from);                        // item 18
  if (lower(a.beneficiary_stay_end) === 'end date') {
    v['P2_Line16_Date[0]'] = true;
    v['P2_Line16_ToDateFiled[0]'] = dateMdY(a.beneficiary_stay_to);
  }
  if (lower(a.beneficiary_stay_end) === 'no end date') v['P2_Line16_Date[1]'] = true;

  // Part 3. The supporter (only when filing for someone else)
  if (forOther) {
    v['P3_Line1_FamilyName[0]'] = clean(a.sponsor_family_name, 60);
    v['P3_Line1_GivenName[0]'] = clean(a.sponsor_given_name, 60);
    v['P3_Line1_MiddleName[0]'] = clean(a.sponsor_middle_name, 60);
    if (processName === PROCESSES[0]) v['P3_Line3_Organization[0]'] = clean(a.i134a_co_supporter, 80);
    if (processName === PROCESSES[1]) v['P3_Line4_IndCoSponsor[0]'] = clean(a.i134a_co_supporter, 80);
    Object.assign(v, addressFields(addressAnswers(a, 'sponsor_mailing'), {     // item 5
      street: 'P3_Line4_StreetName[0]', city: 'P3_Line4_City[0]', state: 'P3_Line4_State[0]', zip: 'P3_Line4_ZipCode[0]',
      province: 'P3_Line4_Province[0]', postal: 'P3_Line4_PostalCode[0]', country: 'P3_Line4_Country[0]',
      unit: { apt: 'P3_Line4_Unit[2]', ste: 'P3_Line4_Unit[1]', flr: 'P3_Line4_Unit[0]', number: 'P3_Line4_Number[0]' }
    }));
    if (isYes(a.sponsor_physical_same_as_mailing)) v['Pt3_Line5_Yes[0]'] = true;   // item 6
    if (isNo(a.sponsor_physical_same_as_mailing)) {
      v['Pt3_Line5_No[0]'] = true;
      Object.assign(v, addressFields(addressAnswers(a, 'sponsor_physical'), {    // item 7
        street: 'P3_Line6_StreetName[0]', city: 'P3_Line6_City[0]', state: 'P3_Line6_State[0]', zip: 'P3_Line6_ZipCode[0]',
        province: 'P3_Line6_Province[0]', postal: 'P3_Line6_PostalCode[0]', country: 'P3_Line6_Country[0]',
        unit: { apt: 'P3_Line6_Unit[0]', ste: 'P3_Line6_Unit[1]', flr: 'P3_Line6_Unit[2]', number: 'P3_Line6_Number[0]' }
      }));
    }
    v['P3_Line7_DateOfBirth[0]'] = dateMdY(a.sponsor_date_of_birth);            // item 8
    Object.assign(v, sexBoxes(a.sponsor_sex, 'P3_Line8_Gender'));               // item 9
    v['P3_Line9_City[0]'] = clean(a.sponsor_city_of_birth, 30);                 // item 10
    v['P3_Line9_Province[0]'] = clean(a.sponsor_state_of_birth, 30);
    v['P3_Line9_Country[0]'] = clean(a.sponsor_country_of_birth, 40);
    v['P3_Line10_AlienNumber[0]'] = digits(a.sponsor_alien_number, 9);          // item 11
    v['P3_Line11_OnlineAccountNumber[0]'] = digits(a.sponsor_uscis_online_account_number, 12);   // item 12
    v['P_Line12_SSN[0]'] = digits(a.sponsor_ssn, 9);                            // item 13
    v['P3_Line13_Relationship[0]'] = clean(a.sponsor_relationship_to_beneficiary, 60);   // item 14
    // Item 15. The status boxes are named "P3_Line14_MaritalStatus".
    Object.assign(v, choice(a.sponsor_status, {
      'u.s. citizen': 'P3_Line14_MaritalStatus[0]',
      'u.s. national': 'P3_Line14_MaritalStatus[1]',
      'lawful permanent resident': 'P3_Line14_MaritalStatus[2]',
      'nonimmigrant': 'P3_Line14_MaritalStatus[3]'
    }));
    if (lower(a.sponsor_status) === 'nonimmigrant') v['P3_Line14_I94[0]'] = digits(a.sponsor_i94_number, 11);
    if (lower(a.sponsor_status) === 'other') v['P3_Line14_MaritalStatusOther[0]'] = clean(a.sponsor_status_other, 60);
    // Items 16 and 17. "Employed" on this form includes self-employment.
    const employment = lower(a.i134_employment_status);
    if (employment === 'employed' || employment === 'self-employed') v['P3_Line15_EmploymentStatus[0]'] = true;
    if (employment === 'unemployed or not employed') v['P3_Line15_EmploymentStatus[1]'] = true;
    if (employment === 'retired') v['P3_Line15_EmploymentStatus[2]'] = true;
    if (employment === 'other') {
      v['P3_Line15_EmploymentStatus[3]'] = true;
      v['P3_Line15_MaritalStatusOther[0]'] = clean(a.i134_employment_other, 60);
    }
    if (employment === 'employed') {
      v['P3_Line16_AB[0]'] = true;
      v['P3_Line16_A_EmployedType[0]'] = clean(a.sponsor_occupation, 40);
      v['P3_Line16_A_NameOfEmployer[0]'] = clean(a.sponsor_employer_name, 60);
      Object.assign(v, addressFields(addressAnswers(a, 'sponsor_employer'), {   // item 18
        street: 'P3_Line17_StreetName[0]', city: 'P3_Line17_City[0]', state: 'P3_Line17_State[0]', zip: 'P3_Line17_ZipCode[0]',
        province: 'P3_Line17_Province[0]', postal: 'P3_Line17_PostalCode[0]', country: 'P3_Line17_Country[0]',
        unit: { apt: 'P3_Line17_Unit[2]', ste: 'P3_Line17_Unit[1]', flr: 'P3_Line17_Unit[0]', number: 'P3_Line17_Number[0]' }
      }));
    }
    if (employment === 'self-employed') {
      v['P3_Line16_AB[1]'] = true;
      v['P3_Line16_B_SelfEmployedType[0]'] = clean(a.sponsor_self_employed_as, 40);
    }

    // Item 19: the first row of the income table is the supporter ("Self").
    // Other rows come from the dependents answer, which goes to Part 8.
    const income = money(a.current_annual_income);
    if (income) {
      v['P3_Line18_CareOfName_1[0]'] = fullName(a.sponsor_given_name, a.sponsor_middle_name, a.sponsor_family_name);
      v['P3_Line18_DateOfBirth_1[0]'] = dateMdY(a.sponsor_date_of_birth);
      v['P3_Line18_FamilyName_1[0]'] = 'Self';
      v['P3_Line18_Amount_1[0]'] = income;
      if (!clean(a.i134_dependents)) v['P3_Line18_Total[0]'] = income;
    }
    v['P3_Line18_TotalDependents[0]'] = digits(a.i134_dependents_count, 3);
    if (isYes(a.i134_income_illegal)) v['P3_Line19_YesNo[0]'] = true;          // item 20
    if (isNo(a.i134_income_illegal)) {
      v['P3_Line19_YesNo[1]'] = true;
      v['P3_Line20_IncomeIllegal[0]'] = 'N/A';                                    // item 21
    }
    if (isYes(a.i134_income_means_tested)) {                                     // items 22, 23
      v['P3_Line21_YesNo[0]'] = true;
      v['P3_Line22_Income[0]'] = money(a.i134_income_means_tested_amount);
    }
    if (isNo(a.i134_income_means_tested)) v['P3_Line21_YesNo[1]'] = true;

    // Item 24: assets
    const holder = fullName(a.sponsor_given_name, a.sponsor_middle_name, a.sponsor_family_name);
    let row = 0;
    let total = 0;
    let totalKnown = true;
    for (const n of [1, 2, 3]) {
      const type = clean(a[`i134_asset${n}_type`]);
      const amount = money(a[`i134_asset${n}_amount`]);
      if (!ASSET_TYPES.includes(type) || !amount) continue;
      row += 1;
      v[`P3_Line23_NameOfAssetHolder_${row}[0]`] = holder;
      v[`P3_Line23_TypeofAssetDropDownList_${row}[0]`] = type;
      v[`P3_Line23_Amount_${row}[0]`] = amount;
      const number = Number(amount.replace(/,/g, ''));
      if (Number.isFinite(number)) total += number; else totalKnown = false;
    }
    if (row && totalKnown) v['P3_Line23_Total[0]'] = String(Math.round(total * 100) / 100);

    // Item 25 and items 28 to 30
    if (isYes(a.i134a_previous_i134a)) v['P3_Line24_YesNo[0]'] = true;
    if (isNo(a.i134a_previous_i134a)) v['P3_Line24_YesNo[1]'] = true;
    v['P3_Line27_BeneficiaryFinancialSupport[0]'] = clean(a.i134a_support_financial, 900);
    v['P3_Line28_BeneficiaryHousing[0]'] = clean(a.i134a_support_housing, 900);
    v['P3_Line29_BeneficiaryBenefits[0]'] = clean(a.i134a_support_services, 900);
  }

  // Statement: Part 4 for a beneficiary filing for themselves, Part 5 for
  // the supporter. Part 5 also carries the supporter's contact information.
  const statement = lower(a.i864_sponsor_statement);
  const preparerName = fullName(a.preparer_given_name, '', a.preparer_family_name);
  if (forSelf) {
    if (/read and understand english/.test(statement)) v['P4_Line1_CB_A[0]'] = true;
    if (/interpreter/.test(statement)) {
      v['P4_Line1_CB_B[0]'] = true;
      v['P4_Line1_Language[0]'] = clean(a.i864_sponsor_statement_language, 40);
    }
    if (isYes(a.has_preparer) && preparerName) {
      v['P4_Line2_CB[0]'] = true;
      v['P4_Line2_PreparerName[0]'] = preparerName;
    }
  } else if (forOther) {
    if (/read and understand english/.test(statement)) v['P5_Line1_CB_A[0]'] = true;
    if (/interpreter/.test(statement)) {
      v['P5_Line1_CB_B[0]'] = true;
      v['P5_Line1_B_Language[0]'] = clean(a.i864_sponsor_statement_language, 40);
    }
    if (isYes(a.has_preparer) && preparerName) {
      v['P5_Line2_Preparer[0]'] = true;
      v['P5_Line2_PreparerName[0]'] = preparerName;
    }
    v['P5_Line3_DaytimePhoneNumber[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
    v['P5_Line4_MobilePhoneNumber[0]'] = usPhone(a.mobile_phone);
    v['P5_Line5_EmailAddress[0]'] = clean(a.email_address || a.email || c.email, 60);
  }

  // Part 6 (interpreter) and Part 7 (preparer). The interpreter's language
  // field is named "P7_Line6_Language".
  Object.assign(v, helperFields(a, {
    interpreter: { family: 'P6_Line1_InterpreterFamilyName[0]', given: 'P6_Line1_InterpreterGivenName[0]', business: 'P6_Line2_BusinessOrOrgName[0]', language: 'P7_Line6_Language[0]' },
    preparer: { family: 'P7_Line1_PreparerFamilyName[0]', given: 'P7_Line1_PreparerGivenName[0]', business: 'P7_Line2_PreparerNameofBusinessorOrgName[0]' }
  }));
  if (isYes(a.has_interpreter)) {
    v['P6_Line4_DaytimeTelePhoneNumber[0]'] = usPhone(a.interpreter_daytime_phone);
    v['P6_Line5_MobileTelePhoneNumber[0]'] = usPhone(a.interpreter_mobile_phone);
    v['P6_Line6_EmailAddress[0]'] = clean(a.interpreter_email, 60);
  }
  if (isYes(a.has_preparer)) {
    v['P7_Line4_DaytimeTelephoneNum[0]'] = usPhone(a.preparer_daytime_phone);
    v['P7_Line3_MobileTelephoneNum[0]'] = usPhone(a.preparer_mobile_phone);
    v['P7_Line6_EmailAaddress[0]'] = clean(a.preparer_email, 60);
  }

  // Part 8. Additional information
  const extra = [];
  if (forOther && clean(a.i134_dependents)) extra.push(['3', '19', clean(a.i134_dependents, 1200)]);
  if (clean(a.i864_additional_information)) extra.push(['', '', clean(a.i864_additional_information, 1200)]);
  const slots = [
    ['P8_Line3_B_PartNumber[0]', 'P8_Line3_C_ItemNumber[0]', 'P8_Line3_D_AdditionalInfo[0]'],
    ['P8_Line4_B_PartNumber[0]', 'P8_Line4_C_ItemNumber[0]', 'P8_Line4_D_AdditionalInfo[0]']
  ];
  extra.slice(0, slots.length).forEach(([part, item, text], i) => {
    v[slots[i][0]] = part;
    v[slots[i][1]] = item;
    v[slots[i][2]] = text;
  });

  return compact(v);
}

module.exports = { i_134aFieldValues };
