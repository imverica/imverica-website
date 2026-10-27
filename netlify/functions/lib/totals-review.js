'use strict';

// Totals checks for forms whose lines add up to a printed total: FW-001
// (income, household income, monthly expenses), FL-142 (assets and debts),
// FL-160 (each asset's net value and division, the asset and debt totals)
// and I-864 (household size, household income, tax years). Only arithmetic;
// every result is something to double-check, never advice.
//
// Court forms arrive as PDF field values (keys from "PageN[0]." on are used);
// I-864 arrives as wizard answers.

const WORDS = {
  item: { en: 'Item', ru: 'Пункт', uk: 'Пункт', es: 'Punto' },
  part: { en: 'Part', ru: 'Часть', uk: 'Частина', es: 'Parte' },
  line: { en: 'line', ru: 'строка', uk: 'рядок', es: 'línea' },
  value: { en: 'value', ru: 'стоимость', uk: 'вартість', es: 'valor' },
  owed: { en: 'amount owed', ru: 'долг', uk: 'борг', es: 'deuda' },
  gross: { en: 'gross value', ru: 'рыночная стоимость', uk: 'ринкова вартість', es: 'valor bruto' },
  debt: { en: 'debt', ru: 'долг', uk: 'борг', es: 'deuda' },
  net: { en: 'net value', ru: 'чистая стоимость', uk: 'чиста вартість', es: 'valor neto' },
  pet: { en: 'to petitioner', ru: 'истцу', uk: 'позивачу', es: 'al peticionario' },
  res: { en: 'to respondent', ru: 'ответчику', uk: 'відповідачу', es: 'al demandado' }
};

const MESSAGES = {
  totalMismatch: {
    en: '{item}: the total shows {total}, but the lines add up to {sum}.',
    ru: '{item}: в итоге {total}, а строки в сумме дают {sum}.',
    uk: '{item}: у підсумку {total}, а рядки разом дають {sum}.',
    es: '{item}: el total dice {total}, pero las líneas suman {sum}.'
  },
  totalMissing: {
    en: '{item}: the total is blank; the lines add up to {sum}.',
    ru: '{item}: итог не заполнен; строки в сумме дают {sum}.',
    uk: '{item}: підсумок не заповнено; рядки разом дають {sum}.',
    es: '{item}: el total está en blanco; las líneas suman {sum}.'
  },
  amountWithoutLabel: {
    en: '{item}: an amount is entered without saying what it is for.',
    ru: '{item}: сумма указана, но не написано, за что она.',
    uk: '{item}: суму вказано, але не написано, за що вона.',
    es: '{item}: hay una cantidad sin indicar a qué corresponde.'
  },
  netMismatch: {
    en: '{item}: gross value {gross} minus debt {debt} is {net}, but the net value shows {shown}.',
    ru: '{item}: рыночная стоимость {gross} минус долг {debt} = {net}, а в чистой стоимости указано {shown}.',
    uk: '{item}: ринкова вартість {gross} мінус борг {debt} = {net}, а в чистій вартості вказано {shown}.',
    es: '{item}: el valor bruto {gross} menos la deuda {debt} es {net}, pero el valor neto dice {shown}.'
  },
  splitMismatch: {
    en: '{item}: the amounts to the petitioner ({pet}) and the respondent ({res}) add up to {sum}, not {total}.',
    ru: '{item}: суммы истцу ({pet}) и ответчику ({res}) дают {sum}, а не {total}.',
    uk: '{item}: суми позивачу ({pet}) і відповідачу ({res}) дають {sum}, а не {total}.',
    es: '{item}: las cantidades para el peticionario ({pet}) y el demandado ({res}) suman {sum}, no {total}.'
  },
  householdSize: {
    en: 'Household size: the people counted add up to {sum} (you, {immigrants} sponsored on this affidavit and the others listed), but the total shows {shown}.',
    ru: 'Размер семьи: учтённые люди дают {sum} (вы, {immigrants} спонсируемых по этой форме и остальные указанные), а в итоге {shown}.',
    uk: 'Розмір домогосподарства: враховані люди дають {sum} (ви, {immigrants} спонсорованих за цією формою та інші вказані), а в підсумку {shown}.',
    es: 'Tamaño del hogar: las personas contadas suman {sum} (usted, {immigrants} patrocinados en esta declaración y los demás indicados), pero el total dice {shown}.'
  },
  householdIncome: {
    en: 'Household income: your income {own} plus the household members listed ({others}) is {sum}, but the total shows {shown}.',
    ru: 'Доход семьи: ваш доход {own} плюс указанные члены семьи ({others}) = {sum}, а в итоге {shown}.',
    uk: 'Дохід домогосподарства: ваш дохід {own} плюс указані члени ({others}) = {sum}, а в підсумку {shown}.',
    es: 'Ingreso del hogar: su ingreso {own} más los miembros indicados ({others}) es {sum}, pero el total dice {shown}.'
  },
  taxYears: {
    en: 'Tax years: {years} should be the three most recent years in a row, newest first.',
    ru: 'Налоговые годы: {years} — должны быть три последних года подряд, начиная с самого свежего.',
    uk: 'Податкові роки: {years} — мають бути три останні роки поспіль, починаючи з найсвіжішого.',
    es: 'Años fiscales: {years} deben ser los tres años más recientes seguidos, empezando por el más reciente.'
  }
};

