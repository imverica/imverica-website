'use strict';
/**
 * Search analytics — what visitors type into the hero finder and whether
 * they act on the answer.
 *
 *   POST /api/analytics   { type: 'search'|'start'|'lead'|'call'|'email',
 *                           query, lang, formCode, confidence, page }
 *                           (public, origin-guarded, throttled,
 *                           fire-and-forget from the browser)
 *   GET  /api/analytics?days=7                      (admin token required)
 *     → { ok, events: [...], summary: { byForm, byLang, searches, starts,
 *          leads, calls, emails, conversionsByPage } }
 *
 * Conversion events (2026-07 SEO push): 'lead' fires on a successful
 * quick-intake / appointment submission, 'call' on a tel: click, 'email'
 * on a mailto: click — all carry `page` so we can see which landing pages
 * actually produce contacts, not just traffic.
 *
 * Storage: imverica-analytics Blobs store, one JSON per event under
 * events/YYYY-MM-DD/<ts>-<rand>.json — no reads on the hot path, the GET
 * aggregates on demand. Queries are truncated to 200 chars; no name/email
 * fields exist here by design.
 */

const crypto = require('crypto');
const { originGuard, throttleOrReject, ensureBlobs } = require('./lib/abuse-guard');
const { isAdmin } = require('./lib/admin-auth');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function getStore() {
  try { return require('@netlify/blobs').getStore('imverica-analytics'); } catch { return null; }
}

function clean(v, max) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max); }

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  // ===== POST — record one event =====
  if (event.httpMethod === 'POST') {
    const originReject = originGuard(event);
    if (originReject) return originReject;
    const throttleReject = await throttleOrReject(event, { action: 'analytics', limit: 30, windowSec: 60 });
    if (throttleReject) return throttleReject;

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false }); }
    const TYPES = ['search', 'start', 'lead', 'call', 'email'];
    const type = TYPES.includes(body.type) ? body.type : 'search';
    const entry = {
      ts: new Date().toISOString(),
      type,
      query: clean(body.query, 200),
      lang: clean(body.lang, 8),
      formCode: clean(body.formCode, 24).toUpperCase(),
      confidence: Number(body.confidence) || null,
      page: clean(body.page, 200)
    };
    // Search events are meaningless without a query/form; conversion
    // events (lead/call/email) are meaningful with just the page.
    const isConversion = type === 'lead' || type === 'call' || type === 'email';
    if (!isConversion && !entry.query && !entry.formCode) return json(400, { ok: false });

    const store = await getStore();
    if (store) {
      const day = entry.ts.slice(0, 10);
      const key = `events/${day}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`;
      try { await store.setJSON(key, entry); } catch { /* analytics never breaks UX */ }
    }
    return json(200, { ok: true });
  }

  // ===== GET — admin aggregate =====
  if (event.httpMethod === 'GET') {
    if (!isAdmin(event)) return json(401, { ok: false, error: 'Unauthorized' });
    const days = Math.min(31, Math.max(1, Number(event.queryStringParameters?.days) || 7));
    const store = await getStore();
    if (!store) return json(200, { ok: true, events: [], summary: {} });

    const events = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      try {
        const result = await store.list({ prefix: `events/${day}/` });
        for (const blob of (result.blobs || []).slice(0, 500)) {
          try { const e = await store.get(blob.key, { type: 'json' }); if (e) events.push(e); } catch { /* skip */ }
        }
      } catch { /* day missing */ }
    }
    events.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

    const summary = { searches: 0, starts: 0, leads: 0, calls: 0, emails: 0, byForm: {}, byLang: {}, conversionsByPage: {} };
    for (const e of events) {
      if (e.type === 'start') summary.starts++;
      else if (e.type === 'lead') summary.leads++;
      else if (e.type === 'call') summary.calls++;
      else if (e.type === 'email') summary.emails++;
      else summary.searches++;
      if (e.formCode) summary.byForm[e.formCode] = (summary.byForm[e.formCode] || 0) + 1;
      if (e.lang) summary.byLang[e.lang] = (summary.byLang[e.lang] || 0) + 1;
      if ((e.type === 'lead' || e.type === 'call' || e.type === 'email') && e.page) {
        summary.conversionsByPage[e.page] = (summary.conversionsByPage[e.page] || 0) + 1;
      }
    }
    return json(200, { ok: true, events: events.slice(0, 400), summary });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
