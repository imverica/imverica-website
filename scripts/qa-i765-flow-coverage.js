const assert = require('assert');
const { buildImmigrationFlow, localizeFlow } = require('../netlify/functions/lib/immigration-flow-schema');

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
  buildImmigrationFlow('I-765', { names: { en: 'Application for Employment Authorization' } }, { title: 'I-765' }),
  'en'
);

const stepIds = (flow.steps || []).map((step) => step.id);
const fields = collectFields(flow);
const before = (first, second) => {
  const firstIndex = stepIds.indexOf(first);
  const secondIndex = stepIds.indexOf(second);
  assert(firstIndex >= 0, `Missing I-765 ordered step: ${first}`);
  assert(secondIndex >= 0, `Missing I-765 ordered step: ${second}`);
  assert(firstIndex < secondIndex, `Expected ${first} before ${second}`);
};

[
  'i765_application_reason',
  'applicant',
  'applicant_name_parts',
  'applicant_other_names',
  'address_contact',
  'physical_address_match',
  'applicant_uscis_numbers',
  'i765_social_security',
  'applicant_citizenship',
  'applicant_birth_place',
  'applicant_birth_country',
  'applicant_birth_date',
  'applicant_sex_marital',
  'immigration_entry_record',
  'immigration_passport',
  'immigration_passport_expiration',
  'immigration_history',
  'i765_work_permit_basis',
  'i765_eligibility_category',
  'i765_pending_receipt',
  'i765_prior_ead',
  'i765_applicant_statement',
  'contact_info',
  'documents_interpreter_choice',
  'documents_preparer'
].forEach((stepId) => assert(stepIds.includes(stepId), `Missing I-765 flow step: ${stepId}`));

[
  'i765_application_reason',
  'applicant_full_name',
  'applicant_given_name',
  'applicant_family_name',
  'other_names_used',
  'mailing_address',
  'physical_same_as_mailing',
  'alien_number',
  'uscis_online_account_number',
  'has_ssn',
  'ssn',
  'country_of_citizenship',
  'city_of_birth',
  'state_or_province_of_birth',
  'country_of_birth',
  'date_of_birth',
  'sex',
  'marital_status',
  'place_entry',
  'i94_number',
  'passport_number',
  'passport_country_of_issuance',
  'passport_expiration',
  'current_immigration_status',
  'last_arrival_date',
  'ead_basis',
  'eligibility_category_code',
  'c8_arrested_or_convicted',
  'pending_application_receipt',
  'prior_ead',
  'applicant_statement',
  'daytime_phone',
  'email_address',
  'has_interpreter',
  'has_preparer'
].forEach((fieldId) => assert(fields.has(fieldId), `Missing I-765 frontend field: ${fieldId}`));

before('i765_application_reason', 'applicant');
before('applicant', 'address_contact');
before('address_contact', 'applicant_uscis_numbers');
before('applicant_uscis_numbers', 'i765_social_security');
before('i765_social_security', 'applicant_citizenship');
before('applicant_birth_date', 'immigration_entry_record');
before('immigration_entry_record', 'immigration_passport');
before('immigration_history', 'i765_work_permit_basis');
before('i765_work_permit_basis', 'i765_eligibility_category');
before('i765_eligibility_category', 'i765_pending_receipt');
before('i765_prior_ead', 'i765_applicant_statement');
before('i765_applicant_statement', 'contact_info');
before('contact_info', 'documents_interpreter_choice');

assert(fields.get('mailing_address')?.type === 'addressBlock', 'I-765 mailing address should use structured address block');
assert(fields.get('daytime_phone')?.type === 'phone', 'I-765 phone should use split phone UI');
assert(fields.get('ssn')?.inputmode === 'numeric', 'I-765 SSN should prefer numeric input');

console.log('I-765 frontend flow coverage QA passed');
