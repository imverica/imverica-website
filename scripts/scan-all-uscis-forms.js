const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');

const SOURCE_DIR = 'USCIS forms';
const PRINTED_DIR = 'USCIS forms printed';
const DECRYPTED_DIR = 'USCIS forms decrypted';
const REPORTS_DIR = 'reports';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanKey(name) {
  const parts = String(name).split('.');
  const last = parts[parts.length - 1] || name;
  return last.replace(/\[\d+\]/g, '');
}

function fieldKind(field) {
  const ctor = field.constructor && field.constructor.name ? field.constructor.name : '';
  const name = field.getName ? field.getName() : '';

  if (name.includes('PDF417BarCode')) return 'barcode';
  if (ctor.includes('CheckBox')) return 'checkbox';
  if (ctor.includes('Radio')) return 'radio';
  if (ctor.includes('Dropdown')) return 'dropdown';
  if (ctor.includes('OptionList')) return 'option_list';
  if (ctor.includes('Text')) return 'text';
  return ctor || 'unknown';
}

async function scanPdf(originalPath, decryptedPath, printedPath) {
  execFileSync('qpdf', ['--decrypt', originalPath, decryptedPath], { stdio: 'ignore' });

  const bytes = fs.readFileSync(decryptedPath);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const pages = pdfDoc.getPages();
  let fields = [];

  try {
    fields = pdfDoc.getForm().getFields();
  } catch {
    fields = [];
  }

  const counts = {
    total: fields.length,
    text: 0,
    checkbox: 0,
    radio: 0,
    dropdown: 0,
    option_list: 0,
    barcode: 0,
    unknown: 0
  };

  const sampleFields = [];

  for (const field of fields) {
    const originalKey = field.getName();
    const kind = fieldKind(field);

    if (counts[kind] === undefined) counts.unknown++;
    else counts[kind]++;

    if (sampleFields.length < 20 && kind !== 'barcode') {
      sampleFields.push({
        key: cleanKey(originalKey),
        originalKey,
        kind
      });
    }
  }

  return {
    form: path.basename(originalPath),
    original: originalPath,
    printedExists: fs.existsSync(printedPath),
    printed: printedPath,
    decrypted: decryptedPath,
    pages: pages.length,
    fields: counts,
    sampleFields,
    status: 'ok'
  };
}

async function main() {
  ensureDir(DECRYPTED_DIR);
  ensureDir(REPORTS_DIR);

  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  const results = [];

  for (const file of files) {
    const originalPath = path.join(SOURCE_DIR, file);
    const decryptedPath = path.join(DECRYPTED_DIR, file);
    const printedPath = path.join(PRINTED_DIR, file);

    process.stdout.write(`Scanning ${file} ... `);

    try {
      const result = await scanPdf(originalPath, decryptedPath, printedPath);
      results.push(result);
      console.log(`OK pages=${result.pages} fields=${result.fields.total}`);
    } catch (err) {
      results.push({
        form: file,
        original: originalPath,
        printedExists: fs.existsSync(printedPath),
        printed: printedPath,
        decrypted: decryptedPath,
        pages: 0,
        fields: {
          total: 0,
          text: 0,
          checkbox: 0,
          radio: 0,
          dropdown: 0,
          option_list: 0,
          barcode: 0,
          unknown: 0
        },
        sampleFields: [],
        status: 'error',
        error: err.message
      });
      console.log(`ERROR ${err.message}`);
    }
  }

  const jsonPath = path.join(REPORTS_DIR, 'uscis-form-scan.json');
  const csvPath = path.join(REPORTS_DIR, 'uscis-form-scan.csv');

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  const csvRows = [
    [
      'form',
      'status',
      'pages',
      'total_fields',
      'text',
      'checkbox',
      'radio',
      'dropdown',
      'option_list',
      'barcode',
      'unknown',
      'printed_exists',
      'error'
    ].join(',')
  ];

  for (const r of results) {
    csvRows.push([
      r.form,
      r.status,
      r.pages,
      r.fields.total,
      r.fields.text,
      r.fields.checkbox,
      r.fields.radio,
      r.fields.dropdown,
      r.fields.option_list,
      r.fields.barcode,
      r.fields.unknown,
      r.printedExists,
      r.error ? `"${String(r.error).replace(/"/g, '""')}"` : ''
    ].join(','));
  }

  fs.writeFileSync(csvPath, csvRows.join('\n'));

  const ok = results.filter(r => r.status === 'ok').length;
  const bad = results.filter(r => r.status === 'error').length;
  const totalFields = results.reduce((sum, r) => sum + r.fields.total, 0);

  console.log('');
  console.log('DONE');
  console.log('Forms:', results.length);
  console.log('OK:', ok);
  console.log('Errors:', bad);
  console.log('Total fields:', totalFields);
  console.log('JSON:', jsonPath);
  console.log('CSV:', csvPath);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
