// Court forms in the portal: every label override points at a real field,
// and no field is left with a bare tooltip such as "$", "Zip", "Other",
// "(specify):" or "Yes" on the forms that have overrides.
// Run: node scripts/qa-court-field-labels.js
const { getDirectCourtSchema } = require('../netlify/functions/lib/ca-court-direct-schema');
const { COURT_FIELD_LABELS, fieldKey } = require('../netlify/functions/lib/court-field-labels');

const UNCLEAR = /^(\$|Total|Amount|Last month|Average monthly|Name|Date|Yes|No|Other|Zip|To:?|at|to|a\.|b\.|c\.|d\.|e\.|\(specify\):?|specify|Field.*|Text.*)$/i;

(async () => {
  let failures = 0;
  for (const slug of Object.keys(COURT_FIELD_LABELS)) {
    const schema = await getDirectCourtSchema(slug, slug.toUpperCase());
    const fields = schema.steps.flatMap((step) => step.fields);
    const ids = new Set(fields.map((field) => fieldKey(field.id)));
    const unused = Object.keys(COURT_FIELD_LABELS[slug]).filter((key) => !ids.has(key));
    const unclear = fields.filter((field) => UNCLEAR.test(field.label.trim()) || field.label.trim().length < 4);
    if (unused.length || unclear.length) {
      failures += 1;
      console.log(`FAIL ${slug}: ${unused.length} labels without a field (${unused.slice(0, 2).join(', ')}), ${unclear.length} unclear (${unclear.slice(0, 2).map((field) => `${fieldKey(field.id)}="${field.label}"`).join(', ')})`);
    }
  }
  console.log(failures ? `${failures} forms failed` : `Court field labels QA passed (${Object.keys(COURT_FIELD_LABELS).length} forms)`);
  process.exit(failures ? 1 : 0);
})();
