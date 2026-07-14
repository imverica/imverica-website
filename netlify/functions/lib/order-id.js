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
 * record prefixes).
 *
 * Two hazards, both PROVEN on prod 2026-07-14 (two sequential test intakes
 * both minted -25, the second overwrote the first order record):
 *   1. Netlify Blobs reads are EVENTUALLY consistent by default — a read
 *      minutes after a write can return the stale cached value. Fix: the
 *      store is opened with consistency:'strong'.
 *   2. @netlify/blobs 8.x has no compare-and-swap, so read-modify-write
 *      alone can double-allocate under concurrency. Fix: each sequence
 *      number is CLAIMED via a token blob (`counters/claim-<stamp>-<n>`)
 *      that is written then read back; if the read-back shows another
 *      submission's token, we lost the race and walk to the next number.
 */
const SEQ_START = 25;
const MAX_CLAIM_WALK = 12;

function ptDateStamp(now = new Date()) {
  // en-CA locale renders YYYY-MM-DD; strip dashes → 20260714.
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).replace(/-/g, '');
}

async function nextDailySeq(stamp) {
  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'imverica-intakes', consistency: 'strong' });
    const dayKey = `counters/day-${stamp}.json`;
    const cur = await store.get(dayKey, { type: 'json' }).catch(() => null);
    let n = (cur && Number(cur.n) >= SEQ_START ? Number(cur.n) : SEQ_START - 1) + 1;
    const token = crypto.randomBytes(8).toString('hex');
    for (let walk = 0; walk < MAX_CLAIM_WALK; walk += 1, n += 1) {
      const claimKey = `counters/claim-${stamp}-${n}.json`;
      const taken = await store.get(claimKey, { type: 'json' }).catch(() => null);
      if (taken) continue; // already claimed (stale day pointer) — walk on
      await store.setJSON(claimKey, { token });
      const check = await store.get(claimKey, { type: 'json' }).catch(() => null);
      if (!check || check.token !== token) continue; // lost a race — walk on
      // The day pointer is advisory (a starting point for the walk); the
      // claim blob above is what actually owns the number.
      await store.setJSON(dayKey, { n, updatedAt: new Date().toISOString() }).catch(() => {});
      return n;
    }
    throw new Error(`could not claim a sequence number after ${MAX_CLAIM_WALK} attempts`);
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
