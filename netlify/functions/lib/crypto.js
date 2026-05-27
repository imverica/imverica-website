/**
 * Shared crypto helpers for at-rest PII encryption.
 *
 * Goal: even if Netlify Blobs storage leaks (employee, vulnerability,
 * ATO), the dumped data is unreadable without DATA_ENCRYPTION_KEY which
 * lives only in the Netlify env. Plaintext records stay backward-readable
 * for the migration window.
 *
 * Encryption:  AES-256-GCM with a per-record random 96-bit IV.
 * Auth tag:    16 bytes, appended to ciphertext (standard GCM).
 * Encoding:    base64 in JSON object so the values survive Blobs / JSON
 *              transport untouched.
 *
 * Lookup:      because GCM is non-deterministic, you cannot filter records
 *              "by email" if email is encrypted. We add emailHash =
 *              HMAC-SHA256(normalized email, SESSION_SECRET) so account.js
 *              can match a session email to its records without ever
 *              decrypting unrelated records.
 *
 * Migration:   encryptObject stamps `_v: 2` on the record. Anything without
 *              that marker is treated as legacy plaintext by decryptObject —
 *              return as-is. Optional one-off migration can re-write
 *              existing records by reading and re-saving.
 */

const crypto = require('crypto');

const RECORD_VERSION = 2; // bump when encryption format changes

/**
 * Derive the AES-256 key from DATA_ENCRYPTION_KEY. Falls back to a dev key
 * only on localhost so `netlify dev` still works. In production, missing
 * DATA_ENCRYPTION_KEY throws — we fail closed instead of silently using a
 * predictable key.
 */
function dataKey(event) {
  const secret = process.env.DATA_ENCRYPTION_KEY;
  if (secret && secret.length >= 32) {
    return crypto.createHash('sha256').update(secret).digest();
  }
  const host = String(event?.headers?.host || event?.headers?.Host || '');
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return crypto.createHash('sha256').update('imverica-dev-data-key').digest();
  }
  throw new Error('DATA_ENCRYPTION_KEY is not configured on this deployment.');
}

/** Same idea for the HMAC lookup secret — uses SESSION_SECRET. */
function lookupSecret(event) {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 20) return s;
  const host = String(event?.headers?.host || event?.headers?.Host || '');
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'imverica-dev-session-secret-change-me';
  }
  throw new Error('SESSION_SECRET is not configured on this deployment.');
}

/** Normalize an email so it hashes consistently. */
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/** Stable, non-reversible hash used to filter records by email owner. */
function emailHash(email, event) {
  const norm = normalizeEmail(email);
  if (!norm) return '';
  return crypto.createHmac('sha256', lookupSecret(event)).update(norm).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Encrypt one string. Returns null for empty input so callers can no-op. */
function encryptString(plaintext, event) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  const key = dataKey(event);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    _enc: true,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64')
  };
}

/** Decrypt a string. Pass-through for plaintext / unsupported shapes. */
function decryptString(blob, event) {
  if (blob === null || blob === undefined) return blob;
  // Already plaintext (legacy or non-encrypted field) — return as-is.
  if (typeof blob !== 'object' || !blob._enc) return blob;
  try {
    const key = dataKey(event);
    const iv = Buffer.from(blob.iv, 'base64');
    const tag = Buffer.from(blob.tag, 'base64');
    const ct = Buffer.from(blob.ct, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch (err) {
    // Wrong key / tampered ciphertext — fail closed but return a placeholder
    // so the UI doesn't crash on a single bad record.
    console.error('decryptString failed:', err.message);
    return '[decryption-failed]';
  }
}

/**
 * Encrypt the listed dot-paths inside a record. Mutates a shallow clone.
 * Adds `_v: RECORD_VERSION` so the reader can tell encrypted from legacy.
 */
function encryptRecord(record, paths, event) {
  if (!record || typeof record !== 'object') return record;
  const out = JSON.parse(JSON.stringify(record));
  for (const path of paths) {
    const value = getPath(out, path);
    if (value === undefined || value === null || value === '') continue;
    setPath(out, path, encryptString(value, event));
  }
  out._v = RECORD_VERSION;
  return out;
}

/** Decrypt the listed dot-paths. Backward compatible with legacy plaintext. */
function decryptRecord(record, paths, event) {
  if (!record || typeof record !== 'object') return record;
  // Legacy plaintext — return as-is, callers see the same shape.
  if (!record._v) return record;
  const out = JSON.parse(JSON.stringify(record));
  for (const path of paths) {
    const value = getPath(out, path);
    setPath(out, path, decryptString(value, event));
  }
  return out;
}

// ----- dot-path helpers (minimal, no lodash) -----
function getPath(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}
function setPath(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  let cur = obj;
  for (const p of parts) {
    if (cur[p] === null || cur[p] === undefined || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[last] = value;
}

/**
 * Encrypt a binary Buffer (e.g. an uploaded PDF / image body). Returns a
 * tagged Buffer in the shape iv(12) || tag(16) || ciphertext so it can be
 * stored as a single blob and decrypted back to the original bytes.
 */
function encryptBuffer(plainBuffer, event) {
  const key = dataKey(event);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

/**
 * Decrypt an iv||tag||ciphertext blob produced by encryptBuffer. Returns
 * null on auth failure (so callers can fall back to legacy plaintext).
 * Distinguishes plaintext from encrypted by checking for a 4-byte magic
 * prefix is overkill — instead we mark the file as encrypted via metadata
 * (see upload.js fileEntry.enc flag).
 */
function decryptBuffer(blob, event) {
  if (!Buffer.isBuffer(blob) || blob.length < 28) return null;
  try {
    const key = dataKey(event);
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const ct = blob.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch (err) {
    console.error('decryptBuffer failed:', err.message);
    return null;
  }
}

module.exports = {
  RECORD_VERSION,
  emailHash,
  normalizeEmail,
  encryptString,
  decryptString,
  encryptRecord,
  decryptRecord,
  encryptBuffer,
  decryptBuffer
};
