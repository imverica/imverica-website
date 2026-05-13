const fs = require('fs');

const CHECKLIST_PATH = 'form-scenarios/i-485-asylee.checklist.json';
const PAYLOAD_PATH = 'payloads/i-485-generated-payload.json';
const OVERLAY_PATH = 'overlay-maps/normalized/i-485.json';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function semanticValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'n/a' && normalized !== 'not applicable' && normalized !== 'none';
}

function collectPagesByKey(overlay) {
  const byKey = new Map();
  for (const field of overlay.fields || []) {
    if (!byKey.has(field.key)) byKey.set(field.key, new Set());
    byKey.get(field.key).add(Number(field.page));
  }
  return byKey;
}

function collectKeysByPage(overlay) {
  const byPage = new Map();
  for (const field of overlay.fields || []) {
    const page = Number(field.page);
    if (!byPage.has(page)) byPage.set(page, new Set());
    byPage.get(page).add(field.key);
  }
  return byPage;
}

function main() {
  const checklist = readJson(CHECKLIST_PATH);
  const scenario = readJson(checklist.scenarioPath);
  const payload = readJson(PAYLOAD_PATH);
  const overlay = readJson(OVERLAY_PATH);
  const pagesByKey = collectPagesByKey(overlay);
  const keysByPage = collectKeysByPage(overlay);
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
    const pageKeys = keysByPage.get(page) || new Set();

    for (const key of pageCheck.required || []) {
      if (!pagesByKey.has(key)) {
        issues.push(`Page ${page}: required key ${key} is missing from overlay map`);
        continue;
      }
      if (!pagesByKey.get(key).has(page)) {
        issues.push(`Page ${page}: required key ${key} is not rendered on this page`);
      }
      if (!semanticValue(payload[key])) {
        issues.push(`Page ${page}: required key ${key} is blank in generated payload`);
      }
    }

    for (const key of pageCheck.blank || []) {
      if (semanticValue(payload[key])) {
        issues.push(`Page ${page}: key ${key} must stay blank, found "${payload[key]}"`);
      }
    }

    if (Array.isArray(pageCheck.onlyNonBlank)) {
      const allowed = new Set(pageCheck.onlyNonBlank);
      for (const key of pageKeys) {
        if (!semanticValue(payload[key])) continue;
        if (!allowed.has(key)) {
          issues.push(`Page ${page}: unexpected nonblank key ${key}="${payload[key]}"`);
        }
      }
    }
  }

  console.log('I-485 ASYLEE PAGE CHECKLIST');
  console.log('Scenario:', checklist.scenarioPath);
  console.log('Payload:', PAYLOAD_PATH);
  console.log('Pages checked:', (checklist.pageChecks || []).length);

  if (issues.length) {
    for (const issue of issues) console.log('ISSUE:', issue);
    process.exitCode = 1;
    return;
  }

  console.log('PASS: I-485 asylee checklist matches expected page structure.');
}

main();
