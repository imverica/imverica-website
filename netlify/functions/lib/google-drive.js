/**
 * Google Drive integration for Imverica intake uploads.
 *
 * Architecture:
 *   - Service Account (created in GCP Console, key JSON base64-encoded
 *     into Netlify env var GOOGLE_DRIVE_SA_KEY_BASE64).
 *   - Owner manually creates a root folder in their personal Drive
 *     ("Imverica Intakes") and shares it with the SA email (Editor).
 *   - Folder ID from the share URL → env var GOOGLE_DRIVE_ROOT_FOLDER_ID.
 *   - This lib signs JWTs with the SA's RSA-2048 private key (no
 *     google-auth-library dep — Node crypto only), exchanges them for
 *     OAuth2 access tokens, and calls the Drive REST API directly.
 *
 * Layout inside the root folder:
 *   Imverica Intakes/
 *     ├── John Smith/                       ← per-client folder (by name)
 *     │     ├── IMV-20260603-A1B2C3D4/      ← per-order subfolder
 *     │     │     ├── passport.pdf
 *     │     │     ├── i797.jpg
 *     │     │     └── tax-2024.pdf
 *     │     └── IMV-20260710-XY99ZZ12/
 *     └── María García/
 *           └── IMV-20260612-FOO/
 *
 * Robustness: every public function fail-closes silently when env vars
 * are missing — callers wrap in try/catch so an outage on Google's side
 * never blocks an intake. Drive is additive; the legacy email + Blob
 * paths still carry the file content.
 */

'use strict';

const crypto = require('crypto');

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/drive';

// One-process cache for the access token. Drive tokens last 1h; we
// refresh ~5 min early to avoid edge-case 401s. Per Netlify Function
// invocation this cache is fresh, but warm containers reuse.
let cachedToken = null;
let cachedTokenExp = 0;
let cachedSaEmail = null;

class DriveDisabled extends Error {
  constructor(msg) { super(msg); this.name = 'DriveDisabled'; }
}

function readSaKey() {
  // Support TWO env-var formats for backwards compatibility with the
  // legacy upload.js integration:
  //   GOOGLE_DRIVE_SA_KEY_BASE64  — base64-encoded JSON (preferred,
  //                                  no escape-character footguns)
  //   GDRIVE_SERVICE_ACCOUNT_JSON — raw JSON string (legacy)
  const b64 = process.env.GOOGLE_DRIVE_SA_KEY_BASE64;
  const rawJson = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
  let json;
  if (b64 && b64.length >= 100) {
    try {
      json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch (err) {
      throw new DriveDisabled('GOOGLE_DRIVE_SA_KEY_BASE64 not valid base64-JSON: ' + err.message);
    }
  } else if (rawJson && rawJson.length >= 100) {
    try {
      json = JSON.parse(rawJson);
    } catch (err) {
      throw new DriveDisabled('GDRIVE_SERVICE_ACCOUNT_JSON not valid JSON: ' + err.message);
    }
  } else {
    throw new DriveDisabled('Neither GOOGLE_DRIVE_SA_KEY_BASE64 nor GDRIVE_SERVICE_ACCOUNT_JSON is set');
  }
  if (!json.client_email || !json.private_key) {
    throw new DriveDisabled('SA key JSON missing client_email or private_key');
  }
  return json;
}

function rootFolderId() {
  // Either env-var name accepted (new project + legacy upload.js).
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || process.env.GDRIVE_PARENT_FOLDER_ID;
  if (!id || id.length < 8) {
    throw new DriveDisabled('Neither GOOGLE_DRIVE_ROOT_FOLDER_ID nor GDRIVE_PARENT_FOLDER_ID is set');
  }
  return id;
}

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: SCOPE,
    aud: OAUTH_TOKEN,
    iat: now,
    exp: now + 3600
  }));
  const signing = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signing);
  const sig = signer.sign(sa.private_key);
  return `${signing}.${base64url(sig)}`;
}

async function getAccessToken() {
  // Refresh 5 min before expiry
  if (cachedToken && Date.now() < cachedTokenExp - 5 * 60 * 1000) {
    return cachedToken;
  }
  const sa = readSaKey();
  cachedSaEmail = sa.client_email;
  const jwt = buildJwt(sa);
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }).toString()
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Drive OAuth ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('OAuth response missing access_token');
  cachedToken = data.access_token;
  cachedTokenExp = Date.now() + (Number(data.expires_in || 3600) * 1000);
  return cachedToken;
}

