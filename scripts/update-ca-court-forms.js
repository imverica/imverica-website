#!/usr/bin/env node
'use strict';

/**
 * Refresh every California court PDF template used by the site.
 *
 * Sources are limited to the official California Courts websites. Each PDF is
 * downloaded into assets/form-cache/pdfs, decrypted with qpdf into
 * assets/form-cache/ca-court, validated, and recorded in a dedicated manifest.
 *
 * Usage:
 *   node scripts/update-ca-court-forms.js
 *   node scripts/update-ca-court-forms.js --codes SC-100,FL-150
 */

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const { listPreparableSmallClaimsSlugs } = require('../netlify/functions/lib/ca-small-claims-catalog');
const { listPreparableFamilyLawSlugs } = require('../netlify/functions/lib/ca-family-law-catalog');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets/form-cache/pdfs');
const DECRYPTED_DIR = path.join(ROOT, 'assets/form-cache/ca-court');
const MANIFEST_FILE = path.join(ROOT, 'assets/form-cache/ca-court-manifest.json');
const SELF_HELP_BASE = 'https://selfhelp.courts.ca.gov';
const COURTS_BASE = 'https://www.courts.ca.gov';
const USER_AGENT = 'Imverica California court form updater (+https://imverica.com)';
const CONCURRENCY = 4;

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function codeFromSlug(slug) {
  return String(slug).toUpperCase();
}

function directPdfUrl(slug) {
  return `${COURTS_BASE}/documents/${slug.replace(/[^a-z0-9]/g, '')}.pdf`;
}

