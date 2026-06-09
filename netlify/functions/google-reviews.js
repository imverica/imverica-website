/**
 * Public Google reviews feed for the Testimonials section.
 *
 *   GET /api/google-reviews  → { ok, configured, source, count, averageRating, reviews:[…] }
 *
 * Two sources, tried in order of richness:
 *
 *  1. Google Business Profile API (ALL of your reviews + your replies).
 *     Requires OAuth as the business owner. Env:
 *       GBP_CLIENT_ID            OAuth client id
 *       GBP_CLIENT_SECRET        OAuth client secret
 *       GBP_REFRESH_TOKEN        long-lived refresh token (owner consented once)
 *       GBP_ACCOUNT_ID           e.g. "accounts/123…" or just "123…"
 *       GBP_LOCATION_ID          e.g. "locations/456…" or just "456…"
 *     NOTE: access to these APIs is GATED — you must request access to the
 *     Business Profile APIs in Google Cloud and be approved first, otherwise
 *     the token works but the reviews endpoint returns 403. See
 *     docs/SETUP-GOOGLE-REVIEWS.md.
 *
 *  2. Google Places API (Place Details) — up to 5 "most relevant" reviews.
 *     Easier (just an API key, no OAuth, no gated approval). Env:
 *       GOOGLE_PLACES_API_KEY    Maps/Places API key
 *       GOOGLE_PLACE_ID          your listing's Place ID
 *
 * If neither is configured (or both fail), returns configured:false with an
 * empty list so the Testimonials component keeps showing its built-in pool —
 * the page never breaks while you finish the Google setup.
 *
 * Results are cached in Netlify Blobs for CACHE_TTL_MS to respect the (low)
 * Business Profile API quota and keep the homepage fast.
 */

'use strict';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_STORE = 'imverica-cache';
const CACHE_KEY = 'google-reviews.json';
const MAX_REVIEWS = 30; // cap the pool the homepage rotates through

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800', ...(extraHeaders || {}) },
    body: JSON.stringify(body)
  };
}

// ---- star-rating enum (Business Profile API) → number ----
const STAR_WORDS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

function monthYear(iso) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

function cleanText(s) {
  return String(s || '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
}

// ---- Blobs cache (best-effort) ----
async function getStore() {
  try { return require('@netlify/blobs').getStore(CACHE_STORE); } catch { return null; }
}
async function readCache() {
  const s = await getStore();
  if (!s) return null;
  try {
    const v = await s.get(CACHE_KEY, { type: 'json' });
    if (v && v.ts && (Date.now() - v.ts) < CACHE_TTL_MS) return v.data;
  } catch { /* ignore */ }
  return null;
}
async function writeCache(data) {
  const s = await getStore();
  if (!s) return;
  try { await s.setJSON(CACHE_KEY, { ts: Date.now(), data }); } catch { /* ignore */ }
}

// ---- OAuth: refresh token → access token (Business Profile) ----
async function getAccessToken() {
  const client_id = process.env.GBP_CLIENT_ID;
  const client_secret = process.env.GBP_CLIENT_SECRET;
  const refresh_token = process.env.GBP_REFRESH_TOKEN;
  if (!client_id || !client_secret || !refresh_token) return null;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: 'refresh_token' })
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    console.error('[google-reviews] token exchange failed', resp.status, t.slice(0, 200));
    return null;
  }
  const j = await resp.json();
  return j.access_token || null;
}

function withPrefix(value, prefix) {
  const v = String(value || '').trim();
  if (!v) return '';
  return v.startsWith(prefix) ? v : prefix + v;
}

// ---- Source 1: Business Profile API (all reviews) ----
async function fetchBusinessProfileReviews() {
  const accountId = process.env.GBP_ACCOUNT_ID;
  const locationId = process.env.GBP_LOCATION_ID;
  if (!accountId || !locationId) return null;
  const token = await getAccessToken();
  if (!token) return null;

  const account = withPrefix(accountId, 'accounts/');
  const location = withPrefix(locationId, 'locations/');
  const url = `https://mybusiness.googleapis.com/v4/${account}/${location}/reviews?pageSize=50&orderBy=updateTime%20desc`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    console.error('[google-reviews] GBP reviews fetch failed', resp.status, t.slice(0, 200));
    return null;
  }
  const data = await resp.json();
  return mapBusinessProfile(data);
}

