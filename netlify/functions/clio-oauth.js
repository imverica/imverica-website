'use strict';
/**
 * Clio Manage OAuth connect/callback + status, for a signed-in attorney.
 *
 *   GET /api/clio-oauth?action=status   → { configured, connected }
 *   GET /api/clio-oauth?action=start    → 302 to Clio authorize
 *   GET /api/clio-oauth?code=...&state= → callback: store tokens, redirect back
 *   POST /api/clio-oauth { action:'disconnect' }
 *
 * Gated on a signed-in session. Until Clio app credentials are set on the
 * server (CLIO_CLIENT_ID/SECRET/REDIRECT_URI), returns 503 "not configured".
 */

const crypto = require('crypto');
const { sessionFromEvent } = require('./lib/session-auth');
const clio = require('./lib/clio');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function redirect(location) { return { statusCode: 302, headers: { Location: location } }; }

exports.handler = async function (event) {
  const session = sessionFromEvent(event);
  if (!session) return json(401, { ok: false, error: 'Not signed in' });
  const email = session.email;
  const q = event.queryStringParameters || {};

  if (q.action === 'status' || (!q.action && !q.code)) {
    return json(200, { ok: true, configured: clio.isConfigured(), connected: clio.isConfigured() ? await clio.isConnected(email) : false });
  }
  if (!clio.isConfigured()) {
    return json(503, { ok: false, error: 'Clio integration is not configured on this server yet.' });
  }

  if (event.httpMethod === 'POST') {
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
    if (body.action === 'disconnect') {
      try { const s = require('@netlify/blobs').getStore('imverica-clio'); await s.delete(`tok/${crypto.createHash('sha256').update(email).digest('hex')}.json`); } catch {}
      return json(200, { ok: true, connected: false });
    }
    return json(400, { ok: false, error: 'Unknown action' });
  }

  // OAuth callback: Clio redirected back with ?code & ?state.
  if (q.code) {
    // state binds the callback to this signed-in email (CSRF + identity).
    const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'x').update(email).digest('hex').slice(0, 24);
    if (q.state !== expected) return json(403, { ok: false, error: 'Invalid OAuth state' });
    try {
      const tokens = await clio.exchangeCode(q.code);
      await clio.saveTokens(email, tokens);
    } catch (err) {
      return json(502, { ok: false, error: 'Could not complete Clio connection: ' + err.message });
    }
    return redirect('/account.html?clio=connected');
  }

  // Start: send the attorney to Clio's consent screen.
  if (q.action === 'start') {
    const state = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'x').update(email).digest('hex').slice(0, 24);
    return redirect(clio.authorizeUrl(state));
  }

  return json(400, { ok: false, error: 'Unknown action' });
};
