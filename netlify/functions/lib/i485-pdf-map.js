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
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return text;
}

function stateCode(value) {
  const text = clean(value, 80);
  const match = text.match(/^([A-Z]{2})\b/);
  return match ? match[1] : text;
}

function usPhoneDigits(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return digits(`${value.areaCode || ''}${value.number || ''}`, 10);
  }
  const raw = digits(value, 20);
  if (raw.length === 11 && raw.startsWith('1')) return raw.slice(1);
  if (raw.length > 10) return raw.slice(-10);
  return raw;
}

function yesNo(value) {
  const text = clean(value, 40).toLowerCase();
  if (['yes', 'да', 'так', 'si', 'sí', 'true'].includes(text)) return true;
  if (['no', 'нет', 'ні', 'false'].includes(text)) return false;
  return null;
}

function checkboxPair(value, yesField, noField) {
  if (value === true) return { [yesField]: true, [noField]: false };
  if (value === false) return { [yesField]: false, [noField]: true };
  return {};
}

function unitCheckbox(unitValue, aptField, suiteField, floorField) {
  const text = clean(unitValue, 40).toLowerCase();
  if (/ste|suite/.test(text)) return { [suiteField]: true, [aptField]: false, [floorField]: false };
  if (/fl|floor/.test(text)) return { [floorField]: true, [aptField]: false, [suiteField]: false };
  return { [aptField]: true, [suiteField]: false, [floorField]: false };
}

