#!/usr/bin/env node
'use strict';

/**
 * Turn assets/form-cache/ca-forms-catalog.json (code, official title, category,
 * multilingual keywords) into the router's per-category netlify/functions/forms/
 * *.json catalogs so route.js can return any of the 345 forms by code or query.
 *
 * Existing hand-curated entries are PRESERVED (matched by code); only new codes
 * are appended. New category files (nc, enforce, juvenile, criminal, appeals,
 * general) are created.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG = require(path.join(ROOT, 'assets/form-cache/ca-forms-catalog.json'));
const FORMS_DIR = path.join(ROOT, 'netlify/functions/forms');

// category prefix -> { file, category_name, subcategory }
const MAP = {
  FL: { file: 'fl', name: 'Family Law', sub: 'family-law' },
  DV: { file: 'ro', name: 'Restraining Orders', sub: 'domestic-violence' },
  CH: { file: 'ro', name: 'Restraining Orders', sub: 'civil-harassment' },
  EA: { file: 'ro', name: 'Restraining Orders', sub: 'elder-abuse' },
  WV: { file: 'ro', name: 'Restraining Orders', sub: 'workplace-violence' },
  GV: { file: 'ro', name: 'Restraining Orders', sub: 'gun-violence' },
  SC: { file: 'sc', name: 'Small Claims', sub: 'small-claims' },
  UD: { file: 'ud', name: 'Unlawful Detainer', sub: 'eviction' },
  FW: { file: 'fee', name: 'Fee Waiver', sub: 'fee-waiver' },
  POS: { file: 'service', name: 'Proof of Service', sub: 'service' },
  DE: { file: 'probate', name: 'Probate', sub: 'decedents-estate' },
  GC: { file: 'probate', name: 'Probate', sub: 'guardianship-conservatorship' },
  CIV: { file: 'civ', name: 'Civil', sub: 'civil' },
  CM: { file: 'civ', name: 'Civil', sub: 'case-management' },
  MC: { file: 'civ', name: 'Civil', sub: 'miscellaneous' },
  NC: { file: 'nc', name: 'Name Change & Gender Recognition', sub: 'name-change' },
  EJ: { file: 'enforce', name: 'Enforcement of Judgment', sub: 'enforcement' },
  WG: { file: 'enforce', name: 'Enforcement of Judgment', sub: 'wage-garnishment' },
  JV: { file: 'juvenile', name: 'Juvenile', sub: 'juvenile' },
  CR: { file: 'criminal', name: 'Criminal', sub: 'criminal' },
  APP: { file: 'appeals', name: 'Appellate', sub: 'appeals' },
  ADM: { file: 'general', name: 'General / Administrative', sub: 'general' },
  MIL: { file: 'general', name: 'Military & Veterans', sub: 'military' }
};

const STOP = new Set(['the','and','for','with','under','from','this','that','your','you','are','was','will','can','not','form','california','courts','court','order','request','petition','response','declaration','notice','application','attachment','page','self','help','guide','about','into','onto','per','via','etc']);

function titleTokens(title) {
  return [...new Set(String(title || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)))];
}

function loadFile(file) {
  const p = path.join(FORMS_DIR, `${file}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  return null;
}

// group catalog forms by target file
const byFile = {};
for (const form of CATALOG.forms) {
  const m = MAP[form.category];
  if (!m) continue;
  (byFile[m.file] = byFile[m.file] || []).push({ form, m });
}

let added = 0; let preserved = 0;
for (const [file, items] of Object.entries(byFile)) {
  const existing = loadFile(file) || {
    category: file,
    category_name: items[0].m.name,
    forms: [],
    subcategory_pane: {}
  };
  const byCode = new Map((existing.forms || []).map((f) => [String(f.code).toUpperCase(), f]));
  for (const { form, m } of items) {
    const code = form.code.toUpperCase();
    if (byCode.has(code)) { preserved++; continue; } // keep hand-curated entry
    const title = form.title || code;
    const entry = {
      code,
      subcategory: m.sub,
      names: { en: title, ru: title, uk: title, es: title },
      keywords: [...new Set([...(form.keywords || []), ...titleTokens(title), code.toLowerCase()])],
      description: title,
      ...(typeof form.fieldCount === 'number' ? { fieldCount: form.fieldCount } : {})
    };
    existing.forms.push(entry);
    byCode.set(code, entry);
    added++;
  }
  existing.forms.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  fs.writeFileSync(path.join(FORMS_DIR, `${file}.json`), `${JSON.stringify(existing, null, 2)}\n`);
}

const files = [...new Set(Object.keys(byFile))].sort();
console.log(`Catalogs written: ${files.join(', ')}`);
console.log(`New entries added: ${added} | existing preserved: ${preserved}`);
const counts = {};
for (const f of files) counts[f] = (loadFile(f).forms || []).length;
console.log('Total forms per catalog:', JSON.stringify(counts));
