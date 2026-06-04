'use strict';

const crypto = require('crypto');

function sessionSecret(event) {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 20) return secret;
  const host = String(event?.headers?.host || event?.headers?.Host || '');
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'imverica-dev-session-secret-change-me';
  }
  return null;
}

function b64url(value) {
  return Buffer.from(value).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function parseCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return '';
}

function verifySession(token, event) {
  if (!token || !token.includes('.')) return null;
  const secret = sessionSecret(event);
  if (!secret) return null;

  const [body, signature] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(
      body.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8'));
  } catch {
    return null;
  }

  if (!payload?.email || !payload?.exp || Date.now() > payload.exp) return null;
  return payload;
}

function sessionFromEvent(event) {
  const header = event?.headers?.cookie || event?.headers?.Cookie || '';
  return verifySession(parseCookie(header, 'imv_session'), event);
}

// Used by local QA. Production callers still need SESSION_SECRET.
function signSession(email, event, ttlMs = 60 * 60 * 1000) {
  const secret = sessionSecret(event);
  if (!secret) return '';
  const body = b64url(JSON.stringify({
    email: String(email || '').trim().toLowerCase(),
    exp: Date.now() + ttlMs
  }));
  const signature = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${signature}`;
}

module.exports = { parseCookie, sessionFromEvent, signSession, verifySession };
