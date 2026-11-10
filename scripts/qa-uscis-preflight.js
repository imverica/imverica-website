// "Before you mail to USCIS" sheet (netlify/functions/lib/uscis-preflight.js):
// every part, item and page number it quotes is re-read from the cached form
// PDF, the quoted edition must be the cached one, and the sheet must be
// complete in all four languages.
// Run: node scripts/qa-uscis-preflight.js   (after every USCIS form update)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildPreflight, PREFLIGHT_FORMS, FORMS, TEXT } = require('../netlify/functions/lib/uscis-preflight');
const endpoint = require('../netlify/functions/form-preflight');

const ROOT = path.resolve(__dirname, '..');
const LANGS = ['en', 'ru', 'uk', 'es'];
// The copy the functions ship with: the one the sheet reads at run time.
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'netlify/functions/form-cache-manifest.json'), 'utf8'));

let failures = 0;
function check(ok, label) {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}

function pagesOf(code) {
  const pdf = path.join(ROOT, 'assets/form-cache/pdfs', `${code.toLowerCase()}.pdf`);
  try {
    return execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\f');
  } catch {
    return null;
  }
}

const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const allText = (sheet) => sheet.sections.map((s) => s.items.map((i) => i.text).join('\n')).join('\n');

let pdfChecked = 0;
for (const code of PREFLIGHT_FORMS) {
  const def = FORMS[code];
  const cached = (manifest.forms || []).find((f) => f.code === code);
  check(cached && cached.editionDate === def.verifiedEdition,
    `${code}: cached edition ${cached && cached.editionDate} is not the edition read for the sheet (${def.verifiedEdition}); re-read the form and update FORMS`);

  // The numbers the sheet quotes, against the form itself.
  const pages = pagesOf(code);
  if (pages) {
    pdfChecked += 1;
    const page = (n) => pages[n - 1] || '';
    const whole = pages.join('\n');
    check(new RegExp(`Form ${escape(code)} Edition ${escape(def.verifiedEdition)}\\s+Page ${def.pages} of ${def.pages}`).test(whole), `${code}: ${def.pages} pages, edition ${def.verifiedEdition}`);
    check(new RegExp(`${escape(def.applicant.item)}\\.?\\s+Applicant's Signature`).test(page(def.applicant.page)), `${code}: applicant signs item ${def.applicant.item} on page ${def.applicant.page}`);
    check(new RegExp(`Part ${def.applicant.part}\\.\\s+Applicant's`).test(whole), `${code}: Part ${def.applicant.part} is the applicant's signature part`);
    check(new RegExp(`${escape(def.interpreter.item)}\\.?\\s+Interpreter's Signature`).test(page(def.interpreter.page)), `${code}: interpreter signs item ${def.interpreter.item} on page ${def.interpreter.page}`);
    check(new RegExp(`Part ${def.interpreter.part}\\.\\s+Interpreter's`).test(whole), `${code}: Part ${def.interpreter.part} is the interpreter's part`);
    check(new RegExp(`${escape(def.preparer.item)}\\.?\\s+Preparer's Signature`).test(page(def.preparer.page)), `${code}: preparer signs item ${def.preparer.item} on page ${def.preparer.page}`);
    check(new RegExp(`Part ${def.preparer.part}\\.\\s+(Contact Information, Certification, and\\s+)?Signature of the Person Preparing|Part ${def.preparer.part}\\.\\s+Contact Information, Declaration, and`).test(whole), `${code}: Part ${def.preparer.part} is the preparer's part`);
    if (def.interview) {
      for (const part of def.interview.parts) {
        check(new RegExp(`Part ${part}\\.\\s`).test(page(def.interview.page)), `${code}: Part ${part} (interview) is on page ${def.interview.page}`);
      }
      check(/Do not complete Parts? [\d. or]+until the USCIS [Oo]fficer instructs you/.test(whole), `${code}: the form says to leave the interview part(s) empty`);
    } else {
      check(!/Signature at Interview/.test(whole), `${code}: no interview-only part on the form`);
    }
  }

  for (const lang of LANGS) {
    const sheet = buildPreflight(code, { lang });
    const text = [sheet.title, sheet.intro, sheet.footer, sheet.printLabel, sheet.sourcesTitle, allText(sheet)].join('\n');
    check(sheet.lang === lang && sheet.editionVerified, `${code} ${lang}: sheet built on the verified edition`);
    check(sheet.sections.map((s) => s.id).join() === 'sign,form,pay,envelope,mail', `${code} ${lang}: five sections`);
    check(sheet.sections.every((s) => s.title && s.items.length && s.items.every((i) => i.id && i.text)), `${code} ${lang}: every item has text`);
    check(!/[{}]|undefined/.test(text), `${code} ${lang}: no unfilled placeholder`);
    check(text.includes(`Part ${def.applicant.part}, Item ${def.applicant.item}`) && text.includes(def.verifiedEdition), `${code} ${lang}: quotes the signature item and the edition`);
    const links = sheet.sources.concat(sheet.sections.flatMap((s) => s.items.map((i) => i.link).filter(Boolean)));
    check(links.length >= 7 && links.every((l) => l.label && /^https:\/\/www\.uscis\.gov\//.test(l.url)), `${code} ${lang}: links go to uscis.gov`);
    // Fees and addresses are linked, never copied.
    check(!/\$\s?\d|\bP\.?O\.? Box\b/i.test(text), `${code} ${lang}: no fee amount or mailing address in the text`);
  }

  // The client's answers narrow the interpreter and preparer lines.
  const ids = (options) => buildPreflight(code, options).sections[0].items.map((i) => i.id).join();
  const interview = def.interview ? ',interview' : '';
  check(ids({}) === `applicant,interpreter,preparer${interview}`, `${code}: unknown answers keep both conditional lines`);
  check(ids({ interpreter: 'No', preparer: 'No' }) === `applicant${interview}`, `${code}: "No" drops the interpreter and preparer lines`);
  check(/^Your interpreter signs/.test(buildPreflight(code, { interpreter: 'Yes' }).sections[0].items[1].text), `${code}: "Yes" states the interpreter line plainly`);
  check(/^If an interpreter/.test(buildPreflight(code, {}).sections[0].items[1].text), `${code}: unknown keeps "If an interpreter"`);

  // Another edition: no part, item or page numbers until they are re-read.
  const other = buildPreflight(code, { currentEdition: '01/01/99' });
  check(!other.editionVerified && !/Part \d|Item \d|page \d|Edition \d/.test(allText(other)), `${code}: unverified edition quotes no numbers`);
}

for (const lang of LANGS.slice(1)) {
  check(Object.keys(TEXT.en).join() === Object.keys(TEXT[lang]).join(), `${lang}: same strings as English`);
}
check(buildPreflight('I-130') === null, 'a form without a sheet returns null');

(async () => {
  const call = (query, method) => endpoint.handler({ httpMethod: method || 'GET', queryStringParameters: query });
  const ok = await call({ form: 'n-400', lang: 'es', interpreter: 'yes' });
  const body = JSON.parse(ok.body);
  check(ok.statusCode === 200 && body.ok && body.sheet.formCode === 'N-400' && body.sheet.lang === 'es', 'endpoint: sheet for n-400 in Spanish');
  check((await call({ form: 'I-130' })).statusCode === 404, 'endpoint: 404 for a form without a sheet');
  check((await call({ form: 'I-485' }, 'POST')).statusCode === 405, 'endpoint: GET only');

  if (!pdfChecked) console.log('NOTE pdftotext not found: numbers were not re-read from the form PDFs');
  if (failures) {
    console.log(`USCIS preflight QA: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`USCIS preflight QA: OK (${PREFLIGHT_FORMS.length} forms, ${LANGS.length} languages, ${pdfChecked} form PDFs re-read)`);
})();
