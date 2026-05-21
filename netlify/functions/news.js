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

// Google News RSS aggregates headlines from every outlet (Bloomberg, Reuters,
// CNN, AP, BBC, CBS, CalMatters, law firms, etc.) filtered by a search query.
function gnews(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

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
  { tag: 'CA Law', kind: 'rss', url: CA_GOV_RSS },
  // Broad media coverage — only immigration/USCIS/EOIR and California-law topics.
  { tag: 'News', kind: 'gnews', url: gnews('(USCIS OR EOIR OR immigration OR visa OR asylum OR "green card" OR naturalization OR "work permit") when:21d') },
  { tag: 'News', kind: 'gnews', url: gnews('("California law" OR "Newsom signs" OR "California legislation" OR "California Courts" OR "California Senate Bill" OR "California Assembly Bill") when:30d') }
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

/** Media (Google News) must be on-topic: US immigration/USCIS/EOIR or CA law. */
const MEDIA_RELEVANT = new RegExp(
  [
    'uscis', 'immigrat', 'immigrant', 'visa', 'asylum', 'refugee', 'green card',
    'naturaliz', 'citizenship', 'eoir', 'deport', '\\btps\\b', 'daca',
    'work permit', 'employment authorization', 'h-1b', 'h-2b', 'parole',
    'adjustment of status', 'i-485', 'n-400', 'i-130', 'i-765', 'i-589',
    'california law', 'newsom', 'california legislation', 'california court',
    'california senate bill', 'california assembly bill'
  ].join('|'),
  'i'
);

/** Media noise: blogs/marketing, non-US migration, opinion fluff. */
const MEDIA_NOISE = new RegExp(
  [
    'law review', 'symposium', 'webinar', 'podcast', 'sponsored', 'advertis',
    'how to', 'best lawyers', 'proud to support',
    '\\buk\\b', 'u\\.k\\.', 'britain', 'canada', 'australia', 'thailand',
    'schengen', 'tourist visa', 'golden visa', 'dubai', '\\buae\\b',
    'passport rank', 'small boats', 'channel crossing', 'eu migration',
    // tech/AI/entertainment policy — not relevant to Imverica clients
    'artificial intelligence', 'ai disruption', 'ai job', 'ai-driven',
    'job displacement', 'chatbot',
    // Visa Inc. (payment brand), not immigration visas
    'men in blazers', 'visa team', 'visa direct', 'visa card', 'visa inc',
    'payment network', 'credit card'
  ].join('|'),
  'i'
);

const DISCLAIMER =
  'Official announcements from USCIS, immigration courts (EOIR), and California, plus ' +
  'headlines from major news outlets — linked verbatim to each source. Imverica Legal ' +
  'Solutions is not a law firm and does not provide legal advice. Always verify with the source.';

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

function parseGNews(xml) {
  const items = [];
  const blocks = String(xml || '').split(/<item[\s>]/i).slice(1);
  for (const block of blocks) {
    const titleM = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkM = block.match(/<link>([\s\S]*?)<\/link>/i);
    const dateM = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const srcM = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    if (!titleM || !linkM) continue;
    let title = decodeEntities(titleM[1]).replace(/\s+/g, ' ');
    let outlet = srcM ? decodeEntities(srcM[1]) : '';
    // Google News titles end with " - Outlet"; use it as the source, strip from title.
    if (!outlet) {
      const m = title.match(/^(.*) - ([^-]{2,40})$/);
      if (m) { title = m[1].trim(); outlet = m[2].trim(); }
    } else if (title.endsWith(` - ${outlet}`)) {
      title = title.slice(0, -(` - ${outlet}`).length).trim();
    }
    const date = dateM ? toDate(decodeEntities(dateM[1])) : null;
    items.push({ source: outlet || 'News', origin: 'gnews', title, url: decodeEntities(linkM[1]), date: date ? formatDate(date) : '', ts: date ? date.getTime() : 0 });
  }
  return items;
}

async function fetchSource(src) {
  try {
    const res = await fetch(src.url, {
      headers: { Accept: 'application/rss+xml,application/json,text/xml,*/*', 'User-Agent': 'ImvericaNewsBot/1.0 (+https://imverica.com)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (src.kind === 'fedreg') return parseFedReg(text, src.tag);
    if (src.kind === 'gnews') return parseGNews(text);
    return parseRss(text, src.tag);
  } catch {
    return [];
  }
}

function keep(item) {
  if (!item.title || !item.url) return false;
  if (ROUTINE_NOTICE.test(item.title)) return false;   // no OMB paperwork
  if (BLOCKED_NEWS.test(item.title)) return false;      // no criminal/violence/unrest
  if (item.origin === 'gnews') {
    // Media: must be on-topic and not blog/marketing/foreign noise.
    if (!MEDIA_RELEVANT.test(item.title)) return false;
    if (MEDIA_NOISE.test(item.title)) return false;
    return true;
  }
  if (item.source === 'White House' && !IMMIG.test(item.title)) return false;
  if (item.source === 'CA Law' && (CA_POLITICS.test(item.title) || !CA_BENEFIT.test(item.title))) return false;
  return true;
}

exports.handler = async () => {
  const settled = await Promise.allSettled(SOURCES.map(fetchSource));
  const all = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  // Dedup by URL and by a normalized title key (collapses the same story
  // syndicated across many outlets).
  const titleKey = (t) => String(t).toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 5).join(' ');
  const seen = new Set();
  const seenTitles = new Set();
  const items = all
    .filter(keep)
    .filter((item) => {
      const tk = titleKey(item.title);
      if (seen.has(item.url) || seenTitles.has(tk)) return false;
      seen.add(item.url);
      seenTitles.add(tk);
      return true;
    })
    .sort((a, b) => (b.ts - a.ts) || (PRIORITY.test(b.title) - PRIORITY.test(a.title)))
    .slice(0, 12)
    .map(({ ts, origin, ...item }) => item);

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
