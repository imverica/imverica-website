const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function has(key, words) {
  const k = String(key || '').toLowerCase();
  return words.some(w => k.includes(String(w).toLowerCase()));
}

function valueFor(field, pageNumber) {
  const key = String(field.key || '').toLowerCase();

  if (has(key, ['g28', 'volag', 'attorney', 'representative', 'statebar', 'barnumber'])) return '';
  if (has(key, ['interpreter', 'preparer', 'officer', 'signature', 'corrections'])) return '';

  if (has(key, ['familyname', 'lastname'])) return 'SMITH';
  if (has(key, ['givenname', 'firstname'])) return 'JOHN';
  if (has(key, ['middlename'])) return '';

  // Item 5 asks for OTHER A Numbers only if the answer is Yes.
  // Default test answer is No, so these boxes must stay blank.
  if (pageNumber === 2 && has(key, ['line5']) && has(key, ['aliennumber', 'anumber'])) return '';

  if (has(key, ['aliennumber', 'anumber'])) return '123456789';
  if (has(key, ['uscisonline', 'elis'])) return '123456789012';

  if (has(key, ['dateofbirth', 'birthdate', 'dob'])) return '05/11/2026';

  if (has(key, ['street'])) return '123 MAIN STREET';
  if (has(key, ['city', 'town'])) return 'SACRAMENTO';
  if (has(key, ['state'])) return 'CA';
  if (has(key, ['zipcode', 'zip'])) return '95815';
  if (has(key, ['country', 'nationality'])) return 'USA';

  if (has(key, ['heightfeet'])) return '5';
  if (has(key, ['heightinches'])) return '10';
  if (has(key, ['weight1'])) return '1';
  if (has(key, ['weight2'])) return '8';
  if (has(key, ['weight3'])) return '0';

  if (has(key, ['phone', 'telephone', 'mobile'])) return '9165551234';
  if (has(key, ['email'])) return 'client@example.com';

  if (has(key, ['pagenumber'])) return '24';
  if (has(key, ['partnumber'])) return '14';
  if (has(key, ['itemnumber'])) return '1';
  if (has(key, ['additionalinfo'])) {
    return 'Safe test additional information. This should wrap properly inside the field.';
  }

  return '';
}

function main() {
  const questionnairePath = 'questionnaires/i-485.questionnaire.json';
  const outputPath = 'answers/i-485-base.answers.json';

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

  writeJson(outputPath, answers);

  console.log('DONE');
  console.log('Output:', outputPath);
  console.log('Fields:', Object.keys(answers).length);
}

main();
