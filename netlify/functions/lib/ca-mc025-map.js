'use strict';
/**
 * MC-025 — Attachment to Judicial Council Form. The generic continuation page
 * we generate whenever a form field overflows (e.g., UD-100 item 9f/10c checks
 * "see Attachment 10c", or a defendant list exceeds the form's slots). Field
 * names verified by index-probe: FillText6 = short title, FillText5 = case
 * number, FillText9 = attachment number, FillText4 = body, FillText7/8 = page
 * x of y. So "doesn't fit → goes on the last page" is satisfied — never dropped.
 */

function mc_025FieldValues({ shortTitle, caseNumber, attachmentNumber, body, page = 1, ofPages = 1 } = {}) {
  const v = {};
  if (shortTitle) v.FillText6 = String(shortTitle).slice(0, 120);
  if (caseNumber) v.FillText5 = String(caseNumber).slice(0, 40);
  if (attachmentNumber) v.FillText9 = String(attachmentNumber).slice(0, 20);
  if (body) v.FillText4 = String(body).slice(0, 4000);
  v.FillText7 = String(page);
  v.FillText8 = String(ofPages);
  return v;
}

// Build the MC-025 body text from a map's `_overflow` descriptor.
function bodyFromOverflow(o) {
  if (!o) return '';
  const lines = [];
  if (o.title) lines.push(o.title, '');
  if (Array.isArray(o.defendants) && o.defendants.length) {
    lines.push('All defendants and occupants named in this action:');
    o.defendants.forEach((d, i) => lines.push('  ' + (i + 1) + '. ' + d));
    lines.push('');
  }
  if (o.note) lines.push(o.note);
  return lines.join('\n');
}

module.exports = { mc_025FieldValues, bodyFromOverflow };
