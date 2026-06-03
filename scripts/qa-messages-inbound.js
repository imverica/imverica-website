/**
 * QA — messages-inbound.js end-to-end smoke test.
 *
 * Simulates the Resend `email.received` webhook (metadata-only payload),
 * mocks the Resend Received Emails API, and verifies our function appends
 * the reply to the correct client thread.
 *
 * Run:
 *   node scripts/qa-messages-inbound.js
 *
 * What it covers:
 *   1. SVIX signature verification (HMAC) accepts a correctly signed body
 *   2. Token extraction from data.to[] reply+<hex>@<domain>
 *   3. API fetch fallback when payload has no text/html
 *   4. Quoted-history stripping (Gmail "On … wrote:" pattern)
 *   5. Append to the matching client thread + write back
 *   6. Returns 200 OK with { ok: true, appended: 1 }
 *
 * Exit 0 = pass, 1 = fail.
 */

const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');

// ─── Test config ───────────────────────────────────────────────────
const CLIENT_EMAIL = 'qa-inbound-test@example.com';
const REPLY_DOMAIN = 'estutkal.resend.app';
const REPLY_LOCAL = 'reply';
const WEBHOOK_SECRET_RAW = 'mock-svix-secret-base64-payload-12345';
const WEBHOOK_SECRET = 'whsec_' + Buffer.from(WEBHOOK_SECRET_RAW).toString('base64');
const DATA_KEY = 'qa-data-encryption-key-32-bytes-long-padded';

// ─── Env setup (BEFORE requiring the function module) ──────────────
process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.RESEND_API_KEY = 're_qa_mock_key';
process.env.MESSAGES_REPLY_DOMAIN = REPLY_DOMAIN;
process.env.MESSAGES_REPLY_LOCAL = REPLY_LOCAL;
process.env.DATA_ENCRYPTION_KEY = DATA_KEY;

// ─── Mock global fetch BEFORE requiring messages-inbound ───────────
const FETCHED_TEXT = "Thank you for reaching out! I'll review your case tonight.";
const FETCHED_HTML = `<p>${FETCHED_TEXT}</p><br><br>On Mon, Jun 3, 2026 at 6:00 AM Imverica &lt;messages@imverica.com&gt; wrote:<br>&gt; Original message here<br>&gt; with quoted history`;

let fetchCallLog = [];
global.fetch = async function mockFetch(url, opts) {
  fetchCallLog.push({ url, method: opts?.method, hasAuth: Boolean(opts?.headers?.Authorization) });
  if (/\/emails\/receiving\//.test(url)) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          object: 'email',
          id: 'edb755c4-e1c0-4223-a94e-54f6c1d910ec',
          to: [`${REPLY_LOCAL}+${threadToken(CLIENT_EMAIL)}@${REPLY_DOMAIN}`],
          from: 'info@imverica.com',
          subject: 'Re: New portal message from ' + CLIENT_EMAIL,
          html: FETCHED_HTML,
          text: null,
          headers: {},
          attachments: []
        };
      },
      async text() { return ''; }
    };
  }
  return { ok: false, status: 404, async text() { return 'not mocked'; }, async json() { return {}; } };
};

function threadToken(email) {
  return crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 12);
}

// ─── Pre-seed a client thread on disk fallback ─────────────────────
const THREAD_DIR = path.join(os.tmpdir(), 'imverica-messages-dev');

function deriveKeyBytes() {
  return crypto.createHash('sha256').update(DATA_KEY).digest();
}

function encryptString(plain) {
  const key = deriveKeyBytes();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return 'enc:v1:' + iv.toString('base64') + ':' + tag.toString('base64') + ':' + ct.toString('base64');
}

function threadKey(email) {
  return `thread/${crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')}.json`;
}

