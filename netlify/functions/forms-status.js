/**
 * Official form cache status for the personal account dashboard.
 *
 * The full manifest stays server-side. The browser receives only aggregate
 * counts and a short "needs attention" list for USCIS expiration monitoring.
 */

const manifest = require('./form-cache-manifest.json');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function manifestForms() {
  const forms = manifest && manifest.forms;
  return Array.isArray(forms) ? forms : Object.values(forms || {});
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  const uscisForms = manifestForms().filter((form) => form.agency === 'uscis');
  const counts = {
    total: uscisForms.length,
    cached: uscisForms.filter((form) => form.cacheStatus === 'cached').length,
    current: uscisForms.filter((form) => form.expirationStatus === 'current').length,
    expiresSoon: uscisForms.filter((form) => form.expirationStatus === 'expires-soon').length,
    expired: uscisForms.filter((form) => form.expirationStatus === 'expired').length,
    unknown: uscisForms.filter((form) => !form.expirationStatus || form.expirationStatus === 'unknown').length
  };
  const urgent = uscisForms
    .filter((form) => form.expirationStatus === 'expired' || form.expirationStatus === 'expires-soon')
    .sort((a, b) => String(a.expirationDateIso || '').localeCompare(String(b.expirationDateIso || '')))
    .slice(0, 8)
    .map((form) => ({
      code: form.code,
      title: form.title || form.resolvedTitle || '',
      expirationDate: form.expirationDate || '',
      expirationStatus: form.expirationStatus || 'unknown',
      officialPageUrl: form.officialPageUrl || ''
    }));

  return json(200, {
    ok: true,
    generatedAt: manifest.generatedAt || '',
    source: manifest.source || '',
    uscis: { counts, urgent }
  });
};
