'use strict';
/**
 * USCIS packet generator (Phase 11) — assembles a complete review packet
 * around the filled form, in the spec's section order:
 *
 *   I-765: Cover Sheet · I-765 · Checklist · Evidence Index ·
 *          Review Instructions · Filing Instructions
 *   I-589: Cover Sheet · I-589 · Evidence Index · Declaration Placeholder ·
 *          Country Conditions Placeholder · Review Instructions ·
 *          Filing Instructions
 *
 * The FORM pages come from the existing render-verified map + incremental
 * fill engine (values + appearance streams, NOT flattened — flattening only
 * happens after client approval, per the final-PDF workflow). Accessory pages
 * are drawn with pdf-lib and carry a DRAFT banner: the packet is a review
 * artifact, never a filing-ready document.
 *
 * Wording on every accessory page is informational (LDA/UPL-safe): document
 * lists restate the official instructions; nothing tells the client what they
 * legally should file.
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { incrementalFillPdf } = require('./pdf-incremental-fill');
const { getFormProfile, PACKET_CHECKLISTS } = require('./form-registry');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const PAGE = { w: 612, h: 792, margin: 56 }; // US Letter, 1" margins approx
const NAVY = rgb(0.10, 0.18, 0.29);
const GOLD = rgb(0.86, 0.66, 0.37);
const GREY = rgb(0.36, 0.40, 0.46);
const LIGHT = rgb(0.93, 0.94, 0.95);

function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const probe = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(probe, size) <= maxWidth) line = probe;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/**
 * Tiny page composer: tracks the cursor, adds pages on overflow, draws
 * headings / paragraphs / bullets / dividers consistently on every page.
 */
function makeComposer(doc, fonts, meta) {
  const state = { page: null, y: 0 };
  function decorate(page) {
    page.drawRectangle({ x: 0, y: PAGE.h - 6, width: PAGE.w, height: 6, color: NAVY });
    page.drawText('IMVERICA LEGAL SOLUTIONS — DOCUMENT PREPARATION', {
      x: PAGE.margin, y: PAGE.h - 30, size: 8, font: fonts.bold, color: GREY
    });
    page.drawText('DRAFT — FOR REVIEW ONLY — NOT FOR FILING', {
      x: PAGE.w - PAGE.margin - fonts.bold.widthOfTextAtSize('DRAFT — FOR REVIEW ONLY — NOT FOR FILING', 8),
      y: PAGE.h - 30, size: 8, font: fonts.bold, color: rgb(0.64, 0.22, 0.16)
    });
    page.drawText(`${meta.formCode} packet · ${meta.clientName || ''} · ${meta.date}`, {
      x: PAGE.margin, y: 26, size: 8, font: fonts.regular, color: GREY
    });
  }
  function newPage() {
    state.page = doc.addPage([PAGE.w, PAGE.h]);
    decorate(state.page);
    state.y = PAGE.h - 64;
    return state.page;
  }
  function need(height) { if (!state.page || state.y - height < 48) newPage(); }
  return {
    newPage,
    title(text) {
      need(60);
      state.y -= 18;
      state.page.drawText(text, { x: PAGE.margin, y: state.y, size: 19, font: fonts.bold, color: NAVY });
      state.y -= 10;
      state.page.drawRectangle({ x: PAGE.margin, y: state.y, width: 64, height: 3, color: GOLD });
      state.y -= 18;
    },
    heading(text) {
      need(40);
      state.y -= 12;
      state.page.drawText(text, { x: PAGE.margin, y: state.y, size: 12.5, font: fonts.bold, color: NAVY });
      state.y -= 16;
    },
    para(text, opts) {
      const size = (opts && opts.size) || 10;
      const lines = wrapText(text, fonts.regular, size, PAGE.w - PAGE.margin * 2);
      for (const line of lines) {
        need(size + 6);
        state.page.drawText(line, { x: PAGE.margin, y: state.y, size, font: fonts.regular, color: (opts && opts.color) || rgb(0.16, 0.19, 0.25) });
        state.y -= size + 4;
      }
      state.y -= 4;
    },
    bullets(items, opts) {
      const numbered = opts && opts.numbered;
      const checkbox = opts && opts.checkbox;
      items.forEach((item, i) => {
        const size = 10;
        const markerW = numbered ? 18 : (checkbox ? 18 : 12);
        const lines = wrapText(item, fonts.regular, size, PAGE.w - PAGE.margin * 2 - markerW);
        need((size + 4) * lines.length + 4);
        if (checkbox) {
          // Helvetica/WinAnsi has no ballot-box glyph — draw the square.
          state.page.drawRectangle({ x: PAGE.margin, y: state.y - 1, width: 9, height: 9, borderColor: GREY, borderWidth: 0.9 });
        } else {
          state.page.drawText(numbered ? `${i + 1}.` : '\u2022', { x: PAGE.margin, y: state.y, size, font: fonts.bold, color: GOLD });
        }
        lines.forEach((line, j) => {
          if (j > 0) need(size + 4);
          state.page.drawText(line, { x: PAGE.margin + markerW, y: state.y, size, font: fonts.regular, color: rgb(0.16, 0.19, 0.25) });
          state.y -= size + 4;
        });
        state.y -= 3;
      });
      state.y -= 4;
    },
    fillLines(count, label) {
      for (let i = 0; i < count; i++) {
        need(26);
        if (label) {
          state.page.drawText(`${label} ${i + 1}`, { x: PAGE.margin, y: state.y, size: 9, font: fonts.regular, color: GREY });
          state.y -= 14;
        }
        state.page.drawRectangle({ x: PAGE.margin, y: state.y, width: PAGE.w - PAGE.margin * 2, height: 0.8, color: LIGHT });
        state.y -= 20;
      }
    },
    keyValue(rows) {
      for (const [k, v] of rows) {
        need(18);
        state.page.drawText(k, { x: PAGE.margin, y: state.y, size: 10, font: fonts.bold, color: GREY });
        state.page.drawText(String(v || '—'), { x: PAGE.margin + 170, y: state.y, size: 10, font: fonts.regular, color: rgb(0.1, 0.12, 0.16) });
        state.y -= 17;
      }
      state.y -= 6;
    }
  };
}

