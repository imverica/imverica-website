'use strict';

const inventory = require('../pdf-maps/uscis/i-131.json');
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
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return digits(`${value.areaCode || ''}${value.number || ''}`, 10);
  }
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

function setAddress(out, prefix, address) {
  const item = address || {};
  out[`${prefix}_InCareofName[0]`] = clean(item.inCareOf, 80);
  out[`${prefix}_StreetNumberName[0]`] = clean(item.line1, 80);
  out[`${prefix}_AptSteFlrNumber[0]`] = unitNumber(item.line2);
  Object.assign(out, unitRadio(`${prefix}_Unit`, item.line2));
  out[`${prefix}_CityTown[0]`] = clean(item.city, 60);
  if (isUS(item.country)) {
    out[`${prefix}_State[0]`] = stateCode(item.state);
    out[`${prefix}_ZipCode[0]`] = digits(item.zip, 9);
  } else {
    out[`${prefix}_Province[0]`] = clean(item.state, 40);
    out[`${prefix}_PostalCode[0]`] = clean(item.zip, 20);
    out[`${prefix}_Country[0]`] = clean(item.country, 60);
  }
}

function setSingleWidget(out, fieldName, selected) {
  if (selected && fieldName) out[fieldName] = true;
}

function setApplicationTypeFields(out, answers) {
  const type = clean(answers.i131_application_type, 160);
  const advanceBasis = clean(answers.i131_advance_parole_basis, 120);
  const related = clean(answers.i131_advance_parole_receipt_or_class, 120);
  const initialProgram = clean(answers.i131_initial_parole_program, 160);
  const pipProgram = clean(answers.i131_parole_in_place_program, 160);
  const reparoleProgram = clean(answers.i131_reparole_program, 160);

  out['P1_Line4[0]'] = clean(answers.i131_tps_i821_receipt, 40);
  const advanceFields = {
    'A. Pending Form I-485': 'P1_Line5A[0]',
    'B. Pending Form I-589': 'P1_Line5B[0]',
    'C. Pending initial Form I-821': 'P1_Line5C[0]',
    'E. Approved Form I-821D': 'P1_Line5E[0]',
    'F. Approved Form I-914 or I-914A': 'P1_Line5F[0]',
    'G. Approved Form I-918 or I-918A': 'P1_Line5G[0]',
    'H. Current parolee under INA 212(d)(5)': 'P1_Line5H[0]',
    'I. Approved Form I-817': 'P1_Line5I[0]',
    'J. Pending Form I-687': 'P1_Line5J[0]',
    'K. Approved V nonimmigrant status': 'P1_Line5K[0]',
    'L. CNMI long-term resident': 'P1_Line5L[0]'
  };
  if (advanceFields[advanceBasis]) out[advanceFields[advanceBasis]] = related;
  if (advanceBasis === 'M. Other') out['P1_Line5M[0]'] = clean(answers.i131_advance_parole_other_explanation, 220);

  if (type.startsWith('6.')) {
    if (initialProgram.startsWith('A.')) {
      out['CB_AppType[12]'] = true;
      out['P1_Line6A[0]'] = clean(answers.i131_initial_parole_i130_receipt, 40);
    } else if (initialProgram.startsWith('B.')) {
      const relationshipFields = {
        '1. Current or former service member': 'P1_Line6B_1[0]',
        '2. Spouse, child, unmarried son or daughter, or qualifying child': 'P1_Line6B_2[0]',
        '3. Current legal guardian or surrogate': 'P1_Line6B_3[0]'
      };
      setSingleWidget(out, relationshipFields[answers.i131_initial_parole_immvi_relationship], true);
    } else if (initialProgram.startsWith('C.')) {
      out['P1_Line6C1[0]'] = clean(answers.i131_initial_parole_agency, 100);
      out['P1_Line6C2[0]'] = clean(answers.i131_initial_parole_agency_email, 100);
    } else if (initialProgram.startsWith('D.')) {
      out['P1_Line6D[0]'] = clean(answers.i131_initial_parole_frtf_number, 80);
    } else if (initialProgram.startsWith('E.')) {
      out['P1_Line6E[0]'] = clean(answers.i131_initial_parole_other_program, 160);
    }
  }
  if (type.startsWith('7.')) out['CB_AppType[10]'] = true;

  if (type.startsWith('8.')) {
    if (pipProgram.startsWith('A.')) {
      setSingleWidget(out, answers.i131_pip_military_relationship === '1. Current or former service member' ? 'P1_Line8A_1[0]' : 'P1_Line8A_2[0]', true);
    } else if (pipProgram.startsWith('B.')) out['P1_Line8B[0]'] = clean(answers.i131_pip_frtf_number, 80);
    else if (pipProgram.startsWith('C.')) out['P1_Line8C[0]'] = clean(answers.i131_pip_other_program, 160);
  }
  if (type.startsWith('9.')) out['CB_AppType[11]'] = true;

  const reparoleWidgets = {
    'A. Family Reunification Parole Process': 'CB_AppType[5]',
    'B. Certain Afghans paroled after July 31, 2021': 'CB_AppType[4]',
    'C. Ukrainian re-parole process': 'CB_AppType[6]',
    'D. Filipino World War II Veterans Parole Program': 'CB_AppType[7]',
    'E. Immigrant Military Members and Veterans Initiative': 'CB_AppType[8]',
    'F. Central American Minors Program': 'CB_AppType[9]',
    'G. Family Reunification Task Force Process': 'CB_AppType[1]',
    'H. Military Parole in Place': 'CB_AppType[2]',
    'I. Other': 'CB_AppType[3]'
  };
  if (type.startsWith('10.') && reparoleWidgets[reparoleProgram]) out[reparoleWidgets[reparoleProgram]] = true;
  if (type.startsWith('11.')) out['CB_AppType[0]'] = true;
  if (reparoleProgram.startsWith('E.')) {
    const immviFields = {
      '1. Current or former service member': 'P1_Line10E_1[0]',
      '2. Spouse, child, unmarried son or daughter, or qualifying child': 'P1_Line10E_2[0]',
      '3. Current legal guardian or surrogate': 'P1_Line10E_3[0]'
    };
    setSingleWidget(out, immviFields[answers.i131_reparole_immvi_relationship], true);
  }
  if (reparoleProgram.startsWith('H.')) {
    setSingleWidget(out, answers.i131_reparole_pip_relationship === '1. Current or former service member' ? 'P1_Line10H_1[0]' : 'P1_Line10H_2[0]', true);
  }
  if (reparoleProgram.startsWith('I.')) out['P1_Line10I[0]'] = clean(answers.i131_reparole_other_program, 160);
  out['P1_Line12_DateOfAdmission[0]'] = dateMdY(answers.i131_reparole_admit_until);
  setYesNo(out, 'P1_Line13_YesNo', answers.i131_refugee_status_yes_no);
}

