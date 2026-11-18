// Refresh netlify/functions/data/uscis-fees.json from the official USCIS
// Fee Schedule (G-1055). Needs access to www.uscis.gov (GitHub Actions has
// it). --print writes the JSON to stdout as well.
const fs = require('fs');
const path = require('path');
const { fetchUscisFees, FEE_FORMS } = require('../netlify/functions/lib/uscis-fees');

(async () => {
  const result = await fetchUscisFees();
  const out = path.join(__dirname, '..', 'netlify', 'functions', 'data', 'uscis-fees.json');
  const got = Object.keys(result.fees).length;
  for (const form of FEE_FORMS) {
    const fee = result.fees[form.code];
    console.error(fee ? `${form.code}: $${fee.paper} paper${fee.online !== null ? `, $${fee.online} online` : ''} (${fee.category})` : `${form.code}: not found`);
  }
  if (result.errors.length) console.error('errors:', result.errors.join('; '));
  if (got < FEE_FORMS.length / 2) {
    console.error(`only ${got} of ${FEE_FORMS.length} fees read; snapshot left unchanged`);
    process.exit(1);
  }
  const json = JSON.stringify({ checked: result.checked, source: result.source, fees: result.fees }, null, 2) + '\n';
  fs.writeFileSync(out, json);
  if (process.argv.includes('--print')) process.stdout.write(json);
  console.error(`wrote ${got} fees to ${path.relative(process.cwd(), out)}`);
})();
