#!/usr/bin/env node

const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const IMMIGRATION_CATALOG = path.join(ROOT, 'netlify/functions/forms/immigration.json');
const FORM_CACHE_MANIFEST = path.join(ROOT, 'assets/form-cache/manifest.json');
const OUTPUT_DIR = path.join(ROOT, 'netlify/functions/pdf-maps/uscis');
const REPORT_PATH = path.join(ROOT, 'netlify/functions/pdf-maps/uscis-report.json');

const SCHEMA_VERSION = 'uscis-pdf-map.scaffold.v1';
const EXTRACTOR_ID = 'scripts/extract-uscis-pdf-fields.js';

const PRIORITY_CODES = new Set(['I-765', 'I-485', 'N-400', 'I-130', 'I-131', 'I-912']);
const PDF_PASSWORD_PADDING = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
]);

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function safeSlug(value) {
  return normalizeCode(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function md5(buffer) {
  return crypto.createHash('md5').update(buffer).digest();
}

function pdfHexBytes(token) {
  let hex = token.slice(1, -1).replace(/\s+/g, '');
  if (hex.length % 2) hex += '0';
  return Buffer.from(hex, 'hex');
}

function pdfLiteralBytes(token) {
  const input = token.slice(1, -1);
  const output = [];

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char !== '\\') {
      output.push(input.charCodeAt(i) & 0xff);
      continue;
    }

    const next = input[++i];
    if (next === undefined) break;
    if (next === 'n') output.push(10);
    else if (next === 'r') output.push(13);
    else if (next === 't') output.push(9);
    else if (next === 'b') output.push(8);
    else if (next === 'f') output.push(12);
    else if (next === '(' || next === ')' || next === '\\') output.push(next.charCodeAt(0));
    else if (next === '\r' || next === '\n') {
      if (next === '\r' && input[i + 1] === '\n') i += 1;
    } else if (/[0-7]/.test(next)) {
      let octal = next;
      for (let count = 0; count < 2 && /[0-7]/.test(input[i + 1] || ''); count += 1) {
        octal += input[++i];
      }
      output.push(parseInt(octal, 8));
    } else {
      output.push(next.charCodeAt(0) & 0xff);
    }
  }

  return Buffer.from(output);
}

function pdfTokenBytes(token) {
  if (!token) return Buffer.alloc(0);
  if (token.startsWith('<')) return pdfHexBytes(token);
  return pdfLiteralBytes(token);
}

function decodePdfBytes(bytes) {
  if (!bytes || !bytes.length) return '';

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let utf16 = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      utf16 += String.fromCharCode((bytes[i] << 8) + bytes[i + 1]);
    }
    return utf16;
  }

  return bytes.toString('utf8').replace(/\0/g, '').trim();
}

function decodePdfString(token, decryptString) {
  if (!token) return '';
  let bytes = pdfTokenBytes(token);
  if (decryptString) {
    try {
      bytes = decryptString(bytes);
    } catch {}
  }
  return decodePdfBytes(bytes);
}

function firstPdfString(body, key, decryptString) {
  const match = body.match(new RegExp(`\\/${key}\\s*(\\((?:\\\\.|[^\\\\)])*\\)|<[^>]*>)`));
  return match ? decodePdfString(match[1], decryptString) : '';
}

function firstPdfName(body, key) {
  const match = body.match(new RegExp(`\\/${key}\\s*\\/([^\\/\\s<>()\\[\\]{}%]+)`));
  return match ? match[1] : '';
}

function firstPdfNumber(body, key) {
  const match = body.match(new RegExp(`\\/${key}\\s+(-?\\d+)`));
  return match ? Number(match[1]) : null;
}

function hasFlateFilter(body) {
  return /\/Filter\s*(?:\/FlateDecode|\[[^\]]*\/FlateDecode[^\]]*\])/m.test(body);
}

function inflateStreamBytes(bytes) {
  try {
    return zlib.inflateSync(bytes);
  } catch {
    try {
      return zlib.inflateRawSync(bytes);
    } catch {
      return null;
    }
  }
}

