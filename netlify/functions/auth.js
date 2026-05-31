/**
 * Passwordless OTP auth for the Imverica client cabinet.
 *
 *   POST /api/auth { action: 'request-otp', email }
 *     → generates a 6-digit code, stores its SHA-256 hash in Netlify Blobs
 *       (10-min expiry, attempt + rate-limit counters), emails it via Resend.
 *       In dev (no RESEND_API_KEY) the code is logged and returned so the
 *       flow is testable locally.
 *
 *   POST /api/auth { action: 'verify-otp', email, code }
 *     → verifies the code (single-use, expiry + attempt limits) and, on
 *       success, sets an HMAC-signed httpOnly session cookie.
 *
 *   POST /api/auth { action: 'logout' }
 *     → clears the session cookie.
 *
 * No passwords are stored. The session token is a stateless HMAC of
 * {email, exp} signed with SESSION_SECRET — no server session store needed.
 */

const crypto = require('crypto');
const { generateSecret, verifyTOTP, otpauthURL, generateRecoveryCodes, hashRecoveryCode } = require('./lib/totp');
const { readProfile, updateProfile } = require('./lib/profile-store');
const { originGuard, throttleOrReject, ensureBlobs } = require('./lib/abuse-guard');

// Pre-2FA cookie — short-lived intermediate state after email-OTP passes
// but before TOTP is verified. Holds only the email so verify-totp knows
// which account to check, and expires in 5 minutes so a phished email
// code can't be combined later with a long-running cookie.
const PRE2FA_TTL_MS = 5 * 60 * 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

const OTP_TTL_MS = 10 * 60 * 1000;        // code valid 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;            // per code
const MAX_REQUESTS_PER_WINDOW = 5;        // request-otp throttle
const REQUEST_WINDOW_MS = 60 * 60 * 1000; // per hour
// Shorter session window — 7 days instead of 30 — narrows the window in which
// a stolen session cookie is useful. The user simply re-authenticates via
// email-OTP (and TOTP if enabled) at the end of the week.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body)
  };
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 180);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Return the HMAC secret used to sign session cookies.
 *
 * SECURITY: refuse to fall back to a hard-coded dev secret in production.
 * Without SESSION_SECRET set in the deployed environment, signSession
 * returns null and verify-otp will hard-fail — operators MUST set
 * SESSION_SECRET on Netlify before sign-in works on the live host.
 */
function sessionSecret(event) {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 20) return secret;
  const host = String(event?.headers?.host || event?.headers?.Host || '');
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'imverica-dev-session-secret-change-me';
  }
  return null;
}

