const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeValue(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

async function main() {
  const mapPath = process.argv[2];
  const payloadPath = process.argv[3];

  if (!mapPath || !payloadPath) {
    throw new Error('Usage: node scripts/render-normalized-overlay.js map.json payload.json');
  }

  const map = readJson(mapPath);
  const payload = readJson(payloadPath);

  const pdfBytes = fs.readFileSync(map.source);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const fonts = {
    Courier: await pdfDoc.embedFont(StandardFonts.Courier),
    CourierBold: await pdfDoc.embedFont(StandardFonts.CourierBold),
    Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    HelveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  };

  const pages = pdfDoc.getPages();
  const pickFont = field => fonts[field.font || 'CourierBold'];

  for (const field of map.fields) {
    const page = pages[Number(field.page) - 1];
    if (!page) continue;

    const value = payload[field.key];

    if (field.mode === 'checkbox_group' || field.mode === 'radio_group') {
      if (isEmpty(value)) continue;

      const selected = field.options.find(opt => String(opt.value) === String(value));
      if (!selected) continue;

      page.drawText('x', {
        x: selected.x,
        y: selected.y,
        size: field.size || 10,
        font: pickFont(field),
        color: rgb(0, 0, 0)
      });

      continue;
    }

    if (field.mode === 'checkbox_single' || field.mode === 'radio_single') {
      const checked = value === true || value === 1 || value === '1' || value === 'true' || value === 'yes';

      if (!checked) continue;

      page.drawText('x', {
        x: field.x,
        y: field.y,
        size: field.size || 10,
        font: pickFont(field),
        color: rgb(0, 0, 0)
      });

      continue;
    }

    if (field.mode === 'text') {
      if (isEmpty(value)) continue;

      page.drawText(normalizeValue(value), {
        x: field.x,
        y: field.y,
        size: field.size || 10,
        font: pickFont(field),
        color: rgb(0, 0, 0)
      });

      continue;
    }
  }

  fs.mkdirSync(path.dirname(map.output), { recursive: true });
  fs.writeFileSync(map.output, await pdfDoc.save());

  console.log('DONE');
  console.log('Output:', map.output);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
