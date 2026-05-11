const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

function cleanKey(name) {
  const parts = String(name).split('.');
  const last = parts[parts.length - 1] || name;
  return last.replace(/\[\d+\]/g, '');
}

async function main() {
  const inputPdf = process.argv[2];
  const printedPdf = process.argv[3];
  const outputJson = process.argv[4];

  if (!inputPdf || !printedPdf || !outputJson) {
    throw new Error('Usage: node scripts/extract-overlay-map.js "USCIS forms decrypted/i-765.pdf" "USCIS forms printed/i-765.pdf" overlay-maps/i-765.raw.json');
  }

  const bytes = fs.readFileSync(inputPdf);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const pages = pdfDoc.getPages();

  const result = {
    source: printedPdf,
    output: outputJson
      .replace('overlay-maps/', 'generated-filled/')
      .replace('.raw.json', '-output.pdf')
      .replace('.json', '-output.pdf'),
    fields: []
  };

  for (const field of fields) {
    const originalName = field.getName();

    if (originalName.includes('PDF417BarCode')) continue;

    const key = cleanKey(originalName);
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
        page: pageIndex >= 0 ? pageIndex + 1 : 1,
        x: Math.round(rect.x * 10) / 10,
        y: Math.round((rect.y + 2) * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        size: 10,
        font: 'CourierBold'
      });
    }
  }

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.writeFileSync(outputJson, JSON.stringify(result, null, 2));

  console.log('DONE');
  console.log('Fields:', result.fields.length);
  console.log('Output:', outputJson);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
