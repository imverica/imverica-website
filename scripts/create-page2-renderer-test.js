const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

async function main() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page1 = pdfDoc.addPage([612, 792]);
  page1.drawText('Page 1 Test', { x: 50, y: 740, size: 18, font, color: rgb(0, 0, 0) });
  page1.drawText('Name Page 1:', { x: 50, y: 680, size: 12, font, color: rgb(0, 0, 0) });

  const page2 = pdfDoc.addPage([612, 792]);
  page2.drawText('Page 2 Test', { x: 50, y: 740, size: 18, font, color: rgb(0, 0, 0) });
  page2.drawText('Name Page 2:', { x: 50, y: 680, size: 12, font, color: rgb(0, 0, 0) });

  fs.writeFileSync('test-fixtures/normalized-page2-test.pdf', await pdfDoc.save());
  console.log('DONE');
}

main();
