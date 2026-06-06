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

assert(Object.keys(values).length >= 415, `Expected exact I-485 map to produce at least 415 real fields, got ${Object.keys(values).length}`);
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
assertEqual(values['Pt1Line18US_Unit[2]'], true, 'Current US address apartment checkbox');
assertEqual(values['Pt2Line1_YN[0]'], false, 'Part 2 EOIR Yes should be unselected');
assertEqual(values['Pt2Line1_YN[1]'], true, 'Part 2 EOIR No should be selected');
assertEqual(values['Pt2Line2_CB[0]'], true, 'Part 2 principal applicant checkbox');
assertEqual(values['Pt2Line3d_AsyleeRefugeeCB[0]'], true, 'Part 2 asylee eligibility checkbox');
assertEqual(values['Pt2Line4_CB[0]'], true, 'Part 2 INA 245(i) No should be selected');
assertEqual(values['Pt2Line4_CB[1]'], false, 'Part 2 INA 245(i) Yes should be unselected');
assertEqual(values['Pt2Line5_CB[0]'], true, 'Part 2 CSPA No should be selected');
assertEqual(values['Pt2Line5_CB[1]'], false, 'Part 2 CSPA Yes should be unselected');
assertEqual(values['Pt1Line18_PriorAddress_Unit[0]'], true, 'Prior US address apartment checkbox');
assertEqual(values['Pt1Line19_SSN[0]'], '671842359', 'SSN exact field');
assertEqual(values['Pt3Line1_CB[4]'], true, 'Part 3 no exemptions apply checkbox');
assertEqual(values['Pt4Line7_EmployerName[0]'], 'DELUX DELIVERY LLC', 'Current employer or school name');
assertEqual(values['Pt4Line7_EmployerName[1]'], 'SELF-EMPLOYED DRIVER', 'Current occupation');
assertEqual(values['Pt4Line7_EmployerName[2]'], 'DELUX DELIVERY LLC', 'Current employer name duplicate field');
assertEqual(values['Part4Line7_StreetName[0]'], '200 W MARINE VIEW DR', 'Current employer street address');
assertEqual(values['Pt5Line8_DateofBirth[0]'], '06/04/1970', 'Mother date of birth');
assertEqual(values['Pt6Line1_MaritalStatus[0]'], true, 'Applicant divorced checkbox');
assertEqual(values['Pt5Line8_DateofBirth[3]'], '09/19/1986', 'Prior spouse date of birth');
assertEqual(values['Pt6Line16_DateofBirth[0]'], '09/28/2007', 'Date of marriage to prior spouse');
assertEqual(values['Pt6Line10_CityTownOfBirth[1]'], 'MALOLEPETYKHA VILLAGE', 'Prior spouse place of marriage city');
assertEqual(values['Pt6Line10_State[1]'], 'VELYKA LEPETYKHA DISTRICT KHERSON OBLAST', 'Prior spouse place of marriage state');
assertEqual(values['Pt6Line10_Country[1]'], 'UKRAINE', 'Prior spouse place of marriage country');
assertEqual(values['Pt6Line16_DateofBirth[1]'], '04/27/2010', 'Prior marriage end date');
assertEqual(values['Pt6Line19_MaritalStatus[3]'], true, 'Prior marriage ended by divorce checkbox');
assertEqual(values['Pt7Line2_Race[1]'], true, 'Race white checkbox');
assertEqual(values['Pt7Line5_Eyecolor[0]'], true, 'Eye color blue checkbox');
assertEqual(values['Pt7Line6_Haircolor[3]'], true, 'Hair color brown checkbox');
assertEqual(values['Pt9Line56_CB[3]'], true, 'Asylee/refugee public charge exemption checkbox');
assertEqual(values['Pt9Line63_YesNo[0]'], undefined, 'Public charge Item 63 must be blank when an exemption category is selected');
assertEqual(values['Pt9Line64_YesNo[0]'], undefined, 'Public charge Item 64 must be blank when an exemption category is selected');
assertEqual(values['Pt8Line24b_YesNo[0]'], undefined, 'Item 20 must be blank when Item 19 is No');
assertEqual(values['Pt8Line24c_YesNo[0]'], undefined, 'Item 21 must be blank when Item 19 is No');
assertEqual(values['Pt8Line29_YesNo[0]'], undefined, 'Item 29 must be blank when Item 28 is No');
assertEqual(values['Pt8Line35b_YesNo[0]'], undefined, 'Item 35.b must be blank when Item 35.a is No');
assertEqual(values['Pt8Line40_YesNo[0]'], undefined, 'Item 40 must be blank when Item 39 is No');
assertEqual(values['a_YesNo[1]'], true, 'Part 9 line 42.a No checkbox');
assertEqual(values['b_YesNo[0]'], true, 'Part 9 line 42.b No checkbox');
assertEqual(values['Pt3Line3_DaytimePhoneNumber1[0]'], '(253) 409-7210', 'Applicant daytime phone');
assertEqual(values['Pt3Line4_MobileNumber1[0]'], '(253) 409-7210', 'Applicant mobile phone');
assertEqual(values['Pt3Line5_Email[0]'], 'yanahovdan@gmail.com', 'Applicant email');
assertEqual(values['Pt9Line3a_PageNumber[0]'], '4', 'Additional information row 1 page number');
assertEqual(values['Pt9Line3b_PartNumber[0]'], '1', 'Additional information row 1 part number');
assertEqual(values['Pt9Line3c_ItemNumber[0]'], '18', 'Additional information row 1 item number');
assertEqual(values['P14_Line2_AdditionalInfo[0]'], 'PRIOR ADDRESS: 15 164st STREET SW, APT B-35, BOTHELL, WA 8012; 10/01/2019 - 01/01/2021', 'Additional information prior address');
assertEqual(values['Pt9Line3a_PageNumber[1]'], '8', 'Additional information row 2 page number');
assertEqual(values['Pt9Line3b_PartNumber[1]'], '4', 'Additional information row 2 part number');
assertEqual(values['Pt9Line3c_ItemNumber[1]'], '7', 'Additional information row 2 item number');
assertEqual(values['P14_Line3_AdditionalInfo[0]'], 'EMPLOYMENT: SELF-EMPLOYED AT FEDEX: 7301 HARDESON RD, EVERETT, WA 98203 DATES OF EMPLOYMENT: 10/10/2020 - 12/20/2023 OCCUPATION: SELF-EMPLOYED DRIVER', 'Additional information employment');

