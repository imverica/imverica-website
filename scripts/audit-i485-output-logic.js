const fs = require('fs');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function has(key, words) {
  const k = String(key || '').toLowerCase();
  return words.some(w => k.includes(String(w).toLowerCase()));
}

const answersPath = process.argv[2] || 'answers/i-485-compiled.answers.json';
const answers = readJson(answersPath);

const issues = [];

function value(key) {
  return answers[key];
}

function anyKey(patterns) {
  return Object.keys(answers).filter(k => has(k, patterns));
}

function hasAnyValue(patterns) {
  return anyKey(patterns).some(k => {
    const v = answers[k];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });
}

function report(message) {
  issues.push(message);
}

// Page 2 Item 11
if (hasAnyValue(['line11']) && !hasAnyValue(['admitted', 'paroled', 'withoutadmission', 'other'])) {
  report('Page 2 Item 11 has arrival section activity but no clear arrival status.');
}

for (const k of Object.keys(answers)) {
  const lower = k.toLowerCase();

  if (lower.includes('line11') && lower.includes('other')) {
    const otherTextKeys = Object.keys(answers).filter(x =>
      x.toLowerCase().includes('line11') &&
      x.toLowerCase().includes('other') &&
      !['choice', 'checkbox'].some(w => x.toLowerCase().includes(w))
    );

    const hasOtherText = otherTextKeys.some(x => String(answers[x] || '').trim() !== '');
    if (!hasOtherText) {
      report('Page 2 Item 11: Other appears selected but the explanation field is blank.');
    }
  }
}

// Last arrival
if (hasAnyValue(['lastarrival', 'recentimmigrationhistory'])) {
  if (!hasAnyValue(['dateoflastarrival', 'lastarrivaldate'])) {
    report('Page 2 Item 10: Date of Last Arrival appears missing.');
  }
}

// Filing category
if (!hasAnyValue(['category', 'filingcategory', 'familybased', 'employmentbased', 'specialimmigrant', 'asylee', 'refugee'])) {
  report('Pages 5 to 8: No I-485 filing category appears selected.');
}

// Interpreter
if (answers.hasInterpreter === false || answers.hasInterpreter === 'false') {
  if (hasAnyValue(['interpreter'])) {
    report('Page 22: Interpreter fields are filled even though hasInterpreter is false.');
  }
}

// Preparer
if (answers.hasPreparer === false || answers.hasPreparer === 'false') {
  if (hasAnyValue(['preparer'])) {
    report('Page 23: Preparer fields are filled even though hasPreparer is false.');
  }
}

// Attorney
if (answers.hasAttorney === false || answers.hasAttorney === 'false') {
  if (hasAnyValue(['g28', 'volag', 'attorney', 'representative', 'statebar', 'barnumber'])) {
    report('Page 1: Attorney fields are filled even though hasAttorney is false.');
  }
}

// Public charge tables
if (answers.receivedPublicBenefits === false || answers.receivedPublicBenefits === 'false') {
  if (hasAnyValue(['line65', 'line66', 'pt9line65', 'pt9line66', 'pt8line68c', 'pt8line68d'])) {
    report('Page 20: Public benefit tables have values even though public benefits flags are false.');
  }
}

console.log('');
console.log('I-485 LOGIC AUDIT');
console.log('Answers:', answersPath);
console.log('');

if (!issues.length) {
  console.log('PASS: No obvious logic issues found.');
} else {
  for (const issue of issues) {
    console.log('ISSUE:', issue);
  }
  process.exitCode = 1;
}
