#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');

const uscisRssResponse = `
  <rss><channel>
    <item>
      <title><![CDATA[USCIS and DOJ Take Steps to Denaturalize 12 Individuals for Concealing Terrorist Support, War Crimes, Espionage, Sexual Abuse, and More]]></title>
      <link>https://www.uscis.gov/newsroom/news-releases/denaturalization-test</link>
      <pubDate>Thu, 14 May 2026 12:00:00 -0400</pubDate>
    </item>
    <item>
      <title><![CDATA[Agency Information Collection Activities; Extension, Without Change, of a Currently Approved Collection: Employment Eligibility Verification]]></title>
      <link>https://www.federalregister.gov/documents/routine-omb-notice</link>
      <pubDate>Mon, 18 May 2026 09:00:00 -0400</pubDate>
    </item>
    <item>
      <title><![CDATA[Cap Reached for Second Allocation of Returning Worker H-2B Visas for Fiscal Year 2026]]></title>
      <link>https://www.uscis.gov/newsroom/news-releases/h2b-cap-test</link>
      <pubDate>Wed, 29 Apr 2026 11:00:00 -0400</pubDate>
    </item>
  </channel></rss>
`;

const visaIndexResponse = `
  <html>
    <body>
      <a href="/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-june-2026.html">June 2026</a>
    </body>
  </html>
`;

const visaPageResponse = `
  <html>
    <head><title>Visa Bulletin For June 2026 | Travel.State.Gov</title></head>
    <body><h1>Visa Bulletin For June 2026</h1></body>
  </html>
`;

global.fetch = async (url) => ({
  ok: true,
  async text() {
    const href = String(url);
    if (href.includes('rss-feed')) return uscisRssResponse;
    if (href.includes('visa-bulletin-for-june-2026')) return visaPageResponse;
    if (href.includes('visa-bulletin.html')) return visaIndexResponse;
    return '';
  }
});

async function testNews() {
  const { handler } = require('../netlify/functions/news.js');
  const response = await handler();
  assert.equal(response.statusCode, 200, 'news function should return 200');
  assert.match(response.headers['Cache-Control'], /s-maxage=3600/, 'news response should be CDN cached');

  const body = JSON.parse(response.body);
  assert.ok(body.disclaimer.includes('not a law firm'), 'disclaimer must preserve no-legal-advice language');
  assert.ok(Array.isArray(body.items), 'items must be an array');
  assert.ok(body.items.every((item) => item.title && item.url && item.source === 'USCIS'), 'news items must be USCIS headline/url/source objects');
  assert.ok(!body.items.some((item) => /Denaturalize 12 Individuals/i.test(item.title)), 'criminal/denaturalization headlines should not appear in homepage updates');
  assert.ok(body.items.some((item) => /H-2B Visas/i.test(item.title)), 'cap-reached USCIS headline must be included');
  assert.ok(!body.items.some((item) => /Agency Information Collection/i.test(item.title)), 'routine OMB paperwork notice leaked');
}

async function testVisaBulletin() {
  const { handler } = require('../netlify/functions/visa-bulletin.js');
  const response = await handler();
  assert.equal(response.statusCode, 200, 'visa bulletin function should return 200');
  assert.match(response.headers['Cache-Control'], /s-maxage=21600/, 'visa bulletin response should be CDN cached');

  const body = JSON.parse(response.body);
  assert.equal(body.source, 'U.S. Department of State', 'visa bulletin source must be official State Department');
  assert.match(body.title, /Visa Bulletin For June 2026/i, 'visa bulletin title should be extracted from official page');
  assert.match(body.url, /^https:\/\/travel\.state\.gov\/content\/travel\/en\/legal\/visa-law0\/visa-bulletin\/2026\/visa-bulletin-for-june-2026\.html$/, 'visa bulletin URL must be official');
  assert.ok(Array.isArray(body.legend) && body.legend.length >= 2, 'visa bulletin legend must explain C/U');
}

function testWiring() {
  const netlifyConfig = fs.readFileSync('netlify.toml', 'utf8');
  assert.ok(netlifyConfig.includes('from = "/api/news"'), 'netlify.toml must expose /api/news');
  assert.ok(netlifyConfig.includes('from = "/api/visa-bulletin"'), 'netlify.toml must expose /api/visa-bulletin');

  const astroHome = fs.readFileSync('astro-site/src/pages/index.astro', 'utf8');
  for (const component of ['HomeSearch', 'ServiceSections', 'LatestUpdates', 'VisaBulletin', 'WhyUs', 'Testimonials', 'FAQSection']) {
    assert.ok(astroHome.includes(component), `Astro homepage must include ${component}`);
  }

  const header = fs.readFileSync('astro-site/src/components/SiteHeader.astro', 'utf8');
  assert.ok(header.includes('tel:+19163993992'), 'header topbar must expose phone link');
  assert.ok(header.includes('Call/Text +1 (916) 399-3992'), 'header topbar must show international phone format');
}

async function main() {
  await testNews();
  await testVisaBulletin();
  testWiring();
  console.log('News and Visa Bulletin QA passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
