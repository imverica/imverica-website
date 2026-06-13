#!/usr/bin/env node
'use strict';

/**
 * Normalize the scraped local-court manifest metadata IN PLACE.
 *
 * The scraper pulls codes/titles/categories out of inconsistent county HTML,
 * which leaves three kinds of junk (verified on real data):
 *   1. codes with the filename slug glued on:  PL-CR003-CRIMINAL-DEFENDANTS
 *   2. titles with the category word prepended + code/date tail:
 *      "Criminal Criminal Defendant's Motion PL-CR003 11/2"
 *   3. ~24% of forms dumped in a generic "Local court form" bucket
 *
 * This pass ONLY rewrites code / title / category / variant / language. It
 * NEVER touches officialPdfUrl, sourceSha256, role, scope, county, id — so no
 * source is invented and nothing about generation changes. When a value can't
 * be cleaned confidently, it is left as-is (never guessed).
 *
 * Run: node scripts/normalize-ca-local-court-manifest.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MF = path.join(ROOT, 'assets/form-cache/ca-local-court-manifest.json');

const GENERIC = /^(local court form|local forms|local|courtwide|misc|other|forms|county form|general)$/i;

// Category-letter → canonical topic. Derived from the code's category segment.
const CAT_BY_LETTERS = {
  CR: 'Criminal', CRIM: 'Criminal', CRM: 'Criminal',
  FL: 'Family Law', FAM: 'Family Law',
  PR: 'Probate', PB: 'Probate', DE: 'Probate', EST: 'Probate', GC: 'Probate',
  CV: 'Civil', CIV: 'Civil', CIVIL: 'Civil', ADR: 'Civil',
  UD: 'Unlawful Detainer', LT: 'Unlawful Detainer',
  JV: 'Juvenile', JUV: 'Juvenile', JC: 'Juvenile',
  SC: 'Small Claims', SCL: 'Small Claims',
  TR: 'Traffic', TRAF: 'Traffic', INF: 'Traffic',
  AP: 'Appeals', APP: 'Appeals',
  MH: 'Mental Health'
};

// Collapse "X Forms" → "X" for the real topic labels only. Generic buckets
// (handled separately) are left untouched here.
const TOPIC_FORMS = /^(criminal|civil|family law|family|probate|juvenile|traffic|small claims|unlawful detainer|appeals|mental health)\s+forms?$/i;
function canonicalCategory(cat) {
  let c = String(cat || '').trim();
  if (TOPIC_FORMS.test(c)) c = c.replace(/\s+forms?$/i, '');
  const map = {
    'family': 'Family Law', 'family law': 'Family Law',
    'criminal': 'Criminal', 'civil': 'Civil', 'probate': 'Probate',
    'juvenile': 'Juvenile', 'traffic': 'Traffic', 'small claims': 'Small Claims',
    'unlawful detainer': 'Unlawful Detainer', 'appeals': 'Appeals', 'mental health': 'Mental Health'
  };
  return map[c.toLowerCase()] || c;
}

// Pull a clean court-form code out of a string (title or messy code).
// Matches PL-CR003, PL-CR003I, ADR-506, FL-324, LASC-ADM-080, CRIM-502C, CVE-100.
function extractCode(str) {
  const s = String(str || '');
  const m = s.match(/\b([A-Z]{2,5}(?:-[A-Z]{1,5})?-?\d{1,4}[A-Z]?)\b/);
  return m ? m[1].toUpperCase() : '';
}

// Variant markers in the messy code: -R- (revised), -S- (Spanish), trailing I (instructions).
function detectVariant(rawCode, title) {
  const c = String(rawCode || '').toUpperCase();
  if (/-S-|-SPANISH|\bSPANISH\b/i.test(c + ' ' + title)) return 'S';
  if (/-R-|-REV\b|-REDLINE/i.test(c)) return 'R';
  return '';
}

function cleanCode(rawCode, title) {
  // Prefer a code recovered from the title (the scraper usually keeps it intact
  // there); fall back to trimming the messy code at its canonical head.
  const fromTitle = extractCode(title);
  if (fromTitle) return fromTitle;
  const c = String(rawCode || '').toUpperCase();
  if (/^LOCAL-/i.test(c)) return c; // unparseable placeholder — leave it
  const m = c.match(/^([A-Z]{2,5}(?:-[A-Z]{1,5})?-?\d{1,4}[A-Z]?)/);
  return m ? m[1] : c;
}

function cleanTitle(title, category, code) {
  let t = String(title || '').trim();
  // Drop a leading category word the scraper prepended ("Criminal Criminal…").
  const catWord = String(category || '').split(/\s+/)[0];
  if (catWord && new RegExp('^' + catWord + '\\s+', 'i').test(t)) t = t.replace(new RegExp('^' + catWord + '\\s+', 'i'), '');
  // Collapse an immediately doubled word ("Criminal Defendant's" stays; "Criminal Criminal" → one).
  t = t.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
  // Strip a trailing form code + edition/date tail.
  if (code) t = t.replace(new RegExp('\\s*' + code.replace(/[-]/g, '[- ]?') + '[a-z]?\\b.*$', 'i'), '');
  t = t.replace(/\s+\d{1,2}\/\d{2,4}.*$/, '');          // " 11/2", " 8/2015 ..."
  t = t.replace(/\s+eff\.?\s.*$/i, '');                  // " eff Aug 3 2015"
  t = t.replace(/\s+(final|local|english|spanish)\b.*$/i, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || String(title || '').trim();
}

function inferCategory(code) {
  const seg = String(code || '').toUpperCase().match(/^[A-Z]+-?([A-Z]{2,5})\d|^([A-Z]{2,5})\d|^[A-Z]+-([A-Z]{2,5})-/);
  // Try the letter group that precedes the number.
  const letters = (String(code || '').toUpperCase().match(/([A-Z]{2,5})\d/) || [])[1]
    || (String(code || '').toUpperCase().match(/^[A-Z]{2,4}-([A-Z]{2,5})/) || [])[1]
    || (String(code || '').toUpperCase().match(/^([A-Z]{2,5})-/) || [])[1];
  return letters ? (CAT_BY_LETTERS[letters] || '') : '';
}

// Second-pass inference for generic forms whose code has no topic letters:
// match strong topic keywords in the title. Conservative — only confident hits.
function inferFromTitle(title) {
  const t = String(title || '').toLowerCase();
  if (/\b(probate|decedent|estate of|letters testamentary|conservator|guardian of the (estate|person)|will)\b/.test(t)) return 'Probate';
  if (/\b(unlawful detainer|eviction|landlord|tenant|tenancy)\b/.test(t)) return 'Unlawful Detainer';
  if (/\b(small claims)\b/.test(t)) return 'Small Claims';
  if (/\b(criminal|defendant|felony|misdemeanor|arraignment|prop 47|expungement|1203)\b/.test(t)) return 'Criminal';
  if (/\b(dissolution|divorce|custody|child support|spousal|paternity|domestic|restraining)\b/.test(t)) return 'Family Law';
  if (/\b(juvenile|dependency|delinquency|minor)\b/.test(t)) return 'Juvenile';
  if (/\b(traffic|infraction|citation)\b/.test(t)) return 'Traffic';
  if (/\b(appeal|appellate)\b/.test(t)) return 'Appeals';
  return '';
}

function main() {
  const m = JSON.parse(fs.readFileSync(MF, 'utf8'));
  const stats = { codesCleaned: 0, titlesCleaned: 0, recategorized: 0, spanish: 0, variants: 0 };

  for (const f of m.forms) {
    const origCode = f.code, origTitle = f.title, origCat = f.category;

    // Skip the hand-seeded reference rows whose codes/titles are already clean
    // (Sacramento) unless they clearly have a tail — they came from a curated seed.
    const variant = detectVariant(origCode, origTitle);
    if (variant) { f.variant = variant; stats.variants++; }
    if (variant === 'S' && !/spanish/i.test(f.language || '')) { f.language = 'Spanish'; stats.spanish++; }

    const newCode = cleanCode(origCode, origTitle);
    if (newCode && newCode !== origCode) { f.code = newCode; stats.codesCleaned++; }

    // Category: decide on the ORIGINAL label first. Generic buckets → infer
    // from the clean code (or title keywords); real labels → canonicalize.
    let cat;
    if (GENERIC.test(String(origCat || '').trim())) {
      cat = inferCategory(f.code) || inferFromTitle(origTitle) || origCat;
      if (cat !== origCat) stats.recategorized++;
    } else {
      cat = canonicalCategory(origCat);
    }
    if (cat !== origCat) f.category = cat;

    const newTitle = cleanTitle(origTitle, origCat, f.code);
    if (newTitle && newTitle !== origTitle) { f.title = newTitle; stats.titlesCleaned++; }
  }

  // Refresh the per-county category counts are not stored, so just resort forms.
  m.forms.sort((a, b) =>
    a.county.localeCompare(b.county) || String(a.code).localeCompare(String(b.code)) || a.title.localeCompare(b.title));
  m.generatedAt = new Date().toISOString();
  m.normalized = true;
  fs.writeFileSync(MF, JSON.stringify(m, null, 2) + '\n');

  console.log('Normalization complete:');
  console.log('  codes cleaned     :', stats.codesCleaned);
  console.log('  titles cleaned    :', stats.titlesCleaned);
  console.log('  re-categorized    :', stats.recategorized, '(from generic bucket)');
  console.log('  variants tagged   :', stats.variants, '| Spanish flagged:', stats.spanish);
}

main();
