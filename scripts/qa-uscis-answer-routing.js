// Every wizard answer must land in a field the form itself says is for that
// item and that person. The form's own tooltips are the reference: an
// applicant's phone in "Interpreter's Daytime Telephone Number" fails here.
//
// How: build full fictional answers from the wizard schema, change one answer
// at a time, see which PDF fields change, and read those fields' tooltips.
// Covers every map except the large hand-built ones listed in OWN_QA.
// Run: node scripts/qa-uscis-answer-routing.js   (add --report for coverage)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'netlify/functions/lib');
const PDF_DIR = path.join(ROOT, 'assets/form-cache/pdfs');
const { buildImmigrationFlow } = require(path.join(LIB, 'immigration-flow-schema'));
const { parsePdf, extractFieldObjects, extractQualifiedFieldObjects } = require(path.join(LIB, 'pdf-incremental-fill'));
const manifest = require(path.join(ROOT, 'netlify/functions/form-cache-manifest.json'));
const catalog = require(path.join(ROOT, 'netlify/functions/forms/immigration.json'));

// Large hand-built maps with their own QA; their internal field names are not
// described by tooltips, so the tooltip rules below would misjudge them.
const OWN_QA = ['i485-pdf-map.js', 'n400-pdf-map.js', 'i765-pdf-map.js', 'i589-pdf-map.js', 'i864-pdf-map.js', 'i751-pdf-map.js', 'i131-pdf-map.js', 'i140-pdf-map.js', 'i9-pdf-map.js', 'g1650-pdf-map.js'];
const ALIASES = { g845supplement: 'g845s-pdf-map.js', i485supplementa: 'i485a-pdf-map.js', i485supplementj: 'i485j-pdf-map.js' };
const compact = (code) => String(code).toLowerCase().replace(/[^a-z0-9]/g, '');
const mapFile = (code) => ALIASES[compact(code)] || `${compact(code)}-pdf-map.js`;

function pdfPath(code) {
  const file = fs.readdirSync(PDF_DIR).find((name) => compact(name.replace(/\.pdf$/, '')) === compact(code));
  return file ? path.join(PDF_DIR, file) : null;
}

// Tooltips by short name and by full name: maps address a field by its full
// name when the form gives several fields the same short one.
function tooltips(code) {
  const out = {};
  const parsed = parsePdf(fs.readFileSync(pdfPath(code)));
  for (const [name, obj] of [...extractFieldObjects(parsed), ...extractQualifiedFieldObjects(parsed)]) {
    if (out[name] !== undefined) continue;
    const match = String(obj.body || '').match(/\/TU\s*\(((?:\\.|[^\\)])*)\)/);
    let text = match ? match[1].replace(/\\([()\\])/g, '$1').replace(/\\[rn]/g, ' ') : '';
    if (/^(þÿ|þÿ)/.test(text)) text = text.replace(/^(þÿ|þÿ)/, '').split('').filter((_, i) => i % 2 === 1).join('');
    out[name] = text.replace(/\s+/g, ' ');
  }
  return out;
}

