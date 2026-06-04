#!/usr/bin/env node
'use strict';
/**
 * Decrypt California Judicial Council court forms so they can be filled.
 *
 * WHY: CA court PDFs ship with permission-encryption + an XFA layer. The
 * encryption hides the AcroForm field dictionary, so neither pdf-lib nor
 * our USCIS incrementalFillPdf engine can see (let alone fill) the fields.
 * `qpdf --decrypt` strips the permission encryption and leaves a normal,
 * fully-fillable AcroForm PDF. (The XFA layer is dropped by pdf-lib at
 * fill time, which is fine — the AcroForm fields are what render + print.)
 *
 * Netlify Functions have no qpdf binary, so we CANNOT decrypt at runtime.
 * Instead we pre-decrypt here and commit the results to
 *   assets/form-cache/ca-court/
 * The fill engine (lib/ca-court-fill.js) reads from there.
 *
 * Requires: qpdf on PATH  (brew install qpdf)
 *
 * Usage:
 *   node scripts/decrypt-ca-forms.js            # decrypt the priority set
 *   node scripts/decrypt-ca-forms.js --all      # decrypt every non-USCIS form
 *   node scripts/decrypt-ca-forms.js fl-100 dv-100   # decrypt named forms
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SRC_DIR = path.resolve(__dirname, '../assets/form-cache/pdfs');
const OUT_DIR = path.resolve(__dirname, '../assets/form-cache/ca-court');

// Priority set — the CA court forms Imverica actually prepares today.
// Family law (dissolution + custody + support), fee waivers, DV/CH
// restraining orders, unlawful detainer (eviction), small claims.
const PRIORITY = [
  // Family law — dissolution
  'fl-100', 'fl-110', 'fl-115', 'fl-117', 'fl-120', 'fl-105', 'fl-141', 'fl-142',
  'fl-150', 'fl-160', 'fl-165', 'fl-170', 'fl-180', 'fl-190',
  // Family law — custody / visitation / support orders
  'fl-300', 'fl-305', 'fl-311', 'fl-320', 'fl-340', 'fl-341', 'fl-342', 'fl-343',
  // Fee waivers (universal)
  'fw-001', 'fw-003',
  // Domestic-violence restraining orders
  'dv-100', 'dv-109', 'dv-110', 'dv-120',
  // Civil harassment restraining
  'ch-100', 'ch-109', 'ch-110',
  // Unlawful detainer (eviction)
  'ud-100', 'ud-105',
  // Small claims
  'sc-100', 'sc-104',
  // Proof of service (used with most filings)
  'pos-040'
];

// USCIS forms live in the same cache; exclude them from --all.
function isUscis(slug) {
  return /^(i-?\d|n-?\d|g-?\d|ar-?\d)/i.test(slug);
}

function listSlugs(args) {
  const named = args.filter((a) => !a.startsWith('--'));
  if (named.length) return named.map((s) => s.toLowerCase().replace(/\.pdf$/, ''));
  if (args.includes('--all')) {
    return fs.readdirSync(SRC_DIR)
      .filter((f) => f.endsWith('.pdf'))
      .map((f) => f.replace(/\.pdf$/, ''))
      .filter((slug) => !isUscis(slug));
  }
  return PRIORITY;
}

function main() {
  // Verify qpdf is available
  try {
    execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
  } catch (e) {
    console.error('FATAL: qpdf not found on PATH. Install with: brew install qpdf');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const slugs = listSlugs(process.argv.slice(2));

  let ok = 0, skip = 0, fail = 0;
  for (const slug of slugs) {
    const src = path.join(SRC_DIR, slug + '.pdf');
    const out = path.join(OUT_DIR, slug + '.pdf');
    if (!fs.existsSync(src)) { console.warn('  ✗ missing source:', slug); fail++; continue; }
    try {
      // --decrypt removes encryption; --object-streams=preserve keeps size sane.
      execFileSync('qpdf', ['--decrypt', '--', src, out], { stdio: 'ignore' });
      const before = (fs.statSync(src).size / 1024).toFixed(0);
      const after = (fs.statSync(out).size / 1024).toFixed(0);
      console.log(`  ✓ ${slug.padEnd(9)} ${before}KB → ${after}KB`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${slug.padEnd(9)} qpdf failed: ${String(e.message).slice(0, 60)}`);
      fail++;
    }
  }

  console.log(`\nDecrypted ${ok} form(s) into ${path.relative(process.cwd(), OUT_DIR)}/`);
  if (skip) console.log(`Skipped ${skip} (already present).`);
  if (fail) { console.log(`Failed ${fail}.`); process.exit(1); }
}

main();
