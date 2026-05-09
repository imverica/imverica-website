#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { parsePdf, extractFieldObjects } = require('../netlify/functions/lib/pdf-incremental-fill');

const PDFS_DIR = path.resolve(__dirname, '../assets/form-cache/pdfs');

const formSlugMap = {
  'ar-11': 'AR-11',
  'g-28': 'G-28',
  'g-28i': 'G-28I',
  'g-325a': 'G-325A',
  'g-639': 'G-639',
  'g-845': 'G-845',
  'g-845-supplement': 'G-845 Supplement',
  'g-884': 'G-884',
  'g-1041': 'G-1041',
  'g-1041a': 'G-1041A',
  'g-1055': 'G-1055',
  'g-1145': 'G-1145',
  'g-1256': 'G-1256',
  'g-1450': 'G-1450',
  'g-1566': 'G-1566',
  'g-1650': 'G-1650',
  'i-9': 'I-9',
  'i-90': 'I-90',
  'i-102': 'I-102',
  'i-129': 'I-129',
  'i-129cwr': 'I-129CWR',
  'i-129f': 'I-129F',
  'i-129s': 'I-129S',
  'i-130': 'I-130',
  'i-130a': 'I-130A',
  'i-131': 'I-131',
  'i-131a': 'I-131A',
  'i-134': 'I-134',
  'i-134a': 'I-134A',
  'i-140': 'I-140',
  'i-191': 'I-191',
  'i-192': 'I-192',
  'i-193': 'I-193',
  'i-212': 'I-212',
  'i-290b': 'I-290B',
  'i-360': 'I-360',
  'i-361': 'I-361',
  'i-363': 'I-363',
  'i-407': 'I-407',
  'i-485': 'I-485',
  'i-485-supplement-a': 'I-485 Supplement A',
  'i-485-supplement-j': 'I-485 Supplement J',
  'i-508': 'I-508',
  'i-526': 'I-526',
  'i-526e': 'I-526E',
  'i-539': 'I-539',
  'i-539a': 'I-539A',
  'i-589': 'I-589',
  'i-590': 'I-590',
  'i-600': 'I-600',
  'i-600a': 'I-600A',
  'i-601': 'I-601',
  'i-601a': 'I-601A',
  'i-602': 'I-602',
  'i-612': 'I-612',
  'i-687': 'I-687',
  'i-690': 'I-690',
  'i-693': 'I-693',
  'i-694': 'I-694',
  'i-698': 'I-698',
  'i-730': 'I-730',
  'i-751': 'I-751',
  'i-765': 'I-765',
  'i-765v': 'I-765V',
  'i-800': 'I-800',
  'i-800a': 'I-800A',
  'i-817': 'I-817',
  'i-821': 'I-821',
  'i-821d': 'I-821D',
  'i-824': 'I-824',
  'i-829': 'I-829',
  'i-864': 'I-864',
  'i-864a': 'I-864A',
  'i-864ez': 'I-864EZ',
  'i-864w': 'I-864W',
  'i-865': 'I-865',
  'i-881': 'I-881',
  'i-907': 'I-907',
  'i-912': 'I-912',
  'i-914': 'I-914',
  'i-918': 'I-918',
  'i-929': 'I-929',
  'i-941': 'I-941',
  'i-942': 'I-942',
  'i-956': 'I-956',
  'i-956f': 'I-956F',
  'i-956g': 'I-956G',
  'i-956h': 'I-956H',
  'i-956k': 'I-956K',
  'n-300': 'N-300',
  'n-336': 'N-336',
  'n-400': 'N-400',
  'n-470': 'N-470',
  'n-565': 'N-565',
  'n-600': 'N-600',
  'n-600k': 'N-600K',
  'n-648': 'N-648',
};

const results = {};

for (const [slug, code] of Object.entries(formSlugMap)) {
  const pdfPath = path.join(PDFS_DIR, `${slug}.pdf`);
  if (!fs.existsSync(pdfPath)) {
    results[code] = { error: 'PDF not found', fields: [] };
    continue;
  }
  try {
    const buf = fs.readFileSync(pdfPath);
    const parsed = parsePdf(buf);
    const fieldMap = extractFieldObjects(parsed);
    const fields = [];
    for (const [name, obj] of fieldMap.entries()) {
      fields.push({ name, type: obj.pdfFieldType, states: obj.appearanceStates });
    }
    results[code] = { count: fields.length, fields };
  } catch (err) {
    results[code] = { error: err.message, fields: [] };
  }
}

process.stdout.write(JSON.stringify(results, null, 2));
