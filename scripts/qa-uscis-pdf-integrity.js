const fs = require("fs");
const path = require("path");

const { incrementalFillPdf } = require("../netlify/functions/lib/pdf-incremental-fill");

const root = process.cwd();
const pdfDir = path.join(root, "assets/form-cache/pdfs");
const mapDir = path.join(root, "netlify/functions/lib");

const manualExceptions = new Set([
  "g-1055.pdf"
]);

const knownVisualRisk = new Set([
  "i-360.pdf"
]);

const aliases = {
  g845supplement: "g845s-pdf-map.js",
  i485supplementa: "i485a-pdf-map.js",
  i485supplementj: "i485j-pdf-map.js"
};

const payload = {
  formAnswers: {
    applicant_family_name: "Smith",
    applicant_given_name: "John",
    applicant_middle_name: "Michael",
    family_name: "Smith",
    given_name: "John",
    middle_name: "Michael",
    petitioner_family_name: "Smith",
    petitioner_given_name: "John",
    beneficiary_family_name: "Doe",
    beneficiary_given_name: "Maria",
    date_of_birth: "01/01/1990",
    dob: "01/01/1990",
    alien_number: "123456789",
    a_number: "123456789",
    uscis_online_account_number: "987654321",
    ssn: "555112222",
    social_security_number: "555112222",
    mailing_address_line1: "456 New Street",
    mailing_city: "Sacramento",
    mailing_state: "CA",
    mailing_zip: "95815",
    current_address_line1: "456 New Street",
    address_line1: "456 New Street",
    city: "Sacramento",
    state: "CA",
    zip_code: "95815",
    country_of_birth: "Ukraine",
    country_of_citizenship: "Ukraine",
    passport_number: "AB123456",
    i94_number: "12345678901",
    daytime_phone: "9165551212",
    mobile_phone: "9165551212",
    phone: "9165551212",
    email_address: "john@example.com",
    email: "john@example.com",
    eligibility_category_code: "c9",
    sex: "male",
    gender: "male",
    marital_status: "single",
    signature: "John Smith"
  },
  contact: {
    name: "John Smith",
    phone: "9165551212",
    email: "john@example.com"
  }
};

function compactName(file) {
  return file.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function isUscisCompact(code) {
  return /^(ar|g|i|n)[0-9]/.test(code);
}

function mapFileFor(compact) {
  return aliases[compact] || `${compact}-pdf-map.js`;
}

function loadMapFunction(mapPath) {
  delete require.cache[require.resolve(mapPath)];
  const mod = require(mapPath);
  const fn =
    Object.values(mod).find(value => typeof value === "function" && /fieldvalues/i.test(value.name)) ||
    Object.values(mod).find(value => typeof value === "function");

  if (!fn) throw new Error("No FieldValues function exported");
  return fn;
}

const pdfFiles = fs.readdirSync(pdfDir)
  .filter(file => file.toLowerCase().endsWith(".pdf"))
  .map(file => ({ file, compact: compactName(file) }))
  .filter(item => isUscisCompact(item.compact))
  .sort((a, b) => a.file.localeCompare(b.file));

const results = [];

for (const item of pdfFiles) {
  const pdfPath = path.join(pdfDir, item.file);
  const mapFile = mapFileFor(item.compact);
  const mapPath = path.join(mapDir, mapFile);

  const resultItem = {
    form: item.file,
    mapFile,
    status: "UNKNOWN",
    mappedFields: 0,
    checkboxes: 0,
    filledFields: 0,
    skippedFields: 0
  };

  try {
    if (!fs.existsSync(mapPath)) {
      resultItem.status = "MISSING_MAP";
      results.push(resultItem);
      continue;
    }

    const buildFieldValues = loadMapFunction(mapPath);
    const fieldValues = buildFieldValues(payload);
    const keys = Object.keys(fieldValues);

    resultItem.mappedFields = keys.length;
    resultItem.checkboxes = Object.values(fieldValues).filter(v => typeof v === "boolean").length;

    if (manualExceptions.has(item.file)) {
      resultItem.status = "MANUAL_XFA_EXCEPTION";
      results.push(resultItem);
      continue;
    }

    if (keys.length === 0) {
      resultItem.status = "EMPTY_MAP";
      results.push(resultItem);
      continue;
    }

    const inputPdf = fs.readFileSync(pdfPath);
    const filled = incrementalFillPdf(inputPdf, fieldValues);

    resultItem.filledFields = filled.filledFields.length;
    resultItem.skippedFields = filled.skippedFields.length;
    resultItem.skippedFieldNames = filled.skippedFields;

    if (!Buffer.isBuffer(filled.buffer) || filled.buffer.slice(0, 5).toString("latin1") !== "%PDF-") {
      resultItem.status = "BAD_OUTPUT_PDF";
    } else if (filled.skippedFields.length > 0) {
      resultItem.status = "SKIPPED_FIELDS";
    } else if (knownVisualRisk.has(item.file)) {
      resultItem.status = "VISUAL_RISK_MANUAL_REVIEW";
    } else {
      resultItem.status = "OK";
    }

    results.push(resultItem);
  } catch (error) {
    resultItem.status = "ERROR";
    resultItem.error = error.message;
    results.push(resultItem);
  }
}

const counts = results.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  return acc;
}, {});

fs.mkdirSync(path.join(root, "qa-reports"), { recursive: true });
fs.writeFileSync(
  path.join(root, "qa-reports/uscis-pdf-integrity.json"),
  JSON.stringify(results, null, 2)
);

console.log("");
console.log("USCIS PDF INTEGRITY QA");
console.log("======================");
console.log("Total USCIS PDFs:", results.length);
console.log("OK:", counts.OK || 0);
console.log("VISUAL_RISK_MANUAL_REVIEW:", counts.VISUAL_RISK_MANUAL_REVIEW || 0);
console.log("MANUAL_XFA_EXCEPTION:", counts.MANUAL_XFA_EXCEPTION || 0);
console.log("EMPTY_MAP:", counts.EMPTY_MAP || 0);
console.log("MISSING_MAP:", counts.MISSING_MAP || 0);
console.log("SKIPPED_FIELDS:", counts.SKIPPED_FIELDS || 0);
console.log("ERROR:", counts.ERROR || 0);
console.log("BAD_OUTPUT_PDF:", counts.BAD_OUTPUT_PDF || 0);
console.log("");
console.log("Report saved to: qa-reports/uscis-pdf-integrity.json");

const problemStatuses = new Set([
  "EMPTY_MAP",
  "MISSING_MAP",
  "SKIPPED_FIELDS",
  "ERROR",
  "BAD_OUTPUT_PDF"
]);

const problems = results.filter(item => problemStatuses.has(item.status));

if (problems.length) {
  console.log("");
  console.log("PROBLEMS:");
  for (const item of problems) {
    console.log(`${item.status}: ${item.form} mapped=${item.mappedFields} filled=${item.filledFields} skipped=${item.skippedFields}`);
  }
  process.exit(1);
}

console.log("");
console.log("PASS: No hard failures. Manual review items are separated.");
