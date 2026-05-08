const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

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
  return cleanLong(value);
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
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
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

async function saveRecord(record) {
  const key = `orders/${record.id}.json`;

  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    const store = await getBlobStore();
    await store.setJSON(key, record);
    return { storage: 'netlify-blobs', key };
  }

  const dir = path.join(os.tmpdir(), 'imverica-intakes', 'orders');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${record.id}.json`), JSON.stringify(record, null, 2));
  return { storage: 'local-temp', key };
}

async function getRecord(id) {
  const safeId = clean(id, 80).replace(/[^A-Z0-9-]/gi, '');
  if (!safeId) return null;
  const key = `orders/${safeId}.json`;

  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    const store = await getBlobStore();
    return await store.get(key, { type: 'json' });
  }

  try {
    const file = path.join(os.tmpdir(), 'imverica-intakes', 'orders', `${safeId}.json`);
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
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
    contact: record.contact
  };
}

function isAdmin(event) {
  const token = process.env.INTAKE_ADMIN_TOKEN;
  if (!token) return false;

  const headers = event.headers || {};
  const auth = headers.authorization || headers.Authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const queryToken = event.queryStringParameters?.token || '';
  return bearer === token || queryToken === token;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };

  if (event.httpMethod === 'POST') {
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
      const saved = await saveRecord(record);
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
      const record = await getRecord(id);
      return record ? json(200, { ok: true, record }) : json(404, { ok: false, error: 'Not found' });
    }

    const records = await listRecords();
    const summaries = [];
    for (const item of records.slice(0, 100)) {
      const record = await getRecord(idFromKey(item.key));
      if (record) summaries.push(summarizeRecord(record));
    }
    summaries.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return json(200, { ok: true, records: summaries });
  }

  return json(405, { ok: false, error: 'Method not allowed' });
};
