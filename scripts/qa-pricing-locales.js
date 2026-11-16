// The four pricing pages must show the same amounts in the same order, and
// on the Russian, Ukrainian and Spanish pages every price starts with
// "от / від / desde" (the owner's rule). Reads the built site
// (astro-site/dist), so run `npm run build` in astro-site first.
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'astro-site', 'dist');
const PAGES = { en: 'pricing/index.html', ru: 'ru/pricing/index.html', uk: 'ua/pricing/index.html', es: 'mx/pricing/index.html' };
const FROM = { ru: 'от ', uk: 'від ', es: 'desde ' };
const HTML_LANG = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA', es: 'es-MX' };

function assert(cond, msg) { if (!cond) { console.error('pricing locales QA failed: ' + msg); process.exit(1); } }

const pages = {};
for (const [lang, rel] of Object.entries(PAGES)) {
  const file = path.join(DIST, rel);
  assert(fs.existsSync(file), `${rel} is missing (build astro-site first)`);
  const html = fs.readFileSync(file, 'utf8');
  const prices = [...html.matchAll(/<span class="price"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1].replace(/&nbsp;/g, ' ').trim());
  const quotes = (html.match(/class="num quote"/g) || []).length;
  pages[lang] = { html, prices, quotes, amounts: prices.map((p) => (p.match(/\$[\d,]+/g) || []).join(' ')) };
  assert(html.includes(`<html lang="${HTML_LANG[lang]}"`), `${rel}: html lang should be ${HTML_LANG[lang]}`);
}

const en = pages.en;
assert(en.prices.length >= 50, `English page shows only ${en.prices.length} prices`);
for (const lang of ['ru', 'uk', 'es']) {
  const p = pages[lang];
  assert(p.prices.length === en.prices.length, `${lang}: ${p.prices.length} prices, English has ${en.prices.length}`);
  assert(p.quotes === en.quotes, `${lang}: ${p.quotes} custom quotes, English has ${en.quotes}`);
  p.amounts.forEach((amount, i) => assert(amount === en.amounts[i], `${lang}: price ${i + 1} is "${p.prices[i]}", English is "${en.prices[i]}"`));
  p.prices.forEach((price) => assert(price.startsWith(FROM[lang]), `${lang}: "${price}" must start with "${FROM[lang].trim()}"`));
  assert(!/Verify with|custom quote|Imverica fee/.test(p.html.split('<main')[1] || ''), `${lang}: untranslated English left in the page`);
  assert(p.html.includes(`hreflang="${lang === 'uk' ? 'uk' : lang}`) || p.html.includes('hreflang'), `${lang}: hreflang links missing`);
}
console.log(`pricing locales QA passed: ${en.prices.length} prices and ${en.quotes} custom quotes identical on 4 pages; every RU/UA/ES price starts with "от / від / desde"`);
