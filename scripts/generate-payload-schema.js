const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function defaultValue(field) {
  if (field.mode === 'checkbox_group' || field.mode === 'radio_group') return null;
  if (field.mode === 'checkbox_single' || field.mode === 'radio_single') return false;
  return '';
}

function main() {
  const mapPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!mapPath || !outputPath) {
    throw new Error('Usage: node scripts/generate-payload-schema.js overlay-maps/normalized/i-765.json payload-schemas/i-765.schema.json');
  }

  const map = readJson(mapPath);

  const schema = {
    form: map.form,
    source: map.source,
    output: map.output,
    pages: {}
  };

  for (const field of map.fields) {
    const page = String(field.page || 1);

    if (!schema.pages[page]) {
      schema.pages[page] = [];
    }

    schema.pages[page].push({
      key: field.key,
      mode: field.mode,
      kind: field.kind,
      defaultValue: defaultValue(field),
      options: field.options ? field.options.map(o => o.value) : undefined
    });
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2));

  console.log('DONE');
  console.log('Form:', map.form);
  console.log('Pages:', Object.keys(schema.pages).length);
  console.log('Fields:', map.fields.length);
  console.log('Output:', outputPath);
}

main();
