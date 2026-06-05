#!/usr/bin/env node
'use strict';

/**
 * Refresh USCIS PDF templates from official uscis.gov form pages.
 *
 * The script updates only USCIS records in the shared form-cache manifest.
 * It writes files only when the official PDF bytes or meaningful metadata
 * changed, so monthly automation does not create timestamp-only commits.
 *
 * Usage:
 *   node scripts/update-uscis-forms.js
 *   node scripts/update-uscis-forms.js --codes I-485,I-765,G-1055
 */

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'netlify/functions/forms/immigration.json');
const STATIC_MANIFEST = path.join(ROOT, 'assets/form-cache/manifest.json');
const FUNCTIONS_MANIFEST = path.join(ROOT, 'netlify/functions/form-cache-manifest.json');
const PDF_DIR = path.join(ROOT, 'assets/form-cache/pdfs');
const USCIS_BASE = 'https://www.uscis.gov';
const USER_AGENT = 'Imverica USCIS form updater (+https://imverica.com)';
const CONCURRENCY = 4;
const DEFAULT_EXPIRATION_WARNING_DAYS = 90;

const FORM_PAGE_PATHS = {
  'I-130A': ['i-130'],
  'I-485 SUPPLEMENT A': ['i-485supa', 'i-485'],
  'I-485 SUPPLEMENT J': ['i-485supj', 'i-485'],
  'I-539A': ['i-539'],
  'I-590': ['i-590']
};

const FORM_PDF_ALIASES = {
  'G-845 SUPPLEMENT': ['g-845supplement', 'g-845-supplement'],
  'I-485 SUPPLEMENT A': ['i-485supa'],
  'I-485 SUPPLEMENT J': ['i-485supj']
};

