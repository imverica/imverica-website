#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_FILE = path.join(ROOT, 'assets/form-cache/ca-local-court-manifest.json');
const OUTPUT_FILE = path.join(ROOT, 'assets/form-cache/ca-criminal-relief-index.json');
const REPORT_FILE = path.join(ROOT, 'qa-reports/ca-criminal-relief-forms-by-county.md');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));

function text(form) {
  return `${form.code || ''} ${form.title || ''} ${form.category || ''}`.toLowerCase();
}

function criminalContext(form) {
  const value = text(form);
  return /criminal|misdemeanor|felony|plea|traffic|defendant|penal\s+code|\bpc\s*§?|\bpc\s*\d/i.test(value);
}

function classify(form) {
  const value = text(form);
  if (!criminalContext(form)) return '';
  if (/probation|1203\.3|defendant.?s\s+motion|criminal\s+motion|placed?\s+on\s+(the\s+)?court.?s?\s+calendar|modify\s+(sentence|probation)|terminate\s+probation|early\s+termination|jail\s+credit|alternative\s+sentencing|re-?referral|community\s+service|turn-?in\s+date/i.test(value)) return 'probation-motion';
  if (/expung|dismissal|dismiss\w*\s+(conviction|accusation)|1203\.4|record\s+(clean|clear)|set\s+aside\s+conviction/i.test(value)) return 'record-cleanup';
  if (/resentenc|reclassif|redesignat|reduce\w*\s+to\s+misdemeanor|1170\.18|prop(?:osition)?\s*47|recall\s+of\s+sentence|post-?sentence/i.test(value)) return 'resentencing';
  if (/warrant|surrender|recall\s+warrant/i.test(value)) return 'warrant';
  return '';
}

function cleanTitle(value) {
  return String(value || '')
    .replace(/^Criminal\s+Criminal\s+/i, 'Criminal ')
    .replace(/\s+Spanish\s+Russian\s*$/i, '')
    .trim();
}

function formLanguage(form) {
  const file = String(form.officialPdfUrl || '').split('/').pop() || '';
  if (/-r(?:-|\.|_)/i.test(file)) return 'Russian';
  if (/-s(?:-|\.|_)/i.test(file)) return 'Spanish';
  return 'English';
}

const counties = (manifest.counties || []).map((county) => ({
  name: county.name || county.county,
  slug: county.slug || county.countySlug
})).filter((county) => county.name && county.slug);

const byCounty = new Map(counties.map((county) => [county.slug, { ...county, forms: [] }]));
for (const form of manifest.forms || []) {
  const reliefType = classify(form);
  if (!reliefType || !byCounty.has(form.countySlug)) continue;
  byCounty.get(form.countySlug).forms.push({
    id: form.id,
    code: form.code,
    title: cleanTitle(form.title),
    language: formLanguage(form),
    reliefType,
    role: form.role,
    fieldCount: form.fieldCount || 0,
    officialPageUrl: form.officialPageUrl,
    officialPdfUrl: form.officialPdfUrl
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  source: 'Official California county Superior Court local-form catalog',
  countyCount: counties.length,
  counties: [...byCounty.values()].map((county) => ({
    ...county,
    forms: county.forms.sort((a, b) =>
      (a.role === 'prepare' ? 0 : 1) - (b.role === 'prepare' ? 0 : 1) ||
      a.reliefType.localeCompare(b.reliefType) || a.code.localeCompare(b.code))
  }))
};

fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });

const lines = [
  '# California County Criminal Relief / Probation Forms',
  '',
  `Generated: ${output.generatedAt}`,
  '',
  'This inventory separates criminal probation/post-judgment relief from probate estates. A blank county row means the county catalog did not publish a matching local form; it does not mean relief is unavailable.',
  '',
  '| County | Local forms | Preparable | Matching forms |',
  '|---|---:|---:|---|'
];
for (const county of output.counties) {
  const preparable = county.forms.filter((form) => form.role === 'prepare').length;
  const forms = county.forms.length
    ? county.forms.map((form) => `\`${form.code}\` (${form.reliefType}, ${form.role})`).join('<br>')
    : 'No matching local form indexed';
  lines.push(`| ${county.name} | ${county.forms.length} | ${preparable} | ${forms} |`);
}
fs.writeFileSync(REPORT_FILE, `${lines.join('\n')}\n`);

const covered = output.counties.filter((county) => county.forms.length).length;
const forms = output.counties.reduce((sum, county) => sum + county.forms.length, 0);
console.log(`Criminal relief index: ${output.counties.length} counties, ${covered} with local matches, ${forms} forms`);
