const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanValue(value, type) {
  if (value === undefined || value === null) return '';

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;

  let text = String(value).trim();

  if (type === 'state') return text.toUpperCase();
  if (type === 'email') return text.toLowerCase();
  if (type === 'zip') return text.replace(/[^\d-]/g, '');
  if (type === 'phone') return text.replace(/[^\d]/g, '');
  if (type === 'date') return text;

  return text;
}

function main() {
  const questionnairePath = process.argv[2];
  const answersPath = process.argv[3];
  const outputPath = process.argv[4];

  if (!questionnairePath || !answersPath || !outputPath) {
    throw new Error('Usage: node scripts/answers-to-payload.js questionnaires/g-1145.questionnaire.json answers/g-1145-test.answers.json payloads/g-1145-from-answers.json');
  }

  const questionnaire = readJson(questionnairePath);
  const answers = readJson(answersPath);

  const payload = {};

  for (const page of questionnaire.pages) {
    for (const field of page.fields) {
      const value = answers[field.key];

      if (value === undefined || value === null || String(value).trim() === '') {
        continue;
      }

      payload[field.key] = cleanValue(value, field.type);
    }
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  console.log('DONE');
  console.log('Form:', questionnaire.form);
  console.log('Payload fields:', Object.keys(payload).length);
  console.log('Output:', outputPath);
}

main();
