'use strict';
/**
 * GET /api/court-flow?code=FL-100
 *
 * Serves the static intake schema for a California court form so the
 * court-intake UI can render its questions. Mirrors immigration-flow.js's
 * response contract. Read-only, no side effects, no auth (schemas are not
 * sensitive — they describe which public-form fields we collect).
 */

const { getCourtSchema, listCourtSchemas } = require('./lib/ca-court-flow-schema');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  const code = (event.queryStringParameters && event.queryStringParameters.code) || '';
  if (!code) {
    return json(400, { ok: false, error: 'Missing court form code', supported: listCourtSchemas() });
  }

  const schema = getCourtSchema(code);
  if (!schema) {
    return json(404, { ok: false, error: 'Court form not supported', code, supported: listCourtSchemas() });
  }

  return json(200, { ok: true, ...schema });
};
