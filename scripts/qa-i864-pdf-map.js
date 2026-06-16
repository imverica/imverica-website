#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { i_864FieldValues } = require('../netlify/functions/lib/i864-pdf-map');
const { incrementalFillPdf } = require('../netlify/functions/lib/pdf-incremental-fill');

const pdf = fs.readFileSync(path.join(__dirname, '../assets/form-cache/pdfs/i-864.pdf'));

const common = {
  principal_immigrant_family_name: 'Kovalenko',
  principal_immigrant_given_name: 'Olena',
  principal_immigrant_middle_name: 'Ihorivna',
  principal_immigrant_mailing_address: { line1: '100 Main St', line2: 'Apt 5', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  principal_immigrant_country_of_citizenship: 'Ukraine',
  principal_immigrant_date_of_birth: '1988-03-15',
  principal_immigrant_alien_number: '123456789',
  principal_immigrant_uscis_online_account_number: '123456789012',
  principal_immigrant_daytime_phone: '9165550000',

  sponsor_family_name: 'Smith',
  sponsor_given_name: 'John',
  sponsor_middle_name: 'Allen',
  sponsor_mailing_address: { line1: '300 Capitol Mall', line2: 'Suite 100', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  sponsor_physical_same_as_mailing: 'No',
  sponsor_physical_address: { line1: '400 L St', line2: 'Floor 2', city: 'Sacramento', state: 'CA', zip: '95814', country: 'United States' },
  sponsor_date_of_birth: '1980-04-20',
  sponsor_country_of_birth: 'United States',
  sponsor_country_of_domicile: 'United States',
  sponsor_status: 'U.S. citizen',
  sponsor_ssn: '555001234',
  sponsor_uscis_online_account_number: '987654321012',
  sponsor_active_duty: 'No',

  i864_sponsor_principal_immigrant: 'Yes',
  i864_sponsored_family_timing: 'At the same time or within six months of the principal immigrant',
  i864_total_number_of_immigrants: '3',
  i864_family1_family_name: 'Kovalenko',
  i864_family1_given_name: 'Childone',
  i864_family1_relationship: 'Child',
  i864_family1_date_of_birth: '2015-01-02',
  i864_family1_alien_number: '123456780',
  i864_family1_uscis_online_account_number: '111111111111',
  i864_family2_family_name: 'Kovalenko',
  i864_family2_given_name: 'Childtwo',
  i864_family2_relationship: 'Child',
  i864_family2_date_of_birth: '2018-02-03',
  i864_family2_alien_number: '123456781',
  i864_additional_immigrants_details: 'No additional printed rows needed beyond the listed family members.',

  i864_household_spouse_count: '1',
  i864_household_dependent_children_count: '2',
  i864_household_other_dependents_count: '0',
  i864_household_other_sponsored_count: '0',
  i864_household_same_residence_count: '1',
  household_size: '5',
  sponsor_employment_statuses: ['Employed', 'Self-employed'],
  sponsor_occupation: 'Software engineer',
  sponsor_employer_name: 'Acme Inc.',
  sponsor_employer2_name: 'Side Project LLC',
  sponsor_self_employed_as: 'Consultant',
  current_annual_income: '$125,000',
  include_household_member_income: 'Yes',
  i864_household_income_person1_name: 'Jane Smith',
  i864_household_income_person1_relationship: 'Spouse',
  i864_household_income_person1_income: '$35,000',
  i864_total_household_income: '$160,000',
  i864_household_members_completed_i864a: 'Yes',
  i864_household_member_i864a_not_needed: 'Yes',
  i864_household_member_i864a_not_needed_name: 'Olena Kovalenko',
  i864_filed_three_recent_tax_returns: 'No',
  i864_not_required_to_file_taxes: 'Yes',
  i864_tax_not_filed_explanation: 'Sponsor was not required to file for one prior year because income was below the filing threshold.',
  i864_tax_year1: '2025',
  i864_tax_income1: '$120,000',
  i864_tax_year2: '2024',
  i864_tax_income2: '$115,000',
  i864_tax_year3: '2023',
  i864_tax_income3: '$110,000',
  i864_sponsor_cash_assets: '$20,000',
  i864_sponsor_real_estate_assets: '$50,000',
  i864_sponsor_stock_bond_assets: '$10,000',
  i864_sponsor_total_assets: '$80,000',
  i864_household_member_total_assets: '$5,000',
  i864_immigrant_cash_assets: '$2,000',
  i864_immigrant_real_estate_assets: '$0',
  i864_immigrant_stock_bond_assets: '$0',
  i864_immigrant_total_assets: '$2,000',
  i864_total_value_assets: '$87,000',

  i864_sponsor_statement: 'An interpreter read every question and instruction to me',
  i864_sponsor_statement_language: 'Ukrainian',
  daytime_phone: '9165551212',
  mobile_phone: '9165553434',
  email_address: 'sponsor@example.com',
  has_interpreter: 'Yes',
  has_preparer: 'Yes',
  interpreter_family_name: 'Shevchenko',
  interpreter_given_name: 'Maria',
  interpreter_business_name: 'Imverica',
  interpreter_daytime_phone: '9165557777',
  interpreter_mobile_phone: '9165557778',
  interpreter_email: 'interpreter@example.com',
  interpreter_language: 'Ukrainian',
  preparer_family_name: 'Taylor',
  preparer_given_name: 'Alex',
  preparer_business_name: 'Imverica Legal Solutions',
  preparer_daytime_phone: '9165558888',
  preparer_mobile_phone: '9165558889',
  preparer_email: 'preparer@example.com',
  i864_additional_information: 'Additional I-864 notes for Part 11.'
};

function renderScenario(name, answers, assertions) {
  const values = i_864FieldValues({ formAnswers: answers });
  const generated = incrementalFillPdf(pdf, values);
  assert.strictEqual(generated.skippedFields.length, 0, `${name}: skipped fields: ${generated.skippedFields.join(', ')}`);
  assertions(values);
  assert(!Object.keys(values).some((field) => /Signature|DateofSignature/i.test(field)), `${name}: draft generation must not fill signature/date fields`);
  return generated.filledFields.length;
}

const petitionerFilled = renderScenario('petitioner', {
  ...common,
  i864_sponsor_basis: '1.a. I am the petitioner. I filed or am filing for the immigration of my relative.'
}, (values) => {
  assert.strictEqual(values['P1_Line1a-f_CB[0]'], true);
  assert.strictEqual(values['P2_Line1a_FamilyName[0]'], 'Kovalenko');
  assert.strictEqual(values['P2_Line4_DateOfBirth[0]'], '03/15/1988');
  assert.strictEqual(values['P2_Line2_AptSteFlrNumber[0]'], '5');
  assert.strictEqual(values['P4_Line11a_Checkbox[0]'], true);
  assert.strictEqual(values['P3_Line2_SponsoringFamily[0]'], true);
  assert.strictEqual(values['P3_Line3a_FamilyName[0]'], 'Kovalenko');
  assert.strictEqual(values['P5_Line2_Yourself[0]'], '1');
  assert.strictEqual(values['P6_Line1_Checkbox[0]'], true);
  assert.strictEqual(values['P6_Line4_Checkbox[0]'], true);
  assert.strictEqual(values['P6_Line17_IWasNotReq[0]'], true);
  assert.strictEqual(values['P8_Line3_DaytimeTelephoneNumber[0]'], '9165551212');
  assert.strictEqual(values['P9_Line4_InterpretersDaytimePhoneNumber[0]'], '9165557777');
  assert.strictEqual(values['P10_Line1a_PreparersFamilyName[0]'], 'Taylor');
  assert.strictEqual(values['P11_Line3b_PartNumber[0]'], '4');
});

const jointFilled = renderScenario('joint-sponsor', {
  ...common,
  i864_sponsor_basis: '1.e. I am the first or second of two joint sponsors.',
  i864_joint_sponsor_number: 'Second joint sponsor',
  sponsor_status: 'Lawful permanent resident',
  sponsor_alien_number: '987654321',
  i864_sponsored_family_timing: 'More than six months after the principal immigrant',
  i864_sponsor_statement: 'I can read and understand English, and I have read and understand every question and instruction',
  has_interpreter: 'No',
  has_preparer: 'No'
}, (values) => {
  assert.strictEqual(values['P1_Line1a-f_CB[4]'], true);
  assert.strictEqual(values['P1_Line1e1_Checkbox[1]'], true);
  assert.strictEqual(values['P4_Line11c_Checkbox[0]'], true);
  assert.strictEqual(values['P4_Line12_AlienNumber[0]'], '987654321');
  assert.strictEqual(values['P3_Line2_SponsoringFamily[1]'], true);
  assert.strictEqual(values['P6_Line1_Checkbox[1]'], true);
});

console.log(`I-864 PDF map QA passed: petitioner ${petitionerFilled} fields; joint sponsor ${jointFilled} fields; 0 skipped`);
