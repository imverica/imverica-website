#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const functionsDir = path.join(root, '.netlify/functions');
const secret = 'court-netlify-bundle-qa-secret';

function extract(name) {
  const zip = path.join(functionsDir, `${name}.zip`);
  if (!fs.existsSync(zip)) {
    throw new Error(`${zip} is missing. Run "npx netlify build" first.`);
  }
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), `imverica-${name}-`));
  execFileSync('unzip', ['-q', zip, '-d', destination]);
  return destination;
}

function endpointAt(directory, name) {
  delete require.cache[require.resolve(path.join(directory, `${name}.js`))];
  return require(path.join(directory, `${name}.js`));
}

function signedHeaders(directory) {
  const headers = { host: 'imverica.com', origin: 'https://imverica.com' };
  const sessionAuth = require(path.join(directory, 'netlify/functions/lib/session-auth.js'));
  headers.cookie = `imv_session=${sessionAuth.signSession('bundle-qa@example.com', { headers })}`;
  return headers;
}

function json(response) {
  try { return JSON.parse(response.body); } catch { return {}; }
}

async function main() {
  process.env.SESSION_SECRET = secret;
  const originalCwd = process.cwd();
  const courtDir = extract('court-flow');
  const generateDir = extract('generate-court-pdf');

  try {
    process.chdir(courtDir);
    const courtFlow = endpointAt(courtDir, 'court-flow');
    const headers = signedHeaders(courtDir);
    const schemaResponse = await courtFlow.handler({
      httpMethod: 'GET',
      headers,
      queryStringParameters: { code: 'SC-100' }
    });
    const schema = json(schemaResponse);
    const fields = (schema.steps || []).flatMap((step) => step.fields || []);
    if (schemaResponse.statusCode !== 200 || fields.length < 50) {
      throw new Error(`bundled SC-100 schema is empty or incomplete: status=${schemaResponse.statusCode}, fields=${fields.length}`);
    }
    console.log(`✓ bundled court-flow returns ${fields.length} SC-100 fields`);

    const sample = fields.find((field) => field.type === 'text' || field.type === 'textarea');
    if (!sample) throw new Error('bundled SC-100 schema has no text field');

    process.chdir(generateDir);
    const generate = endpointAt(generateDir, 'generate-court-pdf');
    const generated = await generate.handler({
      httpMethod: 'POST',
      headers: { ...signedHeaders(generateDir), 'content-type': 'application/json' },
      body: JSON.stringify({
        formCode: 'SC-100',
        directFields: { [sample.id]: 'Bundle QA' }
      })
    });
    if (generated.statusCode !== 200 || !generated.isBase64Encoded ||
        Buffer.from(generated.body || '', 'base64').subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new Error(`bundled SC-100 generation failed: status=${generated.statusCode}`);
    }
    console.log('✓ bundled generate-court-pdf produces an SC-100 PDF');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(courtDir, { recursive: true, force: true });
    fs.rmSync(generateDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
