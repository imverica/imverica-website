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
