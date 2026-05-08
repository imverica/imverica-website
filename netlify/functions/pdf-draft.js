const fs = require('fs/promises');
const path = require('path');

const { incrementalFillPdf } = require('./lib/pdf-incremental-fill');
const { i765FieldValues } = require('./lib/i765-pdf-map');

const ROOT = path.resolve(__dirname, '..', '..');
const I765_PDF = path.join(ROOT, 'assets/form-cache/pdfs/i-765.pdf');
const MAX_BODY_BYTES = 150000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

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

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function clean(value, max = 300) {
  return String(value || '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanObject(value, depth = 0) {
  if (depth > 6) return '';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => cleanObject(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.entries(value).slice(0, 500).reduce((acc, [key, item]) => {
      const safeKey = clean(key, 120).replace(/[^\w.\-:[\]]/g, '_');
      if (safeKey) acc[safeKey] = cleanObject(item, depth + 1);
      return acc;
    }, {});
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return clean(value, 1000);
}

function validateI765Payload(body) {
  const answers = body.formAnswers || {};
  const missing = [];
  if (!answers.applicant_given_name) missing.push('applicant_given_name');
  if (!answers.applicant_family_name) missing.push('applicant_family_name');
  if (!answers.date_of_birth) missing.push('date_of_birth');
  if (!answers.mailing_address_line1) missing.push('mailing_address_line1');
  if (!answers.mailing_city) missing.push('mailing_city');
  if (!answers.mailing_state) missing.push('mailing_state');
  if (!answers.mailing_zip) missing.push('mailing_zip');
  return missing;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  if (Buffer.byteLength(event.body || '', 'utf8') > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: 'Request too large' });
  }

  let body;
  try {
    body = cleanObject(JSON.parse(event.body || '{}'));
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const formCode = normalizeCode(body.formCode || body.code);
  if (formCode !== 'I-765') {
    return json(422, {
      ok: false,
      error: 'PDF draft generation currently supports I-765 only',
      supportedForms: ['I-765']
    });
  }

  const missing = validateI765Payload(body);
  if (missing.length) {
    return json(422, {
      ok: false,
      error: 'Missing required I-765 draft fields',
      fields: missing
    });
  }

  try {
    const pdf = await fs.readFile(I765_PDF);
    const fieldValues = i765FieldValues(body);
    const draft = incrementalFillPdf(pdf, fieldValues);

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="imverica-i-765-draft.pdf"',
        'Cache-Control': 'no-store',
        'X-Imverica-Form-Code': 'I-765',
        'X-Imverica-Filled-Fields': String(draft.filledFields.length),
        'X-Imverica-Skipped-Fields': String(draft.skippedFields.length)
      },
      isBase64Encoded: true,
      body: draft.buffer.toString('base64')
    };
  } catch (err) {
    console.error('Could not generate I-765 PDF draft:', err);
    return json(500, {
      ok: false,
      error: 'Could not generate I-765 PDF draft'
    });
  }
};
