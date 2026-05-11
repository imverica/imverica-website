const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');

const SOURCE_DIR = 'USCIS forms';
const PRINTED_DIR = 'USCIS forms printed';
const DECRYPTED_DIR = 'USCIS forms decrypted';
const RAW_MAP_DIR = 'overlay-maps/raw';

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

  return 'unknown';
}

async function createRawMap(file) {
  const baseName = path.basename(file, '.pdf');

  const originalPath = path.join(SOURCE_DIR, file);
  const printedPath = path.join(PRINTED_DIR, file);
  const decryptedPath = path.join(DECRYPTED_DIR, file);
  const outputJson = path.join(RAW_MAP_DIR, `${baseName}.raw.json`);

  execFileSync('qpdf', ['--decrypt', originalPath, decryptedPath], { stdio: 'ignore' });

  const bytes = fs.readFileSync(decryptedPath);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const pages = pdfDoc.getPages();

  const result = {
    form: baseName,
    source: printedPath,
    output: `generated-filled/${baseName}-output.pdf`,
    fields: []
  };

  for (const field of fields) {
    const originalName = field.getName();

    if (originalName.includes('PDF417BarCode')) continue;

    const key = cleanKey(originalName);
    const kind = fieldKind(field);
    const widgets = field.acroField.getWidgets ? field.acroField.getWidgets() : [];

    for (const widget of widgets) {
      const rect = widget.getRectangle();

      let pageIndex = -1;
      const widgetPageRef = widget.P();

      for (let i = 0; i < pages.length; i++) {
        if (pages[i].ref === widgetPageRef) {
          pageIndex = i;
          break;
        }
      }

      result.fields.push({
        key,
        originalKey: originalName,
        kind,
        page: pageIndex >= 0 ? pageIndex + 1 : 1,
        x: Math.round(rect.x * 10) / 10,
        y: Math.round((rect.y + 2) * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        size: kind === 'checkbox' || kind === 'radio' ? 10 : 10,
        font: kind === 'checkbox' || kind === 'radio' ? 'HelveticaBold' : 'CourierBold'
      });
    }
  }

  fs.writeFileSync(outputJson, JSON.stringify(result, null, 2));

  return {
    form: file,
    fields: result.fields.length,
    output: outputJson
  };
}

async function main() {
  ensureDir(DECRYPTED_DIR);
  ensureDir(RAW_MAP_DIR);

  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  const results = [];

  for (const file of files) {
    process.stdout.write(`Raw map ${file} ... `);

    try {
      const result = await createRawMap(file);
      results.push(result);
      console.log(`OK fields=${result.fields}`);
    } catch (err) {
      results.push({
        form: file,
        fields: 0,
        error: err.message
      });
      console.log(`ERROR ${err.message}`);
    }
  }

  fs.writeFileSync(
    'reports/raw-map-generation-report.json',
    JSON.stringify(results, null, 2)
  );

  console.log('');
  console.log('DONE');
  console.log('Forms:', results.length);
  console.log('Errors:', results.filter(r => r.error).length);
  console.log('Raw maps:', RAW_MAP_DIR);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
