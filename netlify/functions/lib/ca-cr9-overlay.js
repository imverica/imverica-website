'use strict';
/**
 * CR-9 — Sacramento Superior Court (local): "Petition and Order Pursuant to
 * Penal Code §§ 1203.3, 17(b)". The Sacramento local vehicle for early
 * termination of probation (§1203.3) and/or felony→misdemeanor reduction
 * (§17(b)). Filer = the defendant/petitioner, In-Pro-Per (no attorney). The
 * HEARING and ORDER sections are court use only — always left blank.
 *
 * Unlike the statewide Judicial Council forms (AcroForm, filled by
 * lib/ca-court-fill.js), CR-9 is a FLAT scanned PDF with ZERO form fields, so
 * it is filled by drawing a text/checkbox OVERLAY at fixed page coordinates.
 * The coordinate map below was established by render-probe (calibration grid →
 * fill → pdftoppm render → visual verify) against the official blank. Page is
 * US Letter (612×792); pdf-lib origin is bottom-left.
 *
 * UPL / LDA SAFETY: document preparation at the client's direction. The filer
 * is the defendant in pro per; this module does not decide eligibility or which
 * relief to request — the intake answers do.
 */

let _pdfLib = null;
function pdfLib() { return _pdfLib || (_pdfLib = require('pdf-lib')); }

// Verified overlay coordinates (pdf-lib space, origin bottom-left).
const CR9_COORDS = {
  party_name: { x: 75, y: 725, size: 9 },
  party_addr: { x: 75, y: 712, size: 9 },
  party_cityzip: { x: 75, y: 699, size: 9 },
  party_phone: { x: 75, y: 686, size: 9 },
  attorney_for: { x: 98, y: 638, size: 9 },
  defendant_name: { x: 72, y: 582, size: 9 },
  case_number: { x: 395, y: 560, size: 9 },
  dob: { x: 535, y: 560, size: 9 },
  cb_defendant: { x: 269, y: 508, size: 11 }, // "I am the defendant in the above entitled action"
  convicted_on: { x: 165, y: 487, size: 9 },
  cb_felony: { x: 358, y: 487, size: 11 },
  cb_misd: { x: 455, y: 487, size: 11 },
  violation: { x: 198, y: 456, size: 9 },
  cb_17b: { x: 71, y: 418, size: 11 },        // reduce charge(s) to misdemeanor (PC 17b)
  cb_1203: { x: 71, y: 400, size: 11 },       // probation terminated (PC 1203.3)
  executed_on: { x: 130, y: 322, size: 9 },
  print_name: { x: 470, y: 292, size: 9 }
};
// The source blank had a stray "Attorney for" name baked into its text layer;
// white it out defensively even if the cached template was already cleaned.
const STRAY_NAME_REDACT = { x: 95, y: 634, width: 78, height: 16 };

function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function lc(v) { return String(v || '').toLowerCase(); }
function truthy(v) { return /^(y|yes|true|1|да|так)/.test(lc(v)); }

/**
 * Build the overlay descriptor list from intake answers. Returns
 * [{ key, kind:'text'|'check', x, y, size, text }]. No PDF I/O — pure, so QA
 * can assert the checkbox logic without rendering.
 */
function cr_9Overlays(payload = {}) {
  const a = payload.formAnswers || payload.answers || payload || {};
  const name = String(pick(a, 'petitioner_name', 'defendant_name', 'client_name') || '').trim();
  const addr = String(pick(a, 'petitioner_address_line1', 'address_line1', 'mailing_address_line1') || '').trim();
  const cityzip = [pick(a, 'petitioner_city', 'city', 'mailing_city'),
    pick(a, 'petitioner_state', 'state') || 'CA',
    pick(a, 'petitioner_zip', 'zip', 'mailing_zip')].map((x) => String(x || '').trim()).filter(Boolean).join(', ');
  const phone = String(pick(a, 'petitioner_phone', 'phone') || '').trim();
  const out = [];
  const T = (key, text) => { const t = String(text == null ? '' : text).trim(); if (t) out.push({ key, kind: 'text', ...CR9_COORDS[key], text: t }); };
  const X = (key) => out.push({ key, kind: 'check', ...CR9_COORDS[key], text: 'X' });

  // ── Caption / party block (In-Pro-Per: filer is the defendant) ──
  T('party_name', name);
  T('party_addr', addr);
  T('party_cityzip', cityzip);
  T('party_phone', phone);
  T('attorney_for', name ? `${name}, In Pro Per` : '');
  T('defendant_name', name);
  T('case_number', pick(a, 'case_number'));
  T('dob', pick(a, 'date_of_birth', 'dob'));

  // ── Petition ── filer is the defendant in pro per (not the attorney).
  X('cb_defendant');
  T('convicted_on', pick(a, 'convicted_on', 'conviction_date'));
  const lvl = lc(pick(a, 'conviction_level', 'offense_level'));
  if (/felony/.test(lvl)) X('cb_felony'); else if (/misd/.test(lvl)) X('cb_misd');
  T('violation', pick(a, 'violation_sections', 'offenses', 'conviction_charges'));

  // ── Relief requested ── default to 1203.3 termination for this matter;
  //    17(b) reduction only when the answers ask for it.
  const wants1203 = pick(a, 'terminate_probation', 'relief_1203_3');
  if (wants1203 === '' || truthy(wants1203)) X('cb_1203');
  if (truthy(pick(a, 'reduce_felony_17b', 'relief_17b'))) X('cb_17b');

  // ── Declaration ──
  T('executed_on', pick(a, 'executed_on', 'executed_date', 'signature_date'));
  T('print_name', name);
  return out;
}

/**
 * Fill a CR-9 blank (flat scanned PDF bytes) and return the filled PDF Buffer.
 * @param {Buffer|Uint8Array} blankBytes  the cached/official CR-9 blank
 * @param {object} payload                { formAnswers } intake
 */
async function cr_9FillFlat(blankBytes, payload = {}) {
  const { PDFDocument, StandardFonts, rgb } = pdfLib();
  const doc = await PDFDocument.load(blankBytes, { ignoreEncryption: true });
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.getPage(0);
  page.drawRectangle({ ...STRAY_NAME_REDACT, color: rgb(1, 1, 1) });
  const overlays = cr_9Overlays(payload);
  for (const o of overlays) {
    page.drawText(o.text, { x: o.x, y: o.y, size: o.size, font: o.kind === 'check' ? helvB : helv, color: rgb(0, 0, 0) });
  }
  const bytes = await doc.save();
  return { buffer: Buffer.from(bytes), filled: overlays.map((o) => o.key), skipped: [], total: overlays.length };
}

module.exports = { cr_9Overlays, cr_9FillFlat, CR9_COORDS };
