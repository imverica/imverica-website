'use strict';

const inventory = require('../pdf-maps/uscis/i-864.json');
const { unitNumber, unitRadio } = require('./form-helpers');

function clean(value, max = 300) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function digits(value, max = 30) {
  return clean(value, Math.max(80, max * 4)).replace(/\D/g, '').slice(0, max);
}

function amount(value) {
  return clean(value, 40).replace(/[^0-9.,-]/g, '').slice(0, 24);
}

function dateMdY(value) {
  const text = clean(value, 40);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : text;
}

function stateCode(value) {
  const text = clean(value, 80);
  const match = text.match(/^([A-Z]{2})\b/);
  return match ? match[1] : text;
}

function usPhone(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return digits(`${value.areaCode || ''}${value.number || ''}`, 10);
  const result = digits(value, 20);
  if (result.length === 11 && result.startsWith('1')) return result.slice(1);
  return result.length > 10 ? result.slice(-10) : result;
}

function yesNo(value) {
  const text = clean(value, 40).toLowerCase();
  if (['yes', 'true', 'да', 'так'].includes(text)) return 'Y';
  if (['no', 'false', 'нет', 'ні'].includes(text)) return 'N';
  return '';
}

function isUS(country) {
  const text = clean(country, 60).toLowerCase();
  return !text || /united states|u\.?s\.?a?\b|usa|сша|америк/.test(text);
}

function asSet(value) {
  return new Set(Array.isArray(value) ? value : (value ? [value] : []));
}

const buttonsByBase = new Map();
for (const item of inventory.fields || []) {
  if (item.pdfFieldType !== 'Btn') continue;
  const base = item.pdfFieldName.replace(/\[\d+\]$/, '');
  const widgets = buttonsByBase.get(base) || [];
  widgets.push(item);
  buttonsByBase.set(base, widgets);
}

function setChoice(out, fieldBase, state) {
  if (!state) return;
  for (const widget of buttonsByBase.get(fieldBase) || []) {
    out[widget.pdfFieldName] = (widget.appearanceStates || []).includes(state);
  }
}

function setYesNo(out, fieldBase, value) {
  setChoice(out, fieldBase, yesNo(value));
}

function addressAnswers(answers, root, prefix) {
  const block = answers[root] && typeof answers[root] === 'object' ? answers[root] : {};
  return {
    inCareOf: block.inCareOf || answers[`${prefix}_in_care_of`] || '',
    line1: block.line1 || answers[`${prefix}_address_line1`] || answers[`${prefix}_line1`] || '',
    line2: block.line2 || answers[`${prefix}_address_line2`] || answers[`${prefix}_line2`] || '',
    city: block.city || answers[`${prefix}_city`] || '',
    state: block.state || answers[`${prefix}_state`] || '',
    zip: block.zip || answers[`${prefix}_zip`] || '',
    country: block.country || answers[`${prefix}_country`] || ''
  };
}

function setAddress(out, fields, address) {
  const item = address || {};
  if (fields.inCareOf) out[fields.inCareOf] = clean(item.inCareOf, 80);
  out[fields.street] = clean(item.line1, 80);
  out[fields.unitNumber] = unitNumber(item.line2);
  Object.assign(out, unitRadio(fields.unitBase, item.line2));
  out[fields.city] = clean(item.city, 60);
  if (isUS(item.country)) {
    out[fields.state] = stateCode(item.state);
    out[fields.zip] = digits(item.zip, 9);
  } else {
    out[fields.province] = clean(item.state, 40);
    out[fields.postal] = clean(item.zip, 20);
    out[fields.country] = clean(item.country, 60);
  }
}

const PRINCIPAL_ADDRESS = {
  inCareOf: 'P2_Line2_InCareOf[0]',
  street: 'P2_Line2_StreetNumberName[0]',
  unitBase: 'P2_Line2_Unit',
  unitNumber: 'P2_Line2_AptSteFlrNumber[0]',
  city: 'P2_Line2_CityOrTown[0]',
  state: 'P2_Line2_State[0]',
  zip: 'P2_Line2_ZipCode[0]',
  province: 'P2_Line2_Province[0]',
  postal: 'P2_Line2_PostalCode[0]',
  country: 'P2_Line2_Country[0]'
};

const SPONSOR_MAILING_ADDRESS = {
  inCareOf: 'P4_Line2a_InCareOf[0]',
  street: 'P4_Line2b_StreetNumberName[0]',
  unitBase: 'P4_Line2c_Unit',
  unitNumber: 'P4_Line2d_AptSteFlrNumber[0]',
  city: 'P4_Line2e_CityOrTown[0]',
  state: 'P4_Line2f_State[0]',
  zip: 'P4_Line2g_ZipCode[0]',
  province: 'P4_Line2h_Province[0]',
  postal: 'P4_Line2i_PostalCode[0]',
  country: 'P4_Line2j_Country[0]'
};