function rc4(key, data) {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;

  for (let i = 0; i < 256; i += 1) {
    j = (j + state[i] + key[i % key.length]) & 0xff;
    [state[i], state[j]] = [state[j], state[i]];
  }

  const output = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let index = 0; index < data.length; index += 1) {
    i = (i + 1) & 0xff;
    j = (j + state[i]) & 0xff;
    [state[i], state[j]] = [state[j], state[i]];
    output[index] = data[index] ^ state[(state[i] + state[j]) & 0xff];
  }

  return output;
}

function objectEncryptionKey(fileKey, objectNumber, generation, aes) {
  const extra = Buffer.alloc(fileKey.length + 5 + (aes ? 4 : 0));
  fileKey.copy(extra);
  extra[fileKey.length] = objectNumber & 0xff;
  extra[fileKey.length + 1] = (objectNumber >> 8) & 0xff;
  extra[fileKey.length + 2] = (objectNumber >> 16) & 0xff;
  extra[fileKey.length + 3] = generation & 0xff;
  extra[fileKey.length + 4] = (generation >> 8) & 0xff;
  if (aes) Buffer.from('sAlT', 'binary').copy(extra, fileKey.length + 5);
  return md5(extra).subarray(0, Math.min(fileKey.length + 5, 16));
}

function decryptAesV2(data, key) {
  if (data.length < 16) return data;
  const decipher = crypto.createDecipheriv(`aes-${key.length * 8}-cbc`, key, data.subarray(0, 16));
  return Buffer.concat([decipher.update(data.subarray(16)), decipher.final()]);
}

function decryptObjectBytes(encryption, objectNumber, generation, data, kind) {
  if (!encryption || !data?.length) return data;

  const cipher = kind === 'string' ? encryption.stringCipher : encryption.streamCipher;
  if (cipher === 'AESV2') {
    return decryptAesV2(data, objectEncryptionKey(encryption.fileKey, objectNumber, generation, true));
  }
  if (cipher === 'V2' || cipher === 'RC4') {
    return rc4(objectEncryptionKey(encryption.fileKey, objectNumber, generation, false), data);
  }

  return data;
}

function findIndirectObject(text, objectNumber, generation) {
  const match = text.match(new RegExp(`\\b${objectNumber}\\s+${generation}\\s+obj([\\s\\S]*?)endobj`));
  return match ? match[1] : '';
}

function parseEncryption(buffer) {
  const text = buffer.toString('latin1');
  const encryptRef = text.match(/\/Encrypt\s+(\d+)\s+(\d+)\s+R/);
  if (!encryptRef) return null;

  const objectNumber = Number(encryptRef[1]);
  const generation = Number(encryptRef[2]);
  const body = findIndirectObject(text, objectNumber, generation);
  if (!body || !/\/Filter\s*\/Standard\b/.test(body)) return null;

  const ownerToken = (body.match(/\/O\s*(\((?:\\.|[^\\)])*\)|<[^>]*>)/) || [])[1] || '';
  const ownerKey = pdfTokenBytes(ownerToken).subarray(0, 32);
  const permissions = firstPdfNumber(body, 'P') || 0;
  const revision = firstPdfNumber(body, 'R') || 0;
  const version = firstPdfNumber(body, 'V') || 0;
  const idHex = (text.match(/\/ID\s*\[\s*<([0-9A-Fa-f]+)>/) || [])[1] || '';
  const lengths = [...body.matchAll(/\/Length\s+(\d+)/g)].map((match) => Number(match[1])).filter(Boolean);
  const lengthBits = Math.max(...lengths, version <= 1 ? 40 : 128);
  const keyLength = lengthBits / 8;
  const password = Buffer.concat([Buffer.alloc(0), PDF_PASSWORD_PADDING]).subarray(0, 32);
  const permissionsBytes = Buffer.alloc(4);
  permissionsBytes.writeInt32LE(permissions, 0);

  const digestParts = [password, ownerKey, permissionsBytes, Buffer.from(idHex, 'hex')];
  if (revision >= 4 && /\/EncryptMetadata\s+false\b/.test(body)) {
    digestParts.push(Buffer.from([0xff, 0xff, 0xff, 0xff]));
  }

  let digest = md5(Buffer.concat(digestParts));
  if (revision >= 3) {
    for (let i = 0; i < 50; i += 1) {
      digest = md5(digest.subarray(0, keyLength));
    }
  }

  const usesAes = /\/CFM\s*\/AESV2\b/.test(body);
  return {
    objectNumber,
    generation,
    revision,
    version,
    fileKey: digest.subarray(0, keyLength),
    streamCipher: usesAes ? 'AESV2' : 'V2',
    stringCipher: usesAes ? 'AESV2' : 'V2'
  };
}

