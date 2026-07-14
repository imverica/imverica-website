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
 * Allocation hazard, PROVEN on prod 2026-07-14 (two sequential test intakes
 * both minted -25, the second overwrote the first order record): Netlify
 * Blobs reads are EVENTUALLY consistent — a read minutes after a write can
 * return a stale cached value, so read-modify-write double-allocates. And
 * strong consistency is NOT available in this runtime: connectLambda()
 * (lib/abuse-guard ensureBlobs) configures only edgeURL, no uncachedEdgeURL,
 * so consistency:'strong' throws BlobsConsistencyError.
 *
 * The fix relies on none of that: each sequence number is CLAIMED with an
 * ATOMIC conditional write — setJSON(claimKey, …, { onlyIfNew: true })
 * (@netlify/blobs v10) — which the origin enforces regardless of read
 * staleness. `modified: false` means the number is taken → walk to the
 * next one. The day-pointer blob is only an advisory starting point.
 */
const SEQ_START = 25;
const MAX_CLAIM_WALK = 40;

function ptDateStamp(now = new Date()) {
  // en-CA locale renders YYYY-MM-DD; strip dashes → 20260714.
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).replace(/-/g, '');
}

async function nextDailySeq(stamp) {
  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    const { getStore } = require('@netlify/blobs');
    const store = getStore('imverica-intakes');
    const dayKey = `counters/day-${stamp}.json`;
    const cur = await store.get(dayKey, { type: 'json' }).catch(() => null);
    let n = (cur && Number(cur.n) >= SEQ_START ? Number(cur.n) : SEQ_START - 1) + 1;
    const token = crypto.randomBytes(8).toString('hex');
    for (let walk = 0; walk < MAX_CLAIM_WALK; walk += 1, n += 1) {
      const claimKey = `counters/claim-${stamp}-${n}.json`;
      // NB: store.set(), NOT setJSON — @netlify/blobs 10.7.9 has a bug where
      // setJSON spreads the conditions object into the request options
      // (`...conditions` instead of `conditions`), silently DROPPING
      // onlyIfNew. set() passes it correctly. Verified against the local
      // BlobsServer; re-check when upgrading the package.
      const res = await store.set(claimKey, JSON.stringify({ token }), { onlyIfNew: true });
      if (!res || res.modified !== true) continue; // number taken — walk on
      // Belt and suspenders: read the claim back and make sure it holds OUR
      // token. Guards the TOCTOU window of non-atomic conditional writes
      // (the local dev BlobsServer has one; prod enforces at the origin).
      // The claim key is brand-new, so this read cannot be a stale cache hit.
      const own = await store.get(claimKey, { type: 'json' }).catch(() => null);
      if (!own || own.token !== token) continue; // lost the race — walk on
      // Claimed atomically. The day pointer is advisory; being eventually
      // consistent (or lost) only costs future requests a longer walk.
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
