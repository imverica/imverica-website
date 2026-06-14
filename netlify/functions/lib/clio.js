'use strict';
/**
 * Clio Manage integration (spike).
 *
 * Lets a connected attorney pull a matter/contact for prefill and push a
 * generated packet PDF straight into that matter's documents. OAuth2 per
 * attorney; refresh token stored encrypted in Blobs (store: imverica-clio),
 * keyed by the signed-in email.
 *
 * ACTIVATION (one-time): register an app at
 *   https://app.clio.com/settings/developer_applications
 * then set on Netlify:
 *   CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, CLIO_REDIRECT_URI
 *     (= https://imverica.com/api/clio-oauth)
 * Until those are set, isConfigured() is false and every endpoint returns a
 * clear 503 "not configured" — nothing half-works.
 *
 * Clio API: OAuth https://app.clio.com/oauth/{authorize,token}; REST base
 * https://app.clio.com/api/v4. (US region; EU apps use eu.app.clio.com.)
 */

const crypto = require('crypto');

const OAUTH_BASE = process.env.CLIO_REGION === 'eu' ? 'https://eu.app.clio.com' : 'https://app.clio.com';
const API_BASE = `${OAUTH_BASE}/api/v4`;

function isConfigured() {
  return Boolean(process.env.CLIO_CLIENT_ID && process.env.CLIO_CLIENT_SECRET && process.env.CLIO_REDIRECT_URI);
}

function authorizeUrl(state) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.CLIO_CLIENT_ID || '',
    redirect_uri: process.env.CLIO_REDIRECT_URI || '',
    state: state || ''
  });
  return `${OAUTH_BASE}/oauth/authorize?${p.toString()}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.CLIO_CLIENT_ID,
    client_secret: process.env.CLIO_CLIENT_SECRET,
    redirect_uri: process.env.CLIO_REDIRECT_URI
  });
  const res = await fetch(`${OAUTH_BASE}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
  });
  if (!res.ok) throw new Error(`Clio token exchange failed: ${res.status}`);
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.CLIO_CLIENT_ID,
    client_secret: process.env.CLIO_CLIENT_SECRET
  });
  const res = await fetch(`${OAUTH_BASE}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
  });
  if (!res.ok) throw new Error(`Clio token refresh failed: ${res.status}`);
  return res.json();
}

// ---- token storage (encrypted refresh token per attorney email) ----
async function tokenStore() {
  try { return require('@netlify/blobs').getStore('imverica-clio'); } catch { return null; }
}
function tokenKey(email) { return `tok/${crypto.createHash('sha256').update(String(email)).digest('hex')}.json`; }

async function saveTokens(email, tokens) {
  const store = await tokenStore();
  if (!store) return false;
  await store.setJSON(tokenKey(email), {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at: Date.now() + (Number(tokens.expires_in || 0) * 1000),
    savedAt: new Date().toISOString()
  });
  return true;
}

async function getValidAccessToken(email) {
  const store = await tokenStore();
  if (!store) return null;
  let rec;
  try { rec = await store.get(tokenKey(email), { type: 'json' }); } catch { rec = null; }
  if (!rec || !rec.refresh_token) return null;
  if (rec.access_token && rec.expires_at && Date.now() < rec.expires_at - 60000) return rec.access_token;
  const fresh = await refreshAccessToken(rec.refresh_token);
  await saveTokens(email, { ...fresh, refresh_token: fresh.refresh_token || rec.refresh_token });
  return fresh.access_token;
}

async function isConnected(email) {
  const store = await tokenStore();
  if (!store) return false;
  try { const rec = await store.get(tokenKey(email), { type: 'json' }); return Boolean(rec && rec.refresh_token); } catch { return false; }
}

async function apiFetch(email, pathName, opts = {}) {
  const token = await getValidAccessToken(email);
  if (!token) throw new Error('Clio not connected for this account');
  const res = await fetch(`${API_BASE}${pathName}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  if (!res.ok) throw new Error(`Clio API ${pathName} failed: ${res.status}`);
  return res.json();
}

/**
 * Push a generated packet PDF into a Clio matter's documents.
 * Clio's document upload is two-step: create the doc + get an S3 PUT URL,
 * upload the bytes, then mark it fully_uploaded.
 */
async function uploadDocumentToMatter(email, matterId, pdfBuffer, name) {
  const token = await getValidAccessToken(email);
  if (!token) throw new Error('Clio not connected for this account');
  // 1. create document record
  const create = await fetch(`${API_BASE}/documents.json?fields=id,latest_document_version{uuid,put_url,put_headers}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { name, parent: { id: Number(matterId), type: 'Matter' } } })
  });
  if (!create.ok) throw new Error(`Clio create document failed: ${create.status}`);
  const created = await create.json();
  const ver = created?.data?.latest_document_version;
  if (!ver?.put_url) throw new Error('Clio did not return an upload URL');
  // 2. upload bytes to the provided URL
  const headers = {};
  for (const h of (ver.put_headers || [])) headers[h.name] = h.value;
  const put = await fetch(ver.put_url, { method: 'PUT', headers, body: pdfBuffer });
  if (!put.ok) throw new Error(`Clio upload PUT failed: ${put.status}`);
  // 3. mark fully uploaded
  await fetch(`${API_BASE}/documents/${created.data.id}.json`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { uuid: ver.uuid, fully_uploaded: true } })
  });
  return { documentId: created.data.id, matterId };
}

module.exports = {
  isConfigured, authorizeUrl, exchangeCode, refreshAccessToken,
  saveTokens, getValidAccessToken, isConnected, apiFetch, uploadDocumentToMatter
};