function loadMapModule(formCode) {
  const slug = String(formCode).toLowerCase().replace(/-/g, '');
  return require(`./${slug}-pdf-map.js`);
}

function buildFilledForm(formCode, payload) {
  const mod = loadMapModule(formCode);
  const build = Object.values(mod).find((f) => typeof f === 'function' && /fieldvalues/i.test(f.name));
  const overlayFn = Object.entries(mod).find(([k, v]) => typeof v === 'function' && /textoverlays/i.test(k));
  const values = (build || Object.values(mod).find((f) => typeof f === 'function'))(payload);
  const overlays = overlayFn ? overlayFn[1](payload) : [];
  // Packet forms fill the qpdf-NORMALIZED template (scripts/
  // normalize-packet-templates.js): same field names, same fill results, but
  // pdf-lib can parse it for the merge — the raw USCIS object-stream PDFs
  // cannot be read by pdf-lib at all.
  const pdfPath = path.join(ROOT, 'assets/form-cache/pdfs-normalized', `${String(formCode).toLowerCase()}.pdf`);
  const out = incrementalFillPdf(fs.readFileSync(pdfPath), values, overlays);
  return { buffer: out.buffer, filled: (out.filledFields || []).length };
}

/**
 * Build the complete packet.
 * @param {string} formCode  'I-765' | 'I-589'
 * @param {object} payload   { formAnswers, contact }
 * @returns {Promise<{buffer: Buffer, pages: number, sections: string[], filledFields: number}>}
 */
