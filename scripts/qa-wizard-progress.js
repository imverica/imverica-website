'use strict';
/**
 * QA — calculateWizardProgress (requirement-based wizard progress).
 *
 * Spec cases:
 *   - hidden fields not counted
 *   - conditional fields counted only when active
 *   - uploads / acknowledgements affect progress
 *   - changing answers updates progress (and can move it backwards)
 *   - 100% only when every required visible item is complete
 *
 * Run:  node scripts/qa-wizard-progress.js   (exit 0 = pass)
 */
// The file lives under astro-site (type:module), so Node parses it as ESM and
// the UMD falls through to the globalThis branch — read it from there.
require('../astro-site/public/assets/js/wizard-progress.js');
const calc = globalThis.calculateWizardProgress;

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log('  ✓', label); pass++; }
  else { console.error('  ✗', label, '\n      expected', e, '\n      got     ', a); fail++; }
}

const schema = {
  steps: [
    { title: 'Identity', fields: [
      { id: 'family_name', label: 'Family name', type: 'text', required: true },
      { id: 'given_name', label: 'Given name', type: 'text', required: true },
      { id: 'middle_name', label: 'Middle name', type: 'text' } // optional
    ]},
    { title: 'Status', fields: [
      { id: 'has_ssn', label: 'Do you have an SSN?', type: 'radio', required: true,
        options: ['Yes', 'No'] },
      { id: 'ssn', label: 'SSN', type: 'text', required: true,
        showWhen: [{ id: 'has_ssn', equals: 'Yes' }] }
    ]},
    { title: 'Documents', fields: [
      { id: 'passport_upload', label: 'Passport scan', type: 'file', required: true },
      { id: 'truth_ack', label: 'I confirm the information is accurate', type: 'checkbox', required: true }
    ]},
    { title: 'Hidden step', fields: [
      { id: 'parole_details', label: 'Parole details', type: 'text', required: true,
        showWhen: [{ id: 'status', equals: 'parolee' }] }
    ]}
  ]
};

console.log('\n=== calculateWizardProgress QA ===\n');

// 1. Empty: conditional SSN hidden (has_ssn unset → equals fails), hidden step
//    invisible → required = family, given, has_ssn, upload, ack = 5.
let r = calc(schema, {});
eq(r.totalRequiredItems, 5, 'hidden + skipped-conditional fields are NOT counted');
eq(r.completedRequiredItems, 0, 'nothing completed at start');
eq(r.percent, 0, '0% at start');
eq(r.totalVisibleSteps, 3, 'fully-hidden step is not a visible step');

// 2. Conditional activates: has_ssn=Yes adds the SSN requirement (5 → 6).
r = calc(schema, { has_ssn: 'Yes' });
eq(r.totalRequiredItems, 6, 'conditional field counted only when its condition is active');
eq(r.completedRequiredItems, 1, 'the answered radio counts as complete');

// 3. Changing the answer back: has_ssn=No removes SSN again (6 → 5) —
//    progress can move backwards in absolute terms.
r = calc(schema, { has_ssn: 'No' });
eq(r.totalRequiredItems, 5, 'changing an answer updates the requirement set');
eq(r.percent, 20, '1 of 5 = 20%');

// 4. Optional field never affects progress.
r = calc(schema, { has_ssn: 'No', middle_name: 'Q' });
eq(r.percent, 20, 'optional fields do not move progress');

// 5. Uploads + acknowledgements count.
r = calc(schema, { has_ssn: 'No', passport_upload: ['passport.pdf'], truth_ack: true });
eq(r.completedRequiredItems, 3, 'upload (array) and acknowledgement (boolean) count');

// 6. Object values (phone/address) count when any part is filled.
const schema2 = { steps: [{ title: 'P', fields: [
  { id: 'phone', label: 'Phone', type: 'phone', required: true }
]}]};
eq(calc(schema2, { phone: { areaCode: '', number: '' } }).completedRequiredItems, 0, 'empty object value is not complete');
eq(calc(schema2, { phone: { areaCode: '916', number: '3993992' } }).completedRequiredItems, 1, 'filled object value is complete');

// 7. 100% only when everything required is complete.
r = calc(schema, {
  family_name: 'Kovalenko', given_name: 'Oksana',
  has_ssn: 'Yes', ssn: '123456789',
  passport_upload: ['scan.pdf'], truth_ack: true
});
eq(r.percent, 100, '100% when every required visible item is complete');
eq(r.missingItems.length, 0, 'no missing items at 100%');

// 8. One missing keeps it under 100 and names the item.
r = calc(schema, {
  family_name: 'Kovalenko', given_name: 'Oksana',
  has_ssn: 'Yes', passport_upload: ['scan.pdf'], truth_ack: true
});
eq(r.percent < 100, true, 'missing required item keeps progress under 100%');
eq(r.missingItems.map(m => m.id), ['ssn'], 'missingItems names exactly the unanswered field');

// 9. Whitespace-only strings are not complete.
eq(calc(schema, { family_name: '   ' }).completedRequiredItems, 0, 'whitespace-only value is not complete');

// 10. currentStep / totalVisibleSteps reflect visible steps only.
r = calc(schema, { has_ssn: 'Yes' }, { pageIndex: 2 });
eq(r.currentStep, 3, 'currentStep is 1-based among visible steps');
eq(r.totalVisibleSteps, 3, 'totalVisibleSteps excludes hidden steps');

console.log(`\n=== Passed: ${pass}  Failed: ${fail} ===\n`);
process.exit(fail ? 1 : 0);