const SPONSOR_PHYSICAL_ADDRESS = {
  street: 'P4_Line4a_StreetNumberName[0]',
  unitBase: 'P4_Line4b_Unit',
  unitNumber: 'P4_Line4c_AptSteFlrNumber[0]',
  city: 'P4_Line4d_CityOrTown[0]',
  state: 'P4_Line4e_State[0]',
  zip: 'P4_Line4f_ZipCode[0]',
  province: 'P4_Line4g_Province[0]',
  postal: 'P4_Line4h_PostalCode[0]',
  country: 'P4_Line4i_Country[0]'
};

function setSponsorBasis(out, answers) {
  const basis = clean(answers.i864_sponsor_basis, 180);
  if (basis.startsWith('1.a.')) setChoice(out, 'P1_Line1a-f_CB', '1A');
  else if (basis.startsWith('1.b.')) setChoice(out, 'P1_Line1a-f_CB', '1B');
  else if (basis.startsWith('1.c.')) setChoice(out, 'P1_Line1a-f_CB', '1C');
  else if (basis.startsWith('1.d.')) setChoice(out, 'P1_Line1a-f_CB', '1D');
  else if (basis.startsWith('1.e.')) setChoice(out, 'P1_Line1a-f_CB', '1E');
  else if (basis.startsWith('1.f.')) setChoice(out, 'P1_Line1a-f_CB', '1F');

  out['P1_Line1b_Relationship[0]'] = clean(answers.i864_employment_petition_relationship, 80);
  out['P1_Line1c_InterestIn[0]'] = clean(answers.i864_ownership_business_name, 100);
  out['P1_Line1c_Relationship[0]'] = clean(answers.i864_ownership_relationship, 80);
  setChoice(out, 'P1_Line1e1_Checkbox', answers.i864_joint_sponsor_number === 'First joint sponsor' ? '1' : (answers.i864_joint_sponsor_number === 'Second joint sponsor' ? '2' : ''));
  out['P1_Line1f_Relationship[0]'] = clean(answers.i864_substitute_sponsor_relationship, 80);
}

function setFamilyMember(out, answers, number) {
  const maps = [
    null,
    { family: 'P3_Line3a_FamilyName[0]', given: 'P3_Line3b_GivenName[0]', middle: 'P3_Line3c_MiddleName[0]', relationship: 'P3_Line4_Relationship[0]', dob: 'P3_Line_DateOfBirth[0]', alien: 'P2_Line5_AlienNumber[1]', online: 'P3_Line7_AcctIdentifier[0]' },
    { family: 'P3_Line8a_FamilyName[0]', given: 'P3_Line8b_GivenName[0]', middle: 'P3_Line8c_MiddleName[0]', relationship: 'P3_Line9_Relationship[0]', dob: 'P3_Line10_DateOfBirth[0]', alien: 'P3_Line11_AlienNumber[0]', online: 'P3_Line12_AcctIdentifier[0]' },
    { family: 'P3_Line13a_FamilyName[0]', given: 'P3_Line13b_GivenName[0]', middle: 'P3_Line13c_MiddleName[0]', relationship: 'P3_Line14_Relationship[0]', dob: 'P3_Line15_DateOfBirth[0]', alien: 'P2_Line5_AlienNumber[2]', online: 'P3_Line17_AcctIdentifier[0]' },
    { family: 'P3_Line18a_FamilyName[0]', given: 'P3_Line18b_GivenName[0]', middle: 'P3_Line18c_MiddleName[0]', relationship: 'P3_Line19_Relationship[0]', dob: 'P3_Line20_DateOfBirth[0]', alien: 'P3_Line21_AlienNumber[0]', online: 'P3_Line22_AcctIdentifier[0]' }
  ];
  const map = maps[number];
  if (!map) return;
  out[map.family] = clean(answers[`i864_family${number}_family_name`], 60);
  out[map.given] = clean(answers[`i864_family${number}_given_name`], 60);
  out[map.middle] = clean(answers[`i864_family${number}_middle_name`], 60);
  out[map.relationship] = clean(answers[`i864_family${number}_relationship`], 60);
  out[map.dob] = dateMdY(answers[`i864_family${number}_date_of_birth`]);
  out[map.alien] = digits(answers[`i864_family${number}_alien_number`], 9);
  out[map.online] = digits(answers[`i864_family${number}_uscis_online_account_number`], 12);
}

