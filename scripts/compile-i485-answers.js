const fs = require('fs');
const path = require('path');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function keyHas(key, patterns) {
  const lower = String(key || '').toLowerCase();
  return patterns.some(p => lower.includes(String(p).toLowerCase()));
}

function rightmostOption(field) {
  if (!Array.isArray(field.options) || !field.options.length) return undefined;
  let best = field.options[field.options.length - 1];

  for (const opt of field.options) {
    if (typeof opt.x === 'number' && typeof best.x === 'number' && opt.x > best.x) {
      best = opt;
    }
  }

  return best.value;
}

const questionnairePath = process.argv[2] || 'questionnaires/i-485.questionnaire.json';
const basePath = process.argv[3] || 'answers/i-485-base.answers.json';
const outputPath = process.argv[4] || 'answers/i-485-compiled.answers.json';

const q = readJson(questionnairePath);
const base = readJson(basePath);
const out = { ...base };

for (const page of q.pages) {
  for (const field of page.fields) {
    const key = field.key;

    if (out[key] !== undefined) continue;

    if (field.type !== 'choice' && field.type !== 'boolean') continue;

    if (keyHas(key, [
      'g28',
      'volag',
      'attorney',
      'representative',
      'interpreter',
      'preparer',
      'signature',
      'officer',
      'corrections'
    ])) {
      continue;
    }

    if (page.page >= 5 && page.page <= 8) {
      continue;
    }

    if (page.page === 18 && keyHas(key, ['line56'])) {
      continue;
    }

    if (field.type === 'choice') {
      const noValue = rightmostOption(field);
      if (noValue !== undefined) out[key] = noValue;
    }

    if (field.type === 'boolean') {
      out[key] = false;
    }
  }
}

writeJson(outputPath, out);

console.log('DONE');
console.log('Base:', basePath);
console.log('Compiled:', outputPath);
console.log('Base fields:', Object.keys(base).length);
console.log('Compiled fields:', Object.keys(out).length);