function signSession(email, event) {
  const secret = sessionSecret(event);
  if (!secret) return null;
  const payload = { email, exp: Date.now() + SESSION_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

async function otpStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore('imverica-otps');
}

function otpKey(email) {
  return `otp/${sha256(email)}.json`;
}

// Storage falls back to the local filesystem whenever the Blobs store is
// unavailable (null) or an op throws — so it works under `netlify dev`
// (no Blobs sandbox) and in production (Blobs) without an env-var guess.
function fsPath(key) {
  const os = require('os');
  const path = require('path');
  return path.join(os.tmpdir(), 'imverica-otps', `${sha256(key)}.json`);
}

async function readState(store, key) {
  if (store) {
    try { return (await store.get(key, { type: 'json' })) || null; } catch { /* fall through */ }
  }
  try { return JSON.parse(await require('fs/promises').readFile(fsPath(key), 'utf8')); } catch { return null; }
}

async function writeState(store, key, value) {
  if (store) {
    try { await store.setJSON(key, value); return; } catch { /* fall through */ }
  }
  const fs = require('fs/promises');
  const path = require('path');
  await fs.mkdir(path.dirname(fsPath(key)), { recursive: true });
  await fs.writeFile(fsPath(key), JSON.stringify(value));
}

async function deleteState(store, key) {
  if (store) {
    try { await store.delete(key); return; } catch { /* fall through */ }
  }
  try { await require('fs/promises').unlink(fsPath(key)); } catch { /* ignore */ }
}

async function sendOtpEmail(email, code) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.OTP_FROM_EMAIL || 'Imverica Legal Solutions <login@imverica.com>';
  if (!key) {
    // SECURITY: never log the OTP code to function logs. It used to be
    // logged in dev mode to help local sign-in without an SMTP relay,
    // but the same code path could fire on a misconfigured deploy and
    // expose every sign-in code through Netlify's log dashboard.
    // Netlify-dev users should set RESEND_API_KEY locally (free tier
    // is fine) or rely on the OTP they manually craft in the wizard.
    // Surface the configuration error to the caller; verify-otp path
    // remains the only place that can confirm a code.
    console.warn('[auth] sendOtpEmail: RESEND_API_KEY not set — email NOT delivered');
    return { sent: false, dev: true, error: 'mail-disabled' };
  }
  // SECURITY: never put the OTP in the subject line. The subject is shown
  // in every mail-provider dashboard (Resend, gateway logs, ISP relays,
  // recipient's inbox preview, push notifications on lock screens). The
  // code MUST live only in the rendered body, where it is gone after the
  // user reads / deletes it. We also avoid logging the body anywhere.
  const html =
    `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#1c2c40;max-width:480px;">` +
    `<p style="margin:0 0 12px;">Use this one-time code to sign in to your Imverica client portal:</p>` +
    `<div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#0f1c2f;background:#f1f5f9;padding:18px 24px;border-radius:10px;text-align:center;margin:14px 0;font-family:ui-monospace,SFMono-Regular,monospace;">${code}</div>` +
    `<p style="margin:14px 0;font-size:13px;color:#4a5a6e;">The code expires in 10 minutes and can be used once. If you did not request this, you can ignore this email.</p>` +
    `<p style="margin:14px 0;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px;">Imverica Legal Solutions — California Licensed LDA &amp; Immigration Consultant. Not a law firm; document preparation only.</p>` +
    `</div>`;
  const text =
    `Use this one-time code to sign in to your Imverica client portal:\n\n` +
    `   ${code}\n\n` +
    `It expires in 10 minutes and can be used once. If you did not request this, you can ignore this email.\n\n` +
    `Imverica Legal Solutions — California Licensed LDA & Immigration Consultant. Not a law firm; document preparation only.`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      // Generic subject — does NOT contain the code. Same wording whether
      // you have 1 or 100 codes in your inbox; only the body reveals the
      // value.
      subject: 'Your Imverica sign-in code',
      html,
      text
    })
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
  return { sent: true };
}

function isLocalHost(event) {
  const host = String(event.headers?.host || event.headers?.Host || '');
  return host.includes('localhost') || host.includes('127.0.0.1');
}

function sessionCookie(token, event, { clear = false } = {}) {
  const secure = isLocalHost(event) ? '' : ' Secure;';
  const maxAge = clear ? 0 : Math.floor(SESSION_TTL_MS / 1000);
  const value = clear ? '' : token;
  return `imv_session=${value}; HttpOnly;${secure} SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

// ----- pre-2FA bridge cookie -----
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function signPre2fa(email, event) {
  const secret = sessionSecret(event);
  if (!secret) return null;
  const payload = { email, kind: 'pre2fa', exp: Date.now() + PRE2FA_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}
function verifyPre2fa(token, event) {
  if (!token || !token.includes('.')) return null;
  const secret = sessionSecret(event);
  if (!secret) return null;
  const [body, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch { return null; }
  if (!payload || payload.kind !== 'pre2fa' || !payload.email || Date.now() > payload.exp) return null;
  return payload;
}
function pre2faCookie(token, event, { clear = false } = {}) {
  const secure = isLocalHost(event) ? '' : ' Secure;';
  const maxAge = clear ? 0 : Math.floor(PRE2FA_TTL_MS / 1000);
  const value = clear ? '' : token;
  return `imv_pre2fa=${value}; HttpOnly;${secure} SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}
