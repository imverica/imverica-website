const fs = require('fs/promises');
const path = require('path');

const { incrementalFillPdf } = require('./lib/pdf-incremental-fill');
const { i765FieldValues } = require('./lib/i765-pdf-map');
const { i485FieldValues } = require('./lib/i485-pdf-map');

// Auto-generated maps — use require() and pick the single exported function
function req(file) {
  const mod = require(file);
  return Object.values(mod).find(v => typeof v === 'function');
}

const ROOT = path.resolve(__dirname, '..', '..');
const PDF_DIR = path.join(ROOT, 'assets/form-cache/pdfs');
const MAX_BODY_BYTES = 150000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// Maps normalized form code → { pdfSlug, fn }
const FORM_REGISTRY = {
  'AR-11':              { pdf: 'ar-11',              fn: req('./lib/ar11-pdf-map') },
  'G-28':               { pdf: 'g-28',               fn: req('./lib/g28-pdf-map') },
  'G-28I':              { pdf: 'g-28i',              fn: req('./lib/g28i-pdf-map') },
  'G-325A':             { pdf: 'g-325a',             fn: req('./lib/g325a-pdf-map') },
  'G-639':              { pdf: 'g-639',              fn: req('./lib/g639-pdf-map') },
  'G-845':              { pdf: 'g-845',              fn: req('./lib/g845-pdf-map') },
  'G-845 SUPPLEMENT':   { pdf: 'g-845-supplement',   fn: req('./lib/g845s-pdf-map') },
  'G-884':              { pdf: 'g-884',              fn: req('./lib/g884-pdf-map') },
  'G-1041':             { pdf: 'g-1041',             fn: req('./lib/g1041-pdf-map') },
  'G-1041A':            { pdf: 'g-1041a',            fn: req('./lib/g1041a-pdf-map') },
  'G-1055':             { pdf: 'g-1055',             fn: req('./lib/g1055-pdf-map') },
  'G-1145':             { pdf: 'g-1145',             fn: req('./lib/g1145-pdf-map') },
  'G-1256':             { pdf: 'g-1256',             fn: req('./lib/g1256-pdf-map') },
  'G-1450':             { pdf: 'g-1450',             fn: req('./lib/g1450-pdf-map') },
  'G-1566':             { pdf: 'g-1566',             fn: req('./lib/g1566-pdf-map') },
  'G-1650':             { pdf: 'g-1650',             fn: req('./lib/g1650-pdf-map') },
  'I-9':                { pdf: 'i-9',                fn: req('./lib/i9-pdf-map') },
  'I-90':               { pdf: 'i-90',               fn: req('./lib/i90-pdf-map') },
  'I-102':              { pdf: 'i-102',              fn: req('./lib/i102-pdf-map') },
  'I-129':              { pdf: 'i-129',              fn: req('./lib/i129-pdf-map') },
  'I-129CWR':           { pdf: 'i-129cwr',           fn: req('./lib/i129cwr-pdf-map') },
  'I-129F':             { pdf: 'i-129f',             fn: req('./lib/i129f-pdf-map') },
  'I-129S':             { pdf: 'i-129s',             fn: req('./lib/i129s-pdf-map') },
  'I-130':              { pdf: 'i-130',              fn: req('./lib/i130-pdf-map') },
  'I-130A':             { pdf: 'i-130a',             fn: req('./lib/i130a-pdf-map') },
  'I-131':              { pdf: 'i-131',              fn: req('./lib/i131-pdf-map') },
  'I-131A':             { pdf: 'i-131a',             fn: req('./lib/i131a-pdf-map') },
  'I-134':              { pdf: 'i-134',              fn: req('./lib/i134-pdf-map') },
  'I-134A':             { pdf: 'i-134a',             fn: req('./lib/i134a-pdf-map') },
  'I-140':              { pdf: 'i-140',              fn: req('./lib/i140-pdf-map') },
  'I-191':              { pdf: 'i-191',              fn: req('./lib/i191-pdf-map') },
  'I-192':              { pdf: 'i-192',              fn: req('./lib/i192-pdf-map') },
  'I-193':              { pdf: 'i-193',              fn: req('./lib/i193-pdf-map') },
  'I-212':              { pdf: 'i-212',              fn: req('./lib/i212-pdf-map') },
  'I-290B':             { pdf: 'i-290b',             fn: req('./lib/i290b-pdf-map') },
  'I-360':              { pdf: 'i-360',              fn: req('./lib/i360-pdf-map') },
  'I-361':              { pdf: 'i-361',              fn: req('./lib/i361-pdf-map') },
  'I-363':              { pdf: 'i-363',              fn: req('./lib/i363-pdf-map') },
  'I-407':              { pdf: 'i-407',              fn: req('./lib/i407-pdf-map') },
  'I-485':              { pdf: 'i-485',              fn: i485FieldValues },
  'I-485 SUPPLEMENT A': { pdf: 'i-485-supplement-a', fn: req('./lib/i485a-pdf-map') },
  'I-485 SUPPLEMENT J': { pdf: 'i-485-supplement-j', fn: req('./lib/i485j-pdf-map') },
  'I-508':              { pdf: 'i-508',              fn: req('./lib/i508-pdf-map') },
  'I-526':              { pdf: 'i-526',              fn: req('./lib/i526-pdf-map') },
  'I-526E':             { pdf: 'i-526e',             fn: req('./lib/i526e-pdf-map') },
  'I-539':              { pdf: 'i-539',              fn: req('./lib/i539-pdf-map') },
  'I-539A':             { pdf: 'i-539a',             fn: req('./lib/i539a-pdf-map') },
  'I-589':              { pdf: 'i-589',              fn: req('./lib/i589-pdf-map') },
  'I-590':              { pdf: 'i-590',              fn: req('./lib/i590-pdf-map') },
  'I-600':              { pdf: 'i-600',              fn: req('./lib/i600-pdf-map') },
  'I-600A':             { pdf: 'i-600a',             fn: req('./lib/i600a-pdf-map') },
  'I-601':              { pdf: 'i-601',              fn: req('./lib/i601-pdf-map') },
  'I-601A':             { pdf: 'i-601a',             fn: req('./lib/i601a-pdf-map') },
  'I-602':              { pdf: 'i-602',              fn: req('./lib/i602-pdf-map') },
  'I-612':              { pdf: 'i-612',              fn: req('./lib/i612-pdf-map') },
  'I-687':              { pdf: 'i-687',              fn: req('./lib/i687-pdf-map') },
  'I-690':              { pdf: 'i-690',              fn: req('./lib/i690-pdf-map') },
  'I-693':              { pdf: 'i-693',              fn: req('./lib/i693-pdf-map') },
  'I-694':              { pdf: 'i-694',              fn: req('./lib/i694-pdf-map') },
  'I-698':              { pdf: 'i-698',              fn: req('./lib/i698-pdf-map') },
  'I-730':              { pdf: 'i-730',              fn: req('./lib/i730-pdf-map') },
  'I-751':              { pdf: 'i-751',              fn: req('./lib/i751-pdf-map') },
  'I-765':              { pdf: 'i-765',              fn: i765FieldValues },
  'I-765V':             { pdf: 'i-765v',             fn: req('./lib/i765v-pdf-map') },
  'I-800':              { pdf: 'i-800',              fn: req('./lib/i800-pdf-map') },
  'I-800A':             { pdf: 'i-800a',             fn: req('./lib/i800a-pdf-map') },
  'I-817':              { pdf: 'i-817',              fn: req('./lib/i817-pdf-map') },
  'I-821':              { pdf: 'i-821',              fn: req('./lib/i821-pdf-map') },
  'I-821D':             { pdf: 'i-821d',             fn: req('./lib/i821d-pdf-map') },
  'I-824':              { pdf: 'i-824',              fn: req('./lib/i824-pdf-map') },
  'I-829':              { pdf: 'i-829',              fn: req('./lib/i829-pdf-map') },
  'I-864':              { pdf: 'i-864',              fn: req('./lib/i864-pdf-map') },
  'I-864A':             { pdf: 'i-864a',             fn: req('./lib/i864a-pdf-map') },
  'I-864EZ':            { pdf: 'i-864ez',            fn: req('./lib/i864ez-pdf-map') },
  'I-865':              { pdf: 'i-865',              fn: req('./lib/i865-pdf-map') },
  'I-881':              { pdf: 'i-881',              fn: req('./lib/i881-pdf-map') },
  'I-907':              { pdf: 'i-907',              fn: req('./lib/i907-pdf-map') },
  'I-912':              { pdf: 'i-912',              fn: req('./lib/i912-pdf-map') },
  'I-914':              { pdf: 'i-914',              fn: req('./lib/i914-pdf-map') },
  'I-918':              { pdf: 'i-918',              fn: req('./lib/i918-pdf-map') },
  'I-929':              { pdf: 'i-929',              fn: req('./lib/i929-pdf-map') },
  'I-941':              { pdf: 'i-941',              fn: req('./lib/i941-pdf-map') },
  'I-942':              { pdf: 'i-942',              fn: req('./lib/i942-pdf-map') },
  'I-956':              { pdf: 'i-956',              fn: req('./lib/i956-pdf-map') },
  'I-956F':             { pdf: 'i-956f',             fn: req('./lib/i956f-pdf-map') },
  'I-956G':             { pdf: 'i-956g',             fn: req('./lib/i956g-pdf-map') },
  'I-956H':             { pdf: 'i-956h',             fn: req('./lib/i956h-pdf-map') },
  'I-956K':             { pdf: 'i-956k',             fn: req('./lib/i956k-pdf-map') },
  'N-300':              { pdf: 'n-300',              fn: req('./lib/n300-pdf-map') },
  'N-336':              { pdf: 'n-336',              fn: req('./lib/n336-pdf-map') },
  'N-400':              { pdf: 'n-400',              fn: req('./lib/n400-pdf-map') },
  'N-470':              { pdf: 'n-470',              fn: req('./lib/n470-pdf-map') },
  'N-565':              { pdf: 'n-565',              fn: req('./lib/n565-pdf-map') },
  'N-600':              { pdf: 'n-600',              fn: req('./lib/n600-pdf-map') },
  'N-600K':             { pdf: 'n-600k',             fn: req('./lib/n600k-pdf-map') },
  'N-648':              { pdf: 'n-648',              fn: req('./lib/n648-pdf-map') },
};

