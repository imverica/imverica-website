'use strict';
/**
 * County-specific criminal-relief packet endpoint.
 *
 *   GET /api/relief-packet?county=<slug>&reliefType=<type>
 *   GET /api/relief-packet                      → { reliefTypes, counties }
 *
 * Returns the standard packet STRUCTURE (required statewide / required local /
 * optional / reference-only, with generate-vs-download per form) for the chosen
 * county + relief type. No user data — same sensitivity as /api/route, so it is
 * public (origin-guarded + throttled), usable from public pages and the cabinet.
 */

const { originGuard, throttleOrReject, ensureBlobs } = require('./lib/abuse-guard');
const { RELIEF_TYPES, RELIEF_LABELS, buildReliefPacket } = require('./lib/ca-relief-packet');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function counties() {
  try {
    const idx = require('../../assets/form-cache/ca-criminal-relief-index.json');
    return (idx.counties || []).map((c) => ({ name: c.name, slug: c.slug }));
  } catch { return []; }
}

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  const reject = originGuard(event);
  if (reject) return reject;
  const throttled = await throttleOrReject(event, { action: 'relief-packet', limit: 60, windowSec: 60 });
  if (throttled) return throttled;

  const q = event.queryStringParameters || {};
  const county = String(q.county || '').trim();
  const reliefType = String(q.reliefType || q.relief || '').trim();

  // No selection yet → return the pickers.
  if (!county || !reliefType) {
    return json(200, {
      ok: true,
      reliefTypes: RELIEF_TYPES.map((id) => ({ id, label: RELIEF_LABELS[id] })),
      counties: counties()
    });
  }

  if (!RELIEF_TYPES.includes(reliefType)) {
    return json(422, { ok: false, error: 'Unknown relief type', reliefTypes: RELIEF_TYPES });
  }

  const packet = buildReliefPacket(county, reliefType, {
    cannotAffordFees: q.feeWaiver === '1' || q.feeWaiver === 'true'
  });
  if (!packet) return json(404, { ok: false, error: 'County not found', county });

  return json(200, { ok: true, packet });
};
