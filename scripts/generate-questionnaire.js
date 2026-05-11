const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function humanizeKey(key) {
  return String(key)
    .replace(/^Pt(\d+)/, 'Part $1 ')
    .replace(/^Part(\d+)/, 'Part $1 ')
    .replace(/^Line(\d+)/, 'Line $1 ')
    .replace(/^Pt(\d+)Line(\d+)/, 'Part $1 Line $2 ')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function inputType(field) {
  const key = field.key.toLowerCase();

  if (field.mode === 'checkbox_group' || field.mode === 'radio_group') return 'choice';
  if (field.mode === 'checkbox_single' || field.mode === 'radio_single') return 'boolean';
  if (key.includes('email')) return 'email';
  if (key.includes('phone')) return 'phone';
  if (key.includes('date')) return 'date';
  if (key.includes('zipcode') || key.includes('zip')) return 'zip';
  if (key.includes('state')) return 'state';
  if (key.includes('country')) return 'country';

  return 'text';
}

function main() {
  const schemaPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!schemaPath || !outputPath) {
    throw new Error('Usage: node scripts/generate-questionnaire.js payload-schemas/g-1145.schema.json questionnaires/g-1145.questionnaire.json');
  }

  const schema = readJson(schemaPath);

  const questionnaire = {
    form: schema.form,
    pages: []
  };

  for (const [pageNumber, fields] of Object.entries(schema.pages)) {
    questionnaire.pages.push({
      page: Number(pageNumber),
      fields: fields.map(field => ({
        key: field.key,
        label: humanizeKey(field.key),
        mode: field.mode,
        type: inputType(field),
        defaultValue: field.defaultValue,
        options: field.options
          ? field.options.map(value => ({
              value,
              label: `Option ${value}`
            }))
          : undefined
      }))
    });
  }

  questionnaire.pages.sort((a, b) => a.page - b.page);

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(questionnaire, null, 2));

  console.log('DONE');
  console.log('Form:', questionnaire.form);
  console.log('Pages:', questionnaire.pages.length);
  console.log('Fields:', questionnaire.pages.reduce((s, p) => s + p.fields.length, 0));
  console.log('Output:', outputPath);
}

main();
