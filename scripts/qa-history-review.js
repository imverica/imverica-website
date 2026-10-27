// Date checks for I-485 and N-400 histories (addresses, jobs, trips) and the
// /api/form-review endpoint. All answers are invented.
// Run: node scripts/qa-history-review.js
const { reviewHistory, MESSAGES } = require('../netlify/functions/lib/history-review');
const formReview = require('../netlify/functions/form-review');

let failures = 0;
function check(ok, label) {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}
const keys = (issues) => issues.map((issue) => issue.key);
const TODAY = Date.UTC(2026, 9, 27);

// I-485: continuous addresses and jobs for 5 years -> nothing to report.
const i485 = {
  same_address_five_years: 'No',
  date_moved_in: '2024-09-01',
  prior_us_addresses: [{ line1: '456 Example Ave', from: '2023-08-20', to: '2024-08-31' }],
  last_foreign_address: [{ line1: 'vul. Zrazkova 1', from: '2014-09-01', to: '2023-08-19' }],
  current_employment_history: [{ name: 'Sample State University', from: '2023-08-28', to: '' }],
  foreign_employment_history: [{ name: 'Sample City Library', from: '2019-09-01', to: '2023-07-31' }]
};
check(reviewHistory('I-485', i485, 'en', TODAY).length === 0, 'continuous I-485 history: no issues');

const gapped = { ...i485, prior_us_addresses: [{ line1: '456 Example Ave', from: '2023-08-20', to: '2024-03-31' }] };
const gap = reviewHistory('I-485', gapped, 'en', TODAY).find((issue) => issue.key === 'gap');
check(gap && /04\/01\/2024|03\/31\/2024/.test(gap.text) && /09\/01\/2024/.test(gap.text), 'I-485 address gap with dates');

const lateJobs = { ...i485, foreign_employment_history: [] };
const lateKeys = keys(reviewHistory('I-485', lateJobs, 'en', TODAY));
check(lateKeys.includes('startsLate') && lateKeys.includes('employmentGapNote'), 'I-485 jobs start after the 5-year window');

check(keys(reviewHistory('I-485', { same_address_five_years: 'Yes', date_moved_in: '2025-01-10' }, 'en', TODAY)).includes('sameAddressButMoved'), 'same address for 5 years contradicts move-in date');
check(keys(reviewHistory('I-485', { ...i485, prior_us_addresses: [{ line1: 'x', from: '2024-05-01', to: '2023-01-01' }] }, 'en', TODAY)).includes('dateOrder'), 'to before from');

// N-400: 3 years for a spouse of a U.S. citizen, 5 otherwise; trips.
const n400 = {
  basis_for_naturalization: 'Spouse of U.S. Citizen',
  n400_current_address_from: '2023-06-01',
  employment_school_last_five_years: [{ name: 'Sample Logistics', from: '2023-01-01', to: '' }],
  trips_outside_us: [
    { from: '2024-06-01', to: '2024-06-21', country: 'Ukraine', days: '20' },
    { from: '2025-01-01', to: '2025-08-15', country: 'Poland', days: '226' },
    { from: '2025-08-01', to: '2025-08-10', country: 'Mexico', days: '9' }
  ]
};
const spouse = reviewHistory('N-400', n400, 'en', TODAY);
check(!keys(spouse).includes('startsLate'), 'N-400 spouse basis: 3 years from 06/2023 covers the window');
check(keys(spouse).includes('tripLong') && keys(spouse).includes('tripOverlap') && !keys(spouse).includes('tripDays'), 'N-400 long and overlapping trips');
const general = reviewHistory('N-400', { ...n400, basis_for_naturalization: 'General Provision' }, 'en', TODAY);
check(keys(general).includes('startsLate'), 'N-400 general basis: 5 years required');
const wrongDays = reviewHistory('N-400', { ...n400, trips_outside_us: [{ from: '2024-06-01', to: '2024-06-21', country: 'Ukraine', days: '30' }] }, 'en', TODAY);
check(wrongDays.some((issue) => issue.key === 'tripDays' && /20 days/.test(issue.text)), 'trip day count mismatch');
check(reviewHistory('N-400', n400, 'ru', TODAY).every((issue) => /[а-яё]/i.test(issue.text)), 'Russian text');
for (const [key, byLang] of Object.entries(MESSAGES)) check(['en', 'ru', 'uk', 'es'].every((lang) => byLang[lang]), `message ${key} in 4 languages`);
check(reviewHistory('I-130', i485, 'en', TODAY).length === 0, 'forms without a reviewer return nothing');

(async () => {
  const call = (body, headers = {}) => formReview.handler({ httpMethod: 'POST', headers, body: JSON.stringify(body) });
  const foreign = await call({ formCode: 'N-400', formAnswers: n400 }, { origin: 'https://example.org' });
  check(foreign.statusCode === 403, 'anonymous requests from other sites are refused');
  const site = await call({ formCode: 'N-400', formAnswers: n400, lang: 'en' }, { origin: 'https://imverica.com' });
  const data = JSON.parse(site.body);
  check(site.statusCode === 200 && data.issues.some((issue) => issue.key === 'tripLong'), 'anonymous request from the site gets the review');
  console.log(failures ? `${failures} failed` : 'History review QA passed');
  process.exit(failures ? 1 : 0);
})();
