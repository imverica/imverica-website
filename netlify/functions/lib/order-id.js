const crypto = require('crypto');

// Eight characters from a 32-character, human-friendly alphabet provide
// 40 bits of randomness while keeping references short enough to read aloud.
const ORDER_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeOrderId(now = new Date(), randomBytes = crypto.randomBytes) {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const bytes = randomBytes(8);
  let suffix = '';

  for (let index = 0; index < 8; index += 1) {
    suffix += ORDER_ID_ALPHABET[bytes[index] & 31];
  }

  return `IMV-${date}-${suffix}`;
}

module.exports = { makeOrderId };
