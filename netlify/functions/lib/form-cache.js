const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const path = require('path');

let manifest;
let formsByCode;

const ROOT = path.resolve(__dirname, '..', '..', '..');
const STATIC_MANIFEST = path.join(ROOT, 'assets/form-cache/manifest.json');
const FUNCTIONS_MANIFEST = path.join(ROOT, 'netlify/functions/form-cache-manifest.json');
const USER_AGENT = 'Imverica official form cache refresher (+https://imverica.com)';

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function safeSlug(value) {
  return normalizeCode(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function loadManifest() {
  if (manifest) return manifest;

  const manifestPath = path.join(__dirname, '..', 'form-cache-manifest.json');
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    manifest = { forms: [] };
  }

  formsByCode = new Map();
  for (const form of manifest.forms || []) {
    if (form.cacheStatus === 'cached' && form.cachedPdfUrl) {
      formsByCode.set(normalizeCode(form.code), form);
    }
  }

  return manifest;
}

function getCachedForm(code, agency) {
  loadManifest();
  const form = formsByCode.get(normalizeCode(code));
  if (!form) return null;
  if (agency && form.agency !== agency) return null;
  return form;
}

function cachedFields(code, agency) {
  const cached = getCachedForm(code, agency);
  if (!cached) return {};

  return {
    cachedPdfUrl: cached.cachedPdfUrl,
    cachedAt: cached.cachedAt,
    cachedBytes: cached.bytes,
    cachedSha256: cached.sha256,
    cacheSource: 'Imverica cached official PDF fallback'
  };
}

function normalizeDate(value) {
  return String(value || '').trim().toLowerCase();
}

function cacheFreshness(cached, official = {}) {
  if (!official.officialPdfUrl) {
    return {
      cacheStatus: cached ? 'cache-available-official-pdf-missing' : 'cache-missing-official-pdf-missing',
      cacheNeedsRefresh: false,
      cacheCheckedAgainstOfficial: Boolean(official.checkedAt)
    };
  }

  if (!cached) {
    return {
      cacheStatus: 'cache-missing-refresh-needed',
      cacheNeedsRefresh: true,
      cacheCheckedAgainstOfficial: true,
      cacheRefreshReason: 'Official PDF exists but no cached copy exists.'
    };
  }

  const reasons = [];
  if (cached.officialPdfUrl && cached.officialPdfUrl !== official.officialPdfUrl) {
    reasons.push('official PDF URL changed');
  }
  if (official.editionDate && normalizeDate(cached.editionDate) !== normalizeDate(official.editionDate)) {
    reasons.push('USCIS edition date changed');
  }
  if (official.effectiveDate && normalizeDate(cached.effectiveDate) !== normalizeDate(official.effectiveDate)) {
    reasons.push('California effective date changed');
  }

  return {
    cacheStatus: reasons.length ? 'cache-needs-refresh' : 'cache-current',
    cacheNeedsRefresh: reasons.length > 0,
    cacheCheckedAgainstOfficial: true,
    cacheRefreshReason: reasons.join('; ')
  };
}

async function downloadPdf(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT }
  });

  if (!res.ok) throw new Error(`PDF download failed ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const type = String(res.headers.get('content-type') || '');
  if (buffer.subarray(0, 5).toString('utf8') !== '%PDF-' && !type.toLowerCase().includes('pdf')) {
    throw new Error(`Downloaded file is not a PDF (${type || 'unknown content type'})`);
  }

  return {
    buffer,
    bytes: buffer.length,
    sha256: sha256(buffer),
    contentType: type || 'application/pdf'
  };
}

async function writeManifest(nextManifest) {
  const text = `${JSON.stringify(nextManifest, null, 2)}\n`;
  await fsp.mkdir(path.dirname(FUNCTIONS_MANIFEST), { recursive: true });
  await fsp.mkdir(path.dirname(STATIC_MANIFEST), { recursive: true });
  await fsp.writeFile(FUNCTIONS_MANIFEST, text);
  await fsp.writeFile(STATIC_MANIFEST, text);
}

function rebuildIndex(nextManifest) {
  manifest = nextManifest;
  formsByCode = new Map();
  for (const form of manifest.forms || []) {
    if (form.cacheStatus === 'cached' && form.cachedPdfUrl) {
      formsByCode.set(normalizeCode(form.code), form);
    }
  }
}

async function refreshCachedFormIfNeeded(code, agency, official = {}) {
  loadManifest();
  const cached = getCachedForm(code, agency);
  const freshness = cacheFreshness(cached, official);
  const refreshCommand = `node scripts/cache-official-forms.js --codes ${normalizeCode(code)} --force`;

  const base = {
    ...cachedFields(code, agency),
    ...freshness,
    cacheRefreshCommand: refreshCommand
  };

  if (!freshness.cacheNeedsRefresh || !official.officialPdfUrl) return base;

  try {
    const downloaded = await downloadPdf(official.officialPdfUrl);
    const slug = safeSlug(code);
    const cachedFile = `assets/form-cache/pdfs/${slug}.pdf`;
    const cachedPdfUrl = `/assets/form-cache/pdfs/${slug}.pdf`;
    const targetFile = path.join(ROOT, cachedFile);
    await fsp.mkdir(path.dirname(targetFile), { recursive: true });
    await fsp.writeFile(targetFile, downloaded.buffer);

    const forms = Array.isArray(manifest.forms) ? [...manifest.forms] : [];
    const index = forms.findIndex((form) => normalizeCode(form.code) === normalizeCode(code) && (!agency || form.agency === agency));
    const nextRecord = {
      ...(index >= 0 ? forms[index] : {}),
      code: normalizeCode(code),
      agency,
      title: official.title || cached?.title || normalizeCode(code),
      resolvedTitle: official.title || cached?.resolvedTitle || cached?.title || '',
      category: official.category || cached?.category || '',
      pane: official.pane || cached?.pane || '',
      subcategory: official.subcategory || cached?.subcategory || '',
      cachedFile,
      cachedPdfUrl,
      officialStatusCode: 200,
      officialStatus: official.status || '',
      officialPdfUrl: official.officialPdfUrl,
      officialPageUrl: official.officialPageUrl || official.pageUrl || cached?.officialPageUrl || '',
      editionDate: official.editionDate || '',
      effectiveDate: official.effectiveDate || '',
      bytes: downloaded.bytes,
      sha256: downloaded.sha256,
      contentType: downloaded.contentType,
      cacheStatus: 'cached',
      cachedAt: new Date().toISOString()
    };

    if (index >= 0) forms[index] = nextRecord;
    else forms.push(nextRecord);

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

    await writeManifest(nextManifest);
    rebuildIndex(nextManifest);

    return {
      ...cachedFields(code, agency),
      cacheStatus: 'cache-refreshed',
      cacheNeedsRefresh: false,
      cacheCheckedAgainstOfficial: true,
      cacheRefreshReason: freshness.cacheRefreshReason,
      cacheRefreshCommand: refreshCommand,
      cacheRefreshedAt: nextRecord.cachedAt
    };
  } catch (err) {
    return {
      ...base,
      cacheRefreshStatus: 'refresh-failed',
      cacheRefreshError: err.message || String(err),
      note: 'Official PDF is still returned. Refresh the repo cache with the cacheRefreshCommand when the runtime filesystem cannot be updated.'
    };
  }
}

function cachedFallbackBody(code, agency, extra = {}) {
  const cached = getCachedForm(code, agency);
  if (!cached) return null;

  return {
    ...extra,
    code: cached.code,
    title: cached.resolvedTitle || cached.title || cached.code,
    pdfUrl: cached.cachedPdfUrl,
    cachedPdfUrl: cached.cachedPdfUrl,
    originalOfficialPdfUrl: cached.officialPdfUrl,
    officialPageUrl: cached.officialPageUrl || extra.officialPageUrl || '',
    editionDate: cached.editionDate || '',
    effectiveDate: cached.effectiveDate || '',
    checkedAt: new Date().toISOString(),
    cachedAt: cached.cachedAt,
    cachedBytes: cached.bytes,
    cachedSha256: cached.sha256,
    status: 'cached-fallback',
    source: 'Imverica cached copy of official PDF',
    note: 'The official source was unavailable, so Imverica is using a cached copy previously downloaded from the official source. Verify freshness before filing.',
    disclaimer: 'Document preparation only. Imverica is not a law firm or attorney and does not provide legal advice.'
  };
}

module.exports = {
  cachedFallbackBody,
  cachedFields,
  cacheFreshness,
  refreshCachedFormIfNeeded,
  getCachedForm,
  loadManifest
};
