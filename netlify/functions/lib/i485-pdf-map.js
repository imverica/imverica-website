const normalizedI485Map = require('../../../overlay-maps/normalized/i-485.json');
const part9Logic = require('../../../form-logic/i-485.part9.json');
const {
  categoryByValue,
  I864_INDEX,
  I864_OPTIONS,
  PUBLIC_CHARGE_OPTIONS,
  PUBLIC_CHARGE_NOT_EXEMPT
} = require('./i485-categories');
const {
  CATEGORY_KEY_BY_BASIS,
  EB_RELATIVE_OPTIONS,
  RELATIVE_OPTIONS,
  RELATIVE_STATUS_OPTIONS,
  STATUS_EXPIRATION_KINDS,
  INCOME_OPTIONS,
  ASSET_OPTIONS,
  LIABILITY_OPTIONS,
  EDUCATION_OPTIONS
} = require('./i485-review-steps');

function clean(value, max = 300) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  if (value === 0) return '0';
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

function usPhonePdf(value) {
  const phone = usPhoneDigits(value);
  if (phone.length !== 10) return phone;
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
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

// Edition 09/18/26: the A-Number is one field name, Pt1Line4_AlienNumber[0..24]:
// the running header on every page plus Part 1, Item 4 ([2], page 2).
// (Edition 01/20/25 used AlienNumber[0..23] for the headers.)
function alienNumberFields(value) {
  const a = digits(value, 9);
  if (!a) return {};
  const result = {};
  for (let i = 0; i <= 24; i++) result[`Pt1Line4_AlienNumber[${i}]`] = a;
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

// Pt7Line1_Ethnicity: [0]=Hispanic/Latino, [1]=Not Hispanic/Latino.
// The wizard option "Not Hispanic or Latino" also contains "Hispanic", so the
// negative forms are checked first.
function ethnicityFields(value) {
  const text = clean(value, 80).toLowerCase();
  if (!text) return {};
  if (/^(?:not|non|no|не|ні)[\s-]|not hispanic|non-?hispanic/.test(text)) {
    return { 'Pt7Line1_Ethnicity[0]': false, 'Pt7Line1_Ethnicity[1]': true };
  }
  if (/hispanic|latino|latina|іспан/.test(text)) {
    return { 'Pt7Line1_Ethnicity[0]': true, 'Pt7Line1_Ethnicity[1]': false };
  }
  return { 'Pt7Line1_Ethnicity[0]': false, 'Pt7Line1_Ethnicity[1]': true };
}

// Pt7Line2_Race follows the current PDF order:
// [0]=Asian, [1]=White, [2]=Black/AA, [3]=AI/AN, [4]=NHPI
function raceFields(value) {
  const text = clean(value, 120).toLowerCase();
  const result = {};
  if (/asian|азіат/.test(text)) result['Pt7Line2_Race[0]'] = true;
  if (/white|caucasian|european/.test(text)) result['Pt7Line2_Race[1]'] = true;
  if (/black|african/.test(text)) result['Pt7Line2_Race[2]'] = true;
  if (/indian|alaska|native american/.test(text)) result['Pt7Line2_Race[3]'] = true;
  if (/hawaiian|pacific|islander/.test(text)) result['Pt7Line2_Race[4]'] = true;
  return result;
}

// Pt7Line5_Eyecolor: [0]=Blue, [1]=Black, [2]=Brown, [3]=Gray, [4]=Green, [5]=Hazel, [6]=Maroon, [7]=Pink, [8]=Unknown
const EYE_COLORS = ['blue', 'black', 'brown', 'gray', 'green', 'hazel', 'maroon', 'pink', 'unknown'];
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

// Part 1, Line 11 admission basis.
// The PDF field prefix is Pt2 despite this being Part 1 content:
// [0]=admitted after inspection, [1]=paroled, [2]=without admission/parole, [3]=other.
function admissionBasisFields(value) {
  const text = clean(value, 120).toLowerCase();
  if (/parol/.test(text)) {
    return { 'Pt2Line11_CB[0]': false, 'Pt2Line11_CB[1]': true, 'Pt2Line11_CB[2]': false, 'Pt2Line11_CB[3]': false };
  }
  if (/without.*(admission|parole)|no admission|entered without|ewi/.test(text)) {
    return { 'Pt2Line11_CB[0]': false, 'Pt2Line11_CB[1]': false, 'Pt2Line11_CB[2]': true, 'Pt2Line11_CB[3]': false };
  }
  if (/admitted|inspected|nonimmigrant|non-immigrant|immigrant|visitor|student|worker|exchange|b-?2|f-?1|j-?1|h-?1b/.test(text)) {
    return { 'Pt2Line11_CB[0]': true, 'Pt2Line11_CB[1]': false, 'Pt2Line11_CB[2]': false, 'Pt2Line11_CB[3]': false };
  }
  if (text) return { 'Pt2Line11_CB[0]': false, 'Pt2Line11_CB[1]': false, 'Pt2Line11_CB[2]': false, 'Pt2Line11_CB[3]': true };
  return {};
}

// Part 1, Item 11. A refugee was inspected and admitted as a refugee, whatever
// the wizard's entry-type answer (there is no "refugee" option there).
function isRefugee(category) {
  return Boolean(category && category.field === 'Pt2Line3d_AsyleeRefugeeCB[1]');
}

function refugeeAdmission(admissionBasis, category) {
  if (!isRefugee(category) || /parol|without|ewi/i.test(clean(admissionBasis, 80))) return admissionBasis;
  return 'admitted';
}

// The text goes next to the box that is ticked: [0] admitted as, [1] paroled
// as, [3] other.
function admissionTextFields(answers, admissionBasis, category) {
  const ticked = admissionBasisFields(refugeeAdmission(admissionBasis, category));
  const status = clean(answers.status_at_last_entry, 40);
  if (ticked['Pt2Line11_CB[1]']) return { 'Pt1Line11_Paroled[0]': clean(answers.paroled_as || status, 40) };
  if (ticked['Pt2Line11_CB[3]']) return { 'Pt1Line11_Other[0]': clean(status || answers.manner_of_last_entry, 60) };
  if (ticked['Pt2Line11_CB[0]']) return { 'Pt1Line11_Admitted[0]': status || (isRefugee(category) ? 'REFUGEE' : '') };
  return {};
}

// Part 2, Item 3 (edition 09/18/26). The category comes from the wizard's
// per-basis select (see i485-categories.js); answers saved before it existed
// carry free text in eligibility_basis, matched onto the same list here.
const LEGACY_CATEGORY_PATTERNS = [
  [/\bir.?1\b|\bcr.?1\b|spouse.*(usc|u\.?s\.? citizen)|(usc|u\.?s\.? citizen).*spouse/, 'Spouse of a U.S. citizen'],
  [/\bir.?2\b|\bcr.?2\b|child.*(usc|u\.?s\.? citizen)/, 'Unmarried child under 21 of a U.S. citizen'],
  [/\bir.?5\b|parent.*(usc|u\.?s\.? citizen)/, 'Parent of a U.S. citizen (citizen is 21 or older)'],
  [/\bk.?[12]\b|fianc/, 'K-1 fiance(e) or K-2 child of a U.S. citizen'],
  [/\biw\b|widow/, 'Widow or widower of a U.S. citizen'],
  [/\bf1\b/, 'F1: Unmarried son or daughter (21+) of a U.S. citizen'],
  [/\bf2a\b.*child|child.*\bf2a\b/, 'F2A: Unmarried child under 21 of a permanent resident'],
  [/\bf2a\b|spouse.*(lpr|permanent resident)/, 'F2A: Spouse of a permanent resident'],
  [/\bf2b\b/, 'F2B: Unmarried son or daughter (21+) of a permanent resident'],
  [/\bf3\b/, 'F3: Married son or daughter of a U.S. citizen'],
  [/\bf4\b|sibling|brother|sister/, 'F4: Brother or sister of a U.S. citizen (citizen is 21 or older)'],
  [/vawa/, 'VAWA self-petitioning spouse'],
  [/eb.?5|investor|i-?526/, 'Investor (Form I-526 or I-526E)'],
  [/eb.?1a|extraordinary/, 'EB-1: Alien of extraordinary ability'],
  [/eb.?1b|outstanding/, 'EB-1: Outstanding professor or researcher'],
  [/eb.?1c|multinational/, 'EB-1: Multinational executive or manager'],
  [/\bniw\b|national interest/, 'EB-2: National Interest Waiver'],
  [/eb.?2/, 'EB-2: Advanced degree or exceptional ability (no NIW)'],
  [/eb.?3w|unskilled|other worker/, 'EB-3: Other worker'],
  [/eb.?3.*skilled|skilled worker/, 'EB-3: Skilled worker'],
  [/eb.?3/, 'EB-3: Professional'],
  [/\bsij\b|special.*juvenile/, 'Special Immigrant Juvenile'],
  [/afghan|iraqi/, 'Certain Afghan or Iraqi national'],
  [/broadcaster/, 'Certain international broadcaster'],
  [/minister/, 'Religious worker: minister of religion'],
  [/religious/, 'Religious worker: other religious worker'],
  [/asylee|asylum/, 'Asylee (INA 208, Form I-589 or I-730)'],
  [/refugee/, 'Refugee (INA 207, Form I-590 or I-730)'],
  [/\bt.?(visa|nonimmigrant)|trafficking/, 'T nonimmigrant (human trafficking victim)'],
  [/\bu.?(visa|nonimmigrant)|245.?m|crime.*victim/, 'U nonimmigrant (victim of qualifying criminal activity)'],
  [/cuban/, 'Cuban Adjustment Act'],
  [/hrifa|haitian/, 'HRIFA: dependent status'],
  [/lautenberg/, 'Lautenberg parolee'],
  [/diversity|\bdv\b|lottery/, 'Diversity Visa program'],
  [/registry|1972/, 'Continuous residence since before January 1, 1972 (Registry)']
];

function selectedCategory(answers) {
  const basis = clean(answers.adjustment_basis, 80);
  const key = CATEGORY_KEY_BY_BASIS[basis];
  if (key && categoryByValue(answers[key])) return categoryByValue(answers[key]);
  if (basis === 'Diversity visa') return categoryByValue('Diversity Visa program');
  const text = clean(firstPresentValue(answers.eligibility_basis, answers.adjustment_basis), 160).toLowerCase();
  const match = LEGACY_CATEGORY_PATTERNS.find(([pattern]) => pattern.test(text));
  return match ? categoryByValue(match[1]) : null;
}

function exclusiveGroup(prefix, count, selected) {
  if (selected === null || selected === undefined || selected < 0) return {};
  const result = {};
  for (let i = 0; i < count; i += 1) result[`${prefix}[${i}]`] = i === selected;
  return result;
}

// Part 2, Item 3 checkbox and its follow-ups; Item 4 (INA 245(i)) only where
// the form asks it: family, employment, special immigrant and DV categories.
function categoryFields(answers, category) {
  if (!category) return checkboxPair(yesNo(answers.ina_245i_adjustment), 'Pt2Line4_CB[1]', 'Pt2Line4_CB[0]');
  const result = { [category.field]: true };
  if (category.field === 'Pt2Line3d_AsyleeRefugeeCB[0]') result['Pt2Line3d_Asylum[0]'] = dateMdY(answers.asylum_grant_date);
  if (category.field === 'Pt2Line3d_AsyleeRefugeeCB[1]') result['Pt2Line3d_Refugee[0]'] = dateMdY(answers.refugee_admission_date);
  if (category.field === 'Pt2Line3g_CB[0]') result['Pt2Line1g_DV[0]'] = clean(answers.dv_rank_number, 30);
  if (category.field === 'Pt2Line3g_CB[4]') result['Pt2Line1g_OtherEligibility[0]'] = clean(answers.other_eligibility_text, 120);
  // Did a relative file the I-140? [0]=N/A (I-140 self-petition) [1]=No
  // [2]=Yes, then who (Pt2Relative_CB) and their status (Pt2RelativeType_CB).
  // Investors (I-526) leave it blank.
  if (category.i864 === 'relative') {
    const answer = EB_RELATIVE_OPTIONS.indexOf(clean(answers.eb_relative_petitioner, 80));
    Object.assign(result, exclusiveGroup('Pt2Line3b_CB140Assoc', 3, [2, 1, 0][answer] ?? -1));
    if (answer === 0) {
      Object.assign(result, exclusiveGroup('Pt2Relative_CB', 8, RELATIVE_OPTIONS.indexOf(clean(answers.eb_relative_relationship, 40))));
      Object.assign(result, exclusiveGroup('Pt2RelativeType_CB', 4, RELATIVE_STATUS_OPTIONS.indexOf(clean(answers.eb_relative_status, 40))));
    }
  }
  if (category.ina245i) Object.assign(result, checkboxPair(yesNo(answers.ina_245i_adjustment), 'Pt2Line4_CB[1]', 'Pt2Line4_CB[0]'));
  return result;
}

// Part 3: [0]=1.a ... [4]=1.e (not required by statute), [5]=1.f (required).
function affidavitSupportFields(answers, category) {
  if (!category) return {};
  let code = category.i864;
  if (code === 'relative') {
    const answer = EB_RELATIVE_OPTIONS.indexOf(clean(answers.eb_relative_petitioner, 80));
    code = answer === 0 ? '1.f' : answer > 0 ? '1.e' : '';
  }
  if (code === 'ask') {
    const chosen = I864_OPTIONS.find(([, label]) => label === clean(answers.affidavit_support_exemption, 200));
    code = chosen ? chosen[0] : '';
  }
  return code in I864_INDEX ? exclusiveGroup('Pt3Line1_CB', 6, I864_INDEX[code]) : {};
}

// Part 9, Item 56: the exempt category, or 23 "not exempt"; null if unknown.
function publicChargeIndex(answers, category) {
  if (category && Number.isInteger(category.publicCharge)) return category.publicCharge;
  const chosen = PUBLIC_CHARGE_OPTIONS.find(([, label]) => label === clean(answers.public_charge_exemption, 200));
  return chosen ? chosen[0] : null;
}

const EDUCATION_CHECKBOX = [0, 2, 1, 3, 7, 4, 5, 6];
const PUBLIC_CHARGE_ANSWER_KEYS = /^(?:pc_|Pt9Line63_YesNo$)/;

function lines(value) {
  return String(value || '').split(/\r?\n|;/).map((line) => clean(line, 120)).filter(Boolean);
}

// Part 9, Items 56-64. Exempt applicants skip Items 57-64 (sanitizeI485Answers
// drops their answers); the rest fill household, education, skills and the
// Item 64 benefits table.
function publicChargeFields(answers, index) {
  if (index === null) return {};
  const result = exclusiveGroup('Pt9Line56_CB', 25, index);
  if (index !== PUBLIC_CHARGE_NOT_EXEMPT) return result;
  const optionIndex = (options, value) => options.indexOf(clean(value, 120));
  result['Pt9Line57_HouseholdSize[0]'] = clean(answers.pc_household, 120);
  Object.assign(result, exclusiveGroup('Pt9Line53_CB', 5, optionIndex(INCOME_OPTIONS, answers.pc_income)));
  Object.assign(result, exclusiveGroup('Pt9Line59_CB', 5, optionIndex(ASSET_OPTIONS, answers.pc_assets)));
  Object.assign(result, exclusiveGroup('Pt9Line60_CB', 5, optionIndex(LIABILITY_OPTIONS, answers.pc_liabilities)));
  const education = optionIndex(EDUCATION_OPTIONS, answers.pc_education);
  if (education >= 0) {
    Object.assign(result, exclusiveGroup('Pt9Line61_CB', 8, EDUCATION_CHECKBOX[education]));
    if (education === 0) result['Pt9Line61_diploma[0]'] = clean(answers.pc_highest_grade, 60);
  }
  lines(answers.pc_skills).slice(0, 8).forEach((skill, row) => { result[`TextField${row + 1}[0]`] = skill; });
  for (let row = 1; row <= 4; row += 1) {
    if (!isPresentExactValue(answers[`pc_benefit${row}_name`])) continue;
    result[`Pt8Line68c_Column1Row${row}[0]`] = clean(answers[`pc_benefit${row}_name`], 60);
    result[`Pt8Line68c_Column2Row${row}[0]`] = dateMdY(answers[`pc_benefit${row}_start`]);
    result[`Pt8Line68c_Column3Row${row}[0]`] = dateMdY(answers[`pc_benefit${row}_end`]);
    result[`Pt8Line68c_Column4Row${row}[0]`] = clean(answers[`pc_benefit${row}_amount`], 20);
    result[`Pt8Line68c_Column5Row${row}[0]`] = clean(answers[`pc_benefit${row}_reason`], 60);
  }
  return result;
}

// Part 1, Item 15. Asylee and refugee status has no expiration date: N/A.
function currentStatusExpiration(answers, category) {
  const kind = clean(answers.current_status_expiration_kind, 60);
  if (kind === STATUS_EXPIRATION_KINDS[0]) return dateMdY(answers.current_status_expires_on);
  if (kind === STATUS_EXPIRATION_KINDS[1]) return 'D/S';
  if (kind === STATUS_EXPIRATION_KINDS[2]) return 'N/A';
  if (isPresentExactValue(answers.status_expiration_date)) return dateMdY(answers.status_expiration_date);
  return category && category.section === '3.d' ? 'N/A' : '';
}

// Part 2, Item 2: [0]=principal, [1]=derivative with the principal's details.
function filingAsFields(answers) {
  const as = clean(answers.filing_as, 40).toLowerCase();
  if (as.startsWith('principal')) return { 'Pt2Line2_CB[0]': true, 'Pt2Line2_CB[1]': false };
  if (!as.startsWith('derivative')) return {};
  return {
    'Pt2Line2_CB[0]': false,
    'Pt2Line2_CB[1]': true,
    'Pt2Line2_FamilyName[0]': clean(answers.principal_family_name, 60),
    'Pt2Line2_GivenName[0]': clean(answers.principal_given_name, 60),
    'Pt2Line2_MiddleName[0]': clean(answers.principal_middle_name, 60),
    'Pt2Line2_AlienNumber[0]': digits(answers.principal_alien_number, 9),
    'Pt1Line2_DOB[0]': dateMdY(answers.principal_dob)
  };
}

function isMarried(answers) {
  return /^married/.test(clean(answers.marital_status, 40).toLowerCase());
}

// Part 6, Items 2, 8 and 10. Item 2 is N/A unless married
// (Pt5Line2_YNNA [0]=No [1]=Yes [2]=N/A); Item 8 copies the applicant's
// physical address when the spouse lives there.
function spouseFields(answers) {
  if (!isPresentExactValue(answers.marital_status)) return {};
  if (!isMarried(answers)) return exclusiveGroup('Pt5Line2_YNNA', 3, 2);
  const armed = yesNo(answers.spouse_in_armed_forces);
  const sameAddress = yesNo(answers.spouse_same_address);
  const address = sameAddress === true
    ? { ...physicalAddress(answers), country: 'United States' }
    : sameAddress === false
      ? {
          line1: answers.spouse_physical_address_line1,
          line2: answers.spouse_physical_address_line2,
          city: answers.spouse_physical_city,
          state: answers.spouse_physical_state,
          zip: answers.spouse_physical_zip,
          country: answers.spouse_physical_country
        }
      : null;
  return {
    ...exclusiveGroup('Pt5Line2_YNNA', 3, armed === true ? 1 : armed === false ? 0 : -1),
    ...(address && (address.line1 || address.city) ? employerAddressFields(address, 'P6Line8', 'Part6Line8_StreetName[0]') : {}),
    ...checkboxPair(yesNo(answers.spouse_applying_with_you), 'Pt6Line11_YN[1]', 'Pt6Line11_YN[0]')
  };
}

// The applicant's own business is never printed as the interpreter's or
// preparer's organization.
function organizationName(value) {
  const name = clean(value, 80);
  return /imverica/i.test(name) ? '' : name;
}

// Part 1, Item 18: the first block is the current U.S. PHYSICAL address, the
// second the mailing address, filled only when the two differ. The wizard asks
// for the mailing address first and for the physical one (physical_*) only when
// the answer to "same address?" is No.
// Unit boxes, by on-state: physical Pt1Line18US_Unit [2]=APT [0]=STE [1]=FLR;
// mailing Pt1Line18_CurrentUnit [0]=APT [1]=STE [2]=FLR.
function physicalAddress(answers) {
  return yesNo(answers.physical_same_as_mailing) === false
    ? {
        line1: answers.physical_address_line1 || answers.current_address_line1,
        line2: answers.physical_address_line2 || answers.current_address_line2,
        city: answers.physical_city || answers.current_city,
        state: answers.physical_state || answers.current_state,
        zip: answers.physical_zip || answers.current_zip
      }
    : {
        line1: answers.mailing_address_line1 || answers.current_address_line1,
        line2: answers.mailing_address_line2 || answers.current_address_line2,
        city: answers.mailing_city || answers.current_city,
        state: answers.mailing_state || answers.current_state,
        zip: answers.mailing_zip || answers.current_zip
      };
}

function usAddress(answers) {
  const separateMailing = yesNo(answers.physical_same_as_mailing) === false;
  const physical = physicalAddress(answers);
  const unit = clean(physical.line2);
  const result = {
    'Pt1Line18_StreetNumberName[0]': clean(physical.line1, 80),
    'Pt1Line18US_AptSteFlrNumber[0]': unitNumber(unit),
    'Pt1Line18_CityOrTown[0]': clean(physical.city, 60),
    'Pt1Line18_State[0]': stateCode(physical.state),
    'Pt1Line18_ZipCode[0]': digits(physical.zip, 10),
    ...(answers.date_moved_in ? { 'Pt1Line18_Date[0]': dateMdY(answers.date_moved_in) } : {}),
    ...(unit ? unitCheckbox(unit, 'Pt1Line18US_Unit[2]', 'Pt1Line18US_Unit[0]', 'Pt1Line18US_Unit[1]') : {})
  };
  if (!separateMailing) {
    if (answers.in_care_of_name) result['Part1_Item18_InCareOfName[0]'] = clean(answers.in_care_of_name, 60);
    return result;
  }
  const mailingUnit = clean(answers.mailing_address_line2);
  return {
    ...result,
    ...(answers.in_care_of_name ? { 'Pt1Line18_CurrentInCareOfName[0]': clean(answers.in_care_of_name, 60) } : {}),
    'Pt1Line18_CurrentStreetNumberName[0]': clean(answers.mailing_address_line1, 80),
    'Pt1Line18_CurrentAptSteFlrNumber[0]': unitNumber(mailingUnit),
    'Pt1Line18_CurrentCityOrTown[0]': clean(answers.mailing_city, 60),
    'Pt1Line18_CurrentState[0]': stateCode(answers.mailing_state),
    'Pt1Line18_CurrentZipCode[0]': digits(answers.mailing_zip, 10),
    ...(mailingUnit ? unitCheckbox(mailingUnit, 'Pt1Line18_CurrentUnit[0]', 'Pt1Line18_CurrentUnit[1]', 'Pt1Line18_CurrentUnit[2]') : {})
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

// Part 4, Items 7-8 (edition 09/18/26). Item 7 has two name boxes,
// "Employer or School (current or most recent)" [0] and "Name of Employer,
// Company, or School" [2]; both get the name. [1] is the occupation.
// Unit boxes: P4Line7_Unit / P4Line8_Unit [0]=APT [1]=STE [2]=FLR.
function employerAddressFields(row, prefix, streetField) {
  const unit = clean(row.line2);
  const isUs = !row.country || /^(united states|usa|us)$/i.test(clean(row.country, 40));
  return {
    [streetField]: clean(row.line1, 80),
    [`${prefix}_Number[0]`]: unitNumber(unit),
    [`${prefix}_City[0]`]: clean(row.city, 60),
    ...(isUs
      ? { [`${prefix}_State[0]`]: stateCode(row.state), [`${prefix}_ZipCode[0]`]: digits(row.zip, 10) }
      : { [`${prefix}_Province[0]`]: clean(row.state, 60), [`${prefix}_PostalCode[0]`]: clean(row.zip, 20) }),
    [`${prefix}_Country[0]`]: clean(row.country || (row.line1 || row.city ? 'United States' : ''), 60),
    ...(unit ? unitCheckbox(unit, `${prefix}_Unit[0]`, `${prefix}_Unit[1]`, `${prefix}_Unit[2]`) : {})
  };
}

function employmentFields(answers) {
  const current = firstHistoryRow(answers.current_employment_history || answers.employment_school_last_five_years);
  const foreign = firstHistoryRow(answers.foreign_employment_history);
  const currentName = clean(answers.employer_name || current.name, 80);
  return {
    'Pt4Line7_EmployerName[0]': currentName,
    'Pt4Line7_EmployerName[2]': currentName,
    'Pt4Line7_EmployerName[1]': clean(answers.current_occupation || current.occupation || current.activity, 60),
    ...employerAddressFields(current, 'P4Line7', 'Part4Line7_StreetName[0]'),
    'Pt4Line7_DateFrom[0]': dateMdY(current.from),
    // The first row is the current job; an open end date means it continues.
    'Pt4Line7_DateTo[0]': current.to ? dateMdY(current.to) : (current.from ? 'PRESENT' : ''),
    'Pt4Line8_EmployerName[0]': clean(foreign.name, 80),
    'Pt4Line8_Occupation[0]': clean(foreign.occupation || foreign.activity, 60),
    ...employerAddressFields(foreign, 'P4Line8', 'P4Line8_StreetName[0]'),
    'Pt4Line8_DateFrom[0]': dateMdY(foreign.from),
    'Pt4Line8_DateTo[0]': dateMdY(foreign.to)
  };
}

// Part 14 (page 24): four slots, each Page/Part/Item plus a box ruled for 5
// lines of about 88 characters. Entries that do not fit continue on copies of
// page 24 appended to the PDF (pdf-incremental-fill.js draws them from the
// `newPage` overlays built in i485TextOverlays).
const PART14_SLOTS = [0, 1, 2, 3].map((slot) => ({
  page: `Pt9Line3a_PageNumber[${slot}]`,
  part: `Pt9Line3b_PartNumber[${slot}]`,
  item: `Pt9Line3c_ItemNumber[${slot}]`,
  text: `P14_Line${slot + 2}_AdditionalInfo[0]`
}));
const PART14_LINE_CHARS = 88;
const PART14_SLOT_LINES = 5;
const PART14_TEMPLATE_PAGE = 24;

function explicitPart14SlotUsed(answers, slot) {
  if (slot === 0) return ['Pt9Line3a_PageNumber', 'Pt9Line3b_PartNumber', 'Pt9Line3c_ItemNumber', 'P14_Line2_Title', 'P14_Line2_Address'].some((key) => isPresentExactValue(answers[key]));
  if (slot === 1) return ['Pt9Line4a_PageNumber', 'Pt9Line4b_PartNumber', 'Pt9Line4c_ItemNumber', 'P14_Line3_Title', 'P14_Line3_Employment', 'P14_Line3_Dates', 'P14_Line3_Occupation'].some((key) => isPresentExactValue(answers[key]));
  return false;
}

function wrapPart14(text) {
  const words = String(text || '').replace(/[^\x20-\x7e]/g, ' ').split(/\s+/).filter(Boolean);
  const result = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= PART14_LINE_CHARS) {
      line = candidate;
      continue;
    }
    if (line) result.push(line);
    let rest = word;
    while (rest.length > PART14_LINE_CHARS) {
      result.push(rest.slice(0, PART14_LINE_CHARS));
      rest = rest.slice(PART14_LINE_CHARS);
    }
    line = rest;
  }
  if (line) result.push(line);
  return result;
}

function historyRows(value) {
  return Array.isArray(value)
    ? value.filter((row) => row && typeof row === 'object' && Object.values(row).some((part) => clean(part)))
    : [];
}

function placeText(row) {
  return [row.line1, row.line2, row.city, stateCode(row.state), row.zip, row.country].map((part) => clean(part, 80)).filter(Boolean).join(', ');
}

function periodText(row) {
  return `FROM ${dateMdY(row.from) || 'N/A'} TO ${row.to ? dateMdY(row.to) : 'PRESENT'}`;
}

function withinFiveYears(row) {
  if (!row.to) return true;
  const end = new Date(String(row.to));
  if (Number.isNaN(end.getTime())) return true;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 5);
  return end >= cutoff;
}

function childAdditionalInfo(n, answers) {
  const name = [answers[`child${n}_family_name`], answers[`child${n}_given_name`], answers[`child${n}_middle_name`]].filter(isPresentExactValue).join(' ');
  const pieces = [
    name,
    answers[`child${n}_dob`] ? `DOB ${dateMdY(answers[`child${n}_dob`])}` : '',
    answers[`child${n}_alien_number`] ? `A-${digits(answers[`child${n}_alien_number`], 9)}` : '',
    answers[`child${n}_country_of_birth`] ? `COUNTRY OF BIRTH ${clean(answers[`child${n}_country_of_birth`], 60)}` : '',
    answers[`child${n}_relationship`] ? `RELATIONSHIP ${clean(answers[`child${n}_relationship`], 80)}` : '',
    answers[`child${n}_applying_with_you`] ? `APPLYING WITH APPLICANT: ${clean(answers[`child${n}_applying_with_you`], 20)}` : ''
  ].filter(Boolean);
  return pieces.length ? `CHILD ${n}: ${pieces.join('; ')}` : '';
}

// Explanations the wizard collects for Yes answers in Part 9 (one per trigger
// group), placed under the page and item numbers of the Yes answers.
function part9ExplanationEntries(answers) {
  const entries = [];
  for (const trigger of part9Logic.part14Triggers || []) {
    const text = clean(answers[`part9_explanation_${trigger.id}`], 3000);
    if (!text) continue;
    const yesItems = trigger.items
      .map((number) => PART9_ITEMS_BY_NUMBER.get(number))
      .filter((item) => item && pdfYesNoEquals(answers, item, 'yes'));
    if (!yesItems.length) continue;
    const printed = yesItems.map((item) => item.printed || item.item);
    const itemText = printed.length > 1 ? `${printed[0]}-${printed[printed.length - 1]}` : printed[0];
    entries.push({ page: String(yesItems[0].page), part: '9', item: itemText, rows: [`ITEM${printed.length > 1 ? 'S' : ''} ${printed.join(', ')}: ${text}`] });
  }
  return entries;
}

function part14Entries(answers) {
  const entries = [];
  const add = (page, part, item, rows) => {
    const list = rows.filter(Boolean);
    if (list.length) entries.push({ page, part, item, rows: list });
  };
  const structuredOtherNames = [answers.other_name_family, answers.other_name_given].some(isPresentExactValue);
  if (!structuredOtherNames && isPresentExactValue(answers.other_names_used)) {
    add('1', '1', '2', [`OTHER NAMES USED: ${clean(answers.other_names_used, 900)}`]);
  }
  // Last 5 years: Part 1, Item 18 holds one prior address; the rest go here.
  const addresses = historyRows(answers.prior_us_addresses || answers.addresses_last_five_years);
  add('4', '1', '18', addresses.slice(1).map((row, index) => `PRIOR ADDRESS ${index + 2}: ${placeText(row)}; ${periodText(row)}`));
  // Part 4, Item 7 holds one job or school; the rest of the last 5 years go here,
  // including work abroad other than the employer shown in Item 8.
  const jobs = [
    ...historyRows(answers.current_employment_history || answers.employment_school_last_five_years).slice(1),
    ...historyRows(answers.foreign_employment_history).slice(1).filter(withinFiveYears)
  ];
  add('8', '4', '7', jobs.map((row, index) => {
    const what = [clean(row.name, 80), clean(row.occupation || row.activity, 60) && `OCCUPATION: ${clean(row.occupation || row.activity, 60)}`].filter(Boolean).join('; ');
    const where = placeText(row);
    return `EMPLOYMENT OR SCHOOL ${index + 2}: ${[what, where && `ADDRESS: ${where}`, periodText(row)].filter(Boolean).join('; ')}`;
  }));
  if (isPresentExactValue(answers.additional_spouse_history)) {
    add('11', '6', '11', [`ADDITIONAL SPOUSE/MARRIAGE HISTORY: ${clean(answers.additional_spouse_history, 1500)}`]);
  }
  const children = [];
  for (let n = 3; n <= 8; n += 1) children.push(childAdditionalInfo(n, answers));
  add('12', '7', '3', children);
  const extraSkills = lines(answers.pc_skills).slice(8);
  if (extraSkills.length) add('19', '9', '62', [`SKILLS, LICENSES AND CERTIFICATES (CONTINUED): ${extraSkills.join('; ')}`]);
  entries.push(...part9ExplanationEntries(answers));
  return entries;
}

// Slots in order; the ones that do not fit on page 24 continue on extra pages.
// A row (one address, one job) stays in one slot unless it is longer than a slot.
function part14Layout(answers) {
  const slots = [];
  for (const entry of part14Entries(answers)) {
    let current = [];
    const flush = () => {
      if (current.length) slots.push({ page: entry.page, part: entry.part, item: entry.item, text: current.join('\n') });
      current = [];
    };
    for (const row of entry.rows) {
      const wrapped = wrapPart14(row);
      if (current.length + wrapped.length > PART14_SLOT_LINES) flush();
      for (const line of wrapped) {
        if (current.length === PART14_SLOT_LINES) flush();
        current.push(line);
      }
    }
    flush();
  }
  const free = [0, 1, 2, 3].filter((slot) => !explicitPart14SlotUsed(answers, slot));
  return {
    onForm: slots.slice(0, free.length).map((slot, index) => ({ ...slot, position: free[index] })),
    extra: slots.slice(free.length)
  };
}

function part14FieldValues(answers, layout) {
  const result = {
    // Part 14, Item 1 repeats the applicant's name.
    'Pt1Line1_FamilyName[1]': clean(answers.applicant_family_name, 60),
    'Pt1Line1_GivenName[1]': clean(answers.applicant_given_name, 60),
    'Pt1Line1_MiddleName[1]': clean(answers.applicant_middle_name, 60)
  };
  for (const slot of layout.onForm) {
    const fields = PART14_SLOTS[slot.position];
    result[fields.page] = slot.page;
    result[fields.part] = slot.part;
    result[fields.item] = slot.item;
    result[fields.text] = slot.text;
  }
  return result;
}

function part14ContinuationOverlays(answers, layout) {
  const overlays = [];
  const aNumber = digits(firstPresentValue(answers.alien_number, answers.AlienNumber, answers.Pt1Line4_AlienNumber), 9);
  layout.extra.forEach((slot, index) => {
    const newPage = Math.floor(index / PART14_SLOTS.length) + 1;
    const fields = PART14_SLOTS[index % PART14_SLOTS.length];
    const put = (field, text) => { if (clean(text)) overlays.push({ newPage, templatePage: PART14_TEMPLATE_PAGE, field, text }); };
    if (index % PART14_SLOTS.length === 0) {
      put('Pt1Line4_AlienNumber[24]', aNumber);
      put('Pt1Line1_FamilyName[1]', clean(answers.applicant_family_name, 60));
      put('Pt1Line1_GivenName[1]', clean(answers.applicant_given_name, 60));
      put('Pt1Line1_MiddleName[1]', clean(answers.applicant_middle_name, 60));
    }
    put(fields.page, slot.page);
    put(fields.part, slot.part);
    put(fields.item, slot.item);
    put(fields.text, slot.text);
  });
  return overlays;
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

function firstPresentValue(...values) {
  return values.find(isPresentExactValue) ?? '';
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

function checkboxIndex(value, yesIndex = 0, noIndex = 1) {
  const text = exactText(value, 80).toLowerCase();
  if (['yes', 'y', 'да', 'так', 'sí', 'si', 'true'].includes(text)) return yesIndex;
  if (['no', 'n', 'нет', 'ні', 'false'].includes(text)) return noIndex;
  if (/^\d+$/.test(text)) return Number(text);
  return -1;
}

function checkboxGroupByIndex(value, fieldPrefix, optionCount, yesIndex = 0, noIndex = 1) {
  const selected = checkboxIndex(value, yesIndex, noIndex);
  if (selected < 0 || selected >= optionCount) return {};
  const result = {};
  for (let i = 0; i < optionCount; i += 1) result[`${fieldPrefix}[${i}]`] = i === selected;
  return result;
}

const PDF_CHECKBOX_OPTIONS_BY_BASE = NORMALIZED_FIELDS.reduce((map, field) => {
  if (!['checkbox', 'radio'].includes(field?.kind)) return map;
  for (const name of originalFieldNames(field)) {
    const match = name.match(/^(.+)\[(\d+)\]$/);
    if (!match) continue;
    const base = match[1];
    const index = Number(match[2]);
    const options = map.get(base) || [];
    options[index] = {
      name,
      index,
      x: Number(field.x || 0),
      key: field.key || ''
    };
    map.set(base, options);
  }
  return map;
}, new Map());

const PART9_ITEMS_BY_NUMBER = new Map((part9Logic.items || []).map((item) => [item.item, item]));
const PART9_DEPENDENCIES = Array.isArray(part9Logic.dependencies) ? part9Logic.dependencies : [];
const PUBLIC_CHARGE_ITEM_KEYS = /^(?:Pt9Line57_|Pt9Line53_CB|Pt9Line59_CB|Pt9Line60_CB|Pt9Line61_|Pt9Line6[2-6])/;
const PUBLIC_CHARGE_NOT_EXEMPT_INDEX = 23;

function checkboxOptions(fieldPrefix) {
  return (PDF_CHECKBOX_OPTIONS_BY_BASE.get(fieldPrefix) || []).filter(Boolean);
}

function checkboxOptionByVisualSide(fieldPrefix, side) {
  const options = checkboxOptions(fieldPrefix);
  if (!options.length) return null;
  return options.reduce((picked, option) => {
    if (!picked) return option;
    return side === 'left'
      ? (option.x < picked.x ? option : picked)
      : (option.x > picked.x ? option : picked);
  }, null);
}

function checkboxSelectedIndexFromPdfBase(value, fieldPrefix) {
  const text = exactText(value, 80).toLowerCase();
  if (!isPresentExactValue(value)) return -1;
  if (/^\d+$/.test(text)) return Number(text);
  if (['yes', 'y', 'да', 'так', 'sí', 'si', 'true'].includes(text)) {
    return checkboxOptionByVisualSide(fieldPrefix, 'left')?.index ?? 0;
  }
  if (['no', 'n', 'нет', 'ні', 'false'].includes(text)) {
    return checkboxOptionByVisualSide(fieldPrefix, 'right')?.index ?? 1;
  }
  return -1;
}

function pdfYesNoEquals(answers, item, expected) {
  if (!item?.key) return false;
  const selected = checkboxSelectedIndexFromPdfBase(answers[item.key], item.key);
  if (selected < 0) return false;
  const yesIndex = checkboxOptionByVisualSide(item.key, 'left')?.index ?? 0;
  const noIndex = checkboxOptionByVisualSide(item.key, 'right')?.index ?? 1;
  if (expected === 'yes') return selected === yesIndex;
  if (expected === 'no') return selected === noIndex;
  return false;
}

function part9ConditionMet(answers, condition) {
  const item = PART9_ITEMS_BY_NUMBER.get(condition.item);
  if (!item) return false;
  const expected = String(condition.equals || '').trim().toLowerCase();
  if (item.type === 'yesNo') return pdfYesNoEquals(answers, item, expected);
  const value = clean(answers[item.key], 300).toLowerCase();
  return Boolean(value) && value === expected;
}

function shouldKeepPublicChargeQuestions(answers) {
  if (!isPresentExactValue(answers.Pt9Line56_CB)) return true;
  return checkboxSelectedIndexFromPdfBase(answers.Pt9Line56_CB, 'Pt9Line56_CB') === PUBLIC_CHARGE_NOT_EXEMPT_INDEX;
}

function sanitizeI485Answers(rawAnswers = {}) {
  const answers = { ...rawAnswers };

  for (const dependency of PART9_DEPENDENCIES) {
    const dependentItem = PART9_ITEMS_BY_NUMBER.get(dependency.requireItem);
    if (!dependentItem?.key) continue;
    const isRequired = (dependency.when || []).every((condition) => part9ConditionMet(answers, condition));
    if (!isRequired) delete answers[dependentItem.key];
  }

  if (!shouldKeepPublicChargeQuestions(answers)) {
    for (const key of Object.keys(answers)) {
      if (PUBLIC_CHARGE_ITEM_KEYS.test(key)) delete answers[key];
    }
  }

  // Applicants in an exempt category skip Part 9, Items 57-64 (Item 63 too).
  const publicCharge = publicChargeIndex(answers, selectedCategory(answers));
  if (publicCharge !== null && publicCharge !== PUBLIC_CHARGE_NOT_EXEMPT) {
    for (const key of Object.keys(answers)) {
      if (PUBLIC_CHARGE_ANSWER_KEYS.test(key)) delete answers[key];
    }
  }

  return answers;
}

function checkboxGroupFromPdfBase(value, fieldPrefix, fallbackCount = 2) {
  const options = PDF_CHECKBOX_OPTIONS_BY_BASE.get(fieldPrefix);
  if (!options?.length) return checkboxGroupByIndex(value, fieldPrefix, fallbackCount);

  const selected = checkboxSelectedIndexFromPdfBase(value, fieldPrefix);

  if (selected < 0) return {};
  const result = {};
  const count = Math.max(fallbackCount, options.length);
  for (let i = 0; i < count; i += 1) {
    const name = options[i]?.name || `${fieldPrefix}[${i}]`;
    result[name] = i === selected;
  }
  return result;
}

function legacyPdfBaseForAnswerKey(key) {
  return key;
}

function legacyExactI485Values(answers = {}) {
  const result = {};
  const aNumber = firstPresentValue(answers.alien_number, answers.AlienNumber, answers.Pt1Line4_AlienNumber);
  const aDigits = digits(aNumber, 9);
  const addText = (fieldName, value, formatter = clean) => {
    if (!isPresentExactValue(value)) return;
    result[fieldName] = formatter(value);
  };

  if (aDigits) {
    Object.assign(result, alienNumberFields(aDigits));
    Object.assign(result, checkboxGroupFromPdfBase(0, 'Pt1Line4_YN', 2));
  }

  if (isPresentExactValue(answers.Pt1Line3_YN)) {
    Object.assign(result, checkboxGroupFromPdfBase(answers.Pt1Line3_YN, 'Pt1Line3_YN', 2));
  }

  if (isPresentExactValue(answers.Pt1Line5_YN)) {
    Object.assign(result, checkboxGroupFromPdfBase(answers.Pt1Line5_YN, 'Pt1Line5_YN', 2));
  }

  if (isPresentExactValue(answers.Pt1Line6_CB_Sex)) {
    Object.assign(result, checkboxGroupByIndex(answers.Pt1Line6_CB_Sex, 'Pt1Line6_CB_Sex', 2));
  }

  if (isPresentExactValue(answers.Pt2Line11_CB)) {
    Object.assign(result, checkboxGroupByIndex(answers.Pt2Line11_CB, 'Pt2Line11_CB', 4));
  }

  for (const [key, rawValue] of Object.entries(answers)) {
    if (!isPresentExactValue(rawValue)) continue;
    const base = legacyPdfBaseForAnswerKey(key);
    if (!PDF_CHECKBOX_OPTIONS_BY_BASE.has(base)) continue;
    if (!/^\d+$/.test(exactText(rawValue, 80)) && !/(?:_YN|_YesNo|YesNo)$/.test(base)) continue;
    Object.assign(result, checkboxGroupFromPdfBase(rawValue, base, 2));
  }

  addText('Pt4Line7_EmployerName[0]', answers.Pt4Line7_EmployerName);
  addText('Pt4Line7_EmployerName[2]', firstPresentValue(answers.Pt4Line7_NameOfEmployer, answers.Pt4Line7_EmployerName));
  addText('Pt4Line7_EmployerName[1]', answers.Pt4Line7_Occupation);
  addText('Part4Line7_StreetName[0]', answers.Part4Line7_StreetName);

  addText('Pt5Line8_DateofBirth[0]', answers.Pt5Line8_DateofBirth, dateMdY);
  addText('Pt5Line8_DateofBirth[3]', answers.Pt6Line13_DateofBirth, dateMdY);
  addText('Pt6Line16_DateofBirth[0]', answers.Pt6Line16_DateofBirth, dateMdY);
  addText('Pt6Line10_CityTownOfBirth[1]', answers.Pt6Line17_CityTownOfMarriage);
  addText('Pt6Line10_State[1]', answers.Pt6Line17_State);
  addText('Pt6Line10_Country[1]', answers.Pt6Line17_Country);
  addText('Pt6Line16_DateofBirth[1]', answers.Pt6Line18_DateMarriageEnded, dateMdY);

  addText('Pt9Line3a_PageNumber[0]', answers.Pt9Line3a_PageNumber);
  addText('Pt9Line3b_PartNumber[0]', answers.Pt9Line3b_PartNumber);
  addText('Pt9Line3c_ItemNumber[0]', answers.Pt9Line3c_ItemNumber);
  addText('P14_Line2_AdditionalInfo[0]', [answers.P14_Line2_Title, answers.P14_Line2_Address].filter(isPresentExactValue).join(' '));

  addText('Pt9Line3a_PageNumber[1]', answers.Pt9Line4a_PageNumber);
  addText('Pt9Line3b_PartNumber[1]', answers.Pt9Line4b_PartNumber);
  addText('Pt9Line3c_ItemNumber[1]', answers.Pt9Line4c_ItemNumber);
  addText('P14_Line3_AdditionalInfo[0]', [
    answers.P14_Line3_Title,
    answers.P14_Line3_Employment,
    answers.P14_Line3_Dates,
    answers.P14_Line3_Occupation
  ].filter(isPresentExactValue).join(' '));

  const visaNumber = firstPresentValue(answers.visa_number, answers.Pt1Line10_VisaNum);
  const visaIssueDate = firstPresentValue(
    answers.nonimmigrant_visa_issue_date,
    answers.date_nonimmigrant_visa_issued,
    answers.visa_issue_date,
    answers.Pt1Line10_NonImmDate
  );
  if (isPresentExactValue(visaIssueDate)) {
    result['Pt1Line10_NonImmDate[0]'] = dateMdY(visaIssueDate);
  } else if (/^(n\/?a|not applicable)$/i.test(clean(visaNumber, 40))) {
    result['Pt1Line10_NonImmDate[0]'] = 'N/A';
  }

  return result;
}

const EXACT_PHONE_KEYS = new Set([
  'Pt3Line3_DaytimePhoneNumber1',
  'Pt3Line4_MobileNumber1',
  'Pt12Line3_PreparerDaytimePhoneNumber1'
]);

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
        result[name] = EXACT_PHONE_KEYS.has(key) ? usPhonePdf(rawValue) : rawValue;
      });
    }
  }

  return result;
}

