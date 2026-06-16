'use strict';

const inventory = require('../pdf-maps/uscis/n-400.json');

function clean(v, max = 300) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function digits(v, max = 30) {
  return clean(v, Math.max(80, max * 4)).replace(/\D/g, '').slice(0, max);
}

function dateMdY(v) {
  const t = clean(v, 40);
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : t;
}

function stateCode(v) {
  const t = clean(v, 80);
  const m = t.match(/^([A-Z]{2})\b/);
  return m ? m[1] : t;
}

function usPhone(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return digits(`${v.areaCode || ''}${v.number || ''}`, 10);
  }
  const r = digits(v, 20);
  if (r.length === 11 && r.startsWith('1')) return r.slice(1);
  return r.length > 10 ? r.slice(-10) : r;
}

function yesNo(v) {
  const t = clean(v, 40).toLowerCase();
  if (['yes', 'true', 'да', 'так'].includes(t)) return 'Y';
  if (['no', 'false', 'нет', 'ні'].includes(t)) return 'N';
  return '';
}

const buttonsByBase = new Map();
for (const item of inventory.fields || []) {
  if (item.pdfFieldType !== 'Btn') continue;
  const base = item.pdfFieldName.replace(/\[\d+\]$/, '');
  const items = buttonsByBase.get(base) || [];
  items.push(item);
  buttonsByBase.set(base, items);
}

function setChoice(out, fieldBase, state) {
  const widgets = buttonsByBase.get(fieldBase) || [];
  for (const widget of widgets) {
    out[widget.pdfFieldName] = (widget.appearanceStates || []).includes(state);
  }
}

function setChoiceWidgets(out, fieldNames, state) {
  const wanted = new Set(fieldNames);
  for (const widget of inventory.fields || []) {
    if (!wanted.has(widget.pdfFieldName)) continue;
    out[widget.pdfFieldName] = (widget.appearanceStates || []).includes(state);
  }
}

function setYesNo(out, fieldBase, value) {
  const state = yesNo(value);
  if (state) setChoice(out, fieldBase, state);
}

function setAddress(out, prefix, address) {
  const a = address && typeof address === 'object' ? address : {};
  out[`${prefix}_StreetName[0]`] = clean(a.line1, 80);
  const unitText = clean(a.line2, 20);
  const unitNumber = (unitText.match(/\b([A-Za-z0-9-]+)\s*$/) || [])[1] || '';
  out[`${prefix}_Number[0]`] = unitNumber;
  const unitState = /\bste\b|suite/i.test(unitText) ? 'STE' : (/\bflr\b|floor/i.test(unitText) ? 'FLR' : (unitText ? 'APT' : ''));
  if (unitState) setChoice(out, `${prefix}_Unit`, unitState);
  out[`${prefix}_City[0]`] = clean(a.city, 60);
  out[`${prefix}_State[0]`] = stateCode(a.state);
  out[`${prefix}_ZipCode[0]`] = digits(a.zip, 9);
  out[`${prefix}_Country[0]`] = clean(a.country, 60);
}

