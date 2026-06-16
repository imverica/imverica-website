'use strict';

function clean(value, max = 300) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function digits(value, max = 30) {
  return clean(value, Math.max(80, max * 4)).replace(/\D/g, '').slice(0, max);
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
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return digits(`${value.areaCode || ''}${value.number || ''}`, 10);
  }
  const result = digits(value, 20);
  if (result.length === 11 && result.startsWith('1')) return result.slice(1);
  return result.length > 10 ? result.slice(-10) : result;
}

function phoneParts(value) {
  const result = usPhone(value);
  return { area: result.slice(0, 3), number: result.slice(3) };
}

function yesNo(value) {
  const text = clean(value, 40).toLowerCase();
  if (['yes', 'true', 'да', 'так'].includes(text)) return true;
  if (['no', 'false', 'нет', 'ні'].includes(text)) return false;
  return null;
}

function yesNoFields(value, yesField, noField) {
  const answer = yesNo(value);
  if (answer === true) return { [yesField]: true, [noField]: false };
  if (answer === false) return { [yesField]: false, [noField]: true };
  return {};
}

function setSex(target, value, maleField, femaleField) {
  const text = clean(value, 40).toLowerCase();
  if (/^m|male|муж/.test(text)) {
    target[maleField] = true;
    target[femaleField] = false;
  } else if (/^f|female|жен|жін/.test(text)) {
    target[maleField] = false;
    target[femaleField] = true;
  }
}

function setApplicantMarital(target, value) {
  const text = clean(value, 80).toLowerCase();
  const fields = ['Marital[0]', 'Marital[1]', 'Marital[2]', 'Marital[3]'];
  fields.forEach(fieldName => { target[fieldName] = false; });
  if (/single|never/.test(text)) target['Marital[0]'] = true;
  else if (/married/.test(text)) target['Marital[1]'] = true;
  else if (/divorc/.test(text)) target['Marital[2]'] = true;
  else if (/widow/.test(text)) target['Marital[3]'] = true;
}

function addressAnswers(answers, root, prefix) {
  const block = answers[root] && typeof answers[root] === 'object' ? answers[root] : {};
  return {
    line1: block.line1 || answers[`${prefix}_address_line1`] || '',
    line2: block.line2 || answers[`${prefix}_address_line2`] || '',
    city: block.city || answers[`${prefix}_city`] || '',
    state: block.state || answers[`${prefix}_state`] || '',
    zip: block.zip || answers[`${prefix}_zip`] || '',
    country: block.country || answers[`${prefix}_country`] || ''
  };
}