function unitNumber(value) {
  return clean(value, 40)
    .replace(/^(?:apt|apartment|ste|suite|fl|floor|unit|#)\s*\.?\s*/i, '')
    .slice(0, 6);
}

// AlienNumber[0..23] repeats as a running header on every page
function alienNumberFields(value) {
  const a = digits(value, 9);
  if (!a) return {};
  const result = {};
  for (let i = 0; i <= 23; i++) result[`AlienNumber[${i}]`] = a;
  return result;
}

// Pt1Line6_CB_Sex: [0]=Male, [1]=Female  (form layout: "Male" then "Female")
function sexFields(value) {
  const sex = clean(value, 80).toLowerCase();
  if (/^m|male|муж|чолов|masc/.test(sex)) {
    return { 'Pt1Line6_CB_Sex[0]': true, 'Pt1Line6_CB_Sex[1]': false };
  }
  if (/^f|female|жен|жін|fem/.test(sex)) {
    return { 'Pt1Line6_CB_Sex[0]': false, 'Pt1Line6_CB_Sex[1]': true };
  }
  return {};
}

// Pt6Line1_MaritalStatus: [0]=Single, [1]=Married, [2]=Divorced, [3]=Widowed, [4]=Annulled, [5]=Legally Separated
function maritalStatusFields(value) {
  const s = clean(value, 120).toLowerCase();
  let idx = -1;
  if (/single|never|холост|не в браке|не в шлюб/.test(s)) idx = 0;
  else if (/married|spouse|брак|женат|замуж|шлюб|одруж/.test(s)) idx = 1;
  else if (/divorc|развед|розлуч/.test(s)) idx = 2;
  else if (/widow|вдов/.test(s)) idx = 3;
  else if (/annul/.test(s)) idx = 4;
  else if (/separat/.test(s)) idx = 5;
  if (idx < 0) return {};
  const result = {};
  for (let i = 0; i <= 5; i++) result[`Pt6Line1_MaritalStatus[${i}]`] = i === idx;
  return result;
}

// Pt7Line1_Ethnicity: [0]=Hispanic/Latino, [1]=Not Hispanic/Latino
function ethnicityFields(value) {
  const text = clean(value, 80).toLowerCase();
  if (/hispanic|latino|latina|іспан/.test(text)) {
    return { 'Pt7Line1_Ethnicity[0]': true, 'Pt7Line1_Ethnicity[1]': false };
  }
  return { 'Pt7Line1_Ethnicity[0]': false, 'Pt7Line1_Ethnicity[1]': true };
}

// Pt7Line2_Race: [0]=AI/AN, [1]=Asian, [2]=Black/AA, [3]=NHPI, [4]=White
function raceFields(value) {
  const text = clean(value, 120).toLowerCase();
  const result = {};
  if (/indian|alaska|native american/.test(text)) result['Pt7Line2_Race[0]'] = true;
  if (/asian|азіат/.test(text)) result['Pt7Line2_Race[1]'] = true;
  if (/black|african/.test(text)) result['Pt7Line2_Race[2]'] = true;
  if (/hawaiian|pacific|islander/.test(text)) result['Pt7Line2_Race[3]'] = true;
  if (/white|caucasian|european/.test(text)) result['Pt7Line2_Race[4]'] = true;
  return result;
}

// Pt7Line5_Eyecolor: [0]=Black, [1]=Blue, [2]=Brown, [3]=Gray, [4]=Green, [5]=Hazel, [6]=Maroon, [7]=Pink, [8]=Unknown
const EYE_COLORS = ['black', 'blue', 'brown', 'gray', 'green', 'hazel', 'maroon', 'pink', 'unknown'];
function eyeColorFields(value) {
  const text = clean(value, 40).toLowerCase();
  const idx = EYE_COLORS.findIndex((c) => text.includes(c));
  if (idx < 0) return {};
  const result = {};
  for (let i = 0; i < EYE_COLORS.length; i++) result[`Pt7Line5_Eyecolor[${i}]`] = i === idx;
  return result;
}

// Pt7Line6_Haircolor: [0]=Bald, [1]=Black, [2]=Blond, [3]=Brown, [4]=Gray, [5]=Red, [6]=Sandy, [7]=White, [8]=Unknown
const HAIR_COLORS = ['bald', 'black', 'blond', 'brown', 'gray', 'red', 'sandy', 'white', 'unknown'];
function hairColorFields(value) {
  const text = clean(value, 40).toLowerCase();
  const idx = HAIR_COLORS.findIndex((c) => text.includes(c));
  if (idx < 0) return {};
  const result = {};
  for (let i = 0; i < HAIR_COLORS.length; i++) result[`Pt7Line6_Haircolor[${i}]`] = i === idx;
  return result;
}

// Part 1, Line 11 admission basis
// Pt2Line11_CB (prefix is Pt2 in form XML despite being Part 1 content):
// [0]=Immigrant, [1]=Nonimmigrant, [2]=Parolee, [3]=Other
function admissionBasisFields(value) {
  const text = clean(value, 120).toLowerCase();
  if (/nonimmigrant|non-immigrant/.test(text)) {
    return { 'Pt2Line11_CB[0]': false, 'Pt2Line11_CB[1]': true, 'Pt2Line11_CB[2]': false, 'Pt2Line11_CB[3]': false };
  }
  if (/parol/.test(text)) {
    return { 'Pt2Line11_CB[0]': false, 'Pt2Line11_CB[1]': false, 'Pt2Line11_CB[2]': true, 'Pt2Line11_CB[3]': false };
  }
  if (/immigrant/.test(text)) {
    return { 'Pt2Line11_CB[0]': true, 'Pt2Line11_CB[1]': false, 'Pt2Line11_CB[2]': false, 'Pt2Line11_CB[3]': false };
  }
  return {};
}

// Part 2, Item 3 – eligibility basis → checkbox
// 3.a family-based IR/preference, 3.b employment-based, 3.c special immigrant,
// 3.d asylee/refugee, 3.e DV, 3.f other (T/U/VAWA/Afghan-Iraqi/broadcaster/legalization/SAW)
function eligibilityFields(basis) {
  const b = clean(basis, 160).toLowerCase();

  // Immediate relatives (3.a)
  if (/ir.?1|spouse.*usc|usc.*spouse/.test(b)) return { 'Pt2Line3a_CB[0]': true };
  if (/ir.?2|child.*usc|usc.*child/.test(b)) return { 'Pt2Line3a_CB[1]': true };
  if (/ir.?5|parent.*usc|usc.*parent/.test(b)) return { 'Pt2Line3a_CB[2]': true };
  if (/ir.?4|orphan.*abroad/.test(b)) return { 'Pt2Line3a_CB[3]': true };
  if (/ir.?3|orphan.*adopt/.test(b)) return { 'Pt2Line3a_CB[4]': true };
  if (/iw\b|widow|widower/.test(b)) return { 'Pt2Line3a_CB[5]': true };
  if (/\bf1\b/.test(b)) return { 'Pt2Line3a_CB[6]': true };
  if (/\bf2a\b/.test(b)) return { 'Pt2Line3a_CB[7]': true };
  if (/\bf2b\b/.test(b)) return { 'Pt2Line3a_CB[8]': true };
  if (/\bf3\b/.test(b)) return { 'Pt2Line3a_CB[9]': true };
  if (/\bf4\b/.test(b)) return { 'Pt2Line3a_CB[10]': true };

  // Employment-based (3.b)
  if (/eb.?1a|extraordinary ability/.test(b)) return { 'Pt2Line3b_CB140[0]': true };
  if (/eb.?1b|outstanding researcher/.test(b)) return { 'Pt2Line3b_CB140[1]': true };
  if (/eb.?1c|multinational/.test(b)) return { 'Pt2Line3b_CB140[2]': true };
  if (/eb.?2|national interest|niw/.test(b)) return { 'Pt2Line3b_CB140[3]': true };
  if (/eb.?3w|unskilled/.test(b)) return { 'Pt2Line3b_CB140[5]': true };
  if (/eb.?3/.test(b)) return { 'Pt2Line3b_CB140[4]': true };
  if (/eb.?4/.test(b)) return { 'Pt2Line3b_CB140[6]': true };
  if (/eb.?5|investor/.test(b)) return { 'Pt2Line3b_CB140[7]': true };

  // Special immigrant (3.c)
  if (/sij|special.*immigrant.*juvenile/.test(b)) return { 'Pt2Line3c_CB[0]': true };

  // Asylee / Refugee (3.d)
  if (/asylee|asylum/.test(b)) return { 'Pt2Line3d_AsyleeRefugeeCB[0]': true };
  if (/refugee/.test(b)) return { 'Pt2Line3d_AsyleeRefugeeCB[1]': true };

  // Diversity Visa (3.e)
  if (/diversity|dv.?\d|lottery/.test(b)) return { 'Pt2Line3e_CB[0]': true };

  // Other categories (3.f) — indices: [0]=T nonimmigrant, [1]=U nonimmigrant,
  // [2]=VAWA, [3]=Afghan/Iraqi special immigrant, [4]=int'l broadcaster,
  // [5]=legalization/245A, [6]=SAW, [7]=other
  if (/t.nonimmigrant|t.?visa.*adjust|trafficking.*victim/.test(b)) return { 'Pt2Line3f_CB[0]': true };
  if (/u.nonimmigrant|u.?visa.*adjust|245.?m|crime.*victim/.test(b)) return { 'Pt2Line3f_CB[1]': true };
  if (/vawa|violence.*against.*women/.test(b)) return { 'Pt2Line3f_CB[2]': true };
  if (/afghan|iraqi/.test(b)) return { 'Pt2Line3f_CB[3]': true };
  if (/broadcaster/.test(b)) return { 'Pt2Line3f_CB[4]': true };
  if (/legalization|irca|245.?a/.test(b)) return { 'Pt2Line3f_CB[5]': true };
  if (/saw|special.*agricultural/.test(b)) return { 'Pt2Line3f_CB[6]': true };

  return {};
}

function usAddress(answers) {
  const unit = clean(answers.mailing_address_line2 || answers.current_address_line2);
  return {
    'Pt1Line18_StreetNumberName[0]': clean(answers.mailing_address_line1 || answers.current_address_line1, 80),
    'Pt1Line18US_AptSteFlrNumber[0]': unitNumber(unit),
    'Pt1Line18_CityOrTown[0]': clean(answers.mailing_city || answers.current_city, 60),
    'Pt1Line18_State[0]': stateCode(answers.mailing_state || answers.current_state),
    'Pt1Line18_ZipCode[0]': digits(answers.mailing_zip || answers.current_zip, 10),
    ...(answers.in_care_of_name ? { 'Part1_Item18_InCareOfName[0]': clean(answers.in_care_of_name, 60) } : {}),
    ...(answers.date_moved_in ? { 'Pt1Line18_Date[0]': dateMdY(answers.date_moved_in) } : {}),
    ...(unit ? unitCheckbox(unit, 'Pt1Line18US_Unit[0]', 'Pt1Line18US_Unit[2]', 'Pt1Line18US_Unit[1]') : {})
  };
}

function i485FieldValues(payload = {}) {
  const answers = payload.formAnswers || payload.answers || {};
  const contact = payload.contact || {};
  const today = new Date().toISOString().slice(0, 10);
  const phone = usPhoneDigits(answers.daytime_phone || contact.phone);
  const mobile = usPhoneDigits(answers.mobile_phone || answers.daytime_phone || contact.phone);
  const email = clean(answers.email_address || contact.email, 180);
  const alienNum = digits(answers.alien_number, 9);
  const priorPetition = yesNo(answers.petition_previously_filed);
  const hasSsn = yesNo(answers.has_ssn);
  const otherDob = yesNo(answers.other_dob_used);
  const priorANumber = yesNo(answers.has_prior_alien_number);
  const sameAddress5yrs = yesNo(answers.same_address_five_years);
  const inProceedings = yesNo(answers.in_removal_proceedings);
  const priorOrder = yesNo(answers.prior_removal_order);
  const everRemoved = yesNo(answers.ever_removed_excluded);
  const ssaConsent = yesNo(answers.ssn_ssa_consent);
  const currentlyWorking = yesNo(answers.currently_working);
  const unauthorizedWork = yesNo(answers.worked_without_authorization);
  const concurrentFiling = yesNo(answers.concurrent_filing);

  const values = {
    // Part 1 — Applicant identity
    'Pt1Line1_FamilyName[0]': clean(answers.applicant_family_name, 60),
    'Pt1Line1_GivenName[0]': clean(answers.applicant_given_name, 60),
    'Pt1Line1_MiddleName[0]': clean(answers.applicant_middle_name, 60),

    // Safe/legal name (if different from current name)
    'Pt1Line2_FamilyName[0]': clean(answers.safe_family_name, 60),
    'Pt1Line2_GivenName[0]': clean(answers.safe_given_name, 60),
    'Pt1Line2_MiddleName[0]': clean(answers.safe_middle_name, 60),

    // Other names used
    'Pt1Line2a_FamilyName[0]': clean(answers.other_name_family, 60),
    'Pt1Line2a_GivenName[0]': clean(answers.other_name_given, 60),
    'Pt1Line2a_MiddleName[0]': clean(answers.other_name_middle, 60),

    // DOB and prior DOB flag
    'Pt1Line3_DOB[0]': dateMdY(answers.date_of_birth),
    ...checkboxPair(otherDob, 'Pt1Line3_YN[0]', 'Pt1Line3_YN[1]'),

    // A-Number
    'Pt1Line4_AlienNumber[0]': alienNum,
    ...checkboxPair(alienNum ? true : false, 'Pt1Line4_YN[0]', 'Pt1Line4_YN[1]'),
    ...checkboxPair(priorANumber, 'Pt1Line5_YN[0]', 'Pt1Line5_YN[1]'),
    'Pt1Line5A_ANumber[0]': digits(answers.prior_alien_number_1, 9),
    'Pt1Line5B_ANumber[0]': digits(answers.prior_alien_number_2, 9),

    // Birth / Citizenship
    'Pt1Line7_CityTownOfBirth[0]': clean(answers.city_of_birth, 60),
    'Pt1Line7_CountryOfBirth[0]': clean(answers.country_of_birth, 60),
    'Pt1Line8_CountryofCitizenshipNationality[0]': clean(answers.country_of_citizenship, 60),

    // USCIS account number
    'USCISOnlineAcctNumber[0]': digits(answers.uscis_online_account_number, 12),
    'Pt1Line9_USCISAccountNumber[0]': digits(answers.uscis_online_account_number, 12),

    // Passport / Entry
    'Pt1Line10_PassportNum[0]': clean(answers.passport_number, 20),
    'Pt1Line10_ExpDate[0]': dateMdY(answers.passport_expiration),
    'Pt1Line10_Passport[0]': clean(answers.passport_country_of_issuance, 60),
    'Pt1Line10_VisaNum[0]': clean(answers.visa_number, 20),
    'Pt1Line10_CityTown[0]': clean(answers.port_of_entry_city, 60),
    'Pt1Line10_State[0]': stateCode(answers.port_of_entry_state || ''),
    'Pt1Line10_DateofArrival[0]': dateMdY(answers.date_of_arrival),
    'Pt1Line10_NonImmDate[0]': clean(answers.status_expiration_date, 20),

    // Admission basis and status at entry
    'Pt1Line11_Admitted[0]': clean(answers.status_at_last_entry, 40),
    'Pt1Line11_Paroled[0]': clean(answers.paroled_as, 40),

    // Current immigration status (Part 1, lines 12–17)
    'P1Line12_I94[0]': clean(answers.i94_number, 20),
    'Pt1Line12_Date[0]': dateMdY(answers.date_of_last_entry),
    'Pt1Line12_Status[0]': clean(answers.manner_of_last_entry, 60),
    'Pt1Line14_Status[0]': clean(answers.current_immigration_status, 80),
    'Pt1Line15_Date[0]': clean(answers.authorized_stay_expires, 20),
    ...checkboxPair(inProceedings, 'Pt1Line13_YN[0]', 'Pt1Line13_YN[1]'),
    ...checkboxPair(priorOrder, 'Pt1Line16_YN[0]', 'Pt1Line16_YN[1]'),
    ...checkboxPair(everRemoved, 'Pt1Line17_YN[0]', 'Pt1Line17_YN[1]'),

    // SSN
    ...checkboxPair(hasSsn, 'Pt1Line19_YN[0]', 'Pt1Line19_YN[1]'),
    'Pt1Line19_SSN[0]': digits(answers.ssn, 9),
    ...checkboxPair(ssaConsent, 'Pt1Line19_SSA_YN[0]', 'Pt1Line19_SSA_YN[1]'),
    ...checkboxPair(ssaConsent, 'Pt1Line19_Consent_YN[0]', 'Pt1Line19_Consent_YN[1]'),

    // Part 2 — Prior petition
    ...checkboxPair(priorPetition, 'Pt2Line1_YN[0]', 'Pt2Line1_YN[1]'),
    'Pt2Line2_Receipt[0]': clean(answers.petition_receipt_number, 20),
    'Pt2Line2_Date[0]': dateMdY(answers.petition_date),
    'Pt2Line2_FamilyName[0]': clean(answers.petitioner_family_name, 60),
    'Pt2Line2_GivenName[0]': clean(answers.petitioner_given_name, 60),
    'Pt2Line2_AlienNumber[0]': digits(answers.petitioner_alien_number, 9),
    ...checkboxPair(concurrentFiling, 'Pt2Line5_CB[0]', 'Pt2Line5_CB[1]'),

    // Part 4 — Processing / Employment
    ...checkboxPair(currentlyWorking, 'Pt4Line5_YN[0]', 'Pt4Line5_YN[1]'),
    ...checkboxPair(unauthorizedWork, 'Pt4Line6_YN[0]', 'Pt4Line6_YN[1]'),
    'Pt4Line7_EmployerName[0]': clean(answers.employer_name, 80),

    // Part 5 — Parents
    'Pt5Line1_FamilyName[0]': clean(answers.father_family_name, 60),
    'Pt5Line1_GivenName[0]': clean(answers.father_given_name, 60),
    'Pt5Line1_MiddleName[0]': clean(answers.father_middle_name, 60),
    'Pt5Line3_DateofBirth[0]': dateMdY(answers.father_dob),
    'Pt5Line5_CityTownOfBirth[0]': clean(answers.father_city_of_birth, 60),
    'Pt5Line6_FamilyName[0]': clean(answers.mother_family_name, 60),
    'Pt5Line6_GivenName[0]': clean(answers.mother_given_name, 60),
    'Pt5Line6_MiddleName[0]': clean(answers.mother_middle_name, 60),
    'Pt5Line8_DateofBirth[0]': dateMdY(answers.mother_dob),
    'Pt5Line10_CityTownOfBirth[0]': clean(answers.mother_city_of_birth, 60),

    // Part 6 — Marital history
    'Pt6Line3_TimesMarried[0]': clean(answers.times_married, 4),
    'Pt6Line4_FamilyName[0]': clean(answers.spouse_family_name, 60),
    'Pt6Line4_GivenName[0]': clean(answers.spouse_given_name, 60),
    'Pt6Line4_MiddleName[0]': clean(answers.spouse_middle_name, 60),
    'Pt6Line5_AlienNumber[0]': digits(answers.spouse_alien_number, 9),

    // Part 7 — Biographic
    'Pt7Line3_HeightFeet[0]': clean(answers.height_feet, 2),
    'Pt7Line3_HeightInches[0]': clean(answers.height_inches, 2),
    'Pt7Line4_Weight1[0]': clean(answers.weight_hundreds, 1),
    'Pt7Line4_Weight2[0]': clean(answers.weight_tens, 1),
    'Pt7Line4_Weight3[0]': clean(answers.weight_ones, 1),

    // Part 10 — Contact / Signature
    'Pt3Line3_DaytimePhoneNumber1[0]': phone,
    'Pt3Line4_MobileNumber1[0]': mobile,
    'Pt3Line5_Email[0]': email,
    'Pt3Line7b_DateofSignature[0]': dateMdY(today),

    // Interpreter (Part 11)
    'Pt11Line1a_FamilyName[0]': clean(answers.interpreter_family_name, 60),
    'Pt11Line1b_GivenName[0]': clean(answers.interpreter_given_name, 60),
    'Pt11Line2_OrgName[0]': clean(answers.interpreter_org_name, 80),
    'Part11_NameofLanguage[0]': clean(answers.interpreter_language, 40),

    // Preparer (Part 12)
    'Pt12Line1_PreparerFamilyName[0]': clean(answers.preparer_family_name, 60),
    'Pt12Line1a_PreparerGivenName[0]': clean(answers.preparer_given_name, 60),
    'Pt12Line2_BusinessName[0]': clean(answers.preparer_business_name, 80),
    'Pt12Line3_PreparerDaytimePhoneNumber1[0]': usPhoneDigits(answers.preparer_phone),
    'Pt12Line5_PreparerEmail[0]': clean(answers.preparer_email, 180),

    // Repeating A-number header on all pages
    ...alienNumberFields(answers.alien_number),

    // Composite field groups
    ...sexFields(answers.sex),
    ...maritalStatusFields(answers.marital_status),
    ...ethnicityFields(answers.ethnicity),
    ...raceFields(answers.race),
    ...eyeColorFields(answers.eye_color),
    ...hairColorFields(answers.hair_color),
    ...admissionBasisFields(answers.admission_basis || answers.status_at_last_entry),
    ...eligibilityFields(answers.eligibility_basis),
    ...checkboxPair(sameAddress5yrs, 'Pt1Line18_last5yrs_YN[0]', 'Pt1Line18_last5yrs_YN[1]'),
    ...usAddress(answers)
  };

  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

module.exports = { i485FieldValues, dateMdY };
