const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { encryptRecord, decryptRecord, emailHash } = require('./lib/crypto');
const { originGuard, throttleOrReject, ensureBlobs } = require('./lib/abuse-guard');

/**
 * PII fields encrypted at rest. `id`, `status`, `createdAt`, `service`
 * (slug), `language` and `formCode` stay plaintext for indexing /
 * filtering / sitemaps. Adding `emailHash` (HMAC of email) lets account.js
 * filter "my orders" without decrypting every record on every request.
 */
const PII_PATHS = [
  'contact.name',
  'contact.email',
  'contact.phone',
  'serviceLabel',
  'situation'
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

const MAX_TEXT = 6000;
const MAX_SHORT = 300;
const MAX_BODY_BYTES = 50000;

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function clean(value, max = MAX_SHORT) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanLong(value) {
  return clean(value, MAX_TEXT);
}

// Hard bounds for any date-like string ("YYYY-MM-DD"): no birthdates before
// 1900-01-01 and no future dates beyond 2049-12-31. Catches obvious typos
// like 4342 for a passport expiry — both client and server enforce this so
// it survives a malicious / outdated client.
const MIN_DATE = '1900-01-01';
const MAX_DATE = '2049-12-31';
function clampDateLike(s) {
  if (typeof s !== 'string') return s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s < MIN_DATE) return MIN_DATE;
  if (s > MAX_DATE) return MAX_DATE;
  return s;
}

function cleanStructured(value, depth = 0) {
  if (depth > 5) return '';
  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item) => cleanStructured(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).slice(0, 300).reduce((acc, [key, item]) => {
      const safeKey = clean(key, 120).replace(/[^\w.\-:]/g, '_');
      if (safeKey) acc[safeKey] = cleanStructured(item, depth + 1);
      return acc;
    }, {});
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return clampDateLike(cleanLong(value));
}

function cleanCodeList(value) {
  return Array.isArray(value)
    ? value.slice(0, 30).map((item) => clean(item, 60).toUpperCase()).filter(Boolean)
    : [];
}

function isValidName(value) {
  const text = clean(value);
  const letters = (text.match(/[A-Za-zА-Яа-яЁёІіЇїЄєҐґÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
  return letters >= 4 && /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґÁÉÍÓÚÜÑáéíóúüñ'’.\-\s]+$/.test(text);
}

function isValidPhone(value) {
  const text = clean(value);
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 && /^[+\d\s().-]+$/.test(text);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean(value));
}

function makeOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  // 128 bits of randomness (16 bytes → 32 hex chars). Previously 32 bits
  // (8 hex). The orderId is paired with an ownsOrder() check on every
  // access, so enumeration was already a dead end — but bumping entropy
  // closes the theoretical guessing window AND makes IDs more durable
  // when one day used as URL slugs / share links.
  const suffix = crypto.randomBytes(16).toString('hex').toUpperCase();
  return `IMV-${date}-${suffix}`;
}

function normalizePayload(body, event) {
  const headers = event.headers || {};
  const contact = body.contact || {};
  const i765 = body.i765 || {};
  const officialForm = body.officialForm || {};
  const routeResult = body.routeResult || {};
  const id = makeOrderId();
  const now = new Date().toISOString();

  return {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'new',
    source: 'guided-intake',
    language: clean(body.language, 20),
    service: clean(body.service, 80),
    serviceLabel: clean(body.serviceLabel, 160),
    formCode: clean(body.formCode, 40).toUpperCase(),
    situation: cleanLong(body.situation),
    routeResult: cleanStructured(routeResult),
    flowSchemaVersion: clean(body.flowSchemaVersion, 80),
    packageForms: cleanCodeList(body.packageForms),
    officialForm: {
      title: clean(officialForm.title, 240),
      pdfUrl: clean(officialForm.pdfUrl, 600),
      cachedPdfUrl: clean(officialForm.cachedPdfUrl, 600),
      instructionsUrl: clean(officialForm.instructionsUrl, 600),
      editionDate: clean(officialForm.editionDate, 80),
      status: clean(officialForm.status, 80),
      cacheStatus: clean(officialForm.cacheStatus, 80),
      cacheNeedsRefresh: Boolean(officialForm.cacheNeedsRefresh),
      checkedAt: clean(officialForm.checkedAt, 80)
    },
    formAnswers: cleanStructured(body.formAnswers || {}),
    accountMode: clean(body.accountMode, 30) || 'guest',
    contact: {
      name: clean(contact.name, 160),
      phone: clean(contact.phone, 80),
      email: clean(contact.email, 180).toLowerCase()
    },
    i765: {
      basis: clean(i765.basis, 80),
      legalName: clean(i765.legalName, 180),
      dob: clean(i765.dob, 80),
      address: cleanLong(i765.address),
      immigrationStatus: clean(i765.immigrationStatus, 180),
      priorEad: clean(i765.priorEad, 180),
      evidence: cleanLong(i765.evidence)
    },
    meta: {
      userAgent: clean(headers['user-agent'], 400),
      referrer: clean(headers.referer || headers.referrer, 500),
      ipStored: false
    }
  };
}

function validateRecord(record) {
  const errors = [];
  if (!isValidName(record.contact.name)) errors.push('contact.name');
  if (!isValidPhone(record.contact.phone)) errors.push('contact.phone');
  if (!isValidEmail(record.contact.email)) errors.push('contact.email');
  if (!record.service && !record.formCode && !record.situation) errors.push('request.details');
  return errors;
}

async function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore('imverica-intakes');
}

