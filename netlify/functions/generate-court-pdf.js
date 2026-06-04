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

const { fillCourtForm, fillAndFlattenCourtForm } = require('./lib/ca-court-fill');
const { getBuilder, listForms } = require('./lib/ca-court-registry');
const { findCourtTemplate } = require('./lib/ca-court-template');
const { sanitizeDirectFields } = require('./lib/ca-court-direct-schema');
const { getSmallClaimsForm, listPreparableSmallClaimsSlugs } = require('./lib/ca-small-claims-catalog');
const { originGuard, throttleOrReject } = require('./lib/abuse-guard');
const { sessionFromEvent } = require('./lib/session-auth');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Court-form preparation is a personal-cabinet feature. Requiring the
    // same signed session used by /api/account prevents public generation
    // links from bypassing the cabinet wizard.
    const session = sessionFromEvent(event);
    if (!session) return json(401, { error: 'Not signed in' });

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

    const smallClaimsForm = getSmallClaimsForm(formCode);
    const directMode = payload.directFields && typeof payload.directFields === 'object';
    let slug;
    let fieldValues;

    if (directMode) {
      if (!smallClaimsForm) {
        return json(404, { error: 'Small Claims form not found', formCode });
      }
      if (smallClaimsForm.role !== 'prepare') {
        return json(403, {
          error: 'This form is completed by the court or is an information sheet',
          formCode: smallClaimsForm.code,
          role: smallClaimsForm.role
        });
      }
      slug = smallClaimsForm.code.toLowerCase();
      fieldValues = await sanitizeDirectFields(slug, payload.directFields);
    } else {
      const entry = getBuilder(formCode);
      if (!entry) {
        return json(404, {
          error: 'Court form not supported',
          formCode,
          supported: [...new Set([...listForms(), ...listPreparableSmallClaimsSlugs()])]
        });
      }
      slug = entry.slug;
      fieldValues = entry.build(payload);
    }

    const templatePath = findCourtTemplate(slug);
    if (!templatePath) {
      return json(404, { error: 'Decrypted template not found', formCode: slug });
    }

    if (!fieldValues || Object.keys(fieldValues).length === 0) {
      return json(422, { error: 'No fields could be filled from the provided answers', formCode: slug });
    }

    const inputPdf = fs.readFileSync(templatePath);
    const flatten = payload.flatten === true;
    const result = flatten
      ? await fillAndFlattenCourtForm(inputPdf, fieldValues)
      : await fillCourtForm(inputPdf, fieldValues);

    console.log('COURT PDF RESULT', {
      formCode: slug,
      account: session.email,
      mode: directMode ? 'direct' : 'mapped',
      mapped: Object.keys(fieldValues).length,
      filled: result.filled.length,
      skipped: result.skipped.length,
      flattened: Boolean(result.flattened)
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${slug}-filled.pdf`,
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
