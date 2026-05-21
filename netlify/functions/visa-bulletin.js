/**
 * U.S. Department of State Visa Bulletin tracker.
 *
 * Pulls the current bulletin link from the official State Department index and
 * returns a small payload for the public homepage. This endpoint does not
 * interpret priority dates or provide legal advice.
 */

const INDEX_URL = 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html';
const BASE = 'https://travel.state.gov';

const DISCLAIMER =
  'Official U.S. Department of State Visa Bulletin information, linked for convenience. ' +
  'Imverica Legal Solutions is not a law firm and does not provide legal advice.';

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function absoluteUrl(href) {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  return BASE + (href.startsWith('/') ? href : `/${href}`);
}

function titleFromUrl(url) {
  const slug = String(url || '').match(/visa-bulletin-for-([^/.]+)\.html/i)?.[1] || '';
  if (!slug) return 'Latest Visa Bulletin';
  return 'Visa Bulletin for ' + slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function extractFirstBulletin(indexHtml) {
  const matches = [...String(indexHtml || '').matchAll(/href=["']([^"']*visa-bulletin-for-[^"']+\.html)["']/gi)];
  if (!matches.length) return '';
  return absoluteUrl(decodeEntities(matches[0][1]));
}

function extractPageTitle(html, fallback) {
  const h1 = decodeEntities(String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' '));
  if (h1 && /visa bulletin/i.test(h1)) return h1.replace(/\s+/g, ' ');
  const title = decodeEntities(String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, ' '));
  if (title && /visa bulletin/i.test(title)) return title.replace(/\s*\|\s*Travel\.State\.Gov\s*$/i, '').trim();
  return fallback;
}

exports.handler = async () => {
  try {
    const indexResponse = await fetch(INDEX_URL, {
      headers: { Accept: 'text/html,*/*', 'User-Agent': 'ImvericaVisaBulletinBot/1.0 (+https://imverica.com)' },
      signal: AbortSignal.timeout(9000)
    });
    if (!indexResponse.ok) throw new Error(`Visa Bulletin index failed: ${indexResponse.status}`);

    const indexHtml = await indexResponse.text();
    const url = extractFirstBulletin(indexHtml);
    if (!url) throw new Error('No Visa Bulletin link found');

    const pageResponse = await fetch(url, {
      headers: { Accept: 'text/html,*/*', 'User-Agent': 'ImvericaVisaBulletinBot/1.0 (+https://imverica.com)' },
      signal: AbortSignal.timeout(9000)
    });
    const pageHtml = pageResponse.ok ? await pageResponse.text() : '';
    const title = extractPageTitle(pageHtml, titleFromUrl(url));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400'
      },
      body: JSON.stringify({
        source: 'U.S. Department of State',
        title,
        url,
        updated: new Date().toISOString(),
        note: 'Check both Final Action Dates and Dates for Filing on the official bulletin before relying on priority-date movement.',
        legend: ['C means current', 'U means unavailable', 'Dates vary by preference category and country of chargeability'],
        disclaimer: DISCLAIMER
      })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      },
      body: JSON.stringify({
        source: 'U.S. Department of State',
        title: 'Visa Bulletin temporarily unavailable',
        url: INDEX_URL,
        updated: new Date().toISOString(),
        note: 'Open the official State Department Visa Bulletin index to check current priority-date tables.',
        legend: ['C means current', 'U means unavailable'],
        disclaimer: DISCLAIMER
      })
    };
  }
};