function extractStreamBytes(objectText) {
  const streamIndex = objectText.indexOf('stream');
  const endIndex = objectText.lastIndexOf('endstream');
  if (streamIndex < 0 || endIndex < 0 || endIndex <= streamIndex) return null;

  let start = streamIndex + 'stream'.length;
  if (objectText[start] === '\r' && objectText[start + 1] === '\n') start += 2;
  else if (objectText[start] === '\n' || objectText[start] === '\r') start += 1;

  let end = endIndex;
  if (objectText[end - 2] === '\r' && objectText[end - 1] === '\n') end -= 2;
  else if (objectText[end - 1] === '\n' || objectText[end - 1] === '\r') end -= 1;

  return Buffer.from(objectText.slice(start, end), 'latin1');
}

function parseObjectStream(body, inflated) {
  const n = firstPdfNumber(body, 'N');
  const first = firstPdfNumber(body, 'First');
  if (!Number.isFinite(n) || !Number.isFinite(first)) return [];

  const text = inflated.toString('latin1');
  const header = text.slice(0, first);
  const pairs = [...header.matchAll(/(\d+)\s+(\d+)/g)]
    .slice(0, n)
    .map((match) => ({
      objectNumber: Number(match[1]),
      offset: Number(match[2])
    }));

  return pairs.map((pair, index) => {
    const start = first + pair.offset;
    const end = index + 1 < pairs.length ? first + pairs[index + 1].offset : text.length;
    return {
      objectNumber: pair.objectNumber,
      generation: 0,
      body: text.slice(start, end),
      source: 'object-stream',
      decryptString: null
    };
  });
}

function parsePdfObjects(buffer) {
  const text = buffer.toString('latin1');
  const encryption = parseEncryption(buffer);
  const objects = [];
  const objectRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  let match;

  while ((match = objectRegex.exec(text))) {
    const objectNumber = Number(match[1]);
    const generation = Number(match[2]);
    const objectText = match[0];
    const body = match[3];
    const objectRecord = {
      objectNumber,
      generation,
      body,
      source: 'indirect-object',
      decryptString: encryption ? (bytes) => decryptObjectBytes(encryption, objectNumber, generation, bytes, 'string') : null
    };
    objects.push(objectRecord);

    if (!hasFlateFilter(body)) continue;
    const streamBytes = extractStreamBytes(objectText);
    if (!streamBytes) continue;

    let inflated = inflateStreamBytes(streamBytes);
    if (!inflated && encryption && !/\/Type\s*\/XRef\b/.test(body) && objectNumber !== encryption.objectNumber) {
      try {
        inflated = inflateStreamBytes(decryptObjectBytes(encryption, objectNumber, generation, streamBytes, 'stream'));
      } catch {}
    }
    if (!inflated) continue;

    if (/\/Type\s*\/ObjStm\b/.test(body)) {
      objects.push(...parseObjectStream(body, inflated));
    } else {
      objects.push({
        objectNumber,
        generation,
        body: inflated.toString('latin1'),
        source: 'inflated-stream',
        decryptString: null
      });
    }
  }

  return objects;
}

function isLikelyFieldObject(body) {
  return /\/T\s*(?:\((?:\\.|[^\\)])*\)|<[^>]*>)/.test(body)
    && (/\/FT\s*\//.test(body) || /\/Subtype\s*\/Widget/.test(body) || /\/TU\s*/.test(body));
}

