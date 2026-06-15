#!/usr/bin/env node
'use strict';
/**
 * Contract QA for the I-765 PDF map (Application for Employment Authorization).
 *
 * Locks the applicant-field placement, US phone formatting, the Apt/Ste/Flr
 * unit-type marker, and — critically — that the SIGNATURE DATE is never
 * pre-stamped with today's date (the client dates the form when they sign).
 * Uses the shared canonical fixture so this test and qa-form-fixtures.js stay
 * in agreement.
 *
 *   node scripts/qa-i765-pdf-map.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { i765FieldValues } = require('../netlify/functions/lib/i765-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const fx = require('../tests/fixtures/test-i-765.json');
const v = i765FieldValues({ formAnswers: fx.formAnswers, contact: fx.contact || {} });

// 1. End-to-end fill against the real (raw USCIS) PDF — zero skips.
const pdf = fs.readFileSync(path.resolve(__dirname, '../assets/form-cache/pdfs/i-765.pdf'));
const res = incrementalFillPdf(pdf, v, []);
assert.strictEqual(res.skippedFields.length, 0, `I-765 fill skipped fields: ${JSON.stringify(res.skippedFields)}`);
assert.ok(res.filledFields.length >= 25, `I-765 expected >= 25 filled fields, got ${res.filledFields.length}`);

// 2. Applicant identity in the correct boxes.
assert.strictEqual(v['Line1a_FamilyName[0]'], 'Kovalenko', 'Applicant family name');
assert.strictEqual(v['Line1b_GivenName[0]'], 'Oksana', 'Applicant given name');
assert.strictEqual(v['Line1c_MiddleName[0]'], 'M', 'Applicant middle name');
assert.strictEqual(v['Line7_AlienNumber[0]'], '241567890', 'A-Number');
assert.strictEqual(v['Line18c_CountryOfBirth[0]'], 'Ukraine', 'Country of birth');

// 3. DOB formatted MM/DD/YYYY.
assert.strictEqual(v['Line19_DOB[0]'], '03/15/1990', 'DOB formatted MM/DD/YYYY');

// 4. Apt/Ste/Flr: number filled AND unit TYPE marked APT (not left blank).
assert.strictEqual(v['Pt2Line5_AptSteFlrNumber[0]'], '5', 'Unit number filled');
assert.strictEqual(v['Pt2Line5_Unit[0]'], 'APT', 'Unit TYPE must be marked APT');

// 5. US phone in USCIS format (xxx) xxx-xxxx.
assert.strictEqual(v['Pt3Line3_DaytimePhoneNumber1[0]'], '(916) 399-3992', 'US phone in USCIS format');

// 6. REGRESSION GUARD: the signature date must NOT be pre-stamped with today.
//    The client dates the form when they physically sign it.
assert.ok(!v['Pt3Line7b_DateofSignature[0]'], 'Signature date must stay blank, never auto-filled with today');

console.log(`I-765 PDF map QA passed: ${res.filledFields.length} fields filled, 0 skipped; signature date left blank`);
