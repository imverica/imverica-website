/**
 * TOTP (RFC 6238) + HOTP (RFC 4226) helpers — implemented inline so we
 * don't add an npm dep to Netlify Functions.
 *
 * Compatible with Google Authenticator, Authy, 1Password, Microsoft
 * Authenticator (default algorithm SHA-1, 6 digits, 30-second period).
 *
 * Secret format: base32 (RFC 4648), unpadded. That's what Authenticator
 * apps expect in the `secret` URI parameter.
 *
 * Verification window: ±1 step (30s before + 30s after) to tolerate phone
 * clock drift. Replay protection is the caller's job — store the last
 * successful step and reject a code at or below it.
 */

const crypto = require('crypto');

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // accept current ±1 step

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function bytesToBase32(bytes) {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);
    if (chunk.length < 5) {
      out += B32_ALPHABET[parseInt(chunk.padEnd(5, '0'), 2)];
    } else {
      out += B32_ALPHABET[parseInt(chunk, 2)];
    }
  }
  return out;
}

function base32ToBytes(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    out.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(out);
}

/** Generate a fresh 20-byte (160-bit) secret, returned as base32 text. */
function generateSecret() {
  return bytesToBase32(crypto.randomBytes(20));
}

/** RFC 4226 HOTP. counter is an 8-byte big-endian uint. */
function hotp(secretBytes, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBytes).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** Verify a 6-digit TOTP code against a base32 secret. */
function verifyTOTP(secret, code, opts = {}) {
  const window = opts.window === undefined ? WINDOW : Math.max(0, Math.min(5, opts.window));
  const cleanCode = String(code || '').replace(/\D/g, '').slice(0, DIGITS);
  if (cleanCode.length !== DIGITS) return false;
  const bytes = base32ToBytes(secret);
  if (!bytes.length) return false;
  const step = Math.floor(Date.now() / 1000 / PERIOD_SECONDS);
  for (let w = -window; w <= window; w++) {
    if (hotp(bytes, step + w) === cleanCode) return true;
  }
  return false;
}

/**
 * Build an `otpauth://` URI for QR-code generation.
 * Example: otpauth://totp/Imverica:client@x.com?secret=ABCD&issuer=Imverica
 */
function otpauthURL({ label, secret, issuer = 'Imverica' }) {
  const enc = encodeURIComponent;
  const encodedLabel = enc(issuer) + ':' + enc(label);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(PERIOD_SECONDS) });
  return `otpauth://totp/${encodedLabel}?${params.toString()}`;
}

/** 8 ten-character recovery codes (Crockford alphabet, no ambiguous chars). */
function generateRecoveryCodes(count = 8) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/1/I/L/O
  const codes = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(10);
    let s = '';
    for (const b of raw) s += alphabet[b % alphabet.length];
    codes.push(s.slice(0, 5) + '-' + s.slice(5));
  }
  return codes;
}

function hashRecoveryCode(code) {
  const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(clean).digest('hex');
}

module.exports = {
  generateSecret,
  verifyTOTP,
  otpauthURL,
  generateRecoveryCodes,
  hashRecoveryCode,
  PERIOD_SECONDS,
  DIGITS
};
