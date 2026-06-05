const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(file, text, label = text) {
  const content = read(file);
  assert(content.includes(text), `${file} missing ${label}`);
}

function assertNotIncludes(file, text, label = text) {
  const content = read(file);
  assert(!content.includes(text), `${file} must not include ${label}`);
}

function assertIfExists(file, check) {
  if (exists(file)) check(file);
}

const noPublicPii = ['HOVDAN', 'YANA', 'OLEKSANDRIVNA', 'SERHIEIEVA'];
const publicHtmlFiles = [
  'index.html',
  'portal.html',
  'astro-site/dist/index.html',
  'astro-site/dist/ru/index.html',
  'astro-site/dist/uk/index.html',
  'astro-site/dist/es/index.html',
  'astro-site/dist/i-485-help/index.html',
  'astro-site/dist/ru/i-485-help/index.html',
  'astro-site/dist/uk/i-485-help/index.html',
  'astro-site/dist/es/i-485-help/index.html'
];

for (const file of publicHtmlFiles) {
  assertIfExists(file, (existingFile) => {
    for (const pii of noPublicPii) {
      assertNotIncludes(existingFile, pii, `sample client data ${pii}`);
    }
  });
}

assert(exists('astro-site/public/logo-nav.png'), 'Astro public logo asset is missing');
assertIncludes('portal.html', '<img src="/logo-nav.png"', 'portal real Imverica logo');
assertNotIncludes('portal.html', '<span class="im">im</span><span class="verica">verica</span>', 'old text logo');

const phoneExpectations = [
  ['index.html', '+1 (916) 399-3992'],
  ['index.html', 'tel:+19163993992'],
  ['portal.html', '+1 (916) 399-3992'],
  ['astro-site/src/scripts/wizard.ts', 'tel:+19163993992'],
  ['astro-site/src/components/SiteHeader.astro', 'tel:+19163993992'],
  ['astro-site/src/components/Hero.astro', 'tel:+19163993992'],
  ['astro-site/src/pages/fl.astro', '+1-916-399-3992'],
  ['astro-site/src/pages/i-130-family-petition.astro', '+1-916-399-3992'],
  ['astro-site/src/pages/i-765-work-permit-help.astro', '+1-916-399-3992']
];
for (const [file, text] of phoneExpectations) {
  assertIncludes(file, text);
}

assertNotIncludes('index.html', 'tel:9163993992', 'domestic-only telephone link');
assertNotIncludes('portal.html', 'tel:9163993992', 'domestic-only telephone link');

assertIncludes('index.html', 'Clear answers about what Imverica can and cannot do', 'updated FAQ intro');
assertIncludes('index.html', '.svc-inner>p{max-width:none;}', 'service intro should align with service-card width');
assertIncludes('index.html', 'footer p{color:#d8e6f6!important;}', 'readable footer text color');
assertIncludes('astro-site/src/styles/site.css', '.svc-inner > p', 'Astro service intro width rule');
assertIncludes('astro-site/src/styles/site.css', '.site-brand-logo', 'Astro real logo CSS');

assertIfExists('astro-site/dist/index.html', (file) => {
  assertIncludes(file, '/logo-nav.png', 'built Astro logo');
  assertIncludes(file, '+1 (916) 399-3992', 'built Astro international phone format');
});

console.log('Astro parity QA passed');
