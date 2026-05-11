const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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

function isConditionalCategoryPage(page) {
  return page >= 5 && page <= 8;
}

function isAttorneyField(key) {
  return keyHas(key, [
    'g28',
    'g_28',
    'g-28',
    'selectthisbox',
    'volag',
    'attorney',
    'representative',
    'statebar',
    'barnumber'
  ]);
}

function isInterpreterField(key) {
  return keyHas(key, ['pt11', 'part11', 'interpreter']);
}

function isPreparerField(key) {
  return keyHas(key, ['pt12', 'part12', 'preparer']);
}

function valueFor(field, page) {
  const key = String(field.key || '').toLowerCase();

  if (page === 1 && isAttorneyField(key)) return '';
  if (page === 22 && isInterpreterField(key)) return '';
  if (page === 23 && (isPreparerField(key) || keyHas(key, ['pt13', 'part13', 'uscis', 'officer', 'signature', 'corrections', 'pages']))) return '';

  if (keyHas(key, ['signature', 'officer', 'interview', 'preparer', 'interpreter', 'corrections'])) return '';

  if (keyHas(key, ['pt8line68c', 'pt8line68d', 'pt9line65', 'pt9line66', 'line65', 'line66'])) return '';

  if (keyHas(key, ['familyname', 'lastname'])) return 'SMITH';
  if (keyHas(key, ['givenname', 'firstname'])) return 'JOHN';
  if (keyHas(key, ['middlename'])) return '';

  if (keyHas(key, ['aliennumber', 'anumber'])) return '123456789';
  if (keyHas(key, ['date', 'dob'])) return '05/11/2026';

  if (keyHas(key, ['street'])) return '123 MAIN STREET';
  if (keyHas(key, ['city'])) return 'SACRAMENTO';
  if (keyHas(key, ['state'])) return 'CA';
  if (keyHas(key, ['zip'])) return '95815';
  if (keyHas(key, ['country', 'nationality'])) return 'USA';

  if (keyHas(key, ['heightfeet'])) return '5';
  if (keyHas(key, ['heightinches'])) return '10';
  if (keyHas(key, ['weight1'])) return '1';
  if (keyHas(key, ['weight2'])) return '8';
  if (keyHas(key, ['weight3'])) return '0';

  if (keyHas(key, ['phone', 'telephone', 'mobile'])) return '9165551234';
  if (keyHas(key, ['email'])) return 'client@example.com';

  if (keyHas(key, ['pagenumber'])) return '24';
  if (keyHas(key, ['partnumber'])) return '14';
  if (keyHas(key, ['itemnumber'])) return '1';

  if (keyHas(key, ['additionalinfo'])) {
    return 'Safe test additional information. This should wrap properly inside the field.';
  }

  if (field.type === 'choice') {
    if (isConditionalCategoryPage(page)) {
      return '';
    }

    if (page === 18) {
      return '';
    }

    return rightmostOption(field);
  }

  if (field.type === 'boolean') return false;

  return '';
}

function main() {
  const questionnairePath = 'questionnaires/i-485.questionnaire.json';
  const outputPath = 'answers/i-485-safe.answers.json';

  const questionnaire = readJson(questionnairePath);
  const answers = {
    hasAttorney: false,
    hasInterpreter: false,
    hasPreparer: false,
    receivedPublicBenefits: false,
    institutionalizedAtGovernmentExpense: false,
    hasCriminalOrInadmissibilityYes: false,
    eligibilityCategorySelected: false
  };

  for (const page of questionnaire.pages) {
    for (const field of page.fields) {
      const value = valueFor(field, page.page);

      if (value === undefined || value === null || String(value).trim() === '') continue;

      answers[field.key] = value;
    }
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(answers, null, 2));

  console.log('DONE');
  console.log('Output:', outputPath);
  console.log('Fields:', Object.keys(answers).length);
}

main();
