const fs = require("fs");
const path = require("path");

const forms = fs.readFileSync("uscis-pdfs.txt", "utf8")
  .split(/\r?\n/)
  .map(x => x.trim())
  .filter(Boolean);

const aliases = {
  g845supplement: "G-845 Supplement",
  i485supplementa: "I-485 Supplement A",
  i485supplementj: "I-485 Supplement J"
};

function formCodeFromCompact(code) {
  if (aliases[code]) return aliases[code];
  if (code === "ar11") return "AR-11";
  if (/^[gin]\d/.test(code)) return code[0].toUpperCase() + "-" + code.slice(1).toUpperCase();
  return code.toUpperCase();
}

const outDir = "generated-uscis-api-tests";
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const results = [];

  for (const compact of forms) {
    const formType = formCodeFromCompact(compact);
    const outFile = path.join(outDir, `${compact}.pdf`);

    const payload = {
      formType,
      formAnswers: {
        applicant_family_name: "Smith",
        applicant_given_name: "John",
        applicant_middle_name: "Michael",
        date_of_birth: "01/01/1990",
        alien_number: "123456789",
        uscis_online_account_number: "987654321",
        ssn: "555112222",
        mailing_address_line1: "456 New Street",
        mailing_address_line2: "Apt 5",
        mailing_city: "Sacramento",
        mailing_state: "CA",
        mailing_zip: "95815",
        physical_same_as_mailing: "yes",
        city_of_birth: "Kyiv",
        country_of_birth: "Ukraine",
        country_of_citizenship: "Ukraine",
        daytime_phone: "9165551212",
        email_address: "john@example.com",
        eligibility_category_code: "c9",
        i765_application_reason: "initial",
        prior_ead: "no",
        sex: "male",
        marital_status: "single",
        applicant_statement: "english"
      },
      contact: {
        name: "John Smith",
        phone: "9165551212",
        email: "john@example.com"
      }
    };

    try {
      const response = await fetch("http://localhost:8889/.netlify/functions/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outFile, buffer);

      const isPdf = buffer.slice(0, 5).toString("latin1") === "%PDF-";
      const ok = response.ok && isPdf;

      results.push({
        formType,
        ok,
        status: response.status,
        bytes: buffer.length,
        file: outFile
      });

      console.log(`${ok ? "OK" : "FAIL"} ${formType} ${response.status} ${buffer.length}`);
    } catch (error) {
      results.push({
        formType,
        ok: false,
        status: "ERROR",
        error: error.message
      });

      console.log(`ERROR ${formType} ${error.message}`);
    }
  }

  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));

  const okCount = results.filter(r => r.ok).length;
  const failCount = results.length - okCount;

  console.log(`DONE: ${okCount} OK, ${failCount} failed`);
}

main();
