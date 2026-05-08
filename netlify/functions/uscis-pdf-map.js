const fs = require('fs');
const path = require('path');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const MAP_DIR = path.join(__dirname, 'pdf-maps/uscis');

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

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function safeSlug(value) {
  return normalizeCode(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isValidUscisCode(code) {
  return /^[A-Z]{1,4}-[0-9A-Z]+(?: SUPPLEMENT(?: [A-Z])?)?$/.test(code);
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  const code = normalizeCode(event.queryStringParameters?.code);
  if (!code || !isValidUscisCode(code)) {
    return json(400, { ok: false, error: 'Missing or invalid USCIS form code' });
  }

  const filePath = path.join(MAP_DIR, `${safeSlug(code)}.json`);
  if (!filePath.startsWith(MAP_DIR)) {
    return json(400, { ok: false, error: 'Invalid map path' });
  }

  try {
    const map = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return json(200, {
      ok: true,
      code,
      map
    }, {
      'Cache-Control': 'public, max-age=900'
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return json(404, {
        ok: false,
        code,
        error: 'USCIS PDF map scaffold was not found'
      });
    }

    console.error('Could not read USCIS PDF map:', err);
    return json(500, {
      ok: false,
      code,
      error: 'Could not read USCIS PDF map scaffold'
    });
  }
};
