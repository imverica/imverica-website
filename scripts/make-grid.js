const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

async function main() {
  const input = 'USCIS forms printed/ar-11.pdf';
  const output = 'generated-filled/ar-11-grid.pdf';

  const pdfDoc = await PDFDocument.load(fs.readFileSync(input));
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];

  const { width, height } = page.getSize();

  for (let x = 0; x <= width; x += 25) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: height },
      thickness: x % 100 === 0 ? 0.8 : 0.25,
      color: rgb(1, 0, 0)
    });
    page.drawText(String(x), {
      x: x + 2,
      y: height - 14,
      size: 6,
      font,
      color: rgb(1, 0, 0)
    });
  }

  for (let y = 0; y <= height; y += 25) {
    page.drawLine({
      start: { x: 0, y },
      end: { x: width, y },
      thickness: y % 100 === 0 ? 0.8 : 0.25,
      color: rgb(0, 0, 1)
    });
    page.drawText(String(y), {
      x: 2,
      y: y + 2,
      size: 6,
      font,
      color: rgb(0, 0, 1)
    });
  }

  fs.mkdirSync('generated-filled', { recursive: true });
  fs.writeFileSync(output, await pdfDoc.save());

  console.log(`Page size: ${width} x ${height}`);
  console.log(output);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
