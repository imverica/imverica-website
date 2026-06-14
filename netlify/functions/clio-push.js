'use strict';
/**
 * Push a generated packet PDF into a connected attorney's Clio matter.
 *
 *   POST /api/clio-push { matterId, pdfBase64, name }
 *     → { ok, documentId, matterId }
 *
 * Session-gated; requires the attorney to have connected Clio (see
 * /api/clio-oauth) and the server to have Clio app credentials configured.
 */

const { sessionFromEvent } = require('./lib/session-auth');
const clio = require('./lib/clio');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204 };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const session = sessionFromEvent(event);
  if (!session) return json(401, { ok: false, error: 'Not signed in' });
  if (!clio.isConfigured()) return json(503, { ok: false, error: 'Clio integration is not configured on this server yet.' });
  if (!(await clio.isConnected(session.email))) return json(409, { ok: false, error: 'Connect Clio first.', connectUrl: '/api/clio-oauth?action=start' });

  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const matterId = String(body.matterId || '').trim();
  const name = String(body.name || 'Imverica packet.pdf').replace(/[^\w.\- ]/g, '_').slice(0, 120);
  if (!matterId) return json(400, { ok: false, error: 'Missing matterId' });
  const pdf = Buffer.from(String(body.pdfBase64 || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') return json(400, { ok: false, error: 'pdfBase64 is not a valid PDF' });

  try {
    const result = await clio.uploadDocumentToMatter(session.email, matterId, pdf, name);
    return json(200, { ok: true, ...result });
  } catch (err) {
    return json(502, { ok: false, error: 'Clio push failed: ' + err.message });
  }
};
