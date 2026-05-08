const catalog = require('./forms/immigration.json');
const uscisForm = require('./uscis-form');
const { buildImmigrationFlow, localizeFlow, normalizeCode } = require('./lib/immigration-flow-schema');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function catalogEntry(code) {
  return (catalog.forms || []).find((form) => normalizeCode(form.code) === code);
}

async function officialLookup(code) {
  const response = await uscisForm.handler({
    httpMethod: 'GET',
    queryStringParameters: { code },
    headers: {}
  });

  let body = {};
  try {
    body = JSON.parse(response.body || '{}');
  } catch {
    body = {};
  }

  return {
    statusCode: response.statusCode,
    body
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  const code = normalizeCode(event.queryStringParameters?.code);
  const lang = String(event.queryStringParameters?.lang || 'en').toLowerCase();
  if (!code) return json(400, { ok: false, error: 'Missing immigration form code' });

  const entry = catalogEntry(code);
  if (!entry) {
    return json(404, {
      ok: false,
      error: 'Immigration form is not in the Imverica catalog',
      code
    });
  }

  try {
    const official = await officialLookup(code);
    const flow = localizeFlow(buildImmigrationFlow(code, entry, official.body || {}), lang);

    return json(200, {
      ok: true,
      ...flow,
      officialLookupStatusCode: official.statusCode
    }, {
      'Cache-Control': 'public, max-age=900'
    });
  } catch (err) {
    console.error('Could not build immigration flow:', err);
    const flow = localizeFlow(buildImmigrationFlow(code, entry, {
      title: entry.names?.en || code,
      status: 'official-lookup-failed',
      checkedAt: new Date().toISOString()
    }), lang);

    return json(200, {
      ok: true,
      ...flow,
      officialLookupStatusCode: 500,
      warning: 'Official USCIS lookup failed; using catalog schema and cached fallback data if available.'
    }, {
      'Cache-Control': 'public, max-age=300'
    });
  }
};
