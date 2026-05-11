const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

async function main() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('Normalized Renderer Test', { x: 50, y: 740, size: 18, font, color: rgb(0, 0, 0) });
  page.drawText('Name:', { x: 50, y: 680, size: 12, font, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: 120, y: 675, width: 200, height: 20, borderWidth: 1, color: undefined, borderColor: rgb(0, 0, 0) });

  page.drawText('Choose one:', { x: 50, y: 630, size: 12, font, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: 150, y: 625, width: 12, height: 12, borderWidth: 1, borderColor: rgb(0, 0, 0) });
  page.drawText('Option 0', { x: 170, y: 625, size: 12, font, color: rgb(0, 0, 0) });

  page.drawRectangle({ x: 250, y: 625, width: 12, height: 12, borderWidth: 1, borderColor: rgb(0, 0, 0) });
  page.drawText('Option 1', { x: 270, y: 625, size: 12, font, color: rgb(0, 0, 0) });

  page.drawText('Single checkbox:', { x: 50, y: 580, size: 12, font, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: 170, y: 575, width: 12, height: 12, borderWidth: 1, borderColor: rgb(0, 0, 0) });

  fs.writeFileSync('test-fixtures/normalized-test.pdf', await pdfDoc.save());
  console.log('DONE');
}

main();