const DIRECT_PDF_FALLBACKS = {
  'G-639': ['g-639'],
  'I-134A': ['i-134a'],
  'I-590': ['i-590'],
  'I-942': ['i-942']
};

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function safeSlug(value) {
  return normalizeCode(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutize(href) {
  try {
    return new URL(href, USCIS_BASE).href;
  } catch {
    return '';
  }
}

function codeToPath(code) {
  return normalizeCode(code).toLowerCase().replace(/\s+/g, '-');
}

function getPagePaths(code) {
  return FORM_PAGE_PATHS[code] || [codeToPath(code)];
}

function getPdfAliases(code) {
  const compact = normalizeCode(code).toLowerCase().replace(/\s+/g, '');
  return [...new Set([compact, ...(FORM_PDF_ALIASES[code] || [])])];
}

function findPdfLink(html, code, instruction = false) {
  const links = [...String(html || '').matchAll(/<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: absolutize(match[1]),
      text: stripTags(match[2])
    }))
    .filter((link) => link.href && link.href.includes('/sites/default/files/document/forms/'));

  const aliases = getPdfAliases(code);
  const scored = links.map((link) => {
    const lowerHref = link.href.toLowerCase();
    const lowerText = link.text.toLowerCase();
    let score = 0;

    if (instruction) {
      if (aliases.some((alias) => lowerHref.includes(`${alias}instr.pdf`))) score += 80;
      if (lowerText.includes('instruction')) score += 30;
      if (lowerHref.includes('instr')) score += 25;
    } else {
      if (aliases.some((alias) => lowerHref.includes(`${alias}.pdf`))) score += 80;
      if (lowerText.includes(`form ${normalizeCode(code).toLowerCase()}`)) score += 30;
      if (!lowerHref.includes('instr')) score += 15;
    }

    return { ...link, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].href : '';
}

function extractEditionDate(html) {
  const text = stripTags(html);
  const match = text.match(/Edition Date\s+([0-9]{2}\/[0-9]{2}\/[0-9]{2,4})/i);
  return match ? match[1] : '';
}

function extractTitle(html, code) {
  const h1 = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripTags(h1[1]);
  const title = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return stripTags(title[1]).replace(/\s*\|\s*USCIS\s*$/i, '');
  return normalizeCode(code);
}

async function fetchUscisPage(paths) {
  let lastUrl = '';
  for (const formPath of paths) {
    const pageUrl = `${USCIS_BASE}/${formPath}`;
    lastUrl = pageUrl;
    const response = await fetch(pageUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (response.ok) {
      return { html: await response.text(), pageUrl: response.url || pageUrl };
    }
  }
  return { html: '', pageUrl: lastUrl };
}

async function directPdfUrl(code, instruction = false) {
  const aliases = [...getPdfAliases(code), ...(DIRECT_PDF_FALLBACKS[code] || [])];
  for (const alias of [...new Set(aliases)]) {
    const url = `${USCIS_BASE}/sites/default/files/document/forms/${alias}${instruction ? 'instr' : ''}.pdf`;
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT }
    });
    if (response.ok && String(response.headers.get('content-type') || '').toLowerCase().includes('pdf')) {
      return url;
    }
  }
  return '';
}

async function resolveOfficial(code) {
  const page = await fetchUscisPage(getPagePaths(code));
  const pdfUrl = page.html ? findPdfLink(page.html, code, false) || await directPdfUrl(code, false) : await directPdfUrl(code, false);
  const instructionsUrl = page.html ? findPdfLink(page.html, code, true) || await directPdfUrl(code, true) : await directPdfUrl(code, true);
  return {
    code: normalizeCode(code),
    title: page.html ? extractTitle(page.html, code) : normalizeCode(code),
    editionDate: page.html ? extractEditionDate(page.html) : '',
    officialPageUrl: page.pageUrl || `${USCIS_BASE}/${getPagePaths(code)[0]}`,
    officialPdfUrl: pdfUrl,
    instructionsUrl,
    officialStatus: pdfUrl ? (page.html ? 'current-pdf-found' : 'direct-pdf') : 'page-found-no-pdf-link'
  };
}

async function downloadPdf(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`PDF download failed ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const type = String(response.headers.get('content-type') || '');
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-' && !type.toLowerCase().includes('pdf')) {
    throw new Error(`Downloaded file is not a PDF (${type || 'unknown content type'})`);
  }
  return {
    buffer,
    bytes: buffer.length,
    sha256: sha256(buffer),
    contentType: type || 'application/pdf',
    finalUrl: response.url || url
  };
}

async function existingSha(file) {
  try {
    return sha256(await fsp.readFile(file));
  } catch {
    return '';
  }
}

async function writeIfChanged(file, buffer) {
  const nextSha = sha256(buffer);
  if (await existingSha(file) === nextSha) return false;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  await fsp.writeFile(temporary, buffer);
  await fsp.rename(temporary, file);
  return true;
}

function parseUscisDate(value) {
  const match = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return parsed;
}

function expirationStatus(expirationDate, warningDays) {
  const parsed = parseUscisDate(expirationDate);
  if (!parsed) return 'unknown';

  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expiration = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  const warningMs = Math.max(0, warningDays) * 24 * 60 * 60 * 1000;

  if (expiration < today) return 'expired';
  if (expiration - today <= warningMs) return 'expires-soon';
  return 'current';
}

function expirationIso(expirationDate) {
  const parsed = parseUscisDate(expirationDate);
  return parsed ? parsed.toISOString().slice(0, 10) : '';
}

async function extractPdfText(buffer, slug) {
  const temporary = path.join(os.tmpdir(), `imverica-uscis-${slug}-${process.pid}.pdf`);
  try {
    await fsp.writeFile(temporary, buffer);
    return execFileSync('pdftotext', ['-f', '1', '-l', '1', '-layout', temporary, '-'], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024
    });
  } finally {
    await fsp.rm(temporary, { force: true });
  }
}

async function pdfExpirationMetadata(buffer, code, warningDays) {
  const text = await extractPdfText(buffer, safeSlug(code));
  const match = text.match(/\bExpires:?\s+([0-9]{1,2}\/[0-9]{1,2}\/(?:[0-9]{2}|[0-9]{4}))\b/i);
  const expirationDate = match ? match[1].replace(/\b(\d)\/(\d{1,2})\//, '0$1/$2/').replace(/\/(\d)\/(\d{2,4})$/, '/0$1/$2') : '';
  return {
    expirationDate,
    expirationDateIso: expirationIso(expirationDate),
    expirationStatus: expirationStatus(expirationDate, warningDays)
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    codes: new Set(),
    limit: 0,
    expirationWarningDays: DEFAULT_EXPIRATION_WARNING_DAYS
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--codes') {
      String(args[++i] || '').split(',').map(normalizeCode).filter(Boolean).forEach((code) => options.codes.add(code));
    } else if (args[i] === '--limit') {
      options.limit = Number(args[++i] || 0);
    } else if (args[i] === '--expiration-warning-days') {
      options.expirationWarningDays = Number(args[++i] || DEFAULT_EXPIRATION_WARNING_DAYS);
    }
  }
  return options;
}

async function readJson(file) {
  return JSON.parse(await fsp.readFile(file, 'utf8'));
}

async function loadUscisEntries(options) {
  const catalog = await readJson(CATALOG_PATH);
  let entries = (catalog.forms || [])
    .map((form) => ({
      code: normalizeCode(form.code),
      title: form.names?.en || Object.values(form.names || {})[0] || normalizeCode(form.code),
      category: catalog.category || 'immigration',
      panes: [catalog.subcategory_pane || 'immigration'],
      subcategories: form.subcategory ? [form.subcategory] : [],
      catalogFiles: ['immigration.json']
    }))
    .filter((entry) => entry.code);

  if (options.codes.size) entries = entries.filter((entry) => options.codes.has(entry.code));
  if (options.limit > 0) entries = entries.slice(0, options.limit);
  return entries;
}

function mergeRecord(previous, entry, official, downloaded, changed, pdfMetadata) {
  const slug = safeSlug(entry.code);
  const cachedFile = previous?.cachedFile || `assets/form-cache/pdfs/${slug}.pdf`;
  return {
    ...(previous || {}),
    code: entry.code,
    agency: 'uscis',
    title: entry.title,
    category: entry.category,
    panes: entry.panes,
    subcategories: entry.subcategories,
    catalogFiles: entry.catalogFiles,
    cachedFile,
    cachedPdfUrl: previous?.cachedPdfUrl || `/assets/form-cache/pdfs/${slug}.pdf`,
    officialStatusCode: 200,
    officialStatus: official.officialStatus,
    officialPdfUrl: downloaded.finalUrl,
    officialPageUrl: official.officialPageUrl,
    editionDate: official.editionDate,
    effectiveDate: '',
    resolvedTitle: official.title,
    expirationDate: pdfMetadata.expirationDate,
    expirationDateIso: pdfMetadata.expirationDateIso,
    expirationStatus: pdfMetadata.expirationStatus,
    bytes: downloaded.bytes,
    sha256: downloaded.sha256,
    contentType: downloaded.contentType,
    cacheStatus: 'cached',
    cacheReused: changed ? false : previous?.cacheReused,
    cachedAt: changed || !previous?.cachedAt ? new Date().toISOString() : previous.cachedAt
  };
}

function significantRecordChanged(a, b) {
  const keys = [
    'officialStatus',
    'officialPdfUrl',
    'editionDate',
    'expirationDate',
    'expirationDateIso',
    'expirationStatus',
    'bytes',
    'sha256',
    'contentType',
    'cacheStatus'
  ];
  return keys.some((key) => JSON.stringify(a?.[key]) !== JSON.stringify(b?.[key]));
}

async function refreshEntry(entry, previous, options) {
  const official = await resolveOfficial(entry.code);
  if (!official.officialPdfUrl) {
    if (previous?.cacheStatus === 'cached') {
      return { record: previous, changed: false, pdfChanged: false, warning: 'official PDF missing; kept existing cached file' };
    }
    const next = {
      ...(previous || {}),
      code: entry.code,
      agency: 'uscis',
      title: entry.title,
      category: entry.category,
      panes: entry.panes,
      subcategories: entry.subcategories,
      catalogFiles: entry.catalogFiles,
      cachedFile: previous?.cachedFile || `assets/form-cache/pdfs/${safeSlug(entry.code)}.pdf`,
      cachedPdfUrl: previous?.cachedPdfUrl || `/assets/form-cache/pdfs/${safeSlug(entry.code)}.pdf`,
      officialStatusCode: 200,
      officialStatus: official.officialStatus,
      officialPdfUrl: '',
      officialPageUrl: official.officialPageUrl,
      editionDate: official.editionDate,
      expirationDate: '',
      expirationDateIso: '',
      expirationStatus: 'unknown',
      effectiveDate: '',
      resolvedTitle: official.title,
      cacheStatus: 'not_found',
      error: 'No official PDF URL found'
    };
    return { record: next, changed: significantRecordChanged(previous, next), pdfChanged: false };
  }

  const downloaded = await downloadPdf(official.officialPdfUrl);
  const pdfMetadata = await pdfExpirationMetadata(downloaded.buffer, entry.code, options.expirationWarningDays);
  const cachedFile = previous?.cachedFile || `assets/form-cache/pdfs/${safeSlug(entry.code)}.pdf`;
  const targetFile = path.join(ROOT, cachedFile);
  const pdfChanged = await writeIfChanged(targetFile, downloaded.buffer);
  const next = mergeRecord(previous, entry, official, downloaded, pdfChanged, pdfMetadata);
  return {
    record: next,
    changed: pdfChanged || significantRecordChanged(previous, next),
    pdfChanged
  };
}

async function runQueue(items, worker) {
  const output = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const index = next++;
      const entry = items[index];
      process.stdout.write(`[${index + 1}/${items.length}] ${entry.code} `);
      try {
        output[index] = await worker(entry);
        const result = output[index];
        console.log(`status=${result.record.cacheStatus} pdf=${result.pdfChanged ? 'updated' : 'same'}${result.warning ? ` warning=${result.warning}` : ''}`);
      } catch (error) {
        output[index] = { code: entry.code, error: error.message || String(error) };
        console.log(`FAILED ${output[index].error}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, runner));
  return output;
}