const semanticFemale = i485FieldValues({ formAnswers: { applicant_family_name: 'TEST', sex: 'female' } });
const semanticMale = i485FieldValues({ formAnswers: { applicant_family_name: 'TEST', sex: 'male' } });
assertEqual(semanticFemale['Pt1Line6_CB_Sex[0]'], true, 'Semantic female checkbox [0]');
assertEqual(semanticFemale['Pt1Line6_CB_Sex[1]'], false, 'Semantic female checkbox [1]');
assertEqual(semanticMale['Pt1Line6_CB_Sex[0]'], false, 'Semantic male checkbox [0]');
assertEqual(semanticMale['Pt1Line6_CB_Sex[1]'], true, 'Semantic male checkbox [1]');

const semanticBio = i485FieldValues({ formAnswers: { applicant_family_name: 'TEST', race: ['White'], eye_color: 'Blue', hair_color: 'Brown' } });
assertEqual(semanticBio['Pt7Line2_Race[1]'], true, 'Semantic white race checkbox uses current PDF index');
assertEqual(semanticBio['Pt7Line5_Eyecolor[0]'], true, 'Semantic blue eye checkbox uses current PDF index');
assertEqual(semanticBio['Pt7Line6_Haircolor[3]'], true, 'Semantic brown hair checkbox uses current PDF index');

const conditionalNo = i485FieldValues({
  formAnswers: { Pt8Line28_YesNo: 'No', Pt8Line29_YesNo: 'No', Pt9Line56_CB: 3 }
});
assertEqual(conditionalNo['Pt8Line29_YesNo[0]'], undefined, 'Semantic conditional child should be omitted when parent is No');

const conditionalYes = i485FieldValues({
  formAnswers: { Pt8Line28_YesNo: 'Yes', Pt8Line29_YesNo: 'No', Pt9Line56_CB: 3 }
});
assertEqual(conditionalYes['Pt8Line29_YesNo[0]'], true, 'Semantic conditional child No should render when parent is Yes');

const inputPdf = fs.readFileSync(path.join(ROOT, 'assets/form-cache/pdfs/i-485.pdf'));
const result = incrementalFillPdf(inputPdf, values, textOverlays);
assert(result.filledFields.length >= 415, `Expected at least 415 incremental fields filled, got ${result.filledFields.length}`);
assertEqual(result.skippedFields.length, 0, 'No exact I-485 fields should be skipped');

console.log(JSON.stringify({
  ok: true,
  mappedFields: Object.keys(values).length,
  filledFields: result.filledFields.length,
  overlayFields: textOverlays.length,
  skippedFields: result.skippedFields.length
}, null, 2));
