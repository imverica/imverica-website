'use strict';

const fs = require('fs');
const {
  PDFButton,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField
} = require('pdf-lib');
const { loadCourtTemplate } = require('./ca-court-template');

const CACHE = new Map();

function tooltipOf(field) {
  try {
    const tooltip = field.acroField.dict.get(PDFName.of('TU'));
    return tooltip ? tooltip.decodeText() : '';
  } catch {
    return '';
  }
}

function cleanLabel(value, fallback) {
  const label = String(value || '').replace(/\s+/g, ' ').trim();
  if (label && !/^T\d+$/i.test(label) && !/^Field\d+$/i.test(label)) return label;
  return String(fallback || 'Field')
    .replace(/\[\d+\]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageNumber(name) {
  const match = String(name).match(/Page(\d+)\[\d+\]/i);
  return match ? Number(match[1]) : 1;
}

const FORM_SPECIFIC_COURT_ONLY = {
  'sc-134': [/\.(Hearing|SignSub)\[\d+\]/i],
  'sc-136': [/\.(Hearing|SigDate)\[\d+\]/i],
  'sc-145': [/\.(Info|ClerkCertificate)\[\d+\]/i]
};

function isCourtOnlyField(name, label, slug) {
  const path = String(name);
  const text = String(label);
  if (/\.(Order|CrtOrder|Clerk|ClerkCertificate|Judge|JudicialOfficer|CourtUse|CourtOnly|ClerkUse)\[\d+\]/i.test(path)) return true;
  if ((FORM_SPECIFIC_COURT_ONLY[slug] || []).some((pattern) => pattern.test(path))) return true;
  return /^(clerk\s*,?\s*by|judge|judicial officer|trial date|trial time|trial department|date mailed by clerk)\b/i.test(text) ||
    /\bclerk\s+to\s+(?:insert|complete)\b/i.test(text);
}

function directField(field, slug) {
  const name = field.getName();
  const leaf = name.split('.').pop();
  const label = cleanLabel(tooltipOf(field), leaf);
  if (isCourtOnlyField(name, label, slug)) return null;

  // Netlify's esbuild bundle renames pdf-lib constructors (for example,
  // PDFTextField becomes PDFTextField2), so constructor.name is not stable.
  if (field instanceof PDFButton || field instanceof PDFSignature) return null;
  if (field instanceof PDFCheckBox) {
    return { id: name, label, type: 'checkbox', page: pageNumber(name) };
  }
  if (field instanceof PDFRadioGroup || field instanceof PDFDropdown || field instanceof PDFOptionList) {
    let options = [];
    try { options = field.getOptions().map((value) => ({ value, label: value })); } catch {}
    return {
      id: name,
      label,
      type: 'select',
      selectMode: field instanceof PDFRadioGroup ? 'radio' : 'dropdown',
      options,
      page: pageNumber(name)
    };
  }
  if (field instanceof PDFTextField) {
    let multiline = false;
    let maxLength;
    try { multiline = field.isMultiline(); } catch {}
    try { maxLength = field.getMaxLength(); } catch {}
    return {
      id: name,
      label,
      type: multiline || label.length > 120 ? 'textarea' : 'text',
      page: pageNumber(name),
      ...(Number.isFinite(maxLength) ? { maxLength } : {})
    };
  }
  return null;
}

async function getDirectCourtSchema(slug, title) {
  if (CACHE.has(slug)) return CACHE.get(slug);
  // Buffer-based loader: bundled file when present, static /ca-templates/
  // HTTP store for the long tail (full set exceeds the function size limit).
  const templateBuffer = await loadCourtTemplate(slug);
  if (!templateBuffer) return null;

  const document = await PDFDocument.load(templateBuffer, { ignoreEncryption: true });
  const fields = document.getForm().getFields().map((field) => directField(field, slug)).filter(Boolean);
  const pages = [...new Set(fields.map((field) => field.page))].sort((a, b) => a - b);
  const schema = {
    code: slug.toUpperCase(),
    title,
    mode: 'direct',
    fieldCount: fields.length,
    steps: pages.map((page) => ({
      title: `Page ${page}`,
      page,
      fields: fields.filter((field) => field.page === page).map(({ page: _page, ...field }) => field)
    }))
  };
  CACHE.set(slug, schema);
  return schema;
}

async function sanitizeDirectFields(slug, rawFields) {
  const schema = await getDirectCourtSchema(slug, slug.toUpperCase());
  if (!schema || !rawFields || typeof rawFields !== 'object' || Array.isArray(rawFields)) return {};

  const allowed = new Map();
  for (const step of schema.steps) {
    for (const field of step.fields) allowed.set(field.id, field);
  }

  const output = {};
  // FL-160 currently exposes 524 party-fillable fields. Keep a generous
  // abuse-safety cap without silently truncating complete official forms.
  for (const [name, raw] of Object.entries(rawFields).slice(0, 1000)) {
    const field = allowed.get(name);
    if (!field) continue;
    if (field.type === 'checkbox') {
      if (raw === true) output[name] = true;
      continue;
    }
    if (field.type === 'select') {
      const value = String(raw?.value ?? raw ?? '').trim().slice(0, 500);
      if (!value || !field.options.some((option) => option.value === value)) continue;
      output[name] = field.selectMode === 'radio' ? { radio: value } : { dropdown: value };
      continue;
    }
    const value = String(raw ?? '').trim().slice(0, 5000);
    if (value) output[name] = value;
  }
  return output;
}

module.exports = { getDirectCourtSchema, sanitizeDirectFields };
