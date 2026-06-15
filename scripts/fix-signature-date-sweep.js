#!/usr/bin/env node
'use strict';
/**
 * Codemod: stop pre-stamping USCIS signature dates with today's date.
 *
 * Every *-pdf-map.js that does `v["...DateofSignature[0]"] = dateMdY(today)`
 * forces the applicant's signature date to the PREPARATION date. The signer
 * dates the form when they physically sign it, so this must be blank (or a
 * client-supplied value). This rewrites `dateMdY(today)` to
 * `dateMdY(<answersVar>.applicant_signature_date)` and drops the now-unused
 * `const today` line.
 *
 * EXCLUDES forms ChatGPT is actively editing or owns (i131/i589/n400/i751/
 * i864*) and the three already fixed by hand (i765/i485a/i485j). Prints the
 * exact field name of every replacement so a human can confirm each target is
 * truly a signature field (not a legitimate "date prepared").
 *
 *   node scripts/fix-signature-date-sweep.js          # dry run (report only)
 *   node scripts/fix-signature-date-sweep.js --write   # apply
 */
const fs = require('fs');
const path = require('path');

const LIB = path.resolve(__dirname, '..', 'netlify', 'functions', 'lib');
const WRITE = process.argv.includes('--write');
const EXCLUDE = /^(i131|i589|n400|i751|i864|i864a|i864ez|i765|i485a|i485j)-pdf-map\.js$/;

const files = fs.readdirSync(LIB).filter((f) => /-pdf-map\.js$/.test(f) && !EXCLUDE.test(f));
let changedFiles = 0, totalRepl = 0;
const report = [];

for (const f of files) {
  const p = path.join(LIB, f);
  let src = fs.readFileSync(p, 'utf8');
  if (!/dateMdY\(today\)/.test(src)) continue;

  // Which variable holds the answers object?
  const m = src.match(/const\s+(\w+)\s*=\s*payload\.formAnswers/);
  if (!m) { report.push(`${f}: SKIPPED — no 'payload.formAnswers' answers var detected`); continue; }
  const ansVar = m[1];

  // Capture the field name on every line that assigns dateMdY(today), so we can
  // confirm it is a signature field before trusting the rewrite.
  const targets = [];
  const lineRe = /v\["([^"]+)"\]\s*=\s*dateMdY\(today\)\s*;/g;
  let lm;
  while ((lm = lineRe.exec(src)) !== null) targets.push(lm[1]);

  const repl = (src.match(/dateMdY\(today\)/g) || []).length;
  src = src.replace(/dateMdY\(today\)/g, `dateMdY(${ansVar}.applicant_signature_date)`);

  // Remove the now-unused `const today = ...;` line if nothing else uses today.
  let todayRemoved = false;
  if (!/\btoday\b/.test(src.replace(/const\s+today\s*=\s*new Date\(\)[^\n]*;\s*\n?/, ''))) {
    const before = src;
    src = src.replace(/\n\s*const\s+today\s*=\s*new Date\(\)[^\n]*;/, '');
    todayRemoved = before !== src;
  }

  report.push(`${f}: var='${ansVar}' repl=${repl} todayConstRemoved=${todayRemoved} fields=[${targets.join(', ')}]`);
  totalRepl += repl; changedFiles++;
  if (WRITE) fs.writeFileSync(p, src);
}

report.sort().forEach((r) => console.log(r));
console.log(`\n${WRITE ? 'APPLIED' : 'DRY RUN'}: ${changedFiles} files, ${totalRepl} replacements`);
