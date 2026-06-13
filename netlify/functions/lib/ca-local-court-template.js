'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_MAX = 12;
const cache = new Map();

function clean(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function findLocalCourtTemplate(countyRaw, slugRaw) {
  const county = clean(countyRaw);
  const slug = clean(slugRaw);
  if (!county || !slug) return null;
  const root = path.resolve(__dirname, '..', '..', '..');
  const dirs = [
    path.join(process.cwd(), 'assets/form-cache/ca-local-court'),
    path.join(root, 'assets/form-cache/ca-local-court'),
    path.join(process.cwd(), 'astro-site/public/ca-local-templates'),
    path.join(root, 'astro-site/public/ca-local-templates')
  ];
  for (const dir of dirs) {
    const file = path.join(dir, county, `${slug}.pdf`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function siteOrigin() {
  return process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://imverica.com';
}

// Read a local template from the Netlify Blobs store where the 2,790 county
// templates live (uploaded by scripts/upload-ca-local-templates-to-blobs.js).
// Uses implicit Netlify context in the deployed function — no token needed.
// Returns null (degrade to URL fetch) on any miss/error so generation never
// hard-fails on a Blobs hiccup.
async function loadFromBlobs(key) {
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore('ca-local-templates');
    const buf = await store.get(key, { type: 'arrayBuffer' });
    if (!buf) return null;
    const out = Buffer.from(buf);
    return out.subarray(0, 5).toString('latin1') === '%PDF-' ? out : null;
  } catch { return null; }
}

async function loadLocalCourtTemplate(countyRaw, slugRaw, official = {}) {
  const county = clean(countyRaw);
  const slug = clean(slugRaw);
  const key = `${county}/${slug}`;
  const file = findLocalCourtTemplate(county, slug);
  if (file) return fs.readFileSync(file);
  if (cache.has(key)) return cache.get(key);
  // Primary server-side source: Netlify Blobs (templates are NOT in git).
  const fromBlobs = await loadFromBlobs(key);
  if (fromBlobs) {
    cache.set(key, fromBlobs);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return fromBlobs;
  }
  const cachedUrl = `${siteOrigin()}/ca-local-templates/${county}/${slug}.pdf`;
  const urls = official.cached === false
    ? (official.url ? [official.url] : [])
    : [cachedUrl, ...(official.url ? [official.url] : [])];
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: {
        'User-Agent': 'Mozilla/5.0 ImvericaFormGenerator/1.0',
        ...(url === official.url && official.referer ? { Referer: official.referer } : {})
      } });
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') continue;
      if (url === official.url && official.sha256) {
        const actual = crypto.createHash('sha256').update(buffer).digest('hex');
        if (actual !== official.sha256) return null;
      }
      cache.set(key, buffer);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      return buffer;
    } catch { /* try next source */ }
  }
  return null;
}

module.exports = { findLocalCourtTemplate, loadLocalCourtTemplate };
