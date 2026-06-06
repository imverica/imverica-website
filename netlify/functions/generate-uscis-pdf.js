'use strict';

/**
 * Account-only USCIS PDF generation wrapper.
 *
 * This wrapper is the cabinet wizard contract: it requires the signed account
 * session first, then delegates to the internal USCIS PDF renderer.
 */

const generatePdf = require('./generate-pdf');
const { sessionFromEvent } = require('./lib/session-auth');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true'
      }
    };
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const session = sessionFromEvent(event);
  if (!session) return json(401, { ok: false, error: 'Not signed in' });

  return generatePdf.handler({ ...event, internalPdfRender: true });
};
