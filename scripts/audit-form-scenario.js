const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectQuestionnaireKeys(questionnaire) {
  const keys = new Set();
  for (const page of questionnaire.pages || []) {
    for (const field of page.fields || []) {
      keys.add(field.key);
    }
  }
  return keys;
}

function collectOverlayFields(overlay) {
  const fields = new Map();
  const duplicates = new Set();

  for (const field of overlay.fields || []) {
    if (fields.has(field.key)) {
      duplicates.add(field.key);
      fields.get(field.key).push(field);
    } else {
      fields.set(field.key, [field]);
    }
  }

  return { fields, duplicates };
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function isSemanticBlank(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '' || normalized === 'n/a' || normalized === 'not applicable' || normalized === 'none';
}

function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function optionValues(field) {
  return new Set((field.options || []).map(option => String(option.value)));
}

function validateFormat(key, value, issues) {
  if (isSemanticBlank(value)) return;

  const lower = key.toLowerCase();
  const raw = String(value).trim();
  const digits = digitsOnly(raw);

  if (/(aliennumber|a_number|a-number|anumber)/i.test(key) && digits.length !== 9) {
    issues.push(`${key}: A-Number must contain exactly 9 digits`);
  }

  if (lower.includes('ssn') && digits.length !== 9) {
    issues.push(`${key}: SSN must contain exactly 9 digits`);
  }

  if (/(phone|telephone|mobile)/i.test(key)) {
    if (!/^\d+$/.test(raw) || digits.length !== 10) {
      issues.push(`${key}: USCIS phone fields must be 10 digits only, no +1, spaces, or parentheses`);
    }
  }

  if (lower.includes('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) {
    issues.push(`${key}: invalid email format`);
  }

  if (lower.includes('zipcode') || lower === 'zip' || lower.endsWith('zip')) {
    if (!/^\d{5}(-?\d{4})?$/.test(raw)) {
      issues.push(`${key}: ZIP must be 5 digits or ZIP+4`);
    }
  }

  if (lower.includes('date') || lower.includes('dob')) {
    if (lower.startsWith('p14_')) return;
    const allowedText = /^(d\/s|present|current)$/i.test(raw);
    const dateLike = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{2}|\d{4})$/.test(raw);
    if (!allowedText && !dateLike) {
      issues.push(`${key}: date must be MM/DD/YYYY, MM/DD/YY, D/S, PRESENT, or blank/N/A`);
    }
  }
}

function auditScenario(scenarioPath, payloadPath) {
  const scenario = readJson(scenarioPath);
  const form = scenario.form;
  const fields = scenario.fields || {};
  const issues = [];
  const warnings = [];

  if (!form) issues.push('Scenario missing "form"');
  if (!scenario.scenario) warnings.push('Scenario missing "scenario" label');

  const questionnairePath = `questionnaires/${form}.questionnaire.json`;
  const overlayPath = `overlay-maps/normalized/${form}.json`;

  if (!fs.existsSync(questionnairePath)) issues.push(`Missing questionnaire: ${questionnairePath}`);
  if (!fs.existsSync(overlayPath)) issues.push(`Missing overlay map: ${overlayPath}`);

  if (issues.length) return { scenarioPath, form, fields, issues, warnings };

  const questionnaire = readJson(questionnairePath);
  const overlay = readJson(overlayPath);
  const questionnaireKeys = collectQuestionnaireKeys(questionnaire);
  const { fields: overlayFields, duplicates } = collectOverlayFields(overlay);

  for (const key of duplicates) {
    warnings.push(`${key}: duplicate overlay-map key; accepted if it intentionally renders the same value in multiple places`);
  }

  for (const [key, value] of Object.entries(fields)) {
    if (!questionnaireKeys.has(key)) issues.push(`${key}: missing from questionnaire`);
    if (!overlayFields.has(key)) issues.push(`${key}: missing from normalized overlay map`);

    const overlayEntries = overlayFields.get(key) || [];
    const choiceEntries = overlayEntries.filter(field => field.mode === 'checkbox_group' || field.mode === 'radio_group');
    if (choiceEntries.length && !isBlank(value)) {
      const matchesAnyChoiceEntry = choiceEntries.some(field => optionValues(field).has(String(value)));
      if (!matchesAnyChoiceEntry) {
        const allOptions = [...new Set(choiceEntries.flatMap(field => [...optionValues(field)]))].join(', ');
        issues.push(`${key}: value "${value}" is not one of overlay options [${allOptions}]`);
      }
    }

    validateFormat(key, value, issues);
  }

  if (payloadPath) {
    if (!fs.existsSync(payloadPath)) {
      issues.push(`Missing payload: ${payloadPath}`);
    } else {
      const payloadJson = readJson(payloadPath);
      const payload = payloadJson.fields && typeof payloadJson.fields === 'object' ? payloadJson.fields : payloadJson;
      const payloadKeys = new Set(Object.keys(payload));

      for (const [key, value] of Object.entries(fields)) {
        if (!isSemanticBlank(value) && !payloadKeys.has(key)) {
          issues.push(`${key}: non-empty scenario value missing from generated payload`);
        }
      }

      for (const key of payloadKeys) {
        if (!overlayFields.has(key)) {
          issues.push(`${key}: generated payload key missing from overlay map`);
        }
      }
    }
  }

  return { scenarioPath, form, fields, issues, warnings };
}

function scenarioPathsFromArgs(args) {
  const paths = args.filter(arg => !arg.startsWith('--'));
  if (paths.length) return paths;

  const dir = 'form-scenarios';
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(dir, file));
}

function main() {
  const args = process.argv.slice(2);
  const payloadIndex = args.indexOf('--payload');
  const payloadPath = payloadIndex >= 0 ? args[payloadIndex + 1] : null;
  const scenarioArgs = payloadIndex >= 0 ? args.filter((_, index) => index !== payloadIndex && index !== payloadIndex + 1) : args;
  const scenarioPaths = scenarioPathsFromArgs(scenarioArgs);
  const results = scenarioPaths.map(scenarioPath => auditScenario(scenarioPath, payloadPath));

  let failed = false;

  for (const result of results) {
    const fieldCount = Object.keys(result.fields || {}).length;
    const nonEmptyCount = Object.values(result.fields || {}).filter(value => !isSemanticBlank(value)).length;
    console.log(`${result.scenarioPath}: ${result.form || 'unknown'} ${fieldCount} fields, ${nonEmptyCount} non-empty`);

    for (const warning of result.warnings) {
      console.log(`  WARNING: ${warning}`);
    }

    for (const issue of result.issues) {
      console.log(`  ISSUE: ${issue}`);
    }

    if (result.issues.length) failed = true;
  }

  if (failed) {
    process.exitCode = 1;
  } else {
    console.log('Form scenario audit passed');
  }
}

main();
