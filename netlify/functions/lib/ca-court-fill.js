'use strict';
/**
 * California court form fill engine (pdf-lib based).
 *
 * Separate from the USCIS engine (pdf-incremental-fill.js): CA Judicial
 * Council forms are XFA/AcroForm hybrids with deeply-nested field names
 * (e.g. "FL-100[0].Page1[0].CaptionP1_sf[0].TitlePartyName[0].Party1_ft[0]")
 * that the USCIS raw-PDF engine doesn't match. pdf-lib's form API handles
 * them correctly once the form is decrypted (see scripts/decrypt-ca-forms.js).
 *
 * Input PDFs MUST come from assets/form-cache/ca-court/ (decrypted). Filling
 * an encrypted original silently sets 0 fields.
 *
 * Public API:
 *   fillCourtForm(pdfBuffer, fieldValues) -> { buffer, filled, skipped, total }
 *
 * fieldValues shape: { "<fullFieldName>": value }
 *   - string  -> text field setText
 *   - true    -> checkbox check()  / false -> uncheck()
 *   - { radio: "ExportValue" } -> radio group select
 *   - { dropdown: "Option" }   -> dropdown select
 */

const { PDFDocument, StandardFonts } = require('pdf-lib');

async function fillCourtForm(pdfBuffer, fieldValues = {}) {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const form = doc.getForm();
  // Embed a standard Helvetica so pdf-lib generates self-contained
  // appearance streams. CA forms reference 'Helvetica' in their default
  // resources by NAME only (not embedded); without this, some renderers
  // (poppler/print pipelines) warn "Unknown font tag 'Helvetica'" and
  // may drop the value. Embedding + updateFieldAppearances(font) below
  // bakes a real font into every filled field so it renders everywhere.
  const helv = await doc.embedFont(StandardFonts.Helvetica);

  const filled = [];
  const skipped = [];

  for (const [name, raw] of Object.entries(fieldValues)) {
    if (raw === undefined || raw === null || raw === '') continue;
    try {
      if (raw === true || raw === false) {
        const cb = form.getCheckBox(name);
        if (raw) cb.check(); else cb.uncheck();
        filled.push(name);
      } else if (typeof raw === 'object' && 'radio' in raw) {
        form.getRadioGroup(name).select(String(raw.radio));
        filled.push(name);
      } else if (typeof raw === 'object' && 'dropdown' in raw) {
        form.getDropdown(name).select(String(raw.dropdown));
        filled.push(name);
      } else {
        const tf = form.getTextField(name);
        tf.setText(String(raw));
        filled.push(name);
      }
    } catch (err) {
      skipped.push({ name, reason: String(err && err.message || err).slice(0, 80) });
    }
  }

  // Generate appearance streams for every field using the embedded font.
  // We deliberately do NOT set NeedAppearances — baking real appearances
  // here is more portable than asking the viewer to regenerate them.
  try { form.updateFieldAppearances(helv); } catch (_) { /* best-effort */ }

  const out = await doc.save();
  return {
    buffer: Buffer.from(out),
    filled,
    skipped,
    total: Object.keys(fieldValues).length
  };
}

/**
 * Flatten a filled form (bake field values into static content so they
 * can't be edited). Use for the final filing copy; keep unflattened for
 * the client's editable draft.
 */
async function fillAndFlattenCourtForm(pdfBuffer, fieldValues = {}) {
  const res = await fillCourtForm(pdfBuffer, fieldValues);
  const doc = await PDFDocument.load(res.buffer, { ignoreEncryption: true });
  try { doc.getForm().flatten(); } catch (_) { /* some hybrids resist flatten — ignore */ }
  const out = await doc.save();
  return { ...res, buffer: Buffer.from(out), flattened: true };
}

module.exports = { fillCourtForm, fillAndFlattenCourtForm };
