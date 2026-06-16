#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { validateN400 } = require('../netlify/functions/lib/immigration-answer-validation');

const base = {
  basis_for_naturalization: 'Spouse of U.S. Citizen',
  n400_spouse_basis_marital_confirmation: 'Yes, I am currently married to this U.S. citizen',
  date_of_birth: '1985-03-15',
  green_card_date: '2020-05-10',
  n400_current_address_from: '2024-01-01',
  addresses_last_five_years: [
    { from: '2021-01-01', to: '2023-12-31' },
    { from: '2019-01-01', to: '2020-12-31' }
  ],
  employment_school_last_five_years: [
    { name: 'Current employer', from: '2023-01-01', to: '' },
    { name: 'Prior employer', from: '2019-01-01', to: '2022-12-31' }
  ],
  spouse_family_name: 'Smith',
  spouse_given_name: 'Alex',
  spouse_date_of_birth: '1984-02-10',
  current_marriage_date: '2015-06-20',
  times_married: 1,
  total_children_under_18: 1,
  n400_child1_dob: '2012-08-01'
};

assert.deepStrictEqual(validateN400(base), [], 'Coherent spouse-basis N-400 answers should pass');

const missingMarriage = validateN400({ ...base, n400_spouse_basis_marital_confirmation: '' });
assert(missingMarriage.some(error => error.field === 'n400_spouse_basis_marital_confirmation'));

const impossibleDates = validateN400({
  ...base,
  green_card_date: '1980-01-01',
  current_marriage_date: '1980-01-01',
  spouse_date_of_birth: '1984-02-10'
});
assert(impossibleDates.some(error => error.field === 'green_card_date'));
assert(impossibleDates.some(error => error.field === 'current_marriage_date'));

const badHistory = validateN400({
  ...base,
  addresses_last_five_years: [
    { from: '2022-01-01', to: '2024-06-01' },
    { from: '2020-01-01', to: '2023-01-01' }
  ]
});
assert(badHistory.some(error => error.field === 'addresses_last_five_years' && /overlap/i.test(error.message)));

const adultChild = validateN400({ ...base, n400_child1_dob: '2000-01-01' });
assert(adultChild.some(error => error.field === 'n400_child1_dob' && /not under 18/i.test(error.message)));

console.log('N-400 consistency QA passed');
