const fs = require('fs');
const path = require('path');

let manifest;
let formsByCode;

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
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
  getCachedForm,
  loadManifest
};