function setHouseholdIncomePerson(out, answers, number) {
  const map = [
    null,
    { name: 'P6_Line3_Name[0]', relationship: 'P6_Line4_Relationship[0]', income: 'P6_Line5_CurrentIncome[0]' },
    { name: 'P6_Line6_Name[0]', relationship: 'P6_Line7_Relationship[0]', income: 'P6_Line8_CurrentIncome[0]' },
    { name: 'P6_Line9_Name[0]', relationship: 'P6_Line10_Relationship[0]', income: 'P6_Line11_CurrentIncome[0]' },
    { name: 'P6_Line12_Name[0]', relationship: 'P6_Line13_Relationship[0]', income: 'P6_Line14_CurrentIncome[0]' }
  ][number];
  if (!map) return;
  out[map.name] = clean(answers[`i864_household_income_person${number}_name`], 80);
  out[map.relationship] = clean(answers[`i864_household_income_person${number}_relationship`], 60);
  out[map.income] = amount(answers[`i864_household_income_person${number}_income`]);
}

function setPart11(out, answers) {
  out['P4_Line1a_FamilyName[1]'] = clean(answers.sponsor_family_name, 60);
  out['P4_Line1b_GivenName[1]'] = clean(answers.sponsor_given_name, 60);
  out['P4_Line1c_MiddleName[1]'] = clean(answers.sponsor_middle_name, 60);
  out['P4_Line12_AlienNumber[1]'] = digits(answers.sponsor_alien_number, 9);
  const rows = [];
  if (answers.i864_additional_immigrants_details) rows.push(['4', '4', '4-7', answers.i864_additional_immigrants_details]);
  if (answers.i864_tax_not_filed_explanation) rows.push(['8', '6', '15', answers.i864_tax_not_filed_explanation]);
  if (answers.i864_additional_information) rows.push(['11', '', '', answers.i864_additional_information]);
  rows.slice(0, 4).forEach((row, index) => {
    const line = index + 3;
    out[`P11_Line${line}a_PageNumber[0]`] = row[0];
    out[`P11_Line${line}b_PartNumber[0]`] = row[1];
    out[`P11_Line${line}c_ItemNumber[0]`] = row[2];
    out[`P11_Line${line}d_AdditionalInfo[0]`] = clean(row[3], 900);
  });
}

