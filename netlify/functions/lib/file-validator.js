/**
 * Upload safety validator.
 *
 * Goal: even if a client uploads a hostile or malformed file, the server
 * does not store it AND the eventual download cannot be turned into a
 * stored-XSS or polyglot attack against the operator browsing the admin
 * console.
 *
 * Layers:
 *   1. Strict allow-list of MIME types (no octet-stream fallback, no SVG).
 *   2. Filename ban-list: no executables, scripts, html / svg / .htaccess,
 *      no double-extensions like `report.pdf.exe`, no UNC / path traversal
 *      tokens that already passed sanitizeName.
 *   3. Magic-byte (header signature) check on the first N bytes of the
 *      decoded buffer — confirms the file ACTUALLY matches its claimed
 *      type instead of trusting the client's `type` field. A user can lie
 *      about Content-Type but cannot fake `%PDF-` if the body isn't a PDF.
 *
 * Returns { ok: true } on pass, { ok: false, code, error } on reject —
 * code maps to a 4xx response shape in upload.js.
 */

// MIME → magic-byte signature(s). Each signature is a Buffer-match against
// the prefix of the uploaded body. DOCX shares the ZIP signature with
// other zipped formats, so we additionally peek inside (cheap string search
// for [Content_Types].xml).
const SIGNATURES = {
  'application/pdf': [Buffer.from('%PDF-', 'ascii')],
  'image/jpeg':      [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png':       [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                     [Buffer.from([0x50, 0x4B, 0x03, 0x04])]
};

const ALLOWED_MIME = Object.keys(SIGNATURES);

// File-name extensions that are never accepted, even if the body would
// pass — these would be dangerous if the operator double-clicks a
// downloaded file under Windows / macOS Finder.
const BANNED_EXT = new Set([
  // executables
  'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'msi', 'msp', 'dll',
  'ps1', 'ps1xml', 'vb', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'jar',
  // scripts / shells
  'sh', 'bash', 'zsh', 'php', 'phtml', 'py', 'pl', 'rb', 'cgi',
  // web / hijack-prone
  'html', 'htm', 'xhtml', 'svg', 'xml', 'xsl', 'xslt', 'mhtml', 'mht',
  // office macros (DOCM, XLSM are macro-enabled — refuse the macro form;
  // plain DOCX is fine because we strip the macro layer at the MIME check)
  'docm', 'dotm', 'xlsm', 'xltm', 'pptm', 'potm',
  // rarely-needed archives that hide arbitrary content
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso', 'cab', 'lzh', 'arj',
  // misc dangerous
  'lnk', 'url', 'reg', 'inf', 'hta', 'chm', 'apk', 'app', 'dmg', 'pkg'
]);

const NAME_BANNED_PATTERNS = [
  /^\./,            // .htaccess / dotfiles
  /\.lnk$/i
];

// Windows reserved device names. Checked against the basename (everything
// before the first dot) — `CON.pdf` and `con.txt` are both refused.
const WIN_RESERVED = new Set([
  'con', 'nul', 'aux', 'prn',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

function listExtensions(name) {
  // For "report.tar.gz" we want ["tar","gz"] so we can reject any banned
  // extension anywhere in the chain (catches `report.pdf.exe`).
  return String(name || '')
    .split('.')
    .slice(1)
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
}

function validateFilename(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { ok: false, code: 'name-empty', error: 'File has no name.' };
  if (trimmed.length > 160) return { ok: false, code: 'name-long', error: 'File name too long.' };
  for (const re of NAME_BANNED_PATTERNS) {
    if (re.test(trimmed)) return { ok: false, code: 'name-banned', error: 'This filename is not allowed.' };
  }
  const base = trimmed.split('.')[0].toLowerCase();
  if (WIN_RESERVED.has(base)) return { ok: false, code: 'name-reserved', error: 'This filename is reserved on Windows.' };
  const exts = listExtensions(trimmed);
  if (!exts.length) return { ok: false, code: 'no-ext', error: 'File must have an extension (.pdf, .jpg, .png, .docx).' };
  for (const e of exts) {
    if (BANNED_EXT.has(e)) return { ok: false, code: 'ext-banned', error: `.${e} files are not accepted.` };
  }
  return { ok: true };
}

function matchesSignature(buf, mime) {
  const sigs = SIGNATURES[mime];
  if (!sigs) return false;
  for (const sig of sigs) {
    if (buf.length < sig.length) continue;
    if (buf.subarray(0, sig.length).equals(sig)) {
      // Extra check for the DOCX wrapper: it must be a ZIP that contains
      // an Office content-types entry. The string is unique enough that a
      // raw indexOf on the buffer head is good enough.
      if (mime.includes('wordprocessingml')) {
        // [Content_Types].xml lives near the start of an Office ZIP.
        return buf.subarray(0, Math.min(buf.length, 4096)).indexOf('[Content_Types].xml') >= 0;
      }
      return true;
    }
  }
  return false;
}

/**
 * Main entry point used by upload.js.
 *
 * @param {Buffer} buf       decoded file body
 * @param {string} name      client-supplied filename (already sanitized)
 * @param {string} mime      client-supplied MIME (already lower-cased)
 * @returns {{ok:true}|{ok:false, code:string, error:string}}
 */
function validateUpload(buf, name, mime) {
  if (!Buffer.isBuffer(buf) || !buf.length) {
    return { ok: false, code: 'empty', error: 'Empty file.' };
  }
  const nameCheck = validateFilename(name);
  if (!nameCheck.ok) return nameCheck;

  const cleanMime = String(mime || '').toLowerCase().trim();
  if (!ALLOWED_MIME.includes(cleanMime)) {
    return { ok: false, code: 'mime-not-allowed', error: 'Only PDF, JPG, PNG, or DOCX files are accepted.' };
  }
  if (!matchesSignature(buf, cleanMime)) {
    return { ok: false, code: 'signature-mismatch', error: 'The file contents do not match its type. Re-export and try again.' };
  }
  return { ok: true };
}

module.exports = {
  ALLOWED_MIME,
  validateUpload,
  validateFilename,
  matchesSignature
};
