'use strict';

const inventory = require('../pdf-maps/uscis/i-751.json');
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

function setMailingAddress(out, address) {
  out['Line17a_InCareofName[0]'] = clean(address.inCareOf, 80);
  out['Line17b_Street_Number_Name[0]'] = clean(address.line1, 80);
  out['Line17c_Apt_Ste_Flr_Number[0]'] = unitNumber(address.line2);
  Object.assign(out, unitRadio('Line17c_Unit', address.line2));
  out['Line17d_City_Town[0]'] = clean(address.city, 60);
  if (isUS(address.country)) {
    out['Pt1Line15e_State[0]'] = stateCode(address.state);
    out['Pt1Line15f_ZipCode[0]'] = digits(address.zip, 9);
  }
}

function setStandardAddress(out, prefix, address) {
  out[`${prefix}_StreetNumberName[0]`] = clean(address.line1, 80);
  out[`${prefix}_AptSteFlrNumber[0]`] = unitNumber(address.line2);
  Object.assign(out, unitRadio(`${prefix}_Unit`, address.line2));
  out[`${prefix}_CityOrTown[0]`] = clean(address.city, 60);
  if (isUS(address.country)) {
    out[`${prefix}_State[0]`] = stateCode(address.state);
    out[`${prefix}_ZipCode[0]`] = digits(address.zip, 9);
  } else {
    out[`${prefix}_Province[0]`] = clean(address.state, 40);
    out[`${prefix}_PostalCode[0]`] = clean(address.zip, 20);
    out[`${prefix}_Country[0]`] = clean(address.country, 60);
  }
}

function setInterpreterAddress(out, address) {
  out['P6_Line3a_StreetNumberName[0]'] = clean(address.line1, 80);
  out['Pt9Line3_AptSteFlrNumber[0]'] = unitNumber(address.line2);
  Object.assign(out, unitRadio('Pt9Line3_Unit', address.line2));
  out['Pt9Line3_CityOrTown[0]'] = clean(address.city, 60);
  if (isUS(address.country)) {
    out['Pt9Line3_State[0]'] = stateCode(address.state);
    out['Pt9Line3_ZipCode[0]'] = digits(address.zip, 9);
  } else {
    out['Pt9Line3_Province[0]'] = clean(address.state, 40);
    out['Pt9Line3_PostalCode[0]'] = clean(address.zip, 20);
    out['Pt9Line3_Country[0]'] = clean(address.country, 60);
  }
}

function setPreparerAddress(out, address) {
  out['Pt9Line3_StreetNumberName[0]'] = clean(address.line1, 80);
  out['Pt10Line3_AptSteFlrNumber[0]'] = unitNumber(address.line2);
  Object.assign(out, unitRadio('Pt10Line3_Unit', address.line2));
  out['P7_Line3c_CityTown[0]'] = clean(address.city, 60);
  if (isUS(address.country)) {
    out['P7_Line3d_State[0]'] = stateCode(address.state);
    out['P7_Line3e_ZipCode[0]'] = digits(address.zip, 9);
  } else {
    out['P7_Line3f_Province[0]'] = clean(address.state, 40);
    out['P7_Line3g_PostalCode[0]'] = clean(address.zip, 20);
    out['P7_Line3h_Country[0]'] = clean(address.country, 60);
  }
}

function setPart3Basis(out, answers) {
  const type = clean(answers.i751_filing_type, 100);
  setChoice(out, 'Pt3Line1', type === 'Joint petition with my spouse' ? 'A' : (type === "Joint petition with my parent's spouse" ? 'B' : ''));
  const waivers = new Set(Array.isArray(answers.i751_waiver_bases) ? answers.i751_waiver_bases : []);
  out['Pt3Line1c[0]'] = waivers.has('My spouse is deceased');
  out['Pt3Line1d[0]'] = waivers.has('Good-faith marriage ended by divorce or annulment');
  out['Pt3Line1e[0]'] = waivers.has('Good-faith marriage and battery or extreme cruelty by spouse');
  out['Pt3Line1f[0]'] = waivers.has("Parent's good-faith marriage and battery or extreme cruelty by parent, parent's spouse, or both");
  out['Pt3Line1g[0]'] = waivers.has('Termination of status and removal would result in extreme hardship');
}

