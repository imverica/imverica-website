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

function splitUnit(address = '') {
  const s = String(address).trim().replace(/\s+/g, ' ');
  const m = s.match(/^(.*?)(?:\s+)(APT|APARTMENT|STE|SUITE|FLR|FLOOR)\s+([A-Z0-9\-]+)$/i);

  if (!m) {
    return { street: s, unitType: '', unitNumber: '' };
  }

  let unitType = m[2].toUpperCase();
  if (unitType === 'APARTMENT') unitType = 'APT';
  if (unitType === 'SUITE') unitType = 'STE';
  if (unitType === 'FLOOR') unitType = 'FLR';

  return {
    street: m[1].trim(),
    unitType,
    unitNumber: m[3].trim().toUpperCase()
  };
}

async function main() {
  const mapPath = process.argv[2] || 'overlay-maps/ar-11.json';

  const present = splitUnit('456 NEW STREET APT 5');
  const previous = splitUnit('123 OLD STREET APT 7');

  const sampleData = {
    family_name: 'SMITH',
    given_name: 'JOHN',
    middle_name: 'MICHAEL',
    date_of_birth: '01/01/1990',
    alien_number: '123456789',

    present_street: present.street,
    present_unit_type: present.unitType,
    present_unit_number: present.unitNumber,
    present_city: 'SACRAMENTO',
    present_state: 'CA',
    present_zip: '95815',

    previous_street: previous.street,
    previous_unit_type: previous.unitType,
    previous_unit_number: previous.unitNumber,
    previous_city: 'LOS ANGELES',
    previous_state: 'CA',
    previous_zip: '90001',

    signature: 'John Smith',
    signature_date: '05/10/2026'
  };

  const map = readJson(mapPath);
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

    const value = sampleData[field.key];
    if (!value) continue;

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
        size: field.size || 11.5,
        font: pickFont(field),
        color: rgb(0, 0, 0)
      });
      continue;
    }

    if (field.mode === 'unit_type') {
      const unit = normalizeValue(value).toUpperCase().trim();

      let x = field.x;
      if (unit === 'APT') x = field.x;
      else if (unit === 'STE') x = field.x + 18;
      else if (unit === 'FLR') x = field.x + 36;
      else continue;

      page.drawText('X', {
        x,
        y: field.y,
        size: field.size || 11,
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

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
