const fs = require('fs');
const path = require('path');
const { i485FieldValues, i485TextOverlays } = require('../netlify/functions/lib/i485-pdf-map');
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
const textOverlays = i485TextOverlays({ formAnswers: scenario.fields, contact: {} });

assert(Object.keys(values).length >= 300, `Expected exact I-485 map to produce at least 300 real fields, got ${Object.keys(values).length}`);
assertEqual(textOverlays.length, 0, 'No synthetic overlays are expected for the current I-485 map');

assertEqual(values['AlienNumber[0]'], '208924970', 'A-number page 1');
assertEqual(values['AlienNumber[23]'], '208924970', 'A-number page 24');
assertEqual(values['Pt1Line1_FamilyName[0]'], 'HOVDAN', 'Current family name page 1');
assertEqual(values['Pt1Line1_FamilyName[1]'], 'HOVDAN', 'Current family name page 24');
assertEqual(values['Pt1Line3_YN[0]'], false, 'Other date of birth Yes should be unselected');
assertEqual(values['Pt1Line3_YN[1]'], true, 'Other date of birth No should be selected');
assertEqual(values['Pt1Line4_YN[0]'], true, 'Has A-number Yes should be selected when A-number is present');
assertEqual(values['Pt1Line4_YN[1]'], false, 'Has A-number No should be unselected when A-number is present');
assertEqual(values['Pt1Line5_YN[0]'], false, 'Other A-number Yes should be unselected');
assertEqual(values['Pt1Line5_YN[1]'], true, 'Other A-number No should be selected');
assertEqual(values['Pt1Line6_CB_Sex[0]'], true, 'Female checkbox should be selected for YANA');
assertEqual(values['Pt1Line6_CB_Sex[1]'], false, 'Male checkbox should be unselected for YANA');
assertEqual(values['Pt1Line10_NonImmDate[0]'], 'N/A', 'N/A visa number should also mark nonimmigrant visa issue date N/A');
assertEqual(values['Pt2Line11_CB[0]'], false, 'Last arrival admitted checkbox should be unselected');
assertEqual(values['Pt2Line11_CB[1]'], true, 'Last arrival paroled checkbox should be selected');
assertEqual(values['Pt2Line11_CB[2]'], false, 'Last arrival without admission/parole checkbox should be unselected');
assertEqual(values['Pt2Line11_CB[3]'], false, 'Last arrival other checkbox should be unselected');
assertEqual(values['P1Line12_I94[0]'], '77692068933', 'I-94 exact field');
assertEqual(values['Pt1Line19_SSN[0]'], '671842359', 'SSN exact field');
assertEqual(values['Pt3Line3_DaytimePhoneNumber1[0]'], '(253) 409-7210', 'Applicant daytime phone');
assertEqual(values['Pt3Line4_MobileNumber1[0]'], '(253) 409-7210', 'Applicant mobile phone');
assertEqual(values['Pt3Line5_Email[0]'], 'yanahovdan@gmail.com', 'Applicant email');

const semanticFemale = i485FieldValues({ formAnswers: { applicant_family_name: 'TEST', sex: 'female' } });
const semanticMale = i485FieldValues({ formAnswers: { applicant_family_name: 'TEST', sex: 'male' } });
assertEqual(semanticFemale['Pt1Line6_CB_Sex[0]'], true, 'Semantic female checkbox [0]');
assertEqual(semanticFemale['Pt1Line6_CB_Sex[1]'], false, 'Semantic female checkbox [1]');
assertEqual(semanticMale['Pt1Line6_CB_Sex[0]'], false, 'Semantic male checkbox [0]');
assertEqual(semanticMale['Pt1Line6_CB_Sex[1]'], true, 'Semantic male checkbox [1]');

const inputPdf = fs.readFileSync(path.join(ROOT, 'assets/form-cache/pdfs/i-485.pdf'));
const result = incrementalFillPdf(inputPdf, values, textOverlays);
assert(result.filledFields.length >= 300, `Expected at least 300 incremental fields filled, got ${result.filledFields.length}`);
assertEqual(result.skippedFields.length, 0, 'No exact I-485 fields should be skipped');

console.log(JSON.stringify({
  ok: true,
  mappedFields: Object.keys(values).length,
  filledFields: result.filledFields.length,
  overlayFields: textOverlays.length,
  skippedFields: result.skippedFields.length
}, null, 2));