function amount(value) {
  if (value === undefined || value === null || value === true || value === false) return null;
  const text = String(value).replace(/[$,\s]/g, '');
  const match = text.match(/^-?\d+(?:\.\d+)?$/) || text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function money(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function filled(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalize(fields) {
  const result = {};
  for (const [name, value] of Object.entries(fields || {})) {
    result[String(name).replace(/^[^.]*\[0\]\./, '')] = value && typeof value === 'object' ? (value.radio || value.dropdown || '') : value;
  }
  return result;
}

// values.item is the form's item number ("8b"); values.note adds a localized
// column or line in parentheses; values.label replaces the whole "Item ..." text.
function makeAdder(issues, lang) {
  return (kind, key, values = {}) => {
    const itemText = values.label || (values.item ? `${WORDS.item[lang]} ${values.item}${values.note ? ` (${values.note})` : ''}` : '');
    const text = MESSAGES[key][lang].replace(/\{(\w+)\}/g, (_, name) => (name === 'item' ? itemText : name in values ? values[name] : `{${name}}`));
    issues.push({ kind, item: values.item || '', key, text });
  };
}

// Sum of lines against a printed total; returns the sum.
function checkTotal(f, add, item, lines, total, note) {
  const values = lines.map((id) => amount(f[id])).filter((value) => value !== null);
  const sum = values.reduce((a, b) => a + b, 0);
  const shown = amount(f[total]);
  if (values.length && shown === null) add('math', 'totalMissing', { item, note, sum: money(sum) });
  if (shown !== null && Math.abs(shown - sum) > 1) add('math', 'totalMismatch', { item, note, total: money(shown), sum: money(sum) });
  return sum;
}

// ---- FW-001 (Rev. March 1, 2026), page 2 ----
const FW = 'Page2[0].';
function reviewFw001(fields, add) {
  const f = normalize(fields);
  const income = [1, 2, 3, 4].map((n) => `${FW}List8[0].Lia[0].IncomeAmount${n}[0]`);
  const household = [1, 2, 3, 4].map((n) => `${FW}List9[0].Lia[0].HouseholdIncomeAmount${n}[0]`);
  const own = checkTotal(f, add, '8b', income, `${FW}List8[0].Lib[0].TotalIncome[0]`);
  const others = checkTotal(f, add, '9b', household, `${FW}List9[0].Lib[0].HouseholdTotalncome[0]`);
  const ownShown = amount(f[`${FW}List8[0].Lib[0].TotalIncome[0]`]);
  const othersShown = amount(f[`${FW}List9[0].Lib[0].HouseholdTotalncome[0]`]);
  const combined = (ownShown ?? own) + (othersShown ?? others);
  const combinedShown = amount(f[`${FW}List9[0].Lib[0].TotalAllIncome[0]`]);
  if (combinedShown !== null && Math.abs(combinedShown - combined) > 1) add('math', 'totalMismatch', { item: '8b + 9b', total: money(combinedShown), sum: money(combined) });
  if (combinedShown === null && combined > 0) add('math', 'totalMissing', { item: '8b + 9b', sum: money(combined) });
  [1, 2, 3, 4].forEach((n) => {
    if (amount(f[income[n - 1]]) && !filled(f[`${FW}List8[0].Lia[0].IncomeSource${n}[0]`])) add('check', 'amountWithoutLabel', { item: `8a(${n})` });
    if (amount(f[household[n - 1]]) && !filled(f[`${FW}List9[0].Lia[0].HouseholdIncomeName${n}[0]`])) add('check', 'amountWithoutLabel', { item: `9a(${n})` });
  });
  const L = `${FW}List11[0].`;
  const expenseLines = [
    ...[1, 2, 3, 4].map((n) => `${L}Lia[0].PayrollAmt${n}[0]`),
    `${L}Lib[0].ExpenseHousing[0]`, `${L}Lic[0].ExpenseFoodSupplies[0]`, `${L}Lid[0].ExpenseUtilitiesPhone[0]`, `${L}Lie[0].ExpenseClothes[0]`,
    `${L}Lif[0].ExpenseLaundry[0]`, `${L}Lig[0].ExpenseMedicalDental[0]`, `${L}Lih[0].ExpenseInsurance[0]`, `${L}Lii[0].ExpenseSchoolChildCare[0]`,
    `${L}Lij[0].ExpenseSupport[0]`, `${L}Lik[0].ExpenseTransportation[0]`,
    ...[1, 2, 3].map((n) => `${L}Lil[0].InstallmentPaymentAmount${n}[0]`),
    `${L}Lim[0].EarningsWithholding[0]`,
    ...[1, 2, 3].map((n) => `${L}Lin[0].OtherExpenseAmount${n}[0]`)
  ];
  checkTotal(f, add, '11', expenseLines, `${L}Total[0].Totalmonthlyexpenses[0]`);
  [1, 2, 3].forEach((n) => {
    if (amount(f[`${L}Lil[0].InstallmentPaymentAmount${n}[0]`]) && !filled(f[`${L}Lil[0].InstallmentPaymentTo${n}[0]`])) add('check', 'amountWithoutLabel', { item: `11l(${n})` });
    if (amount(f[`${L}Lin[0].OtherExpenseAmount${n}[0]`]) && !filled(f[`${L}Lin[0].OtherExpense${n}[0]`])) add('check', 'amountWithoutLabel', { item: `11n(${n})` });
  });
}

// ---- FL-142: items 1-17 (value, owed), 18 totals; 19-25 owed, 26 total ----
const FL142_VALUE = { 1: 'Page1[0].List1[0].Li1[0].TextField4[0]', 2: 'Page1[0].List2[0].Li1[0].TextField2[0]', 3: 'Page1[0].List3[0].Li1[0].TextField4[0]', 17: 'Page3[0].List17[0].Li1[0].TextField3[0]' };
const FL142_OWED = { 1: 'Page1[0].List1[0].Li1[0].TextField6[0]', 2: 'Page1[0].List2[0].Li1[0].TextField1[0]', 3: 'Page1[0].List3[0].Li1[0].TextField6[0]', 4: 'Page2[0].List4[0].Li1[0].TextField5[0]', 11: 'Page3[0].List11[0].Li1[0].TextField5[0]', 17: 'Page3[0].List17[0].Li1[0].TextField6[0]' };
function fl142Page(n) { return n <= 3 ? 1 : n <= 10 ? 2 : n <= 18 ? 3 : 4; }
function reviewFl142(fields, add, w) {
  const f = normalize(fields);
  const items = Array.from({ length: 17 }, (_, i) => i + 1);
  const value = (n) => FL142_VALUE[n] || `Page${fl142Page(n)}[0].List${n}[0].Li1[0].TextField4[0]`;
  const owed = (n) => FL142_OWED[n] || `Page${fl142Page(n)}[0].List${n}[0].Li1[0].TextField6[0]`;
  checkTotal(f, add, '18', items.map(value), 'Page3[0].List18[0].Li1[0].total1[0]', w('value'));
  checkTotal(f, add, '18', items.map(owed), 'Page3[0].List18[0].Li1[0].total2[0]', w('owed'));
  const debts = [19, 20, 21, 22, 23, 24].map((n) => `Page4[0].List${n}[0].Li1[0].TextField3[0]`).concat('Page4[0].List25[0].Li1[0].TextField2[0]');
  checkTotal(f, add, '26', debts, 'Page4[0].List26[0].Li1[0].TotalDebts[0]');
}

// ---- FL-160: rows found by their column names ----
// Row name prefix -> item number on the form (items 18 and 26 are the totals).
const FL160_ITEMS = [
  ['RealEstate', 1], ['Household', 2], ['JAAC', 3], ['Vehicles', 4], ['Savings', 5], ['Checking', 6], ['CreditUnion', 7],
  ['Cash', 8], ['TaxRefund', 9], ['Insurance', 10], ['StocksBonds', 11], ['Retirement', 12], ['IRAsAnnuities', 13],
  ['AcctsRec', 14], ['Partrshp', 15], ['OtherAssets', 16], ['AssetsCont', 17],
  ['StLoans', 19], ['Taxes', 20], ['SptArrs', 21], ['UnsecLoans', 22], ['CCards', 23], ['OtherDebts', 24], ['ContDebts', 25]
];
function reviewFl160(fields, add, w) {
  const f = normalize(fields);
  const assetRows = new Map();
  const debtRows = new Map();
  for (const key of Object.keys(f)) {
    // Some FL-160 names contain escaped dots ("AssetsContd\.Debt\.dc[0]").
    const parts = key.split(/(?<!\\)\./);
    const leaf = parts.pop();
    const row = parts.join('.');
    if (/^Page[12]\[0\]\.Table5\[0\]\./.test(key) && !/TotalAssets/.test(row)) {
      const column = /Gross/.test(leaf) ? 'gross' : /Net/.test(leaf) ? 'net' : /Debt/.test(leaf) ? 'debt' : /Pet/.test(leaf) ? 'pet' : /Re/.test(leaf) && /Div/.test(leaf) ? 'res' : '';
      if (column) assetRows.set(row, { ...(assetRows.get(row) || {}), [column]: key });
    }
    if (/^Page3\[0\]\.Debts\[0\]\./.test(key) && !/TotalDebt/.test(row)) {
      const column = /Debt_dc/.test(leaf) ? 'debt' : /Pet_ft/.test(leaf) ? 'pet' : /Resp_ft/.test(leaf) ? 'res' : '';
      if (column) debtRows.set(row, { ...(debtRows.get(row) || {}), [column]: key });
    }
  }
  // "Vehicles2_ft[0]" -> item 4, line 2.
  const where = (row) => {
    const name = row.split(/(?<!\\)\./).pop();
    const found = FL160_ITEMS.find(([prefix]) => name.startsWith(prefix));
    const line = (name.match(/^[A-Za-z_]+?(\d+)/) || [])[1];
    return { item: found ? String(found[1]) : name, note: line ? `${w('line')} ${line}` : '' };
  };
  const totals = { gross: 0, debt: 0, net: 0, pet: 0, res: 0 };
  for (const [row, cols] of assetRows) {
    const gross = amount(f[cols.gross]);
    const debt = amount(f[cols.debt]) || 0;
    const net = amount(f[cols.net]);
    const pet = amount(f[cols.pet]);
    const res = amount(f[cols.res]);
    const place = where(row);
    if (gross !== null && net !== null && Math.abs(gross - debt - net) > 1) add('math', 'netMismatch', { ...place, gross: money(gross), debt: money(debt), net: money(gross - debt), shown: money(net) });
    const rowNet = net ?? (gross !== null ? gross - debt : null);
    if (pet !== null && res !== null && rowNet !== null && Math.abs(pet + res - rowNet) > 1) add('math', 'splitMismatch', { ...place, pet: money(pet), res: money(res), sum: money(pet + res), total: money(rowNet) });
    totals.gross += gross || 0; totals.debt += debt; totals.net += rowNet || 0; totals.pet += pet || 0; totals.res += res || 0;
  }
  const T = 'Page2[0].Table5[0].TotalAssets[0].';
  const shownAssets = {
    gross: amount(f[`${T}TotalAssets\\.GrossFMV\\.dc[0]`]), debt: amount(f[`${T}TotalAssets\\.Debt\\.dc[0]`]), net: amount(f[`${T}TotalAssets\\.NetFMV\\.dc[0]`]),
    pet: amount(f[`${T}TotalAssets\\.Div\\.Pet\\.ft[0]`]), res: amount(f[`${T}TotalAssets\\.Div\\.Res\\.ft[0]`])
  };
  for (const column of Object.keys(totals)) {
    if (shownAssets[column] !== null && Math.abs(shownAssets[column] - totals[column]) > 1) add('math', 'totalMismatch', { item: '18', note: w(column), total: money(shownAssets[column]), sum: money(totals[column]) });
  }
  const debtTotals = { debt: 0, pet: 0, res: 0 };
  for (const [row, cols] of debtRows) {
    const debt = amount(f[cols.debt]);
    const pet = amount(f[cols.pet]);
    const res = amount(f[cols.res]);
    if (debt !== null && pet !== null && res !== null && Math.abs(pet + res - debt) > 1) add('math', 'splitMismatch', { ...where(row), pet: money(pet), res: money(res), sum: money(pet + res), total: money(debt) });
    debtTotals.debt += debt || 0; debtTotals.pet += pet || 0; debtTotals.res += res || 0;
  }
  const D = 'Page3[0].Debts[0].TotalDebt_rw[0].';
  const shownDebts = { debt: amount(f[`${D}TotalDebt_Debt_dc[0]`]), pet: amount(f[`${D}TotalDebtPet_ft[0]`]), res: amount(f[`${D}TotalDebtResp_ft[0]`]) };
  for (const column of Object.keys(debtTotals)) {
    if (shownDebts[column] !== null && Math.abs(shownDebts[column] - debtTotals[column]) > 1) add('math', 'totalMismatch', { item: '26', note: column === 'debt' ? '' : w(column), total: money(shownDebts[column]), sum: money(debtTotals[column]) });
  }
}

// ---- I-864 (wizard answers) ----
function reviewI864(answers, add, w) {
  const part = (n, item) => `${w('part')} ${n}${item ? `, ${w('item').toLowerCase()} ${item}` : ''}`;
  const a = answers || {};
  const num = (key) => amount(a[key]);
  const shownSize = num('household_size');
  const immigrants = num('i864_total_number_of_immigrants');
  const parts = ['i864_household_spouse_count', 'i864_household_dependent_children_count', 'i864_household_other_dependents_count', 'i864_household_other_sponsored_count', 'i864_household_same_residence_count'];
  if (shownSize !== null && immigrants !== null) {
    const sum = 1 + immigrants + parts.reduce((total, key) => total + (num(key) || 0), 0);
    if (sum !== shownSize) add('math', 'householdSize', { sum, immigrants, shown: shownSize, item: 'P5.8', label: part(5, 8) });
  }
  const shownIncome = num('i864_total_household_income');
  const own = num('current_annual_income');
  if (shownIncome !== null && own !== null) {
    const includeOthers = /^y/i.test(String(a.include_household_member_income || ''));
    const others = includeOthers ? [1, 2, 3, 4].reduce((total, n) => total + (num(`i864_household_income_person${n}_income`) || 0), 0) : 0;
    if (Math.abs(own + others - shownIncome) > 1) add('math', 'householdIncome', { own: money(own), others: money(others), sum: money(own + others), shown: money(shownIncome), item: 'P6.15' });
  }
  const assetTotal = (number, lines, total) => {
    const item = `P7.${number}`;
    const label = part(7, number);
    const values = lines.map(num).filter((value) => value !== null);
    const shown = num(total);
    const sum = values.reduce((x, y) => x + y, 0);
    if (values.length && shown !== null && Math.abs(shown - sum) > 1) add('math', 'totalMismatch', { item, label, total: money(shown), sum: money(sum) });
  };
  assetTotal(4, ['i864_sponsor_cash_assets', 'i864_sponsor_real_estate_assets', 'i864_sponsor_stock_bond_assets'], 'i864_sponsor_total_assets');
  assetTotal(9, ['i864_immigrant_cash_assets', 'i864_immigrant_real_estate_assets', 'i864_immigrant_stock_bond_assets'], 'i864_immigrant_total_assets');
  assetTotal(10, ['i864_sponsor_total_assets', 'i864_household_member_total_assets', 'i864_immigrant_total_assets'], 'i864_total_value_assets');
  const years = [num('i864_tax_year1'), num('i864_tax_year2'), num('i864_tax_year3')];
  if (years.every((year) => year !== null) && !(years[0] - years[1] === 1 && years[1] - years[2] === 1)) {
    add('check', 'taxYears', { years: years.join(', '), item: 'P6.19' });
  }
}

const COURT_REVIEWERS = { 'FW-001': reviewFw001, 'FL-142': reviewFl142, 'FL-160': reviewFl160 };
const ANSWER_REVIEWERS = { 'I-864': reviewI864 };

function reviewTotals(formCode, input, lang = 'en') {
  const code = String(formCode || '').toUpperCase();
  const reviewer = COURT_REVIEWERS[code] || ANSWER_REVIEWERS[code];
  if (!reviewer) return [];
  const language = MESSAGES.totalMismatch[lang] ? lang : 'en';
  const issues = [];
  reviewer(input || {}, makeAdder(issues, language), (word) => WORDS[word][language]);
  return issues;
}

module.exports = {
  reviewTotals,
  MESSAGES,
  TOTALS_COURT_FORMS: Object.keys(COURT_REVIEWERS),
  TOTALS_ANSWER_FORMS: Object.keys(ANSWER_REVIEWERS)
};
