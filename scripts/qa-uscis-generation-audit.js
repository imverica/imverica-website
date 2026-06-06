#!/usr/bin/env node
'use strict';

/**
 * QA — full account-wizard USCIS generation audit.
 *
 * This is broader than qa-uscis-pdf-integrity:
 * - integrity proves every cached USCIS PDF/map can be filled with generic data;
 * - this audit proves the account wizard flow can feed each preparable map.
 *
 * The script fails only on technical generation failures. Limited wizard
 * coverage is reported as a product/flow expansion backlog, because many USCIS
 * forms currently use a generic applicant flow on purpose.
 */

const fs = require('fs');
const path = require('path');

const { buildImmigrationFlow } = require('../netlify/functions/lib/immigration-flow-schema');
const { incrementalFillPdf, parsePdf, extractFieldObjects } = require('../netlify/functions/lib/pdf-incremental-fill');

const ROOT = path.resolve(__dirname, '..');
const PDF_DIR = path.join(ROOT, 'assets/form-cache/pdfs');
const MAP_DIR = path.join(ROOT, 'netlify/functions/lib');
const REPORT_DIR = path.join(ROOT, 'qa-reports');
const REPORT_PATH = path.join(REPORT_DIR, 'uscis-generation-audit.json');

const manifest = require('../netlify/functions/form-cache-manifest.json');
const catalog = require('../netlify/functions/forms/immigration.json');

const aliases = {
  g845supplement: 'g845s-pdf-map.js',
  i485supplementa: 'i485a-pdf-map.js',
  i485supplementj: 'i485j-pdf-map.js'
};

const manualExceptions = new Set(['G-1055']);
const visualRisk = new Set(['I-360']);
const priority = new Set([
  'I-485', 'I-765', 'I-130', 'I-130A', 'I-131', 'I-90', 'I-589',
  'I-864', 'I-912', 'I-751', 'I-539', 'I-821', 'I-821D', 'N-400'
]);