function parsePdfOptions(body, decryptString) {
  const optMatch = body.match(/\/Opt\s*\[([\s\S]*?)\]/);
  if (!optMatch) return [];

  return [...optMatch[1].matchAll(/(\((?:\\.|[^\\)])*\)|<[^>]*>)/g)]
    .map((match) => decodePdfString(match[1], decryptString))
    .filter(Boolean);
}

function parseAppearanceStates(body) {
  const apMatch = body.match(/\/AP\s*<<[\s\S]*?\/N\s*<<([\s\S]*?)>>/);
  if (!apMatch) return [];

  return [...apMatch[1].matchAll(/\/([^/\s<>()\[\]{}%]+)/g)]
    .map((match) => match[1])
    .filter((value) => value && value !== 'Off')
    .filter((value, index, values) => values.indexOf(value) === index);
}

function fieldKind(ft, flags) {
  if (ft === 'Tx') return 'text';
  if (ft === 'Ch') return 'choice';
  if (ft === 'Sig') return 'signature';
  if (ft === 'Btn') {
    if (flags & 65536) return 'push-button';
    if (flags & 32768) return 'radio';
    return 'checkbox';
  }
  return 'unknown';
}

function extractFields(buffer) {
  const objects = parsePdfObjects(buffer);
  const fieldsByName = new Map();

  for (const object of objects) {
    const body = object.body || '';
    if (!isLikelyFieldObject(body)) continue;

    const nameMatches = [...body.matchAll(/\/T\s*(\((?:\\.|[^\\)])*\)|<[^>]*>)/g)];
    for (const nameMatch of nameMatches) {
      const pdfFieldName = decodePdfString(nameMatch[1], object.decryptString);
      if (!pdfFieldName || fieldsByName.has(pdfFieldName)) continue;

      const flags = firstPdfNumber(body, 'Ff') || 0;
      const pdfFieldType = firstPdfName(body, 'FT');
      const tooltip = firstPdfString(body, 'TU', object.decryptString);
      const maxLength = firstPdfNumber(body, 'MaxLen');
      const defaultValue = firstPdfString(body, 'DV', object.decryptString) || firstPdfName(body, 'DV');
      const value = firstPdfString(body, 'V', object.decryptString) || firstPdfName(body, 'V');
      const options = parsePdfOptions(body, object.decryptString);
      const appearanceStates = parseAppearanceStates(body);

      fieldsByName.set(pdfFieldName, {
        pdfFieldName,
        normalizedKey: '',
        candidateIntakeFieldIds: [],
        fieldType: fieldKind(pdfFieldType, flags),
        pdfFieldType: pdfFieldType || '',
        objectNumber: object.objectNumber,
        source: object.source,
        flags,
        isPdfRequired: Boolean(flags & 2),
        tooltip,
        maxLength,
        defaultValue,
        value,
        options,
        appearanceStates,
        notes: 'Scaffold only. Confirm this field manually before using it for generated filings.'
      });
    }
  }

  return [...fieldsByName.values()].sort((a, b) => {
    if (a.objectNumber !== b.objectNumber) return a.objectNumber - b.objectNumber;
    return a.pdfFieldName.localeCompare(b.pdfFieldName);
  });
}