function setChild(out, answers, number) {
  if (Number(answers.total_children || 0) < number) return;
  const index = number - 2;
  const nameMap = number === 1
    ? { family: 'Line1a_FamilyName3[0]', given: 'Line1b_GivenName3[0]', middle: 'Line1c_MiddleName3[0]', dob: 'Line2_DateOfBirth2[0]', alien: 'Line3_AlienNumber[0]', lives: 'Part5Line5', applies: 'Part5Line6', address: 'Pt5Line6' }
    : { family: `Line13a_FamilyName[${index}]`, given: `Line13b_GivenName[${index}]`, middle: `Line13c_MiddleName[${index}]`, dob: `Line14_DateOfBirth[${index}]`, alien: `Line15_AlienNumber[${index}]`, lives: `Part5Line${6 * number - 1}`, applies: `Part5Line${6 * number}`, address: `Pt5Line${6 * number}` };
  out[nameMap.family] = clean(answers[`i751_child${number}_family_name`], 60);
  out[nameMap.given] = clean(answers[`i751_child${number}_given_name`], 60);
  out[nameMap.middle] = clean(answers[`i751_child${number}_middle_name`], 60);
  out[nameMap.dob] = dateMdY(answers[`i751_child${number}_dob`]);
  out[nameMap.alien] = digits(answers[`i751_child${number}_alien_number`], 9);
  setYesNo(out, nameMap.lives, answers[`i751_child${number}_lives_with_you`]);
  setYesNo(out, nameMap.applies, answers[`i751_child${number}_applying_with_you`]);
  setStandardAddress(out, nameMap.address, addressAnswers(answers, `i751_child${number}_address`, `i751_child${number}`));
}

function setAdditional(out, answers) {
  out['Pt1Line1a_FamilyName[1]'] = clean(answers.applicant_family_name, 60);
  out['Pt1Line1b_GivenName[1]'] = clean(answers.applicant_given_name, 60);
  out['Pt1Line1c_MiddleName[1]'] = clean(answers.applicant_middle_name, 60);
  out['P1_Line7_AlienNumber[1]'] = digits(answers.alien_number, 9);
  const rows = [];
  if (answers.i751_removal_details) rows.push(['2', '1', '18', answers.i751_removal_details]);
  if (answers.i751_nonattorney_fee_details) rows.push(['2', '1', '19', answers.i751_nonattorney_fee_details]);
  if (answers.i751_criminal_history_details) rows.push(['2', '1', '20', answers.i751_criminal_history_details]);
  if (Array.isArray(answers.residence_history) && answers.residence_history.length) {
    const text = answers.residence_history.map((row) => [row.line1, row.line2, row.city, row.state, row.zip, row.country, row.from && row.to ? `${row.from} - ${row.to}` : ''].filter(Boolean).join(', ')).join('; ');
    rows.push(['2', '1', '22', text]);
  }
  if (answers.i751_additional_children) rows.push(['3-5', '5', '31+', answers.i751_additional_children]);
  if (answers.i751_additional_information) rows.push(['11', '', '', answers.i751_additional_information]);
  rows.slice(0, 5).forEach((row, index) => {
    const line = index + 3;
    out[`P8_Line${line}a_PageNumber[0]`] = row[0];
    out[`P8_Line${line}b_PartNumber[0]`] = row[1];
    out[`P8_Line${line}c_ItemNumber[0]`] = row[2];
    out[`P8_Line${line}d_AdditionalInfo[0]`] = clean(row[3], 950);
  });
}

