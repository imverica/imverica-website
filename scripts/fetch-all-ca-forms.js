#!/usr/bin/env node
'use strict';

/**
 * Bulk-fetch statewide California Judicial Council forms.
 *
 * For each candidate code (scripts/ca-forms-master-codes.js):
 *   1. GET selfhelp.courts.ca.gov/jcc-form/<CODE>  (server-rendered)
 *      - 200  -> real form; scrape the official <title> + the PDF link
 *      - 404  -> not a form, skip
 *   2. Download the PDF (following the courts.ca.gov redirect), decrypt with
 *      qpdf into assets/form-cache/ca-court/<slug>.pdf, count fields.
 *   3. Record { code, slug, title, category, keywords, pdfUrl, fieldCount }.
 *
 * Outputs:
 *   assets/form-cache/ca-forms-catalog.json   (search/router catalog)
 *   assets/form-cache/ca-court/<slug>.pdf      (decrypted templates)
 *
 * Usage: node scripts/fetch-all-ca-forms.js [--limit N] [--no-download]
 */

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { buildCandidates } = require('./ca-forms-master-codes');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets/form-cache/pdfs');
const DECRYPTED_DIR = path.join(ROOT, 'assets/form-cache/ca-court');
const CATALOG_FILE = path.join(ROOT, 'assets/form-cache/ca-forms-catalog.json');
const UA = 'Imverica California court form indexer (+https://imverica.com)';
const CONCURRENCY = 5;

const args = process.argv.slice(2);
const LIMIT = (() => { const i = args.indexOf('--limit'); return i >= 0 ? Number(args[i + 1]) : Infinity; })();
const DOWNLOAD = !args.includes('--no-download');

let hasQpdf = false;
try { execFileSync('qpdf', ['--version'], { stdio: 'ignore' }); hasQpdf = true; } catch { /* fields stay null */ }

function stripTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return m[1].replace(/\s*\|\s*California Courts.*$/i, '').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}
function pdfLink(html) {
  const m = html.match(/href="(https?:\/\/[^"]*\/documents\/[a-z0-9]+\.pdf)"/i);
  return m ? m[1] : '';
}
async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' };
}
async function fetchBuffer(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`pdf ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('not a PDF');
  return buf;
}
function decryptCount(slug, srcBuf) {
  // returns { decBuf, fieldCount }
  const tmpIn = path.join(os.tmpdir(), `caf-in-${slug}-${process.pid}.pdf`);
  const tmpOut = path.join(os.tmpdir(), `caf-out-${slug}-${process.pid}.pdf`);
  try {
    fs.writeFileSync(tmpIn, srcBuf);
    let decBuf = srcBuf;
    if (hasQpdf) {
      try { execFileSync('qpdf', ['--decrypt', '--', tmpIn, tmpOut], { stdio: 'ignore' }); decBuf = fs.readFileSync(tmpOut); }
      catch { decBuf = srcBuf; } // already-unencrypted forms make qpdf exit non-zero
    }
    let fieldCount = null;
    try {
      const { PDFDocument } = require('pdf-lib');
      // sync-ish: pdf-lib is async; caller awaits via wrapper below
      return { decBuf, fieldCountPromise: PDFDocument.load(decBuf, { ignoreEncryption: true }).then((d) => d.getForm().getFields().length).catch(() => null) };
    } catch { return { decBuf, fieldCountPromise: Promise.resolve(null) }; }
  } finally {
    try { fs.rmSync(tmpIn, { force: true }); } catch {}
    try { fs.rmSync(tmpOut, { force: true }); } catch {}
  }
}

async function processOne(cand) {
  const page = await fetchText(`https://selfhelp.courts.ca.gov/jcc-form/${cand.code}`);
  if (!page.ok) return { ...cand, ok: false, status: page.status };
  const title = stripTitle(page.text);
  const url = pdfLink(page.text) || `https://www.courts.ca.gov/documents/${cand.slug.replace(/-/g, '')}.pdf`;
  const entry = { code: cand.code, slug: cand.slug, title, category: cand.category, categoryName: cand.categoryName, keywords: cand.keywords, pdfUrl: url, fieldCount: null };
  if (DOWNLOAD) {
    try {
      const decFile = path.join(DECRYPTED_DIR, `${cand.slug}.pdf`);
      const buf = await fetchBuffer(url);
      await fsp.mkdir(SOURCE_DIR, { recursive: true });
      await fsp.mkdir(DECRYPTED_DIR, { recursive: true });
      await fsp.writeFile(path.join(SOURCE_DIR, `${cand.slug}.pdf`), buf);
      const { decBuf, fieldCountPromise } = decryptCount(cand.slug, buf);
      await fsp.writeFile(decFile, decBuf);
      entry.fieldCount = await fieldCountPromise;
      entry.bytes = decBuf.length;
    } catch (e) { entry.downloadError = e.message; }
  }
  return { ...entry, ok: true };
}

async function runQueue(items, worker) {
  const out = new Array(items.length);
  let next = 0, done = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await worker(items[i]); } catch (e) { out[i] = { ...items[i], ok: false, error: e.message }; }
      done++;
      if (done % 25 === 0 || done === items.length) process.stdout.write(`\r  ${done}/${items.length} processed`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, runner));
  process.stdout.write('\n');
  return out;
}

async function main() {
  let candidates = buildCandidates();
  if (Number.isFinite(LIMIT)) candidates = candidates.slice(0, LIMIT);
  console.log(`Candidates: ${candidates.length} | download=${DOWNLOAD} | qpdf=${hasQpdf}`);
  const results = await runQueue(candidates, processOne);
  const found = results.filter((r) => r && r.ok);
  const missing = results.filter((r) => r && !r.ok);
  const dlErr = found.filter((r) => r.downloadError);
  // catalog sorted by category then code
  const catalog = found
    .map(({ ok, ...rest }) => rest)
    .sort((a, b) => (a.category === b.category ? a.code.localeCompare(b.code) : a.category.localeCompare(b.category)));
  await fsp.writeFile(CATALOG_FILE, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'selfhelp.courts.ca.gov + courts.ca.gov', formCount: catalog.length, forms: catalog }, null, 2)}\n`);
  console.log(`\nFound: ${found.length} | not-a-form(404): ${missing.length} | download errors: ${dlErr.length}`);
  console.log(`Catalog: ${path.relative(ROOT, CATALOG_FILE)} (${catalog.length} forms)`);
  if (dlErr.length) console.log('  download errors:', dlErr.slice(0, 10).map((r) => `${r.code}:${r.downloadError}`).join(', '));
  const byCat = {};
  for (const f of catalog) byCat[f.category] = (byCat[f.category] || 0) + 1;
  console.log('  by category:', JSON.stringify(byCat));
}

main().catch((e) => { console.error('FATAL', e.stack || e.message); process.exit(1); });