function catalogForms() {
  const data = readJson(IMMIGRATION_CATALOG);
  const byCode = new Map();
  for (const form of data.forms || []) {
    const code = normalizeCode(form.code);
    if (!code || byCode.has(code)) continue;
    byCode.set(code, {
      code,
      title: form.names?.en || Object.values(form.names || {})[0] || code,
      subcategory: form.subcategory || '',
      description: form.description || ''
    });
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function cachedFormsByCode() {
  const manifest = readJson(FORM_CACHE_MANIFEST);
  const byCode = new Map();
  for (const form of manifest.forms || []) {
    if (form.agency === 'uscis') byCode.set(normalizeCode(form.code), form);
  }
  return byCode;
}

function buildMapRecord(form, cached, fields, generatedAt) {
  const hasPdf = cached?.cacheStatus === 'cached' && cached.cachedFile;
  const status = hasPdf ? 'scaffold' : 'missing_pdf';
  const extractionStatus = hasPdf
    ? fields.length ? 'fields-extracted' : 'no-fields-found'
    : 'pdf-not-cached';

  return {
    schemaVersion: SCHEMA_VERSION,
    status,
    code: form.code,
    agency: 'uscis',
    title: cached?.resolvedTitle || cached?.title || form.title,
    subcategory: form.subcategory,
    description: form.description,
    source: {
      officialPdfUrl: cached?.officialPdfUrl || '',
      officialPageUrl: cached?.officialPageUrl || '',
      cachedPdfUrl: cached?.cachedPdfUrl || '',
      cachedFile: cached?.cachedFile || '',
      editionDate: cached?.editionDate || '',
      sha256: cached?.sha256 || '',
      bytes: cached?.bytes || 0,
      cachedAt: cached?.cachedAt || ''
    },
    fieldInventory: {
      extractionStatus,
      extractor: EXTRACTOR_ID,
      fieldCount: fields.length,
      needsManualMapping: true,
      needsPdfCache: !hasPdf,
      priority: PRIORITY_CODES.has(form.code)
    },
    fields,
    mappings: [],
    generatedAt,
    disclaimer: 'Internal scaffold for deterministic PDF generation. Do not treat as a completed filing map until each field is manually reviewed.'
  };
}

async function writeJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const forms = catalogForms();
  const cachedByCode = cachedFormsByCode();
  const reportForms = [];

  await fsp.mkdir(OUTPUT_DIR, { recursive: true });

  for (const form of forms) {
    const cached = cachedByCode.get(form.code);
    let fields = [];
    let error = '';

    if (cached?.cacheStatus === 'cached' && cached.cachedFile) {
      try {
        const buffer = fs.readFileSync(path.join(ROOT, cached.cachedFile));
        fields = extractFields(buffer);
      } catch (err) {
        error = err.message || String(err);
      }
    }

    const mapRecord = buildMapRecord(form, cached, fields, generatedAt);
    if (error) {
      mapRecord.fieldInventory.extractionStatus = 'extractor-error';
      mapRecord.fieldInventory.error = error;
    }

    const fileName = `${safeSlug(form.code)}.json`;
    const mapFile = `netlify/functions/pdf-maps/uscis/${fileName}`;
    await writeJson(path.join(ROOT, mapFile), mapRecord);

    reportForms.push({
      code: form.code,
      title: mapRecord.title,
      mapFile,
      cacheStatus: cached?.cacheStatus || 'missing_manifest_record',
      cachedPdfUrl: cached?.cachedPdfUrl || '',
      officialPdfUrl: cached?.officialPdfUrl || '',
      editionDate: cached?.editionDate || '',
      fieldCount: fields.length,
      extractionStatus: mapRecord.fieldInventory.extractionStatus,
      needsManualMapping: true,
      priority: PRIORITY_CODES.has(form.code),
      error
    });
  }

  const summary = {
    totalCatalogForms: forms.length,
    cachedForms: reportForms.filter((form) => form.cacheStatus === 'cached').length,
    missingPdfForms: reportForms.filter((form) => form.cacheStatus !== 'cached').length,
    formsWithFields: reportForms.filter((form) => form.fieldCount > 0).length,
    formsWithoutFields: reportForms.filter((form) => form.cacheStatus === 'cached' && form.fieldCount === 0).length,
    totalExtractedFields: reportForms.reduce((sum, form) => sum + form.fieldCount, 0)
  };

  const report = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    extractor: EXTRACTOR_ID,
    summary,
    missingPdfCodes: reportForms.filter((form) => form.cacheStatus !== 'cached').map((form) => form.code),
    priorityForms: reportForms.filter((form) => form.priority),
    forms: reportForms
  };

  await writeJson(REPORT_PATH, report);

  console.log(`USCIS PDF maps written: ${OUTPUT_DIR}`);
  console.log(`USCIS PDF map report written: ${REPORT_PATH}`);
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  extractFields,
  normalizeCode,
  safeSlug
};