const optionValue = (o) => (o && typeof o === 'object' ? String(o.value ?? o.label ?? '') : String(o ?? ''));
function sample(field) {
  const id = String(field.id || '');
  const type = field.type || 'text';
  const options = (field.options || []).map(optionValue).filter(Boolean);
  if (type === 'addressHistory') return [{ line1: '2200 Main Street', line2: 'Apt 5', city: 'Tacoma', state: 'WA', zip: '98402', country: 'United States', from: '2019-11-01', to: '2021-01-01' }];
  if (type === 'employmentHistory') return [{ name: 'NORTHWEST PARCEL LLC', company: 'NORTHWEST PARCEL LLC', occupation: 'DRIVER', line1: '100 Industry Drive', city: 'Tacoma', state: 'WA', zip: '98421', country: 'United States', from: '2020-11-02', to: '2023-12-08' }];
  if (type === 'travelHistory') return [{ country: 'Ukraine', departureDate: '2022-01-10', returnDate: '2022-01-25', reason: 'Family visit' }];
  if (type === 'select' || type === 'radio') return options.find((o) => /^yes$/i.test(o)) || options[0] || 'Yes';
  if (type === 'checkbox' || type === 'checkboxes') return [options[0] || 'Yes'];
  if (type === 'date' || /date/i.test(id)) return '1990-06-15';
  if (type === 'email' || /email/i.test(id)) return 'client@example.com';
  if (type === 'phone' || /phone|telephone|mobile/i.test(id)) return '9165550142';
  if (type === 'number') return '2';
  if (/alien|a_number/i.test(id)) return '123456789';
  if (/account/i.test(id)) return '987654321012';
  if (/i94/i.test(id)) return '12345678901';
  if (/ssn|social_security/i.test(id)) return '555112222';
  if (/zip|postal/i.test(id)) return '95814';
  return `Q${id.replace(/[^a-z0-9]/gi, '').slice(0, 14)}`.toUpperCase();
}
function changed(field, value) {
  const options = (field.options || []).map(optionValue).filter(Boolean);
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === 'object') return value.map((entry) => Object.fromEntries(Object.entries(entry).map(([k, x]) => [k, /^\d{4}-/.test(x) ? x.replace(/^\d{4}/, '1987') : `ZZ${x}`])));
    return [options.find((o) => !value.includes(o))].filter(Boolean);
  }
  if (field.type === 'select' || field.type === 'radio') return options.find((o) => o !== value) || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return '1987-03-22';
  if (/^\d+$/.test(value)) return value.split('').map((d) => String((Number(d) + 3) % 10)).join('');
  if (/@/.test(value)) return 'other@example.org';
  return `ZZ${value}`;
}

