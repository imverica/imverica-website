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

function findPdfPath(formCode) {
  const normalized = normalizeFormCode(formCode).toLowerCase();
  const rootFromFunction = path.resolve(__dirname, "..", "..");
  const pdfDirs = [
    path.join(process.cwd(), "assets/form-cache/pdfs"),
    path.join(__dirname, "assets/form-cache/pdfs"),
    path.join(rootFromFunction, "assets/form-cache/pdfs")
  ];
  const names = [
    normalized + ".pdf",
    normalized.replace(/-/g, "") + ".pdf"
  ];
  const candidates = pdfDirs.flatMap(dir => names.map(name => path.join(dir, name)));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const compact = normalized.replace(/[^a-z0-9]/g, "");

  for (const dir of pdfDirs) {
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const match = files.find(file =>
      file.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/pdf$/, "") === compact
    );

    if (match) return path.join(dir, match);
  }

  return null;
}

function findMap(formCode) {
  const file = mapFileName(formCode);
  const rootFromFunction = path.resolve(__dirname, "..", "..");
  const candidates = [
    path.join(process.cwd(), "netlify/functions/lib", file),
    path.join(process.cwd(), "lib", file),
    path.join(__dirname, "lib", file),
    path.join(__dirname, "netlify/functions/lib", file),
    path.join(rootFromFunction, "netlify/functions/lib", file)
  ];
  const mapPath = candidates.find(candidate => fs.existsSync(candidate));

  if (!mapPath) {
    throw new Error("PDF map not found: " + file);
  }

  const mod = require(mapPath);

  const buildFieldValues =
    Object.values(mod).find(value => typeof value === "function" && /fieldvalues/i.test(value.name)) ||
    Object.values(mod).find(value => typeof value === "function");

  if (!buildFieldValues) {
    throw new Error("No FieldValues function exported from: " + file);
  }

  const buildTextOverlays =
    Object.values(mod).find(value => typeof value === "function" && /textoverlays/i.test(value.name)) ||
    (() => []);

  return { buildFieldValues, buildTextOverlays };
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

    const { buildFieldValues, buildTextOverlays } = findMap(formCode);
    const inputPdf = fs.readFileSync(pdfPath);
    const fieldValues = buildFieldValues(payload);
    const textOverlays = buildTextOverlays(payload);
    const result = incrementalFillPdf(inputPdf, fieldValues, textOverlays);

    console.log("PDF RESULT", {
      formCode,
      pdf: pdfPath,
      mappedFields: Object.keys(fieldValues).length,
      overlays: textOverlays.length,
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