async function buildUscisPacket(formCode, payload) {
  const code = String(formCode || '').trim().toUpperCase();
  if (!PACKET_CHECKLISTS[code]) throw new Error(`No packet definition for ${code}`);
  const profile = getFormProfile(code) || {};
  // manifest titles often already start with "I-765, " — avoid "I-765 — I-765, …".
  const cleanTitle = String(profile.title || 'USCIS form').replace(new RegExp('^' + code + '[,—–-]\\s*'), '');
  const a = (payload && payload.formAnswers) || {};
  const contact = (payload && payload.contact) || {};
  const clientName = contact.name || [a.applicant_given_name, a.applicant_family_name].filter(Boolean).join(' ');
  const meta = { formCode: code, clientName, date: new Date().toISOString().slice(0, 10) };
  const sections = [];

  const filled = buildFilledForm(code, payload);
  const formDoc = await PDFDocument.load(filled.buffer, { ignoreEncryption: true });

  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold)
  };
  const c = makeComposer(doc, fonts, meta);

  // ===== 1. Cover Sheet =====
  sections.push('cover');
  c.newPage();
  c.title(`${code} — ${cleanTitle}`);
  c.para('Document preparation packet assembled by Imverica Legal Solutions at the client’s direction. Imverica is not a law firm and does not provide legal advice; the client decides what to file.', { color: GREY });
  c.heading('Packet summary');
  c.keyValue([
    ['Client', clientName],
    ['Form', `${code} — ${cleanTitle}`],
    ['Edition date', profile.editionDate || 'verify on official source'],
    ['Official source', profile.officialPageUrl || ''],
    ['Prepared on', meta.date],
    ['Status', 'DRAFT — awaiting review']
  ]);
  c.heading('Review workflow');
  c.bullets([
    'Imverica staff completes the quality-control checklist below.',
    'The client reviews every page of the draft form.',
    'The client approves the packet, or requests corrections, in the client portal.',
    'Only after approval is the final, signature-ready version produced.'
  ], { numbered: true });

  // ===== 2. The filled form =====
  sections.push('form');
  const formPages = await doc.copyPages(formDoc, formDoc.getPageIndices());
  formPages.forEach((p) => doc.addPage(p));

  // ===== 3. Checklist (I-765 order) / Evidence index first for I-589 =====
  const checklist = PACKET_CHECKLISTS[code];

  function drawChecklist() {
    sections.push('checklist');
    c.newPage();
    c.title('Document checklist');
    c.para('Standard items listed in the official form instructions. The client provides and selects the documents; mark each item as it is collected.');
    c.bullets(checklist, { checkbox: true });
  }
  function drawEvidenceIndex() {
    sections.push('evidence-index');
    c.newPage();
    c.title('Evidence index');
    c.para('List every document included with the filing, in order. The index travels on top of the evidence stack.');
    c.fillLines(14, 'Exhibit');
  }

  if (code === 'I-589') {
    drawEvidenceIndex();
    sections.push('declaration-placeholder');
    c.newPage();
    c.title('Applicant declaration — placeholder');
    c.para('Reserved for the applicant’s personal declaration describing the claim, in the applicant’s own words. Imverica formats the declaration the client writes; it does not draft the story for the client.');
    c.fillLines(10);
    sections.push('country-conditions-placeholder');
    c.newPage();
    c.title('Country conditions — placeholder');
    c.para('Reserved for the country-conditions materials the client chooses to include (reports, articles, official advisories). List each source on the evidence index.');
    c.fillLines(8, 'Source');
  } else {
    drawChecklist();
    drawEvidenceIndex();
  }

  // ===== Review instructions =====
  sections.push('review-instructions');
  c.newPage();
  c.title('Review instructions');
  c.bullets([
    'Check the spelling of every name exactly against the passport or ID.',
    'Check the date of birth and every other date on every page.',
    'Check the A-Number (if any) everywhere it appears.',
    'Check the full mailing address, including the Apt/Ste/Flr box.',
    'Confirm every answer reflects the information you provided.',
    'Do NOT sign yet — signatures happen on the final version after approval.',
    'Found an issue? Use "Request corrections" in your Imverica portal.'
  ], { numbered: true });

  // ===== Filing instructions =====
  sections.push('filing-instructions');
  c.newPage();
  c.title('Filing instructions (general information)');
  c.para('General information from official sources — not legal advice. Filing locations and fees change; always confirm against the official page before mailing.');
  c.bullets([
    `Official form page: ${profile.officialPageUrl || 'uscis.gov'}`,
    `Current fees: ${profile.filingFeeUrl || 'https://www.uscis.gov/g-1055'} (USCIS fee schedule)`,
    code === 'I-589' ? 'Form I-589 has no filing fee.' : 'Verify the current filing fee or fee-exemption evidence before mailing.',
    'Use the filing address listed on the official form page for your category.',
    'Keep a complete copy of everything you mail.',
    'Send by a trackable mail service and keep the receipt.'
  ]);

  const bytes = await doc.save();
  return { buffer: Buffer.from(bytes), pages: doc.getPageCount(), sections, filledFields: filled.filled };
}

module.exports = { buildUscisPacket };
