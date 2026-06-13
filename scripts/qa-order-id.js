#!/usr/bin/env node

const assert = require('assert');
const { makeOrderId } = require('../netlify/functions/lib/order-id');

const fixed = makeOrderId(
  new Date('2026-06-12T22:00:00.000Z'),
  () => Buffer.from([0, 1, 2, 3, 4, 5, 6, 7])
);

assert.strictEqual(fixed, 'IMV-260612-ABCDEFGH');

const ids = new Set();
for (let index = 0; index < 10000; index += 1) {
  const id = makeOrderId();
  assert.match(id, /^IMV-\d{6}-[A-HJ-NP-Z2-9]{8}$/);
  assert.strictEqual(id.length, 19);
  ids.add(id);
}

assert.strictEqual(ids.size, 10000, 'Order IDs must be unique in the QA sample');
console.log(`Order ID QA passed: ${ids.size} unique short references.`);
