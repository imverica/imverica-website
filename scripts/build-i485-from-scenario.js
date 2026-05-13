const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectQuestionnaireKeys(questionnaire) {
  const keys = new Set();
  for (const page of questionnaire.pages || []) {
    for (const field of page.fields || []) {
      keys.add(field.key);
    }
  }
  return keys;
}

function main() {
  const scenarioPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!scenarioPath || !outputPath) {
    console.error('Usage: node scripts/build-i485-from-scenario.js form-scenarios/i-485-asylee.json answers/i-485-curated-asylee.answers.json');
    process.exit(1);
  }

  if (!fs.existsSync(scenarioPath)) {
    console.error('ERROR: Scenario file not found:', scenarioPath);
    process.exit(1);
  }

  const scenario = readJson(scenarioPath);

  if (!scenario.form) {
    console.error('ERROR: Scenario missing "form" field');
    process.exit(1);
  }

  const questionnairePath = `questionnaires/${scenario.form}.questionnaire.json`;
  if (!fs.existsSync(questionnairePath)) {
    console.error('ERROR: Questionnaire not found:', questionnairePath);
    process.exit(1);
  }

  const questionnaire = readJson(questionnairePath);
  const questionnaireKeys = collectQuestionnaireKeys(questionnaire);

  const scenarioFields = scenario.fields || {};
  const missingKeys = Object.keys(scenarioFields).filter(k => !questionnaireKeys.has(k));

  if (missingKeys.length > 0) {
    console.error('ERROR: The following scenario field keys are not in the questionnaire:');
    missingKeys.forEach(k => console.error('  MISSING:', k));
    console.error('Fix the scenario file or the questionnaire before continuing.');
    process.exit(1);
  }

  const answers = {};

  for (const [key, value] of Object.entries(scenario.flags || {})) {
    answers[key] = value;
  }

  for (const [key, value] of Object.entries(scenarioFields)) {
    answers[key] = value;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(answers, null, 2));

  console.log('DONE');
  console.log('Scenario:', scenarioPath);
  console.log('Form:', scenario.form);
  console.log('Scenario:', scenario.scenario);
  console.log('Flags:', Object.keys(scenario.flags || {}).length);
  console.log('Fields:', Object.keys(scenarioFields).length);
  console.log('Output:', outputPath);
}

main();
