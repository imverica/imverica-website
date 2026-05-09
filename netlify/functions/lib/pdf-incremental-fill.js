const crypto = require('crypto');
const zlib = require('zlib');

const PDF_PASSWORD_PADDING = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
]);

function md5(buffer) {
  return crypto.createHash('md5').update(buffer).digest();
}

function pdfHexBytes(token) {
  let hex = String(token || '').slice(1, -1).replace(/\s+/g, '');
  if (hex.length % 2) hex += '0';
  return Buffer.from(hex, 'hex');
}

function pdfLiteralBytes(token) {
  const input = String(token || '').slice(1, -1);
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
  return token.startsWith('<') ? pdfHexBytes(token) : pdfLiteralBytes(token);
}

function bytesForPdfString(value) {
  const text = String(value || '');
  if (/^[\x00-\x7f]*$/.test(text)) return Buffer.from(text, 'utf8');

  const bytes = Buffer.alloc(2 + text.length * 2);
  bytes[0] = 0xfe;
  bytes[1] = 0xff;
  for (let i = 0; i < text.length; i += 1) {
    bytes.writeUInt16BE(text.charCodeAt(i), 2 + i * 2);
  }
  return bytes;
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
  const match = body.match(new RegExp(`\\/${key}\\s*(\\((?:\\\\.|[^\\\\)])*\\)|(?<!<)<(?!<)[^>]*>(?!>))`));
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

function firstPdfRef(body, key) {
  const match = body.match(new RegExp(`\\/${key}\\s+(\\d+)\\s+(\\d+)\\s+R`));
  return match ? { objectNumber: Number(match[1]), generation: Number(match[2]) } : null;
}

function firstPdfArray(body, key) {
  const match = body.match(new RegExp(`\\/${key}\\s*\\[([^\\]]+)\\]`));
  return match ? match[1].trim().split(/\s+/).map(Number).filter(Number.isFinite) : [];
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

function encryptAesV2(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(`aes-${key.length * 8}-cbc`, key, iv);
  return Buffer.concat([iv, cipher.update(data), cipher.final()]);
}

function decryptObjectBytes(encryption, objectNumber, generation, data, kind) {
  if (!encryption || !data?.length) return data;
  const cipher = kind === 'string' ? encryption.stringCipher : encryption.streamCipher;
  if (cipher === 'AESV2') return decryptAesV2(data, objectEncryptionKey(encryption.fileKey, objectNumber, generation, true));
  if (cipher === 'V2' || cipher === 'RC4') return rc4(objectEncryptionKey(encryption.fileKey, objectNumber, generation, false), data);
  return data;
}

function encryptObjectBytes(encryption, objectNumber, generation, data, kind) {
  if (!encryption || !data?.length) return data;
  const cipher = kind === 'string' ? encryption.stringCipher : encryption.streamCipher;
  if (cipher === 'AESV2') return encryptAesV2(data, objectEncryptionKey(encryption.fileKey, objectNumber, generation, true));
  if (cipher === 'V2' || cipher === 'RC4') return rc4(objectEncryptionKey(encryption.fileKey, objectNumber, generation, false), data);
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
  if (revision >= 4 && /\/EncryptMetadata\s+false\b/.test(body)) digestParts.push(Buffer.from([0xff, 0xff, 0xff, 0xff]));

  let digest = md5(Buffer.concat(digestParts));
  if (revision >= 3) {
    for (let i = 0; i < 50; i += 1) digest = md5(digest.subarray(0, keyLength));
  }

  const usesAes = /\/CFM\s*\/AESV2\b/.test(body);
  return {
    objectNumber,
    generation,
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
    .map((match) => ({ objectNumber: Number(match[1]), offset: Number(match[2]) }));

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

function parsePdf(buffer) {
  const text = buffer.toString('latin1');
  const encryption = parseEncryption(buffer);
  const objects = [];
  const byObjectNumber = new Map();
  const objectRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  let match;

  while ((match = objectRegex.exec(text))) {
    const objectNumber = Number(match[1]);
    const generation = Number(match[2]);
    const objectText = match[0];
    const body = match[3];
    const record = {
      objectNumber,
      generation,
      body,
      source: 'indirect-object',
      decryptString: encryption ? (bytes) => decryptObjectBytes(encryption, objectNumber, generation, bytes, 'string') : null
    };
    objects.push(record);
    byObjectNumber.set(objectNumber, record);

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

    const expanded = /\/Type\s*\/ObjStm\b/.test(body)
      ? parseObjectStream(body, inflated)
      : [{
          objectNumber,
          generation,
          body: inflated.toString('latin1'),
          source: 'inflated-stream',
          decryptString: null
        }];

    for (const item of expanded) {
      objects.push(item);
      if (!byObjectNumber.has(item.objectNumber) || item.source === 'object-stream') byObjectNumber.set(item.objectNumber, item);
    }
  }

  const trailer = parseTrailer(text);
  return { text, encryption, objects, byObjectNumber, trailer };
}

function parseTrailer(text) {
  const rootMatches = [...text.matchAll(/\/Root\s+(\d+)\s+(\d+)\s+R/g)];
  const encryptMatches = [...text.matchAll(/\/Encrypt\s+(\d+)\s+(\d+)\s+R/g)];
  const infoMatches = [...text.matchAll(/\/Info\s+(\d+)\s+(\d+)\s+R/g)];
  const sizeMatches = [...text.matchAll(/\/Size\s+(\d+)/g)];
  const idMatch = text.match(/\/ID\s*\[\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
  const startMatches = [...text.matchAll(/startxref\s+(\d+)/g)];

  return {
    root: rootMatches.length ? { objectNumber: Number(rootMatches.at(-1)[1]), generation: Number(rootMatches.at(-1)[2]) } : null,
    encrypt: encryptMatches.length ? { objectNumber: Number(encryptMatches.at(-1)[1]), generation: Number(encryptMatches.at(-1)[2]) } : null,
    info: infoMatches.length ? { objectNumber: Number(infoMatches.at(-1)[1]), generation: Number(infoMatches.at(-1)[2]) } : null,
    size: sizeMatches.length ? Number(sizeMatches.at(-1)[1]) : 0,
    id: idMatch ? [idMatch[1], idMatch[2]] : null,
    prev: startMatches.length ? Number(startMatches.at(-1)[1]) : 0
  };
}

function parseAppearanceStates(body) {
  const apMatch = body.match(/\/AP\s*<<[\s\S]*?\/N\s*<<([\s\S]*?)>>/);
  if (!apMatch) return [];
  return [...apMatch[1].matchAll(/\/([^/\s<>()\[\]{}%]+)/g)]
    .map((match) => match[1])
    .filter((value) => value && value !== 'Off')
    .filter((value, index, values) => values.indexOf(value) === index);
}

function isFieldObject(body) {
  return /\/T\s*(?:\((?:\\.|[^\\)])*\)|<[^>]*>)/.test(body)
    && (/\/FT\s*\//.test(body) || /\/Subtype\s*\/Widget/.test(body) || /\/TU\s*/.test(body));
}

function extractFieldObjects(parsed) {
  const fields = new Map();
  for (const object of parsed.objects) {
    const body = object.body || '';
    if (!isFieldObject(body)) continue;
    const nameMatch = body.match(/\/T\s*(\((?:\\.|[^\\)])*\)|<[^>]*>)/);
    const name = decodePdfString(nameMatch?.[1], object.decryptString);
    if (!name || fields.has(name)) continue;
    fields.set(name, {
      ...object,
      pdfFieldName: name,
      pdfFieldType: firstPdfName(body, 'FT'),
      appearanceStates: parseAppearanceStates(body)
    });
  }
  return fields;
}

function encryptedStringToken(encryption, objectNumber, generation, value) {
  const bytes = bytesForPdfString(value);
  const encrypted = encryptObjectBytes(encryption, objectNumber, generation, bytes, 'string');
  return `<${encrypted.toString('hex').toUpperCase()}>`;
}

function plainStringToken(value) {
  return `(${String(value || '').replace(/([\\()])/g, '\\$1').replace(/\n/g, '\\n').replace(/\r/g, '\\r')})`;
}

function stringToken(encryption, objectNumber, generation, value) {
  return encryption ? encryptedStringToken(encryption, objectNumber, generation, value) : plainStringToken(value);
}

function pdfContentText(value) {
  return String(value || '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/([\\()])/g, '\\$1')
    .slice(0, 240);
}

function textAppearanceBody(object, value, appearanceObjectNumber, encryption) {
  const rect = firstPdfArray(object.body, 'Rect');
  const width = Math.max(1, Math.abs((rect[2] || 200) - (rect[0] || 0)));
  const height = Math.max(1, Math.abs((rect[3] || 20) - (rect[1] || 0)));
  const fontSize = Math.max(7, Math.min(10, height - 6));
  const y = Math.max(2, (height - fontSize) / 2);
  const flags = firstPdfNumber(object.body, 'Ff') || 0;
  const maxLength = firstPdfNumber(object.body, 'MaxLen') || 0;
  const text = pdfContentText(value);
  const isComb = Boolean((flags & 16777216) && maxLength > 1);
  const content = isComb
    ? combAppearanceContent(text, width, height, fontSize, y, maxLength)
    : `q\n0 0 ${width.toFixed(2)} ${height.toFixed(2)} re W n\nBT\n/F1 ${fontSize.toFixed(2)} Tf\n0 g\n2 ${y.toFixed(2)} Td\n(${text}) Tj\nET\nQ\n`;
  const encrypted = encryptObjectBytes(encryption, appearanceObjectNumber, 0, Buffer.from(content, 'latin1'), 'stream');
  return `<< /Type /XObject /Subtype /Form /FormType 1 /BBox [0 0 ${width.toFixed(2)} ${height.toFixed(2)}] /Resources << /Font << /F1 195 0 R >> >> /Length ${encrypted.length} >>\nstream\n${encrypted.toString('latin1')}\nendstream`;
}

function textOverlayBody(objectNumber, overlays, encryption) {
  const lines = ['q', 'BT', '/TT3 10 Tf', '0 g'];
  for (const overlay of overlays) {
    lines.push(`1 0 0 1 ${overlay.x.toFixed(2)} ${overlay.y.toFixed(2)} Tm`);
    lines.push(`(${pdfContentText(overlay.text)}) Tj`);
  }
  lines.push('ET', 'Q', '');
  const content = Buffer.from(lines.join('\n'), 'latin1');
  const encrypted = encryptObjectBytes(encryption, objectNumber, 0, content, 'stream');
  return `<< /Length ${encrypted.length} >>\nstream\n${encrypted.toString('latin1')}\nendstream`;
}

function appendPageContent(pageBody, contentObjectNumber) {
  const ref = `${contentObjectNumber} 0 R`;
  if (/\/Contents\s*\[/.test(pageBody)) {
    return pageBody.replace(/\/Contents\s*\[([\s\S]*?)\]/, (match, contents) => `/Contents [${contents.trim()} ${ref}]`);
  }
  if (/\/Contents\s+\d+\s+\d+\s+R/.test(pageBody)) {
    return pageBody.replace(/\/Contents\s+(\d+\s+\d+\s+R)/, `/Contents [$1 ${ref}]`);
  }
  return pageBody.replace(/>>\s*$/, `/Contents ${ref} >>`);
}

function eligibilityOverlay(object, value) {
  const rect = firstPdfArray(object.body, 'Rect');
  if (rect.length < 4) return null;
  const width = Math.max(1, Math.abs(rect[2] - rect[0]));
  const height = Math.max(1, Math.abs(rect[3] - rect[1]));
  return {
    text: value,
    x: rect[0] + (width / 2) - 3,
    y: rect[1] + ((height - 10) / 2)
  };
}

function isEligibilityCategoryField(fieldName) {
  return /^section_[123]\[0\]$/.test(fieldName);
}

function combAppearanceContent(text, width, height, fontSize, y, maxLength) {
  const value = String(text || '').slice(0, maxLength);
  const cellWidth = width / maxLength;
  const parts = [`q\n0 0 ${width.toFixed(2)} ${height.toFixed(2)} re W n\nBT\n/F1 ${fontSize.toFixed(2)} Tf\n0 g`];
  for (let index = 0; index < value.length; index += 1) {
    const x = (cellWidth * index) + (cellWidth / 2) - (fontSize * 0.28);
    parts.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm\n(${pdfContentText(value[index])}) Tj`);
  }
  parts.push('ET\nQ\n');
  return `${parts.join('\n')}`;
}

function normalizeFieldBodyStrings(body, object, encryption) {
  if (!encryption) return body;
  return body.replace(/(\((?:\\.|[^\\)])*\)|(?<!<)<(?!<)[^>]*>(?!>))/g, (token) => {
    const value = decodePdfString(token, object.decryptString);
    return encryptedStringToken(encryption, object.objectNumber, object.generation, value);
  });
}

function removeDictionaryEntry(body, key) {
  return body
    .replace(new RegExp(`\\/${key}\\s+(?:\\((?:\\\\.|[^\\\\)])*\\)|<[^>]*>|\\/[^\\s<>()\\[\\]{}%]+|\\d+\\s+\\d+\\s+R)`, 'g'), '')
    .replace(/\s+>>\s*$/, ' >>');
}

function removeDictionaryArrayEntry(body, key) {
  return body
    .replace(new RegExp(`\\/${key}\\s*\\[[\\s\\S]*?\\]\\s*`, 'g'), '')
    .replace(/\s+>>\s*$/, ' >>');
}

function addDictionaryEntries(body, entries) {
  const addition = Object.entries(entries)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `/${key} ${value}`)
    .join(' ');
  return body.replace(/>>\s*$/, `${addition ? ` ${addition}` : ''} >>`);
}

function updateTextFieldBody(object, value, encryption, appearanceObjectNumber) {
  let body = normalizeFieldBodyStrings(object.body, object, encryption);
  body = removeDictionaryEntry(body, 'V');
  body = removeDictionaryEntry(body, 'AP');
  return addDictionaryEntries(body, {
    V: stringToken(encryption, object.objectNumber, object.generation, value),
    AP: appearanceObjectNumber ? `<< /N ${appearanceObjectNumber} 0 R >>` : ''
  });
}

function updateChoiceFieldBody(object, value, encryption, appearanceObjectNumber) {
  return updateTextFieldBody(object, value, encryption, appearanceObjectNumber);
}

function updateButtonFieldBody(object, checked, encryption) {
  const state = checked ? (object.appearanceStates[0] || 'Yes') : 'Off';
  let body = normalizeFieldBodyStrings(object.body, object, encryption);
  body = removeDictionaryEntry(body, 'V');
  body = removeDictionaryEntry(body, 'AS');
  return addDictionaryEntries(body, {
    V: `/${state}`,
    AS: `/${state}`
  });
}

function updateAcroFormBody(object, encryption) {
  let body = normalizeFieldBodyStrings(object.body, object, encryption);
  body = removeDictionaryArrayEntry(body, 'XFA');
  body = body.replace(/\/NeedAppearances\s+(?:true|false)/g, '');
  return addDictionaryEntries(body, { NeedAppearances: 'false' });
}

function objectToBuffer(objectNumber, generation, body) {
  const text = String(body);
  const separator = text.endsWith('\n') || text.endsWith('\r') ? '' : '\n';
  return Buffer.from(`\n${objectNumber} ${generation} obj\n${text}${separator}endobj\n`, 'latin1');
}

function xrefStreamBody(entries, trailer, size, prev) {
  const sorted = [...entries.entries()].sort((a, b) => a[0] - b[0]);
  const index = [];
  const rows = [];
  let i = 0;

  while (i < sorted.length) {
    const start = sorted[i][0];
    const section = [];
    while (i < sorted.length && sorted[i][0] === start + section.length) {
      section.push(sorted[i]);
      i += 1;
    }
    index.push(start, section.length);
    for (const [, offset] of section) {
      rows.push(1, (offset >>> 24) & 0xff, (offset >>> 16) & 0xff, (offset >>> 8) & 0xff, offset & 0xff, 0, 0);
    }
  }

  const stream = Buffer.from(rows);
  const pieces = [
    '/Type /XRef',
    `/Size ${size}`,
    `/W [1 4 2]`,
    `/Index [${index.join(' ')}]`,
    `/Length ${stream.length}`
  ];
  if (trailer.root) pieces.push(`/Root ${trailer.root.objectNumber} ${trailer.root.generation} R`);
  if (trailer.info) pieces.push(`/Info ${trailer.info.objectNumber} ${trailer.info.generation} R`);
  if (trailer.encrypt) pieces.push(`/Encrypt ${trailer.encrypt.objectNumber} ${trailer.encrypt.generation} R`);
  if (trailer.id) pieces.push(`/ID [<${trailer.id[0]}> <${trailer.id[1]}>]`);
  if (Number.isFinite(prev)) pieces.push(`/Prev ${prev}`);
  return `<< ${pieces.join(' ')} >>\nstream\n${stream.toString('latin1')}\nendstream`;
}

function incrementalFillPdf(input, fieldValues) {
  const original = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const parsed = parsePdf(original);
  const fields = extractFieldObjects(parsed);
  const updates = new Map();
  const pageOverlays = new Map();
  let nextObjectNumber = Math.max(parsed.trailer.size || 0, ...parsed.objects.map((object) => object.objectNumber)) + 1;
  const filledFields = [];
  const skippedFields = [];

  for (const [fieldName, rawValue] of Object.entries(fieldValues || {})) {
    const object = fields.get(fieldName);
    if (!object) {
      skippedFields.push(fieldName);
      continue;
    }

    if (isEligibilityCategoryField(fieldName)) {
      const pageRef = firstPdfRef(object.body, 'P');
      const overlay = eligibilityOverlay(object, rawValue);
      if (pageRef && overlay) {
        const overlays = pageOverlays.get(pageRef.objectNumber) || [];
        overlays.push(overlay);
        pageOverlays.set(pageRef.objectNumber, overlays);
      }
      filledFields.push(fieldName);
      continue;
    }

    let body;
    if (object.pdfFieldType === 'Btn') {
      body = updateButtonFieldBody(object, Boolean(rawValue), parsed.encryption);
    } else if (object.pdfFieldType === 'Ch') {
      const appearanceObjectNumber = nextObjectNumber;
      nextObjectNumber += 1;
      body = updateChoiceFieldBody(object, rawValue, parsed.encryption, appearanceObjectNumber);
      updates.set(appearanceObjectNumber, {
        generation: 0,
        body: textAppearanceBody(object, rawValue, appearanceObjectNumber, parsed.encryption)
      });
    } else {
      const appearanceObjectNumber = nextObjectNumber;
      nextObjectNumber += 1;
      body = updateTextFieldBody(object, rawValue, parsed.encryption, appearanceObjectNumber);
      updates.set(appearanceObjectNumber, {
        generation: 0,
        body: textAppearanceBody(object, rawValue, appearanceObjectNumber, parsed.encryption)
      });
    }
    updates.set(object.objectNumber, { generation: object.generation, body });
    filledFields.push(fieldName);
  }

  const root = parsed.trailer.root ? parsed.byObjectNumber.get(parsed.trailer.root.objectNumber) : null;
  const acroRef = root ? firstPdfRef(root.body, 'AcroForm') : null;
  const acroForm = acroRef ? parsed.byObjectNumber.get(acroRef.objectNumber) : null;
  if (acroForm) {
    updates.set(acroForm.objectNumber, {
      generation: acroForm.generation,
      body: updateAcroFormBody(acroForm, parsed.encryption)
    });

    // The USCIS XFA packet is poorly supported by browser, Preview, and mobile
    // viewers. We remove the XFA pointer from the draft AcroForm and rely on
    // visible widget appearance streams instead.
  }

  for (const [pageObjectNumber, overlays] of pageOverlays.entries()) {
    const page = parsed.byObjectNumber.get(pageObjectNumber);
    if (!page || !overlays.length) continue;
    const contentObjectNumber = nextObjectNumber;
    nextObjectNumber += 1;
    updates.set(contentObjectNumber, {
      generation: 0,
      body: textOverlayBody(contentObjectNumber, overlays, parsed.encryption)
    });
    updates.set(pageObjectNumber, {
      generation: page.generation,
      body: appendPageContent(page.body, contentObjectNumber)
    });
  }

  const buffers = [];
  const offsets = new Map();
  let offset = original.length;
  for (const [objectNumber, update] of [...updates.entries()].sort((a, b) => a[0] - b[0])) {
    const buffer = objectToBuffer(objectNumber, update.generation || 0, update.body);
    offsets.set(objectNumber, offset);
    buffers.push(buffer);
    offset += buffer.length;
  }

  const xrefObjectNumber = nextObjectNumber;
  const xrefOffset = offset;
  offsets.set(xrefObjectNumber, xrefOffset);
  const maxObjectNumber = Math.max(...offsets.keys(), parsed.trailer.size || 0);
  const xrefObject = objectToBuffer(
    xrefObjectNumber,
    0,
    xrefStreamBody(offsets, parsed.trailer, maxObjectNumber + 1, parsed.trailer.prev)
  );
  const xref = Buffer.concat([
    xrefObject,
    Buffer.from(`startxref\n${xrefOffset}\n%%EOF\n`, 'latin1')
  ]);

  return {
    buffer: Buffer.concat([original, ...buffers, xref]),
    filledFields,
    skippedFields,
    updateCount: updates.size
  };
}

module.exports = {
  incrementalFillPdf,
  parsePdf,
  extractFieldObjects
};
