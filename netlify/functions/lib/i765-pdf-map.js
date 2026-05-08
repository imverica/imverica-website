function clean(value, max = 300) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function digits(value, max = 30) {
  return clean(value, max).replace(/\D/g, '').slice(0, max);
}

function dateMdY(value) {
  const text = clean(value, 40);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return text;
}

function splitOtherNames(value) {
  const text = clean(value, 500);
  if (!text) return [];
  return text.split(/[;\n,]+/).map((item) => item.trim()).filter(Boolean).slice(0, 2);
}

function splitNameParts(value) {
  const parts = clean(value, 160).split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { given: parts[0] };
  return {
    given: parts.slice(0, -1).join(' '),
    family: parts.at(-1)
  };
}

function stateCode(value) {
  const text = clean(value, 80);
  const match = text.match(/^([A-Z]{2})\b/);
  return match ? match[1] : text;
}

function categoryParts(value) {
  const text = clean(value, 40);
  const match = text.match(/\(?\s*([a-zA-Z])\s*\)?\s*\(?\s*([0-9]+)\s*\)?\s*(?:\(?\s*([a-zA-Z0-9]+)\s*\)?)?/);
  if (!match) return [];
  return [match[1], match[2], match[3] || ''].map((item) => item ? item.toLowerCase() : '');
}

function yesNo(value) {
  const text = clean(value, 40).toLowerCase();
  if (['yes', 'да', 'так', 'si', 'sí', 'true'].includes(text)) return true;
  if (['no', 'нет', 'ні', 'false'].includes(text)) return false;
  return null;
}

function checkboxPair(values, yesField, noField) {
  if (values === true) return { [yesField]: true, [noField]: false };
  if (values === false) return { [yesField]: false, [noField]: true };
  return {};
}

function unitCheckbox(unitValue, aptField, suiteField, floorField) {
  const text = clean(unitValue, 40).toLowerCase();
  if (/ste|suite/.test(text)) return { [suiteField]: true, [aptField]: false, [floorField]: false };
  if (/fl|floor/.test(text)) return { [floorField]: true, [aptField]: false, [suiteField]: false };
  return { [aptField]: true, [suiteField]: false, [floorField]: false };
}

function mappedAddress(answers) {
  const unit = clean(answers.mailing_address_line2);
  return {
    'Line4b_StreetNumberName[0]': answers.mailing_address_line1,
    'Pt2Line5_AptSteFlrNumber[0]': unit,
    'Pt2Line5_CityOrTown[0]': answers.mailing_city,
    'Pt2Line5_State[0]': stateCode(answers.mailing_state),
    'Pt2Line5_ZipCode[0]': digits(answers.mailing_zip, 10),
    ...(unit ? unitCheckbox(unit, 'Pt2Line5_Unit[2]', 'Pt2Line5_Unit[0]', 'Pt2Line5_Unit[1]') : {})
  };
}

function physicalAddress(answers) {
  const same = yesNo(answers.physical_same_as_mailing);
  const base = checkboxPair(same, 'Part2Line5_Checkbox[1]', 'Part2Line5_Checkbox[0]');
  if (same !== false) return base;

  return {
    ...base,
    'Pt2Line7_StreetNumberName[0]': answers.physical_address_line1 || answers.mailing_address_line1,
    'Pt2Line7_CityOrTown[0]': answers.physical_city || answers.mailing_city,
    'Pt2Line7_State[0]': stateCode(answers.physical_state || answers.mailing_state),
    'Pt2Line7_ZipCode[0]': digits(answers.physical_zip || answers.mailing_zip, 10)
  };
}

function i765FieldValues(payload = {}) {
  const answers = payload.formAnswers || payload.answers || {};
  const contact = payload.contact || {};
  const today = new Date().toISOString().slice(0, 10);
  const otherNames = splitOtherNames(answers.other_names_used);
  const fallbackName = splitNameParts(contact.name);
  const category = categoryParts(answers.eligibility_category_code);
  const priorEad = yesNo(answers.prior_ead);
  const phone = clean(answers.daytime_phone || contact.phone, 80);
  const email = clean(answers.email_address || contact.email, 180);

  const values = {
    'Line1a_FamilyName[0]': answers.applicant_family_name || fallbackName.family,
    'Line1b_GivenName[0]': answers.applicant_given_name || fallbackName.given,
    'Line1c_MiddleName[0]': answers.applicant_middle_name,
    'Line2a_FamilyName[0]': otherNames[0],
    'Line2b_GivenName[0]': otherNames[1],
    'Line7_AlienNumber[0]': digits(answers.alien_number, 9),
    'Line8_ElisAccountNumber[0]': clean(answers.uscis_online_account_number, 12),
    'Line12b_SSN[0]': digits(answers.ssn, 9),
    'Line17a_CountryOfBirth[0]': answers.country_of_citizenship,
    'Line18a_CityTownOfBirth[0]': answers.city_of_birth,
    'Line18b_CityTownOfBirth[0]': answers.state_or_province_of_birth,
    'Line18c_CountryOfBirth[0]': answers.country_of_birth,
    'Line19_DOB[0]': dateMdY(answers.date_of_birth),
    'Line20a_I94Number[0]': clean(answers.i94_number, 20),
    'Line20b_Passport[0]': clean(answers.passport_number, 40),
    'Line20d_CountryOfIssuance[0]': answers.passport_country_of_issuance,
    'Line20e_ExpDate[0]': dateMdY(answers.passport_expiration),
    'Line21_DateOfLastEntry[0]': dateMdY(answers.last_arrival_date),
    'Line23_StatusLastEntry[0]': answers.status_at_last_entry,
    'Line24_CurrentStatus[0]': answers.current_immigration_status,
    'Line28_ReceiptNumber[0]': answers.pending_application_receipt,
    'Pt3Line3_DaytimePhoneNumber1[0]': phone,
    'Pt3Line4_MobileNumber1[0]': phone,
    'Pt3Line5_Email[0]': email,
    'Pt3Line7b_DateofSignature[0]': dateMdY(today),
    'section_1[0]': category[0],
    'section_2[0]': category[1],
    'section_3[0]': category[2],
    ...mappedAddress(answers),
    ...physicalAddress(answers),
    ...checkboxPair(priorEad, 'Line19_Checkbox[1]', 'Line19_Checkbox[0]')
  };

  return Object.fromEntries(Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, value]));
}

module.exports = {
  i765FieldValues,
  categoryParts,
  dateMdY
};