function collect(flow) {
  const answers = {};
  const fields = {};
  for (const step of flow.steps || []) {
    for (const field of step.fields || []) {
      if (!field.id || fields[field.id]) continue;
      if (field.type === 'addressBlock' && field.parts) {
        const address = { line1: '456 Test Street', line2: 'Apt 5', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' };
        for (const [part, key] of Object.entries(field.parts)) {
          if (key && address[part] !== undefined) { answers[key] = address[part]; fields[key] = { id: key, type: 'text' }; }
        }
        continue;
      }
      answers[field.id] = sample(field);
      fields[field.id] = field;
    }
  }
  return { answers, fields };
}

const OTHER_PERSON_KEY = /spouse|child|parent|mother|father|petitioner|beneficiary|immigrant|sponsor|employer|interpreter|preparer|prior|former|joint|household|relative|member|attorney|representative|sibling|fiance|derivative|dependent|contact_/i;
const OTHER_PERSON_TIP = /\b(Spouse|Child(ren)?|Parent|Mother|Father|Beneficiary|Employer|Marriage Broker|Sponsor|Household Member|Relative|Derivative|Attorney|Representative|Sibling|Fianc)/i;
// On Forms I-134 and I-134A the person answering is the supporter, whose
// sections are titled "the Individual Agreeing to Financially Support the
// Beneficiary".
const OWN_SECTION_TIP = /About You\b|Your Full|Your (Mailing|Physical)|Your \(the |Applicant's|Petitioner's Contact|Client|pre-?populate|Individual Agreeing to (Financially )?Support/i;
const ITEM_RULES = [
  [/(^|_)date_of_birth$|(^|_)dob$/, /Date of Birth/i, /DateOfBirth|DOB/i],
  [/country_of_birth$/, /Country of (Your )?Birth|Place of Birth\. (Enter )?Country/i, /CountryOfBirth/i],
  [/(^|_)ssn$|social_security/, /Social Security/i, /SSN|SocialSecurity/i],
  [/alien_number$|(^|_)a_number$/, /Alien|A\.? ?-? ?Number/i, /Alien|ANumber/i],
  [/email(_address)?$/, /E-?mail/i, /Email/i],
  [/(daytime_|mobile_)?phone$|telephone/, /Telephone|Phone/i, /Phone|Telephone|Mobile/i],
  [/(_|^)zip$/, /ZIP|Postal/i, /Zip|Postal/i],
  [/passport_number$/, /Passport|Travel Document/i, /Passport/i]
];

// A field the form sets aside for one kind of person takes only answers about
// that kind of person, whoever the form's main person is.
const ROLE_RULES = [
  ['an attorney or representative', /Attorney or Accredited Representative|Attorney State Bar/i, /attorney|representative|g28/i],
  ['a parent', /Information About (Your )?(Parent|Father|Mother)|Parent [12]\b|Father's|Mother's|Parent's/i, /parent|mother|father/i],
  ['a child', /Child [1-9]\b|Information About Your Child|Children of/i, /child|son|daughter/i],
  ['an employer', /Employer|Employment History/i, /employ|company|job|occupation|work|business|school/i]
];

function judge(key, field, tip) {
  // Answers that pick which parts of the form apply (who files for whom)
  // switch whole sections on and off.
  if (/^(has_|applicant_statement|i134_filing_for$|i134a_filing_under$)/.test(key)) return [];
  const problems = [];
  // "Applicant's, Parent's, or Legal Guardian's" names whoever signs the form,
  // not a parent's own section.
  const signerSection = /Legal Guardian/i.test(tip);
  for (const [who, tipRe, keyRe] of ROLE_RULES) {
    if (tipRe.test(tip) && !keyRe.test(key) && !(signerSection && who === 'a parent')) problems.push(`lands in a field about ${who}`);
  }
  // I-134 names the preparer's name fields "P4_Line1_Interpreter..." and gives
  // them no tooltip; on the page they sit under Part 7, the preparer's part.
  const misnamedPreparer = /^P4_Line1_Interpreter(Family|Given)Name\[0\]$/.test(field) && !tip && /preparer/i.test(key);
  const interpreter = !misnamedPreparer && (/interpret/i.test(tip) || /Interpret/i.test(field));
  const preparer = /prepar/i.test(tip) || /Prepar/i.test(field);
  const statementField = /NameofRepresentative|RepresentativeName/i.test(field);
  if (/Signature/i.test(field) && !/Date/i.test(field) && !/Date of Signature/i.test(tip)) problems.push('types into a signature field');
  if (interpreter && !preparer && !/interpreter/i.test(key) && !/language/i.test(key)) problems.push("lands in the interpreter's section");
  if (preparer && !interpreter && !/preparer/i.test(key) && !statementField) problems.push("lands in the preparer's section");
  if (/interpreter/i.test(key) && tip && !interpreter && !/language/i.test(key)) problems.push('interpreter answer outside the interpreter section');
  if (/preparer/i.test(key) && tip && !preparer && !statementField) problems.push('preparer answer outside the preparer section');
  if (!OTHER_PERSON_KEY.test(key) && tip && !interpreter && !preparer && !OWN_SECTION_TIP.test(tip)) {
    const other = tip.match(OTHER_PERSON_TIP);
    if (other) problems.push(`lands in a field about: ${other[0]}`);
  }
  for (const [keyRe, tipRe, nameRe] of ITEM_RULES) {
    if (!keyRe.test(key)) continue;
    // The tooltip decides when there is one: internal field names mislead
    // (I-821 calls its date-of-marriage field "DateOfBirth").
    if (!(tip ? tipRe.test(tip) : nameRe.test(field))) problems.push(`the form does not call this field ${String(tipRe).replace(/^\/|\/i$/g, '')}`);
    break;
  }
  return problems;
}

// A fill-in for the interpreter or the preparer must never fall back to the
// applicant's own phone, e-mail, name or address (the language of the
// applicant's statement is the interpreter's language, so that one is fine).
// Many fields have no tooltip, so this is read from the map's source.
const HELPER_FALLBACK = /a\.(interpreter|preparer)_\w+\s*\|\|\s*(?:a\.(?:interpreter|preparer)_\w+\s*\|\|\s*)*(?:a\.(?:mobile|daytime|phone|email|applicant_(?!statement)|mailing|physical|given|family|address|city|state|zip)\w*|c\.\w+)/;

const REPORT = process.argv.includes('--report');
const failures = [];
const rows = [];
let checked = 0;
for (const form of (manifest.forms || []).filter((f) => f.agency === 'uscis' && f.cacheStatus === 'cached')) {
  const code = String(form.code).toUpperCase();
  const file = mapFile(code);
  const mapPath = path.join(LIB, file);
  if (!fs.existsSync(mapPath) || !pdfPath(code)) continue;
  const source = fs.readFileSync(mapPath, 'utf8');
  const generated = /incrementalFillPdf: _unused/.test(source);
  source.split('\n').forEach((line, index) => {
    if (HELPER_FALLBACK.test(line)) failures.push(`${code}: ${file}:${index + 1} gives the interpreter or preparer the applicant's own data`);
  });
  const mod = require(mapPath);
  const build = Object.values(mod).find((v) => typeof v === 'function' && /fieldvalues/i.test(v.name)) || Object.values(mod).find((v) => typeof v === 'function');
  const entry = (catalog.forms || []).find((f) => String(f.code).toUpperCase() === code) || {};
  const { answers, fields } = collect(buildImmigrationFlow(code, entry, form));
  const payload = (a) => ({ formCode: code, formType: code, formAnswers: a, answers: a, contact: { name: 'Contact Person', phone: '9160000001', email: 'contact@example.net' } });
  const base = build(payload(answers)) || {};
  const tips = tooltips(code);
  let used = 0;
  for (const key of Object.keys(answers)) {
    const next = build(payload({ ...answers, [key]: changed(fields[key], answers[key]) })) || {};
    const touched = [...new Set([...Object.keys(base), ...Object.keys(next)])].filter((f) => JSON.stringify(base[f]) !== JSON.stringify(next[f]));
    if (touched.length) used += 1;
    if (OWN_QA.includes(file)) continue;
    for (const field of touched) {
      for (const problem of judge(key, field, tips[field] || '')) failures.push(`${code}: ${key} -> ${field}: ${problem}`);
    }
  }
  if (!OWN_QA.includes(file)) checked += 1;
  rows.push({ code, asked: Object.keys(answers).length, used, fields: Object.keys(base).length, kind: generated ? 'auto' : 'hand' });
}

// Forms repaired after clients' answers were found missing from the PDF:
// with the sample answers each must keep filling at least this many fields.
const FIELD_FLOOR = {
  'I-90': 50, 'AR-11': 19, 'I-130': 110, 'I-130A': 63, 'I-821D': 33, 'I-821': 30, 'I-912': 27, 'I-539': 28,
  'N-600': 40, 'I-864A': 23, 'I-134': 75, 'I-134A': 100, 'N-565': 23, 'I-129F': 24
};
for (const [code, floor] of Object.entries(FIELD_FLOOR)) {
  const row = rows.find((r) => r.code === code);
  if (!row) failures.push(`${code}: map or PDF missing`);
  else if (row.fields < floor) failures.push(`${code}: only ${row.fields} PDF fields filled from the wizard's answers (at least ${floor} expected)`);
}

if (REPORT) {
  console.log('form       asked  reach the PDF  fields filled  map');
  for (const r of rows) console.log(r.code.padEnd(10), String(r.asked).padStart(5), String(r.used).padStart(14), String(r.fields).padStart(14), ' ', r.kind);
}
if (failures.length) {
  failures.forEach((f) => console.log(`FAIL ${f}`));
  console.log(`USCIS answer routing QA: ${failures.length} wrongly routed answer(s)`);
  process.exit(1);
}
console.log(`USCIS answer routing QA: OK (${checked} maps checked against the forms' tooltips)`);
