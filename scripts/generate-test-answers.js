const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function valueForField(field, pageNumber) {
  if (field.type === 'choice') {
    return field.options && field.options.length ? field.options[0].value : 0;
  }

  if (field.type === 'boolean') return true;
  if (field.type === 'email') return `page${pageNumber}@example.com`;
  if (field.type === 'phone') return '9165551234';
  if (field.type === 'date') return '05/11/2026';
  if (field.type === 'state') return 'CA';
  if (field.type === 'zip') return '95815';
  if (field.type === 'country') return 'USA';

  return `P${pageNumber} ${field.key}`.slice(0, 45);
}

function main() {
  const form = process.argv[2];

  if (!form) {
    throw new Error('Usage: node scripts/generate-test-answers.js i-290b');
  }

  const questionnairePath = `questionnaires/${form}.questionnaire.json`;
  const outputPath = `answers/${form}-all-fields.answers.json`;

  const questionnaire = readJson(questionnairePath);
  const answers = {};

  for (const page of questionnaire.pages) {
    for (const field of page.fields) {
      answers[field.key] = valueForField(field, page.page);
    }
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(answers, null, 2));

  console.log('DONE');
  console.log('Form:', form);
  console.log('Fields:', Object.keys(answers).length);
  console.log('Output:', outputPath);
}

main();