const PART9_BUTTONS = {
  n400_p9_1_claimed_citizen: 'P9_Line1',
  n400_p9_2_registered_or_voted: 'P9_Line2',
  n400_p9_3_overdue_taxes: 'P9_Line3',
  n400_p9_4_nonresident_tax: 'P9_Line4',
  n400_p9_5a_communist_totalitarian: 'P9_5a',
  n400_p9_5b_advocated_overthrow: 'P9_5b',
  n400_p9_6a_group_weapon_explosive: 'P12_6a',
  n400_p9_6b_group_kidnap_hijack: 'P12_6b',
  n400_p9_6c_group_threat_plan: 'P12_6c',
  n400_p9_7a_torture: 'P9_Line7a',
  n400_p9_7d_severe_injury: 'P11_7d',
  n400_p9_8a_military_police_unit: 'P9_Line8a',
  n400_p9_8b_armed_group: 'P9_Line8b',
  n400_p9_9_detention_facility: 'P9_Line9',
  n400_p9_10a_group_used_weapon: 'P9_Line10a',
  n400_p9_10b_personally_used_weapon: 'P9_Line10b',
  n400_p9_10c_personally_threatened_weapon: 'P9_Line10c',
  n400_p9_11_weapons_transport: 'P9_Line11',
  n400_p9_12_weapons_training: 'P9_Line12',
  n400_p9_13_recruited_child: 'P9_Line13',
  n400_p9_14_child_hostilities: 'P9_Line14',
  n400_p9_15a_unarrested_crime: 'P9_Line15a',
  n400_p9_15b_arrested_charged: 'P9_Line15b',
  n400_p9_16_completed_sentence: 'P12_Line16',
  n400_p9_17a_prostitution: 'P11_Line17A',
  n400_p9_17b_controlled_substances: 'P11_Line17B',
  n400_p9_17c_polygamy: 'P11_Line17C',
  n400_p9_17d_marriage_fraud: 'P12_Line17d',
  n400_p9_17e_alien_smuggling: 'P12_Line17e',
  n400_p9_17f_illegal_gambling: 'P12_Line17f',
  n400_p9_17g_failed_support: 'P12_Line17g',
  n400_p9_17h_public_benefit_misrepresentation: 'P12_Line17h',
  n400_p9_18_false_documents: 'P12_Line18',
  n400_p9_19_lied_for_entry_benefit: 'P12_Line19',
  n400_p9_20_removal_proceedings: 'P12_Line20',
  n400_p9_21_removed_deported: 'P12_Line21',
  n400_p9_22a_male_18_to_26: 'P9_Line22a',
  n400_p9_22b_selective_service: 'Pt9_Line22b',
  n400_p9_23_left_to_avoid_draft: 'P12_Line23',
  n400_p9_24_military_exemption: 'P12_Line24',
  n400_p9_25_us_armed_forces: 'P12_Line25',
  n400_p9_26a_current_service: 'P12_Line26a',
  n400_p9_26b_deploying: 'P12_Line26b',
  n400_p9_26c_stationed_abroad: 'P12_Line26c',
  n400_p9_26d_former_service_abroad: 'P11_Line26d',
  n400_p9_27_court_martial_discharge: 'P12_Line27',
  n400_p9_28_alien_discharge: 'P12_Line28',
  n400_p9_29_deserted: 'P9_Line29',
  n400_p9_30a_nobility: 'P12_Line30a',
  n400_p9_30b_give_up_nobility: 'P12_Line30b',
  n400_p9_31_support_constitution: 'P12_Line31',
  n400_p9_32_understand_oath: 'P12_Line32',
  n400_p9_33_unable_oath: 'P12_Line33',
  n400_p9_34_willing_oath: 'P12_Line34',
  n400_p9_35_bear_arms: 'P12_Line35',
  n400_p9_36_noncombatant_service: 'P12_Line36',
  n400_p9_37_national_importance_work: 'P12_Line37'
};

