const fs = require("fs");
const path = require("path");

const { incrementalFillPdf } = require("./lib/pdf-incremental-fill");

function normalizeFormCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function mapFileName(formCode) {
  const compact = normalizeFormCode(formCode)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const aliases = {
    g845supplement: "g845s-pdf-map.js",
    i485supplementa: "i485a-pdf-map.js",
    i485supplementj: "i485j-pdf-map.js"
  };

  return aliases[compact] || compact + "-pdf-map.js";
}

function pdfFileName(formCode) {
  return normalizeFormCode(formCode)
    .toLowerCase() + ".pdf";
}

function findPdfPath(formCode) {
  const normalized = normalizeFormCode(formCode).toLowerCase();

  const candidates = [
    path.join(process.cwd(), "assets/form-cache/pdfs", normalized + ".pdf"),
    path.join(process.cwd(), "assets/form-cache/pdfs", normalized.replace(/-/g, "") + ".pdf")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const dir = path.join(process.cwd(), "assets/form-cache/pdfs");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const compact = normalized.replace(/[^a-z0-9]/g, "");

  const match = files.find(file =>
    file.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/pdf$/, "") === compact
  );

  if (match) return path.join(dir, match);

  return null;
}

function findMap(formCode) {
  const file = mapFileName(formCode);
  const mapPath = path.join(process.cwd(), "netlify/functions/lib", file);

  if (!fs.existsSync(mapPath)) {
    throw new Error("PDF map not found: " + file);
  }

  const mod = require(mapPath);

  const fn =
    Object.values(mod).find(value => typeof value === "function" && /fieldvalues/i.test(value.name)) ||
    Object.values(mod).find(value => typeof value === "function");

  if (!fn) {
    throw new Error("No FieldValues function exported from: " + file);
  }

  return fn;
}

exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: "Method Not Allowed"
      };
    }

    const payload = JSON.parse(event.body || "{}");
    const formCode = normalizeFormCode(payload.formType || payload.formCode || payload.code);

    if (!formCode) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing formType or formCode" })
      };
    }

    const pdfPath = findPdfPath(formCode);

    if (!pdfPath) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "PDF template not found",
          formCode
        })
      };
    }

    const buildFieldValues = findMap(formCode);
    const inputPdf = fs.readFileSync(pdfPath);
    const fieldValues = buildFieldValues(payload);
    const result = incrementalFillPdf(inputPdf, fieldValues);

    console.log("PDF RESULT", {
      formCode,
      pdf: pdfPath,
      mappedFields: Object.keys(fieldValues).length,
      filled: result.filledFields?.length,
      skipped: result.skippedFields?.length,
      skippedFields: result.skippedFields
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${formCode}-filled.pdf`,
        "Cache-Control": "no-store"
      },
      body: result.buffer.toString("base64"),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error("PDF GENERATION ERROR", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "PDF generation failed",
        message: error.message
      })
    };
  }
};
