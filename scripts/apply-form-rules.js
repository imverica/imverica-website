const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function keyMatches(key, patterns) {
  const lower = String(key || '').toLowerCase();
  return patterns.some(pattern => lower.includes(String(pattern).toLowerCase()));
}

function isTruthy(value) {
  return value === true || value === 'true' || value === 'yes' || value === 'Yes' || value === 1 || value === '1';
}

function sectionEnabled(section, answers, defaults) {
  if (section.enabledBy === 'never') return false;

  if (section.enabledBy) {
    return isTruthy(answers[section.enabledBy] ?? defaults[section.enabledBy]);
  }

  if (Array.isArray(section.enabledByAny)) {
    return section.enabledByAny.some(flag => isTruthy(answers[flag] ?? defaults[flag]));
  }

  return true;
}

function main() {
  const form = process.argv[2];
  const questionnairePath = process.argv[3];
  const answersPath = process.argv[4];
  const payloadPath = process.argv[5];
  const outputPath = process.argv[6];

  if (!form || !questionnairePath || !answersPath || !payloadPath || !outputPath) {
    throw new Error('Usage: node scripts/apply-form-rules.js i-485 questionnaires/i-485.questionnaire.json answers/i-485.answers.json payloads/i-485-generated-payload.json payloads/i-485-safe-payload.json');
  }

  const rulesPath = `form-rules/${form}.rules.json`;

  if (!fs.existsSync(rulesPath)) {
    fs.copyFileSync(payloadPath, outputPath);
    console.log('DONE');
    console.log('Rules: none');
    console.log('Output:', outputPath);
    return;
  }

  const questionnaire = readJson(questionnairePath);
  const answers = readJson(answersPath);
  const payload = readJson(payloadPath);
  const rules = readJson(rulesPath);

  const defaults = rules.flags || {};
  const blocked = new Set();

  for (const section of Object.values(rules.conditionalSections || {})) {
    const enabled = sectionEnabled(section, answers, defaults);

    if (!enabled && Array.isArray(section.controls)) {
      for (const key of Object.keys(payload)) {
        if (keyMatches(key, section.controls)) {
          blocked.add(key);
        }
      }
    }

    if (!enabled && section.choiceOnly && Array.isArray(section.pages)) {
      for (const page of questionnaire.pages || []) {
        if (!section.pages.includes(page.page)) continue;

        for (const field of page.fields || []) {
          if (field.type === 'choice' || field.type === 'boolean') {
            blocked.add(field.key);
          }
        }
      }
    }
  }

  const safePayload = {};

  for (const [key, value] of Object.entries(payload)) {
    if (blocked.has(key)) continue;
    safePayload[key] = value;
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(safePayload, null, 2));

  console.log('DONE');
  console.log('Rules:', rulesPath);
  console.log('Original payload fields:', Object.keys(payload).length);
  console.log('Blocked fields:', blocked.size);
  console.log('Safe payload fields:', Object.keys(safePayload).length);
  console.log('Output:', outputPath);
}

main();
