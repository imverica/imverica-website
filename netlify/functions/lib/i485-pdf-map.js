const normalizedI485Map = require('../../../overlay-maps/normalized/i-485.json');

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

function checkboxGroupValue(value, fieldPrefix, selectedValue, optionCount) {
  if (selectedValue === undefined || selectedValue === null || selectedValue === '') return {};
  const result = {};
  for (let i = 0; i < optionCount; i += 1) result[`${fieldPrefix}[${i}]`] = String(i) === String(selectedValue);
  return result;
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

function firstHistoryRow(value) {
  return Array.isArray(value) ? (value.find((row) => row && typeof row === 'object') || {}) : {};
}

function splitCityState(value) {
  const text = clean(value, 120);
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  return {
    city: parts[0] || text,
    state: parts[1] || ''
  };
}

function weightParts(value) {
  const padded = digits(value, 3).padStart(3, '0').slice(-3);
  return {
    hundreds: padded[0] || '',
    tens: padded[1] || '',
    ones: padded[2] || ''
  };
}

function priorMarriageEndTypeValue(value) {
  const text = clean(value, 80).toLowerCase();
  if (text === '0' || /widow/.test(text)) return '0';
  if (text === '1' || /annul/.test(text)) return '1';
  if (text === '2' || /other/.test(text)) return '2';
  if (text === '3' || /divorc/.test(text)) return '3';
  return '';
}

// AlienNumber[0..23] repeats as a running header on every page
function alienNumberFields(value) {
  const a = digits(value, 9);
  if (!a) return {};
  const result = {};
  for (let i = 0; i <= 23; i++) result[`AlienNumber[${i}]`] = a;
  return result;
}

// Normalized I-485 map uses the actual PDF field order: [1]=Male, [0]=Female.
function sexFields(value) {
  const sex = clean(value, 80).toLowerCase();
  if (/^(m|male|муж|чолов|masc)\b/.test(sex)) {
    return { 'Pt1Line6_CB_Sex[0]': false, 'Pt1Line6_CB_Sex[1]': true };
  }
  if (/^(f|female|жен|жін|fem)\b/.test(sex)) {
    return { 'Pt1Line6_CB_Sex[0]': true, 'Pt1Line6_CB_Sex[1]': false };
  }
  return {};
}

// Pt6Line1_MaritalStatus follows the PDF's actual option order:
// [1]=Single, [3]=Married, [0]=Divorced, [2]=Widowed, [4]=Annulled, [5]=Legally Separated
function maritalStatusFields(value) {
  const s = clean(value, 120).toLowerCase();
  let idx = -1;
  if (/single|never|холост|не в браке|не в шлюб/.test(s)) idx = 1;
  else if (/married|spouse|брак|женат|замуж|шлюб|одруж/.test(s)) idx = 3;
  else if (/divorc|развед|розлуч/.test(s)) idx = 0;
  else if (/widow|вдов/.test(s)) idx = 2;
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

function priorUsAddressFields(answers) {
  const prior = firstHistoryRow(answers.prior_us_addresses || answers.addresses_last_five_years);
  if (!prior.line1 && !prior.city) return {};
  const unit = clean(prior.line2);
  return {
    'Pt1Line18_PriorStreetName[0]': clean(prior.line1, 80),
    'Pt1Line18_PriorAddress_Number[0]': unitNumber(unit),
    'Pt1Line18_PriorCity[0]': clean(prior.city, 60),
    'Pt1Line18_PriorState[0]': stateCode(prior.state),
    'Pt1Line18_PriorZipCode[0]': digits(prior.zip, 10),
    'Pt1Line18_PriorCountry[0]': clean(prior.country || 'United States', 60),
    'Pt1Line18_PriorDateFrom[0]': dateMdY(prior.from),
    'Pt1Line18PriorDateTo[0]': dateMdY(prior.to),
    ...(unit ? unitCheckbox(unit, 'Pt1Line18_PriorAddress_Unit[0]', 'Pt1Line18_PriorAddress_Unit[2]', 'Pt1Line18_PriorAddress_Unit[1]') : {})
  };
}

function lastForeignAddressFields(answers) {
  const foreign = firstHistoryRow(answers.last_foreign_address);
  if (!foreign.line1 && !foreign.city) return {};
  const unit = clean(foreign.line2);
  return {
    'Pt1Line18_RecentStreetName[0]': clean(foreign.line1, 80),
    'Pt1Line18_RecentNumber[0]': unitNumber(unit),
    'Pt1Line18_RecentCity[0]': clean(foreign.city, 60),
    'Pt1Line18_RecentProvince[0]': clean(foreign.state, 60),
    'Pt1Line18_RecentPostalCode[0]': clean(foreign.zip, 20),
    'Pt1Line18_RecentCountry[0]': clean(foreign.country, 60),
    'Pt1Line18_RecentDateFrom[0]': dateMdY(foreign.from),
    'Pt1Line18_RecentDateTo[0]': dateMdY(foreign.to),
    ...(unit ? unitCheckbox(unit, 'Pt1Line18_RecentUnit[0]', 'Pt1Line18_RecentUnit[2]', 'Pt1Line18_RecentUnit[1]') : {})
  };
}

function employmentFields(answers) {
  const current = firstHistoryRow(answers.current_employment_history || answers.employment_school_last_five_years);
  const foreign = firstHistoryRow(answers.foreign_employment_history);
  return {
    'Pt4Line7_EmployerName[0]': clean(answers.employer_name || current.name, 80),
    'Pt4Line7_DateFrom[0]': dateMdY(current.from),
    'Pt4Line7_DateTo[0]': dateMdY(current.to),
    'Pt4Line8_EmployerName[0]': clean(foreign.name, 80),
    'Pt4Line8_Occupation[0]': clean(foreign.occupation || foreign.activity, 60),
    'Pt4Line8_DateFrom[0]': dateMdY(foreign.from),
    'Pt4Line8_DateTo[0]': dateMdY(foreign.to)
  };
}

const NORMALIZED_FIELDS = Array.isArray(normalizedI485Map.fields) ? normalizedI485Map.fields : [];
const NORMALIZED_FIELDS_BY_KEY = NORMALIZED_FIELDS.reduce((map, field) => {
  if (!field?.key) return map;
  const entries = map.get(field.key) || [];
  entries.push(field);
  map.set(field.key, entries);
  return map;
}, new Map());

function pdfFieldNameFromOriginal(originalKey) {
  return clean(originalKey, 300).split('.').pop();
}

function originalFieldNames(field) {
  if (!field) return [];
  if (Array.isArray(field.originalKeys)) return field.originalKeys.map(pdfFieldNameFromOriginal).filter(Boolean);
  if (field.originalKey) return [pdfFieldNameFromOriginal(field.originalKey)].filter(Boolean);
  return [];
}

function isSyntheticOverlayField(field) {
  const originals = [
    ...(Array.isArray(field?.originalKeys) ? field.originalKeys : []),
    field?.originalKey
  ].filter(Boolean);
  return originals.some((original) => /^(imverica-added|imverica\.generated)\./.test(String(original)));
}

function hasExactScenarioFields(answers) {
  return Object.keys(answers || {}).some((key) => key === 'AlienNumber' || NORMALIZED_FIELDS_BY_KEY.has(key));
}

function exactText(value, max = 1000) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function isPresentExactValue(value) {
  return value !== undefined && value !== null && exactText(value, 1000) !== '';
}

function exactSelectedValue(key, rawValue) {
  const text = exactText(rawValue, 80);
  const lower = text.toLowerCase();
  if (/yesno/i.test(key)) {
    if (['yes', 'y', 'да', 'так', 'sí', 'si', 'true'].includes(lower)) return '1';
    if (['no', 'n', 'нет', 'ні', 'false'].includes(lower)) return '0';
  }
  return text;
}

function exactScenarioFieldValues(answers = {}) {
  if (!hasExactScenarioFields(answers)) return {};

  const result = {};

  for (const [key, rawValue] of Object.entries(answers)) {
    if (!isPresentExactValue(rawValue)) continue;

    if (key === 'AlienNumber') {
      Object.assign(result, alienNumberFields(rawValue));
      continue;
    }

    const fields = NORMALIZED_FIELDS_BY_KEY.get(key) || [];
    if (!fields.length) continue;

    for (const field of fields) {
      if (isSyntheticOverlayField(field)) continue;

      const names = originalFieldNames(field);
      if (!names.length) continue;

      if (field.mode === 'checkbox_group' || field.mode === 'radio_group') {
        const selectedValue = exactSelectedValue(key, rawValue);
        const options = Array.isArray(field.options) ? field.options : [];
        options.forEach((option, index) => {
          const name = names[index];
          if (!name) return;
          result[name] = exactText(option.value, 80) === selectedValue;
        });
        continue;
      }

      names.forEach((name) => {
        result[name] = rawValue;
      });
    }
  }

  return result;
}

function i485TextOverlays(payload = {}) {
  const answers = payload.formAnswers || payload.answers || {};

  const overlays = [];

  for (const [key, rawValue] of Object.entries(answers)) {
    if (!isPresentExactValue(rawValue)) continue;

    const fields = NORMALIZED_FIELDS_BY_KEY.get(key) || [];
    for (const field of fields) {
      if (!isSyntheticOverlayField(field)) continue;
      overlays.push({
        key,
        page: Number(field.page),
        text: exactText(rawValue, 240),
        x: Number(field.x || 0) + 5,
        y: Number(field.y || 0) + 3,
        size: Number(field.size || 10)
      });
    }
  }

  const currentEmployment = firstHistoryRow(answers.current_employment_history || answers.employment_school_last_five_years);
  [
    ['Pt4Line7_NameOfEmployer', answers.current_employer_name || answers.employer_name || currentEmployment.name],
    ['Pt4Line7_Occupation', answers.current_occupation || currentEmployment.occupation || currentEmployment.activity],
    ['Pt6Line13_DateofBirth', answers.prior_spouse_dob],
    ['Pt6Line17_CityTownOfMarriage', answers.prior_spouse_marriage_city],
    ['Pt6Line17_State', answers.prior_spouse_marriage_state],
    ['Pt6Line17_Country', answers.prior_spouse_marriage_country],
    ['Pt6Line18_DateMarriageEnded', dateMdY(answers.prior_spouse_marriage_end_date)]
  ].forEach(([key, value]) => {
    if (!isPresentExactValue(value)) return;
    const fields = NORMALIZED_FIELDS_BY_KEY.get(key) || [];
    for (const field of fields) {
      if (!isSyntheticOverlayField(field)) continue;
      overlays.push({
        key,
        page: Number(field.page),
        text: exactText(value, 240),
        x: Number(field.x || 0) + 5,
        y: Number(field.y || 0) + 3,
        size: Number(field.size || 10)
      });
    }
  });

  return overlays;
}

function i485FieldValues(payload = {}) {
  const answers = payload.formAnswers || payload.answers || {};
  const exactValues = exactScenarioFieldValues(answers);
  const contact = payload.contact || {};
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
  const physicalSameAsMailing = yesNo(answers.physical_same_as_mailing);
  const placeEntry = splitCityState(answers.place_entry);
  const weight = weightParts(answers.weight_lbs || `${answers.weight_hundreds || ''}${answers.weight_tens || ''}${answers.weight_ones || ''}`);

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
    'Pt1Line10_CityTown[0]': clean(answers.port_of_entry_city || placeEntry.city, 60),
    'Pt1Line10_State[0]': stateCode(answers.port_of_entry_state || placeEntry.state),
    'Pt1Line10_DateofArrival[0]': dateMdY(answers.date_of_arrival || answers.last_arrival_date),
    'Pt1Line10_NonImmDate[0]': clean(answers.status_expiration_date, 20),

    // Admission basis and status at entry
    'Pt1Line11_Admitted[0]': clean(answers.status_at_last_entry, 40),
    'Pt1Line11_Paroled[0]': clean(answers.paroled_as, 40),

    // Current immigration status (Part 1, lines 12–17)
    'P1Line12_I94[0]': clean(answers.i94_number, 20),
    'Pt1Line12_Date[0]': dateMdY(answers.date_of_last_entry || answers.last_arrival_date),
    'Pt1Line12_Status[0]': clean(answers.manner_of_last_entry, 60),
    'Pt1Line14_Status[0]': clean(answers.current_immigration_status, 80),
    'Pt1Line15_Date[0]': clean(answers.authorized_stay_expires, 20),
    ...checkboxPair(inProceedings, 'Pt1Line13_YN[0]', 'Pt1Line13_YN[1]'),
    ...checkboxPair(priorOrder, 'Pt1Line16_YN[0]', 'Pt1Line16_YN[1]'),
    ...checkboxPair(everRemoved, 'Pt1Line17_YN[0]', 'Pt1Line17_YN[1]'),

    // SSN
    ...checkboxPair(hasSsn, 'Pt1Line19_YN[1]', 'Pt1Line19_YN[0]'),
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
    ...checkboxPair(currentlyWorking, 'Pt4Line5_YN[1]', 'Pt4Line5_YN[0]'),
    ...checkboxPair(unauthorizedWork, 'Pt4Line6_YN[1]', 'Pt4Line6_YN[0]'),
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
    'Pt5Line7_FamilyName[0]': clean(answers.mother_birth_family_name, 60),
    'Pt5Line7_GivenName[0]': clean(answers.mother_birth_given_name, 60),
    'Pt5Line7_MiddleName[0]': clean(answers.mother_birth_middle_name, 60),
    'Pt5Line8_DateofBirth[0]': dateMdY(answers.mother_dob),
    'Pt5Line10_CityTownOfBirth[0]': clean(answers.mother_city_of_birth, 60),

    // Part 6 — Marital history
    'Pt6Line3_TimesMarried[0]': clean(answers.times_married, 4),
    'Pt6Line4_FamilyName[0]': clean(answers.spouse_family_name, 60),
    'Pt6Line4_GivenName[0]': clean(answers.spouse_given_name, 60),
    'Pt6Line4_MiddleName[0]': clean(answers.spouse_middle_name, 60),
    'Pt6Line5_AlienNumber[0]': digits(answers.spouse_alien_number, 9),
    'Pt6Line7_Country[0]': clean(answers.spouse_country_of_birth, 60),
    'Pt6Line9_DateofMarriage[0]': dateMdY(answers.current_marriage_date),
    'Pt6Line10_CityTownOfBirth[0]': clean(answers.current_marriage_city, 60),
    'Pt6Line10_State[0]': clean(answers.current_marriage_state, 60),
    'Pt6Line10_Country[0]': clean(answers.current_marriage_country, 60),
    'Pt6Line12_FamilyName[0]': clean(answers.prior_spouse_family_name, 60),
    'Pt6Line12_GivenName[0]': clean(answers.prior_spouse_given_name, 60),
    'Pt6Line12_MiddleName[0]': clean(answers.prior_spouse_middle_name, 60),
    'Pt6Line14_Country[0]': clean(answers.prior_spouse_country_of_birth, 60),
    'Pt6Line15_Country[0]': clean(answers.prior_spouse_country_of_citizenship, 60),
    'Pt6Line16_DateofBirth[0]': dateMdY(answers.prior_spouse_marriage_date),
    'Pt6Line18_CityTownOfBirth[0]': clean(answers.prior_spouse_marriage_end_city, 60),
    'Pt6Line18_State[0]': clean(answers.prior_spouse_marriage_end_state, 60),
    'Pt6Line18_Country[0]': clean(answers.prior_spouse_marriage_end_country, 60),
    'Pt6Line19_HowMarriageEndedOther[0]': clean(answers.prior_spouse_marriage_end_other, 60),

    // Part 6 / 7 — Children
    'Pt6Line1_TotalChildren[0]': clean(answers.total_children, 3),
    'Pt7Line2_FamilyName[0]': clean(answers.child1_family_name, 60),
    'Pt7Line2_GivenName[0]': clean(answers.child1_given_name, 60),
    'Pt7Line2_MiddleName[0]': clean(answers.child1_middle_name, 60),
    'Pt7Line2_AlienNumber[0]': digits(answers.child1_alien_number, 9),
    'Pt7Line2_DateofBirth[0]': dateMdY(answers.child1_dob),
    'Pt7Line2_Country[0]': clean(answers.child1_country_of_birth, 60),
    'Pt7Line2_Relationship[0]': clean(answers.child1_relationship, 60),
    ...checkboxPair(yesNo(answers.child1_applying_with_you), 'Pt7Line2_YN[1]', 'Pt7Line2_YN[0]'),
    'Pt7Line3_FamilyName[0]': clean(answers.child2_family_name, 60),
    'Pt7Line3_GivenName[0]': clean(answers.child2_given_name, 60),
    'Pt7Line3_MiddleName[0]': clean(answers.child2_middle_name, 60),
    'Pt7Line3_AlienNumber[0]': digits(answers.child2_alien_number, 9),
    'Pt7Line3_DateofBirth[0]': dateMdY(answers.child2_dob),
    'Pt7Line3_Country[0]': clean(answers.child2_country_of_birth, 60),
    'Pt7Line3_Relationship[0]': clean(answers.child2_relationship, 60),
    ...checkboxPair(yesNo(answers.child2_applying_with_you), 'Pt7Line3_YN[1]', 'Pt7Line3_YN[0]'),

    // Part 7 — Biographic
    'Pt7Line3_HeightFeet[0]': clean(answers.height_feet, 2),
    'Pt7Line3_HeightInches[0]': clean(answers.height_inches, 2),
    'Pt7Line4_Weight1[0]': clean(answers.weight_hundreds || weight.hundreds, 1),
    'Pt7Line4_Weight2[0]': clean(answers.weight_tens || weight.tens, 1),
    'Pt7Line4_Weight3[0]': clean(answers.weight_ones || weight.ones, 1),

    // Part 10 — Contact / Signature
    'Pt3Line3_DaytimePhoneNumber1[0]': phone,
    'Pt3Line4_MobileNumber1[0]': mobile,
    'Pt3Line5_Email[0]': email,
    'Pt3Line7b_DateofSignature[0]': dateMdY(answers.applicant_signature_date),

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
    ...checkboxGroupValue(answers.prior_spouse_marriage_end_type, 'Pt6Line19_MaritalStatus', priorMarriageEndTypeValue(answers.prior_spouse_marriage_end_type), 4),
    ...checkboxPair(sameAddress5yrs, 'Pt1Line18_last5yrs_YN[0]', 'Pt1Line18_last5yrs_YN[1]'),
    ...checkboxPair(physicalSameAsMailing, 'Pt1Line18_YN[0]', 'Pt1Line18_YN[1]'),
    ...priorUsAddressFields(answers),
    ...lastForeignAddressFields(answers),
    ...employmentFields(answers),
    ...usAddress(answers)
  };

  const semanticValues = Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  return { ...semanticValues, ...exactValues };
}

module.exports = { i485FieldValues, i485TextOverlays, dateMdY };
