'use strict';

// Date checks on the histories USCIS forms ask for: where the applicant lived
// and worked during the required period (I-485: 5 years; N-400: 5 years, 3
// for the spouse-of-a-U.S.-citizen basis) and, for N-400, the trips outside
// the United States. Only dates are compared (gaps, overlaps, order, coverage,
// day counts); every result is something to double-check, never advice.
//
// Rows come from the wizard's history fields: addresses and jobs are
// { from, to, ... } with ISO dates (an empty "to" means "present"); trips are
// { from, to, country, days }.

const DAY = 24 * 60 * 60 * 1000;
const SLACK_DAYS = 31; // a move or job change within a month is not a gap

const MESSAGES = {
  dateOrder: {
    en: '{what} {n}: the "to" date ({to}) is before the "from" date ({from}).',
    ru: '{what} {n}: дата «по» ({to}) раньше даты «с» ({from}).',
    uk: '{what} {n}: дата «по» ({to}) раніше за дату «з» ({from}).',
    es: '{what} {n}: la fecha "hasta" ({to}) es anterior a la fecha "desde" ({from}).'
  },
  future: {
    en: '{what} {n}: the date {date} is in the future.',
    ru: '{what} {n}: дата {date} ещё не наступила.',
    uk: '{what} {n}: дата {date} ще не настала.',
    es: '{what} {n}: la fecha {date} es futura.'
  },
  missingFrom: {
    en: '{what} {n}: the "from" date is blank.',
    ru: '{what} {n}: не указана дата «с».',
    uk: '{what} {n}: не вказано дату «з».',
    es: '{what} {n}: falta la fecha "desde".'
  },
  startsLate: {
    en: '{list} starts on {first}, but the form asks for the {years} years since {start}. Add what came before, or check the dates.',
    ru: '{list} начинается {first}, а форма просит {years} лет — с {start}. Добавьте более ранний период или проверьте даты.',
    uk: '{list} починається {first}, а форма просить {years} років — з {start}. Додайте ранніший період або перевірте дати.',
    es: '{list} empieza el {first}, pero el formulario pide los últimos {years} años, desde el {start}. Agregue lo anterior o revise las fechas.'
  },
  gap: {
    en: '{list}: nothing is listed from {from} to {to} ({days} days).',
    ru: '{list}: с {from} по {to} ничего не указано ({days} дн.).',
    uk: '{list}: з {from} по {to} нічого не вказано ({days} дн.).',
    es: '{list}: no hay nada entre el {from} y el {to} ({days} días).'
  },
  overlap: {
    en: '{list}: two entries overlap from {from} to {to} ({days} days).',
    ru: '{list}: две записи пересекаются с {from} по {to} ({days} дн.).',
    uk: '{list}: два записи перетинаються з {from} по {to} ({days} дн.).',
    es: '{list}: dos entradas se superponen del {from} al {to} ({days} días).'
  },
  sameAddressButMoved: {
    en: 'You answered that you lived at the same address for 5 years, but the move-in date is {date}.',
    ru: 'Вы ответили, что живёте по одному адресу 5 лет, но дата въезда — {date}.',
    uk: 'Ви відповіли, що живете за однією адресою 5 років, але дата в’їзду — {date}.',
    es: 'Respondió que vive en la misma dirección desde hace 5 años, pero la fecha de mudanza es {date}.'
  },
  employmentGapNote: {
    en: 'The form asks you to list unemployment, school and self-employment too, so the {years} years have no gaps.',
    ru: 'Форма просит указывать и периоды без работы, учёбу и самозанятость, чтобы в {years} годах не было пробелов.',
    uk: 'Форма просить вказувати й періоди без роботи, навчання та самозайнятість, щоб у {years} роках не було прогалин.',
    es: 'El formulario pide incluir también el desempleo, los estudios y el trabajo por cuenta propia, para que los {years} años no tengan huecos.'
  },
  tripDays: {
    en: 'Trip {n} ({country}): {from} to {to} is {computed} days, but {days} days are written.',
    ru: 'Поездка {n} ({country}): с {from} по {to} — это {computed} дн., а указано {days}.',
    uk: 'Поїздка {n} ({country}): з {from} по {to} — це {computed} дн., а вказано {days}.',
    es: 'Viaje {n} ({country}): del {from} al {to} son {computed} días, pero se anotaron {days}.'
  },
  tripLong: {
    en: 'Trip {n} ({country}) lasted {days} days, more than 6 months.',
    ru: 'Поездка {n} ({country}) длилась {days} дн. — больше 6 месяцев.',
    uk: 'Поїздка {n} ({country}) тривала {days} дн. — понад 6 місяців.',
    es: 'El viaje {n} ({country}) duró {days} días, más de 6 meses.'
  },
  tripOverlap: {
    en: 'Trips {a} and {b} overlap ({from} to {to}).',
    ru: 'Поездки {a} и {b} пересекаются ({from} — {to}).',
    uk: 'Поїздки {a} і {b} перетинаються ({from} — {to}).',
    es: 'Los viajes {a} y {b} se superponen ({from} al {to}).'
  },
  tripTotal: {
    en: 'Trips in the last {years} years add up to {days} days outside the United States.',
    ru: 'Поездки за последние {years} лет в сумме дают {days} дн. за пределами США.',
    uk: 'Поїздки за останні {years} років разом дають {days} дн. поза межами США.',
    es: 'Los viajes de los últimos {years} años suman {days} días fuera de Estados Unidos.'
  }
};