function officialPageUrl(slug) {
  return `${SELF_HELP_BASE}/jcc-form/${encodeURIComponent(codeFromSlug(slug))}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const codeIndex = args.indexOf('--codes');
  const codes = codeIndex >= 0
    ? String(args[codeIndex + 1] || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
    : [];
  return { codes, forceDecrypt: args.includes('--force-decrypt') };
}

function listSiteCourtSlugs() {
  const existing = fs.readdirSync(DECRYPTED_DIR)
    .filter((file) => file.endsWith('.pdf'))
    .map((file) => file.slice(0, -4));
  return [...new Set([
    ...existing,
    ...listPreparableSmallClaimsSlugs(),
    ...listPreparableFamilyLawSlugs()
  ])].sort();
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

function pageMetadata(html, slug) {
  const text = stripTags(html);
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const effectiveMatch = text.match(/\bEffective:\s*([A-Z][a-z]+ \d{1,2}, \d{4})/i);
  const expectedName = `${slug.replace(/[^a-z0-9]/g, '')}.pdf`;
  const links = [...html.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)]
    .map((match) => {
      try { return new URL(match[1], SELF_HELP_BASE).href; } catch { return ''; }
    })
    .filter(Boolean);
  const pdfUrl = links.find((url) => url.toLowerCase().includes(expectedName)) || directPdfUrl(slug);
  return {
    title: titleMatch ? stripTags(titleMatch[1]) : codeFromSlug(slug),
    effectiveDate: effectiveMatch ? effectiveMatch[1] : '',
    pdfUrl
  };
}

async function fetchOfficial(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

async function resolveOfficial(slug) {
  const pageUrl = officialPageUrl(slug);
  try {
    const page = await fetchOfficial(pageUrl);
    const metadata = pageMetadata(await page.text(), slug);
    return { pageUrl: page.url || pageUrl, ...metadata };
  } catch (error) {
    return {
      pageUrl,
      title: codeFromSlug(slug),
      effectiveDate: '',
      pdfUrl: directPdfUrl(slug),
      pageWarning: error.message
    };
  }
}

async function downloadPdf(url) {
  const response = await fetchOfficial(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-' && !type.includes('pdf')) {
    throw new Error(`not a PDF (${type || 'unknown content type'})`);
  }
  return { buffer, finalUrl: response.url || url };
}

async function existingSha(file) {
  try { return sha256(await fsp.readFile(file)); } catch { return ''; }
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

async function decryptAndValidate(slug, sourceFile, decryptedFile) {
  const temporary = path.join(os.tmpdir(), `imverica-${slug}-${process.pid}.pdf`);
  try {
    execFileSync('qpdf', ['--decrypt', '--', sourceFile, temporary], { stdio: 'ignore' });
    execFileSync('qpdf', ['--check', temporary], { stdio: 'ignore' });
    const buffer = await fsp.readFile(temporary);
    const document = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const fieldCount = document.getForm().getFields().length;
    const changed = await writeIfChanged(decryptedFile, buffer);
    return { buffer, fieldCount, changed };
  } finally {
    await fsp.rm(temporary, { force: true });
  }
}

async function validateExistingDecrypted(decryptedFile) {
  execFileSync('qpdf', ['--check', decryptedFile], { stdio: 'ignore' });
  const buffer = await fsp.readFile(decryptedFile);
  const document = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return { buffer, fieldCount: document.getForm().getFields().length, changed: false };
}

async function refresh(slug, options) {
  const official = await resolveOfficial(slug);
  const sourceFile = path.join(SOURCE_DIR, `${slug}.pdf`);
  const decryptedFile = path.join(DECRYPTED_DIR, `${slug}.pdf`);
  const downloaded = await downloadPdf(official.pdfUrl);
  const sourceChanged = await writeIfChanged(sourceFile, downloaded.buffer);
  const decrypted = !sourceChanged && !options.forceDecrypt && fs.existsSync(decryptedFile)
    ? await validateExistingDecrypted(decryptedFile)
    : await decryptAndValidate(slug, sourceFile, decryptedFile);

  return {
    code: codeFromSlug(slug),
    slug,
    title: official.title,
    effectiveDate: official.effectiveDate,
    officialPageUrl: official.pageUrl,
    officialPdfUrl: downloaded.finalUrl,
    sourceFile: path.relative(ROOT, sourceFile),
    decryptedFile: path.relative(ROOT, decryptedFile),
    sourceBytes: downloaded.buffer.length,
    sourceSha256: sha256(downloaded.buffer),
    decryptedBytes: decrypted.buffer.length,
    decryptedSha256: sha256(decrypted.buffer),
    fieldCount: decrypted.fieldCount,
    sourceChanged,
    decryptedChanged: decrypted.changed,
    ...(official.pageWarning ? { pageWarning: official.pageWarning } : {})
  };
}

async function runQueue(items, worker) {
  const output = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const index = next++;
      const slug = items[index];
      process.stdout.write(`[${index + 1}/${items.length}] ${codeFromSlug(slug)} `);
      try {
        output[index] = await worker(slug);
        const result = output[index];
        console.log(`fields=${result.fieldCount} source=${result.sourceChanged ? 'updated' : 'same'} decrypted=${result.decryptedChanged ? 'updated' : 'same'}`);
      } catch (error) {
        output[index] = { code: codeFromSlug(slug), slug, error: error.message || String(error) };
        console.log(`FAILED ${output[index].error}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, runner));
  return output;
}

async function main() {
  try {
    execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
  } catch {
    throw new Error('qpdf is required. Install it with: brew install qpdf');
  }

  const options = parseArgs();
  let slugs = listSiteCourtSlugs();
  if (options.codes.length) {
    const requested = new Set(options.codes);
    slugs = slugs.filter((slug) => requested.has(slug) || requested.has(codeFromSlug(slug).toLowerCase()));
  }
  if (!slugs.length) throw new Error('No California court forms selected');

  const forms = await runQueue(slugs, (slug) => refresh(slug, options));
  const failed = forms.filter((form) => form.error);
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'Judicial Branch of California official websites',
    formCount: forms.length,
    updatedSourceCount: forms.filter((form) => form.sourceChanged).length,
    updatedDecryptedCount: forms.filter((form) => form.decryptedChanged).length,
    failedCount: failed.length,
    forms
  };
  await fsp.writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nManifest: ${path.relative(ROOT, MANIFEST_FILE)}`);
  console.log(`Forms: ${forms.length}, source updates: ${manifest.updatedSourceCount}, decrypted updates: ${manifest.updatedDecryptedCount}, failed: ${failed.length}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`FATAL: ${error.stack || error.message}`);
  process.exit(1);
});
