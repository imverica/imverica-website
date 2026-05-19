const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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
  if (findField(q, key)) answers[key] = value;
}

function optionValues(field) {
  if (!field || !Array.isArray(field.options)) return [];
  return field.options.map(o => o && typeof o === 'object' ? o.value : o);
}

function optionByValueOrIndex(q, key, preferredValue, fallbackIndex = 0) {
  const field = findField(q, key);
  if (!field) return undefined;

  const values = optionValues(field);
  if (values.map(String).includes(String(preferredValue))) return preferredValue;

  if (values[fallbackIndex] !== undefined) return values[fallbackIndex];
  return undefined;
}

function optionByX(q, key, side) {
  const field = findField(q, key);
  if (!field || !Array.isArray(field.options) || !field.options.length) return undefined;

  const options = [...field.options].sort((a, b) => {
    const ax = typeof a.x === 'number' ? a.x : 0;
    const bx = typeof b.x === 'number' ? b.x : 0;
    return ax - bx;
  });

  const picked = side === 'right' ? options[options.length - 1] : options[0];
  return picked.value;
}

function optionByYRank(q, key, rankFromTop) {
  const field = findField(q, key);
  if (!field || !Array.isArray(field.options) || !field.options.length) return undefined;

  const options = [...field.options].sort((a, b) => {
    const ay = typeof a.y === 'number' ? a.y : 0;
    const by = typeof b.y === 'number' ? b.y : 0;
    return by - ay;
  });

  const picked = options[rankFromTop] || options[0];
  return picked.value;
}

function setChoice(q, answers, key, value) {
  const field = findField(q, key);
  if (!field) return;
  answers[key] = value;
}

function setYes(q, answers, key) {
  const v = optionByValueOrIndex(q, key, 'Y', 0);
  if (v !== undefined) answers[key] = v;
}

function setNo(q, answers, key) {
  const v = optionByValueOrIndex(q, key, 'N', 1);
  if (v !== undefined) answers[key] = v;
}

function setRightmostNo(q, answers, key) {
  const v = optionByX(q, key, 'right');
  if (v !== undefined) answers[key] = v;
}

