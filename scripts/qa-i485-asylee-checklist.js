const fs = require('fs');
const { i485FieldValues } = require('../netlify/functions/lib/i485-pdf-map');

const CHECKLIST_PATH = 'form-scenarios/i-485-asylee.checklist.json';
const OVERLAY_PATH = 'overlay-maps/normalized/i-485.json';

const CHECKLIST_FIELD_ALIASES = {
  Pt4Line7_NameOfEmployer: ['Pt4Line7_EmployerName[2]'],
  Pt4Line7_Occupation: ['Pt4Line7_EmployerName[1]'],
  Pt6Line13_DateofBirth: ['Pt5Line8_DateofBirth[3]'],
  Pt6Line17_CityTownOfMarriage: ['Pt6Line10_CityTownOfBirth[1]'],
  Pt6Line17_State: ['Pt6Line10_State[1]'],
  Pt6Line17_Country: ['Pt6Line10_Country[1]'],
  Pt6Line18_DateMarriageEnded: ['Pt6Line16_DateofBirth[1]'],
  Pt9Line4a_PageNumber: ['Pt9Line3a_PageNumber[1]'],
  Pt9Line4b_PartNumber: ['Pt9Line3b_PartNumber[1]'],
  Pt9Line4c_ItemNumber: ['Pt9Line3c_ItemNumber[1]'],
  P14_Line2_Title: ['P14_Line2_AdditionalInfo[0]'],
  P14_Line2_Address: ['P14_Line2_AdditionalInfo[0]'],
  P14_Line3_Title: ['P14_Line3_AdditionalInfo[0]'],
  P14_Line3_Employment: ['P14_Line3_AdditionalInfo[0]'],
  P14_Line3_Dates: ['P14_Line3_AdditionalInfo[0]'],
  P14_Line3_Occupation: ['P14_Line3_AdditionalInfo[0]']
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function semanticValue(value) {
  if (value === true) return true;
  if (value === false) return false;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'n/a' && normalized !== 'not applicable' && normalized !== 'none';
}

function pdfFieldNameFromOriginal(originalKey) {
  return String(originalKey || '').split('.').pop();
}

function originalFieldNames(field) {
  if (Array.isArray(field?.originalKeys)) return field.originalKeys.map(pdfFieldNameFromOriginal).filter(Boolean);
  if (field?.originalKey) return [pdfFieldNameFromOriginal(field.originalKey)].filter(Boolean);
  return [];
}

function fieldBase(fieldName) {
  return String(fieldName).replace(/\[\d+\]$/, '');
}

function collectPagesByPdfBase(overlay) {
  const byBase = new Map();
  const byName = new Map();
  for (const field of overlay.fields || []) {
    const page = Number(field.page);
    for (const name of originalFieldNames(field)) {
      if (!byName.has(name)) byName.set(name, new Set());
      byName.get(name).add(page);

      const base = fieldBase(name);
      if (!byBase.has(base)) byBase.set(base, new Set());
      byBase.get(base).add(page);
    }
  }
  return { byBase, byName };
}

function checklistTargets(key) {
  return CHECKLIST_FIELD_ALIASES[key] || [key];
}

function matchingValueNames(values, key) {
  const names = [];
  for (const target of checklistTargets(key)) {
    const exact = String(target);
    const base = fieldBase(exact);
    for (const valueName of Object.keys(values)) {
      if (valueName === exact || valueName === base || valueName.startsWith(`${base}[`)) {
        names.push(valueName);
      }
    }
  }
  return Array.from(new Set(names));
}

function targetAppearsOnPage(target, page, pagesByName, pagesByBase) {
  const exactPages = pagesByName.get(target);
  if (exactPages?.has(page)) return true;
  return pagesByBase.get(fieldBase(target))?.has(page) || false;
}

function keyAppearsOnPage(key, page, pagesByName, pagesByBase) {
  return checklistTargets(key).some((target) => targetAppearsOnPage(target, page, pagesByName, pagesByBase));
}

function isAllowedOnPage(valueName, allowedKeys) {
  return allowedKeys.some((key) => checklistTargets(key).some((target) => {
    const base = fieldBase(target);
    return valueName === target || valueName === base || valueName.startsWith(`${base}[`);
  }));
}

function main() {
  const checklist = readJson(CHECKLIST_PATH);
  const scenario = readJson(checklist.scenarioPath);
  const overlay = readJson(OVERLAY_PATH);
  const values = i485FieldValues({ formAnswers: scenario.fields, contact: {} });
  const { byBase: pagesByBase, byName: pagesByName } = collectPagesByPdfBase(overlay);
  const issues = [];

  if (checklist.form !== scenario.form) {
    issues.push(`Checklist form ${checklist.form} does not match scenario form ${scenario.form}`);
  }

  const pages = new Set((overlay.fields || []).map(field => Number(field.page)));
  if (pages.size !== checklist.expectedPages) {
    issues.push(`Expected ${checklist.expectedPages} pages in overlay map, found ${pages.size}`);
  }

  for (const pageCheck of checklist.pageChecks || []) {
    const page = Number(pageCheck.page);

    for (const key of pageCheck.required || []) {
      const valueNames = matchingValueNames(values, key);
      if (!valueNames.length) {
        issues.push(`Page ${page}: required key ${key} is not produced by i485FieldValues`);
        continue;
      }
      if (!keyAppearsOnPage(key, page, pagesByName, pagesByBase)) {
        issues.push(`Page ${page}: required key ${key} is not rendered on this page`);
      }
      if (!valueNames.some((name) => semanticValue(values[name]))) {
        issues.push(`Page ${page}: required key ${key} is blank in generated values`);
      }
    }

    for (const key of pageCheck.blank || []) {
      for (const name of matchingValueNames(values, key)) {
        if (semanticValue(values[name])) {
          issues.push(`Page ${page}: key ${key} must stay blank, found "${values[name]}" in ${name}`);
        }
      }
    }

    if (Array.isArray(pageCheck.onlyNonBlank)) {
      for (const [name, value] of Object.entries(values)) {
        if (!semanticValue(value)) continue;
        if (!pagesByName.get(name)?.has(page)) continue;
        if (!isAllowedOnPage(name, pageCheck.onlyNonBlank)) {
          issues.push(`Page ${page}: unexpected nonblank field ${name}="${value}"`);
        }
      }
    }
  }

  console.log('I-485 ASYLEE PAGE CHECKLIST');
  console.log('Scenario:', checklist.scenarioPath);
  console.log('Generated fields:', Object.keys(values).length);
  console.log('Pages checked:', (checklist.pageChecks || []).length);

  if (issues.length) {
    for (const issue of issues) console.log('ISSUE:', issue);
    process.exitCode = 1;
    return;
  }

  console.log('PASS: I-485 asylee checklist matches expected page structure.');
}

main();
