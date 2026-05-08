const {
  compactAddress,
  normalizeAddress,
  parseUsAddressQuery
} = require('./lib/us-address');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function suggestionFromAddress(address, source = 'local-parse') {
  const normalized = normalizeAddress(address);
  const label = compactAddress(normalized);
  if (!label) return null;
  return {
    ...normalized,
    label,
    verified: false,
    source
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok: false, error: 'Method not allowed' });

  let body = {};
  if (event.httpMethod === 'POST') {
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      body = {};
    }
  }

  const input = {
    ...event.queryStringParameters,
    ...body
  };
  const query = String(input.q || input.query || input.line1 || '').trim();
  if (query.length < 5) return json(200, { ok: true, suggestions: [] });

  const parsed = parseUsAddressQuery(query);
  const suggestions = [];
  const local = suggestionFromAddress(parsed || { ...input, line1: query });
  if (local) suggestions.push(local);

  return json(200, {
    ok: true,
    configured: Boolean((process.env.USPS_CLIENT_ID || process.env.USPS_CONSUMER_KEY) && (process.env.USPS_CLIENT_SECRET || process.env.USPS_CONSUMER_SECRET)),
    source: 'local-parse',
    suggestions
  });
};
