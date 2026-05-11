const fs = require('fs');
const { spawnSync } = require('child_process');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const form = process.argv[2];

  if (!form) {
    throw new Error('Usage: node scripts/generate-polished-form-pdf.js ar-11');
  }

  const config = readJson('protected-forms.json');
  const protectedForm = config.protectedForms[form];

  if (!protectedForm) {
    throw new Error(`Form is not protected or polished: ${form}`);
  }

  const result = spawnSync(
    'node',
    [protectedForm.renderer, protectedForm.map, protectedForm.payload],
    { stdio: 'inherit' }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to generate polished form: ${form}`);
  }

  console.log('');
  console.log('DONE');
  console.log('Protected form:', form);
  console.log('Map:', protectedForm.map);
  console.log('Output:', protectedForm.output);
}

main();