function i_751FieldValues(payload = {}) {
  const answers = payload.formAnswers || payload.answers || {};
  const contact = payload.contact || {};
  const out = {};

  out['Pt1Line1a_FamilyName[0]'] = clean(answers.applicant_family_name, 60);
  out['Pt1Line1b_GivenName[0]'] = clean(answers.applicant_given_name, 60);
  out['Pt1Line1c_MiddleName[0]'] = clean(answers.applicant_middle_name, 60);
  out['P1_Line2a_FamilyName[0]'] = clean(answers.i751_other_name1_family, 60);
  out['P1_Line2b_GivenName[0]'] = clean(answers.i751_other_name1_given, 60);
  out['P1_Line2c_MiddleName[0]'] = clean(answers.i751_other_name1_middle, 60);
  out['P1_Line3a_FamilyName[0]'] = clean(answers.i751_other_name2_family, 60);
  out['P1_Line3b_GivenName[0]'] = clean(answers.i751_other_name2_given, 60);
  out['P1_Line3c_MiddleName[0]'] = clean(answers.i751_other_name2_middle, 60);
  out['P1_Line4_DateOfBirth[0]'] = dateMdY(answers.date_of_birth);
  out['P1_Line5_CountryOfBirth[0]'] = clean(answers.country_of_birth, 60);
  out['P1_Line6_CountryOfCitizenship[0]'] = clean(answers.country_of_citizenship, 80);
  out['P1_Line7_AlienNumber[0]'] = digits(answers.alien_number, 9);
  out['P1_Line8_SSN[0]'] = digits(answers.ssn, 9);
  out['P1_Line9_AcctIdentifier[0]'] = digits(answers.uscis_online_account_number, 12);
  const maritalStates = { Married: 'M', Widowed: 'W', Single: 'S', Divorced: 'D' };
  setChoice(out, 'Part1_Line10_MaritalStatus', maritalStates[answers.marriage_status_now]);
  out['P1_Line11_DateOfMarriage[0]'] = dateMdY(answers.current_marriage_date);
  out['P1_Line12_PlaceOfMarriage[0]'] = clean(answers.i751_place_of_marriage, 120);
  out['P1_Line13_DateMarriageEnded[0]'] = dateMdY(answers.i751_marriage_end_date);
  out['P1_Line14_CRExpiresOn[0]'] = dateMdY(answers.conditional_green_card_expiration);

  setMailingAddress(out, addressAnswers(answers, 'mailing_address', 'mailing'));
  const physicalDifferent = yesNo(answers.physical_same_as_mailing) === 'N';
  setYesNo(out, 'Line16_Checkbox', physicalDifferent ? 'Yes' : 'No');
  if (physicalDifferent) setStandardAddress(out, 'Pt1Line17', addressAnswers(answers, 'physical_address', 'physical'));
  setYesNo(out, 'Line17_Checkbox', answers.i751_in_removal_proceedings);
  setYesNo(out, 'Line18_Checkbox', answers.i751_nonattorney_fee_paid);
  setYesNo(out, 'Line19_Checkbox', answers.i751_criminal_history);
  setYesNo(out, 'Line20_Checkbox', answers.i751_different_current_marriage);
  setYesNo(out, 'Line21_Checkbox', answers.i751_other_residences_since_lpr);
  setYesNo(out, 'Line22_Checkbox', answers.i751_spouse_government_abroad);

  setChoice(out, 'P3_checkbox6', answers.i751_ethnicity === 'Hispanic or Latino' ? 'H' : (answers.i751_ethnicity ? 'N' : ''));
  const races = new Set(Array.isArray(answers.i751_race) ? answers.i751_race : []);
  out['P3_checkbox7_White[0]'] = races.has('White');
  out['P3_checkbox7_Asian[0]'] = races.has('Asian');
  out['P3_checkbox7_Black[0]'] = races.has('Black or African American');
  out['P3_checkbox7_Indian[0]'] = races.has('American Indian or Alaska Native');
  out['P3_checkbox7_Hawaiian[0]'] = races.has('Native Hawaiian or Other Pacific Islander');
  out['P3_Line8_HeightFeet[0]'] = clean(answers.i751_height_feet, 1);
  out['P3_Line8_HeightInches[0]'] = clean(answers.i751_height_inches, 2);
  const weight = digits(answers.i751_weight_pounds, 3).padStart(3, '0');
  if (digits(answers.i751_weight_pounds, 3)) {
    out['P3_Line9_HeightInches1[0]'] = weight[0];
    out['P3_Line9_HeightInches2[0]'] = weight[1];
    out['P3_Line9_HeightInches3[0]'] = weight[2];
  }
  const eyeStates = { Black: 'BLK', Blue: 'BLU', Brown: 'BRO', Gray: 'GRY', Green: 'GRN', Hazel: 'HAZ', Maroon: 'MAR', Pink: 'PNK', 'Unknown/Other': 'UNK' };
  const hairStates = { 'Bald (No hair)': 'BAL', Black: 'BLK', Blond: 'BLN', Brown: 'BRO', Gray: 'GRY', Red: 'RED', Sandy: 'SDY', White: 'WHI', 'Unknown/Other': 'UNK' };
  setChoice(out, 'P3_checkbox10', eyeStates[answers.i751_eye_color]);
  setChoice(out, 'P3_checkbox11', hairStates[answers.i751_hair_color]);

  setPart3Basis(out, answers);
  setChoice(out, 'Part4_Relationship', answers.i751_part4_relationship === 'Spouse or former spouse' ? 'A' : (answers.i751_part4_relationship ? 'B' : ''));
  out['Pt4Line2a_FamilyName2[0]'] = clean(answers.spouse_family_name, 60);
  out['Pt4Line2b_GivenName2[0]'] = clean(answers.spouse_given_name, 60);
  out['Pt4Line2c_MiddleName2[0]'] = clean(answers.spouse_middle_name, 60);
  out['Line3_DateOfBirth[0]'] = dateMdY(answers.spouse_date_of_birth);
  out['Line4_SSN[0]'] = digits(answers.spouse_ssn, 9);
  out['Line5_AlienNumber[0]'] = digits(answers.spouse_alien_number, 9);
  setStandardAddress(out, 'Pt4Line6', addressAnswers(answers, 'i751_spouse_address', 'i751_spouse'));

  for (let number = 1; number <= 5; number += 1) setChild(out, answers, number);

  setYesNo(out, 'Part6Line1', answers.i751_accommodation_for_self);
  setYesNo(out, 'Part6Line2', answers.i751_accommodation_for_spouse);
  setYesNo(out, 'Part6Line3', answers.i751_accommodation_for_children);
  const accommodations = new Set(Array.isArray(answers.i751_accommodation_types) ? answers.i751_accommodation_types : []);
  out['Pt6Line4a_chbx[0]'] = accommodations.has('Deaf or hard of hearing');
  out['Pt6Line4b_chbx[0]'] = accommodations.has('Blind or low vision');
  out['Pt6Line4c_chbx[0]'] = accommodations.has('Other disability or impairment');
  out['Pt6Line4_DeafOrHardOfHearing[0]'] = clean(answers.i751_deaf_accommodation, 160);
  out['Pt6Line4_BlindOrSightImpaired[0]'] = clean(answers.i751_visual_accommodation, 160);
  out['Pt6Line4_AccomodationRequested[0]'] = clean(answers.i751_other_accommodation, 320);

  setChoice(out, 'P5_Checkbox1', answers.i751_applicant_statement === 'An interpreter read every question and answer to me' ? 'B' : (answers.i751_applicant_statement ? 'A' : ''));
  out['Pt5Line1b_Language[0]'] = clean(answers.i751_applicant_statement_language, 60);
  out['P5_Line2_NameofRepresentative[0]'] = clean(answers.i751_preparer_name_for_statement, 80);
  out['P5_Line3_DaytimePhoneNumber[0]'] = usPhone(answers.daytime_phone || contact.phone);
  out['P5_Line4_MobilePhoneNumber[0]'] = usPhone(answers.mobile_phone);
  out['P5_Line5_EmailAddress[0]'] = clean(answers.email_address || contact.email, 100);
  setChoice(out, 'P8_Checkbox1', answers.i751_spouse_statement === 'An interpreter read every question and answer to me' ? 'B' : (answers.i751_spouse_statement ? 'A' : ''));
  out['Pt7Line1b_Language[0]'] = clean(answers.i751_spouse_statement_language, 60);
  out['P5_Line3_DaytimePhoneNumber[1]'] = usPhone(answers.i751_spouse_daytime_phone);
  out['P5_Line4_MobilePhoneNumber[1]'] = usPhone(answers.i751_spouse_mobile_phone);
  out['P5_Line5_EmailAddress[1]'] = clean(answers.i751_spouse_email, 100);

  out['P6_Line1a_InterpretersFamilyName[0]'] = clean(answers.interpreter_family_name, 60);
  out['P6_Line1b_InterpretersGivenName[0]'] = clean(answers.interpreter_given_name, 60);
  out['P6_Line2_NameofBusinessor[0]'] = clean(answers.interpreter_business_name, 100);
  setInterpreterAddress(out, addressAnswers(answers, 'i751_interpreter_address', 'i751_interpreter'));
  out['P6_Line4_InterpretersDaytimePhoneNumber[0]'] = usPhone(answers.interpreter_daytime_phone);
  out['P6_Line5_InterpretersEmailAddress[0]'] = clean(answers.interpreter_email, 100);
  out['P6_Language[0]'] = clean(answers.interpreter_language, 60);
  out['P7_Line1a_FamilyName[0]'] = clean(answers.preparer_family_name, 60);
  out['P7_Line1b_PreparersGivenName[0]'] = clean(answers.preparer_given_name, 60);
  out['P7_Line2_NameofBusinessor[0]'] = clean(answers.preparer_business_name, 100);
  setPreparerAddress(out, addressAnswers(answers, 'i751_preparer_address', 'i751_preparer'));
  out['P7_Line4_PreparersDaytimePhoneNumber[0]'] = usPhone(answers.preparer_daytime_phone);
  out['P7_Line5_PreparersFaxNumber[0]'] = usPhone(answers.preparer_fax);
  out['P7_Line6_PreparersEmailAddress[0]'] = clean(answers.preparer_email, 100);
  setChoice(out, 'P7_checkbox7', answers.i751_preparer_is_attorney === 'Yes' ? 'A' : (answers.i751_preparer_is_attorney === 'No' ? 'B' : ''));
  setChoice(out, answers.i751_preparer_representation_extends === 'Yes' ? 'Pt10Item7b_Extends' : 'Pt10Item7b_NotExtend', yesNo(answers.i751_preparer_representation_extends));

  setAdditional(out, answers);
  return Object.fromEntries(Object.entries(out).filter(([, value]) => value === true || (value !== false && value !== undefined && value !== null && value !== '')));
}

module.exports = { i_751FieldValues };