async function main() {
  const options = parseArgs();
  const manifest = await readJson(STATIC_MANIFEST);
  const entries = await loadUscisEntries(options);
  if (!entries.length) throw new Error('No USCIS forms selected');

  const previousByCode = new Map((manifest.forms || [])
    .filter((form) => form.agency === 'uscis')
    .map((form) => [normalizeCode(form.code), form]));

  await fsp.mkdir(PDF_DIR, { recursive: true });
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
  } catch {
    throw new Error('pdftotext is required for USCIS expiration tracking. Install poppler-utils (Linux) or poppler (macOS).');
  }

  const results = await runQueue(entries, (entry) => refreshEntry(entry, previousByCode.get(entry.code), options));
  const failed = results.filter((result) => result.error);
  if (failed.length) {
    console.error(`\nFailed USCIS refreshes: ${failed.map((result) => result.code).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const changedByCode = new Map();
  let pdfChangedCount = 0;
  let metadataChangedCount = 0;
  for (const result of results) {
    if (result.changed) {
      changedByCode.set(normalizeCode(result.record.code), result.record);
      if (result.pdfChanged) pdfChangedCount += 1;
      else metadataChangedCount += 1;
    }
  }

  if (!changedByCode.size) {
    console.log('\nUSCIS forms are already current; manifest unchanged.');
    return;
  }

  const forms = (manifest.forms || []).map((form) => {
    const replacement = changedByCode.get(normalizeCode(form.code));
    return replacement && form.agency === 'uscis' ? replacement : form;
  });

  const existingCodes = new Set(forms.map((form) => `${form.agency}:${normalizeCode(form.code)}`));
  for (const record of changedByCode.values()) {
    const key = `uscis:${normalizeCode(record.code)}`;
    if (!existingCodes.has(key)) forms.push(record);
  }

  forms.sort((a, b) => normalizeCode(a.code).localeCompare(normalizeCode(b.code)));
  const summary = forms.reduce((acc, form) => {
    acc[form.cacheStatus || 'unknown'] = (acc[form.cacheStatus || 'unknown'] || 0) + 1;
    return acc;
  }, {});
  const nextManifest = {
    ...manifest,
    generatedAt: new Date().toISOString(),
    uniqueForms: forms.length,
    summary,
    forms
  };
  const text = `${JSON.stringify(nextManifest, null, 2)}\n`;
  await fsp.writeFile(STATIC_MANIFEST, text);
  await fsp.writeFile(FUNCTIONS_MANIFEST, text);

  console.log(`\nUpdated USCIS records: ${changedByCode.size}`);
  console.log(`PDF updates: ${pdfChangedCount}`);
  console.log(`Metadata-only updates: ${metadataChangedCount}`);
  console.log(`Manifest: ${path.relative(ROOT, STATIC_MANIFEST)} and ${path.relative(ROOT, FUNCTIONS_MANIFEST)}`);
}

main().catch((error) => {
  console.error(`FATAL: ${error.stack || error.message}`);
  process.exit(1);
});
