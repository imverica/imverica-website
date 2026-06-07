'use strict';
/**
 * QA — Gmail bridge round-trip (client → owner email reply → client).
 *
 * Proves messages.js and messages-inbound.js share an identical at-rest
 * crypto + storage format. Before the fix the two used incompatible
 * encryption (object {_enc} vs 'enc:v1:' string), so an owner's emailed
 * reply was written in a format the cabinet could not decrypt — the client
 * never saw the reply and prior history was corrupted to "[object Object]".
 *
 * Run: node scripts/qa-gmail-bridge.js
 */
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');

// --- env: prod-like (forces real DATA_ENCRYPTION_KEY / SESSION_SECRET) ---
process.env.DATA_ENCRYPTION_KEY = 'qa-data-key-0123456789abcdefABCDEF01';
process.env.SESSION_SECRET = 'qa-session-secret-0123456789';
process.env.MESSAGES_INBOUND_SECRET = 'qa-inbound-shared-secret';
delete process.env.RESEND_API_KEY;        // skip outbound owner email
delete process.env.RESEND_WEBHOOK_SECRET;  // use shared-secret inbound auth

const HOST = 'imverica.com'; // non-localhost → real key paths, not dev fallback
const EMAIL = 'client@example.com';
const CLIENT_MSG = 'Hello, I have a question about my I-130.';
const OWNER_REPLY = 'Hi! Yes, we received it — sending the next steps now.';

// Clean any prior run's fs-fallback files for this thread.
const DIR = path.join(os.tmpdir(), 'imverica-messages');
function sha256(v) { return crypto.createHash('sha256').update(String(v)).digest('hex'); }
try {
  const key = `thread/${sha256(EMAIL)}.json`.replace(/[^A-Za-z0-9_-]/g, '_') + '.json';
  fs.rmSync(path.join(DIR, key), { force: true });
} catch {}

// --- build a valid client session cookie (mirrors messages.js verifySession) ---
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function makeSession(email) {
  const body = b64url(Buffer.from(JSON.stringify({ email, exp: Date.now() + 3600e3 })));
  const sig = b64url(crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest());
  return `${body}.${sig}`;
}
const cookie = `imv_session=${makeSession(EMAIL)}`;

const messages = require('../netlify/functions/messages.js');
const inbound = require('../netlify/functions/messages-inbound.js');

function token12(email) { return sha256(String(email).trim().toLowerCase()).slice(0, 12); }

async function run() {
  let failures = 0;
  const check = (label, cond) => { console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}`); if (!cond) failures++; };

  // 1) Client posts a message.
  const post = await messages.handler({
    httpMethod: 'POST', headers: { host: HOST, cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ text: CLIENT_MSG })
  });
  check('client POST 200', post.statusCode === 200);

  // 2) Owner replies by email → Resend Inbound webhook hits messages-inbound.
  const tok = token12(EMAIL);
  const webhook = {
    type: 'email.received',
    data: {
      email_id: 'evt_' + crypto.randomBytes(4).toString('hex'),
      to: [`reply+${tok}@estutkal.resend.app`],
      from: 'imverica@gmail.com',
      subject: 'Re: New portal message',
      text: OWNER_REPLY + '\n\nOn Mon, Jun 2, 2026 at 9:00 AM Imverica <messages@imverica.com> wrote:\n> ' + CLIENT_MSG
    }
  };
  const inb = await inbound.handler({
    httpMethod: 'POST',
    headers: { host: HOST, 'content-type': 'application/json', 'x-imverica-inbound-secret': process.env.MESSAGES_INBOUND_SECRET },
    body: JSON.stringify(webhook)
  });
  const inbBody = JSON.parse(inb.body || '{}');
  check('inbound webhook 200', inb.statusCode === 200);
  check('inbound appended the reply', inbBody.appended === 1);
  check('inbound matched the right thread', inbBody.email === EMAIL);

  // 3) Client reads the thread back — both messages must be readable plaintext.
  const get = await messages.handler({
    httpMethod: 'GET', headers: { host: HOST, cookie }, queryStringParameters: {}
  });
  const data = JSON.parse(get.body || '{}');
  const msgs = data.messages || [];
  const clientMsg = msgs.find((m) => m.from === 'client');
  const staffMsg = msgs.find((m) => m.from === 'staff');

  check('thread has 2 messages', msgs.length === 2);
  check('client message readable', !!clientMsg && clientMsg.text === CLIENT_MSG);
  check('owner reply present & decrypted', !!staffMsg && staffMsg.text === OWNER_REPLY);
  check('quoted history stripped from reply', !!staffMsg && !staffMsg.text.includes('On Mon'));
  check('NO "[object Object]" corruption', !msgs.some((m) => String(m.text).includes('[object Object]')));
  check('NO raw "enc:" ciphertext leaked to client', !msgs.some((m) => String(m.text).startsWith('enc:')));

  // 4) Client sends a message WITH a file attachment (e.g. a phone photo).
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108020000', 'hex');
  const postFile = await messages.handler({
    httpMethod: 'POST', headers: { host: HOST, cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Here is my passport photo', attachments: [{ name: 'passport.png', type: 'image/png', dataBase64: png.toString('base64') }] })
  });
  check('client POST with attachment 200', postFile.statusCode === 200);

  const get2 = JSON.parse((await messages.handler({ httpMethod: 'GET', headers: { host: HOST, cookie }, queryStringParameters: {} })).body || '{}');
  const withFile = (get2.messages || []).find((m) => Array.isArray(m.attachments) && m.attachments.length);
  const att = withFile && withFile.attachments[0];
  check('attachment metadata present', !!att && !!att.fileId);
  check('attachment name decrypted (plaintext)', !!att && att.name === 'passport.png');
  check('attachment type plaintext', !!att && att.type === 'image/png');
  check('attachment size correct', !!att && att.size === png.length);
  check('attachment name NOT an encrypted object', !!att && typeof att.name === 'string' && !att.name.startsWith('{'));

  // 5) Download the attachment bytes back — must decrypt to the exact file.
  if (att && att.fileId) {
    const dl = await messages.handler({ httpMethod: 'GET', headers: { host: HOST, cookie }, queryStringParameters: { file: att.fileId } });
    check('download 200', dl.statusCode === 200);
    check('download is binary (base64)', dl.isBase64Encoded === true);
    const back = Buffer.from(dl.body || '', 'base64');
    check('downloaded bytes match original', back.equals(png));
    check('download has no-inline CSP header', /sandbox/.test((dl.headers || {})['Content-Security-Policy'] || ''));
  }

  console.log('\n' + (failures ? `❌ ${failures} check(s) failed` : '✅ Gmail bridge + chat attachments OK — replies reach the client, files round-trip encrypted'));
  process.exit(failures ? 1 : 0);
}
run().catch((e) => { console.error('test threw:', e); process.exit(1); });