function main() {
  const q = readJson('questionnaires/i-485.questionnaire.json');
  const outputPath = 'answers/i-485-curated-asylee.answers.json';

  const answers = {
    hasAttorney: false,
    hasInterpreter: false,
    hasPreparer: false,
    receivedPublicBenefits: false,
    institutionalizedAtGovernmentExpense: false,
    hasCriminalOrInadmissibilityYes: false,
    eligibilityCategorySelected: true
  };

  // Page 1
  setIfExists(q, answers, 'AlienNumber', '208924970');
  setIfExists(q, answers, 'Pt1Line1_FamilyName', 'HOVDAN');
  setIfExists(q, answers, 'Pt1Line1_GivenName', 'YANA');
  setIfExists(q, answers, 'Pt1Line2_FamilyName', 'SERHIEIEVA');
  setIfExists(q, answers, 'Pt1Line2_GivenName', 'YANA');
  setIfExists(q, answers, 'Pt1Line3_DOB', '01/19/1990');
  setNo(q, answers, 'Pt1Line3_YN');

  // Page 2
  setIfExists(q, answers, 'Pt1Line6_CB_Sex', optionByValueOrIndex(q, 'Pt1Line6_CB_Sex', 'F', 1));
  setIfExists(q, answers, 'Pt1Line7_CityTownOfBirth', 'MYKOLAIV');
  setIfExists(q, answers, 'Pt1Line7_CountryOfBirth', 'UKRAINE');
  setIfExists(q, answers, 'Pt1Line8_CountryofCitizenshipNationality', 'UKRAINE');

  setIfExists(q, answers, 'Pt1Line10_PassportNum', 'FE079723');
  setIfExists(q, answers, 'Pt1Line10_ExpDate', '01/19/2026');
  setIfExists(q, answers, 'Pt1Line10_Passport', 'UKRAINE');
  setIfExists(q, answers, 'Pt1Line10_VisaNum', 'N/A');
  setIfExists(q, answers, 'Pt1Line10_CityTown', 'SAN YSIDRO');
  setIfExists(q, answers, 'Pt1Line10_State', 'CA');
  setIfExists(q, answers, 'Pt1Line10_DateofArrival', '02/29/2016');

  setIfExists(q, answers, 'Pt1Line4_AlienNumber', '208924970');
  setYes(q, answers, 'Pt1Line4_YN');
  setNo(q, answers, 'Pt1Line5_YN');

  setChoice(q, answers, 'Pt2Line11_CB', optionByValueOrIndex(q, 'Pt2Line11_CB', '11B', 1) ?? optionByYRank(q, 'Pt2Line11_CB', 1));
  setIfExists(q, answers, 'Pt1Line11_Paroled', 'PAROLED');

  // Page 3
  setIfExists(q, answers, 'P1Line12_FamilyName', 'HOVDAN');
  setIfExists(q, answers, 'P1Line13_GivenName', 'YANA');
  setIfExists(q, answers, 'Pt1Line12_Date', 'D/S');
  setIfExists(q, answers, 'Pt1Line12_Status', 'ASYLEE');
  setIfExists(q, answers, 'P1Line12_I94', '77692068933');
  setYes(q, answers, 'Pt1Line13_YN');
  setIfExists(q, answers, 'Pt1Line15_Date', 'D/S');
  setNo(q, answers, 'Pt1Line16_YN');
  setNo(q, answers, 'Pt1Line17_YN');

  // Page 3 and 4 addresses
  for (const key of [
    'Pt1Line18US_Unit',
    'Pt1Line18US_AptSteFlrNumber',
    'Pt1Line18US_StreetNumberName',
    'Pt1Line18US_CityOrTown',
    'Pt1Line18US_State',
    'Pt1Line18US_ZipCode',
    'Pt1Line18US_DateFrom',
    'Pt1Line18Mailing_Unit',
    'Pt1Line18Mailing_AptSteFlrNumber',
    'Pt1Line18Mailing_StreetNumberName',
    'Pt1Line18Mailing_CityOrTown',
    'Pt1Line18Mailing_State',
    'Pt1Line18Mailing_ZipCode'
  ]) {
    if (key.includes('Unit')) setIfExists(q, answers, key, optionByValueOrIndex(q, key, 'APT', 0));
    else if (key.includes('AptSteFlrNumber')) setIfExists(q, answers, key, '5');
    else if (key.includes('StreetNumberName')) setIfExists(q, answers, key, '123 MAIN STREET');
    else if (key.includes('CityOrTown')) setIfExists(q, answers, key, 'SACRAMENTO');
    else if (key.includes('State')) setIfExists(q, answers, key, 'CA');
    else if (key.includes('ZipCode')) setIfExists(q, answers, key, '95815');
    else if (key.includes('DateFrom')) setIfExists(q, answers, key, '05/11/2026');
  }

  // Page 5 to 7 asylee category
  setChoice(q, answers, 'Pt2Line2_CB', optionByValueOrIndex(q, 'Pt2Line2_CB', 0, 0));
  setIfExists(q, answers, 'Pt2Line2_AlienNumber', '208924970');

  setChoice(q, answers, 'Pt2Line3d_AsyleeRefugeeCB', optionByValueOrIndex(q, 'Pt2Line3d_AsyleeRefugeeCB', 0, 0));
  setIfExists(q, answers, 'Pt2Line3d_Asylum', '05/11/2026');

  // Page 18 public charge exemption, based on real samples
  setChoice(q, answers, 'Pt9Line56_CB', optionByValueOrIndex(q, 'Pt9Line56_CB', 3, 3));

  // Pages 14 to 21 default No for inadmissibility Y/N
  for (const page of q.pages || []) {
    if (page.page < 14 || page.page > 21) continue;

    for (const field of page.fields || []) {
      if (field.key === 'Pt9Line56_CB') continue;
      if (field.type === 'choice') {
        const noValue = optionByX(q, field.key, 'right');
        if (noValue !== undefined) answers[field.key] = noValue;
      }
    }
  }

  // Page 22 applicant contact only. Interpreter stays blank.
  setIfExists(q, answers, 'Pt3Line3_DaytimePhoneNumber1', '9165551234');
  setIfExists(q, answers, 'Pt3Line4_MobileNumber1', '9165551234');
  setIfExists(q, answers, 'Pt3Line5_Email', 'client@example.com');

  // Page 24 name only unless real additional info is needed.
  setIfExists(q, answers, 'Pt1Line1_FamilyName', 'HOVDAN');
  setIfExists(q, answers, 'Pt1Line1_GivenName', 'YANA');
  setIfExists(q, answers, 'Pt1Line1_MiddleName', '');

  writeJson(outputPath, answers);

  console.log('DONE');
  console.log('Output:', outputPath);
  console.log('Fields:', Object.keys(answers).length);
}

main();