function n_400FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const out = {};

  out['P2_Line1_FamilyName[0]'] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  out['P2_Line1_GivenName[0]'] = clean(a.applicant_given_name || a.given_name || (c.name ? c.name.split(' ').slice(0, -1).join(' ') : ''), 60);
  out['P2_Line1_MiddleName[0]'] = clean(a.applicant_middle_name || a.middle_name, 60);
  out['P2_Line8_DateOfBirth[0]'] = dateMdY(a.date_of_birth || a.dob);
  out['P2_Line9_DateBecamePermanentResident[0]'] = dateMdY(a.green_card_date);
  out['P2_Line6_USCISELISAcctNumber[0]'] = digits(a.uscis_online_account_number, 12);
  out['P2_Line10_CountryOfBirth[0]'] = clean(a.country_of_birth, 60);
  out['P2_Line11_CountryOfNationality[0]'] = clean(a.country_of_citizenship, 60);
  out['Line12b_SSN[0]'] = digits(a.ssn || a.social_security_number, 9);
  out['Line2_FamilyName1[0]'] = clean(a.n400_other_name1_family, 60);
  out['Line3_GivenName1[0]'] = clean(a.n400_other_name1_given, 60);
  out['Line3_MiddleName1[0]'] = clean(a.n400_other_name1_middle, 60);
  out['Line2_FamilyName2[0]'] = clean(a.n400_other_name2_family, 60);
  out['Line3_GivenName2[0]'] = clean(a.n400_other_name2_given, 60);
  out['Line3_MiddleName2[0]'] = clean(a.n400_other_name2_middle, 60);

  const an = digits(a.alien_number || a.a_number, 9);
  if (an) {
    for (let i = 0; i <= 12; i += 1) out[`Line1_AlienNumber[${i}]`] = an;
  }

  const basisStates = {
    'General Provision': 'A',
    'Spouse of U.S. Citizen': 'B',
    VAWA: 'C',
    'Spouse of U.S. Citizen in Qualified Employment Outside the United States': 'D',
    'Military Service During Period of Hostilities': 'E',
    'At Least One Year of Honorable Military Service at Any Time': 'F',
    'Other Reason for Filing Not Listed Above': 'G'
  };
  if (basisStates[a.basis_for_naturalization]) setChoice(out, 'Part1_Eligibility', basisStates[a.basis_for_naturalization]);
  out['Part1Line5_OtherExplain[0]'] = clean(a.n400_other_basis_explanation, 180);
  setChoice(out, 'P2_Line7_Gender', clean(a.sex).toLowerCase() === 'male' ? 'M' : (clean(a.sex).toLowerCase() === 'female' ? 'F' : ''));
  setYesNo(out, 'P2_Line34_NameChange', a.wants_name_change);
  out['Part2Line3_FamilyName[0]'] = clean(a.requested_new_family_name, 60);
  out['Part2Line4a_GivenName[0]'] = clean(a.requested_new_given_name, 60);
  out['Part2Line4a_MiddleName[0]'] = clean(a.requested_new_middle_name, 60);
  setYesNo(out, 'P2_Line10_claimdisability', a.n400_parent_citizen_before_18);
  setYesNo(out, 'P2_Line11_claimdisability', a.n400_n648_disability_exception);
  setYesNo(out, 'Line12a_Checkbox', a.n400_ssa_card_update);
  setYesNo(out, 'c_Checkbox', a.n400_ssa_disclosure_consent);

  setChoice(out, 'P7_Line1_Ethnicity', a.ethnicity === 'Hispanic or Latino' ? 'Y' : (a.ethnicity ? 'N' : ''));
  const races = Array.isArray(a.race) ? a.race : [];
  const raceWidgets = {
    'American Indian or Alaska Native': 'P7_Line2_Race[0]',
    Asian: 'P7_Line2_Race[1]',
    'Black or African American': 'P7_Line2_Race[2]',
    'Native Hawaiian or Other Pacific Islander': 'P7_Line2_Race[3]',
    White: 'P7_Line2_Race[4]'
  };
  for (const [label, fieldName] of Object.entries(raceWidgets)) out[fieldName] = races.includes(label);
  out['P7_Line3_HeightFeet[0]'] = clean(a.height_feet, 1);
  out['P7_Line3_HeightInches[0]'] = clean(a.height_inches, 2);
  const weight = digits(a.weight_pounds, 3).padStart(3, '0');
  if (digits(a.weight_pounds, 3)) {
    out['P7_Line4_Pounds1[0]'] = weight[0];
    out['P7_Line4_Pounds2[0]'] = weight[1];
    out['P7_Line4_Pounds3[0]'] = weight[2];
  }
  const eyeStates = { Black: 'BLK', Blue: 'BLU', Brown: 'BRO', Gray: 'GRY', Green: 'GRN', Hazel: 'HAZ', Maroon: 'MAR', Pink: 'PNK', 'Unknown/Other': 'XXX' };
  const hairStates = { 'Bald (No hair)': 'BAL', Black: 'BLK', Blond: 'BLN', Brown: 'BRO', Gray: 'GRY', Red: 'RED', Sandy: 'SDY', White: 'WHI', 'Unknown/Other': 'XXX' };
  if (eyeStates[a.eye_color]) setChoice(out, 'P7_Line5_Eye', eyeStates[a.eye_color]);
  if (hairStates[a.hair_color]) setChoice(out, 'P7_Line6_Hair', hairStates[a.hair_color]);

  setYesNo(out, 'Pt3_Line2a_Checkbox', a.physical_same_as_mailing);
  setAddress(out, 'P4_Line1', a.n400_current_physical_address);
  out['P4_Line1_DatesofResidence[1]'] = dateMdY(a.n400_current_address_from);
  if (yesNo(a.physical_same_as_mailing) === 'N') setAddress(out, 'P5_Line1b', a.n400_mailing_address);
  const previousAddresses = Array.isArray(a.addresses_last_five_years) ? a.addresses_last_five_years.slice(0, 3) : [];
  previousAddresses.forEach((row, index) => {
    const n = index + 1;
    out[`P4_Line3_PhysicalAddress${n}[0]`] = clean([row.line1, row.line2].filter(Boolean).join(' '), 90);
    out[`P4_Line3_CityTown${n}[0]`] = clean(row.city, 60);
    out[`P4_Line3_State${n}[0]`] = stateCode(row.state);
    out[`P4_Line3_ZipCode${n}[0]`] = digits(row.zip, 9);
    out[`P4_Line3_Country${n}[0]`] = clean(row.country, 60);
    out[`P4_Line3_From${n}[0]`] = dateMdY(row.from);
    out[n === 1 ? 'P4_Line3_From1[1]' : `P4_Line3_To${n}[0]`] = dateMdY(row.to);
  });

  const maritalStates = {
    Divorced: 'D', 'Single, never married': 'S', Widowed: 'W', Married: 'M',
    'Marriage annulled': 'A', Separated: 'E'
  };
  const spouseBasis = ['Spouse of U.S. Citizen', 'Spouse of U.S. Citizen in Qualified Employment Outside the United States']
    .includes(a.basis_for_naturalization);
  const maritalStatus = spouseBasis ? 'Married' : a.marital_status;
  if (maritalStates[maritalStatus]) setChoice(out, 'P10_Line1_MaritalStatus', maritalStates[maritalStatus]);
  setYesNo(out, 'P7_Line2_Forces', a.n400_spouse_us_armed_forces);
  out['Part9Line3_TimesMarried[0]'] = digits(a.times_married, 2);
  out['P10_Line4a_FamilyName[0]'] = clean(a.spouse_family_name, 60);
  out['P10_Line4a_GivenName[0]'] = clean(a.spouse_given_name, 60);
  out['P10_Line4a_MiddleName[0]'] = clean(a.spouse_middle_name, 60);
  out['P10_Line4d_DateofBirth[0]'] = dateMdY(a.spouse_date_of_birth);
  out['P10_Line4e_DateEnterMarriage[0]'] = dateMdY(a.current_marriage_date);
  setYesNo(out, 'P10_Line5_Citizen', a.n400_spouse_same_address);
  if (a.n400_spouse_citizen_by) setChoice(out, 'P10_Line5a_When', a.n400_spouse_citizen_by === 'By birth in the United States' ? 'B' : 'O');
  out['P10_Line5b_DateBecame[0]'] = dateMdY(a.n400_spouse_citizen_date);
  out['P7_Line6_ANumber[0]'] = digits(a.spouse_alien_number, 9);
  out['P10_Line4g_Employer[0]'] = clean(a.n400_spouse_current_employer, 80);
  out['TextField1[0]'] = clean(a.n400_spouse_current_employer, 80);
  out['P11_Line1_TotalChildren[0]'] = digits(a.total_children_under_18, 2);
  for (let n = 1; n <= 3; n += 1) {
    out[`P7_EmployerName${n}[0]`] = clean([a[`n400_child${n}_given_name`], a[`n400_child${n}_family_name`]].filter(Boolean).join(' '), 80);
    out[`P7_From${n}[0]`] = dateMdY(a[`n400_child${n}_dob`]);
    out[`P7_OccupationFieldStudy${n}[0]`] = clean(a[`n400_child${n}_residence`], 60);
    out[`P7_OccupationFieldStudy${n}[1]`] = clean(a[`n400_child${n}_relationship`], 60);
  }
  setYesNo(out, 'P9_Line5a', a.n400_child1_support);
  setYesNo(out, 'P6_ChildTwo', a.n400_child2_support);
  setYesNo(out, 'P6_ChildThree', a.n400_child3_support);

  const employment = Array.isArray(a.employment_school_last_five_years) ? a.employment_school_last_five_years.slice(0, 3) : [];
  employment.forEach((row, index) => {
    const n = index + 1;
    out[`P5_EmployerName${n}[0]`] = clean(row.name, 80);
    out[`P7_City${n}[0]`] = clean(row.city, 60);
    out[`P7_State${n}[0]`] = stateCode(row.state);
    out[`P7_ZipCode${n}[0]`] = digits(row.zip, 9);
    out[`P7_Country${n}[0]`] = clean(row.country, 60);
    out[`P7_From${n}[1]`] = dateMdY(row.from);
    if (n > 1) out[`P7_To${n}[0]`] = dateMdY(row.to);
    out[`P7_OccupationFieldStudy${n}[2]`] = clean(row.occupation, 80);
  });

  const trips = Array.isArray(a.trips_outside_us) ? a.trips_outside_us.slice(0, 6) : [];
  trips.forEach((row, index) => {
    const n = index + 1;
    out[`P8_Line1_DateLeft${n}[0]`] = dateMdY(row.from);
    out[`P8_Line1_DateReturn${n}[0]`] = dateMdY(row.to);
    out[n === 1 ? 'P9_Line1_Countries1[0]' : `P8_Line1_Countries${n}[0]`] = clean(row.country, 80);
  });

  for (const [answerId, pdfBase] of Object.entries(PART9_BUTTONS)) setYesNo(out, pdfBase, a[answerId]);
  setChoiceWidgets(out, ['[0]', '[1]'], yesNo(a.n400_p9_7b_genocide));
  setChoiceWidgets(out, ['c[0]', 'c[1]'], yesNo(a.n400_p9_7c_killing));
  setChoiceWidgets(out, ['e[0]', 'e[1]'], yesNo(a.n400_p9_7e_nonconsensual_sexual_contact));
  setChoiceWidgets(out, ['f[0]', 'f[1]'], yesNo(a.n400_p9_7f_religious_persecution));
  setChoiceWidgets(out, ['g[0]', 'g[1]'], yesNo(a.n400_p9_7g_protected_ground_harm));
  out['P9_Line22c_Date[0]'] = dateMdY(a.n400_selective_service_date);
  out['P9_Line22c_SSNumber[0]'] = clean(a.n400_selective_service_number, 20);

  setYesNo(out, 'P10_Line1_Citizen', a.n400_fee_reduction_eligible_income);
  out['P10_Line2_TotalHouseholdIn[0]'] = clean(a.n400_total_household_income, 20);
  out['P10_Line3_HouseHoldSize[0]'] = digits(a.n400_household_size, 3);
  out['P11_Line1_TotalChildren[1]'] = digits(a.n400_household_earners, 3);
  setYesNo(out, 'P10_Line5a', a.n400_head_of_household);
  out['P10_Line5b_NameOfHousehold[0]'] = clean(a.n400_head_of_household_name, 100);

  out['P12_Line3_Telephone[0]'] = usPhone(a.daytime_phone || a.phone || c.phone);
  out['P12_Line3_Mobile[0]'] = usPhone(a.mobile_phone);
  out['P12_Line5_Email[0]'] = clean(a.email_address || a.email || c.email, 120);
  out['P14_Line1_nterpreterFamilyName[0]'] = clean(a.interpreter_family_name, 60);
  out['P14_Line1_nterpreterGivenName[0]'] = clean(a.interpreter_given_name, 60);
  out['P14_Line2_NameofBusinessorOrgName[0]'] = clean(a.interpreter_org_name || a.interpreter_business_name, 80);
  out['P14_NameOfLanguage[0]'] = clean(a.interpreter_language, 40);
  out['P14_Line4_Telephone[0]'] = usPhone(a.interpreter_daytime_phone);
  out['P14_Line5_Mobile[0]'] = usPhone(a.interpreter_mobile_phone);
  out['P14_Line5_EmailAddress[0]'] = clean(a.interpreter_email, 120);
  out['P15_Line1_PreparerFamilyName[0]'] = clean(a.preparer_family_name, 60);
  out['P15_Line1_PreparerGivenName[0]'] = clean(a.preparer_given_name, 60);
  out['P15_Line2_NameofBusinessorOrgName[0]'] = clean(a.preparer_business_name, 80);
  out['P15_Line4_Telephone[0]'] = usPhone(a.preparer_daytime_phone);
  out['P15_Line5_Mobile[0]'] = usPhone(a.preparer_mobile_phone);
  out['P15_Line6_Email[0]'] = clean(a.preparer_email, 120);

  return Object.fromEntries(Object.entries(out).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

module.exports = { n_400FieldValues };
