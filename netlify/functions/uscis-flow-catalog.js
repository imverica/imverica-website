'use strict';

/**
 * Account-only USCIS wizard catalog.
 *
 * Lists USCIS forms that have all three pieces needed for cabinet generation:
 *  - an Imverica immigration flow schema,
 *  - a cached official USCIS PDF template,
 *  - a server-side PDF field map.
 */

const fs = require('fs');
const path = require('path');

const catalog = require('./forms/immigration.json');
const manifest = require('./form-cache-manifest.json');
const { sessionFromEvent } = require('./lib/session-auth');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

const MAP_DIR = path.join(__dirname, 'lib');
const PRIORITY = ['I-589', 'I-765', 'I-485', 'I-130', 'N-400', 'I-131', 'I-90', 'I-751', 'I-864', 'I-912'];

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body)
  };
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function compactCode(value) {
  return normalizeCode(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapFileName(code) {
  const compact = compactCode(code);
  const aliases = {
    g845supplement: 'g845s-pdf-map.js',
    i485supplementa: 'i485a-pdf-map.js',
    i485supplementj: 'i485j-pdf-map.js'
  };
  return aliases[compact] || `${compact}-pdf-map.js`;
}

function manifestForms() {
  const forms = manifest && manifest.forms;
  return Array.isArray(forms) ? forms : Object.values(forms || {});
}

function catalogByCode() {
  const byCode = new Map();
  (catalog.forms || []).forEach((form) => byCode.set(normalizeCode(form.code), form));
  return byCode;
}

function hasPdfMap(code) {
  const file = path.join(MAP_DIR, mapFileName(code));
  return file.startsWith(MAP_DIR) && fs.existsSync(file);
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  const session = sessionFromEvent(event);
  if (!session) return json(401, { ok: false, error: 'Not signed in' });

  const catalogIndex = catalogByCode();
  const forms = manifestForms()
    .filter((form) => form.agency === 'uscis')
    .map((form) => {
      const code = normalizeCode(form.code);
      const hasFlow = catalogIndex.has(code);
      const entry = catalogIndex.get(code) || {};
      const preparable = form.cacheStatus === 'cached' && hasPdfMap(code) && hasFlow;
      return {
        code,
        title: form.title || entry.names?.en || entry.name || code,
        description: entry.description || form.resolvedTitle || '',
        officialPageUrl: form.officialPageUrl || '',
        editionDate: form.editionDate || '',
        expirationDate: form.expirationDate || '',
        expirationStatus: form.expirationStatus || 'unknown',
        cacheStatus: form.cacheStatus || 'unknown',
        preparable,
        priority: PRIORITY.includes(code)
      };
    })
    .sort((a, b) => {
      const ap = PRIORITY.indexOf(a.code);
      const bp = PRIORITY.indexOf(b.code);
      if (ap !== -1 || bp !== -1) return (ap === -1 ? 999 : ap) - (bp === -1 ? 999 : bp);
      if (a.preparable !== b.preparable) return a.preparable ? -1 : 1;
      return a.code.localeCompare(b.code);
    });

  const counts = {
    total: forms.length,
    preparable: forms.filter((form) => form.preparable).length,
    cached: forms.filter((form) => form.cacheStatus === 'cached').length,
    current: forms.filter((form) => form.expirationStatus === 'current').length,
    expiresSoon: forms.filter((form) => form.expirationStatus === 'expires-soon').length,
    expired: forms.filter((form) => form.expirationStatus === 'expired').length,
    unknown: forms.filter((form) => !form.expirationStatus || form.expirationStatus === 'unknown').length
  };

  return json(200, {
    ok: true,
    generatedAt: manifest.generatedAt || '',
    source: manifest.source || 'USCIS official website',
    counts,
    forms
  }, {
    'Cache-Control': 'private, max-age=900'
  });
};