function unitNumber(value) {
  return clean(value, 20).replace(/^(?:apt|apartment|ste|suite|fl|floor|unit|#)\s*\.?\s*/i, '').slice(0, 10);
}

function setCourtProceedings(target, value) {
  const text = clean(value, 180).toLowerCase();
  target['CheckBox3[0]'] = /never/.test(text);
  target['CheckBox3[2]'] = /now in/.test(text);
  target['CheckBox3[1]'] = /not now/.test(text) && /past/.test(text);
}

function setBasis(target, selected) {
  const values = new Set((Array.isArray(selected) ? selected : [selected]).map(value => clean(value, 100).toLowerCase()));
  const has = pattern => [...values].some(value => pattern.test(value));
  target['CheckBoxrace[0]'] = has(/^race$/);
  target['CheckBoxreligion[0]'] = has(/^religion$/);
  target['CheckBoxnationality[0]'] = has(/^nationality$/);
  target['CheckBoxpolitics[0]'] = has(/political/);
  target['CheckBoxsocial[0]'] = has(/social group/);
  target['CheckBoxtorture[0]'] = has(/torture/);
  target['CheckBox31[0]'] = has(/torture/);
}

function setChild(target, answers, number) {
  const suffix = number === 1 ? '' : String(number);
  const sexPrefix = number === 1 ? 'CheckBox12_Sex' : `CheckBox${number}6_Sex`;
  const locationPrefix = number === 1 ? 'CheckBox17' : `CheckBox${number}7`;
  const lastEntryDate = number === 1 ? 'PtAIILine15_ExpirationDate[0]' : `PtAIILine15_DateofLastEntry${number}[0]`;
  const currentStatus = number === 1 ? 'PtAIILine18_CurrentStatusofChild[0]' : `PtAIILine18_ChildCurrentStatus${number}[0]`;
  const familyName = clean(answers[`child${number}_family_name`], 60);
  if (!familyName) return;

  target[`ChildAlien${number}[0]`] = digits(answers[`child${number}_alien_number`], 9);
  target[`ChildPassport${number}[0]`] = clean(answers[`child${number}_passport_number`], 30);
  target[`ChildMarital${number}[0]`] = clean(answers[`child${number}_marital_status`], 30);
  target[`ChildSSN${number}[0]`] = digits(answers[`child${number}_ssn`], 9);
  target[`ChildLast${number}[0]`] = familyName;
  target[`ChildFirst${number}[0]`] = clean(answers[`child${number}_given_name`], 60);
  target[`ChildMiddle${number}[0]`] = clean(answers[`child${number}_middle_name`], 60);
  target[`ChildDOB${number}[0]`] = dateMdY(answers[`child${number}_dob`]);
  target[`ChildCity${number}[0]`] = [
    clean(answers[`child${number}_city_of_birth`], 50),
    clean(answers[`child${number}_country_of_birth`], 50)
  ].filter(Boolean).join(', ');
  target[`ChildNat${number}[0]`] = clean(answers[`child${number}_country_of_citizenship`], 60);
  target[`ChildRace${number}[0]`] = clean(answers[`child${number}_ethnic_or_tribal_group`], 80);
  setSex(target, answers[`child${number}_sex`], `${sexPrefix}[0]`, `${sexPrefix}[1]`);
  Object.assign(target, yesNoFields(answers[`child${number}_in_us`], `${locationPrefix}[0]`, `${locationPrefix}[1]`));
  target[`PtAIILine13_Specify${suffix}[0]`] = clean(answers[`child${number}_outside_us_location`], 80);
  target[`PtAIILine14_PlaceofLastEntry${suffix}[0]`] = clean(answers[`child${number}_place_entry`], 80);
  target[lastEntryDate] = dateMdY(answers[`child${number}_date_last_entered_us`]);
  target[`PtAIILine16_I94Number${suffix}[0]`] = clean(answers[`child${number}_i94_number`], 20);
  target[`PtAIILine17_StatusofLastAdmission${suffix}[0]`] = clean(answers[`child${number}_status_last_admitted`], 80);
  target[currentStatus] = clean(answers[`child${number}_current_status`], 80);
  target[`PtAIILine19_ExpDateofAuthorizedStay${suffix}[0]`] = dateMdY(answers[`child${number}_authorized_stay_expires`]);
  Object.assign(target, yesNoFields(answers[`child${number}_in_immigration_court`], `PtAIILine20_Yes${suffix}[0]`, `PtAIILine20_No${suffix}[0]`));
  Object.assign(target, yesNoFields(answers[`child${number}_included`], `PtAIILine21_Yes${suffix}[0]`, `PtAIILine21_No${suffix}[0]`));
}

function i_589FieldValues(payload = {}) {
  const answers = payload.formAnswers || payload.answers || {};
  const contact = payload.contact || {};
  const values = {};
  const residential = addressAnswers(answers, 'i589_residential_address', 'i589_residential');
  const mailing = addressAnswers(answers, 'mailing_address', 'mailing');
  const preparer = addressAnswers(answers, 'i589_preparer_address', 'i589_preparer');
  const applicantPhone = phoneParts(answers.daytime_phone || answers.phone || contact.phone);
  const preparerPhone = phoneParts(answers.preparer_daytime_phone);

  values['PtAILine1_ANumber[0]'] = digits(answers.alien_number || answers.a_number, 9);
  values['PtAILine1_ANumber[1]'] = digits(answers.alien_number || answers.a_number, 9);
  values['TextField1[0]'] = digits(answers.ssn || answers.social_security_number, 9);
  values['TextField1[8]'] = digits(answers.uscis_online_account_number, 12);
  values['PtAILine4_LastName[0]'] = clean(answers.applicant_family_name || answers.family_name, 60);
  values['PtAILine5_FirstName[0]'] = clean(answers.applicant_given_name || answers.given_name, 60);
  values['PtAILine6_MiddleName[0]'] = clean(answers.applicant_middle_name || answers.middle_name, 60);
  values['TextField1[1]'] = clean(answers.other_names_used, 160);
  values['PtAILine8_StreetNumandName[0]'] = clean(residential.line1, 80);
  values['PtAILine8_AptNumber[0]'] = unitNumber(residential.line2);
  values['TextField1[2]'] = clean(residential.city, 60);
  values['PtAILine8_State[0]'] = stateCode(residential.state);
  values['PtAILine8_Zipcode[0]'] = digits(residential.zip, 5);
  values['PtAILine8_AreaCode[0]'] = applicantPhone.area;
  values['PtAILine8_TelephoneNumber[0]'] = applicantPhone.number;

  if (yesNo(answers.physical_same_as_mailing) === false) {
    values['PtAILine9_InCareOf[0]'] = clean(answers.mailing_in_care_of, 80);
    values['PtAILine9_StreetNumandName[0]'] = clean(mailing.line1, 80);
    values['PtAILine9_AptNumber[0]'] = unitNumber(mailing.line2);
    values['PtAILine9_City[0]'] = clean(mailing.city, 60);
    values['PtAILine9_State[0]'] = stateCode(mailing.state);
    values['PtAILine9_ZipCode[0]'] = digits(mailing.zip, 5);
    values['PtAILine9_AreaCode[0]'] = applicantPhone.area;
    values['PtAILine9_TelephoneNumbe[0]'] = applicantPhone.number;
  }

  setSex(values, answers.sex || answers.gender, 'PartALine9Sex[0]', 'PartALine9Sex[1]');
  setApplicantMarital(values, answers.marital_status);
  values['DateTimeField1[0]'] = dateMdY(answers.date_of_birth || answers.dob);
  values['TextField1[4]'] = [clean(answers.city_of_birth, 50), clean(answers.country_of_birth, 50)].filter(Boolean).join(', ');
  values['TextField1[3]'] = clean(answers.country_of_citizenship, 60);
  values['TextField1[5]'] = clean(answers.i589_nationality_at_birth, 60);
  values['TextField1[6]'] = clean(answers.i589_ethnic_or_tribal_group, 80);
  values['TextField1[7]'] = clean(answers.i589_religion, 80);
  setCourtProceedings(values, answers.i589_court_proceedings);

  values['DateTimeField6[0]'] = dateMdY(answers.i589_date_last_left_country);
  values['TextField3[0]'] = clean(answers.i94_number, 20);
  values['DateTimeField2[0]'] = dateMdY(answers.date_last_entered_us || answers.last_arrival_date);
  values['TextField4[0]'] = clean(answers.place_entry, 80);
  values['TextField4[1]'] = clean(answers.current_immigration_status, 80);
  values['DateTimeField2[1]'] = dateMdY(answers.authorized_stay_expires);
  values['DateTimeField3[0]'] = dateMdY(answers.i589_entry2_date);
  values['TextField4[2]'] = clean(answers.i589_entry2_place, 80);
  values['TextField4[3]'] = clean(answers.i589_entry2_status, 80);
  values['DateTimeField4[0]'] = dateMdY(answers.i589_entry3_date);
  values['TextField4[4]'] = clean(answers.i589_entry3_place, 80);
  values['TextField4[5]'] = clean(answers.i589_entry3_status, 80);
  values['TextField5[0]'] = clean(answers.passport_country_of_issuance, 60);
  values['TextField5[1]'] = clean(answers.passport_number, 30);
  values['TextField5[2]'] = clean(answers.i589_travel_document_number, 30);
  values['DateTimeField2[2]'] = dateMdY(answers.passport_expiration);
  values['TextField7[0]'] = clean(answers.i589_native_language, 80);
  Object.assign(values, yesNoFields(answers.i589_fluent_in_english, 'CheckBox4[0]', 'CheckBox4[1]'));
  values['TextField7[1]'] = clean(answers.i589_other_fluent_languages, 120);

  const married = clean(answers.marital_status, 40).toLowerCase() === 'married';
  values['CheckBox5[0]'] = !married;
  if (married) {
    values['TextField10[1]'] = clean(answers.spouse_passport_number, 30);
    values['TextField10[2]'] = digits(answers.spouse_ssn, 9);
    values['PtAIILine5_LastName[0]'] = clean(answers.spouse_family_name, 60);
    values['PtAIILine6_FirstName[0]'] = clean(answers.spouse_given_name, 60);
    values['PtAIILine7_MiddleName[0]'] = clean(answers.spouse_middle_name, 60);
    values['TextField10[3]'] = clean(answers.spouse_other_names_used, 100);
    values['DateTimeField7[0]'] = dateMdY(answers.spouse_date_of_birth);
    values['DateTimeField8[0]'] = dateMdY(answers.spouse_date_of_marriage);
    values['TextField10[4]'] = clean(answers.spouse_place_of_marriage, 100);
    values['TextField10[5]'] = [clean(answers.spouse_city_of_birth, 50), clean(answers.spouse_country_of_birth, 50)].filter(Boolean).join(', ');
    values['TextField10[0]'] = clean(answers.spouse_country_of_citizenship, 60);
    values['TextField10[6]'] = clean(answers.spouse_ethnic_or_tribal_group, 80);
    setSex(values, answers.spouse_sex, 'CheckBox14_Sex[0]', 'CheckBox14_Sex[1]');
    Object.assign(values, yesNoFields(answers.i589_spouse_in_us, 'PtAIILine15_CheckBox15[1]', 'PtAIILine15_CheckBox15[0]'));
    values['PtAIILine15_Specify[0]'] = clean(answers.i589_spouse_outside_us_location, 80);
    values['PtAIILine16_PlaceofLastEntry[0]'] = clean(answers.spouse_place_entry, 80);
    values['PtAIILine17_DateofLastEntry[0]'] = dateMdY(answers.spouse_date_last_entered_us);
    values['PtAIILine18_I94Number[0]'] = clean(answers.spouse_i94_number, 20);
    values['PtAIILine19_StatusofLastAdmission[0]'] = clean(answers.spouse_status_last_admitted, 80);
    values['PtAIILine20_SpouseCurrentStatus[0]'] = clean(answers.spouse_current_status, 80);
    values['PtAIILine21_ExpDateofAuthorizedStay[0]'] = dateMdY(answers.spouse_authorized_stay_expires);
    Object.assign(values, yesNoFields(answers.spouse_in_immigration_court, 'PtAIILine22_Yes[0]', 'PtAIILine22_No[0]'));
    Object.assign(values, yesNoFields(answers.i589_spouse_included, 'PtAIILine24_Yes[0]', 'PtAIILine24_No[0]'));
  }

  const totalChildren = Math.max(0, Number(answers.total_children || 0));
  values['ChildrenCheckbox[0]'] = totalChildren > 0;
  values['ChildrenCheckbox[1]'] = totalChildren === 0;
  values['TotalChild[0]'] = String(totalChildren);
  for (let number = 1; number <= Math.min(totalChildren, 4); number += 1) setChild(values, answers, number);

  setBasis(values, answers.asylum_basis);
  Object.assign(values, yesNoFields(answers.i589_past_harm_yes_no, 'ckboxyn1a[0]', 'ckboxyn1a[1]'));
  values['TextField14[0]'] = clean(answers.i589_past_harm_details, 1800);
  Object.assign(values, yesNoFields(answers.i589_future_harm_yes_no, 'ckboxyn1b[0]', 'ckboxyn1b[1]'));
  values['TextField15[0]'] = clean(answers.i589_future_harm_details, 1800);
  Object.assign(values, yesNoFields(answers.i589_foreign_accusation_yes_no, 'ckboxyn2[0]', 'ckboxyn2[1]'));
  values['PBL2_TextField[0]'] = clean(answers.i589_foreign_accusation_details, 1800);
  Object.assign(values, yesNoFields(answers.i589_organization_membership_yes_no, 'ckboxyn3a[0]', 'ckboxyn3a[1]'));
  values['PBL3A_TextField[0]'] = clean(answers.i589_organization_membership_details, 1800);
  Object.assign(values, yesNoFields(answers.i589_current_organization_participation_yes_no, 'ckboxyn3b[0]', 'ckboxyn3b[1]'));
  values['PBL3B_TextField[0]'] = clean(answers.i589_current_organization_participation_details, 1800);
  Object.assign(values, yesNoFields(answers.i589_torture_fear_yes_no, 'ckboxyn4[0]', 'ckboxyn4[1]'));
  values['PB4_TextField[0]'] = clean(answers.i589_torture_fear_details, 1800);

  Object.assign(values, yesNoFields(answers.i589_prior_asylum_application, 'ckboxync1[0]', 'ckboxync1[1]'));
  values['PCL1_TextField[0]'] = clean(answers.i589_prior_asylum_details, 1800);
  Object.assign(values, yesNoFields(answers.i589_traveled_through_other_country, 'ckboxync2a[0]', 'ckboxync2a[1]'));
  Object.assign(values, yesNoFields(answers.i589_other_country_lawful_status, 'ckboxync2b[0]', 'ckboxync2b[1]'));
  values['PCL2B_TextField[0]'] = clean(answers.i589_third_country_details, 1800);
  Object.assign(values, yesNoFields(answers.i589_participated_in_persecution, 'ckboxync3[0]', 'ckboxync3[1]'));
  values['PCL3_TextField[0]'] = clean(answers.i589_participated_in_persecution_details, 1800);
  Object.assign(values, yesNoFields(answers.i589_returned_to_feared_country, 'PCckboxyn4[0]', 'PCckboxyn4[1]'));
  values['PCL4_TextField[0]'] = clean(answers.i589_returned_to_feared_country_details, 1800);
  Object.assign(values, yesNoFields(answers.i589_filing_more_than_one_year_after_arrival, 'ckboxync5[0]', 'ckboxync5[1]'));
  values['PCL5_TextField[0]'] = clean(answers.i589_one_year_explanation, 1800);
  Object.assign(values, yesNoFields(answers.i589_us_crime_or_arrest, 'ckboxync6[0]', 'ckboxync6[1]'));
  values['PCL6_TextField[0]'] = clean(answers.i589_us_crime_or_arrest_details, 1800);

  const fullName = clean(`${answers.applicant_given_name || ''} ${answers.applicant_middle_name || ''} ${answers.applicant_family_name || ''}`, 120);
  values['TextField20[0]'] = fullName || clean(contact.name, 120);
  values['TextField20[1]'] = clean(answers.i589_name_native_alphabet, 120);
  Object.assign(values, yesNoFields(answers.i589_family_assisted, 'PtD_ckboxynd1[0]', 'PtD_ckboxynd1[1]'));
  const familyHelpers = clean(answers.i589_family_assistance_details, 300).split(/\s*(?:;|\n)\s*/).filter(Boolean);
  values['PtD_ChildName1[0]'] = clean(familyHelpers[0], 100);
  values['PtD_ChildName2[0]'] = clean(familyHelpers[1], 100);
  Object.assign(values, yesNoFields(answers.has_preparer, 'ckboxynd2[0]', 'ckboxynd2[1]'));
  Object.assign(values, yesNoFields(answers.i589_received_low_cost_legal_list, 'ckboxynd3[0]', 'ckboxynd3[1]'));

  if (yesNo(answers.has_preparer) === true) {
    values['PtE_PreparerName[0]'] = clean(`${answers.preparer_given_name || ''} ${answers.preparer_family_name || ''}`, 120);
    values['PtE_StreetNumAndName[0]'] = clean(preparer.line1, 80);
    values['PtE_AptNumber[0]'] = unitNumber(preparer.line2);
    values['PtE_City[0]'] = clean(preparer.city, 60);
    values['PtE_State[0]'] = stateCode(preparer.state);
    values['PtE_ZipCode[0]'] = digits(preparer.zip, 10);
    values['TextField25[1]'] = preparerPhone.area;
    values['TextField25[0]'] = preparerPhone.number;
  }

  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

module.exports = { i_589FieldValues };
