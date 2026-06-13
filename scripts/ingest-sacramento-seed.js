#!/usr/bin/env node
'use strict';

/**
 * Ingest the hand-built Sacramento local-forms seed into the local-court
 * manifest.
 *
 * WHY a seed: saccourt.ca.gov returns HTTP 403 to all automated requests
 * (Cloudflare-style bot protection — verified for both the listing pages and
 * the published-document PDF URLs, with multiple browser User-Agents). The
 * automated scanner therefore cannot reach Sacramento, so the county's local
 * forms were captured by hand from the official listing pages into
 * scripts/ca-local-court-seeds/sacramento.json.
 *
 * HONESTY RULES (per owner directive):
 *   - Every officialPdfUrl / sourcePageUrl / title / code comes verbatim from
 *     the seed (which came from the official saccourt.ca.gov listings). Nothing
 *     is invented.
 *   - Because the PDFs cannot be downloaded, fillability cannot be verified, no
 *     template can be cached, and no sourceSha256 can be computed. Every entry
 *     is therefore role:'info' (reference / official-link only) and flagged
 *     seeded:true + verification:'hand-seeded' + botBlocked:true.
 *   - Forms without a printed code keep code:'' (we never fabricate a code).
 *
 * Run: node scripts/ingest-sacramento-seed.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'scripts/ca-local-court-seeds/sacramento.json');
const MANIFEST_FILE = path.join(ROOT, 'assets/form-cache/ca-local-court-manifest.json');
const COUNTY = 'Sacramento';
const COUNTY_SLUG = 'sacramento';
const SOURCE_LISTING = 'https://www.saccourt.ca.gov/forms-fees/forms-fees.aspx';

function shortHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 8);
}

function extractCode(title) {
  const m = String(title || '').match(/^([A-Z]{2,5}(?:-[A-Z0-9]+){1,3})\s/);
  return m ? m[1] : '';
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function main() {
  const rawSeed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  const seed = Array.isArray(rawSeed) ? rawSeed : (rawSeed.forms || []);
  if (!seed.length) throw new Error('Sacramento seed is empty');

  // De-duplicate by officialPdfUrl (the canonical document identity).
  const byUrl = new Map();
  for (const item of seed) {
    const url = String(item.officialPdfUrl || '').trim();
    if (!url) continue;
    if (!byUrl.has(url)) byUrl.set(url, item);
  }

  const forms = [...byUrl.values()].map((item) => {
    const code = extractCode(item.title);
    const slug = `${slugify(code || item.title)}-${shortHash(item.officialPdfUrl)}`;
    return {
      id: `${COUNTY_SLUG}:${slug}`,
      county: COUNTY,
      countySlug: COUNTY_SLUG,
      scope: 'local',
      code,
      slug,
      title: String(item.title || '').trim(),
      category: String(item.category || 'Local Forms').trim(),
      language: 'English',
      role: 'info', // bot-blocked: cannot download to verify fillability or cache a template
      description: 'Hand-seeded from the official Sacramento Superior Court forms listing. saccourt.ca.gov blocks automated download (HTTP 403), so fillability is unverified and no fillable template is cached — this is a reference entry linking to the official PDF.',
      sourcePageUrl: String(item.sourcePageUrl || SOURCE_LISTING).trim(),
      officialPageUrl: String(item.sourcePageUrl || SOURCE_LISTING).trim(),
      officialPdfUrl: String(item.officialPdfUrl || '').trim(),
      sourceSha256: null,
      templateSha256: null,
      sourceBytes: 0,
      fieldCount: 0,
      rawFieldCount: 0,
      cachedTemplate: null,
      seeded: true,
      verification: 'hand-seeded',
      botBlocked: true
    };
  }).sort((a, b) => a.code.localeCompare(b.code) || a.title.localeCompare(b.title));

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));

  // Replace any existing Sacramento forms + county summary.
  manifest.forms = (manifest.forms || []).filter((f) => f.countySlug !== COUNTY_SLUG).concat(forms);
  manifest.forms.sort((a, b) =>
    a.county.localeCompare(b.county) || String(a.code).localeCompare(String(b.code)) || a.title.localeCompare(b.title));

  const countySummary = {
    county: COUNTY,
    countySlug: COUNTY_SLUG,
    sourceUrl: SOURCE_LISTING,
    pagesScanned: 0,
    candidateCount: forms.length,
    formCount: forms.length,
    preparableCount: 0,
    referenceCount: forms.length,
    errorCount: 0,
    errors: [],
    seeded: true,
    botBlocked: true,
    verification: 'hand-seeded (saccourt.ca.gov returns HTTP 403 to automated requests)'
  };
  manifest.counties = (manifest.counties || []).filter((c) => c.countySlug !== COUNTY_SLUG).concat(countySummary);
  manifest.counties.sort((a, b) => a.county.localeCompare(b.county));

  // Recompute totals.
  manifest.formCount = manifest.forms.length;
  manifest.preparableCount = manifest.forms.filter((f) => f.role === 'prepare').length;
  manifest.referenceCount = manifest.forms.filter((f) => f.role !== 'prepare').length;
  manifest.generatedAt = new Date().toISOString();

  fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Sacramento ingested: ${forms.length} reference forms (${byUrl.size} unique of ${seed.length} seed rows).`);
  console.log(`Manifest totals → forms: ${manifest.formCount}, fillable: ${manifest.preparableCount}, reference: ${manifest.referenceCount}.`);
}

main();