const minArg = process.argv.indexOf('--ready-min');
const READY_MIN = minArg >= 0 ? Number(process.argv[minArg + 1]) : 10;

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function compactCode(value) {
  return normalizeCode(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function safeSlug(value) {
  return normalizeCode(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mapFileName(code) {
  const compact = compactCode(code);
  return aliases[compact] || `${compact}-pdf-map.js`;
}

function findPdfPath(code) {
  const slug = safeSlug(code);
  const compact = compactCode(code);
  const direct = [
    path.join(PDF_DIR, `${slug}.pdf`),
    path.join(PDF_DIR, `${compact}.pdf`)
  ];
  for (const candidate of direct) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const files = fs.existsSync(PDF_DIR) ? fs.readdirSync(PDF_DIR) : [];
  const match = files.find((file) =>
    file.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/pdf$/, '') === compact
  );
  return match ? path.join(PDF_DIR, match) : null;
}

function loadMap(code) {
  const mapPath = path.join(MAP_DIR, mapFileName(code));
  if (!fs.existsSync(mapPath)) return null;

  delete require.cache[require.resolve(mapPath)];
  const mod = require(mapPath);
  const buildFieldValues =
    Object.values(mod).find((value) => typeof value === 'function' && /fieldvalues/i.test(value.name)) ||
    Object.values(mod).find((value) => typeof value === 'function');
  const buildTextOverlays =
    Object.values(mod).find((value) => typeof value === 'function' && /textoverlays/i.test(value.name)) ||
    (() => []);

  return buildFieldValues ? { mapPath, buildFieldValues, buildTextOverlays } : null;
}

function catalogByCode() {
  const byCode = new Map();
  for (const entry of catalog.forms || []) byCode.set(normalizeCode(entry.code), entry);
  return byCode;
}

function preparableForms() {
  const byCode = catalogByCode();
  return (manifest.forms || [])
    .filter((form) => form.agency === 'uscis')
    .map((form) => {
      const code = normalizeCode(form.code);
      return {
        ...form,
        code,
        catalogEntry: byCode.get(code) || null,
        hasFlow: byCode.has(code),
        pdfPath: findPdfPath(code),
        mapFile: mapFileName(code),
        hasMap: fs.existsSync(path.join(MAP_DIR, mapFileName(code)))
      };
    })
    .filter((form) => form.cacheStatus === 'cached' && form.hasFlow && form.hasMap)
    .sort((a, b) => a.code.localeCompare(b.code));
}

function optionValue(option) {
  if (option && typeof option === 'object') return String(option.value ?? option.label ?? '');
  return String(option ?? '');
}

function pickOption(field) {
  const options = Array.isArray(field.options) ? field.options.map(optionValue).filter(Boolean) : [];
  if (!options.length) return 'Yes';

  const id = String(field.id || '').toLowerCase();
  const label = String(field.label || '').toLowerCase();
  const lower = options.map((value) => value.toLowerCase());
  const find = (patterns) => {
    const index = lower.findIndex((value) => patterns.some((pattern) => pattern.test(value)));
    return index >= 0 ? options[index] : '';
  };

  if (/sex|gender/.test(id)) return find([/^female$/, /^f$/]) || options[0];
  if (/marital/.test(id)) return find([/married/]) || options[0];
  if (/race/.test(id)) return find([/white/]) || options[0];
  if (/ethnicity/.test(id)) return find([/not hispanic/]) || options[0];
  if (/eye/.test(id)) return find([/blue/]) || options[0];
  if (/hair/.test(id)) return find([/brown/]) || options[0];
  if (/country/.test(id)) return find([/ukraine/, /united states/]) || options[0];
  if (/state/.test(id)) return find([/^ca$/, /california/]) || options[0];
  if (/yes|no|has_|same_|complete|currently|applying|authorized|consent/.test(id) || /yes|no/.test(label)) {
    return find([/^yes$/, /^true$/]) || options[0];
  }

  return options[0];
}

function syntheticAddress(overrides = {}) {
  return {
    line1: '456 Test Street',
    line2: 'Apt 5',
    city: 'Sacramento',
    state: 'CA',
    zip: '95814',
    country: 'United States',
    from: '2021-01-01',
    to: '2024-12-31',
    ...overrides
  };
}

function syntheticEmployment(overrides = {}) {
  return {
    name: 'DELUX DELIVERY LLC',
    company: 'DELUX DELIVERY LLC',
    school: '',
    occupation: 'SELF-EMPLOYED DRIVER',
    activity: 'SELF-EMPLOYED DRIVER',
    line1: '7301 Hardeson Road',
    line2: '',
    city: 'Everett',
    state: 'WA',
    zip: '98203',
    country: 'United States',
    from: '2020-10-10',
    to: '2023-12-20',
    ...overrides
  };
}

function syntheticTravel() {
  return [{
    country: 'Ukraine',
    departureDate: '2022-01-10',
    returnDate: '2022-01-25',
    reason: 'Family visit'
  }];
}

function synthValue(field) {
  const id = String(field.id || '');
  const type = field.type || 'text';

  if (type === 'addressHistory') {
    return [
      syntheticAddress({ line1: '15 164th Street SW', city: 'Bothell', state: 'WA', zip: '98012', from: '2019-10-01', to: '2021-01-01' }),
      syntheticAddress({ line1: '900 Previous Avenue', city: 'Sacramento', state: 'CA', zip: '95816', from: '2018-01-01', to: '2019-09-30' })
    ];
  }
  if (type === 'employmentHistory') {
    return [
      syntheticEmployment(),
      syntheticEmployment({ name: 'FEDEX', company: 'FEDEX', line1: '7301 Hardeson Road', from: '2018-01-01', to: '2020-10-09' })
    ];
  }
  if (type === 'travelHistory') return syntheticTravel();
  if (type === 'date') return '1990-06-15';
  if (type === 'number') {
    if (/children|child/i.test(id)) return '2';
    if (/times_married|number_of_marriages|marriage/i.test(id)) return '1';
    if (/height.*feet|feet/i.test(id)) return '5';
    if (/height.*inches|inch/i.test(id)) return '4';
    if (/weight/i.test(id)) return '145';
    if (/household/i.test(id)) return '3';
    return '1';
  }
  if (type === 'email') return 'client@example.com';
  if (type === 'phone') return '9163993992';
  if (type === 'select' || type === 'radio') return pickOption(field);
  if (type === 'checkbox' || type === 'checkboxes') {
    const picked = pickOption(field);
    return picked ? [picked] : ['Yes'];
  }

  if (/family_name|last_name/i.test(id)) return 'HOVDAN';
  if (/given_name|first_name/i.test(id)) return 'YANA';
  if (/middle_name/i.test(id)) return 'OLENA';
  if (/full_name/i.test(id)) return 'YANA HOVDAN';
  if (/spouse_family_name|prior_spouse_family_name/i.test(id)) return 'HOVDAN';
  if (/spouse_given_name|prior_spouse_given_name/i.test(id)) return 'VOLODYMYR';
  if (/child\d*_family_name|beneficiary_family_name/i.test(id)) return 'HOVDAN';
  if (/child\d*_given_name|beneficiary_given_name/i.test(id)) return 'ANASTASIIA';
  if (/petitioner_family_name/i.test(id)) return 'SMITH';
  if (/petitioner_given_name/i.test(id)) return 'JOHN';
  if (/city.*birth|birth_city|city_of_birth/i.test(id)) return 'KYIV';
  if (/province.*birth|state_or_province_of_birth/i.test(id)) return 'KYIV OBLAST';
  if (/country.*birth|country_of_birth/i.test(id)) return 'Ukraine';
  if (/citizenship|nationality/i.test(id)) return 'Ukraine';
  if (/alien|a_number/i.test(id)) return '123456789';
  if (/uscis.*account/i.test(id)) return '987654321';
  if (/ssn|social_security/i.test(id)) return '555112222';
  if (/passport/i.test(id)) return /country/i.test(id) ? 'Ukraine' : 'AB123456';
  if (/i94/i.test(id)) return '12345678901';
  if (/zip|postal/i.test(id)) return '95814';
  if (/state/i.test(id)) return 'CA';
  if (/country/i.test(id)) return 'United States';
  if (/phone|telephone|mobile/i.test(id)) return '9163993992';
  if (/email/i.test(id)) return 'client@example.com';
  if (/address.*line1|street/i.test(id)) return '456 Test Street';
  if (/address.*line2|apt|suite|unit/i.test(id)) return 'Apt 5';
  if (/city|town/i.test(id)) return 'Sacramento';
  if (/receipt/i.test(id)) return 'MSC2490123456';
  if (/date/i.test(id)) return '1990-06-15';
  if (/status/i.test(id)) return 'Asylee';
  if (/occupation/i.test(id)) return 'SELF-EMPLOYED DRIVER';
  if (/employer|company|school/i.test(id)) return 'DELUX DELIVERY LLC';
  if (/language/i.test(id)) return 'Russian';
  if (/explanation|summary|details|notes|additional|history/i.test(id)) {
    return 'Synthetic QA explanation. Client must verify all answers before filing.';
  }

  return `Test ${id.replace(/_/g, ' ').slice(0, 32)}`;
}

function fillAddressParts(answers, parts, overrides = {}) {
  const address = syntheticAddress(overrides);
  if (parts.line1) answers[parts.line1] = address.line1;
  if (parts.line2) answers[parts.line2] = address.line2;
  if (parts.city) answers[parts.city] = address.city;
  if (parts.state) answers[parts.state] = address.state;
  if (parts.zip) answers[parts.zip] = address.zip;
  if (parts.country) answers[parts.country] = address.country;
}

function answersFromFlow(flow) {
  const answers = {};
  for (const step of flow.steps || []) {
    for (const field of step.fields || []) {
      if (!field.id) continue;
      if (field.type === 'addressBlock' && field.parts) {
        fillAddressParts(answers, field.parts);
        continue;
      }
      answers[field.id] = synthValue(field);
    }
  }
  return answers;
}

function templateFieldCount(pdfPath) {
  try {
    const parsed = parsePdf(fs.readFileSync(pdfPath));
    return extractFieldObjects(parsed).size;
  } catch {
    return null;
  }
}

function flowQuality(filled) {
  if (filled >= READY_MIN) return 'ready';
  if (filled >= 3) return 'limited';
  if (filled > 0) return 'thin';
  return 'none';
}

function runForm(form) {
  const result = {
    code: form.code,
    title: form.title || form.resolvedTitle || form.code,
    priority: priority.has(form.code),
    manualException: manualExceptions.has(form.code),
    visualRisk: visualRisk.has(form.code),
    mapFile: form.mapFile,
    pdfFile: form.pdfPath ? path.relative(ROOT, form.pdfPath) : '',
    flowQuestions: 0,
    templateFields: form.pdfPath ? templateFieldCount(form.pdfPath) : null,
    mappedFields: 0,
    overlayFields: 0,
    filledFields: 0,
    skippedFields: 0,
    skippedFieldNames: [],
    technicalStatus: 'UNKNOWN',
    flowQuality: 'none'
  };

  try {
    if (!form.pdfPath) {
      result.technicalStatus = 'MISSING_PDF';
      return result;
    }

    const map = loadMap(form.code);
    if (!map) {
      result.technicalStatus = 'MISSING_MAP';
      return result;
    }

    const flow = buildImmigrationFlow(form.code, form.catalogEntry || {}, form);
    const answers = answersFromFlow(flow);
    result.flowQuestions = Object.keys(answers).length;

    const payload = {
      formCode: form.code,
      formType: form.code,
      formAnswers: answers,
      answers,
      contact: {
        name: 'Yana Hovdan',
        phone: '9163993992',
        email: 'client@example.com'
      }
    };

    const fieldValues = map.buildFieldValues(payload) || {};
    const overlays = map.buildTextOverlays(payload) || [];
    result.mappedFields = Object.keys(fieldValues).length;
    result.overlayFields = overlays.length;

    if (result.manualException) {
      result.technicalStatus = 'MANUAL_REVIEW';
      result.flowQuality = flowQuality(result.mappedFields);
      return result;
    }

    const filled = incrementalFillPdf(fs.readFileSync(form.pdfPath), fieldValues, overlays);
    result.filledFields = (filled.filledFields || []).length;
    result.skippedFieldNames = filled.skippedFields || [];
    result.skippedFields = result.skippedFieldNames.length;

    if (!Buffer.isBuffer(filled.buffer) || filled.buffer.slice(0, 5).toString('latin1') !== '%PDF-') {
      result.technicalStatus = 'BAD_OUTPUT_PDF';
    } else if (result.skippedFields > 0) {
      result.technicalStatus = 'SKIPPED_FIELDS';
    } else if (result.visualRisk) {
      result.technicalStatus = 'VISUAL_RISK_MANUAL_REVIEW';
    } else {
      result.technicalStatus = 'OK';
    }
    result.flowQuality = flowQuality(result.filledFields + result.overlayFields);
    return result;
  } catch (error) {
    result.technicalStatus = 'ERROR';
    result.error = error.message || String(error);
    return result;
  }
}

const results = preparableForms().map(runForm);
const counts = results.reduce((acc, item) => {
  acc.technicalStatus[item.technicalStatus] = (acc.technicalStatus[item.technicalStatus] || 0) + 1;
  acc.flowQuality[item.flowQuality] = (acc.flowQuality[item.flowQuality] || 0) + 1;
  return acc;
}, { technicalStatus: {}, flowQuality: {} });

const hardProblemStatuses = new Set(['MISSING_PDF', 'MISSING_MAP', 'BAD_OUTPUT_PDF', 'SKIPPED_FIELDS', 'ERROR']);
const hardProblems = results.filter((item) => hardProblemStatuses.has(item.technicalStatus));
const limited = results.filter((item) => ['limited', 'thin', 'none'].includes(item.flowQuality));
const priorityLimited = limited.filter((item) => item.priority);

const report = {
  generatedAt: new Date().toISOString(),
  readyMinFilled: READY_MIN,
  totalPreparable: results.length,
  counts,
  hardProblems,
  priorityLimited,
  limited,
  results
};

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log('');
console.log('USCIS ACCOUNT WIZARD GENERATION AUDIT');
console.log('======================================');
console.log('Preparable forms:', results.length);
console.log('Technical:', JSON.stringify(counts.technicalStatus));
console.log('Flow quality:', JSON.stringify(counts.flowQuality));
console.log('Priority limited:', priorityLimited.map((item) => `${item.code}:${item.flowQuality}:${item.filledFields}`).join(', ') || 'none');
console.log('Report saved to:', path.relative(ROOT, REPORT_PATH));

if (hardProblems.length) {
  console.log('');
  console.log('HARD PROBLEMS:');
  for (const item of hardProblems) {
    const skipped = item.skippedFieldNames?.length ? ` skipped=${item.skippedFieldNames.join(', ')}` : '';
    console.log(`${item.technicalStatus}: ${item.code} mapped=${item.mappedFields} filled=${item.filledFields}${skipped}${item.error ? ` error=${item.error}` : ''}`);
  }
  process.exit(1);
}

console.log('');
console.log('PASS: No hard USCIS generation failures. Limited coverage items are reported separately.');
