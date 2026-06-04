'use strict';
/**
 * Generate a filled California court-form PDF.
 *
 * Parallel to generate-pdf.js (USCIS) but for CA Judicial Council forms:
 * looks the form up in lib/ca-court-registry, loads the DECRYPTED template
 * from assets/form-cache/ca-court/<slug>.pdf, builds field values from the
 * intake payload, and fills via lib/ca-court-fill (pdf-lib).
 *
 * Mirrors generate-pdf.js's security + response contract exactly:
 *   - POST only
 *   - originGuard + per-IP throttle (PDF rendering is CPU-expensive)
 *   - returns { statusCode, headers, body(base64), isBase64Encoded }
 *
 * Request JSON:
 *   { "formCode": "FL-100", "formAnswers": { ... }, "contact": { ... },
 *     "flatten": false }
 * formType / code are accepted as aliases for formCode.
 *
 * Does NOT touch the USCIS path, the immigration wizard, or any existing
 * endpoint. New, isolated function.
 */

const fs = require('fs');
const path = require('path');

const { fillCourtForm, fillAndFlattenCourtForm } = require('./lib/ca-court-fill');
const { getBuilder, listForms } = require('./lib/ca-court-registry');
const { originGuard, throttleOrReject } = require('./lib/abuse-guard');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

// Decrypted CA templates live under assets/form-cache/ca-court. Search the
// same set of roots generate-pdf.js uses, so it works in dev + on Netlify.
function findTemplate(slug) {
  const rootFromFunction = path.resolve(__dirname, '..', '..');
  const dirs = [
    path.join(process.cwd(), 'assets/form-cache/ca-court'),
    path.join(__dirname, 'assets/form-cache/ca-court'),
    path.join(rootFromFunction, 'assets/form-cache/ca-court')
  ];
  for (const dir of dirs) {
    const p = path.join(dir, slug + '.pdf');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Same abuse-guard chain as /api/generate-pdf — PDF fills are expensive.
    const originReject = originGuard(event);
    if (originReject) return originReject;
    const throttleReject = await throttleOrReject(event, {
      action: 'generate-court-pdf',
      limit: 25,
      windowSec: 300
    });
    if (throttleReject) return throttleReject;

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON body' }); }

    const formCode = payload.formCode || payload.formType || payload.code;
    if (!formCode) return json(400, { error: 'Missing formCode' });

    const entry = getBuilder(formCode);
    if (!entry) {
      return json(404, {
        error: 'Court form not supported',
        formCode,
        supported: listForms()
      });
    }

    const templatePath = findTemplate(entry.slug);
    if (!templatePath) {
      return json(404, { error: 'Decrypted template not found', formCode: entry.slug });
    }

    const fieldValues = entry.build(payload);
    if (!fieldValues || Object.keys(fieldValues).length === 0) {
      return json(422, { error: 'No fields could be filled from the provided answers', formCode: entry.slug });
    }

    const inputPdf = fs.readFileSync(templatePath);
    const flatten = payload.flatten === true;
    const result = flatten
      ? await fillAndFlattenCourtForm(inputPdf, fieldValues)
      : await fillCourtForm(inputPdf, fieldValues);

    console.log('COURT PDF RESULT', {
      formCode: entry.slug,
      mapped: Object.keys(fieldValues).length,
      filled: result.filled.length,
      skipped: result.skipped.length,
      flattened: Boolean(result.flattened)
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${entry.slug}-filled.pdf`,
        'Cache-Control': 'no-store'
      },
      body: result.buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('COURT PDF GENERATION ERROR', error);
    return json(500, { error: 'PDF generation failed', message: error.message });
  }
};