const SUPPORTED_FORMS = Object.keys(FORM_REGISTRY);

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body)
  };
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function clean(value, max = 300) {
  return String(value || '').replace(/ /g, '').replace(/\s+/g, ' ').trim().slice(0, max);
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

function validateMinimumPayload(body) {
  const answers = body.formAnswers || {};
  const missing = [];
  if (!answers.applicant_given_name && !answers.given_name && !(body.contact && body.contact.name)) {
    missing.push('applicant_given_name');
  }
  if (!answers.applicant_family_name && !answers.family_name) {
    missing.push('applicant_family_name');
  }
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
  const entry = FORM_REGISTRY[formCode];

  if (!entry) {
    return json(422, {
      ok: false,
      error: `Form ${formCode || '(none)'} is not supported for PDF draft generation`,
      supportedForms: SUPPORTED_FORMS
    });
  }

  const missing = validateMinimumPayload(body);
  if (missing.length) {
    return json(422, { ok: false, error: 'Missing required fields', fields: missing });
  }

  const pdfPath = path.join(PDF_DIR, `${entry.pdf}.pdf`);

  try {
    const pdf = await fs.readFile(pdfPath);
    const fieldValues = entry.fn(body);
    const draft = incrementalFillPdf(pdf, fieldValues);
    const safeCode = formCode.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="imverica-${safeCode}-draft.pdf"`,
        'Cache-Control': 'no-store',
        'X-Imverica-Form-Code': formCode,
        'X-Imverica-Filled-Fields': String(draft.filledFields.length),
        'X-Imverica-Skipped-Fields': String(draft.skippedFields.length)
      },
      isBase64Encoded: true,
      body: draft.buffer.toString('base64')
    };
  } catch (err) {
    console.error(`Could not generate ${formCode} PDF draft:`, err);
    return json(500, { ok: false, error: `Could not generate ${formCode} PDF draft` });
  }
};
