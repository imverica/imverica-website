const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function groupKey(field) {
  return `${field.page}::${field.key}::${field.kind}`;
}

function normalize(rawMap) {
  const result = {
    form: rawMap.form,
    source: rawMap.source,
    output: rawMap.output,
    fields: []
  };

  const groups = new Map();

  for (const field of rawMap.fields) {
    if (field.kind === 'barcode') continue;

    const key = groupKey(field);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(field);
  }

  for (const items of groups.values()) {
    const first = items[0];

    if ((first.kind === 'checkbox' || first.kind === 'radio') && items.length > 1) {
      result.fields.push({
        key: first.key,
        originalKeys: items.map(i => i.originalKey),
        kind: first.kind,
        mode: first.kind === 'radio' ? 'radio_group' : 'checkbox_group',
        page: first.page,
        size: 10,
        font: 'HelveticaBold',
        options: items.map((i, index) => ({
          value: index,
          x: i.x,
          y: i.y,
          width: i.width,
          height: i.height
        }))
      });

      continue;
    }

    if (first.kind === 'checkbox' || first.kind === 'radio') {
      result.fields.push({
        key: first.key,
        originalKey: first.originalKey,
        kind: first.kind,
        mode: first.kind === 'radio' ? 'radio_single' : 'checkbox_single',
        page: first.page,
        x: first.x,
        y: first.y,
        width: first.width,
        height: first.height,
        size: 10,
        font: 'HelveticaBold'
      });

      continue;
    }

    if (first.kind === 'text') {
      result.fields.push({
        key: first.key,
        originalKey: first.originalKey,
        kind: first.kind,
        mode: 'text',
        page: first.page,
        x: first.x,
        y: first.y,
        width: first.width,
        height: first.height,
        size: 10,
        font: 'CourierBold'
      });

      continue;
    }

    result.fields.push({
      key: first.key,
      originalKey: first.originalKey,
      kind: first.kind,
      mode: first.kind,
      page: first.page,
      x: first.x,
      y: first.y,
      width: first.width,
      height: first.height,
      size: 10,
      font: 'CourierBold'
    });
  }

  return result;
}

function main() {
  const input = process.argv[2];
  const output = process.argv[3];

  if (!input || !output) {
    throw new Error('Usage: node scripts/normalize-overlay-map.js overlay-maps/raw/i-765.raw.json overlay-maps/normalized/i-765.json');
  }

  const rawMap = readJson(input);
  const normalized = normalize(rawMap);

  ensureDir(path.dirname(output));
  fs.writeFileSync(output, JSON.stringify(normalized, null, 2));

  const checkboxGroups = normalized.fields.filter(f => f.mode === 'checkbox_group').length;
  const radioGroups = normalized.fields.filter(f => f.mode === 'radio_group').length;
  const textFields = normalized.fields.filter(f => f.mode === 'text').length;

  console.log('DONE');
  console.log('Input fields:', rawMap.fields.length);
  console.log('Output fields:', normalized.fields.length);
  console.log('Text fields:', textFields);
  console.log('Checkbox groups:', checkboxGroups);
  console.log('Radio groups:', radioGroups);
  console.log('Output:', output);
}

main();