// Drive's "q" parameter is fragile — escape strings to be safe.
function escapeQ(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Sanitise filenames / folder names to something Drive accepts cleanly.
// Drive allows almost anything in folder names, but we strip control
// characters and limit to 120 chars so the UI doesn't blow up.
function sanitizeName(name) {
  return String(name || 'unknown')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'unknown';
}

async function driveGet(pathAndQuery, accessToken) {
  const res = await fetch(`${DRIVE_API}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Drive GET ${pathAndQuery} → ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

async function driveCreateFolder(name, parentId, accessToken) {
  const res = await fetch(`${DRIVE_API}/files?supportsAllDrives=true&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Drive create folder "${name}" → ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

async function findFolderByName(name, parentId, accessToken) {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and trashed=false ` +
    `and '${parentId}' in parents and name='${escapeQ(name)}'`
  );
  const data = await driveGet(`/files?q=${q}&fields=files(id,name,webViewLink)&pageSize=10`, accessToken);
  return (data.files && data.files[0]) || null;
}

async function findOrCreateFolder(name, parentId, accessToken) {
  const safe = sanitizeName(name);
  const found = await findFolderByName(safe, parentId, accessToken);
  if (found) return found;
  return driveCreateFolder(safe, parentId, accessToken);
}

/**
 * Public: find or create the per-client / per-order folder layout.
 * Returns { clientFolder, orderFolder } each with { id, name, webViewLink }.
 * If clientName is empty, the layout collapses to root/<orderId>.
 */
async function getOrCreateOrderFolder({ clientName, orderId }) {
  const accessToken = await getAccessToken();
  const root = rootFolderId();
  let clientFolder = { id: root, name: '(root)', webViewLink: '' };
  const safeName = sanitizeName(clientName);
  if (safeName && safeName !== 'unknown') {
    clientFolder = await findOrCreateFolder(safeName, root, accessToken);
  }
  const orderFolder = await findOrCreateFolder(orderId || 'unscheduled', clientFolder.id, accessToken);
  return { clientFolder, orderFolder, accessToken };
}

/**
 * Upload a single file (raw Buffer) into a Drive folder.
 * Uses Drive's multipart upload — fine for files up to ~100 MB. For
 * larger we'd switch to resumable; not needed today.
 *
 * Returns { id, name, webViewLink, webContentLink }.
 */
async function uploadBufferToFolder({ folderId, filename, mimeType, buffer, accessToken }) {
  if (!accessToken) accessToken = await getAccessToken();
  const safeName = sanitizeName(filename || 'file');
  const meta = {
    name: safeName,
    parents: [folderId]
  };
  const boundary = 'imverica-' + crypto.randomBytes(12).toString('hex');
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(meta) + `\r\n`;
  const filePart = `--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;

  const body = Buffer.concat([
    Buffer.from(metaPart, 'utf8'),
    Buffer.from(filePart, 'utf8'),
    buffer,
    Buffer.from(tail, 'utf8')
  ]);

  const res = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,size,mimeType`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length)
      },
      body
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Drive upload "${safeName}" → ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Public: upload an array of attachments into a per-client / per-order
 * folder, creating the folders if they don't exist. Returns:
 *   {
 *     enabled:        true,
 *     clientFolder:   { id, name, webViewLink },
 *     orderFolder:    { id, name, webViewLink },
 *     uploadedFiles:  [{ filename, id, webViewLink, size, mimeType }],
 *     skippedFiles:   [{ filename, reason }],   // any per-file errors
 *   }
 *
 * On total failure (missing env, network down, auth refused) throws
 * DriveDisabled OR a generic Error. Callers wrap in try/catch and
 * continue without Drive metadata.
 */
async function uploadAttachmentsToClientFolder({ clientName, orderId, attachments }) {
  const { clientFolder, orderFolder, accessToken } = await getOrCreateOrderFolder({ clientName, orderId });
  const uploadedFiles = [];
  const skippedFiles = [];
  for (const att of (attachments || [])) {
    try {
      const buffer = Buffer.isBuffer(att.buffer)
        ? att.buffer
        : Buffer.from(att.buffer || att.contentBase64 || '', 'base64');
      const up = await uploadBufferToFolder({
        folderId: orderFolder.id,
        filename: att.filename,
        mimeType: att.mimeType || att.contentType || 'application/octet-stream',
        buffer,
        accessToken
      });
      uploadedFiles.push({
        filename: up.name,
        id: up.id,
        webViewLink: up.webViewLink,
        size: Number(up.size || buffer.length),
        mimeType: up.mimeType
      });
    } catch (err) {
      skippedFiles.push({ filename: att.filename, reason: err.message.slice(0, 200) });
    }
  }
  return {
    enabled: true,
    clientFolder: { id: clientFolder.id, name: clientFolder.name, webViewLink: clientFolder.webViewLink || '' },
    orderFolder:  { id: orderFolder.id,  name: orderFolder.name,  webViewLink: orderFolder.webViewLink  || '' },
    uploadedFiles,
    skippedFiles
  };
}

/**
 * Lightweight self-check — used by smoke tests and the admin "Drive ok?"
 * indicator. Returns { ok, saEmail, rootId, error }.
 */
async function checkDriveConfig() {
  try {
    readSaKey();
    rootFolderId();
    await getAccessToken();
    // Verify we can list the root folder
    await driveGet(`/files/${rootFolderId()}?fields=id,name`, cachedToken);
    return { ok: true, saEmail: cachedSaEmail, rootId: rootFolderId() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  DriveDisabled,
  uploadAttachmentsToClientFolder,
  getOrCreateOrderFolder,
  uploadBufferToFolder,
  checkDriveConfig
};