function i_131FieldValues(payload = {}) {
  const answers = payload.formAnswers || payload.answers || {};
  const contact = payload.contact || {};
  const out = {};

  setApplicationTypeFields(out, answers);

  out['Part2_Line1_FamilyName[0]'] = clean(answers.i131_family_name, 60);
  out['Part2_Line1_GivenName[0]'] = clean(answers.i131_given_name, 60);
  out['Part2_Line1_MiddleName[0]'] = clean(answers.i131_middle_name, 60);
  for (let number = 1; number <= 3; number += 1) {
    out[`Part2_Line2_FamilyName${number}[0]`] = clean(answers[`i131_other_name${number}_family`], 60);
    out[`Part2_Line2_GivenName${number}[0]`] = clean(answers[`i131_other_name${number}_given`], 60);
    out[`Part2_Line2_MiddleName${number}[0]`] = clean(answers[`i131_other_name${number}_middle`], 60);
  }

  const mailing = addressAnswers(answers, 'i131_mailing_address', 'i131_mailing');
  const physical = yesNo(answers.i131_physical_same_as_mailing) === 'Y'
    ? mailing
    : addressAnswers(answers, 'i131_physical_address', 'i131_physical');
  setAddress(out, 'Part2_Line3', mailing);
  setAddress(out, 'Part2_Line4', physical);

  out['Part2_Line5_AlienNumber[0]'] = digits(answers.i131_alien_number, 9);
  out['Part2_Line6_CountryOfBirth[0]'] = clean(answers.i131_country_of_birth, 60);
  out['Part2_Line7_CountryOfCitizenshiporNationality[0]'] = clean(answers.i131_country_of_citizenship, 60);
  setChoice(out, 'Part2_Line8_Gender', answers.i131_gender === 'Male' ? 'M' : (answers.i131_gender === 'Female' ? 'F' : ''));
  out['Part2_Line9_DateOfBirth[0]'] = dateMdY(answers.i131_date_of_birth);
  out['Part2_Line10_SSN[0]'] = digits(answers.i131_ssn, 9);
  out['Part2_Line11_USCISOnlineAcctNumber[0]'] = digits(answers.i131_uscis_online_account_number, 12);
  out['Part2_Line12_ClassofAdmission[0]'] = clean(answers.i131_class_of_admission, 40);
  out['Part2_Line13_I94RecordNo[0]'] = clean(answers.i131_i94_number, 20);
  out['Part2_Line14_I94ExpDate[0]'] = dateMdY(answers.i131_i94_expiration_date);
  out['Par2_Line15_eMedicalParoleeID[0]'] = clean(answers.i131_uspid, 40);

  if (answers.i131_for_beneficiary === 'I am filing for someone else') {
    out['P2_Line16_FamilyName[0]'] = clean(answers.i131_beneficiary_family_name, 60);
    out['P2_Line16_GivenName[0]'] = clean(answers.i131_beneficiary_given_name, 60);
    out['P2_Line16_MiddleName[0]'] = clean(answers.i131_beneficiary_middle_name, 60);
    for (let number = 1; number <= 3; number += 1) {
      out[`Part2_Line17_FamilyName${number}[0]`] = clean(answers[`i131_beneficiary_other_name${number}_family`], 60);
      out[`Part2_Line17_GivenName${number}[0]`] = clean(answers[`i131_beneficiary_other_name${number}_given`], 60);
      out[`Part2_Line17_MiddleName${number}[0]`] = clean(answers[`i131_beneficiary_other_name${number}_middle`], 60);
    }
    out['P2_Line18_DateOfBirth[0]'] = dateMdY(answers.i131_beneficiary_date_of_birth);
    out['P2_Line19_CountryOfBirth[0]'] = clean(answers.i131_beneficiary_country_of_birth, 60);
    out['P2_Line20_CountryOfCitizenship[0]'] = clean(answers.i131_beneficiary_country_of_citizenship, 60);
    out['P2_Line21_DaytimeTelephoneNumber[0]'] = usPhone(answers.i131_beneficiary_daytime_phone);
    out['P2_Line22_Email[0]'] = clean(answers.i131_beneficiary_email, 100);
    out['P2_Line23_AlienNumber[0]'] = digits(answers.i131_beneficiary_alien_number, 9);
    setAddress(out, 'P2_Line24', addressAnswers(answers, 'i131_beneficiary_mailing_address', 'i131_beneficiary_mailing'));
    setAddress(out, 'P2_Line25', addressAnswers(answers, 'i131_beneficiary_physical_address', 'i131_beneficiary_physical'));
    out['P2_Line26_ClassofAdmission[0]'] = clean(answers.i131_beneficiary_class_of_admission, 40);
    out['P2_Line27_I94RecordNo[0]'] = clean(answers.i131_beneficiary_i94_number, 20);
  }

  setChoice(out, 'P3_Line1_Ethnicity', answers.i131_ethnicity === 'Hispanic or Latino' ? 'H' : (answers.i131_ethnicity ? 'NH' : ''));
  const races = new Set(Array.isArray(answers.i131_race) ? answers.i131_race : []);
  const raceFields = {
    'American Indian or Alaska Native': 'P3_Line2_Race_American[0]',
    Asian: 'P3_Line2_Race_Asian[0]',
    'Black or African American': 'P3_Line2_Race_Black[0]',
    'Native Hawaiian or Other Pacific Islander': 'P3_Line2_Race_Hawaiian[0]',
    White: 'P3_Line2_Race_White[0]'
  };
  for (const [label, fieldName] of Object.entries(raceFields)) out[fieldName] = races.has(label);
  out['P3_Line3_HeightFeet[0]'] = clean(answers.i131_height_feet, 1);
  out['P3_Line3_HeightInches[0]'] = clean(answers.i131_height_inches, 2);
  const weight = digits(answers.i131_weight_pounds, 3).padStart(3, '0');
  if (digits(answers.i131_weight_pounds, 3)) {
    out['P3_Line4_Pound1[0]'] = weight[0];
    out['P3_Line4_Pound2[0]'] = weight[1];
    out['P3_Line4_Pound3[0]'] = weight[2];
  }
  const eyeStates = { Black: 'BLK', Blue: 'BLU', Brown: 'BRN', Gray: 'GRY', Green: 'GRN', Hazel: 'HZL', Maroon: 'MRN', Pink: 'PNK', 'Unknown/Other': 'OTH' };
  const hairStates = { 'Bald (No hair)': 'BLD', Black: 'BLK', Blond: 'BND', Brown: 'BRN', Gray: 'GRY', Red: 'RED', Sandy: 'SDY', White: 'WHT', 'Unknown/Other': 'OTH' };
  setChoice(out, 'P3_Line5_EyeColor', eyeStates[answers.i131_eye_color]);
  setChoice(out, 'P3_Line6_HairColor', hairStates[answers.i131_hair_color]);

  setYesNo(out, 'P4_Line1_YesNo', answers.i131_exclusion_deportation_or_removal);
  setYesNo(out, 'P4_Line2a_YesNo', answers.i131_prior_reentry_or_refugee_document);
  out['P4_Line2b_DateIssued[0]'] = dateMdY(answers.i131_prior_reentry_or_refugee_date);
  out['P4_Line2c_Disposition[0]'] = clean(answers.i131_prior_reentry_or_refugee_disposition, 100);
  setYesNo(out, 'P4_Line3a_YesNo', answers.i131_prior_advance_parole_document);
  out['P4_Line3b_DateIssued[0]'] = dateMdY(answers.i131_prior_advance_parole_date);
  out['P4_Line3c_Disposition[0]'] = clean(answers.i131_prior_advance_parole_disposition, 100);
  setYesNo(out, 'P4_Line4_YesNo', answers.i131_requesting_replacement);
  const replacementStates = {
    'Issued but never received': '1',
    'Lost, stolen, or damaged': '2',
    'Incorrect due to applicant error or changed information': '3',
    'Incorrect due to USCIS error': '4'
  };
  setChoice(out, 'P4_Line5', replacementStates[answers.i131_replacement_reason]);
  const corrections = new Set(Array.isArray(answers.i131_correction_fields) ? answers.i131_correction_fields : []);
  const correctionFields = {
    Name: 'P4_Line6a_Name[0]',
    'A-Number': 'P4_Line6a_ANumber[0]',
    'Country of Birth/Citizenship': 'P4_Line6a_CountryofBirthCitizenship[0]',
    'Terms and Conditions': 'P4_Line6a_Terms[0]',
    'Date of Birth': 'P4_Line6a_DOB[0]',
    Sex: 'P4_Line6a_Gender[0]',
    'Validity Date': 'P4_Line6a_Validity[0]',
    Photo: 'P4_Line6a_Photo[0]'
  };
  for (const [label, fieldName] of Object.entries(correctionFields)) out[fieldName] = corrections.has(label);
  out['P4_Line6a_Explanation[0]'] = clean(answers.i131_replacement_explanation, 500);
  out['P4_Line6b_ReceiptNumber[0]'] = clean(answers.i131_replacement_receipt, 40);

  if (answers.i131_delivery_option) {
    setChoice(out, 'P4_Line7a', answers.i131_delivery_option.startsWith('U.S. mailing') ? 'A' : 'B');
  }
  out['P4_Line7b_CityOrTown[0]'] = clean(answers.i131_delivery_overseas_city, 60);
  out['P4_Line7b_Country[0]'] = clean(answers.i131_delivery_overseas_country, 60);
  if (answers.i131_pickup_notice_to_part2) setChoice(out, 'P4_Line8_CB', answers.i131_pickup_notice_to_part2 === 'Yes' ? 'A' : 'B');
  setAddress(out, 'P4_Line9a', addressAnswers(answers, 'i131_pickup_notice_address', 'i131_pickup_notice'));
  out['P4_Line9b_Email[0]'] = usPhone(answers.i131_pickup_notice_phone);
  out['P4_Line9c_Email[0]'] = clean(answers.i131_pickup_notice_email, 100);

  const timeFields = {
    'Less Than 6 Months': 'P5_Line1_Lessthan6[0]',
    '6 Months to 1 Year': 'P5_Line1_6months[0]',
    '1 to 2 Years': 'P5_Line1_1to2[0]',
    '2 to 3 Years': 'P5_Line1_2to3[0]',
    '3 to 4 Years': 'P5_Line1_3to4[0]',
    'More Than 4 Years': 'P5_Line1_morethan[0]'
  };
  setSingleWidget(out, timeFields[answers.i131_expected_time_outside_us], true);

  out['P6_Line1_CountryRefugee[0]'] = clean(answers.i131_country_of_refugee_status, 60);
  setYesNo(out, 'P6_Line2_YesNo', answers.i131_refugee_plan_country_travel);
  setYesNo(out, 'P6_Line3a_YesNo', answers.i131_refugee_returned_country);
  setYesNo(out, 'P6_Line3b_YesNo', answers.i131_refugee_passport_country);
  setYesNo(out, 'P6_Line3c_YesNo', answers.i131_refugee_benefit_country);
  setYesNo(out, 'P6_Line4a_YesNo', answers.i131_refugee_reacquired_nationality);
  setYesNo(out, 'P6_Line4b_YesNo', answers.i131_refugee_new_nationality);
  setYesNo(out, 'P6_Line5_YesNo', answers.i131_refugee_filing_before_departure);
  setYesNo(out, 'P6_Line6a_YesNo', answers.i131_refugee_currently_outside_us);
  out['P6_Line6b_CityOrTown[0]'] = clean(answers.i131_refugee_current_location, 100);
  out['P6_Line6c_Country[0]'] = clean(answers.i131_refugee_countries_since_departure, 180);

  out['P7_Line1_DateOfDeparture[0]'] = dateMdY(answers.i131_planned_departure_date);
  out['P7_Line2_Purpose[0]'] = clean(answers.i131_purpose_of_travel, 500);
  out['P7_Line3_ListCountries[0]'] = clean(answers.i131_countries_to_visit, 250);
  setChoice(out, 'P7_Line4_CB', answers.i131_number_of_trips === 'One Trip' ? 'O' : (answers.i131_number_of_trips ? 'M' : ''));
  out['P7_Line5_ExpectedLengthTrip[0]'] = digits(answers.i131_expected_trip_length_days, 4);

  out['P8_Line1_Explain[0]'] = clean(answers.i131_parole_qualification_explanation, 1200);
  out['P8_Line2_ExpectedLengthTripinUS[0]'] = clean(answers.i131_expected_stay_us, 80);
  out['P8_Line3a_DateOfIntendedArrival[0]'] = dateMdY(answers.i131_intended_arrival_date_us);
  out['P8_Line3b_CityOrTown[0]'] = clean(answers.i131_intended_arrival_city, 80);
  out['P8_Line3b_Country[0]'] = clean(answers.i131_intended_arrival_country, 60);
  if (yesNo(answers.i131_request_reparole_ead) === 'Y') out['P9_Line1_EAD[0]'] = true;

  out['Part10_Line1_DayPhone[0]'] = usPhone(answers.i131_daytime_phone || contact.phone);
  out['Part10_Line2_MobilePhone[0]'] = usPhone(answers.i131_mobile_phone);
  out['Part10_Line3_Email[0]'] = clean(answers.i131_email || contact.email, 100);

  const additionalSections = [
    answers.i131_additional_other_names ? { page: '5', part: '2', item: '2', text: `Additional other names: ${clean(answers.i131_additional_other_names, 800)}` } : null,
    answers.i131_refugee_explanation ? { page: '10', part: '6', item: '2-5', text: clean(answers.i131_refugee_explanation, 1000) } : null
  ].filter(Boolean);
  additionalSections.slice(0, 5).forEach((item, index) => {
    const line = index + 3;
    out[`Part13_Line${line}_PageNumber[0]`] = item.page;
    out[`Part13_Line${line}_PartNumber[0]`] = item.part;
    out[`Part13_Line${line}_ItemNumber[0]`] = item.item;
    out[`Part13_Line${line}_AdditionalInfo[0]`] = item.text;
  });

  return Object.fromEntries(Object.entries(out).filter(([, value]) => value === true || (value !== false && value !== undefined && value !== null && value !== '')));
}

