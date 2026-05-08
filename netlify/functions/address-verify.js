const {
  compactAddress,
  normalizeAddress,
  parseUsAddressQuery,
  toUspsQuery
} = require('./lib/us-address');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const DEFAULT_USPS_BASE = 'https://apis.usps.com';

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

function uspsCredentials() {
  const clientId = process.env.USPS_CLIENT_ID || process.env.USPS_CONSUMER_KEY || '';
  const clientSecret = process.env.USPS_CLIENT_SECRET || process.env.USPS_CONSUMER_SECRET || '';
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

async function parseBody(event) {
  if (event.httpMethod !== 'POST') return {};
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

function localSuggestion(input) {
  const parsed = parseUsAddressQuery(input.q || input.query || '') || normalizeAddress(input);
  return {
    ...parsed,
    label: compactAddress(parsed),
    verified: false
  };
}

function normalizeUspsAddress(payload = {}) {
  const address = payload.address || payload;
  const normalized = normalizeAddress({
    line1: address.streetAddress || address.streetAddressAbbreviation || address.deliveryAddress || address.addressLine1,
    line2: address.secondaryAddress || address.addressLine2,
    city: address.city || address.cityName,
    state: address.state,
    zip: [address.ZIPCode || address.zipCode, address.ZIPPlus4 || address.zipPlus4].filter(Boolean).join('-')
  });
  return {
    ...normalized,
    label: compactAddress(normalized),
    verified: Boolean(normalized.line1 && normalized.city && normalized.state && normalized.zip)
  };
}

async function getUspsToken(base, credentials) {
  const response = await fetch(`${base}/oauth2/v3/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || `USPS OAuth failed (${response.status})`);
  }
  return body.access_token;
}

async function verifyWithUsps(address, credentials) {
  const base = process.env.USPS_API_BASE || DEFAULT_USPS_BASE;
  const token = await getUspsToken(base, credentials);
  const params = new URLSearchParams();
  const query = toUspsQuery(address);

  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const response = await fetch(`${base}/addresses/v3/address?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || body.message || `USPS address validation failed (${response.status})`);
  }

  return normalizeUspsAddress(body);
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok: false, error: 'Method not allowed' });

  const body = await parseBody(event);
  const input = {
    ...event.queryStringParameters,
    ...body
  };
  const address = parseUsAddressQuery(input.q || input.query || '') || normalizeAddress(input);
  if (!address.line1) return json(400, { ok: false, error: 'Missing address line 1' });

  const credentials = uspsCredentials();
  if (!credentials.configured) {
    const suggestion = localSuggestion({ ...input, ...address });
    return json(200, {
      ok: true,
      configured: false,
      verified: false,
      source: 'local-parse',
      suggestions: suggestion.label ? [suggestion] : [],
      message: 'USPS credentials are not configured; returning local parsing fallback.'
    });
  }

  try {
    const verified = await verifyWithUsps(address, credentials);
    return json(200, {
      ok: true,
      configured: true,
      verified: verified.verified,
      source: 'usps',
      suggestions: verified.label ? [verified] : []
    });
  } catch (err) {
    const suggestion = localSuggestion({ ...input, ...address });
    return json(200, {
      ok: true,
      configured: true,
      verified: false,
      source: 'usps-error',
      suggestions: suggestion.label ? [suggestion] : [],
      error: err.message || String(err)
    });
  }
};
