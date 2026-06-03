/**
 * Quick intake — the homepage one-screen contact form.
 *
 * Replaces the multi-step wizard for the "first touch" submission. The
 * long form (USCIS / EOIR / California court questions) now lives in the
 * client cabinet, behind sign-in, with auto-save. This endpoint exists so
 * a visitor can submit a request in 30 seconds: name, email, phone, free
 * description, up to 5 file attachments — and the owner gets a single
 * email with everything attached.
 *
 * Differences from /api/intake (which still backs the long wizard):
 *   - Tiny payload schema (one screen of fields).
 *   - Accepts up to 5 file attachments inline (base64) — validated and
 *     forwarded straight to the operator's email.
 *   - Sends an immediate notification email to BOTH info@imverica.com
 *     and imverica@gmail.com with file attachments.
 *   - Saves the order to the same imverica-intakes blob store so it
 *     shows up in the admin console alongside cabinet-completed orders.
 *
 * Body shape (all utf-8 text fields, files base64-encoded):
 *   {
 *     name:      "John Smith",       // required, ≤120 chars
 *     email:     "john@example.com", // required, validated
 *     phone:     "+1 916 555 1234",  // optional, ≤40 chars
 *     situation: "I need help with…",// required, ≤4000 chars
 *     formCode:  "I-589",            // optional — from /api/route hint
 *     language:  "ru",               // optional — UI language tag
 *     files:     [{ name, type, dataBase64 }], // 0-5 files, each ≤4 MB
 *     // Honeypot: if a bot fills this, we silently 200 without emailing.
 *     website:   ""                  // must be empty
 *   }
 */

const crypto = require('crypto');
const { encryptRecord, emailHash } = require('./lib/crypto');
const { validateUpload } = require('./lib/file-validator');
const { originGuard, throttleOrReject, ensureBlobs } = require('./lib/abuse-guard');
const { getStore } = require('@netlify/blobs');
const { uploadAttachmentsToClientFolder, DriveDisabled } = require('./lib/google-drive');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// Owner inboxes that receive every new submission. Configured in code so
// changing them needs a code review + deploy (not an env-var slip).
const NOTIFY_TO = ['info@imverica.com', 'imverica@gmail.com'];

const FROM_EMAIL = process.env.OTP_FROM_EMAIL || 'Imverica Legal Solutions <info@imverica.com>';

const MAX_NAME = 120;
const MAX_PHONE = 40;
const MAX_SITUATION = 4000;
const MAX_FILES = 5;
// Netlify Functions cap synchronous request bodies at 6 MB. Base64 inflates
// raw bytes by ~33%, so the practical raw-file ceiling is ~4.4 MB before
// JSON / metadata overhead. We hold per-file at 4 MB but total across all
// attachments at 4 MB raw → 5.3 MB base64 → safely inside the 6 MB request
// guard. Users with bigger batches should upload via the cabinet (which
// streams files one-at-a-time through /api/upload).
const MAX_FILE_BYTES = 5 * 1024 * 1024;        // 5 MB raw per file
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;       // 5 MB total raw (across files)
const MAX_BODY_BYTES = 5.8 * 1024 * 1024;      // 5.8 MB JSON body guard
// Netlify synchronous-function bodies cap around 6 MB. Base64 + JSON
// overhead eats ~25 % so 5 MB raw is the practical ceiling. For larger
// uploads use the cabinet at /account.html (streams one file at a
// time) or Phase-2 direct-to-Google-Drive picker.

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body)
  };
}

function clean(value, max) {
  return String(value == null ? '' : value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]+/g, ' ').trim().slice(0, max);
}

function isValidEmail(addr) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(addr || ''));
}

function makeOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(16).toString('hex').toUpperCase();
  return `IMV-${date}-${suffix}`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function notifyOwner(record, attachments, driveResult) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log('[quick-intake] DEV — no RESEND_API_KEY, skipping owner email', record.id);
    return { sent: false, dev: true };
  }
  const c = record.contact;
  const fileList = (attachments || [])
    .map((a, i) => `${i + 1}. ${a.filename} (${Math.round(a.size / 1024)} KB)`)
    .join('\n') || 'No attachments';
  const driveLine = driveResult && driveResult.orderFolder && driveResult.orderFolder.webViewLink
    ? `<p style="margin:0 0 8px;"><strong>📁 Drive folder:</strong> <a href="${escapeHtml(driveResult.orderFolder.webViewLink)}" target="_blank" rel="noopener">${escapeHtml(driveResult.clientFolder.name)} / ${escapeHtml(driveResult.orderFolder.name)}</a></p>`
    : '';
  const driveText = driveResult && driveResult.orderFolder && driveResult.orderFolder.webViewLink
    ? `Drive folder: ${driveResult.orderFolder.webViewLink}\n`
    : '';

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#1c2c40;max-width:640px;">
      <h2 style="margin:0 0 16px;color:#0f1c2f;">New intake request</h2>
      <p style="margin:0 0 4px;"><strong>Order ID:</strong> ${escapeHtml(record.id)}</p>
      <p style="margin:0 0 16px;"><strong>Submitted:</strong> ${escapeHtml(new Date(record.createdAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))} PT</p>
      <hr style="border:none;border-top:1px solid #d6d9df;margin:16px 0;" />
      <h3 style="margin:0 0 8px;color:#0f1c2f;">Contact</h3>
      <p style="margin:0 0 4px;"><strong>Name:</strong> ${escapeHtml(c.name)}</p>
      <p style="margin:0 0 4px;"><strong>Email:</strong> <a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></p>
      ${c.phone ? `<p style="margin:0 0 4px;"><strong>Phone:</strong> <a href="tel:${escapeHtml(c.phone)}">${escapeHtml(c.phone)}</a></p>` : ''}
      ${record.formCode ? `<p style="margin:0 0 4px;"><strong>Form hint:</strong> ${escapeHtml(record.formCode)}</p>` : ''}
      <p style="margin:0 0 4px;"><strong>Language:</strong> ${escapeHtml(record.language || 'en')}</p>
      <hr style="border:none;border-top:1px solid #d6d9df;margin:16px 0;" />
      <h3 style="margin:0 0 8px;color:#0f1c2f;">Situation</h3>
      <p style="margin:0;white-space:pre-wrap;">${escapeHtml(record.situation || '')}</p>
      <hr style="border:none;border-top:1px solid #d6d9df;margin:16px 0;" />
      <h3 style="margin:0 0 8px;color:#0f1c2f;">Attachments</h3>
      ${driveLine}
      <pre style="margin:0;font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px;background:#f5f7fa;padding:10px;border-radius:6px;">${escapeHtml(fileList)}</pre>
      <hr style="border:none;border-top:1px solid #d6d9df;margin:16px 0;" />
      <p style="font-size:12px;color:#6b7280;">Stored in blob: <code>${escapeHtml(record.id)}</code> — also viewable in /admin.html</p>
    </div>
  `;

  const text =
    `New intake request\n\n` +
    `Order ID: ${record.id}\n` +
    `Submitted: ${new Date(record.createdAt).toISOString()}\n\n` +
    `--- CONTACT ---\n` +
    `Name:  ${c.name}\n` +
    `Email: ${c.email}\n` +
    (c.phone ? `Phone: ${c.phone}\n` : '') +
    (record.formCode ? `Form hint: ${record.formCode}\n` : '') +
    `Language: ${record.language || 'en'}\n\n` +
    `--- SITUATION ---\n${record.situation || ''}\n\n` +
    `--- ATTACHMENTS ---\n${driveText}${fileList}\n`;

  const payload = {
    from: FROM_EMAIL,
    to: NOTIFY_TO,
    reply_to: c.email,
    subject: `[Imverica] ${record.id} — ${c.name}${record.formCode ? ' · ' + record.formCode : ''}`,
    html,
    text,
    attachments: attachments.map((a) => ({ filename: a.filename, content: a.contentBase64 }))
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[quick-intake] Resend failed', res.status, detail);
    return { sent: false, error: `Resend ${res.status}` };
  }
  return { sent: true };
}

function intakesStore() {
  return getStore('imverica-intakes');
}

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  // First line — same as everywhere else in /api/*.
  const originReject = originGuard(event);
  if (originReject) return { ...originReject, headers: { ...CORS, ...originReject.headers } };

  // Tighter per-IP throttle: this endpoint sends real email + stores files,
  // both of which cost real money. 3 successful submissions per 10 min /
  // IP is enough for a legitimate user. Beyond that → 429.
  const throttleReject = await throttleOrReject(event, {
    action: 'quick-intake',
    limit: 3,
    windowSec: 600
  });
  if (throttleReject) return { ...throttleReject, headers: { ...CORS, ...throttleReject.headers } };

  if (Buffer.byteLength(event.body || '', 'utf8') > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: 'Request too large. Try smaller / fewer attachments.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { ok: false, error: 'Invalid JSON' }); }

  // Honeypot — bots tend to fill every visible-or-not field. Real users
  // never see it because we hide it with CSS. We pretend success on hit.
  if (clean(body.website, 200)) {
    console.log('[quick-intake] honeypot tripped — silently dropping');
    return json(200, { ok: true, orderId: 'silent' });
  }

  // Cloudflare Turnstile — optional, only enforced when the operator has
  // configured both keys in Netlify env. To enable:
  //   1. Create a Turnstile site at https://dash.cloudflare.com/?to=/:account/turnstile
  //   2. Add the site key to PUBLIC_TURNSTILE_SITE_KEY (rendered into the
  //      modal at build time) and the secret to TURNSTILE_SECRET_KEY here.
  //   3. Redeploy. From that point we reject submissions without a valid
  //      Turnstile token.
  if (process.env.TURNSTILE_SECRET_KEY) {
    const token = String(body.turnstileToken || '').trim();
    if (!token) return json(400, { ok: false, error: 'CAPTCHA required.' });
    try {
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(process.env.TURNSTILE_SECRET_KEY)}&response=${encodeURIComponent(token)}`
      });
      const result = await verify.json();
      if (!result || !result.success) {
        console.warn('[quick-intake] turnstile rejected', result && result['error-codes']);
        return json(400, { ok: false, error: 'CAPTCHA verification failed. Please try again.' });
      }
    } catch (e) {
      console.warn('[quick-intake] turnstile verify error', e);
      // Fail-open here: rather than block a legitimate user because
      // Cloudflare is unreachable, let the request through. Origin
      // guard + IP throttle + honeypot still apply.
    }
  }

  // Required field validation.
  const name = clean(body.name, MAX_NAME);
  const email = clean(body.email, 180).toLowerCase();
  const phone = clean(body.phone, MAX_PHONE);
  const situation = clean(body.situation, MAX_SITUATION);
  const formCode = clean(body.formCode, 30).toUpperCase();
  const language = clean(body.language, 5) || 'en';
  const errors = [];
  if (!name) errors.push('name');
  if (!isValidEmail(email)) errors.push('email');
  if (!situation || situation.length < 5) errors.push('situation');
  if (errors.length) return json(422, { ok: false, error: 'Please fill all required fields.', fields: errors });

  // Files (optional). Each must pass our normal upload validator —
  // magic-byte signature + extension allow-list + RTL/macro rejection.
  const rawFiles = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES) : [];
  const attachments = [];
  let totalBytes = 0;
  for (const f of rawFiles) {
    if (!f || typeof f !== 'object') continue;
    const fname = clean(f.name, 160) || 'attachment.pdf';
    const ftype = String(f.type || '').toLowerCase();
    const b64 = String(f.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!b64) continue;
    let buf;
    try { buf = Buffer.from(b64, 'base64'); }
    catch { return json(400, { ok: false, error: `Could not decode attachment "${fname}".` }); }
    if (!buf.length) continue;
    if (buf.length > MAX_FILE_BYTES) {
      return json(413, { ok: false, error: `Attachment "${fname}" is too large (max 5 MB).` });
    }
    totalBytes += buf.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return json(413, { ok: false, error: 'Total attachment size exceeds 22 MB. Please remove some files.' });
    }
    const validation = validateUpload(buf, fname, ftype);
    if (!validation.ok) {
      return json(415, { ok: false, error: `Attachment "${fname}" rejected: ${validation.error}` });
    }
    attachments.push({ filename: fname, contentBase64: b64, size: buf.length, type: ftype });
  }

  // Build the order record. Stored encrypted at rest in the existing
  // imverica-intakes blob store — same schema as the long wizard creates,
  // so the admin console picks it up without changes.
  const orderId = makeOrderId();
  const now = Date.now();
  const record = {
    id: orderId,
    status: 'new',
    source: 'quick-intake',
    createdAt: now,
    language,
    formCode,
    service: '',
    contact: { name, email, phone },
    situation
  };

  // Upload attachments to Google Drive (best-effort — Drive failure
  // never blocks the intake. Email + Blob storage still carry the
  // file content as fallback.) The folder layout is:
  //   <root>/<Client Name>/<orderId>/file1.pdf
  //   <root>/<Client Name>/<orderId>/file2.pdf
  let driveResult = null;
  if (attachments.length > 0) {
    try {
      driveResult = await uploadAttachmentsToClientFolder({
        clientName: name,
        orderId,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          contentBase64: a.contentBase64,
          mimeType: a.type
        }))
      });
      console.log('[quick-intake] Drive upload', orderId, 'uploaded:', driveResult.uploadedFiles.length, 'skipped:', driveResult.skippedFiles.length);
    } catch (err) {
      if (err instanceof DriveDisabled) {
        console.log('[quick-intake] Drive disabled (env vars not set) — skipping');
      } else {
        console.error('[quick-intake] Drive upload failed', err.message);
      }
      driveResult = null;
    }
  }

  const PII_PATHS = ['contact.name', 'contact.email', 'contact.phone', 'situation'];
  const encrypted = encryptRecord(record, PII_PATHS, event);
  encrypted.emailHash = emailHash(email, event);
  encrypted.attachmentCount = attachments.length;
  encrypted.attachmentSummary = attachments.map((a) => ({ name: a.filename, size: a.size, type: a.type }));
  if (driveResult && driveResult.enabled) {
    encrypted.drive = {
      clientFolderId: driveResult.clientFolder.id,
      clientFolderUrl: driveResult.clientFolder.webViewLink,
      orderFolderId: driveResult.orderFolder.id,
      orderFolderUrl: driveResult.orderFolder.webViewLink,
      uploadedFiles: driveResult.uploadedFiles,
      skippedFiles: driveResult.skippedFiles
    };
  }

  try {
    const store = intakesStore();
    await store.setJSON(`order/${orderId}.json`, encrypted);
  } catch (err) {
    console.error('[quick-intake] blob store write failed', err);
    return json(500, { ok: false, error: 'Could not save your request. Please try again or call us.' });
  }

  // Email the owner (best-effort — request succeeds even if mail bounces).
  let emailStatus;
  try { emailStatus = await notifyOwner(record, attachments, driveResult); }
  catch (err) {
    console.error('[quick-intake] notify failed', err);
    emailStatus = { sent: false, error: String(err && err.message || err) };
  }

  return json(200, {
    ok: true,
    orderId,
    emailed: !!(emailStatus && emailStatus.sent),
    attachmentCount: attachments.length,
    driveFolderUrl: driveResult && driveResult.orderFolder ? driveResult.orderFolder.webViewLink : null
  });
};