function mapBusinessProfile(data) {
  const list = Array.isArray(data && data.reviews) ? data.reviews : [];
  const reviews = list
    .map((r) => {
      const stars = STAR_WORDS[String(r.starRating || '').toUpperCase()] || 0;
      const body = cleanText(r.comment);
      const name = cleanText(r.reviewer && r.reviewer.displayName) || 'Google user';
      const time = r.updateTime || r.createTime || '';
      return body && stars
        ? { stars, name, body, meta: (monthYear(time) ? monthYear(time) + ' · ' : '') + 'Google review', time, source: 'google' }
        : null;
    })
    .filter(Boolean)
    .slice(0, MAX_REVIEWS);
  const all = list.map((r) => STAR_WORDS[String(r.starRating || '').toUpperCase()] || 0).filter(Boolean);
  const averageRating = (typeof data.averageRating === 'number')
    ? data.averageRating
    : (all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10 : null);
  return { source: 'business-profile', count: typeof data.totalReviewCount === 'number' ? data.totalReviewCount : reviews.length, averageRating, reviews };
}

// ---- Source 2: Places API (≤5 reviews) ----
// Resolve a Place ID from a business-name query, so the owner only has to set
// the API key (GOOGLE_PLACE_ID stays optional). Defaults to the Imverica
// listing; override with GOOGLE_PLACE_QUERY if the name ever changes.
async function resolvePlaceId(key) {
  const q = process.env.GOOGLE_PLACE_QUERY || 'Imverica Legal Solutions Sacramento CA';
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(q)}&inputtype=textquery&fields=place_id&key=${encodeURIComponent(key)}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.status === 'OK' && Array.isArray(data.candidates) && data.candidates[0]) {
      return data.candidates[0].place_id || null;
    }
    console.error('[google-reviews] findPlace status', data.status, (data.error_message || '').slice(0, 160));
    return null;
  } catch (e) { console.error('[google-reviews] findPlace error', e && e.message); return null; }
}

async function fetchPlacesReviews() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  // Prefer an explicit Place ID; otherwise look it up by name (one less env
  // var to set). The result is cached for 6h with the reviews payload.
  let placeId = process.env.GOOGLE_PLACE_ID;
  if (!placeId) placeId = await resolvePlaceId(key);
  if (!placeId) return null;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=reviews,rating,user_ratings_total&reviews_sort=newest&key=${encodeURIComponent(key)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error('[google-reviews] Places fetch http', resp.status);
    return null;
  }
  const data = await resp.json();
  if (data.status && data.status !== 'OK') {
    console.error('[google-reviews] Places status', data.status, (data.error_message || '').slice(0, 160));
    return null;
  }
  return mapPlaces(data.result || {});
}

function mapPlaces(result) {
  const list = Array.isArray(result.reviews) ? result.reviews : [];
  const reviews = list
    .map((r) => {
      const stars = Math.round(Number(r.rating) || 0);
      const body = cleanText(r.text);
      const name = cleanText(r.author_name) || 'Google user';
      return body && stars
        ? { stars, name, body, meta: (cleanText(r.relative_time_description) ? cleanText(r.relative_time_description) + ' · ' : '') + 'Google review', time: r.time ? new Date(r.time * 1000).toISOString() : '', source: 'google' }
        : null;
    })
    .filter(Boolean)
    .slice(0, 5);
  return { source: 'places', count: typeof result.user_ratings_total === 'number' ? result.user_ratings_total : reviews.length, averageRating: typeof result.rating === 'number' ? result.rating : null, reviews };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  // Serve from cache unless ?refresh=1 (handy for testing after setup).
  const force = (event.queryStringParameters || {}).refresh === '1';
  if (!force) {
    const cached = await readCache();
    if (cached) return json(200, { ok: true, cached: true, ...cached });
  }

  try {
    // Prefer Business Profile (all reviews); fall back to Places (≤5).
    let result = await fetchBusinessProfileReviews();
    if (!result || !result.reviews.length) {
      const places = await fetchPlacesReviews();
      if (places && places.reviews.length) result = places;
    }

    if (!result || !result.reviews.length) {
      // Nothing configured yet (or no text reviews) — tell the component to
      // keep its built-in pool. Never an error: the homepage must not break.
      return json(200, { ok: true, configured: false, source: null, count: 0, averageRating: null, reviews: [] });
    }

    const payload = { configured: true, source: result.source, count: result.count, averageRating: result.averageRating, reviews: result.reviews };
    await writeCache(payload);
    return json(200, { ok: true, cached: false, ...payload });
  } catch (err) {
    console.error('[google-reviews] error', err && err.message ? err.message : err);
    // Last resort: stale cache if we have it, else "not configured" so the
    // component falls back gracefully.
    const cached = await readCache();
    if (cached) return json(200, { ok: true, cached: true, stale: true, ...cached });
    return json(200, { ok: true, configured: false, source: null, count: 0, averageRating: null, reviews: [], error: 'fetch-failed' });
  }
};

// Exported for unit tests (mapping logic without network).
exports._mapBusinessProfile = mapBusinessProfile;
exports._mapPlaces = mapPlaces;
