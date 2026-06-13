#!/usr/bin/env node
'use strict';

/**
 * Verification report for the 58-county local (non-Judicial-Council) forms set.
 *
 * Produces qa-reports/ca-local-court-verification.md with, per the owner's
 * directive:
 *   - all 58 counties covered, with per-county totals
 *   - total local forms, fillable count, reference count
 *   - which counties were verified directly against official court websites
 *   - which counties are bot-blocked (HTTP 403 on the source listing)
 *   - which counties rely on hand-built seed files
 *   - up to N spot-checked official form URLs per county (live HTTP status)
 *   - any broken / redirected / duplicate / suspicious URLs
 *
 * Nothing is invented: every URL comes from the manifest. Counties/forms that
 * cannot be verified are reported as blocked/unverified, never guessed.
 *
 * Usage: node scripts/verify-ca-local-court-forms.js [--samples N] [--no-network]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/form-cache/ca-local-court-manifest.json'), 'utf8'));
const OUT_DIR = path.join(ROOT, 'qa-reports');
const OUT_FILE = path.join(OUT_DIR, 'ca-local-court-verification.md');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const samplesArg = process.argv.indexOf('--samples');
const SAMPLES = samplesArg >= 0 ? Number(process.argv[samplesArg + 1]) || 4 : 4;
const NO_NET = process.argv.includes('--no-network');

function pickSamples(forms, n) {
  // Spread the sample across the county's forms (deterministic).
  const withUrl = forms.filter((f) => f.officialPdfUrl);
  if (withUrl.length <= n) return withUrl;
  const step = Math.floor(withUrl.length / n);
  const out = [];
  for (let i = 0; i < n; i++) out.push(withUrl[i * step]);
  return out;
}

async function head(url) {
  if (NO_NET) return { status: 'skip', finalUrl: url };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try {
      res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA }, signal: ctrl.signal });
    } finally { clearTimeout(t); }
    return {
      status: res.status,
      finalUrl: res.url,
      contentType: res.headers.get('content-type') || '',
      redirected: res.redirected
    };
  } catch (err) {
    return { status: 'error', error: String(err.message || err), finalUrl: url };
  }
}

function classify(form, probe) {
  const issues = [];
  if (probe.status === 403) issues.push('bot-blocked (403)');
  else if (probe.status === 404) issues.push('broken (404)');
  else if (probe.status === 'error') issues.push(`fetch-error: ${probe.error}`);
  else if (typeof probe.status === 'number' && probe.status >= 400) issues.push(`http-${probe.status}`);
  if (probe.redirected && probe.finalUrl && probe.finalUrl !== form.officialPdfUrl) issues.push('redirected');
  if (typeof probe.status === 'number' && probe.status < 400 && probe.contentType &&
      !/pdf|octet-stream|force-download/i.test(probe.contentType)) issues.push(`non-pdf (${probe.contentType.split(';')[0]})`);
  return issues;
}

async function main() {
  const forms = MANIFEST.forms || [];
  const byCounty = new Map();
  for (const f of forms) {
    if (!byCounty.has(f.county)) byCounty.set(f.county, []);
    byCounty.get(f.county).push(f);
  }
  const countySummaries = new Map((MANIFEST.counties || []).map((c) => [c.county, c]));

  // Global duplicate-URL scan.
  const urlCount = new Map();
  for (const f of forms) if (f.officialPdfUrl) urlCount.set(f.officialPdfUrl, (urlCount.get(f.officialPdfUrl) || 0) + 1);
  const duplicateUrls = [...urlCount.entries()].filter(([, n]) => n > 1);

  const counties = [...byCounty.keys()].sort();
  const rows = [];
  let totalFillable = 0;
  let totalReference = 0;
  const allIssues = [];

  for (const county of counties) {
    const cforms = byCounty.get(county);
    const summary = countySummaries.get(county) || {};
    const fillable = cforms.filter((f) => f.role === 'prepare').length;
    const reference = cforms.length - fillable;
    totalFillable += fillable;
    totalReference += reference;

    const seeded = Boolean(summary.seeded) || cforms.some((f) => f.seeded);
    const botBlocked = Boolean(summary.botBlocked) || cforms.some((f) => f.botBlocked);

    const samples = pickSamples(cforms, SAMPLES);
    const sampleResults = [];
    for (const f of samples) {
      const probe = await head(f.officialPdfUrl);
      const issues = classify(f, probe);
      if (issues.length) allIssues.push({ county, code: f.code, url: f.officialPdfUrl, issues });
      sampleResults.push({ code: f.code || '(no code)', title: f.title, url: f.officialPdfUrl, status: probe.status, issues });
    }

    let verification = 'verified-direct';
    if (seeded) verification = 'hand-seeded';
    else if (botBlocked) verification = 'bot-blocked (partial)';

    rows.push({ county, total: cforms.length, fillable, reference, verification, seeded, botBlocked, sampleResults });
  }

  // ---- Render markdown ----
  const L = [];
  L.push('# California Local (Non-Judicial-Council) Court Forms — Verification Report');
  L.push('');
  L.push(`_Generated: ${new Date().toISOString()}${NO_NET ? ' (network checks skipped)' : ''}_`);
  L.push('');
  L.push('Local county Superior Court forms — the forms each county adopts itself — kept **separate** from the statewide Judicial Council catalog. Every URL below comes verbatim from the scan/seed; nothing is invented.');
  L.push('');
  L.push('## Totals');
  L.push('');
  L.push(`- **Counties covered:** ${counties.length} / 58`);
  L.push(`- **Total local forms:** ${forms.length}`);
  L.push(`- **Fillable (client-preparable) PDFs:** ${totalFillable}`);
  L.push(`- **Reference (official-link only) PDFs:** ${totalReference}`);
  L.push(`- **Verified directly against official court websites:** ${rows.filter((r) => r.verification === 'verified-direct').length} counties`);
  L.push(`- **Bot-blocked (partial coverage):** ${rows.filter((r) => r.botBlocked && !r.seeded).map((r) => r.county).join(', ') || 'none'}`);
  L.push(`- **Hand-seeded (source blocks all automation):** ${rows.filter((r) => r.seeded).map((r) => r.county).join(', ') || 'none'}`);
  L.push(`- **Duplicate official URLs across the set:** ${duplicateUrls.length}`);
  L.push('');
  L.push('## Per-county coverage');
  L.push('');
  L.push('| County | Forms | Fillable | Reference | Verification |');
  L.push('|---|---:|---:|---:|---|');
  for (const r of rows) {
    L.push(`| ${r.county} | ${r.total} | ${r.fillable} | ${r.reference} | ${r.verification} |`);
  }
  L.push('');
  L.push(`## Spot-checked official URLs (up to ${SAMPLES} per county)`);
  L.push('');
  L.push('Live HTTP status of sampled official form PDFs. `200` = reachable; `403` = bot-blocked by the court site (the PDF exists, automation is refused); `404` = broken.');
  L.push('');
  for (const r of rows) {
    L.push(`### ${r.county} County — ${r.total} forms (${r.verification})`);
    if (!r.sampleResults.length) { L.push('_No URLs to sample._'); L.push(''); continue; }
    for (const s of r.sampleResults) {
      const flag = s.issues.length ? ` ⚠️ ${s.issues.join(', ')}` : ' ✓';
      L.push(`- \`${s.status}\`${flag} **${s.code}** — ${String(s.title).slice(0, 70)}`);
      L.push(`  - ${s.url}`);
    }
    L.push('');
  }
  // Forms the scanner marked fillable but the engine could not generate
  // (downgraded to reference so the catalog never offers a broken form).
  const downgraded = forms.filter((f) => /Downgraded to reference/i.test(f.description || ''));
  L.push('## Downgraded forms (marked fillable by scanner, failed generation → now reference)');
  L.push('');
  if (!downgraded.length) L.push('_None._');
  else {
    L.push('| County | Code | Title |');
    L.push('|---|---|---|');
    for (const f of downgraded) L.push(`| ${f.county} | ${f.code || '—'} | ${String(f.title).slice(0, 60)} |`);
  }
  L.push('');
  L.push('## Broken / redirected / suspicious URLs');
  L.push('');
  if (!allIssues.length) {
    L.push('_None detected in the sampled URLs._');
  } else {
    L.push('| County | Code | Issue | URL |');
    L.push('|---|---|---|---|');
    for (const i of allIssues) L.push(`| ${i.county} | ${i.code || '—'} | ${i.issues.join('; ')} | ${i.url} |`);
  }
  L.push('');
  L.push('## Duplicate official URLs');
  L.push('');
  if (!duplicateUrls.length) L.push('_None._');
  else {
    L.push('| Count | URL |');
    L.push('|---:|---|');
    for (const [url, n] of duplicateUrls.slice(0, 50)) L.push(`| ${n} | ${url} |`);
  }
  L.push('');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, L.join('\n') + '\n');
  console.log(`Report written: ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`Counties: ${counties.length}/58 | forms: ${forms.length} | fillable: ${totalFillable} | reference: ${totalReference}`);
  console.log(`Sampled URLs with issues: ${allIssues.length} | duplicate URLs: ${duplicateUrls.length}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
