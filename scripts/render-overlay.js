const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeValue(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

async function main() {
  const mapPath = process.argv[2];
  const payloadPath = process.argv[3];

  if (!mapPath) {
    throw new Error('Missing overlay map path');
  }

  const map = readJson(mapPath);
  const payload = payloadPath ? readJson(payloadPath) : {};

  const inputPath = path.resolve(map.source);
  const outputPath = path.resolve(map.output);

  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const fonts = {
    Courier: await pdfDoc.embedFont(StandardFonts.Courier),
    CourierBold: await pdfDoc.embedFont(StandardFonts.CourierBold),
    Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    HelveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  };

  const pickFont = (field) => fonts[field.font || 'CourierBold'];
  const pages = pdfDoc.getPages();

  for (const field of map.fields) {
    const page = pages[Number(field.page) - 1];
    if (!page) continue;

    const value = payload[field.key];

    if (value === undefined || value === null || String(value).trim() === '') {
      continue;
    }

    if (field.mode === 'digits_positions' && Array.isArray(field.positions)) {
      const text = normalizeValue(value).replace(/\D/g, '');

      for (let i = 0; i < Math.min(text.length, field.positions.length); i++) {
        const pos = field.positions[i];

        page.drawText(text[i], {
          x: pos.x,
          y: pos.y,
          size: field.size || 11,
          font: pickFont(field),
          color: rgb(0, 0, 0)
        });
      }

      continue;
    }

    if (field.mode === 'unit_type_positions') {
      const unit = normalizeValue(value).toUpperCase().trim();
      const pos = field.positions && field.positions[unit];

      if (!pos) continue;

      page.drawText('x', {
        x: pos.x,
        y: pos.y,
        size: field.size || 10,
        font: pickFont(field),
        color: rgb(0, 0, 0)
      });

      continue;
    }

    page.drawText(normalizeValue(value), {
      x: field.x,
      y: field.y,
      size: field.size || 11,
      font: pickFont(field),
      color: rgb(0, 0, 0)
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await pdfDoc.save());

  console.log('DONE');
  console.log('Output:', outputPath);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