function parseCookieHeader(header, name) {
  for (const part of String(header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}
function verifyExistingSession(event) {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || '';
  const token = parseCookieHeader(cookieHeader, 'imv_session');
  if (!token || !token.includes('.')) return null;
  const secret = sessionSecret(event);
  if (!secret) return null;
  const [body, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch { return null; }
  if (!payload || !payload.email || !payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  // First line of defence: reject cross-origin POSTs. Catches scripted
  // floods that don't bother forging Origin/Referer.
  const originReject = originGuard(event);
  if (originReject) return { ...originReject, headers: { ...CORS, ...originReject.headers } };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const action = String(body.action || '');

  // Per-IP throttle for the abuse-prone actions (sends email, calls
  // Google, mutates session). Per-email throttle below still applies on
  // top — this layer catches email-rotation attacks that flood Resend.
  if (['request-otp', 'verify-otp', 'google', 'logout'].includes(action)) {
    const reject = await throttleOrReject(event, {
      action: 'auth-' + action,
      limit: action === 'request-otp' ? 8 : 20,
      windowSec: 300
    });
    if (reject) return { ...reject, headers: { ...CORS, ...reject.headers } };
  }

  // ===== push-register — store a device push token for the signed-in user =====
  // Called by the native app after the user grants push permission. The
  // token (APNs for iOS, FCM for Android) is stored per-user so future
  // case-status updates / new-message events can fan out a push alert.
  if (action === 'push-register') {
    const sess = verifyExistingSession(event);
    if (!sess) return json(401, { ok: false, error: 'Not signed in' });
    const token = String(body.token || '').trim();
    const platform = String(body.platform || '').trim();
    if (!token || !platform) return json(400, { ok: false, error: 'Missing token or platform' });
    if (!['ios', 'android'].includes(platform)) return json(400, { ok: false, error: 'Invalid platform' });
    try {
      // Stored as an array of unique {token, platform, ts} entries on the
      // profile so a user with multiple devices receives push to each one.
      const prof = (await readProfile(sess.email)) || {};
      const existing = Array.isArray(prof.pushTokens) ? prof.pushTokens : [];
      const filtered = existing.filter((t) => t && t.token !== token);
      filtered.push({ token, platform, ts: Date.now() });
      // Cap stored tokens at the 10 most-recent devices.
      const trimmed = filtered.slice(-10);
      await updateProfile(sess.email, { pushTokens: trimmed });
      return json(200, { ok: true, count: trimmed.length });
    } catch (err) {
      return json(500, { ok: false, error: 'Could not register token.' });
    }
  }

  if (action === 'logout') {
    // Clear both session and any leftover pre-2FA cookie. We send two
    // Set-Cookie headers via an array — Netlify Functions supports this.
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/json'
      },
      multiValueHeaders: {
        'Set-Cookie': [sessionCookie('', event, { clear: true }), pre2faCookie('', event, { clear: true })]
      },
      body: JSON.stringify({ ok: true })
    };
  }

  // ===== TOTP setup endpoints — require an existing full session =====
  if (action === 'setup-totp' || action === 'confirm-totp' || action === 'disable-totp') {
    const sess = verifyExistingSession(event);
    if (!sess) return json(401, { ok: false, error: 'Not signed in' });
    const userEmail = sess.email;

    if (action === 'setup-totp') {
      const secret = generateSecret();
      // Stash the new secret as PENDING until confirmed by a TOTP code.
      // If the user abandons setup, the pending value is overwritten on
      // the next setup-totp call.
      await updateProfile(userEmail, { totpPendingSecret: secret });
      const url = otpauthURL({ label: userEmail, secret });
      return json(200, { ok: true, secret, otpauthURL: url });
    }

    if (action === 'confirm-totp') {
      const code = String(body.code || '').replace(/\D/g, '');
      const profile = (await readProfile(userEmail)) || {};
      if (!profile.totpPendingSecret) return json(400, { ok: false, error: 'Start setup first.' });
      if (!verifyTOTP(profile.totpPendingSecret, code)) {
        return json(401, { ok: false, error: 'Code did not match. Try the latest one from your authenticator app.' });
      }
      const recoveryCodes = generateRecoveryCodes(8);
      await updateProfile(userEmail, {
        totpSecret: profile.totpPendingSecret,
        totpEnabledAt: new Date().toISOString(),
        recoveryCodesHashed: recoveryCodes.map(hashRecoveryCode),
        totpPendingSecret: null
      });
      // Return recovery codes ONCE so the user can save them. They never
      // appear in any GET response after this — only the hashed versions
      // are stored, and only the hash is used for verification.
      return json(200, { ok: true, recoveryCodes });
    }

    if (action === 'disable-totp') {
      const code = String(body.code || '').replace(/\D/g, '');
      const profile = (await readProfile(userEmail)) || {};
      if (!profile.totpSecret) return json(400, { ok: false, error: 'Two-factor authentication is not enabled.' });
      if (!verifyTOTP(profile.totpSecret, code)) {
        return json(401, { ok: false, error: 'Code did not match. Two-factor authentication is still enabled.' });
      }
      await updateProfile(userEmail, {
        totpSecret: null,
        totpEnabledAt: null,
        recoveryCodesHashed: null,
        totpPendingSecret: null
      });
      return json(200, { ok: true, totpEnabled: false });
    }
  }

  // ===== TOTP login step — requires pre-2FA cookie =====
  if (action === 'verify-totp' || action === 'use-recovery-code') {
    const pre = verifyPre2fa(parseCookieHeader(event.headers?.cookie || event.headers?.Cookie, 'imv_pre2fa'), event);
    if (!pre) return json(401, { ok: false, error: 'Two-factor session expired. Please sign in again.' });
    const userEmail = pre.email;
    const profile = (await readProfile(userEmail)) || {};
    if (!profile.totpSecret) return json(400, { ok: false, error: 'Two-factor authentication is not configured for this account.' });

    if (action === 'verify-totp') {
      const code = String(body.code || '').replace(/\D/g, '');
      if (!verifyTOTP(profile.totpSecret, code)) {
        return json(401, { ok: false, error: 'Incorrect 2FA code.' });
      }
    } else {
      // use-recovery-code: consume one of the stored hashes if it matches.
      const supplied = hashRecoveryCode(body.code || '');
      const idx = (profile.recoveryCodesHashed || []).indexOf(supplied);
      if (idx < 0) return json(401, { ok: false, error: 'Recovery code is invalid or already used.' });
      const remaining = profile.recoveryCodesHashed.slice();
      remaining.splice(idx, 1);
      await updateProfile(userEmail, { recoveryCodesHashed: remaining });
    }

    const token = signSession(userEmail, event);
    if (!token) {
      console.error('SESSION_SECRET missing — cannot complete 2FA sign-in.');
      return json(503, { ok: false, error: 'Sign-in is not configured on this server.' });
    }
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      multiValueHeaders: {
        'Set-Cookie': [sessionCookie(token, event), pre2faCookie('', event, { clear: true })]
      },
      body: JSON.stringify({ ok: true, email: userEmail })
    };
  }

  // ===== Google Sign-In — verify the ID token, then issue our session =====
  // The email comes from the verified Google token, so this is handled before
  // the body.email validation below (which the other actions rely on).
  if (action === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    if (!clientId) return json(503, { ok: false, error: 'Google sign-in is not configured on this server.' });
    const credential = String(body.credential || '');
    if (!credential) return json(400, { ok: false, error: 'Missing Google credential.' });
    let payload;
    try {
      const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
      if (!r.ok) return json(401, { ok: false, error: 'Google sign-in failed. Please try again.' });
      payload = await r.json();
    } catch (err) {
      console.error('Google tokeninfo failed:', err);
      return json(502, { ok: false, error: 'Could not verify Google sign-in right now.' });
    }
    const iss = String(payload.iss || '');
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (String(payload.aud || '') !== clientId) return json(401, { ok: false, error: 'This Google sign-in was not issued for this site.' });
    if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') return json(401, { ok: false, error: 'Invalid Google token issuer.' });
    if (!emailVerified) return json(403, { ok: false, error: 'Your Google email is not verified.' });
    const gEmail = cleanEmail(payload.email);
    if (!isValidEmail(gEmail)) return json(422, { ok: false, error: 'Google did not return a valid email.' });

    // Same as the email-code path: respect TOTP 2FA when the account has it.
    const gProfile = (await readProfile(gEmail)) || {};
    if (gProfile.totpEnabledAt && gProfile.totpSecret) {
      const bridge = signPre2fa(gEmail, event);
      if (!bridge) return json(503, { ok: false, error: 'Sign-in is not configured on this server.' });
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        multiValueHeaders: { 'Set-Cookie': [pre2faCookie(bridge, event)] },
        body: JSON.stringify({ ok: true, email: gEmail, requireTotp: true })
      };
    }
    const gToken = signSession(gEmail, event);
    if (!gToken) return json(503, { ok: false, error: 'Sign-in is not configured on this server.' });
    return json(200, { ok: true, email: gEmail }, { 'Set-Cookie': sessionCookie(gToken, event) });
  }

  const email = cleanEmail(body.email);
  if (!isValidEmail(email)) return json(422, { ok: false, error: 'Please enter a valid email address.' });

  const store = await otpStore().catch(() => null);
  const key = otpKey(email);

  if (action === 'request-otp') {
    const now = Date.now();
    const prev = (await readState(store, key)) || {};
    let windowStart = prev.windowStart || now;
    let requests = prev.requests || 0;
    if (now - windowStart > REQUEST_WINDOW_MS) { windowStart = now; requests = 0; }
    if (requests >= MAX_REQUESTS_PER_WINDOW) {
      return json(429, { ok: false, error: 'Too many code requests. Please wait a while and try again.' });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const state = {
      codeHash: sha256(`${email}:${code}`),
      exp: now + OTP_TTL_MS,
      attempts: 0,
      windowStart,
      requests: requests + 1
    };
    await writeState(store, key, state);

    let dev = false;
    try {
      const result = await sendOtpEmail(email, code);
      dev = Boolean(result.dev);
    } catch (err) {
      console.error('OTP email failed:', err);
      return json(502, { ok: false, error: 'Could not send the code right now. Please try again shortly.' });
    }

    // If no provider is configured AND this is a deployed host (not localhost),
    // that's a misconfiguration — never leak the code in the response.
    if (dev && !isLocalHost(event)) {
      return json(503, { ok: false, error: 'Sign-in email is not configured yet. Please contact us at +1 (916) 399-3992.' });
    }

    // Locally (no provider) we return the code so the flow is testable.
    return json(200, { ok: true, sent: true, ...(dev && isLocalHost(event) ? { devCode: code } : {}) });
  }

  if (action === 'verify-otp') {
    const code = String(body.code || '').replace(/\D/g, '').slice(0, 6);
    const state = await readState(store, key);
    if (!state || !state.codeHash) return json(400, { ok: false, error: 'No active code. Request a new one.' });
    if (Date.now() > state.exp) { await deleteState(store, key); return json(400, { ok: false, error: 'Code expired. Request a new one.' }); }
    if (state.attempts >= MAX_VERIFY_ATTEMPTS) { await deleteState(store, key); return json(429, { ok: false, error: 'Too many attempts. Request a new code.' }); }

    if (sha256(`${email}:${code}`) !== state.codeHash) {
      state.attempts += 1;
      await writeState(store, key, state);
      return json(401, { ok: false, error: 'Incorrect code. Please try again.' });
    }

    await deleteState(store, key); // single-use

    // If this account has TOTP 2FA enabled, the email code alone is NOT
    // enough. Hand out a short-lived pre-2FA cookie and signal the client
    // to collect a TOTP code next.
    const profile = (await readProfile(email)) || {};
    if (profile.totpEnabledAt && profile.totpSecret) {
      const bridge = signPre2fa(email, event);
      if (!bridge) {
        console.error('SESSION_SECRET missing — cannot issue 2FA bridge.');
        return json(503, { ok: false, error: 'Sign-in is not configured on this server.' });
      }
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        multiValueHeaders: { 'Set-Cookie': [pre2faCookie(bridge, event)] },
        body: JSON.stringify({ ok: true, email, requireTotp: true })
      };
    }

    // No 2FA — issue the full session as before.
    const token = signSession(email, event);
    if (!token) {
      console.error('SESSION_SECRET not configured on this deployment; refusing to issue a session.');
      return json(503, { ok: false, error: 'Sign-in is not configured on this server. Please contact us at +1 (916) 399-3992.' });
    }
    return json(200, { ok: true, email }, { 'Set-Cookie': sessionCookie(token, event) });
  }

  return json(400, { ok: false, error: 'Unknown action' });
};