function i_131TextOverlays(payload = {}) {
  const answers = payload.formAnswers || payload.answers || {};
  const type = clean(answers.i131_application_type, 160);
  const overlays = [];
  const mark = (page, x, y) => overlays.push({ page, x, y, size: 10, text: 'X' });

  if (type.startsWith('1.')) mark(1, 67, 375);
  else if (type.startsWith('2.')) mark(1, 67, 315);
  else if (type.startsWith('3.')) mark(1, 67, 297);
  else if (type.startsWith('4.')) mark(1, 67, 225);
  else if (type.startsWith('5.')) {
    const advanceMarks = {
      'A. Pending Form I-485': [1, 87, 93],
      'B. Pending Form I-589': [2, 87, 705],
      'C. Pending initial Form I-821': [2, 87, 669],
      'D. Deferred Enforced Departure': [2, 87, 633],
      'E. Approved Form I-821D': [2, 87, 615],
      'F. Approved Form I-914 or I-914A': [2, 87, 579],
      'G. Approved Form I-918 or I-918A': [2, 87, 531],
      'H. Current parolee under INA 212(d)(5)': [2, 87, 483],
      'I. Approved Form I-817': [2, 87, 447],
      'J. Pending Form I-687': [2, 87, 411],
      'K. Approved V nonimmigrant status': [2, 87, 363],
      'L. CNMI long-term resident': [2, 87, 327],
      'M. Other': [2, 87, 291]
    };
    const coordinates = advanceMarks[answers.i131_advance_parole_basis];
    if (coordinates) mark(...coordinates);
  } else if (type.startsWith('6.')) {
    const program = clean(answers.i131_initial_parole_program, 160);
    if (program.startsWith('B.')) mark(3, 87, 699);
    else if (program.startsWith('C.')) mark(3, 87, 615);
    else if (program.startsWith('D.')) mark(3, 87, 523);
    else if (program.startsWith('E.')) mark(3, 87, 487);
  } else if (type.startsWith('8.')) {
    const program = clean(answers.i131_parole_in_place_program, 160);
    if (program.startsWith('A.')) mark(3, 87, 326);
    else if (program.startsWith('B.')) mark(3, 87, 274);
    else if (program.startsWith('C.')) mark(3, 87, 237);
  }
  return overlays;
}

module.exports = { i_131FieldValues, i_131TextOverlays };
