// Builds the public "see a sample" files for form pages: a filled form with
// invented data (form-samples/*.sample.json), rendered to images with a
// SAMPLE watermark on every page, as a flattened PDF plus WebP previews.
// Every name, number and address in the samples is fictional.
//
// Needs pdftoppm (poppler) and sharp (installed with astro-site).
// Run: node scripts/build-form-samples.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { PDFDocument, PDFName, rgb } = require('pdf-lib');
const sharp = require('../astro-site/node_modules/sharp');
const { i485FieldValues, i485TextOverlays } = require('../netlify/functions/lib/i485-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');
const { fillCourtForm } = require('../netlify/functions/lib/ca-court-fill');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'astro-site/public/samples');
const DPI = 100;

const SAMPLES = [
  {
    slug: 'i-485',
    previews: [1, 3, 5],
    async fill() {
      const formAnswers = JSON.parse(fs.readFileSync(path.join(ROOT, 'form-samples/i-485.sample.json'), 'utf8'));
      const payload = { formCode: 'I-485', formAnswers, contact: { phone: formAnswers.daytime_phone, email: formAnswers.email_address } };
      const pdf = fs.readFileSync(path.join(ROOT, 'assets/form-cache/pdfs/i-485.pdf'));
      return incrementalFillPdf(pdf, i485FieldValues(payload), i485TextOverlays(payload)).buffer;
    }
  },
  {
    slug: 'fl-150',
    previews: [1, 2, 3, 4],
    async fill() {
      const fields = JSON.parse(fs.readFileSync(path.join(ROOT, 'form-samples/fl-150.sample.json'), 'utf8'));
      const pdf = fs.readFileSync(path.join(ROOT, 'assets/form-cache/ca-court/fl-150.pdf'));
      return drawCheckMarks((await fillCourtForm(pdf, fields)).buffer);
    }
  }
];

// Court-form check boxes draw their mark with the ZapfDingbats font, which
// poppler may not have; draw the X as lines so the rendered sample shows it.
async function drawCheckMarks(buffer) {
  const doc = await PDFDocument.load(buffer);
  const pages = doc.getPages();
  for (const field of doc.getForm().getFields()) {
    if (!field.isChecked || !field.isChecked()) continue;
    for (const widget of field.acroField.getWidgets()) {
      const page = pages.find((candidate) => candidate.ref === widget.dict.get(PDFName.of('P')));
      if (!page) continue;
      const { x, y, width, height } = widget.getRectangle();
      const pad = Math.min(width, height) * 0.22;
      const line = { thickness: 1.1, color: rgb(0, 0, 0) };
      page.drawLine({ start: { x: x + pad, y: y + pad }, end: { x: x + width - pad, y: y + height - pad }, ...line });
      page.drawLine({ start: { x: x + pad, y: y + height - pad }, end: { x: x + width - pad, y: y + pad }, ...line });
      widget.setAppearanceState(PDFName.of('Off'));
    }
  }
  return Buffer.from(await doc.save());
}

function watermark(width, height) {
  const size = Math.round(width / 11);
  const rows = [0.22, 0.5, 0.78].map((y) => (
    `<text x="${width / 2}" y="${Math.round(height * y)}" transform="rotate(-30 ${width / 2} ${Math.round(height * y)})">SAMPLE · FICTIONAL DATA</text>`
  )).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <style>text{font:700 ${size}px Helvetica,Arial,sans-serif;fill:rgba(190,30,30,0.16);text-anchor:middle;letter-spacing:4px}</style>${rows}</svg>`);
}

async function build(sample) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `sample-${sample.slug}-`));
  const filledPath = path.join(work, 'filled.pdf');
  fs.writeFileSync(filledPath, Buffer.from(await sample.fill()));
  execFileSync('pdftoppm', ['-r', String(DPI), '-png', filledPath, path.join(work, 'page')]);
  const pages = fs.readdirSync(work).filter((name) => /^page-\d+\.png$/.test(name)).sort();

  const doc = await PDFDocument.create();
  for (const [index, name] of pages.entries()) {
    const image = sharp(path.join(work, name));
    const { width, height } = await image.metadata();
    const stamped = await image.composite([{ input: watermark(width, height) }]).png().toBuffer();
    const jpeg = await sharp(stamped).jpeg({ quality: 62, mozjpeg: true }).toBuffer();
    const page = doc.addPage([612, 792]);
    page.drawImage(await doc.embedJpg(jpeg), { x: 0, y: 0, width: 612, height: 792 });
    if (sample.previews.includes(index + 1)) {
      await sharp(stamped).resize({ width: 900 }).webp({ quality: 72 }).toFile(path.join(OUT, `${sample.slug}-sample-p${index + 1}.webp`));
    }
  }
  doc.setTitle(`${sample.slug.toUpperCase()} sample (fictional data)`);
  doc.setSubject('Sample filled form. Every name, number and address is invented.');
  fs.writeFileSync(path.join(OUT, `${sample.slug}-sample.pdf`), await doc.save());
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`${sample.slug}: ${pages.length} pages, previews ${sample.previews.join(', ')}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const sample of SAMPLES) await build(sample);
})();
