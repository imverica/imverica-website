const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'astro-site', 'dist');
const SITE = 'https://imverica.com';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function existsAbsolute(filePath) {
  return fs.existsSync(filePath);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function htmlFiles(dir = DIST) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...htmlFiles(full));
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function distFileForPath(urlPath) {
  const clean = urlPath.split('#')[0].split('?')[0] || '/';
  if (clean === '/') return path.join(DIST, 'index.html');
  if (clean.endsWith('/')) return path.join(DIST, clean.slice(1), 'index.html');
  const asDirectoryIndex = path.join(DIST, clean.slice(1), 'index.html');
  if (existsAbsolute(asDirectoryIndex)) return asDirectoryIndex;
  return path.join(DIST, clean.slice(1));
}

function normalizeInternalUrl(rawUrl) {
  if (!rawUrl || rawUrl.startsWith('#')) return null;
  if (/^(tel|mailto|javascript):/i.test(rawUrl)) return null;
  if (rawUrl.startsWith('/.netlify/functions/')) return null;
  if (rawUrl.startsWith('/assets/')) return rawUrl;
  if (rawUrl.startsWith('/')) return rawUrl;
  if (rawUrl.startsWith(SITE)) return rawUrl.slice(SITE.length) || '/';
  if (/^https?:\/\//i.test(rawUrl)) return null;
  return null;
}

function assertUrlExists(rawUrl, context) {
  const internal = normalizeInternalUrl(rawUrl);
  if (!internal) return;
  const target = distFileForPath(internal);
  assert(existsAbsolute(target), `${context} points to missing Astro build file: ${rawUrl}`);
}

assert(existsAbsolute(DIST), 'astro-site/dist is missing. Run: cd astro-site && npm run build');

const sourceChecks = [
  ['astro-site/src/components/SiteHeader.astro', 'localizedPathSafe'],
  ['astro-site/src/components/SiteFooter.astro', 'localizedPathSafe'],
  ['astro-site/src/data/i18n.ts', 'translatedSlugs'],
  ['astro-site/src/layouts/BaseLayout.astro', "ogImage = '/logo-nav.png'"]
];
for (const [file, marker] of sourceChecks) {
  assert(read(file).includes(marker), `${file} missing routing guardrail marker: ${marker}`);
}

const html = htmlFiles();
assert(html.length >= 20, `Expected at least 20 Astro HTML pages; found ${html.length}`);

for (const file of html) {
  const content = fs.readFileSync(file, 'utf8');
  const relative = path.relative(DIST, file);

  const canonical = content.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert(canonical?.startsWith(SITE), `${relative} missing absolute canonical URL`);
  assertUrlExists(canonical, `${relative} canonical`);

  for (const match of content.matchAll(/<link rel="alternate" hreflang="[^"]+" href="([^"]+)"/g)) {
    assertUrlExists(match[1], `${relative} hreflang`);
  }

  for (const match of content.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    assertUrlExists(match[1], `${relative} link`);
  }

  for (const match of content.matchAll(/<meta property="og:image" content="([^"]+)"/g)) {
    assertUrlExists(match[1], `${relative} og:image`);
  }
}

const sitemap = read('astro-site/dist/sitemap.xml');
assert(sitemap.includes('xmlns:xhtml='), 'sitemap.xml missing xhtml namespace for hreflang alternates');
for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  assertUrlExists(match[1], 'sitemap loc');
}
for (const match of sitemap.matchAll(/<xhtml:link[^>]*href="([^"]+)"/g)) {
  assertUrlExists(match[1], 'sitemap hreflang');
}

const forbiddenLocalized404s = [
  '/ru/california-family-law',
  '/uk/california-family-law',
  '/es/california-family-law',
  '/ru/california-small-claims',
  '/uk/california-small-claims',
  '/es/california-small-claims',
  '/ru/california-legal-document-assistant',
  '/uk/california-legal-document-assistant',
  '/es/california-legal-document-assistant'
];
const combinedHtml = html.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const badPath of forbiddenLocalized404s) {
  assert(!combinedHtml.includes(`href="${badPath}"`), `Built Astro HTML links to missing localized route ${badPath}`);
}

console.log(`Astro routing QA passed (${html.length} pages checked)`);
