/**
 * Official immigration & California news feed for Imverica.
 *
 * Republishes only the official headline, date, and source link — no
 * summaries, no interpretation, no legal advice (UPL-safe). Sources:
 *   - USCIS Newsroom RSS (press releases)
 *   - Federal Register API — EOIR (immigration courts)
 *   - Federal Register API — Presidential documents (immigration only)
 *   - California Governor RSS — life-easing legislation only (CA Law lane)
 *
 * Editorial policy (per owner): show policy, forms, fees, caps, statistics,
 * EOIR court actions, immigration proclamations, and consumer-relevant new
 * California laws (medical, family/divorce, probate, records, housing).
 * EXCLUDE criminal/enforcement spectacle, civil-unrest/political noise, and
 * routine OMB paperwork.
 *
 * Serverless function, NOT a build — never triggers a deploy, zero build
 * minutes. Cache-Control lets the CDN serve a cached copy so upstream feeds
 * are hit at most once per hour regardless of traffic.
 */

const USCIS_RSS = 'https://www.uscis.gov/news/rss-feed/59144';
const FED = 'https://www.federalregister.gov/api/v1/documents.json';
const CA_GOV_RSS = 'https://www.gov.ca.gov/feed/';

const SOURCES = [
  { tag: 'USCIS', kind: 'rss', url: USCIS_RSS },
  {
    tag: 'EOIR',
    kind: 'fedreg',
    url: `${FED}?conditions%5Bagencies%5D%5B%5D=executive-office-for-immigration-review&order=newest&per_page=8&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url`
  },
  {
    tag: 'White House',
    kind: 'fedreg',
    url: `${FED}?conditions%5Btype%5D%5B%5D=PRESDOCU&conditions%5Bterm%5D=immigration&order=newest&per_page=8&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url`
  },
  { tag: 'CA Law', kind: 'rss', url: CA_GOV_RSS }
];

const ROUTINE_NOTICE = new RegExp(
  [
    'agency information collection',
    'paperwork reduction act',
    'omb control number',
    'currently approved collection',
    'extension, without change',
    'revision of a currently approved collection',
    '30-day notice',
    '60-day notice',
    'comment request'
  ].join('|'),
  'i'
);

const PRIORITY = new RegExp(
  [
    'cap reached', 'fee', 'asylum', 'refugee', 'tps', 'daca', 'parole',
    'green card', 'citizenship', 'naturalization', 'work authorization',
    'employment authorization', 'h-1b', 'h-2b', 'filing', 'form', 'policy',
    'rule', 'deadline', 'temporary protected status', 'visa bulletin'
  ].join('|'),
  'i'
);

/** Criminal / violence / enforcement-spectacle — never shown. */
const BLOCKED_NEWS = new RegExp(
  [
    'denaturaliz', '\\bdoj\\b', 'fraud', 'terror', 'war crime', 'espionage',
    'sexual', 'human trafficking', 'traffick', 'gang', 'ms-13', 'cartel',
    'sentenc', 'prison', 'convict', 'guilty', 'plea', 'indict', 'felon',
    'arrest', 'raid', 'smuggl', 'weapon', 'shoot', 'violen', 'murder',
    'manhunt', 'fugitive', 'crackdown', 'prosecut', 'charged', 'revoke',
    'mastermind', 'criminal', 'riot', 'protest', 'clash', 'unrest'
  ].join('|'),
  'i'
);

/** Presidential docs matched loosely upstream — require an immigration word. */
const IMMIG = new RegExp(
  [
    'immigrat', 'immigrant', 'visa', 'asylum', 'refugee', 'naturaliz',
    'citizenship', 'green card', 'permanent resident', 'border', 'daca',
    '\\btps\\b', 'parole', 'work permit', 'employment authorization',
    'adjustment of status', 'deferred action', 'h-1b', 'h-2', 'alien'
  ].join('|'),
  'i'
);

/**
 * CA Governor feed is mostly politics, disaster response, appointments, and
 * statements on tragedies. For the CA Law lane keep ONLY items about new
 * laws/programs that ease life in the areas Imverica serves.
 */
