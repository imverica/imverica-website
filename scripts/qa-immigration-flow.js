const fs = require('fs');
const path = require('path');
const flow = require('../netlify/functions/immigration-flow');

const ROOT = path.resolve(__dirname, '..');

async function callFlow(code, lang = 'en') {
  const response = await flow.handler({
    httpMethod: 'GET',
    queryStringParameters: { code, lang },
    headers: {}
  });

  let body = {};
  try {
    body = JSON.parse(response.body || '{}');
  } catch (err) {
    throw new Error(`${code}: response body is not JSON`);
  }

  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function syntaxCheckInlineScripts() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => {
      const attrs = match[1] || '';
      const type = attrs.match(/\btype=["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
      return !type || type === 'text/javascript' || type === 'module';
    })
    .map((match) => match[2])
    .filter((script) => script.trim());

  scripts.forEach((script, index) => {
    try {
      new Function(script);
    } catch (err) {
      throw new Error(`index.html inline script ${index + 1}: ${err.message}`);
    }
  });

  return scripts.length;
}

async function main() {
  const codes = ['I-765', 'I-485', 'I-130', 'I-131', 'I-90', 'I-539', 'I-589', 'I-751', 'I-821', 'I-821D', 'I-864', 'I-912', 'N-400', 'AR-11'];

  for (const code of codes) {
    const { response, body } = await callFlow(code);
    assert(response.statusCode === 200, `${code}: expected 200, got ${response.statusCode}`);
    assert(body.ok === true, `${code}: expected ok true`);
    assert(body.code === code, `${code}: code mismatch`);
    assert(body.schemaVersion, `${code}: missing schemaVersion`);
    assert(Array.isArray(body.steps) && body.steps.length >= 5, `${code}: missing schema steps`);
    assert(body.steps.every((step) => Array.isArray(step.fields) && step.fields.length), `${code}: every step must have fields`);
    assert(body.official && typeof body.official === 'object', `${code}: missing official summary`);
    console.log(`${code}: ${body.steps.length} steps, official status ${body.official.status || 'unknown'}`);
  }

  const invalid = await callFlow('NOPE-999');
  assert(invalid.response.statusCode === 404, `invalid code: expected 404, got ${invalid.response.statusCode}`);

  const localized = await callFlow('I-765', 'ru');
  assert(/Назначение формы|Основание/.test(localized.body.steps[0].title + localized.body.steps[1].title), 'ru localization missing for I-765 flow');

  const i765Address = localized.body.steps.find((step) => step.id === 'address_contact');
  assert(i765Address, 'I-765: missing address/contact step');
  const mailingAddress = i765Address.fields.find((field) => field.id === 'mailing_address');
  const daytimePhone = localized.body.steps.find((step) => step.id === 'contact_info')?.fields.find((field) => field.id === 'daytime_phone');
  assert(mailingAddress?.type === 'addressBlock', 'I-765: mailing address should use structured address block');
  assert(mailingAddress?.parts?.state === 'mailing_state', 'I-765: address block should map mailing state key');
  assert(mailingAddress?.stateOptions?.includes('CA - California'), 'I-765: state select should include California');
  assert(mailingAddress?.stateOptions?.includes('PR - Puerto Rico'), 'I-765: state select should include territories');
  assert(daytimePhone?.type === 'phone', 'I-765: phone should be US 10-digit phone field');
  const i765Category = localized.body.steps.find((step) => step.id === 'i765_eligibility_category');
  assert(i765Category?.fields.some((field) => field.id === 'c8_arrested_or_convicted'), 'I-765: missing c8 arrest/conviction question');
  const i765Order = localized.body.steps.map((step) => step.id);
  const i765ApplicantStart = i765Order.includes('applicant') ? 'applicant' : 'applicant_name_parts';
  assert(i765Order.indexOf('i765_application_reason') < i765Order.indexOf(i765ApplicantStart), 'I-765: reason for applying should come before applicant fields');
  assert(i765Order.indexOf(i765ApplicantStart) < i765Order.indexOf('i765_work_permit_basis'), 'I-765: applicant fields should come before eligibility-category questions');
  assert(i765Order.indexOf('i765_eligibility_category') < i765Order.indexOf('i765_applicant_statement'), 'I-765: eligibility category should come before applicant statement');
  assert(i765Order.indexOf('i765_applicant_statement') < i765Order.indexOf('contact_info'), 'I-765: applicant statement should come before contact info');
  const i765Evidence = localized.body.steps.find((step) => step.id === 'documents_interpreter_choice');
  assert(i765Evidence?.fields.some((field) => field.id === 'has_interpreter'), 'I-765: missing interpreter question');
  assert(i765Evidence?.fields.some((field) => field.id === 'has_preparer'), 'I-765: missing preparer question');

  const n400 = await callFlow('N-400', 'en');
  const n400Order = n400.body.steps.map((step) => step.id);
  assert(n400Order.indexOf('n400_eligibility_basis') < n400Order.indexOf('n400_legal_name'), 'N-400: eligibility must come before applicant name');
  assert(n400Order.indexOf('n400_legal_name') < n400Order.indexOf('n400_biographic_ethnicity_race'), 'N-400: applicant identity must come before biographic fields');
  assert(n400Order.indexOf('n400_biographic_colors') < n400Order.indexOf('n400_current_address'), 'N-400: biographic fields must come before residence fields');
  assert(n400Order.indexOf('n400_address_history') < n400Order.indexOf('n400_employment_history'), 'N-400: address history must come before employment history');
  assert(n400Order.indexOf('n400_employment_history') < n400Order.indexOf('n400_trips_outside_us'), 'N-400: employment history must come before travel history');
  assert(n400Order.indexOf('n400_trips_outside_us') < n400Order.indexOf('n400_p9_1_claimed_citizen'), 'N-400: travel history must come before Part 9 eligibility questions');
  assert(n400Order.indexOf('n400_p9_37_national_importance_work') < n400Order.indexOf('n400_applicant_contact'), 'N-400: oath questions must come before applicant contact');
  const n400Fields = n400.body.steps.flatMap((step) => step.fields || []);
  assert(n400Fields.find((field) => field.id === 'addresses_last_five_years')?.type === 'addressHistory', 'N-400: address history should be structured');
  assert(n400Fields.find((field) => field.id === 'employment_school_last_five_years')?.type === 'employmentHistory', 'N-400: employment history should be structured');
  assert(n400Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'N-400: daytime phone should be US 10-digit phone field');
  const n400ById = Object.fromEntries(n400Fields.map((field) => [field.id, field]));
  const n400Basis = n400ById.basis_for_naturalization;
  assert(n400Basis?.options?.length === 7, 'N-400: Part 1 must offer all seven official filing bases');
  assert(n400Basis.options.includes('VAWA'), 'N-400: Part 1 must include VAWA');
  assert(n400Basis.options.includes('Spouse of U.S. Citizen in Qualified Employment Outside the United States'), 'N-400: Part 1 must include INA 319(b) spouse basis');
  assert(n400Basis.options.includes('At Least One Year of Honorable Military Service at Any Time'), 'N-400: Part 1 must distinguish the honorable military-service basis');
  assert(n400ById.sex?.options?.length === 2 && n400ById.sex.options.includes('Male') && n400ById.sex.options.includes('Female'), 'N-400: sex choices must match the official 01/20/25 form');
  assert(n400ById.n400_ssa_card_update, 'N-400: missing Part 2 Item 12.a SSA card/update question');
  assert(n400ById.n400_ssa_disclosure_consent, 'N-400: missing Part 2 Item 12.c SSA disclosure consent');
  assert(n400ById.total_children_under_18, 'N-400: Part 6 must ask for children under 18, not all children');
  assert(n400ById.n400_fee_reduction_eligible_income, 'N-400: missing Part 10 reduced-fee question');
  assert(n400ById.n400_total_household_income && n400ById.n400_household_size, 'N-400: reduced-fee household details are incomplete');
  const requiredPart9Ids = [
    'n400_p9_1_claimed_citizen', 'n400_p9_2_registered_or_voted', 'n400_p9_3_overdue_taxes',
    'n400_p9_4_nonresident_tax', 'n400_p9_5a_communist_totalitarian', 'n400_p9_5b_advocated_overthrow',
    'n400_p9_6a_group_weapon_explosive', 'n400_p9_6b_group_kidnap_hijack', 'n400_p9_6c_group_threat_plan',
    'n400_p9_7a_torture', 'n400_p9_7b_genocide', 'n400_p9_7c_killing', 'n400_p9_7d_severe_injury',
    'n400_p9_7e_nonconsensual_sexual_contact', 'n400_p9_7f_religious_persecution', 'n400_p9_7g_protected_ground_harm',
    'n400_p9_8a_military_police_unit', 'n400_p9_8b_armed_group', 'n400_p9_9_detention_facility',
    'n400_p9_10a_group_used_weapon', 'n400_p9_10b_personally_used_weapon', 'n400_p9_10c_personally_threatened_weapon',
    'n400_p9_11_weapons_transport', 'n400_p9_12_weapons_training', 'n400_p9_13_recruited_child',
    'n400_p9_14_child_hostilities', 'n400_p9_15a_unarrested_crime', 'n400_p9_15b_arrested_charged',
    'n400_p9_16_completed_sentence', 'n400_p9_17a_prostitution', 'n400_p9_17b_controlled_substances',
    'n400_p9_17c_polygamy', 'n400_p9_17d_marriage_fraud', 'n400_p9_17e_alien_smuggling',
    'n400_p9_17f_illegal_gambling', 'n400_p9_17g_failed_support', 'n400_p9_17h_public_benefit_misrepresentation',
    'n400_p9_18_false_documents', 'n400_p9_19_lied_for_entry_benefit', 'n400_p9_20_removal_proceedings',
    'n400_p9_21_removed_deported', 'n400_p9_22a_male_18_to_26', 'n400_p9_22b_selective_service',
    'n400_p9_23_left_to_avoid_draft', 'n400_p9_24_military_exemption', 'n400_p9_25_us_armed_forces',
    'n400_p9_26a_current_service', 'n400_p9_26b_deploying', 'n400_p9_26c_stationed_abroad',
    'n400_p9_26d_former_service_abroad', 'n400_p9_27_court_martial_discharge', 'n400_p9_28_alien_discharge',
    'n400_p9_29_deserted', 'n400_p9_30a_nobility', 'n400_p9_30b_give_up_nobility',
    'n400_p9_31_support_constitution', 'n400_p9_32_understand_oath', 'n400_p9_33_unable_oath',
    'n400_p9_34_willing_oath', 'n400_p9_35_bear_arms', 'n400_p9_36_noncombatant_service',
    'n400_p9_37_national_importance_work'
  ];
  requiredPart9Ids.forEach((id) => assert(n400ById[id]?.type === 'radio', `N-400: missing independent official Part 9 question ${id}`));
  [
    'n400_criminal_history_other_yes', 'n400_security_any_yes', 'n400_removal_or_status_problem',
    'n400_willing_oath_service', 'n400_contact_permission', 'green_card_family_name',
    'state_or_province_of_birth', 'disability_accommodation_needed'
  ].forEach((id) => assert(!n400ById[id], `N-400: deprecated aggregate/non-form question must not return: ${id}`));

  const i130a = await callFlow('I-130A', 'en');
  const i130 = await callFlow('I-130', 'en');
  const i130Order = i130.body.steps.map((step) => step.id);
  assert(i130Order.indexOf('i130_relationship') < i130Order.indexOf('i130_petitioner_numbers'), 'I-130: relationship must come before petitioner details');
  assert(i130Order.indexOf('i130_petitioner_numbers') < i130Order.indexOf('i130_beneficiary_numbers'), 'I-130: petitioner details must come before beneficiary details');
  assert(i130Order.indexOf('i130_beneficiary_numbers') < i130Order.indexOf('i130_petitioner_statement'), 'I-130: beneficiary details must come before petitioner statement');
  const i130Fields = i130.body.steps.flatMap((step) => step.fields || []);
  assert(i130Fields.find((field) => field.id === 'petitioner_mailing_address')?.type === 'addressBlock', 'I-130: petitioner mailing address should be structured');
  assert(i130Fields.find((field) => field.id === 'beneficiary_current_address')?.type === 'addressBlock', 'I-130: beneficiary current address should be structured');

  const i130aOrder = i130a.body.steps.map((step) => step.id);
  assert(i130aOrder.indexOf('i130a_spouse_numbers') < i130aOrder.indexOf('i130a_spouse_current_address'), 'I-130A: spouse identity must come before address history');
  assert(i130aOrder.indexOf('i130a_spouse_prior_address_1') < i130aOrder.indexOf('i130a_spouse_birth_sex'), 'I-130A: residence history must follow form order before biographic details');
  assert(i130aOrder.indexOf('i130a_spouse_current_employment') < i130aOrder.indexOf('i130a_spouse_statement'), 'I-130A: employment history must come before statement');
  const i130aFields = i130a.body.steps.flatMap((step) => step.fields || []);
  assert(i130aFields.find((field) => field.id === 'spouse_residence_history')?.type === 'addressHistory', 'I-130A: spouse residence history should be structured');
  assert(i130aFields.find((field) => field.id === 'spouse_employment_history')?.type === 'employmentHistory', 'I-130A: spouse employment history should be structured');

  const i131 = await callFlow('I-131', 'en');
  const i131Order = i131.body.steps.map((step) => step.id);
  assert(i131Order.indexOf('i131_application_type') < i131Order.indexOf('i131_applicant_name'), 'I-131: application type must come before applicant information');
  assert(i131Order.indexOf('i131_applicant_name') < i131Order.indexOf('i131_beneficiary_status'), 'I-131: applicant information must come before beneficiary information');
  assert(i131Order.indexOf('i131_beneficiary_status') < i131Order.indexOf('i131_biographic'), 'I-131: beneficiary information must come before biographic information');
  assert(i131Order.indexOf('i131_biographic') < i131Order.indexOf('i131_processing_history'), 'I-131: biographic information must come before processing history');
  assert(i131Order.indexOf('i131_advance_parole_trip') < i131Order.indexOf('i131_applicant_contact'), 'I-131: travel details must come before applicant contact');
  const i131Fields = i131.body.steps.flatMap((step) => step.fields || []);
  assert(i131Fields.find((field) => field.id === 'i131_mailing_address')?.type === 'addressBlock', 'I-131: mailing address should be structured');
  assert(i131Fields.find((field) => field.id === 'i131_beneficiary_mailing_address')?.type === 'addressBlock', 'I-131: beneficiary address should be structured');
  assert(i131Fields.find((field) => field.id === 'i131_daytime_phone')?.type === 'phone', 'I-131: daytime phone should be US 10-digit phone field');
  assert(i131Fields.find((field) => field.id === 'i131_pickup_notice_address')?.showWhen?.[0]?.id === 'i131_pickup_notice_to_part2', 'I-131: pickup address should only show when Part 2 address is not used');
  assert(i131Fields.find((field) => field.id === 'i131_parole_qualification_explanation')?.showWhen?.[0]?.id === 'i131_application_type', 'I-131: parole qualification must be conditional by application type');
  assert(i131Fields.find((field) => field.id === 'i131_purpose_of_travel')?.showWhen?.[0]?.id === 'i131_application_type', 'I-131: travel purpose should only show for travel/parole application types');
  assert(i131Fields.find((field) => field.id === 'i131_initial_parole_agency_email')?.type === 'email', 'I-131: official agency email should be validated');
  assert(i131Fields.find((field) => field.id === 'i131_reparole_immvi_relationship')?.showWhen?.[0]?.id === 'i131_reparole_program', 'I-131: IMMVI relationship must be conditional on the selected re-parole program');

  const i90 = await callFlow('I-90', 'en');
  const i90Order = i90.body.steps.map((step) => step.id);
  assert(i90Order.indexOf('i90_numbers') < i90Order.indexOf('i90_legal_name'), 'I-90: numbers must come before applicant name');
  assert(i90Order.indexOf('i90_legal_name') < i90Order.indexOf('i90_mailing_address'), 'I-90: applicant name must come before mailing address');
  assert(i90Order.indexOf('i90_mailing_address') < i90Order.indexOf('i90_birth_sex'), 'I-90: address must come before birth and sex');
  assert(i90Order.indexOf('i90_birth_place') < i90Order.indexOf('i90_application_type'), 'I-90: biographic fields must come before Part 2 application type');
  assert(i90Order.indexOf('i90_reason') < i90Order.indexOf('i90_biographic_ethnicity_race'), 'I-90: reason must come before biographic Part 3 fields');
  assert(i90Order.indexOf('i90_biographic_colors') < i90Order.indexOf('i90_applicant_statement'), 'I-90: biographic fields must come before applicant statement');
  const i90Fields = i90.body.steps.flatMap((step) => step.fields || []);
  assert(i90Fields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-90: mailing address should be structured');
  assert(i90Fields.find((field) => field.id === 'physical_address')?.type === 'addressBlock', 'I-90: physical address should be structured');
  assert(i90Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-90: daytime phone should be split phone field');
  assert(i90Fields.find((field) => field.id === 'ssn')?.digits === 9, 'I-90: SSN should be captured as exactly 9 digits');
  assert(i90Fields.find((field) => field.id === 'applicant_statement_language')?.showWhen?.[0]?.id === 'applicant_statement', 'I-90: interpreter language should only show when interpreter read the application');

  const i589 = await callFlow('I-589', 'en');
  const i589Order = i589.body.steps.map((step) => step.id);
  assert(i589Order.indexOf('i589_applicant_numbers') < i589Order.indexOf('i589_legal_name'), 'I-589: numbers must come before applicant name');
  assert(i589Order.indexOf('i589_legal_name') < i589Order.indexOf('i589_residential_address'), 'I-589: applicant identity must come before address');
  assert(i589Order.indexOf('i589_residential_address') < i589Order.indexOf('i589_birth_sex_marital'), 'I-589: address/contact must come before birth/status fields');
  assert(i589Order.indexOf('i589_entry_1') < i589Order.indexOf('i589_spouse_identity'), 'I-589: entry/status must come before spouse/children');
  assert(i589Order.indexOf('i589_children_summary') < i589Order.indexOf('i589_asylum_basis'), 'I-589: family information must come before asylum basis');
  assert(i589Order.indexOf('i589_asylum_basis') < i589Order.indexOf('i589_partb_1a_past_harm'), 'I-589: basis must come before Part B narratives');
  assert(i589Order.indexOf('i589_partc_1_prior_applications') < i589Order.indexOf('i589_native_alphabet_name'), 'I-589: Part C must come before Part D native-name field');
  const i589Fields = i589.body.steps.flatMap((step) => step.fields || []);
  const i589ById = Object.fromEntries(i589Fields.map((field) => [field.id, field]));
  assert(i589Fields.find((field) => field.id === 'i589_residential_address')?.type === 'addressBlock', 'I-589: residential address should be structured');
  assert(i589Fields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-589: mailing address should be structured');
  assert(i589Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-589: daytime phone should be US 10-digit phone field');
  assert(i589Fields.find((field) => field.id === 'asylum_basis')?.type === 'checkboxes', 'I-589: asylum basis should be checkboxes');
  assert(i589ById.i589_residences_last_5_years?.type === 'addressHistory', 'I-589: five-year residence history should be structured');
  assert(i589ById.i589_employment_last_5_years?.type === 'employmentHistory', 'I-589: five-year employment history should be structured');
  assert(i589ById.spouse_family_name?.showWhen?.[0]?.id === 'marital_status', 'I-589: spouse identity must be tied to Married status');
  for (let number = 1; number <= 4; number += 1) {
    assert(i589ById[`child${number}_family_name`]?.showWhen?.[0]?.id === 'total_children', `I-589: child ${number} fields should depend on total children`);
    assert(i589ById[`child${number}_included`], `I-589: child ${number} included/not-included question is missing`);
  }
  assert(i589ById.i589_name_native_alphabet?.allowNonLatin === true, 'I-589: native-alphabet name must explicitly allow non-Latin characters');
  [
    'i589_past_harm_yes_no', 'i589_future_harm_yes_no', 'i589_foreign_accusation_yes_no',
    'i589_organization_membership_yes_no', 'i589_current_organization_participation_yes_no',
    'i589_torture_fear_yes_no', 'i589_prior_asylum_application', 'i589_traveled_through_other_country',
    'i589_other_country_lawful_status', 'i589_participated_in_persecution',
    'i589_returned_to_feared_country', 'i589_filing_more_than_one_year_after_arrival',
    'i589_us_crime_or_arrest'
  ].forEach((id) => assert(i589ById[id]?.type === 'radio' && i589ById[id].required, `I-589: missing required official question ${id}`));
  ['i589_harm_summary', 'i589_family_harmed_or_threatened', 'i589_safe_relocation', 'family_members_included']
    .forEach((id) => assert(!i589ById[id], `I-589: deprecated aggregate/non-form question must not return: ${id}`));

  const i864 = await callFlow('I-864', 'en');
  const i864Order = i864.body.steps.map((step) => step.id);
  assert(i864Order.indexOf('i864_sponsor_basis') < i864Order.indexOf('i864_principal_immigrant'), 'I-864: sponsor basis must come before principal immigrant');
  assert(i864Order.indexOf('i864_principal_address') < i864Order.indexOf('i864_sponsor_name'), 'I-864: principal immigrant details must come before sponsor details');
  assert(i864Order.indexOf('i864_sponsor_mailing_address') < i864Order.indexOf('i864_sponsor_birth'), 'I-864: sponsor address must come before sponsor birth/status');
  assert(i864Order.indexOf('i864_household_size') < i864Order.indexOf('i864_current_income'), 'I-864: household size must come before current income');
  assert(i864Order.indexOf('i864_tax_returns') < i864Order.indexOf('i864_assets'), 'I-864: tax returns must come before assets');
  assert(i864Order.indexOf('i864_assets') < i864Order.indexOf('i864_sponsor_contact'), 'I-864: assets must come before sponsor contact');
  const i864Fields = i864.body.steps.flatMap((step) => step.fields || []);
  assert(i864Fields.find((field) => field.id === 'principal_immigrant_mailing_address')?.type === 'addressBlock', 'I-864: principal immigrant mailing address should be structured');
  assert(i864Fields.find((field) => field.id === 'sponsor_mailing_address')?.type === 'addressBlock', 'I-864: sponsor mailing address should be structured');
  assert(i864Fields.find((field) => field.id === 'sponsor_physical_address')?.type === 'addressBlock', 'I-864: sponsor physical address should be structured');
  assert(i864Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-864: daytime phone should be US 10-digit phone field');

  const i912 = await callFlow('I-912', 'en');
  const i912Order = i912.body.steps.map((step) => step.id);
  assert(i912Order.indexOf('i912_request_type') < i912Order.indexOf('i912_primary_applicant_name'), 'I-912: request type must come before applicant name');
  assert(i912Order.indexOf('i912_mailing_address') < i912Order.indexOf('i912_basis'), 'I-912: address/contact must come before fee waiver basis');
  assert(i912Order.indexOf('i912_basis') < i912Order.indexOf('i912_household_size'), 'I-912: basis must come before household details');
  assert(i912Order.indexOf('i912_household_income') < i912Order.indexOf('i912_assets'), 'I-912: income must come before assets');
  assert(i912Order.indexOf('i912_financial_hardship') < i912Order.indexOf('i912_applicant_statement'), 'I-912: hardship must come before applicant statement');
  const i912Fields = i912.body.steps.flatMap((step) => step.fields || []);
  assert(i912Fields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-912: mailing address should be structured');
  assert(i912Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-912: daytime phone should be US 10-digit phone field');
  assert(i912Fields.find((field) => field.id === 'fee_waiver_basis')?.type === 'checkboxes', 'I-912: fee waiver basis should be checkboxes');

  const i751 = await callFlow('I-751', 'en');
  const i751Order = i751.body.steps.map((step) => step.id);
  assert(i751Order.indexOf('i751_filing_type') < i751Order.indexOf('i751_conditional_resident_name'), 'I-751: filing type must come before resident name');
  assert(i751Order.indexOf('i751_marriage_status') < i751Order.indexOf('i751_mailing_address'), 'I-751: marital status must follow official Part 1 order before addresses');
  assert(i751Order.indexOf('i751_marriage_status') < i751Order.indexOf('i751_spouse_name'), 'I-751: marriage status must come before spouse details');
  assert(i751Order.indexOf('i751_part1_questions') < i751Order.indexOf('i751_biographic'), 'I-751: Part 1 questions must come before biographic information');
  assert(i751Order.indexOf('i751_spouse_address') < i751Order.indexOf('i751_children'), 'I-751: spouse/stepparent information must come before children');
  const i751Fields = i751.body.steps.flatMap((step) => step.fields || []);
  assert(i751Fields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-751: mailing address should be structured');
  assert(i751Fields.find((field) => field.id === 'physical_address')?.type === 'addressBlock', 'I-751: physical address should be structured');
  assert(i751Fields.find((field) => field.id === 'residence_history')?.type === 'addressHistory', 'I-751: residence history should be structured');
  assert(i751Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-751: daytime phone should be US 10-digit phone field');
  assert(i751Fields.find((field) => field.id === 'i751_child1_address')?.showWhen?.[0]?.id === 'total_children', 'I-751: child address should only show when at least one child is reported');
  assert(i751Fields.find((field) => field.id === 'i751_waiver_bases')?.type === 'checkboxes', 'I-751: waiver bases must allow multiple official selections');

  const i539 = await callFlow('I-539', 'en');
  const i539Order = i539.body.steps.map((step) => step.id);
  assert(i539Order.indexOf('i539_request_type') < i539Order.indexOf('i539_applicant_name'), 'I-539: request type must come before applicant name');
  assert(i539Order.indexOf('i539_mailing_address') < i539Order.indexOf('i539_current_status'), 'I-539: address must come before current status');
  assert(i539Order.indexOf('i539_current_status') < i539Order.indexOf('i539_passport'), 'I-539: status must come before passport details');
  assert(i539Order.indexOf('i539_dependents') < i539Order.indexOf('i539_reason'), 'I-539: dependents must come before reason');
  assert(i539Order.indexOf('i539_reason') < i539Order.indexOf('i539_contact'), 'I-539: reason/status docs must come before contact');
  const i539Fields = i539.body.steps.flatMap((step) => step.fields || []);
  assert(i539Fields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-539: mailing address should be structured');
  assert(i539Fields.find((field) => field.id === 'physical_address')?.type === 'addressBlock', 'I-539: physical address should be structured');
  assert(i539Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-539: daytime phone should be US 10-digit phone field');
  assert(i539Fields.find((field) => field.id === 'i539_dependents_details')?.showWhen?.[0]?.id === 'dependents_included', 'I-539: dependent details should only show when dependents are included');
  assert(i539Fields.find((field) => field.id === 'i539_public_benefits_details')?.showWhenAny?.length === 2, 'I-539: public benefits details should only show for Yes or Not sure');
  assert(i539Fields.find((field) => field.id === 'i539_criminal_history_details')?.showWhenAny?.length === 2, 'I-539: criminal details should only show for Yes or Not sure');

  const i821 = await callFlow('I-821', 'en');
  const i821Order = i821.body.steps.map((step) => step.id);
  assert(i821Order.indexOf('i821_tps_request_type') < i821Order.indexOf('i821_applicant_name'), 'I-821: TPS request type must come before applicant name');
  assert(i821Order.indexOf('i821_mailing_address') < i821Order.indexOf('i821_entry_status'), 'I-821: address/contact must come before entry status');
  assert(i821Order.indexOf('i821_tps_dates') < i821Order.indexOf('i821_criminal_security'), 'I-821: TPS dates must come before criminal/security questions');
  const i821Fields = i821.body.steps.flatMap((step) => step.fields || []);
  assert(i821Fields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-821: mailing address should be structured');
  assert(i821Fields.find((field) => field.id === 'physical_address')?.type === 'addressBlock', 'I-821: physical address should be structured');
  assert(i821Fields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-821: daytime phone should be US 10-digit phone field');
  assert(i821Fields.find((field) => field.id === 'i821_criminal_history_details')?.showWhenAny?.length === 2, 'I-821: criminal details should only show for Yes or Not sure');
  assert(i821Fields.find((field) => field.id === 'i821_security_issue_details')?.showWhenAny?.length === 2, 'I-821: security details should only show for Yes or Not sure');

  const i821d = await callFlow('I-821D', 'en');
  const i821dOrder = i821d.body.steps.map((step) => step.id);
  assert(i821dOrder.indexOf('i821d_request_type') < i821dOrder.indexOf('i821d_applicant_name'), 'I-821D: request type must come before applicant name');
  assert(i821dOrder.indexOf('i821d_mailing_address') < i821dOrder.indexOf('i821d_arrival_before_16'), 'I-821D: address/contact must come before arrival questions');
  assert(i821dOrder.indexOf('i821d_arrival_before_16') < i821dOrder.indexOf('i821d_residence_history'), 'I-821D: arrival must come before residence history');
  assert(i821dOrder.indexOf('i821d_education_military') < i821dOrder.indexOf('i821d_criminal_history'), 'I-821D: education/military must come before criminal history');
  const i821dFields = i821d.body.steps.flatMap((step) => step.fields || []);
  assert(i821dFields.find((field) => field.id === 'mailing_address')?.type === 'addressBlock', 'I-821D: mailing address should be structured');
  assert(i821dFields.find((field) => field.id === 'physical_address')?.type === 'addressBlock', 'I-821D: physical address should be structured');
  assert(i821dFields.find((field) => field.id === 'residence_history')?.type === 'addressHistory', 'I-821D: residence history should be structured');
  assert(i821dFields.find((field) => field.id === 'daytime_phone')?.type === 'phone', 'I-821D: daytime phone should be US 10-digit phone field');
  assert(i821dFields.find((field) => field.id === 'prior_daca_dates')?.showWhen?.[0]?.id === 'daca_request_type', 'I-821D: prior DACA dates should only show for renewals');

  const g325a = await callFlow('G-325A', 'en');
  const biographicHistory = g325a.body.steps.find((step) => step.id === 'biographic_history');
  assert(biographicHistory?.fields.find((field) => field.id === 'g325a_residence_history')?.type === 'addressHistory', 'G-325A: residence history should be structured');
  assert(biographicHistory?.fields.find((field) => field.id === 'g325a_employment_history')?.type === 'employmentHistory', 'G-325A: employment history should be structured');

  const scriptCount = syntaxCheckInlineScripts();
  console.log(`index.html inline scripts syntax ok: ${scriptCount}`);
  console.log('immigration flow QA passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
