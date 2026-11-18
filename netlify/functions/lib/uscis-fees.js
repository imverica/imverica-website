/**
 * Current USCIS filing fees from the official Fee Schedule, Form G-1055.
 *
 * uscis.gov/g-1055 lists every form in a drop-down whose option values are
 * internal topic ids (data-marker holds the form code, e.g. "i-485"). The
 * page rendered with ?topic_id=<id> contains that form's fee table:
 * Filing Category | Paper Filing Fee | Online Filing Fee. The first row is
 * the general filing category.
 *
 * Used by functions/uscis-fees.js (live, cached on the CDN) and by
 * scripts/update-uscis-fees.js (the snapshot the site is built with).
 */

const BASE = 'https://www.uscis.gov/g-1055';
const UA = 'Mozilla/5.0 (compatible; ImvericaFeeCheck/1.0; +https://imverica.com/pricing)';

/** Forms shown on the pricing pages, with their G-1055 drop-down marker. */
const FEE_FORMS = [
  { code: 'I-90', marker: 'i-90' },
  { code: 'I-765', marker: 'i-765' },
  { code: 'I-131', marker: 'i-131_reentrypermit' },
  { code: 'I-864', marker: 'i-864' },
  { code: 'I-693', marker: 'i-693' },
  { code: 'G-639', marker: 'g-639' },
  { code: 'AR-11', marker: 'ar-11' },
  { code: 'I-130', marker: 'i-130' },
  { code: 'I-485', marker: 'i-485' },
  { code: 'I-751', marker: 'i-751' },
  { code: 'N-400', marker: 'n-400' },
  { code: 'I-824', marker: 'i-824' },
  { code: 'I-589', marker: 'i-589' }
];

/** Topic ids seen on 2026-11-18; the live drop-down wins when it loads. */
const KNOWN_IDS = { 'ar-11': '97243', 'g-639': '97248', 'i-90': '97259', 'i-130': '97270', 'i-485': '97286', 'i-765': '97312', 'n-400': '97352', 'i-131_reentrypermit': '99064' };

const decode = (s) => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;|&#8217;/g, '’').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

const money = (s) => {
  const m = decode(s).match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};

/** Marker → topic id from the G-1055 drop-down. */
function parseTopicIds(html) {
  const ids = {};
  for (const hit of html.matchAll(/<option\s+value="(\d+)"\s+data-marker="([^"]+)"/gi)) {
    ids[hit[2].toLowerCase()] = hit[1];
  }
  return ids;
}

/**
 * The fee table of one form page: { title, rows: [{ category, paper, online, fee }] }.
 * Returns null when the page has no fee table.
 */
function parseFeeTable(html) {
  const body = html.indexOf('form-fee-body');
  if (body < 0) return null;
  const titles = [...html.slice(0, body).matchAll(/<h2[^>]*class="form-fee-title"[^>]*>([\s\S]*?)<\/h2>/g)];
  const titleMatch = titles[titles.length - 1];
  const table = html.slice(body).match(/<table[\s\S]*?<\/table>/);
  if (!table) return null;
  const heads = [...table[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => decode(m[1]).toLowerCase());
  const col = (re) => heads.findIndex((h) => re.test(h));
  const paperCol = col(/paper/);
  const onlineCol = col(/online/);
  const feeCol = paperCol >= 0 ? paperCol : col(/fee/);
  const rows = [];
  for (const tr of table[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (!cells.length) continue;
    rows.push({
      category: decode(cells[0]),
      paper: paperCol >= 0 ? money(cells[paperCol]) : null,
      online: onlineCol >= 0 ? money(cells[onlineCol]) : null,
      fee: feeCol >= 0 ? money(cells[feeCol]) : null
    });
  }
  if (!rows.length) return null;
  // Fees required by Pub. L. 119-21 are listed apart from the USCIS fee and
  // are paid in addition to it (e.g. the annual asylum fee).
  const extraFees = /119-21/.test(html.slice(body, body + 60000));
  return { title: titleMatch ? decode(titleMatch[1]) : '', rows, extraFees };
}

/** The headline fee of a parsed table: its first row (general filing). */
function mainFee(table) {
  if (!table || !table.rows.length) return null;
  const row = table.rows[0];
  const paper = row.paper ?? row.fee;
  if (paper === null || paper === undefined) return null;
  // Category text: the first sentence only, and none when the cell is just an amount.
  let category = /^\$/.test(row.category) ? '' : row.category.split(/(?<=[.)])\s/)[0];
  if (category.length > 90) category = category.slice(0, 87).replace(/\s+\S*$/, '') + '…';
  return { paper, online: row.online, category, title: table.title, extraFees: Boolean(table.extraFees) };
}

async function get(url, fetchImpl, timeoutMs) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/**
 * Fetch the current fee of every pricing-page form.
 * Returns { checked, source, fees: { 'I-485': { paper, online, category, title, url } }, errors }.
 */
async function fetchUscisFees({ fetchImpl = fetch, timeoutMs = 8000, concurrency = 4 } = {}) {
  const errors = [];
  let ids = { ...KNOWN_IDS };
  try {
    ids = { ...ids, ...parseTopicIds(await get(BASE, fetchImpl, timeoutMs)) };
  } catch (err) {
    errors.push(`drop-down: ${err.message}`);
  }
  const fees = {};
  const queue = FEE_FORMS.slice();
  async function worker() {
    for (let form = queue.shift(); form; form = queue.shift()) {
      const id = ids[form.marker];
      if (!id) { errors.push(`${form.code}: no topic id`); continue; }
      const url = `${BASE}?topic_id=${id}`;
      try {
        const fee = mainFee(parseFeeTable(await get(url, fetchImpl, timeoutMs)));
        if (fee) fees[form.code] = { ...fee, url };
        else errors.push(`${form.code}: no fee table`);
      } catch (err) {
        errors.push(`${form.code}: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { checked: new Date().toISOString(), source: BASE, fees, errors };
}

/** Public G-1055 page with the form preselected (what visitors click). */
function feePageUrl(code) {
  return `${BASE}?form=${String(code).toLowerCase()}`;
}

module.exports = { FEE_FORMS, fetchUscisFees, parseFeeTable, parseTopicIds, mainFee, feePageUrl };
