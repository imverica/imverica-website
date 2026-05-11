const fs = require('fs');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
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

function leftmostOption(field) {
  if (!Array.isArray(field.options) || !field.options.length) return undefined;

  let best = field.options[0];

  for (const opt of field.options) {
    if (typeof opt.x === 'number' && typeof best.x === 'number' && opt.x < best.x) {
      best = opt;
    }
  }

  return best.value;
}

function keyHas(key, patterns) {
  const lower = String(key || '').toLowerCase();
  return patterns.some(p => lower.includes(String(p).toLowerCase()));
}

const questionnairePath = process.argv[2] || 'questionnaires/i-485.questionnaire.json';
const answersPath = process.argv[3] || 'answers/i-485-real-test.answers.json';

const q = readJson(questionnairePath);
const answers = readJson(answersPath);

for (const page of q.pages) {
  for (const field of page.fields) {
    const key = String(field.key || '');

    if (answers[key] !== undefined) continue;

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

    if (page.page >= 14 && page.page <= 21) {
      const noValue = rightmostOption(field);
      if (noValue !== undefined) answers[key] = noValue;
      continue;
    }

    if (field.type === 'choice') {
      const noValue = rightmostOption(field);
      if (noValue !== undefined) answers[key] = noValue;
    }

    if (field.type === 'boolean') {
      answers[key] = false;
    }
  }
}

writeJson(answersPath, answers);

console.log('DONE');
console.log('Answers:', answersPath);
console.log('Fields:', Object.keys(answers).length);
