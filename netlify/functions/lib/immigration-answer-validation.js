'use strict';

function answerBag(payload = {}) {
  return payload.formAnswers || payload.answers || payload || {};
}

function parseDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function yearsBetween(earlier, later) {
  let years = later.getUTCFullYear() - earlier.getUTCFullYear();
  const beforeAnniversary = later.getUTCMonth() < earlier.getUTCMonth()
    || (later.getUTCMonth() === earlier.getUTCMonth() && later.getUTCDate() < earlier.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return years;
}

function validateDate(errors, answers, id, label, options = {}) {
  const value = answers[id];
  if (!value) return null;
  const date = parseDate(value);
  if (!date) {
    errors.push({ field: id, message: `${label} must be a valid date.` });
    return null;
  }
  const today = dateOnly(new Date());
  if (options.notFuture !== false && date > today) errors.push({ field: id, message: `${label} cannot be in the future.` });
  if (options.after) {
    const afterDate = parseDate(answers[options.after]);
    if (afterDate && date < afterDate) errors.push({ field: id, message: `${label} cannot be earlier than ${options.afterLabel || options.after}.` });
  }
  return date;
}

function historyRows(value) {
  return Array.isArray(value) ? value.filter(row => row && typeof row === 'object' && Object.values(row).some(Boolean)) : [];
}

function validateHistory(errors, rows, id, label, options = {}) {
  const today = dateOnly(new Date());
  const periods = [];
  rows.forEach((row, index) => {
    const from = parseDate(row.from);
    const to = row.to ? parseDate(row.to) : (index === 0 && options.allowCurrent ? today : null);
    if (!from || !to) {
      errors.push({ field: id, message: `${label} entry ${index + 1} needs valid From and To dates${options.allowCurrent && index === 0 ? ' (the current entry may leave To blank)' : ''}.` });
      return;
    }
    if (from > to) errors.push({ field: id, message: `${label} entry ${index + 1} starts after it ends.` });
    if (from > today || to > today) errors.push({ field: id, message: `${label} entry ${index + 1} cannot use a future date.` });
    periods.push({ from, to, index });
  });

  periods.sort((left, right) => right.to - left.to);
  for (let index = 0; index < periods.length - 1; index += 1) {
    const newer = periods[index];
    const older = periods[index + 1];
    if (older.to > newer.from) {
      errors.push({ field: id, message: `${label} entries ${newer.index + 1} and ${older.index + 1} overlap.` });
      continue;
    }
    const gapDays = Math.floor((newer.from - older.to) / 86400000) - 1;
    if (gapDays > 31) errors.push({ field: id, message: `${label} has an unexplained gap of ${gapDays} days.` });
  }
}

function validateN400(answers) {
  const errors = [];
  const today = dateOnly(new Date());
  const spouseBases = new Set([
    'Spouse of U.S. Citizen',
    'Spouse of U.S. Citizen in Qualified Employment Outside the United States'
  ]);
  const spouseBasis = spouseBases.has(answers.basis_for_naturalization);
  const spouseApplies = spouseBasis || ['Married', 'Separated'].includes(answers.marital_status);

  if (spouseBasis && answers.n400_spouse_basis_marital_confirmation !== 'Yes, I am currently married to this U.S. citizen') {
    errors.push({ field: 'n400_spouse_basis_marital_confirmation', message: 'A spouse-of-U.S.-citizen filing basis requires confirmation of the current marriage.' });
  }
  if (!spouseBasis && !answers.marital_status) {
    errors.push({ field: 'marital_status', message: 'Current marital status is required.' });
  }

  const dob = validateDate(errors, answers, 'date_of_birth', 'Date of birth');
  if (dob && yearsBetween(dob, today) < 18) errors.push({ field: 'date_of_birth', message: 'The N-400 applicant must be at least 18 years old for this wizard workflow.' });
  validateDate(errors, answers, 'green_card_date', 'Date lawful permanent residence began', { after: 'date_of_birth', afterLabel: 'date of birth' });
  validateDate(errors, answers, 'n400_current_address_from', 'Current-address start date', { after: 'date_of_birth', afterLabel: 'date of birth' });

  if (spouseApplies) {
    ['spouse_family_name', 'spouse_given_name', 'spouse_date_of_birth', 'current_marriage_date', 'times_married']
      .forEach((id) => {
        if (!answers[id]) errors.push({ field: id, message: 'Current-spouse information is required for the selected answers.' });
      });
    const spouseDob = validateDate(errors, answers, 'spouse_date_of_birth', 'Spouse date of birth');
    const marriageDate = validateDate(errors, answers, 'current_marriage_date', 'Current marriage date', { after: 'date_of_birth', afterLabel: 'applicant date of birth' });
    if (spouseDob && marriageDate && marriageDate < spouseDob) errors.push({ field: 'current_marriage_date', message: 'Current marriage date cannot be earlier than the spouse date of birth.' });
  }
  validateDate(errors, answers, 'n400_spouse_citizen_date', 'Date spouse became a U.S. citizen', { notFuture: true });

  const addressRows = historyRows(answers.addresses_last_five_years);
  const currentAddressFrom = parseDate(answers.n400_current_address_from);
  if (currentAddressFrom) addressRows.unshift({ from: answers.n400_current_address_from, to: today.toISOString().slice(0, 10) });
  validateHistory(errors, addressRows, 'addresses_last_five_years', 'Residence history');
  validateHistory(errors, historyRows(answers.employment_school_last_five_years), 'employment_school_last_five_years', 'Employment and school history', { allowCurrent: true });

  const applicantDob = parseDate(answers.date_of_birth);
  for (let number = 1; number <= Math.min(Number(answers.total_children_under_18 || 0), 3); number += 1) {
    const id = `n400_child${number}_dob`;
    const childDob = validateDate(errors, answers, id, `Child ${number} date of birth`);
    if (childDob && applicantDob && childDob <= applicantDob) errors.push({ field: id, message: `Child ${number} date of birth must be after the applicant date of birth.` });
    if (childDob && yearsBetween(childDob, today) >= 18) errors.push({ field: id, message: `Child ${number} is not under 18 and cannot be listed in this section.` });
  }

  return errors;
}

function validateImmigrationAnswers(formCode, payload = {}) {
  const code = String(formCode || '').trim().toUpperCase();
  const answers = answerBag(payload);
  if (code === 'N-400') return validateN400(answers);
  return [];
}

module.exports = { validateImmigrationAnswers, validateN400 };
