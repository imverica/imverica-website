#!/usr/bin/env node
'use strict';

/**
 * Index and refresh county-specific California Superior Court forms.
 *
 * Only PDFs linked from an official court source page are considered. Exact
 * Judicial Council form codes are excluded because they belong to the existing
 * statewide catalog. Fillable local PDFs are decrypted, validated, and cached;
 * non-fillable documents remain searchable reference entries in the manifest.
 */

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const SOURCES = require('./ca-local-court-sources');
const STATEWIDE = require('../assets/form-cache/ca-forms-catalog.json');
const { getDirectCourtSchema } = require('../netlify/functions/lib/ca-court-direct-schema');

const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'assets/form-cache/ca-local-court');
const PUBLIC_DIR = path.join(ROOT, 'astro-site/public/ca-local-templates');
const MANIFEST_FILE = path.join(ROOT, 'assets/form-cache/ca-local-court-manifest.json');
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0 Safari/537.36 ImvericaFormMonitor/1.0';
const STATEWIDE_CODES = new Set((STATEWIDE.forms || []).map((form) => String(form.code || '').toUpperCase()));
const PAGE_LIMIT = 40;

const originalWarn = console.warn;
console.warn = (...args) => {
  const message = String(args[0] || '');
  if (/Removing XFA form data|Parsed number that is too large/i.test(message)) return;
  originalWarn(...args);
};

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function countySlug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function cleanText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function safeUrl(value, base) {
  try {
    const url = new URL(String(value || '').replace(/&amp;/g, '&'), base);
    if (!/^https?:$/.test(url.protocol)) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function anchors(html, baseUrl) {
  return [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    url: safeUrl(match[1], baseUrl),
    text: cleanText(match[2]),
    index: match.index || 0
  })).filter((link) => link.url);
}

function headingBefore(html, index) {
  const prefix = html.slice(Math.max(0, index - 6000), index);
  const matches = [...prefix.matchAll(/<h([2-5])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  return matches.length ? cleanText(matches[matches.length - 1][2]).slice(0, 120) : '';
}

function blockText(html, index, fallback) {
  for (const tag of ['tr', 'li']) {
    const start = html.lastIndexOf(`<${tag}`, index);
    const end = html.indexOf(`</${tag}>`, index);
    if (start >= 0 && end > index && end - start < 5000) {
      const text = cleanText(html.slice(start, end));
      if (text) return text.slice(0, 300);
    }
  }
  return String(fallback || '').slice(0, 300);
}

function sameCourtHost(url, sourceUrl) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, '');
  return host === sourceHost || host.endsWith(`.${sourceHost}`) || sourceHost.endsWith(`.${host}`);
}

