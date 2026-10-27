// FL-150 review (arithmetic, consistency, attachments) on invented answers,
// plus the plain labels the portal shows instead of "$" / "Last month".
// Run: node scripts/qa-fl150-review.js
const { reviewFl150, MESSAGES } = require('../netlify/functions/lib/fl150-review');
const { getDirectCourtSchema } = require('../netlify/functions/lib/ca-court-direct-schema');
const formReview = require('../netlify/functions/form-review');

let failures = 0;
function check(ok, label) {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}

const R = 'FL-150[0].';
const p = (page, rest) => `${R}Page${page}[0].${rest}`;
const keys = (issues) => issues.map((issue) => `${issue.key}:${issue.item}`);

// A consistent declaration: $25/hour x 40 h = $4,333/month, expenses add up.
const clean = {
  [p(1, 'List1[0].Li1[0].Employer_tf[0]')]: 'TEST LOGISTICS INC',
  [p(1, 'List1[0].Li7[0].hours_tf[0]')]: '40',
  [p(1, 'List1[0].Li8[0].gross_tf[0]')]: '25',
  [p(1, 'List1[0].Li8[0].Gross_cb[2]')]: true,
  [p(1, 'List3[0].Li1[0].FillText109[0]')]: '2025',
  [p(1, 'List3[0].Li2[0].Tax_cb1[0]')]: true,
  [p(1, 'FillText56[0]')]: 'QA TESTER',
  [p(1, 'Signdate[0]')]: '10/27/2026',
  [p(1, 'FillTextpage[0]')]: '4',
  [p(2, 'List5[0].Li1[0].FillText1[0]')]: '4,300',
  [p(2, 'List5[0].Li1[0].TextField7[0]')]: '$4,333',
  [p(3, 'List13[0].MonthEx_cb[1]')]: true,
  [p(3, 'List13[0].Li1[0].List[0].L1[0].EXPN[0]')]: '1800',
  [p(3, 'List13[0].Li1[0].List[0].L1[0].List[0].L1[0].MortPrin[0]')]: '600',
  [p(3, 'List13[0].Li1[0].List[0].L1[0].List[0].L2[0].MortInt[0]')]: '900',
  [p(3, 'List13[0].Li4[0].EXPN[0]')]: '600',
  [p(3, 'List13[0].Li16[0].EXPN[0]')]: '350',
  [p(3, 'List14[0].L1[0].TextField1[0]')]: 'TEST AUTO FINANCE',
  [p(3, 'List14[0].L1[0].FillText1[0]')]: '350',
  [p(3, 'List13[0].Li18[0].TOTAL[0]')]: '2,750'
};
const cleanIssues = reviewFl150(clean, 'en');
check(JSON.stringify(keys(cleanIssues)) === JSON.stringify(['attachPayStubs:5']), `consistent declaration: only the pay stubs reminder (${keys(cleanIssues)})`);

// Errors: weekly pay vs 5a, missing average, total off, 13p vs item 14, box without text, timeshare.
const broken = {
  ...clean,
  [p(1, 'List1[0].Li8[0].Gross_cb[2]')]: false,
  [p(1, 'List1[0].Li8[0].Gross_cb[1]')]: true,
  [p(1, 'List1[0].Li8[0].gross_tf[0]')]: '1500',
  [p(2, 'List5[0].Li3[0].FillText1[0]')]: '200',
  [p(2, 'List9[0].L1[0].CheckBox1[0]')]: true,
  [p(3, 'List13[0].Li18[0].TOTAL[0]')]: '3,000',
  [p(3, 'List13[0].Li16[0].EXPN[0]')]: '',
  [p(4, 'List16[0].L2[0].TextField[0]')]: '60',
  [p(4, 'List16[0].L2[0].TextField1[0]')]: '30'
};
const brokenIssues = reviewFl150(broken, 'en');
const brokenKeys = keys(brokenIssues);
for (const expected of ['wagesMismatch:5a', 'averageMissing:5c', 'boxWithoutText:9', 'expenseTotalMismatch:13r', 'installments:13p', 'timeshare:16b']) {
  check(brokenKeys.includes(expected), `broken declaration flags ${expected}`);
}
const mismatch = brokenIssues.find((issue) => issue.key === 'wagesMismatch');
check(mismatch && /\$6,500/.test(mismatch.text) && /\$4,333/.test(mismatch.text), 'weekly pay converts to $6,500 a month');
const total = brokenIssues.find((issue) => issue.key === 'expenseTotalMismatch');
check(total && /\$2,400/.test(total.text), 'total excludes a(1)(a) and (b) and a missing 13p');

// Every message exists in all four languages; Russian output is Russian.
for (const [key, byLang] of Object.entries(MESSAGES)) {
  check(['en', 'ru', 'uk', 'es'].every((lang) => byLang[lang]), `message ${key} in 4 languages`);
}
check(reviewFl150(broken, 'ru').every((issue) => /[а-яё]/i.test(issue.text)), 'Russian review text');
check(reviewFl150(broken, 'xx')[0].text === brokenIssues[0].text, 'unknown language falls back to English');

// The endpoint needs a session and returns nothing for forms without a review.
(async () => {
  const unauth = await formReview.handler({ httpMethod: 'POST', headers: { origin: 'https://example.org' }, body: '{}' });
  check(unauth.statusCode === 403, 'review endpoint refuses anonymous requests from other sites');

  const schema = await getDirectCourtSchema('fl-150', 'FL-150');
  const labels = schema.steps.flatMap((step) => step.fields.map((field) => field.label));
  check(!labels.some((label) => /^(\$|Last month|Average monthly|Total|Amount per month)$/.test(label)), 'portal shows no bare "$" / "Last month" labels');
  check(labels.includes('13r. TOTAL EXPENSES, items a-q (do not add a(1)(a) and (b)) ($)'), 'item 13r label');

  console.log(failures ? `${failures} failed` : 'FL-150 review QA passed');
  process.exit(failures ? 1 : 0);
})();