const CA_BENEFIT = new RegExp(
  [
    'signs? (?:bill|legislation|law|package)', 'new law', 'new protections?',
    'protect(?:s|ion|ing)?', 'relief', 'expand(?:s|ing)?', 'lower(?:s|ing)? cost',
    'reduce(?:s|d)? cost', 'fee waiver', 'eligib', 'simplif', 'streamlin',
    'easier', 'access to', 'rebate', 'refund', 'tenant', 'renter', 'consumer',
    'debt', 'rent cap', 'eviction protection', 'student debt', 'paid leave',
    'workers? right', 'wage', 'expunge', 'seal(?:s|ing)? record',
    'clear(?:s|ing)? record', 'name change', 'driver(?:’|\')?s? licens',
    'medical', 'health care', 'healthcare', 'prescription', 'hospital',
    'medi-?cal', 'insurance', 'mental health', 'divorce', 'dissolution',
    'custody', 'child support', 'spousal support', 'domestic violence',
    'restraining order', 'famil', 'probate', 'estate', 'inheritance',
    'conservator', 'guardian'
  ].join('|'),
  'i'
);

const CA_POLITICS = new RegExp(
  [
    'trump', 'newsom advocates', 'derangement', 'national guard', 'lawsuit',
    '\\bsues?\\b', '\\bsuing\\b', 'deployment', 'statement on', 'passing of',
    'appointments?', 'federal assistance', 'disaster', 'fire', 'shooting',
    'washington', 'crisis response', 'nimby'
  ].join('|'),
  'i'
);

const DISCLAIMER =
  'Official government announcements from USCIS, immigration courts (EOIR), and California, ' +
  'linked verbatim for convenience. Imverica Legal Solutions is not a law firm and does not ' +
  'provide legal advice. Always verify details with the linked official source.';

function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
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
    .replace(/&#160;/g, ' ')
    .trim();
}

function toDate(value) {
  let date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() < 1970) date = new Date(date.getFullYear() + 100, date.getMonth(), date.getDate());
  return date;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function parseRss(xml, tag) {
  const items = [];
  const blocks = String(xml || '').split(/<item[\s>]/i).slice(1);
  for (const block of blocks) {
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
    const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    if (!titleMatch || !linkMatch) continue;
    const title = decodeEntities(titleMatch[1]).replace(/\s+/g, ' ');
    const url = decodeEntities(linkMatch[1]);
    const date = dateMatch ? toDate(decodeEntities(dateMatch[1])) : null;
    items.push({ source: tag, title, url, date: date ? formatDate(date) : '', ts: date ? date.getTime() : 0 });
  }
  return items;
}

function parseFedReg(jsonText, tag) {
  let data;
  try { data = JSON.parse(jsonText); } catch { return []; }
  const results = Array.isArray(data.results) ? data.results : [];
  return results
    .map((r) => {
      const date = toDate(r.publication_date);
      return {
        source: tag,
        title: decodeEntities(r.title).replace(/\s+/g, ' '),
        url: r.html_url,
        date: date ? formatDate(date) : '',
        ts: date ? date.getTime() : 0
      };
    })
    .filter((it) => it.title && it.url);
}

async function fetchSource(src) {
  try {
    const res = await fetch(src.url, {
      headers: { Accept: 'application/rss+xml,application/json,text/xml,*/*', 'User-Agent': 'ImvericaNewsBot/1.0 (+https://imverica.com)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const text = await res.text();
    return src.kind === 'fedreg' ? parseFedReg(text, src.tag) : parseRss(text, src.tag);
  } catch {
    return [];
  }
}

function keep(item) {
  if (!item.title || !item.url) return false;
  if (ROUTINE_NOTICE.test(item.title)) return false;   // no OMB paperwork
  if (BLOCKED_NEWS.test(item.title)) return false;      // no criminal/violence/unrest
  if (item.source === 'White House' && !IMMIG.test(item.title)) return false;
  if (item.source === 'CA Law' && (CA_POLITICS.test(item.title) || !CA_BENEFIT.test(item.title))) return false;
  return true;
}

exports.handler = async () => {
  const settled = await Promise.allSettled(SOURCES.map(fetchSource));
  const all = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  const seen = new Set();
  const items = all
    .filter(keep)
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .map((item) => ({ ...item, priority: PRIORITY.test(item.title) ? 1 : 0 }))
    .sort((a, b) => (b.priority - a.priority) || (b.ts - a.ts))
    .slice(0, 10)
    .map(({ priority, ts, ...item }) => item);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
    },
    body: JSON.stringify({ disclaimer: DISCLAIMER, updated: new Date().toISOString(), items })
  };
};
