const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function exists(file) {
  return fs.existsSync(file);
}

function main() {
  const form = process.argv[2];
  const answersPath = process.argv[3];

  if (!form || !answersPath) {
    throw new Error('Usage: node scripts/generate-form-pdf.js g-1145 answers/g-1145-test.answers.json');
  }

  const questionnairePath = `questionnaires/${form}.questionnaire.json`;
  const mapPath = `overlay-maps/normalized/${form}.json`;
  const payloadPath = `payloads/${form}-generated-payload.json`;

  if (!exists(questionnairePath)) throw new Error(`Missing questionnaire: ${questionnairePath}`);
  if (!exists(mapPath)) throw new Error(`Missing normalized map: ${mapPath}`);
  if (!exists(answersPath)) throw new Error(`Missing answers file: ${answersPath}`);

  fs.mkdirSync('payloads', { recursive: true });
  fs.mkdirSync('generated-filled', { recursive: true });

  const convert = spawnSync(
    'node',
    ['scripts/answers-to-payload.js', questionnairePath, answersPath, payloadPath],
    { stdio: 'inherit' }
  );

  if (convert.status !== 0) {
    throw new Error('answers-to-payload failed');
  }

  const render = spawnSync(
    'node',
    ['scripts/render-normalized-overlay.js', mapPath, payloadPath],
    { stdio: 'inherit' }
  );

  if (render.status !== 0) {
    throw new Error('render-normalized-overlay failed');
  }

  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

  console.log('');
  console.log('DONE');
  console.log('Form:', form);
  console.log('Payload:', payloadPath);
  console.log('PDF:', map.output);
}

main();
