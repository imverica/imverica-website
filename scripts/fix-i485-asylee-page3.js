const fs = require('fs');
const path = require('path');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function findField(q, key) {
  for (const page of q.pages || []) {
    for (const field of page.fields || []) {
      if (field.key === key) return field;
    }
  }
  return null;
}

function setIfExists(q, answers, key, value) {
  if (findField(q, key)) {
    answers[key] = value;
  } else {
    console.log('MISSING KEY:', key);
  }
}

function deleteIfExists(answers, key) {
  if (Object.prototype.hasOwnProperty.call(answers, key)) {
    delete answers[key];
  }
}

function leftmostOption(q, key) {
  const field = findField(q, key);
  if (!field || !Array.isArray(field.options) || !field.options.length) return undefined;

  const sorted = [...field.options].sort((a, b) => {
    const ax = typeof a.x === 'number' ? a.x : 0;
    const bx = typeof b.x === 'number' ? b.x : 0;
    return ax - bx;
  });

  return sorted[0].value;
}

function rightmostOption(q, key) {
  const field = findField(q, key);
  if (!field || !Array.isArray(field.options) || !field.options.length) return undefined;

  const sorted = [...field.options].sort((a, b) => {
    const ax = typeof a.x === 'number' ? a.x : 0;
    const bx = typeof b.x === 'number' ? b.x : 0;
    return ax - bx;
  });

  return sorted[sorted.length - 1].value;
}

const questionnairePath = 'questionnaires/i-485.questionnaire.json';
const answersPath = 'answers/i-485-curated-asylee.answers.json';

const q = readJson(questionnairePath);
const answers = readJson(answersPath);

// Page 3 I-94 section
setIfExists(q, answers, 'P1Line12_FamilyName', 'HOVDAN');
setIfExists(q, answers, 'P1Line13_GivenName', 'YANA');
setIfExists(q, answers, 'P1Line12_I94', '77692068933');
setIfExists(q, answers, 'Pt1Line12_Date', 'D/S');
setIfExists(q, answers, 'Pt1Line12_Status', 'ASYLEE');
setIfExists(q, answers, 'Pt1Line14_Status', 'ASYLEE');
setIfExists(q, answers, 'Pt1Line15_Date', 'D/S');

// Page 3 current physical address, exact keys from samples
setIfExists(q, answers, 'Part1_Item18_InCareOfName', '');
setIfExists(q, answers, 'Pt1Line18_StreetNumberName', '15 164 ST SW');
setIfExists(q, answers, 'Pt1Line18_CityOrTown', 'BOTHELL');
setIfExists(q, answers, 'Pt1Line18_State', 'WA');
setIfExists(q, answers, 'Pt1Line18_ZipCode', '98012');
setIfExists(q, answers, 'Pt1Line18US_AptSteFlrNumber', 'B35');
setIfExists(q, answers, 'Pt1Line18_Date', '02/15/2025');

// Apt is leftmost checkbox. This fixes the current wrong middle checkbox.
const aptValue = leftmostOption(q, 'Pt1Line18US_Unit');
if (aptValue !== undefined) answers['Pt1Line18US_Unit'] = aptValue;

// Current mailing address = Yes, so mailing fields must stay blank
const yesValue = leftmostOption(q, 'Pt1Line18_YN');
if (yesValue !== undefined) answers['Pt1Line18_YN'] = yesValue;

for (const key of Object.keys(answers)) {
  const k = key.toLowerCase();
  if (k.includes('mailing') || k.includes('mail')) {
    delete answers[key];
  }
}

// Remove old wrong address aliases if any
for (const key of [
  'Pt1Line18US_StreetNumberName',
  'Pt1Line18US_CityOrTown',
  'Pt1Line18US_State',
  'Pt1Line18US_ZipCode'
]) {
  deleteIfExists(answers, key);
}

writeJson(answersPath, answers);

console.log('DONE');
console.log('Patched:', answersPath);
console.log('Fields:', Object.keys(answers).length);
