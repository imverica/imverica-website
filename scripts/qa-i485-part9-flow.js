const assert = require('assert');
const { buildImmigrationFlow, localizeFlow } = require('../netlify/functions/lib/immigration-flow-schema');

function fieldByItem(step, itemNumber) {
  return (step.fields || []).find((field) => field.itemNumber === itemNumber);
}

function hasCondition(field, id, equals) {
  return (field.showWhen || []).some((condition) => condition.id === id && condition.equals === equals);
}

function hasAnyCondition(field, id, equals) {
  return (field.showWhenAny || []).some((condition) => condition.id === id && condition.equals === equals);
}

const flow = localizeFlow(
  buildImmigrationFlow('I-485', { names: { en: 'Application to Register Permanent Residence or Adjust Status' } }, { title: 'I-485' }),
  'en'
);

const entries = flow.steps.find((step) => step.id === 'i485_part9_entries');
const criminal = flow.steps.find((step) => step.id === 'i485_part9_criminal');
const security = flow.steps.find((step) => step.id === 'i485_part9_security');
const other = flow.steps.find((step) => step.id === 'i485_part9_other');

assert(entries, 'Missing I-485 Part 9 entries step');
assert(criminal, 'Missing I-485 Part 9 criminal step');
assert(security, 'Missing I-485 Part 9 security step');
assert(other, 'Missing I-485 Part 9 other step');

assert(hasCondition(fieldByItem(entries, '20'), 'Pt8Line24a_YesNo', 'Yes'), 'Item 20 must appear only after Item 19 = Yes');
assert(hasCondition(fieldByItem(entries, '21'), 'Pt8Line24a_YesNo', 'Yes'), 'Item 21 must require Item 19 = Yes');
assert(hasCondition(fieldByItem(entries, '21'), 'Pt8Line24b_YesNo', 'No'), 'Item 21 must appear only after Item 20 = No');
assert(hasCondition(fieldByItem(criminal, '29'), 'Pt8Line28_YesNo', 'Yes'), 'Item 29 must appear only after Item 28 = Yes');
assert(hasCondition(fieldByItem(criminal, '35.b'), 'Pt8Line35a_YesNo', 'Yes'), 'Item 35.b must appear only after Item 35.a = Yes');
assert(hasCondition(fieldByItem(criminal, '40'), 'Pt9Line39_YesNo', 'Yes'), 'Item 40 must appear only after Item 39 = Yes');
assert(hasCondition(fieldByItem(other, '86'), 'Pt9Line85_YesNo', 'Yes'), 'Item 86 must appear only after Item 85 = Yes');

const criminalExplanation = criminal.fields.find((field) => field.id === 'part9_explanation_criminal_22_41');
assert(criminalExplanation, 'Missing Part 14 explanation field for Items 22-41');
assert(hasAnyCondition(criminalExplanation, 'Pt8Line28_YesNo', 'Yes'), 'Part 14 criminal explanation must trigger from Item 28 = Yes');

const securityExplanation = security.fields.find((field) => field.id === 'part9_explanation_security_42_45');
assert(securityExplanation, 'Missing Part 14 explanation field for Items 42-45');
assert(hasAnyCondition(securityExplanation, 'Pt8Line45_YesNo', 'Yes'), 'Part 14 security explanation must trigger from Item 45 = Yes');

console.log('I-485 Part 9 flow QA passed');
