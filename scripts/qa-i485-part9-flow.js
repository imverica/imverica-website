const assert = require('assert');
const { buildImmigrationFlow, localizeFlow } = require('../netlify/functions/lib/immigration-flow-schema');

function fieldByItem(step, itemNumber) {
  return (step.fields || []).find((field) => field.itemNumber === itemNumber);
}

function fieldById(step, id) {
  return (step.fields || []).find((field) => field.id === id);
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

const organizationFields = [
  'Pt9Line2_Organization1',
  'Pt9Line3_CityTownOfBirth',
  'Pt9Line3_State',
  'Pt9Line3_Country',
  'Pt9Line4_FamilyName',
  'Pt9Line4_Involvement',
  'Pt9Line5_DateFrom',
  'Pt9Line5_DateTo'
];
for (const id of organizationFields) {
  assert(hasCondition(fieldById(entries, id), 'Pt8Line1_YesNo', 'Yes'), `${id} must appear only after Item 1 = Yes`);
}

const criminalExplanation = criminal.fields.find((field) => field.id === 'part9_explanation_criminal_22_41');
assert(criminalExplanation, 'Missing Part 14 explanation field for Items 22-41');
assert(hasAnyCondition(criminalExplanation, 'Pt8Line28_YesNo', 'Yes'), 'Part 14 criminal explanation must trigger from Item 28 = Yes');
assert(hasAnyCondition(criminalExplanation, 'Pt9Line39_YesNo', 'Yes'), 'Part 14 criminal explanation must trigger from Item 39 = Yes');

const securityExplanation = security.fields.find((field) => field.id === 'part9_explanation_security_42_45');
assert(securityExplanation, 'Missing Part 14 explanation field for Items 42-45');
assert(hasAnyCondition(securityExplanation, 'Pt8Line45_YesNo', 'Yes'), 'Part 14 security explanation must trigger from Item 45 = Yes');

const familySecurityExplanation = security.fields.find((field) => field.id === 'part9_explanation_family_member_security_46');
assert(familySecurityExplanation, 'Missing Part 14 explanation field for Item 46');
assert(hasAnyCondition(familySecurityExplanation, 'Pt8Line46_YesNo', 'Yes'), 'Part 14 family-member security explanation must trigger from Item 46 = Yes');

const security47to55Explanation = security.fields.find((field) => field.id === 'part9_explanation_security_47_55');
assert(security47to55Explanation, 'Missing Part 14 explanation field for Items 47-55');
assert(hasAnyCondition(security47to55Explanation, 'Pt8Line47_YesNo', 'Yes'), 'Part 14 security explanation must trigger from Item 47 = Yes');
assert(hasAnyCondition(security47to55Explanation, 'Pt8Line55_YesNo', 'Yes'), 'Part 14 security explanation must trigger from Item 55 = Yes');

const militaryExplanation = security.fields.find((field) => field.id === 'part9_explanation_military_50_51');
assert(militaryExplanation, 'Missing Part 14 military details explanation field for Items 50-51');
assert(hasAnyCondition(militaryExplanation, 'Pt8Line50_YesNo', 'Yes'), 'Part 14 military explanation must trigger from Item 50 = Yes');
assert(hasAnyCondition(militaryExplanation, 'Pt8Line51_YesNo', 'Yes'), 'Part 14 military explanation must trigger from Item 51 = Yes');

const part9ItemNumbers = new Set();
for (const step of [entries, criminal, security, other]) {
  for (const field of step.fields || []) {
    if (field.part === 9 && field.itemNumber) part9ItemNumbers.add(field.itemNumber);
  }
}
for (const expected of [
  '1', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21',
  '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35.a', '35.b', '36', '37', '38', '39', '40', '41',
  '42.a', '42.b', '42.c', '42.d', '43.a', '43.b', '43.c', '43.d', '43.e', '43.f', '43.g', '43.h', '43.i', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53.a', '53.b', '53.c', '53.d', '54', '55',
  '63', '64', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78.a', '78.b', '79', '80', '81', '82', '83', '84.a', '84.b', '84.c', '85', '86'
]) {
  assert(part9ItemNumbers.has(expected), `Missing I-485 Part 9 frontend field for official item ${expected}`);
}

console.log('I-485 Part 9 flow QA passed');