const LISTS = {
  addresses: { en: 'Address history', ru: 'История адресов', uk: 'Історія адрес', es: 'Historial de domicilios' },
  employment: { en: 'Employment and school history', ru: 'История работы и учёбы', uk: 'Історія роботи й навчання', es: 'Historial de empleo y estudios' },
  address: { en: 'Address', ru: 'Адрес', uk: 'Адреса', es: 'Domicilio' },
  job: { en: 'Job or school', ru: 'Работа или учёба', uk: 'Робота чи навчання', es: 'Empleo o estudio' },
  trip: { en: 'Trip', ru: 'Поездка', uk: 'Поїздка', es: 'Viaje' }
};

function parseDate(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(time) ? time : null;
}

function fmt(time) {
  const d = new Date(time);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function yearsBefore(time, years) {
  const d = new Date(time);
  return Date.UTC(d.getUTCFullYear() - years, d.getUTCMonth(), d.getUTCDate());
}

function rows(value) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : [];
}

function makeAdder(issues, lang) {
  return (kind, key, values = {}) => {
    const text = MESSAGES[key][lang].replace(/\{(\w+)\}/g, (_, name) => (name in values ? values[name] : `{${name}}`));
    issues.push({ kind, item: values.item || '', key, text });
  };
}

// Checks one list of periods against the required window.
function checkPeriods({ periods, today, years, listName, rowName, item, add, lang }) {
  const start = yearsBefore(today, years);
  const valid = [];
  for (const period of periods) {
    const what = rowName[lang];
    if (period.from === null) {
      if (period.hasContent) add('check', 'missingFrom', { what, n: period.n, item });
      continue;
    }
    if (period.from > today) add('check', 'future', { what, n: period.n, date: fmt(period.from), item });
    if (period.rawTo !== null && period.rawTo > today) add('check', 'future', { what, n: period.n, date: fmt(period.rawTo), item });
    if (period.to < period.from) {
      add('check', 'dateOrder', { what, n: period.n, from: fmt(period.from), to: fmt(period.to), item });
      continue;
    }
    valid.push(period);
  }
  const inWindow = valid.filter((period) => period.to >= start).sort((a, b) => a.from - b.from);
  if (!inWindow.length) return { gaps: 0 };
  const list = listName[lang];
  let gaps = 0;
  if (inWindow[0].from > start + SLACK_DAYS * DAY) {
    add('check', 'startsLate', { list, first: fmt(inWindow[0].from), years, start: fmt(start), item });
    gaps += 1;
  }
  let reach = inWindow[0].to;
  for (const period of inWindow.slice(1)) {
    const gapDays = Math.round((period.from - reach) / DAY);
    if (gapDays > SLACK_DAYS) {
      add('check', 'gap', { list, from: fmt(Math.max(reach, start)), to: fmt(period.from), days: gapDays, item });
      gaps += 1;
    }
    const overlapEnd = Math.min(reach, period.to);
    const overlapDays = Math.round((overlapEnd - period.from) / DAY);
    if (overlapDays > SLACK_DAYS) add('check', 'overlap', { list, from: fmt(period.from), to: fmt(overlapEnd), days: overlapDays, item });
    reach = Math.max(reach, period.to);
  }
  const tailGap = Math.round((today - reach) / DAY);
  if (tailGap > SLACK_DAYS) {
    add('check', 'gap', { list, from: fmt(reach), to: fmt(today), days: tailGap, item });
    gaps += 1;
  }
  return { gaps };
}

function toPeriods(list, today, startN = 1) {
  return list.map((row, index) => {
    const from = parseDate(row.from);
    const rawTo = parseDate(row.to);
    const hasContent = Object.values(row).some((value) => String(value || '').trim());
    return { n: startN + index, from, rawTo, to: rawTo === null ? today : rawTo, hasContent };
  }).filter((period) => period.hasContent);
}

