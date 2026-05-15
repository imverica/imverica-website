const assert = require('assert');
const { buildImmigrationFlow, localizeFlow } = require('../netlify/functions/lib/immigration-flow-schema');
const part9Logic = require('../form-logic/i-485.part9.json');

function collectFields(flow) {
  const fields = new Map();
  for (const step of flow.steps || []) {
    for (const field of step.fields || []) {
      fields.set(field.id, { ...field, stepId: step.id });
    }
  }
  return fields;
}

const flow = localizeFlow(
  buildImmigrationFlow('I-485', { names: { en: 'Application to Register Permanent Residence or Adjust Status' } }, { title: 'I-485' }),
  'en'
);

const fields = collectFields(flow);
const stepIds = new Set((flow.steps || []).map((step) => step.id));
const hasStepOrPrefix = (id) => stepIds.has(id) || [...stepIds].some((stepId) => stepId.startsWith(`${id}_`));
const orderedStepIds = (flow.steps || []).map((step) => step.id);
const before = (first, second) => {
  const firstIndex = orderedStepIds.indexOf(first);
  const secondIndex = orderedStepIds.indexOf(second);
  assert(firstIndex >= 0, `Missing I-485 ordered step: ${first}`);
  assert(secondIndex >= 0, `Missing I-485 ordered step: ${second}`);
  assert(firstIndex < secondIndex, `Expected ${first} before ${second}`);
};

[
  'purpose',
  'adjustment_basis',
  'i485_related_petition',
  'i485_location_status',
  'i485_medical_exam',
  'i485_last_entry_type',
  'i485_i94_status',
  'i485_residence_period',
  'i485_prior_us_address',
  'i485_foreign_address',
  'i485_social_security',
  'i485_current_work_history',
  'i485_foreign_work_history',
  'i485_parent1_name',
  'i485_parent2_current_name',
  'i485_prior_spouse_end_place',
  'i485_prior_spouse_end_result',
  'i485_child1_identity',
  'i485_biographic_identity',
  'i485_biographic_body',
  'i485_biographic_colors',
  'i485_part9_entries',
  'i485_part9_criminal',
  'i485_part9_security',
  'i485_part9_other',
  'applicant',
  'applicant_birth_date',
  'applicant_birth_place',
  'applicant_citizenship',
  'applicant_sex_marital',
  'applicant_uscis_numbers',
  'address_contact',
  'contact_info',
  'immigration_history',
  'immigration_entry_record',
  'immigration_passport',
  'immigration_prior_filings',
  'documents_identity',
  'documents_supporting',
  'documents_translation',
  'documents_interpreter_choice',
  'documents_interpreter',
  'documents_preparer',
  'documents_notes'
].forEach((stepId) => assert(hasStepOrPrefix(stepId), `Missing I-485 flow step: ${stepId}`));

[
  'form_code_confirmed',
  'preparation_goal',
  'adjustment_basis',
  'inside_us_now',
  'inspection_or_parole',
  'medical_exam_status',
  'applicant_full_name',
  'applicant_given_name',
  'applicant_family_name',
  'date_of_birth',
  'city_of_birth',
  'state_or_province_of_birth',
  'country_of_birth',
  'country_of_citizenship',
  'sex',
  'marital_status',
  'alien_number',
  'mailing_address',
  'daytime_phone',
  'email_address',
  'current_immigration_status',
  'last_arrival_date',
  'place_entry',
  'i94_number',
  'passport_number',
  'passport_country_of_issuance',
  'passport_expiration',
  'admission_basis',
  'status_at_last_entry',
  'paroled_as',
  'date_of_last_entry',
  'manner_of_last_entry',
  'authorized_stay_expires',
  'visa_number',
  'same_address_five_years',
  'prior_us_addresses',
  'last_foreign_address',
  'has_ssn',
  'ssn',
  'ssn_ssa_consent',
  'eligibility_basis',
  'current_employment_history',
  'foreign_employment_history',
  'father_family_name',
  'mother_family_name',
  'mother_birth_family_name',
  'times_married',
  'prior_spouse_family_name',
  'prior_spouse_marriage_end_type',
  'total_children',
  'child1_family_name',
  'ethnicity',
  'race',
  'weight_lbs',
  'has_interpreter',
  'has_preparer'
].forEach((fieldId) => assert(fields.has(fieldId), `Missing I-485 core frontend field: ${fieldId}`));

for (const item of part9Logic.items || []) {
  assert(fields.has(item.key), `Missing I-485 Part 9 frontend field for item ${item.item}: ${item.key}`);
}

[
  'part9_explanation_criminal_22_41',
  'part9_explanation_security_42_45',
  'part9_explanation_family_member_security_46',
  'part9_explanation_security_47_55',
  'part9_explanation_military_50_51'
].forEach((fieldId) => assert(fields.has(fieldId), `Missing Part 14 explanation frontend field: ${fieldId}`));

before('applicant', 'adjustment_basis');
before('applicant_birth_date', 'adjustment_basis');
before('applicant_birth_place', 'adjustment_basis');
before('applicant_citizenship', 'adjustment_basis');
before('immigration_entry_record', 'adjustment_basis');
before('address_contact', 'adjustment_basis');
before('i485_foreign_address', 'adjustment_basis');
before('i485_social_security', 'adjustment_basis');
before('adjustment_basis', 'i485_related_petition');
before('i485_related_petition', 'i485_parent1_name');
before('i485_part9_entries_01', 'contact_info');
before('contact_info', 'documents_interpreter_choice');

console.log('I-485 frontend flow coverage QA passed');
