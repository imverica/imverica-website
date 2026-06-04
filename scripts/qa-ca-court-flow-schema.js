'use strict';
/**
 * QA — court flow schema ↔ map ↔ PDF coherence.
 *
 * For every form with an intake schema, synthesize an answer for each schema
 * field, run the form's map, fill the decrypted PDF, and assert the chain is
 * coherent: every schema form is registered, the synthesized answers drive a
 * healthy field count, and the fill reports 0 skipped (no field-name drift).
 *
 * Run:  node scripts/qa-ca-court-flow-schema.js
 * Exit: 0 = pass, 1 = fail.
 */

const fs = require('fs');
const path = require('path');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');
const { getBuilder, listForms } = require('../netlify/functions/lib/ca-court-registry');
const { getCourtSchema, listCourtSchemas } = require('../netlify/functions/lib/ca-court-flow-schema');

const CA_DIR = path.resolve(__dirname, '../assets/form-cache/ca-court');

let pass = 0, fail = 0;
const ok = (m) => { console.log('  ✓', m); pass++; };
const bad = (m) => { console.error('  ✗', m); fail++; };

// Synthesize a value for a schema field based on its type.
function synth(field) {
  switch (field.type) {
    case 'date': return '2020-01-15';
    case 'tel': return '9163993992';
    case 'email': return 'test@example.com';
    case 'money': return '4500';
    case 'select': return field.default || (field.options && field.options[0] && field.options[0].value) || 'yes';
    case 'children': return [{ name: 'Child One', birthdate: '2017-03-12', age: '9' }];
    case 'textarea': return 'Synthetic reason text for QA.';
    default: return field.default || ('X-' + field.id);
  }
}

function buildAnswersFromSchema(schema) {
  const a = {};
  for (const step of schema.steps) for (const f of step.fields) a[f.id] = synth(f);
  return a;
}

async function main() {
  console.log('\n=== Court flow schema ↔ map ↔ PDF QA ===\n');

  const schemaForms = listCourtSchemas();
  const registryForms = listForms();

  // Every form with a map should have an intake schema, and vice-versa.
  for (const slug of registryForms) {
    if (getCourtSchema(slug)) ok(`registry form ${slug} has an intake schema`);
    else bad(`registry form ${slug} has NO intake schema`);
  }
  for (const slug of schemaForms) {
    if (getBuilder(slug)) ok(`schema form ${slug} has a registered map`);
    else bad(`schema form ${slug} has NO registered map`);
  }

  // Coherence: schema answers → map → fill, per form.
  for (const slug of schemaForms) {
    const schema = getCourtSchema(slug);
    const entry = getBuilder(slug);
    if (!entry) continue;
    const tmpl = path.join(CA_DIR, slug + '.pdf');
    if (!fs.existsSync(tmpl)) { bad(`${slug}: decrypted template missing`); continue; }

    const answers = buildAnswersFromSchema(schema);
    const fieldValues = entry.build({ formAnswers: answers });
    const n = Object.keys(fieldValues).length;

    const res = await fillCourtForm(fs.readFileSync(tmpl), fieldValues);
    if (n >= 4 && res.skipped.length === 0) {
      ok(`${slug}: schema → ${n} mapped → ${res.filled.length} filled, 0 skipped`);
    } else {
      bad(`${slug}: mapped ${n}, skipped ${res.skipped.length} (${res.skipped.map((s) => s.name.split('.').pop()).slice(0, 3).join(', ')})`);
    }

    // Every REQUIRED schema field should influence the output (sanity:
    // confirm the required ids are answer keys the map actually consumes by
    // checking the map output is non-empty when only required fields are set).
    const reqOnly = {};
    for (const step of schema.steps) for (const f of step.fields) if (f.required) reqOnly[f.id] = synth(f);
    if (Object.keys(reqOnly).length) {
      const reqVals = entry.build({ formAnswers: reqOnly });
      if (Object.keys(reqVals).length > 0) ok(`${slug}: required-only answers still produce output`);
      else bad(`${slug}: required-only answers produced 0 fields`);
    }
  }

  console.log(`\n=== Passed: ${pass}   Failed: ${fail} ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e.stack || e.message); process.exit(1); });
