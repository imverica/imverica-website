'use strict';

/**
 * Account-only USCIS PACKET generation (Phase 11/12/13).
 *
 *   POST /api/generate-uscis-packet   (imv_session cookie required)
 *     { formCode: 'I-765' | 'I-589', formAnswers: {...}, contact: {...} }
 *   → application/pdf — Cover Sheet · filled form (unflattened) · Checklist /
 *     Evidence Index (+ I-589 declaration & country-conditions placeholders) ·
 *     Review Instructions · Filing Instructions. Every accessory page carries
 *     the DRAFT — NOT FOR FILING banner; flattening only happens after client
 *     approval per the final-PDF workflow.
 */

const { sessionFromEvent } = require('./lib/session-auth');
const { buildUscisPacket } = require('./lib/uscis-packet');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
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

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const formCode = String(body.formCode || '').trim().toUpperCase();
  if (!['I-765', 'I-589'].includes(formCode)) {
    return json(422, { ok: false, error: 'Packet generation currently supports I-765 and I-589.' });
  }

  try {
    const out = await buildUscisPacket(formCode, {
      formAnswers: body.formAnswers || {},
      contact: body.contact || {}
    });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${formCode}-packet-draft.pdf"`,
        'Cache-Control': 'no-store'
      },
      body: out.buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    console.error('[generate-uscis-packet]', err && err.message);
    return json(500, { ok: false, error: 'Could not generate the packet. Please try again.' });
  }
};
