#!/usr/bin/env node
'use strict';
/**
 * QA — sequential order ids (lib/order-id.js).
 *
 * Format IMVERICA-YYYYMMDD-N where the date is the PACIFIC day and N is a
 * per-day sequence starting at 25 (owner's request, 2026-07-14), then
 * 26, 27… Exercises the local tmpdir counter path (the blob path runs the
 * same logic against the imverica-intakes store).
 *
 * Run: node scripts/qa-order-id.js
 */

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { makeOrderId, ptDateStamp, SEQ_START } = require('../netlify/functions/lib/order-id');

let pass = 0;
let fail = 0;
function assert(label, cond, extra) {
  if (cond) { pass++; } else { fail++; console.error(`FAIL ${label}${extra ? ' — ' + extra : ''}`); }
}

(async () => {
  // PT day boundary: 02:00 UTC on Jul 15 is still 19:00 Jul 14 in California.
  assert('PT date stamp', ptDateStamp(new Date('2026-07-15T02:00:00Z')) === '20260714',
    ptDateStamp(new Date('2026-07-15T02:00:00Z')));
  assert('PT same day', ptDateStamp(new Date('2026-07-14T18:00:00Z')) === '20260714');

  // Fresh synthetic day (far future so real tmp state never collides).
  const fakeNow = new Date('2031-01-02T20:00:00Z'); // 12:00 PT Jan 2, 2031
  const stamp = ptDateStamp(fakeNow);
  await fs.rm(path.join(os.tmpdir(), 'imverica-intakes', `day-${stamp}.txt`), { force: true });

  const first = await makeOrderId(fakeNow);
  const second = await makeOrderId(fakeNow);
  const third = await makeOrderId(fakeNow);
  assert(`first of the day is ${SEQ_START}`, first === `IMVERICA-${stamp}-${SEQ_START}`, first);
  assert('second increments', second === `IMVERICA-${stamp}-${SEQ_START + 1}`, second);
  assert('third increments', third === `IMVERICA-${stamp}-${SEQ_START + 2}`, third);
  assert('format regex', /^IMVERICA-\d{8}-\d+$/.test(first));

  // A different PT day starts back at SEQ_START.
  const nextDay = new Date('2031-01-03T20:00:00Z');
  const nextStamp = ptDateStamp(nextDay);
  await fs.rm(path.join(os.tmpdir(), 'imverica-intakes', `day-${nextStamp}.txt`), { force: true });
  assert('new day resets', (await makeOrderId(nextDay)) === `IMVERICA-${nextStamp}-${SEQ_START}`);

  // Survives the admin/account sanitizers ([A-Za-z0-9_-], ≤64 chars).
  assert('sanitizer-safe', first.replace(/[^A-Za-z0-9_-]/g, '') === first && first.length <= 64);

  console.log(`\nqa-order-id: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
