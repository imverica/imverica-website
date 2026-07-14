const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

/**
 * Client-facing order ids: IMVERICA-20260714-25
 *
 * The date is the PACIFIC business day (the business is Californian and
 * every timestamp we show clients is PT). The trailing number is a per-day
 * sequence that deliberately STARTS AT 25 — owner's call: a fresh lead
 * should never look like the day's first — and grows 26, 27… with each
 * request that day.
 *
 * The counter lives in the imverica-intakes blob store under
 * `counters/day-<stamp>.json` (never clashes with `order/` / `orders/`
 * record prefixes). Read-modify-write is NOT atomic — @netlify/blobs 8.x
 * has no conditional writes — so two truly simultaneous submissions could
 * mint the same id. At the current volume that risk is accepted; revisit
 * with onlyIfMatch once the store client supports it.
 */
const SEQ_START = 25;

function ptDateStamp(now = new Date()) {
  // en-CA locale renders YYYY-MM-DD; strip dashes → 20260714.
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).replace(/-/g, '');
}

async function nextDailySeq(stamp) {
  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    const { getStore } = require('@netlify/blobs');
    const store = getStore('imverica-intakes');
    const key = `counters/day-${stamp}.json`;
    const cur = await store.get(key, { type: 'json' }).catch(() => null);
    const n = (cur && Number(cur.n) >= SEQ_START ? Number(cur.n) : SEQ_START - 1) + 1;
    await store.setJSON(key, { n, updatedAt: new Date().toISOString() });
    return n;
  }
  // Local dev — a tmpdir counter file keeps the sequence behaving the same.
  const dir = path.join(os.tmpdir(), 'imverica-intakes');
  const file = path.join(dir, `day-${stamp}.txt`);
  await fs.mkdir(dir, { recursive: true });
  let n = SEQ_START;
  try {
    const prev = parseInt(await fs.readFile(file, 'utf8'), 10);
    if (Number.isFinite(prev) && prev >= SEQ_START) n = prev + 1;
  } catch { /* first order of the day */ }
  await fs.writeFile(file, String(n));
  return n;
}

async function makeOrderId(now = new Date()) {
  const stamp = ptDateStamp(now);
  let seq;
  try {
    seq = await nextDailySeq(stamp);
  } catch (e) {
    // Counter store hiccup — never block an intake over a vanity sequence.
    // Park the fallback far above any plausible daily count so it cannot
    // collide with sequential ids minted the same day.
    console.error('[order-id] counter failed, using fallback seq', e && e.message);
    seq = 900 + (crypto.randomBytes(1)[0] % 100);
  }
  return `IMVERICA-${stamp}-${seq}`;
}

module.exports = { makeOrderId, ptDateStamp, SEQ_START };