function i_864FieldValues(payload = {}) {
  const answers = payload.formAnswers || payload.answers || {};
  const contact = payload.contact || {};
  const out = {};

  setSponsorBasis(out, answers);

  out['P2_Line1a_FamilyName[0]'] = clean(answers.principal_immigrant_family_name, 60);
  out['P2_Line1b_GivenName[0]'] = clean(answers.principal_immigrant_given_name, 60);
  out['P2_Line1c_MiddleName[0]'] = clean(answers.principal_immigrant_middle_name, 60);
  setAddress(out, PRINCIPAL_ADDRESS, addressAnswers(answers, 'principal_immigrant_mailing_address', 'principal_immigrant_mailing'));
  out['P2_Line3_CountryCitizenship[0]'] = clean(answers.principal_immigrant_country_of_citizenship || answers.country_of_citizenship, 60);
  out['P2_Line4_DateOfBirth[0]'] = dateMdY(answers.principal_immigrant_date_of_birth || answers.date_of_birth);
  out['P2_Line5_AlienNumber[0]'] = digits(answers.principal_immigrant_alien_number || answers.alien_number, 9);
  out['Pt2_Line6_USCISOnlineAcctNumber[0]'] = digits(answers.principal_immigrant_uscis_online_account_number, 12);
  out['P2_Line7_DaytimePhoneNumber[0]'] = usPhone(answers.principal_immigrant_daytime_phone);

  setYesNo(out, 'P3_Line1_Checkbox', answers.i864_sponsor_principal_immigrant);
  const familyTiming = clean(answers.i864_sponsored_family_timing, 120);
  if (familyTiming.startsWith('At the same time')) out['P3_Line2_SponsoringFamily[0]'] = true;
  if (familyTiming.startsWith('More than')) out['P3_Line2_SponsoringFamily[1]'] = true;
  for (let number = 1; number <= 4; number += 1) setFamilyMember(out, answers, number);
  out['P3_Line28_TotalNumberofImmigrants[0]'] = digits(answers.i864_total_number_of_immigrants, 2);

  out['P4_Line1a_FamilyName[0]'] = clean(answers.sponsor_family_name, 60);
  out['P4_Line1b_GivenName[0]'] = clean(answers.sponsor_given_name, 60);
  out['P4_Line1c_MiddleName[0]'] = clean(answers.sponsor_middle_name, 60);
  setAddress(out, SPONSOR_MAILING_ADDRESS, addressAnswers(answers, 'sponsor_mailing_address', 'sponsor_mailing'));
  setYesNo(out, 'P1_Line3_Checkbox', answers.sponsor_physical_same_as_mailing);
  if (yesNo(answers.sponsor_physical_same_as_mailing) === 'N') {
    setAddress(out, SPONSOR_PHYSICAL_ADDRESS, addressAnswers(answers, 'sponsor_physical_address', 'sponsor_physical'));
  }
  out['P4_Line5_CountryOfDomicile[0]'] = clean(answers.sponsor_country_of_domicile, 60);
  out['P4_Line6_DateOfBirth[0]'] = dateMdY(answers.sponsor_date_of_birth);
  out['P4_Line7_CityofBirth[0]'] = clean(answers.sponsor_country_of_birth, 60);
  out['P4_Line10_SocialSecurityNumber[0]'] = digits(answers.sponsor_ssn || answers.ssn, 9);
  const status = clean(answers.sponsor_status, 80);
  out['P4_Line11a_Checkbox[0]'] = status === 'U.S. citizen';
  out['P4_Line11b_Checkbox[0]'] = status === 'U.S. national';
  out['P4_Line11c_Checkbox[0]'] = status === 'Lawful permanent resident';
  out['P4_Line12_AlienNumber[0]'] = digits(answers.sponsor_alien_number, 9);
  out['P4_Line13_AcctIdentifier[0]'] = digits(answers.sponsor_uscis_online_account_number, 12);
  setYesNo(out, 'P4_Line14_Checkboxes', answers.sponsor_active_duty);

  out['P5_Line2_Yourself[0]'] = '1';
  out['P5_Line3_Married[0]'] = digits(answers.i864_household_spouse_count, 2);
  out['P5_Line4_DependentChildren[0]'] = digits(answers.i864_household_dependent_children_count, 2);
  out['P5_Line5_OtherDependents[0]'] = digits(answers.i864_household_other_dependents_count, 2);
  out['P5_Line6_Sponsors[0]'] = digits(answers.i864_household_other_sponsored_count, 2);
  out['P5_Line7_SameResidence[0]'] = digits(answers.i864_household_same_residence_count, 2);
  out['Override[0]'] = digits(answers.household_size, 2);

  const employment = asSet(answers.sponsor_employment_statuses || answers.sponsor_employment_status);
  out['P6_Line1_Checkbox[0]'] = employment.has('Employed');
  out['P6_Line1a_NameofEmployer[0]'] = clean(answers.sponsor_occupation, 80);
  out['P6_Line1a1_NameofEmployer[0]'] = clean(answers.sponsor_employer_name, 90);
  out['P6_Line1a2_NameofEmployer[0]'] = clean(answers.sponsor_employer2_name, 90);
  out['P6_Line4_Checkbox[0]'] = employment.has('Self-employed');
  out['P6_Line4a_SelfEmployedAs[0]'] = clean(answers.sponsor_self_employed_as, 80);
  out['P6_Line5_Checkbox[0]'] = employment.has('Retired');
  out['P6_Line5a_DateRetired[0]'] = dateMdY(answers.sponsor_retired_since);
  out['P6_Line6_Checkbox[0]'] = employment.has('Unemployed');
  out['P6_Line6a_DateofUnemployment[0]'] = dateMdY(answers.sponsor_unemployed_since);
  out['P6_Line2_TotalIncome[0]'] = amount(answers.current_annual_income);
  for (let number = 1; number <= 4; number += 1) setHouseholdIncomePerson(out, answers, number);
  out['P6_Line15_TotalHouseholdIncome[0]'] = amount(answers.i864_total_household_income);
  out['P6_Line16_CompletedForm[0]'] = yesNo(answers.i864_household_members_completed_i864a) === 'Y';
  out['P6_Line17_NotNeedComplete[0]'] = yesNo(answers.i864_household_member_i864a_not_needed) === 'Y';
  out['P6_Line17_Name[0]'] = clean(answers.i864_household_member_i864a_not_needed_name, 80);
  setYesNo(out, 'P6_Line18a_Checkbox', answers.i864_filed_three_recent_tax_returns);
  out['P6_Line17_IWasNotReq[0]'] = yesNo(answers.i864_not_required_to_file_taxes) === 'Y';
  out['P6_Line19a_TaxYear[0]'] = digits(answers.i864_tax_year1, 4);
  out['P6_Line19a_TotalIncome[0]'] = amount(answers.i864_tax_income1);
  out['P6_Line19b_TaxYear[0]'] = digits(answers.i864_tax_year2, 4);
  out['P6_Line19b_TotalIncome[0]'] = amount(answers.i864_tax_income2);
  out['P6_Line19c_TaxYear[0]'] = digits(answers.i864_tax_year3, 4);
  out['P6_Line19c_TotalIncome[0]'] = amount(answers.i864_tax_income3);

  out['P7_Line1_BalanceofAccounts[0]'] = amount(answers.i864_sponsor_cash_assets);
  out['P7_Line2_RealEstate[0]'] = amount(answers.i864_sponsor_real_estate_assets);
  out['P7_Line3_StocksBonds[0]'] = amount(answers.i864_sponsor_stock_bond_assets);
  out['P7_Line4_Total[0]'] = amount(answers.i864_sponsor_total_assets);
  out['P7_Line5_TotalAssetsHouseholdMembers[0]'] = amount(answers.i864_household_member_total_assets);
  out['P7_Line6_BalanceofAccounts[0]'] = amount(answers.i864_immigrant_cash_assets);
  out['P7_Line7_RealEstate[0]'] = amount(answers.i864_immigrant_real_estate_assets);
  out['P7_Line8_StocksBonds[0]'] = amount(answers.i864_immigrant_stock_bond_assets);
  out['P7_Line9_Total[0]'] = amount(answers.i864_immigrant_total_assets);
  out['P7_Line10_TotalValueAssets[0]'] = amount(answers.i864_total_value_assets);

  const statement = clean(answers.i864_sponsor_statement, 120);
  out['P6_Line1_Checkbox[1]'] = statement.startsWith('I can read');
  out['P6_Line1_Checkbox[2]'] = statement.startsWith('An interpreter');
  out['P8_Line1b_language[0]'] = clean(answers.i864_sponsor_statement_language, 60);
  out['P8_Line2_Checkbox[0]'] = yesNo(answers.has_preparer) === 'Y';
  out['P8_Line2_Attorney[0]'] = [answers.preparer_given_name, answers.preparer_family_name].map((part) => clean(part, 40)).filter(Boolean).join(' ');
  out['P8_Line3_DaytimeTelephoneNumber[0]'] = usPhone(answers.daytime_phone || answers.sponsor_daytime_phone || contact.phone);
  out['P8_Line4_MobileTelephoneNumber[0]'] = usPhone(answers.mobile_phone || answers.sponsor_mobile_phone);
  out['P7Line7_EmailAddress[0]'] = clean(answers.email_address || answers.sponsor_email || contact.email, 100);

  out['P9_Line1a_InterpretersFamilyName[0]'] = clean(answers.interpreter_family_name, 60);
  out['P9_Line1b_InterpretersGivenName[0]'] = clean(answers.interpreter_given_name, 60);
  out['P8Line2_InterpretersBusinessName[0]'] = clean(answers.interpreter_business_name || answers.interpreter_org_name, 100);
  out['P9_Line4_InterpretersDaytimePhoneNumber[0]'] = usPhone(answers.interpreter_daytime_phone);
  out['P9_Line4_InterpretersDaytimePhoneNumber[1]'] = usPhone(answers.interpreter_mobile_phone);
  out['P9_Line5_InterpretersEmailAddress[0]'] = clean(answers.interpreter_email, 100);
  out['P9_Language[0]'] = clean(answers.interpreter_language, 60);

  out['P10_Line1a_PreparersFamilyName[0]'] = clean(answers.preparer_family_name, 60);
  out['P10_Line1b_PreparersGivenName[0]'] = clean(answers.preparer_given_name, 60);
  out['P10_Line2_PreparersBusinessName[0]'] = clean(answers.preparer_business_name, 100);
  out['P10_Line4_PreparersDaytimePhoneNumber[0]'] = usPhone(answers.preparer_daytime_phone);
  out['P10_Line5_PreparersFaxNumber[0]'] = usPhone(answers.preparer_mobile_phone);
  out['P10_Line6_PreparersEmailAddress[0]'] = clean(answers.preparer_email, 100);

  setPart11(out, answers);

  return Object.fromEntries(Object.entries(out).filter(([fieldName, value]) => (
    !/Signature|DateofSignature/i.test(fieldName)
    && (value === true || (value !== false && value !== undefined && value !== null && value !== ''))
  )));
}

module.exports = { i_864FieldValues };
