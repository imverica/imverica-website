'use strict';

/**
 * CA court template resolver.
 *
 * Two tiers:
 *   1. Filesystem — the high-traffic templates bundled into the function
 *      (netlify.toml included_files) + everything when running locally.
 *   2. Static HTTP — ALL 345+ decrypted templates are deployed as site assets
 *      under /ca-templates/<slug>.pdf (astro-site/public/ca-templates). The
 *      full set is ~104 MB — far beyond the 50 MB zipped function limit — so
 *      functions fetch the long tail over HTTP from our own origin instead of
 *      bundling it. A small in-memory LRU keeps warm invocations fast.
 */

const fs = require('fs');
const path = require('path');

function findCourtTemplate(slug) {
  const rootFromFunction = path.resolve(__dirname, '..', '..', '..');
  const dirs = [
    path.join(process.cwd(), 'assets/form-cache/ca-court'),
    path.join(__dirname, 'assets/form-cache/ca-court'),
    path.join(rootFromFunction, 'assets/form-cache/ca-court'),
    // Local dev convenience: the static store also lives on disk.
    path.join(process.cwd(), 'astro-site/public/ca-templates'),
    path.join(rootFromFunction, 'astro-site/public/ca-templates')
  ];
  for (const dir of dirs) {
    const file = path.join(dir, `${slug}.pdf`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

// Tiny LRU for HTTP-fetched templates (Lambda containers are reused).
const CACHE_MAX = 12;
const cache = new Map(); // slug -> Buffer

function cacheGet(slug) {
  if (!cache.has(slug)) return null;
  const buf = cache.get(slug);
  cache.delete(slug); cache.set(slug, buf); // refresh recency
  return buf;
}
function cachePut(slug, buf) {
  cache.set(slug, buf);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function siteOrigin() {
  return process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://imverica.com';
}

/**
 * Load a decrypted template as a Buffer: filesystem first, then the static
 * template store over HTTP. Returns null when the form has no template.
 */
async function loadCourtTemplate(slugRaw) {
  const slug = String(slugRaw || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) return null;

  const file = findCourtTemplate(slug);
  if (file) { try { return fs.readFileSync(file); } catch { /* fall through */ } }

  const cached = cacheGet(slug);
  if (cached) return cached;

  try {
    const res = await fetch(`${siteOrigin()}/ca-templates/${slug}.pdf`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return null;
    cachePut(slug, buf);
    return buf;
  } catch { return null; }
}

/** True when the template exists locally or in the static-store catalog. */
function hasStaticTemplate(slugRaw) {
  const slug = String(slugRaw || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (findCourtTemplate(slug)) return true;
  // In the deployed function the static dir is not on disk — consult the
  // committed catalog instead (it lists every downloaded template).
  try {
    const catalog = require(path.resolve(__dirname, '..', '..', '..', 'assets/form-cache/ca-forms-catalog.json'));
    return (catalog.forms || []).some((f) => f.slug === slug || String(f.code || '').toLowerCase() === slug);
  } catch { return false; }
}

module.exports = { findCourtTemplate, loadCourtTemplate, hasStaticTemplate };