function looksLikePdf(link) {
  return /\.pdf(?:$|[?#&])/i.test(link.url) ||
    /\b(?:view|download|open)\s+(?:the\s+)?pdf\b/i.test(link.text);
}

function shouldFollow(link, sourceUrl, depth) {
  if (depth >= 2 || looksLikePdf(link) || !sameCourtHost(link.url, sourceUrl)) return false;
  const value = `${link.text} ${link.url}`;
  if (/judicial\s+council|statewide|fee\s+schedule|bail|local\s+rules/i.test(value)) return false;
  if (depth === 0 && /\/(?:divisions?|self-help)\/(?:civil|criminal|family|juvenile|probate|small-claims|traffic|restraining|landlord|tenant)|language-access/i.test(value)) return true;
  return /local.{0,12}form|form.{0,12}packet|court.{0,12}form|forms?[-_/ ](?:filing|fees)|\/forms(?:\/|$)/i.test(value);
}

function formCode(title, url) {
  const filename = decodeURIComponent(new URL(url).pathname.split('/').pop() || '').replace(/\.pdf$/i, ' ');
  const candidates = `${title} ${filename}`.toUpperCase().match(/\b[A-Z]{1,10}(?:-[A-Z]{1,8})?[- ]?\d{1,6}(?:\.\d+)?[A-Z]?(?:-[A-Z0-9]+)*\b/g) || [];
  const ignored = /^(?:REV|FORM|PAGE|LOCAL|DATED?|UPDATED?|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|COVID|AB|CCP)[- ]?\d/;
  const ranked = candidates.filter((value) => !ignored.test(value)).map((value, index) => {
    const normalized = value.replace(/\s+/g, '-').replace(/--+/g, '-');
    const prefix = normalized.split('-')[0];
    const score = (/-[A-Z]+\d/.test(normalized) ? 20 : 0) + (prefix.length >= 4 ? 10 : 0) + (normalized.includes('-') ? 3 : 0) + index / 100;
    return { normalized, score };
  }).sort((a, b) => b.score - a.score);
  const code = ranked[0] && ranked[0].normalized;
  return code ? code.replace(/\s+/g, '-').replace(/--+/g, '-') : `LOCAL-${sha256(Buffer.from(url)).slice(0, 8).toUpperCase()}`;
}

function formSlug(code, url) {
  const base = String(code).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'local-form';
  return `${base}-${sha256(Buffer.from(url)).slice(0, 8)}`;
}

function excludedDocument(title) {
  return /\bfee\s+schedule\b|\bbail\b.{0,30}\bschedule\b|\blocal\s+rules?\b|\bstanding\s+order\b|\bannual\s+report\b|\bprivacy\s+policy\b|access the list of judicial council forms/i.test(title);
}

const STATEWIDE_PREFIXES = new Set([...STATEWIDE_CODES].map((code) => code.split('-')[0]));
const statewideLookup = new Map();
async function isOfficialStatewideCode(code, pdfUrl) {
  if (STATEWIDE_CODES.has(code)) return true;
  const pdfHost = new URL(pdfUrl).hostname.toLowerCase();
  if (pdfHost === 'courts.ca.gov' || pdfHost === 'www.courts.ca.gov' || pdfHost === 'selfhelp.courts.ca.gov') return true;
  const prefix = code.split('-')[0];
  if (!STATEWIDE_PREFIXES.has(prefix) || !/^[A-Z]{1,4}-\d{2,4}[A-Z]?$/.test(code)) return false;
  if (!statewideLookup.has(code)) {
    statewideLookup.set(code, (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(`https://selfhelp.courts.ca.gov/jcc-form/${encodeURIComponent(code)}`, {
          redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': USER_AGENT }
        });
        clearTimeout(timer);
        if (!response.ok) return false;
        const html = await response.text();
        return new RegExp(`\\(${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'i').test(html) || html.includes(`>${code}<`);
      } catch { return false; }
    })());
  }
  return statewideLookup.get(code);
}

function categoryFromTitle(title, fallback) {
  const match = String(title).match(/^(Courtwide|Civil(?:\/Small Claims)?|Small Claims|Family Law|Probate|Criminal|Juvenile(?: Dependency| Justice)?|Traffic|Appellate|Adoption)\b/i);
  return match ? match[1] : fallback;
}

async function fetchWithRetry(url, asBuffer = false, referer = '', extraHeaders = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let timer;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
          ...(referer ? { Referer: referer } : {}),
          Accept: asBuffer ? 'application/pdf,*/*;q=0.8' : 'text/html,*/*;q=0.8',
          ...extraHeaders
        }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return {
        url: response.url || url,
        type: String(response.headers.get('content-type') || ''),
        body: asBuffer ? Buffer.from(await response.arrayBuffer()) : await response.text()
      };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    const args = ['-fsSL', '--compressed', '--max-time', '45', '-A', USER_AGENT, ...(referer ? ['-e', referer] : []), url];
    const body = execFileSync('curl', args, { maxBuffer: asBuffer ? 100 * 1024 * 1024 : 20 * 1024 * 1024 });
    return { url, type: asBuffer ? 'application/octet-stream' : 'text/html', body: asBuffer ? body : body.toString('utf8') };
  } catch {
    throw lastError;
  }
}

async function discoverLosAngeles(source) {
  const remoteEntryUrl = 'https://www.lacourt.ca.gov/pubweb3-cmpts/remoteEntry.js';
  const remoteEntry = await fetchWithRetry(remoteEntryUrl);
  const chunkMatch = remoteEntry.body.match(/228:\"?([a-f0-9]{16})\"?/i);
  if (!chunkMatch) throw new Error('Los Angeles forms component chunk was not found');
  const component = await fetchWithRetry(`https://www.lacourt.ca.gov/pubweb3-cmpts/228.${chunkMatch[1]}.js`);
  const endpointMatch = component.body.match(/https:\/\/lasc-wg-apim\.azure-api\.net\/sws\/v1\/lascstorage\/form\/files/);
  const keyMatch = component.body.match(/Ocp-Apim-Subscription-Key["']?:["']([a-f0-9]+)["']/i);
  if (!endpointMatch || !keyMatch) throw new Error('Los Angeles official forms API configuration was not found');
  const response = await fetchWithRetry(`${endpointMatch[0]}?litigationType=`, false, source.sourceUrl, {
    'Ocp-Apim-Subscription-Key': keyMatch[1],
    Accept: 'application/json'
  });
  const payload = JSON.parse(response.body);
  const rows = Array.isArray(payload.result) ? payload.result : [];
  return {
    pagesScanned: 2,
    errors: [],
    candidates: rows.filter((row) => row && row.blobUrl).map((row) => ({
      title: String(row.title || row.name || 'Los Angeles local court form').trim(),
      category: String(row.properties && row.properties.litigationType || 'Los Angeles local form').trim(),
      linkText: String(row.title || row.name || ''),
      sourcePageUrl: source.sourceUrl,
      officialPdfUrl: row.blobUrl,
      providedCode: String(row.name || '').replace(/\.pdf$/i, '').trim(),
      declaredFillable: row.properties && row.properties.fillable === 'Fillable',
      revisionDate: row.properties && row.properties.revisionDate || ''
    }))
  };
}

async function discoverCounty(source) {
  if (source.adapter === 'los-angeles-api') return discoverLosAngeles(source);
  const queue = [{ url: source.sourceUrl, depth: 0 }];
  const visited = new Set();
  const candidates = new Map();
  const errors = [];

  while (queue.length && visited.size < PAGE_LIMIT) {
    const current = queue.shift();
    if (visited.has(current.url)) continue;
    visited.add(current.url);
    let page;
    try { page = await fetchWithRetry(current.url); }
    catch (error) { errors.push(`${current.url}: ${error.message}`); continue; }

    for (const link of anchors(page.body, page.url)) {
      if (looksLikePdf(link)) {
        const title = blockText(page.body, link.index, link.text || 'Local court form');
        if (!excludedDocument(title)) {
          candidates.set(link.url, {
            title,
            category: categoryFromTitle(title, headingBefore(page.body, link.index)),
            linkText: link.text,
            sourcePageUrl: page.url,
            officialPdfUrl: link.url
          });
        }
      } else if (shouldFollow(link, source.sourceUrl, current.depth)) {
        queue.push({ url: link.url, depth: current.depth + 1 });
      }
    }
  }

  return { candidates: [...candidates.values()], pagesScanned: visited.size, errors };
}

async function decryptPdf(buffer, key) {
  const sourceFile = path.join(os.tmpdir(), `imverica-local-${key}-${process.pid}-source.pdf`);
  const outputFile = path.join(os.tmpdir(), `imverica-local-${key}-${process.pid}.pdf`);
  try {
    await fsp.writeFile(sourceFile, buffer);
    try { execFileSync('qpdf', ['--decrypt', '--', sourceFile, outputFile], { stdio: 'ignore' }); }
    catch { await fsp.copyFile(sourceFile, outputFile); }
    execFileSync('qpdf', ['--check', outputFile], { stdio: 'ignore' });
    return await fsp.readFile(outputFile);
  } finally {
    await Promise.all([fsp.rm(sourceFile, { force: true }), fsp.rm(outputFile, { force: true })]);
  }
}

async function writeIfChanged(file, buffer) {
  let previous = '';
  try { previous = sha256(await fsp.readFile(file)); } catch {}
  const next = sha256(buffer);
  if (previous === next) return false;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, buffer);
  return true;
}

async function inspectCandidate(source, candidate) {
  const downloaded = await fetchWithRetry(candidate.officialPdfUrl, true, candidate.sourcePageUrl);
  if (downloaded.body.subarray(0, 5).toString('latin1') !== '%PDF-' && !/pdf/i.test(downloaded.type)) {
    throw new Error(`not a PDF (${downloaded.type || 'unknown type'})`);
  }
  const code = candidate.providedCode
    ? candidate.providedCode.toUpperCase().replace(/\s+/g, '-').replace(/--+/g, '-')
    : formCode(candidate.title, downloaded.url);
  if (await isOfficialStatewideCode(code, downloaded.url)) return null;
  const slug = formSlug(code, downloaded.url);
  const county = source.county;
  const countyKey = countySlug(county);
  const decrypted = await decryptPdf(downloaded.body, `${countyKey}-${slug}`);
  const document = await PDFDocument.load(decrypted, { ignoreEncryption: true });
  const rawFieldCount = document.getForm().getFields().length;
  let sourceSchema = null;
  try {
    sourceSchema = await getDirectCourtSchema(slug, candidate.title, {
      cacheKey: `local-source:${countyKey}:${slug}`,
      loadTemplate: async () => downloaded.body
    });
  } catch {}
  let schema = null;
  let processingWarning = '';
  if (rawFieldCount) {
    try {
      schema = await getDirectCourtSchema(slug, candidate.title, {
        cacheKey: `local-updater:${countyKey}:${slug}`,
        loadTemplate: async () => decrypted
      });
    } catch (error) {
      processingWarning = error.message || String(error);
    }
  }
  const fieldCount = schema ? schema.fieldCount : 0;
  const sourceRuntimeCompatible = Boolean(fieldCount && sourceSchema && sourceSchema.fieldCount === fieldCount);
  const role = fieldCount > 0 ? 'prepare' : 'info';
  let changed = false;
  if (role === 'prepare') {
    const cacheFile = path.join(CACHE_DIR, countyKey, `${slug}.pdf`);
    const publicFile = path.join(PUBLIC_DIR, countyKey, `${slug}.pdf`);
    changed = (await writeIfChanged(cacheFile, decrypted)) || changed;
    changed = (await writeIfChanged(publicFile, decrypted)) || changed;
  }
  return {
    id: `${countyKey}:${slug}`,
    county,
    countySlug: countyKey,
    scope: 'local',
    code,
    slug,
    title: candidate.title || code,
    category: candidate.category || 'Local court form',
    language: /spanish|espa[nñ]ol/i.test(candidate.linkText) ? 'Spanish' : (/russian|рус/i.test(candidate.linkText) ? 'Russian' : 'English'),
    role,
    description: role === 'prepare'
      ? `${county} County local court form.`
      : 'Official local document without client-fillable PDF fields.',
    sourcePageUrl: candidate.sourcePageUrl,
    officialPageUrl: candidate.sourcePageUrl,
    officialPdfUrl: downloaded.url,
    sourceSha256: sha256(downloaded.body),
    templateSha256: sha256(decrypted),
    sourceBytes: downloaded.body.length,
    fieldCount,
    rawFieldCount,
    sourceRuntimeCompatible,
    ...(candidate.revisionDate ? { revisionDate: candidate.revisionDate } : {}),
    cachedTemplate: role === 'prepare' ? `ca-local-templates/${countyKey}/${slug}.pdf` : null,
    ...(processingWarning ? { processingWarning } : {}),
    changed
  };
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const index = next++;
      try { output[index] = await worker(items[index], index); }
      catch (error) { output[index] = { error: error.message || String(error), item: items[index] }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, runner));
  return output;
}

async function removeStaleCountyTemplates(countyKey, forms) {
  const keep = new Set(forms.filter((form) => form.role === 'prepare').map((form) => `${form.slug}.pdf`));
  for (const root of [CACHE_DIR, PUBLIC_DIR]) {
    const dir = path.join(root, countyKey);
    let files = [];
    try { files = await fsp.readdir(dir); } catch { continue; }
    for (const file of files) if (file.endsWith('.pdf') && !keep.has(file)) await fsp.rm(path.join(dir, file), { force: true });
  }
}

async function main() {
  execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
  const requestedIndex = process.argv.indexOf('--counties');
  const requested = requestedIndex >= 0
    ? new Set(String(process.argv[requestedIndex + 1] || '').split(',').map(countySlug).filter(Boolean))
    : null;
  const selected = requested ? SOURCES.filter((source) => requested.has(countySlug(source.county))) : SOURCES;
  const previous = (() => { try { return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')); } catch { return { forms: [] }; } })();
  const previousByCounty = new Map();
  for (const form of previous.forms || []) {
    if (!previousByCounty.has(form.countySlug)) previousByCounty.set(form.countySlug, []);
    previousByCounty.get(form.countySlug).push(form);
  }

  const processed = await mapLimit(selected, 3, async (source, index) => {
    const key = countySlug(source.county);
    process.stdout.write(`[${index + 1}/${selected.length}] ${source.county}: `);
    const discovery = await discoverCounty(source);
    const inspected = await mapLimit(discovery.candidates, 4, (candidate) => inspectCandidate(source, candidate));
    const valid = inspected.filter((result) => result && !result.error);
    const failures = inspected.filter((result) => result && result.error);
    const unique = [...new Map(valid.map((form) => [`${form.countySlug}:${form.sourceSha256}`, form])).values()];
    await removeStaleCountyTemplates(key, unique);
    const countyResult = {
      county: source.county,
      countySlug: key,
      sourceUrl: source.sourceUrl,
      pagesScanned: discovery.pagesScanned,
      candidateCount: discovery.candidates.length,
      formCount: unique.length,
      preparableCount: unique.filter((form) => form.role === 'prepare').length,
      referenceCount: unique.filter((form) => form.role !== 'prepare').length,
      errorCount: discovery.errors.length + failures.length,
      errors: [...discovery.errors, ...failures.map((failure) => `${failure.item.officialPdfUrl}: ${failure.error}`)].slice(0, 20)
    };
    console.log(`${unique.length} forms, ${unique.filter((form) => form.role === 'prepare').length} fillable, ${failures.length + discovery.errors.length} errors`);
    return { countyResult, forms: unique };
  });

  const countyResults = processed.filter((item) => item && !item.error).map((item) => item.countyResult);
  const forms = processed.filter((item) => item && !item.error).flatMap((item) => item.forms);
  for (const failure of processed.filter((item) => item && item.error)) {
    const source = failure.item;
    countyResults.push({
      county: source.county,
      countySlug: countySlug(source.county),
      sourceUrl: source.sourceUrl,
      pagesScanned: 0,
      candidateCount: 0,
      formCount: 0,
      preparableCount: 0,
      referenceCount: 0,
      errorCount: 1,
      errors: [failure.error]
    });
  }

  if (requested) {
    const selectedKeys = new Set(selected.map((source) => countySlug(source.county)));
    for (const [key, oldForms] of previousByCounty) if (!selectedKeys.has(key)) forms.push(...oldForms);
    const oldCounties = (previous.counties || []).filter((county) => !selectedKeys.has(county.countySlug));
    countyResults.push(...oldCounties);
  }

  forms.sort((a, b) => a.county.localeCompare(b.county) || a.code.localeCompare(b.code) || a.title.localeCompare(b.title));
  countyResults.sort((a, b) => a.county.localeCompare(b.county));
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'Official California Superior Court websites',
    countyCount: SOURCES.length,
    scannedCountyCount: selected.length,
    formCount: forms.length,
    preparableCount: forms.filter((form) => form.role === 'prepare').length,
    referenceCount: forms.filter((form) => form.role !== 'prepare').length,
    changedTemplateCount: forms.filter((form) => form.changed).length,
    counties: countyResults,
    forms: forms.map(({ changed: _changed, ...form }) => form)
  };
  await fsp.writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nLocal forms: ${manifest.formCount}; fillable: ${manifest.preparableCount}; reference: ${manifest.referenceCount}; changed: ${manifest.changedTemplateCount}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