function i485TextOverlays(payload = {}) {
  const answers = sanitizeI485Answers(payload.formAnswers || payload.answers || {});

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

  overlays.push(...part14ContinuationOverlays(answers, part14Layout(answers)));
  return overlays;
}

function i485FieldValues(payload = {}) {
  const answers = sanitizeI485Answers(payload.formAnswers || payload.answers || {});
  const exactValues = exactScenarioFieldValues(answers);
  const legacyValues = legacyExactI485Values(answers);
  const contact = payload.contact || {};
  const phone = usPhonePdf(answers.daytime_phone || contact.phone);
  const mobile = usPhonePdf(answers.mobile_phone || answers.daytime_phone || contact.phone);
  const email = clean(answers.email_address || contact.email, 180);
  const alienNum = digits(firstPresentValue(answers.alien_number, answers.AlienNumber, answers.Pt1Line4_AlienNumber), 9);
  const visaNumber = firstPresentValue(answers.visa_number, answers.Pt1Line10_VisaNum);
  const visaIssueDate = firstPresentValue(
    answers.nonimmigrant_visa_issue_date,
    answers.date_nonimmigrant_visa_issued,
    answers.visa_issue_date,
    answers.Pt1Line10_NonImmDate
  );
  const visaIssueDateForPdf = isPresentExactValue(visaIssueDate)
    ? dateMdY(visaIssueDate)
    : (/^(n\/?a|not applicable)$/i.test(clean(visaNumber, 40)) ? 'N/A' : '');
  const admissionBasis = firstPresentValue(
    answers.admission_basis,
    answers.Pt1Line11_Paroled ? 'paroled' : '',
    answers.Pt1Line11_Admitted ? 'admitted' : '',
    answers.Pt1Line11_Other ? 'other' : '',
    answers.status_at_last_entry
  );
  const eoirAdjustment = yesNo(answers.eoir_adjustment_proceedings);
  const hasSsn = yesNo(answers.has_ssn);
  const otherDob = yesNo(answers.other_dob_used);
  const priorANumber = yesNo(answers.has_prior_alien_number);
  const sameAddress5yrs = yesNo(answers.same_address_five_years);
  const ssaConsent = yesNo(answers.ssn_ssa_consent);
  const cspaChildAdjustment = yesNo(answers.cspa_child_adjustment);
  const physicalSameAsMailing = yesNo(answers.physical_same_as_mailing);
  const category = selectedCategory(answers);
  const immigrantVisaAbroad = yesNo(answers.immigrant_visa_abroad);
  const placeEntry = splitCityState(answers.place_entry);
  const weight = weightParts(answers.weight_lbs || `${answers.weight_hundreds || ''}${answers.weight_tens || ''}${answers.weight_ones || ''}`);

  const values = {
    // Part 1 — Applicant identity
    'Pt1Line1_FamilyName[0]': clean(answers.applicant_family_name, 60),
    'Pt1Line1_GivenName[0]': clean(answers.applicant_given_name, 60),
    'Pt1Line1_MiddleName[0]': clean(answers.applicant_middle_name, 60),

    // Item 2: other names used, two rows (more go to Part 14)
    'Pt1Line2_FamilyName[0]': clean(answers.other_name_family, 60),
    'Pt1Line2_GivenName[0]': clean(answers.other_name_given, 60),
    'Pt1Line2_MiddleName[0]': clean(answers.other_name_middle, 60),
    'Pt1Line2a_FamilyName[0]': clean(answers.other_name2_family, 60),
    'Pt1Line2a_GivenName[0]': clean(answers.other_name2_given, 60),
    'Pt1Line2a_MiddleName[0]': clean(answers.other_name2_middle, 60),

    // Item 3: date of birth and other dates of birth
    'Pt1Line3_DOB[0]': dateMdY(answers.date_of_birth),
    ...checkboxPair(otherDob, 'Pt1Line3_YN[0]', 'Pt1Line3_YN[1]'),
    ...(otherDob ? { 'Pt1Line3A_OtherDOB[0]': dateMdY(answers.other_dob_1), 'Pt1Line3B_OtherDOB[0]': dateMdY(answers.other_dob_2) } : {}),

    // A-Number (every page header and Part 1, Item 4)
    ...alienNumberFields(alienNum),
    ...checkboxPair(alienNum ? true : false, 'Pt1Line4_YN[0]', 'Pt1Line4_YN[1]'),
    ...checkboxPair(priorANumber, 'Pt1Line5_YN[0]', 'Pt1Line5_YN[1]'),
    ...(priorANumber ? { 'Pt1Line5A_ANumber[0]': digits(answers.prior_alien_number_1, 9), 'Pt1Line5B_ANumber[0]': digits(answers.prior_alien_number_2, 9) } : {}),

    // Birth / Citizenship
    'Pt1Line7_CityTownOfBirth[0]': clean(answers.city_of_birth, 60),
    'Pt1Line7_CountryOfBirth[0]': clean(answers.country_of_birth, 60),
    'Pt1Line8_CountryofCitizenshipNationality[0]': clean(answers.country_of_citizenship, 60),

    // USCIS account number (Part 1, Item 9 only: USCISOnlineAcctNumber[0] on
    // page 1 is the attorney's account number)
    'Pt1Line9_USCISAccountNumber[0]': digits(answers.uscis_online_account_number, 12),

    // Passport / Entry
    'Pt1Line10_PassportNum[0]': clean(answers.passport_number, 20),
    'Pt1Line10_ExpDate[0]': dateMdY(answers.passport_expiration),
    'Pt1Line10_Passport[0]': clean(answers.passport_country_of_issuance, 60),
    'Pt1Line10_VisaNum[0]': clean(visaNumber, 20),
    'Pt1Line10_CityTown[0]': clean(answers.port_of_entry_city || placeEntry.city, 60),
    'Pt1Line10_State[0]': stateCode(answers.port_of_entry_state || placeEntry.state),
    'Pt1Line10_DateofArrival[0]': dateMdY(answers.date_of_arrival || answers.last_arrival_date || answers.date_of_last_entry),
    'Pt1Line10_NonImmDate[0]': visaIssueDateForPdf,

    // Admission basis and status at entry
    ...admissionTextFields(answers, admissionBasis, category),

    // Part 1, Items 12-17 (edition 09/18/26). Item 12: name, number,
    // authorized-stay expiration and status from the I-94 (the name defaults to
    // the legal name); 13: first time in the U.S.; 14-15: current status and its
    // expiration; 16-17: crewman. Removal history is asked in Part 9.
    ...(isPresentExactValue(answers.i94_number) ? {
      'P1Line12_FamilyName[0]': clean(answers.i94_family_name || answers.applicant_family_name, 60),
      'P1Line13_GivenName[0]': clean(answers.i94_given_name || answers.applicant_given_name, 60)
    } : {}),
    'P1Line12_I94[0]': clean(answers.i94_number, 20),
    'Pt1Line12_Date[0]': dateMdY(answers.authorized_stay_expires),
    'Pt1Line12_Status[0]': clean(answers.manner_of_last_entry, 60),
    ...checkboxPair(yesNo(answers.first_time_in_us), 'Pt1Line13_YN[0]', 'Pt1Line13_YN[1]'),
    'Pt1Line14_Status[0]': clean(answers.current_immigration_status, 80),
    'Pt1Line15_Date[0]': currentStatusExpiration(answers, category),
    ...checkboxPair(yesNo(answers.crewman_visa_issued), 'Pt1Line16_YN[0]', 'Pt1Line16_YN[1]'),
    ...checkboxPair(yesNo(answers.arrived_as_crewman), 'Pt1Line17_YN[1]', 'Pt1Line17_YN[0]'),

    // SSN
    ...checkboxPair(hasSsn, 'Pt1Line19_YN[1]', 'Pt1Line19_YN[0]'),
    'Pt1Line19_SSN[0]': digits(answers.ssn, 9),
    ...checkboxPair(ssaConsent, 'Pt1Line19_SSA_YN[0]', 'Pt1Line19_SSA_YN[1]'),
    ...checkboxPair(ssaConsent, 'Pt1Line19_Consent_YN[0]', 'Pt1Line19_Consent_YN[1]'),

    // Part 2 — EOIR / underlying petition and category follow-up
    ...checkboxPair(eoirAdjustment, 'Pt2Line1_YN[0]', 'Pt2Line1_YN[1]'),
    'Pt2Line2_Receipt[0]': clean(firstPresentValue(answers.petition_receipt_number, answers.underlying_receipt_number), 20),
    'Pt2Line2_Date[0]': dateMdY(firstPresentValue(answers.priority_date, answers.petition_date)),
    // Item 2 names the principal applicant (derivatives only), not the petitioner.
    ...filingAsFields(answers),
    // Items 3-4: category, its follow-ups and INA 245(i) where it applies
    ...categoryFields(answers, category),
    ...checkboxPair(cspaChildAdjustment, 'Pt2Line5_CB[1]', 'Pt2Line5_CB[0]'),

    // Part 3 — Affidavit of Support exemption, by category
    ...affidavitSupportFields(answers, category),

    // Part 4 — Items 1-6 (Items 7-8 in employmentFields below)
    ...checkboxPair(immigrantVisaAbroad, 'Pt4Line1_YN[1]', 'Pt4Line1_YN[0]'),
    ...(immigrantVisaAbroad ? {
      'Pt4Line2_CityTown[0]': clean(answers.consulate_city, 60),
      'Pt4Line2_CityTownOfBirth[0]': clean(answers.consulate_country, 60),
      'Pt4Line3_Decision[0]': clean(answers.consulate_decision, 60),
      'Pt4Line4_Date[0]': dateMdY(answers.consulate_decision_date)
    } : {}),
    ...checkboxPair(yesNo(answers.prior_lpr_application_us), 'Pt4Line5_YN[1]', 'Pt4Line5_YN[0]'),
    ...checkboxPair(yesNo(answers.lpr_rescinded), 'Pt4Line6_YN[1]', 'Pt4Line6_YN[0]'),

    // Part 5 — Parents
    'Pt5Line1_FamilyName[0]': clean(answers.father_family_name, 60),
    'Pt5Line1_GivenName[0]': clean(answers.father_given_name, 60),
    'Pt5Line1_MiddleName[0]': clean(answers.father_middle_name, 60),
    'Pt5Line3_DateofBirth[0]': dateMdY(answers.father_dob),
    // Pt5Line5 / Pt5Line10 are "Country of Birth" despite the field names.
    'Pt5Line5_CityTownOfBirth[0]': clean(answers.father_country_of_birth || answers.father_city_of_birth, 60),
    'Pt5Line6_FamilyName[0]': clean(answers.mother_family_name, 60),
    'Pt5Line6_GivenName[0]': clean(answers.mother_given_name, 60),
    'Pt5Line6_MiddleName[0]': clean(answers.mother_middle_name, 60),
    'Pt5Line7_FamilyName[0]': clean(answers.mother_birth_family_name, 60),
    'Pt5Line7_GivenName[0]': clean(answers.mother_birth_given_name, 60),
    'Pt5Line7_MiddleName[0]': clean(answers.mother_birth_middle_name, 60),
    'Pt5Line8_DateofBirth[0]': dateMdY(answers.mother_dob),
    'Pt5Line10_CityTownOfBirth[0]': clean(answers.mother_country_of_birth || answers.mother_city_of_birth, 60),

    // Part 6 — Marital history
    'Pt6Line3_TimesMarried[0]': clean(answers.times_married, 4),
    'Pt6Line4_FamilyName[0]': clean(answers.spouse_family_name, 60),
    'Pt6Line4_GivenName[0]': clean(answers.spouse_given_name, 60),
    'Pt6Line4_MiddleName[0]': clean(answers.spouse_middle_name, 60),
    'Pt6Line5_AlienNumber[0]': digits(answers.spouse_alien_number, 9),
    // Pt5Line8_DateofBirth [1]-[3] are Part 6 dates: current spouse's birth,
    // current marriage, prior spouse's birth.
    'Pt5Line8_DateofBirth[1]': dateMdY(answers.spouse_dob),
    'Pt6Line7_Country[0]': clean(answers.spouse_country_of_birth, 60),
    'Pt6Line10_CityTownOfBirth[0]': clean(answers.current_marriage_city, 60),
    'Pt6Line10_State[0]': clean(answers.current_marriage_state, 60),
    'Pt6Line10_Country[0]': clean(answers.current_marriage_country, 60),
    'Pt5Line8_DateofBirth[2]': dateMdY(answers.current_marriage_date),
    'Pt6Line12_FamilyName[0]': clean(answers.prior_spouse_family_name, 60),
    'Pt6Line12_GivenName[0]': clean(answers.prior_spouse_given_name, 60),
    'Pt6Line12_MiddleName[0]': clean(answers.prior_spouse_middle_name, 60),
    'Pt5Line8_DateofBirth[3]': dateMdY(answers.prior_spouse_dob),
    'Pt6Line14_Country[0]': clean(answers.prior_spouse_country_of_birth, 60),
    'Pt6Line15_Country[0]': clean(answers.prior_spouse_country_of_citizenship, 60),
    'Pt6Line16_DateofBirth[0]': dateMdY(answers.prior_spouse_marriage_date),
    // Item 16, place of the prior marriage, reuses Pt6Line10_*[1].
    'Pt6Line10_CityTownOfBirth[1]': clean(answers.prior_spouse_marriage_city, 60),
    'Pt6Line10_State[1]': clean(answers.prior_spouse_marriage_state, 60),
    'Pt6Line10_Country[1]': clean(answers.prior_spouse_marriage_country, 60),
    'Pt6Line18_CityTownOfBirth[0]': clean(answers.prior_spouse_marriage_end_city, 60),
    'Pt6Line18_State[0]': clean(answers.prior_spouse_marriage_end_state, 60),
    'Pt6Line18_Country[0]': clean(answers.prior_spouse_marriage_end_country, 60),
    'Pt6Line16_DateofBirth[1]': dateMdY(answers.prior_spouse_marriage_end_date),
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
    'Pt11Line2_OrgName[0]': organizationName(answers.interpreter_org_name || answers.interpreter_business_name),
    'P3_Line4_DaytimeTelePhoneNumber[0]': usPhonePdf(answers.interpreter_phone),
    'P3_Line5_MobileTelePhoneNumber[0]': usPhonePdf(answers.interpreter_mobile),
    'P3_Line6_Email[0]': clean(answers.interpreter_email, 180),
    'Part11_NameofLanguage[0]': clean(answers.interpreter_language, 40),

    // Preparer (Part 12)
    'Pt12Line1_PreparerFamilyName[0]': clean(answers.preparer_family_name, 60),
    'Pt12Line1a_PreparerGivenName[0]': clean(answers.preparer_given_name, 60),
    'Pt12Line2_BusinessName[0]': organizationName(answers.preparer_business_name),
    'Pt12Line3_PreparerDaytimePhoneNumber1[0]': usPhonePdf(answers.preparer_phone),
    'Pt12Line4_PreparerMobileNumber[0]': usPhonePdf(answers.preparer_mobile),
    'Pt12Line5_PreparerEmail[0]': clean(answers.preparer_email, 180),

    // Repeating A-number header on all pages
    ...alienNumberFields(alienNum),

    // Composite field groups
    ...sexFields(answers.sex),
    ...maritalStatusFields(answers.marital_status),
    ...ethnicityFields(answers.ethnicity),
    ...raceFields(answers.race),
    ...eyeColorFields(answers.eye_color),
    ...hairColorFields(answers.hair_color),
    ...admissionBasisFields(refugeeAdmission(admissionBasis, category)),
    ...spouseFields(answers),
    ...publicChargeFields(answers, publicChargeIndex(answers, category)),
    ...checkboxGroupValue(answers.prior_spouse_marriage_end_type, 'Pt6Line19_MaritalStatus', priorMarriageEndTypeValue(answers.prior_spouse_marriage_end_type), 4),
    ...checkboxPair(sameAddress5yrs, 'Pt1Line18_last5yrs_YN[0]', 'Pt1Line18_last5yrs_YN[1]'),
    ...checkboxPair(physicalSameAsMailing, 'Pt1Line18_YN[0]', 'Pt1Line18_YN[1]'),
    ...priorUsAddressFields(answers),
    ...lastForeignAddressFields(answers),
    ...employmentFields(answers),
    ...part14FieldValues(answers, part14Layout(answers)),
    ...usAddress(answers)
  };

  const semanticValues = Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  return { ...semanticValues, ...exactValues, ...legacyValues };
}

module.exports = { i485FieldValues, i485TextOverlays, dateMdY, usPhonePdf, sanitizeI485Answers };
