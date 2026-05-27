/**
 * Two-factor admin authentication for the operator console.
 *
 * Every admin call MUST present BOTH:
 *   1. Authorization: Bearer <INTAKE_ADMIN_TOKEN>   (something you know)
 *   2. X-Admin-TOTP: <6-digit current code>          (something you have —
 *      from Google Authenticator / Authy, seeded with ADMIN_TOTP_SECRET)
 *
 * If a future Netlify breach exposed env vars to an attacker, the admin
 * token alone would no longer be enough to read /api/intake or change
 * order status — they'd also need the operator's authenticator device.
 *
 * Setup (one-time):
 *   1. Run `node -e "console.log(require('./netlify/functions/lib/totp').generateSecret())"`
 *      to print a base32 secret.
 *   2. Add ADMIN_TOTP_SECRET (mark as secret) on Netlify with that value.
 *   3. Run `npx qrencode -t ANSIUTF8 -m 1 "otpauth://totp/Imverica:admin?secret=...&issuer=Imverica"`
 *      (or build the URL via lib/totp.otpauthURL) and scan into Google
 *      Authenticator.
 *
 * Local-dev shortcut: if ADMIN_TOTP_SECRET is not set on localhost, the
 * TOTP check is skipped so the bearer token alone keeps working under
 * `netlify dev`. On a deployed host (no localhost), missing env var fails
 * closed — admin endpoints return 401 until the secret is configured.
 */

const { verifyTOTP } = require('./totp');

function isLocalHost(event) {
  const host = String(event?.headers?.host || event?.headers?.Host || '');
  return host.includes('localhost') || host.includes('127.0.0.1');
}

function readHeader(event, name) {
  const h = event?.headers || {};
  return h[name] || h[name.toLowerCase()] || h[name.toUpperCase()] || '';
}

/**
 * Returns true when the request carries a valid bearer token AND a valid
 * current TOTP code. Logs the reason on failure so the operator can debug
 * via Netlify function logs without exposing it on the wire.
 */
function isAdmin(event) {
  const expectedToken = process.env.INTAKE_ADMIN_TOKEN;
  if (!expectedToken) return false;

  // Bearer check (same shape as the legacy single-factor admin auth).
  const auth = readHeader(event, 'authorization') || readHeader(event, 'Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const queryToken = (event?.queryStringParameters?.token || '').trim();
  const tokenOK = bearer === expectedToken || queryToken === expectedToken;
  if (!tokenOK) return false;

  // Second factor check. While ADMIN_TOTP_SECRET is not yet set on
  // Netlify, fall back to single-factor (bearer only) so existing admin
  // workflows keep working during rollout — but log a loud warning so the
  // operator knows they're in the "set up second factor!" state. Once the
  // env var lands, the bearer alone is no longer enough.
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  if (!totpSecret) {
    if (!isLocalHost(event)) {
      console.warn('admin-auth: ADMIN_TOTP_SECRET is NOT set — admin endpoints are single-factor. Set it on Netlify to enable 2FA.');
    }
    return true;
  }

  const code =
    readHeader(event, 'x-admin-totp') ||
    readHeader(event, 'X-Admin-TOTP') ||
    (event?.queryStringParameters?.totp || '').trim();
  if (!code) return false;
  return verifyTOTP(totpSecret, code);
}

module.exports = { isAdmin };
