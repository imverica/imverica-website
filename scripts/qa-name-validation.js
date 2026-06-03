/**
 * QA — first/last name validation (server-side).
 *
 * Verifies the English-letters-only policy in netlify/functions/profile.js
 * across realistic inputs:
 *   - accepts normal English names + O'Brien / Jean-Luc / Jr.
 *   - rejects Cyrillic / accented Latin / digits / empty / leading punct
 *
 * Run: node scripts/qa-name-validation.js
 * Exit 0 = pass, 1 = fail.
 */

const path = require('path');

// Inline the same regex we use server- and client-side. Whenever you
// change one, change the others (profile.js, portal.html, account.html).
const NAME_ALLOWED = /^[A-Za-z][A-Za-z\s\-'.]*$/;
function validName(s) { return typeof s === 'string' && s.length > 0 && NAME_ALLOWED.test(s); }

const CASES = [
  // ---- ACCEPT ----
  { value: 'John', expect: true, why: 'plain ASCII first name' },
  { value: 'Mary',  expect: true, why: 'plain ASCII first name' },
  { value: 'Jean-Luc', expect: true, why: 'hyphenated compound name' },
  { value: "O'Brien", expect: true, why: 'apostrophe in surname' },
  { value: "D'Angelo", expect: true, why: 'apostrophe in surname' },
  { value: 'Mary Jane', expect: true, why: 'space-separated double first' },
  { value: 'Jr.', expect: true, why: 'suffix with dot' },
  { value: 'Anne Marie', expect: true, why: 'two-word given name' },

  // ---- REJECT — non-English script ----
  { value: 'Иван',  expect: false, why: 'Cyrillic — Russian' },
  { value: 'Олена', expect: false, why: 'Cyrillic — Ukrainian' },
  { value: 'José', expect: false, why: 'accented Latin' },
  { value: 'François', expect: false, why: 'accented Latin' },
  { value: 'Müller', expect: false, why: 'umlaut' },
  { value: '李雷', expect: false, why: 'CJK' },
  { value: 'محمد', expect: false, why: 'Arabic' },

  // ---- REJECT — bad characters ----
  { value: 'John1', expect: false, why: 'contains digit' },
  { value: 'John!', expect: false, why: 'contains punctuation' },
  { value: 'John@email', expect: false, why: 'contains @' },
  { value: '<script>', expect: false, why: 'XSS attempt' },

  // ---- REJECT — empty / whitespace / leading punct ----
  { value: '', expect: false, why: 'empty string' },
  { value: '   ', expect: false, why: 'whitespace only' },
  { value: "'Smith", expect: false, why: 'starts with apostrophe' },
  { value: '-John', expect: false, why: 'starts with hyphen' },
  { value: '.John', expect: false, why: 'starts with dot' },

  // ---- REJECT — non-strings ----
  { value: null, expect: false, why: 'null' },
  { value: undefined, expect: false, why: 'undefined' },
  { value: 123, expect: false, why: 'number' },
  { value: {}, expect: false, why: 'object' }
];

let pass = 0, fail = 0;
console.log('=== Name validation (English-letters-only policy) ===\n');
for (const c of CASES) {
  const got = validName(c.value);
  if (got === c.expect) {
    console.log(`  ✓ ${c.expect ? 'ACCEPT' : 'REJECT'}  ${JSON.stringify(c.value)}  — ${c.why}`);
    pass++;
  } else {
    console.error(`  ✗ Expected ${c.expect ? 'accept' : 'reject'} ${JSON.stringify(c.value)} but got ${got}  — ${c.why}`);
    fail++;
  }
}

console.log(`\n=== Result ===\nPassed: ${pass}\nFailed: ${fail}`);
if (fail > 0) process.exit(1);
console.log('All checks passed ✓');