async function seedThread() {
  await fs.mkdir(THREAD_DIR, { recursive: true });
  const k = threadKey(CLIENT_EMAIL);
  const filename = k.replace(/\//g, '_') + '.json';
  const thread = {
    email: CLIENT_EMAIL,
    _v: 2,
    messages: [
      { id: 'abc123', from: 'client', text: encryptString('Hello, I need help.'), ts: new Date().toISOString() }
    ]
  };
  await fs.writeFile(path.join(THREAD_DIR, filename), JSON.stringify(thread));
}

async function readThreadDirect() {
  const k = threadKey(CLIENT_EMAIL);
  const filename = k.replace(/\//g, '_') + '.json';
  return JSON.parse(await fs.readFile(path.join(THREAD_DIR, filename), 'utf8'));
}

// ─── Build a signed webhook event ──────────────────────────────────
function buildSignedEvent() {
  const token = threadToken(CLIENT_EMAIL);
  const recipient = `${REPLY_LOCAL}+${token}@${REPLY_DOMAIN}`;
  const payload = {
    type: 'email.received',
    created_at: new Date().toISOString(),
    data: {
      email_id: 'edb755c4-e1c0-4223-a94e-54f6c1d910ec',
      from: 'info@imverica.com',
      to: [recipient],
      subject: 'Re: New portal message from ' + CLIENT_EMAIL,
      message_id: '<test@mail.gmail.com>',
      attachments: [],
      bcc: [],
      cc: []
    }
  };
  const body = JSON.stringify(payload);

  // Resend signs `id.ts.body` with HMAC-SHA256 keyed by base64-decoded secret
  const id = 'msg_qa_' + Date.now();
  const ts = String(Math.floor(Date.now() / 1000));
  const keyBytes = Buffer.from(WEBHOOK_SECRET_RAW); // matches our env (raw before base64)
  // Note: the function decodes secret AFTER stripping `whsec_` then base64-decodes
  // it. The `WEBHOOK_SECRET` we set on env is `whsec_<base64(WEBHOOK_SECRET_RAW)>`,
  // so when the function decodes, it gets back the raw bytes — that's our `keyBytes`.
  const signed = `${id}.${ts}.${body}`;
  const sig = crypto.createHmac('sha256', keyBytes).update(signed).digest('base64');

  return {
    httpMethod: 'POST',
    headers: {
      'svix-id': id,
      'svix-timestamp': ts,
      'svix-signature': `v1,${sig}`,
      'content-type': 'application/json'
    },
    body
  };
}

// ─── Main ──────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function ok(msg) { console.log('  ✓', msg); pass++; }
function bad(msg, extra) { console.error('  ✗', msg, extra || ''); fail++; }

async function main() {
  console.log('=== messages-inbound.js smoke test ===\n');

  // Load AFTER setting env
  const handler = require('../netlify/functions/messages-inbound.js').handler;

  await seedThread();
  ok('Seeded client thread on disk fallback');

  const event = buildSignedEvent();
  console.log('  → POST /api/messages-inbound (mocked)');

  const resp = await handler(event);
  let body = {};
  try { body = JSON.parse(resp.body); } catch {}

  console.log('  ← status:', resp.statusCode, 'body:', JSON.stringify(body));

  if (resp.statusCode === 200) ok('Handler returned 200');
  else bad('Handler should return 200, got ' + resp.statusCode);

  if (body.ok === true) ok('Body has ok:true');
  else bad('Body should have ok:true');

  if (body.appended === 1) ok('Body reports appended:1');
  else bad('Body should have appended:1, got ' + body.appended + ' (skipped: ' + body.skipped + ', source: ' + body.source + ')');

  // Verify fetch was called
  const apiCall = fetchCallLog.find(c => c.url.includes('/emails/receiving/'));
  if (apiCall) ok('Resend Received Emails API was called: ' + apiCall.url);
  else bad('Expected fetch to /emails/receiving/ — fetchCallLog: ' + JSON.stringify(fetchCallLog));

  if (apiCall && apiCall.hasAuth) ok('API call included Authorization header');
  else bad('API call missing Authorization header');

  // Verify thread now has 2 messages
  const thread = await readThreadDirect();
  if (thread.messages && thread.messages.length === 2) ok('Thread now has 2 messages (was 1)');
  else bad('Thread should have 2 messages, has ' + (thread.messages || []).length);

  // Decrypt the new message to verify content
  const lastMsg = thread.messages[thread.messages.length - 1];
  if (lastMsg.from === 'staff') ok('New message from:staff');
  else bad('New message should be from:staff, got ' + lastMsg.from);

  if (lastMsg.via === 'email') ok('New message via:email');
  else bad('New message should be via:email');

  // Decrypt
  function decryptString(value) {
    if (typeof value !== 'string' || !value.startsWith('enc:v1:')) return value;
    try {
      const [, , ivB64, tagB64, ctB64] = value.split(':');
      const iv = Buffer.from(ivB64, 'base64');
      const tag = Buffer.from(tagB64, 'base64');
      const ct = Buffer.from(ctB64, 'base64');
      const d = crypto.createDecipheriv('aes-256-gcm', deriveKeyBytes(), iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
    } catch { return value; }
  }
  const decrypted = decryptString(lastMsg.text);
  console.log('  decrypted reply:', JSON.stringify(decrypted));

  if (decrypted.includes('Thank you for reaching out')) ok('Reply body extracted from HTML correctly');
  else bad('Expected reply body to include the actual reply text, got: ' + decrypted);

  if (!decrypted.includes('Original message') && !decrypted.includes('quoted history')) ok('Quoted history was stripped');
  else bad('Quoted history was NOT stripped — got: ' + decrypted);

  if (!decrypted.includes('<p>') && !decrypted.includes('<br>')) ok('HTML tags stripped');
  else bad('HTML tags remained: ' + decrypted);

  // Cleanup
  try {
    await fs.unlink(path.join(THREAD_DIR, threadKey(CLIENT_EMAIL).replace(/\//g, '_') + '.json'));
    ok('Cleaned up test thread file');
  } catch {}

  console.log('\n=== Result ===');
  console.log('Passed:', pass);
  console.log('Failed:', fail);
  if (fail > 0) process.exit(1);
  console.log('All checks passed ✓');
}

main().catch((err) => {
  console.error('UNEXPECTED ERROR:', err);
  process.exit(1);
});
