'use strict';
/**
 * FINAL PDF workflow locks + flattening (Phases 9/12/13).
 *
 * The final, signature-ready PDF may only be produced when BOTH locks open:
 *   1. client-approval lock — the order status is approved_by_client
 *      (the client pressed "Approve documents" in the portal);
 *   2. QC lock — staff completed every item of the QC checklist.
 *
 * Only then is the form flattened (values baked into the page, AcroForm
 * removed). Until that moment every artifact stays an editable DRAFT —
 * "do not flatten until approval", no exceptions.
 *
 * Flattening uses pdf-lib, which requires the qpdf-NORMALIZED template
 * (assets/form-cache/pdfs-normalized/) — pdf-lib cannot parse the raw USCIS
 * object-stream PDFs. Forms are final-enabled exactly when a normalized
 * template exists.
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { incrementalFillPdf } = require('./pdf-incremental-fill');
const { normalizeStatus } = require('./case-status');
const { QC_CHECKLISTS } = require('./form-registry');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const NORMALIZED_DIR = path.join(ROOT, 'assets/form-cache/pdfs-normalized');

function finalEnabledForms() {
  try {
    return fs.readdirSync(NORMALIZED_DIR)
      .filter((f) => f.endsWith('.pdf'))
      .map((f) => f.replace(/\.pdf$/, '').toUpperCase());
  } catch { return []; }
}

/**
 * Throws { statusCode, error, lock } when a lock is closed. Returns silently
 * when the final PDF may be generated.
 */
function assertFinalLocks(record) {
  const status = normalizeStatus(record && record.status) || '';
  if (status !== 'approved_by_client') {
    const err = new Error('Client approval required: the order must be approved by the client before the final PDF can be generated.');
    err.statusCode = 409; err.lock = 'client-approval';
    throw err;
  }
  const required = QC_CHECKLISTS._generic.length;
  const checked = record && record.qc && Array.isArray(record.qc.items) ? record.qc.items.length : 0;
  if (checked < required) {
    const err = new Error(`QC checklist incomplete: ${checked}/${required} items confirmed.`);
    err.statusCode = 409; err.lock = 'qc';
    throw err;
  }
}

/**
 * Fill the NORMALIZED template with the record's answers and flatten it.
 * @returns {Promise<{buffer: Buffer, filledFields: number}>}
 */
async function buildFinalPdf(formCode, payload) {
  const code = String(formCode || '').trim().toUpperCase();
  const slug = code.toLowerCase();
  const tplPath = path.join(NORMALIZED_DIR, `${slug}.pdf`);
  if (!fs.existsSync(tplPath)) {
    const err = new Error(`Final generation is not enabled for ${code} yet (no normalized template).`);
    err.statusCode = 422;
    throw err;
  }
  const mod = require(`./${slug.replace(/-/g, '')}-pdf-map.js`);
  const build = Object.values(mod).find((f) => typeof f === 'function' && /fieldvalues/i.test(f.name))
    || Object.values(mod).find((f) => typeof f === 'function');
  const overlayEntry = Object.entries(mod).find(([k, v]) => typeof v === 'function' && /textoverlays/i.test(k));
  const values = build(payload);
  const overlays = overlayEntry ? overlayEntry[1](payload) : [];

  const filled = incrementalFillPdf(fs.readFileSync(tplPath), values, overlays);
  const doc = await PDFDocument.load(filled.buffer, { ignoreEncryption: true });
  doc.getForm().flatten();
  const bytes = await doc.save();
  return { buffer: Buffer.from(bytes), filledFields: (filled.filledFields || []).length };
}

module.exports = { assertFinalLocks, buildFinalPdf, finalEnabledForms };
