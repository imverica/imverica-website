const fs = require('fs');
const path = require('path');
const { i485FieldValues } = require('../netlify/functions/lib/i485-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const ROOT = path.resolve(__dirname, '..');
const scenario = require('../form-scenarios/i-485-asylee.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const values = i485FieldValues({ formAnswers: scenario.fields, contact: {} });

assert(Object.keys(values).length >= 400, `Expected exact I-485 map to produce at least 400 fields, got ${Object.keys(values).length}`);

assertEqual(values['AlienNumber[0]'], '208924970', 'A-number page 1');
assertEqual(values['AlienNumber[23]'], '208924970', 'A-number page 24');
assertEqual(values['Pt1Line1_FamilyName[0]'], 'HOVDAN', 'Current family name page 1');
assertEqual(values['Pt1Line1_FamilyName[1]'], 'HOVDAN', 'Current family name page 24');
assertEqual(values['Pt1Line6_CB_Sex[0]'], true, 'Female checkbox should be selected for YANA');
assertEqual(values['Pt1Line6_CB_Sex[1]'], false, 'Male checkbox should be unselected for YANA');
assertEqual(values['P1Line12_I94[0]'], '77692068933', 'I-94 exact field');
assertEqual(values['Pt1Line19_SSN[0]'], '671842359', 'SSN exact field');
assertEqual(values['Pt3Line3_DaytimePhoneNumber1[0]'], '2534097210', 'Applicant daytime phone');
assertEqual(values['Pt3Line4_MobileNumber1[0]'], '2534097210', 'Applicant mobile phone');
assertEqual(values['Pt3Line5_Email[0]'], 'yanahovdan@gmail.com', 'Applicant email');

const semanticFemale = i485FieldValues({ formAnswers: { applicant_family_name: 'TEST', sex: 'female' } });
const semanticMale = i485FieldValues({ formAnswers: { applicant_family_name: 'TEST', sex: 'male' } });
assertEqual(semanticFemale['Pt1Line6_CB_Sex[0]'], true, 'Semantic female checkbox [0]');
assertEqual(semanticFemale['Pt1Line6_CB_Sex[1]'], false, 'Semantic female checkbox [1]');
assertEqual(semanticMale['Pt1Line6_CB_Sex[0]'], false, 'Semantic male checkbox [0]');
assertEqual(semanticMale['Pt1Line6_CB_Sex[1]'], true, 'Semantic male checkbox [1]');

const inputPdf = fs.readFileSync(path.join(ROOT, 'assets/form-cache/pdfs/i-485.pdf'));
const result = incrementalFillPdf(inputPdf, values);
assert(result.filledFields.length >= 400, `Expected at least 400 incremental fields filled, got ${result.filledFields.length}`);

const knownSkipped = new Set([
  'Pt4Line7NameOfEmployer',
  'Pt4Line7Occupation',
  'PriorSpouseDOB',
  'PriorMarriagePlaceCity',
  'PriorMarriagePlaceState',
  'PriorMarriagePlaceCountry',
  'MarriageEndedDate',
  'P14_Line2_Title',
  'P14_Line2_Address',
  'P14_Line3_Title',
  'P14_Line3_Employment',
  'P14_Line3_Dates',
  'P14_Line3_Occupation'
]);

const unknownSkipped = result.skippedFields.filter((field) => !knownSkipped.has(field));
assert(!unknownSkipped.length, `Unexpected skipped I-485 fields: ${unknownSkipped.join(', ')}`);

console.log(JSON.stringify({
  ok: true,
  mappedFields: Object.keys(values).length,
  filledFields: result.filledFields.length,
  knownSkippedFields: result.skippedFields.length
}, null, 2));
