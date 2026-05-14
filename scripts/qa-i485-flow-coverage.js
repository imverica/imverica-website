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

[
  'purpose',
  'adjustment_basis',
  'i485_entry_details',
  'i485_prior_addresses_ssn',
  'i485_processing_employment',
  'i485_family_history',
  'i485_prior_spouse_children_bio',
  'i485_part9_entries',
  'i485_part9_criminal',
  'i485_part9_security',
  'i485_part9_other',
  'applicant',
  'address_contact',
  'immigration_history',
  'documents_review'
].forEach((stepId) => assert(stepIds.has(stepId), `Missing I-485 flow step: ${stepId}`));

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
  'mailing_address_line1',
  'mailing_city',
  'mailing_state',
  'mailing_zip',
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

console.log('I-485 frontend flow coverage QA passed');