function reviewI485(answers, add, lang, today) {
  const years = 5;
  const moveIn = parseDate(answers.date_moved_in);
  const sameFiveYears = String(answers.same_address_five_years || '').trim() === 'Yes';
  if (sameFiveYears && moveIn !== null && moveIn > yearsBefore(today, years) + SLACK_DAYS * DAY) {
    add('check', 'sameAddressButMoved', { date: fmt(moveIn), item: 'Part 1, Item 18' });
  }
  if (!sameFiveYears) {
    const prior = [...rows(answers.prior_us_addresses), ...rows(answers.last_foreign_address)];
    const periods = toPeriods(prior, today, 2);
    if (moveIn !== null) periods.unshift({ n: 1, from: moveIn, rawTo: null, to: today, hasContent: true });
    checkPeriods({ periods, today, years, listName: LISTS.addresses, rowName: LISTS.address, item: 'Part 1, Item 18', add, lang });
  }
  const jobs = [...rows(answers.current_employment_history), ...rows(answers.foreign_employment_history)];
  if (jobs.length) {
    const result = checkPeriods({ periods: toPeriods(jobs, today), today, years, listName: LISTS.employment, rowName: LISTS.job, item: 'Part 4, Item 7', add, lang });
    if (result.gaps) add('check', 'employmentGapNote', { years, item: 'Part 4, Item 7' });
  }
}

function n400Years(answers) {
  return String(answers.basis_for_naturalization || '').trim() === 'Spouse of U.S. Citizen' ? 3 : 5;
}

function reviewN400(answers, add, lang, today) {
  const years = n400Years(answers);
  const currentFrom = parseDate(answers.n400_current_address_from);
  const periods = toPeriods(rows(answers.addresses_last_five_years), today, 2);
  if (currentFrom !== null) periods.unshift({ n: 1, from: currentFrom, rawTo: null, to: today, hasContent: true });
  if (periods.length) {
    checkPeriods({ periods, today, years, listName: LISTS.addresses, rowName: LISTS.address, item: 'Part 4', add, lang });
  }
  const jobs = rows(answers.employment_school_last_five_years);
  if (jobs.length) {
    const result = checkPeriods({ periods: toPeriods(jobs, today), today, years, listName: LISTS.employment, rowName: LISTS.job, item: 'Part 7', add, lang });
    if (result.gaps) add('check', 'employmentGapNote', { years, item: 'Part 7' });
  }

  // Part 8: trips. Count calendar days between the dates the wizard stores.
  const trips = rows(answers.trips_outside_us)
    .map((row, index) => ({ n: index + 1, from: parseDate(row.from), to: parseDate(row.to), country: String(row.country || '').trim() || '—', days: Number(String(row.days || '').replace(/[^\d]/g, '')) || null }))
    .filter((trip) => trip.from !== null || trip.to !== null);
  const windowStart = yearsBefore(today, years);
  let total = 0;
  for (const trip of trips) {
    const what = LISTS.trip[lang];
    if (trip.from === null) { add('check', 'missingFrom', { what, n: trip.n, item: 'Part 8' }); continue; }
    if (trip.from > today) add('check', 'future', { what, n: trip.n, date: fmt(trip.from), item: 'Part 8' });
    if (trip.to === null) continue;
    if (trip.to > today) add('check', 'future', { what, n: trip.n, date: fmt(trip.to), item: 'Part 8' });
    if (trip.to < trip.from) { add('check', 'dateOrder', { what, n: trip.n, from: fmt(trip.from), to: fmt(trip.to), item: 'Part 8' }); continue; }
    const computed = Math.round((trip.to - trip.from) / DAY);
    if (trip.days !== null && Math.abs(trip.days - computed) > 1) {
      add('math', 'tripDays', { n: trip.n, country: trip.country, from: fmt(trip.from), to: fmt(trip.to), computed, days: trip.days, item: 'Part 8' });
    }
    if (computed > 182) add('check', 'tripLong', { n: trip.n, country: trip.country, days: computed, item: 'Part 8' });
    if (trip.to >= windowStart) total += Math.round((trip.to - Math.max(trip.from, windowStart)) / DAY);
  }
  const ordered = trips.filter((trip) => trip.from !== null && trip.to !== null && trip.to >= trip.from).sort((a, b) => a.from - b.from);
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const next = ordered[i];
    if (next.from < prev.to) add('check', 'tripOverlap', { a: prev.n, b: next.n, from: fmt(next.from), to: fmt(Math.min(prev.to, next.to)), item: 'Part 8' });
  }
  if (total > 0) add('info', 'tripTotal', { years, days: total, item: 'Part 8' });
}

const REVIEWERS = { 'I-485': reviewI485, 'N-400': reviewN400 };

function reviewHistory(formCode, answers = {}, lang = 'en', today = Date.now()) {
  const reviewer = REVIEWERS[String(formCode || '').toUpperCase()];
  if (!reviewer) return [];
  const language = MESSAGES.gap[lang] ? lang : 'en';
  const now = new Date(today);
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const issues = [];
  reviewer(answers || {}, makeAdder(issues, language), language, day);
  return issues;
}

module.exports = { reviewHistory, MESSAGES, HISTORY_FORMS: Object.keys(REVIEWERS) };
