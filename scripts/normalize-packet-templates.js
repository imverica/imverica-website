#!/usr/bin/env node
'use strict';
/**
 * Normalize the packet-form templates with qpdf so BOTH engines can use them:
 * the custom incremental filler (writes values) and pdf-lib (merges the packet).
 * The raw USCIS PDFs use object streams that pdf-lib cannot parse; qpdf
 * --object-streams=disable rewrites them into classic xref PDFs without
 * touching field names (verified: identical fill results, 0 skips).
 *
 * Run locally whenever a packet form's template updates:
 *   node scripts/normalize-packet-templates.js
 * Outputs are committed (build artifacts) — the Netlify runtime has no qpdf.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets/form-cache/pdfs-normalized');
const FORMS = ['i-765', 'i-589']; // packet-enabled forms

execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
fs.mkdirSync(OUT, { recursive: true });
for (const slug of FORMS) {
  const src = path.join(ROOT, 'assets/form-cache/pdfs', `${slug}.pdf`);
  const dst = path.join(OUT, `${slug}.pdf`);
  execFileSync('qpdf', ['--decrypt', '--object-streams=disable', src, dst]);
  console.log(`normalized ${slug}: ${(fs.statSync(dst).size / 1024 | 0)} KB`);
}
