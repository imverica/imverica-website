#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FORMS_DIR = path.join(ROOT, 'netlify/functions/forms');
const STATIC_CACHE_DIR = path.join(ROOT, 'assets/form-cache');
const PDF_DIR = path.join(STATIC_CACHE_DIR, 'pdfs');
const FUNCTIONS_MANIFEST = path.join(ROOT, 'netlify/functions/form-cache-manifest.json');
const STATIC_MANIFEST = path.join(STATIC_CACHE_DIR, 'manifest.json');

const caForm = require(path.join(ROOT, 'netlify/functions/ca-form.js'));
const uscisForm = require(path.join(ROOT, 'netlify/functions/uscis-form.js'));

const DEFAULT_CONCURRENCY = 6;
const USER_AGENT = 'Imverica official form cache builder (+https://imverica.com)';
let previousByCode;

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function safeSlug(value) {
  return normalizeCode(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: 0,
    codes: new Set(),
    concurrency: DEFAULT_CONCURRENCY,
    force: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--limit') options.limit = Number(args[++i] || 0);
    else if (arg === '--concurrency') options.concurrency = Number(args[++i] || DEFAULT_CONCURRENCY);
    else if (arg === '--force') options.force = true;
    else if (arg === '--codes') {
      String(args[++i] || '').split(',').map(normalizeCode).filter(Boolean).forEach((code) => options.codes.add(code));
    }
  }

  return options;
}

async function loadPreviousManifest() {
  if (previousByCode) return previousByCode;

  previousByCode = new Map();
  try {
    const data = JSON.parse(await fs.readFile(FUNCTIONS_MANIFEST, 'utf8'));
    for (const form of data.forms || []) {
      previousByCode.set(normalizeCode(form.code), form);
    }
  } catch {}

  return previousByCode;
}

async function loadCatalog() {
  const byCode = new Map();
  const files = (await fs.readdir(FORMS_DIR)).filter((file) => file.endsWith('.json')).sort();

  for (const file of files) {
    const data = JSON.parse(await fs.readFile(path.join(FORMS_DIR, file), 'utf8'));
    const forms = Array.isArray(data.forms) ? data.forms : Array.isArray(data) ? data : [];
    const agency = file === 'immigration.json' ? 'uscis' : 'california-courts';
    const pane = data.subcategory_pane || path.basename(file, '.json');
    const category = data.category || '';

    for (const form of forms) {
      const code = normalizeCode(form.code);
      if (!code) continue;

      if (!byCode.has(code)) {
        byCode.set(code, {
          code,
          agency,
          title: form.names?.en || Object.values(form.names || {})[0] || code,
          category,
          panes: [],
          catalogFiles: [],
          subcategories: new Set()
        });
      }

      const entry = byCode.get(code);
      if (!entry.catalogFiles.includes(file)) entry.catalogFiles.push(file);
      if (!entry.panes.includes(pane)) entry.panes.push(pane);
      if (form.subcategory) entry.subcategories.add(form.subcategory);
      if (!entry.category && category) entry.category = category;
    }
  }

  return [...byCode.values()].map((entry) => ({
    ...entry,
    subcategories: [...entry.subcategories]
  })).sort((a, b) => a.code.localeCompare(b.code));
}

async function resolveForm(entry) {
  const handler = entry.agency === 'uscis' ? uscisForm.handler : caForm.handler;
  const res = await handler({
    httpMethod: 'GET',
    queryStringParameters: { code: entry.code }
  });

  let body = {};
  try {
    body = JSON.parse(res.body || '{}');
  } catch {}

  return {
    statusCode: res.statusCode,
    body
  };
}

