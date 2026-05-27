/**
 * Shared per-email profile store with at-rest AES-256-GCM encryption.
 *
 * Used by:
 *   - profile.js  → reads/writes name, phone, legal name
 *   - auth.js     → reads/writes TOTP secret, recovery codes, 2FA flag
 *
 * Storage key: `profile/${sha256(email)}.json` in the `imverica-profiles`
 * Netlify Blobs store (filesystem fallback for local dev). Each blob holds
 * one encrypt() envelope of the merged profile object. Encryption keys are
 * derived from DATA_ENCRYPTION_KEY (with SESSION_SECRET fallback for legacy
 * environments) so a Blobs leak yields ciphertext only.
 */

const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

function dataKeyBytes() {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'imverica-dev-data-key';
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKeyBytes(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return {
    enc: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  };
}

function decrypt(blob) {
  if (!blob || blob.enc !== 1) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKeyBytes(), Buffer.from(blob.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
    const out = Buffer.concat([decipher.update(Buffer.from(blob.data, 'base64')), decipher.final()]);
    return JSON.parse(out.toString('utf8'));
  } catch (err) {
    console.error('profile-store decrypt failed:', err.message);
    return null;
  }
}

function sha256hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

const DIR = path.join(os.tmpdir(), 'imverica-profiles');

async function getStore() {
  try { return require('@netlify/blobs').getStore('imverica-profiles'); } catch { return null; }
}

function blobKey(email) {
  return `profile/${sha256hex(normalizeEmail(email))}.json`;
}

function fsName(k) {
  return k.replace(/[^A-Za-z0-9_-]/g, '_');
}

/** Return the decrypted profile object for this email, or null if absent. */
async function readProfile(email) {
  const s = await getStore();
  const k = blobKey(email);
  let raw = null;
  if (s) { try { raw = await s.get(k, { type: 'json' }); } catch { /* fall */ } }
  if (!raw) {
    try { raw = JSON.parse(await fs.readFile(path.join(DIR, `${fsName(k)}.json`), 'utf8')); } catch { return null; }
  }
  return decrypt(raw);
}

/** Encrypt and persist the full profile object. Overwrites whatever is there. */
async function writeProfile(email, profile) {
  const s = await getStore();
  const k = blobKey(email);
  const enc = encrypt(profile);
  if (s) { try { await s.setJSON(k, enc); return; } catch { /* fall */ } }
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, `${fsName(k)}.json`), JSON.stringify(enc));
}

/**
 * Read + merge + write — small helper so callers don't race themselves
 * when only a subset of fields needs updating (e.g. auth.js writing TOTP
 * fields shouldn't clobber name / phone).
 */
async function updateProfile(email, patch) {
  const existing = (await readProfile(email)) || {};
  const merged = { ...existing, ...patch, email: normalizeEmail(email), updatedAt: new Date().toISOString() };
  await writeProfile(email, merged);
  return merged;
}

module.exports = { readProfile, writeProfile, updateProfile, normalizeEmail };