async function saveRecord(record, event) {
  // Stamp an emailHash before encryption so we can still filter "my records"
  // without ever decrypting other clients' rows. Then encrypt the PII paths.
  const email = record?.contact?.email || '';
  const recordWithHash = { ...record, emailHash: emailHash(email, event) };
  const encrypted = encryptRecord(recordWithHash, PII_PATHS, event);
  const key = `orders/${record.id}.json`;

  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    const store = await getBlobStore();
    await store.setJSON(key, encrypted);
    return { storage: 'netlify-blobs', key };
  }

  const dir = path.join(os.tmpdir(), 'imverica-intakes', 'orders');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${record.id}.json`), JSON.stringify(encrypted, null, 2));
  return { storage: 'local-temp', key };
}

async function getRecord(id, event) {
  const safeId = clean(id, 80).replace(/[^A-Z0-9-]/gi, '');
  if (!safeId) return null;
  const key = `orders/${safeId}.json`;

  let raw = null;
  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    const store = await getBlobStore();
    raw = await store.get(key, { type: 'json' });
  } else {
    try {
      const file = path.join(os.tmpdir(), 'imverica-intakes', 'orders', `${safeId}.json`);
      raw = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch { raw = null; }
  }
  // decryptRecord is backward-compatible: legacy plaintext records (no _v)
  // are returned as-is, encrypted ones get their PII fields restored.
  return raw ? decryptRecord(raw, PII_PATHS, event) : null;
}

async function listRecords() {
  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    const store = await getBlobStore();
    const result = await store.list({ prefix: 'orders/' });
    return result.blobs || [];
  }

  const dir = path.join(os.tmpdir(), 'imverica-intakes', 'orders');
  try {
    const files = await fs.readdir(dir);
    return files.filter((file) => file.endsWith('.json')).map((file) => ({
      key: `orders/${file}`,
      etag: '',
      lastModified: ''
    }));
  } catch {
    return [];
  }
}

function idFromKey(key) {
  const file = String(key || '').split('/').pop() || '';
  return file.replace(/\.json$/i, '');
}

function summarizeRecord(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
    language: record.language,
    service: record.service,
    serviceLabel: record.serviceLabel,
    formCode: record.formCode,
    routeResult: record.routeResult,
    flowSchemaVersion: record.flowSchemaVersion,
    packageForms: record.packageForms,
    officialForm: record.officialForm,
    accountMode: record.accountMode,
    contact: record.contact,
    situation: record.situation,
    qc: record.qc || null,
    statusHistory: (record.statusHistory || []).slice(-5)
  };
}

// Admin authentication is two-factor: bearer token + TOTP code.
// See lib/admin-auth.js for the contract and how to provision the
// ADMIN_TOTP_SECRET env variable.
const { isAdmin } = require('./lib/admin-auth');

// Owner notification — completed guided intakes are saved to the blob store
// (admin console) but the operator should ALSO get an email so leads aren't
// missed. Same two inboxes as quick-intake; skips cleanly if RESEND_API_KEY is
// not set. Fire-and-forget: never blocks or fails the submission.
const NOTIFY_TO = ['info@imverica.com', 'imverica@gmail.com'];
const FROM_EMAIL = process.env.OTP_FROM_EMAIL || 'Imverica Legal Solutions <info@imverica.com>';
function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function notifyOwner(record) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log('[intake] no RESEND_API_KEY — skipping owner email', record.id); return; }
  const c = record.contact || {};
  const adminUrl = (process.env.URL || 'https://imverica.com') + '/admin.html';
  const rows = [
    ['Order ID', record.id],
    ['Submitted', new Date(record.createdAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) + ' PT'],
    ['Name', c.name], ['Email', c.email], ['Phone', c.phone],
    ['Service', record.serviceLabel || record.service],
    ['Form', record.formCode], ['Package', (record.packageForms || []).join(', ')],
    ['Language', record.language || 'en']
  ].filter(([, v]) => v);
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#1c2c40;max-width:640px;">
    <h2 style="color:#0f1c2f;margin:0 0 12px;">New guided intake</h2>
    ${rows.map(([k, v]) => `<p style="margin:0 0 4px;"><strong>${escHtml(k)}:</strong> ${escHtml(v)}</p>`).join('')}
    <h3 style="color:#0f1c2f;margin:16px 0 6px;">Situation</h3>
    <p style="white-space:pre-wrap;margin:0;">${escHtml(record.situation || '(none provided)')}</p>
    <p style="font-size:12px;color:#6b7280;margin-top:16px;">View in <a href="${escHtml(adminUrl)}">admin console</a> · blob id <code>${escHtml(record.id)}</code></p>
  </div>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nSituation:\n${record.situation || '(none provided)'}\n\nAdmin: ${adminUrl}`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: NOTIFY_TO, reply_to: c.email || undefined, subject: `[Imverica] New intake ${record.id} — ${c.name || 'client'}${record.formCode ? ' · ' + record.formCode : ''}`, html, text })
    });
    if (!res.ok) console.error('[intake] Resend notify failed', res.status, (await res.text().catch(() => '')).slice(0, 200));
  } catch (e) { console.error('[intake] notify error', e && e.message); }
}

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };

  if (event.httpMethod === 'POST') {
    // Abuse guard: reject cross-origin floods + IP-based rate limit.
    // The intake form is the most exposed surface (no auth required) so
    // we cap at 6 submissions / 10 min / IP. Legitimate users almost
    // never need more than 1-2 in that window.
    const originReject = originGuard(event);
    if (originReject) return originReject;
    const throttleReject = await throttleOrReject(event, {
      action: 'intake-submit',
      limit: 6,
      windowSec: 600
    });
    if (throttleReject) return throttleReject;

    if (Buffer.byteLength(event.body || '', 'utf8') > MAX_BODY_BYTES) {
      return json(413, { ok: false, error: 'Request too large' });
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { ok: false, error: 'Invalid JSON' });
    }

    const record = normalizePayload(body, event);
    const errors = validateRecord(record);
    if (errors.length) {
      return json(422, {
        ok: false,
        error: 'Validation failed',
        fields: errors
      });
    }

    try {
      const saved = await saveRecord(record, event);
      // Notify both owner inboxes (does not block or fail the submission).
      notifyOwner(record).catch((e) => console.error('[intake] notify:', e && e.message));
      return json(200, {
        ok: true,
        orderId: record.id,
        status: record.status,
        createdAt: record.createdAt,
        storage: saved.storage
      });
    } catch (err) {
      console.error('Could not save intake:', err);
      return json(500, {
        ok: false,
        error: 'Could not save intake securely. Please try again or contact Imverica.'
      });
    }
  }

  if (event.httpMethod === 'GET') {
    if (!isAdmin(event)) return json(401, { ok: false, error: 'Unauthorized' });

    const id = event.queryStringParameters?.id;
    if (id) {
      const record = await getRecord(id, event);
      return record ? json(200, { ok: true, record }) : json(404, { ok: false, error: 'Not found' });
    }

    const records = await listRecords();
    const summaries = [];
    for (const item of records.slice(0, 100)) {
      const record = await getRecord(idFromKey(item.key), event);
      if (record) summaries.push(summarizeRecord(record));
    }
    summaries.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return json(200, { ok: true, records: summaries });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