async function downloadPdf(url, targetFile) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT
    }
  });

  if (!res.ok) throw new Error(`PDF download failed ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const signature = buffer.subarray(0, 5).toString('utf8');
  const type = String(res.headers.get('content-type') || '');

  if (signature !== '%PDF-' && !type.toLowerCase().includes('pdf')) {
    throw new Error(`Downloaded file is not a PDF (${type || 'unknown content type'})`);
  }

  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, buffer);

  return {
    bytes: buffer.length,
    sha256: sha256(buffer),
    contentType: type || 'application/pdf'
  };
}

async function existingPdfInfo(targetFile) {
  try {
    const buffer = await fs.readFile(targetFile);
    if (buffer.subarray(0, 5).toString('utf8') !== '%PDF-') return null;
    return {
      bytes: buffer.length,
      sha256: sha256(buffer),
      contentType: 'application/pdf'
    };
  } catch {
    return null;
  }
}

function buildBaseRecord(entry) {
  const slug = safeSlug(entry.code);
  return {
    code: entry.code,
    agency: entry.agency,
    title: entry.title,
    category: entry.category,
    panes: entry.panes,
    subcategories: entry.subcategories,
    catalogFiles: entry.catalogFiles,
    cachedFile: `assets/form-cache/pdfs/${slug}.pdf`,
    cachedPdfUrl: `/assets/form-cache/pdfs/${slug}.pdf`
  };
}

async function processEntry(entry) {
  const record = buildBaseRecord(entry);
  const targetFile = path.join(ROOT, record.cachedFile);
  const options = processEntry.options || {};

  try {
    const resolved = await resolveForm(entry);
    const body = resolved.body || {};
    const pdfUrl = body.pdfUrl || '';

    Object.assign(record, {
      officialStatusCode: resolved.statusCode,
      officialStatus: body.status || '',
      officialPdfUrl: pdfUrl,
      officialPageUrl: body.uscisPageUrl || body.officialPageUrl || body.selfHelpPageUrl || '',
      editionDate: body.editionDate || '',
      effectiveDate: body.effectiveDate || '',
      resolvedTitle: body.title || ''
    });

    if (!pdfUrl) {
      record.cacheStatus = 'not_found';
      record.error = body.error || 'No official PDF URL found';
      return record;
    }

    const previous = (await loadPreviousManifest()).get(entry.code);
    const existing = await existingPdfInfo(targetFile);
    const cacheLooksCurrent = previous
      && existing
      && previous.officialPdfUrl === pdfUrl
      && String(previous.editionDate || '') === String(record.editionDate || '')
      && String(previous.effectiveDate || '') === String(record.effectiveDate || '');
    const cached = !options.force && cacheLooksCurrent ? existing : await downloadPdf(pdfUrl, targetFile);
    Object.assign(record, cached, {
      cacheStatus: 'cached',
      cacheReused: !options.force && cacheLooksCurrent,
      cachedAt: new Date().toISOString()
    });
    return record;
  } catch (err) {
    record.cacheStatus = 'error';
    record.error = err.message || String(err);
    return record;
  }
}

async function runQueue(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function runWorker() {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      console.log(`[${index + 1}/${items.length}] ${item.code} ${item.agency}`);
      results[index] = await worker(item);
      console.log(`  -> ${results[index].cacheStatus}${results[index].bytes ? ` ${results[index].bytes} bytes` : ''}${results[index].error ? ` (${results[index].error})` : ''}`);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, runWorker));
  return results;
}

async function main() {
  const options = parseArgs();
  let catalog = await loadCatalog();
  const isPartialRefresh = options.codes.size > 0 || options.limit > 0;
  const totalCatalogRows = (await Promise.all((await fs.readdir(FORMS_DIR)).filter((file) => file.endsWith('.json')).map(async (file) => {
    const data = JSON.parse(await fs.readFile(path.join(FORMS_DIR, file), 'utf8'));
    return (Array.isArray(data.forms) ? data.forms : Array.isArray(data) ? data : []).length;
  }))).reduce((sum, count) => sum + count, 0);

  if (options.codes.size) catalog = catalog.filter((entry) => options.codes.has(entry.code));
  if (options.limit > 0) catalog = catalog.slice(0, options.limit);

  await fs.mkdir(PDF_DIR, { recursive: true });

  processEntry.options = options;
  const refreshedForms = await runQueue(catalog, options.concurrency, processEntry);
  let forms = refreshedForms;
  if (isPartialRefresh) {
    const refreshedCodes = new Set(refreshedForms.map((form) => normalizeCode(form.code)));
    const previousForms = [...(await loadPreviousManifest()).values()]
      .filter((form) => !refreshedCodes.has(normalizeCode(form.code)));
    forms = [...previousForms, ...refreshedForms].sort((a, b) => normalizeCode(a.code).localeCompare(normalizeCode(b.code)));
  }

  const generatedAt = new Date().toISOString();
  const summary = forms.reduce((acc, form) => {
    acc[form.cacheStatus] = (acc[form.cacheStatus] || 0) + 1;
    return acc;
  }, {});

  const manifest = {
    generatedAt,
    source: 'USCIS and Judicial Branch of California official websites',
    totalCatalogRows,
    uniqueForms: forms.length,
    summary,
    forms
  };

  await fs.mkdir(path.dirname(FUNCTIONS_MANIFEST), { recursive: true });
  await fs.mkdir(path.dirname(STATIC_MANIFEST), { recursive: true });
  await fs.writeFile(FUNCTIONS_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(STATIC_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Manifest written: ${FUNCTIONS_MANIFEST}`);
  console.log(`Static manifest written: ${STATIC_MANIFEST}`);
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
