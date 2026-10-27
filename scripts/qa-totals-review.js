// Totals checks for FW-001, FL-142, FL-160 (court PDF fields) and I-864
// (wizard answers), on invented numbers. Also confirms every field name the
// checks read exists in the current court templates.
// Run: node scripts/qa-totals-review.js
const { PDFDocument } = require('pdf-lib');
const { reviewTotals, MESSAGES } = require('../netlify/functions/lib/totals-review');
const { loadCourtTemplate } = require('../netlify/functions/lib/ca-court-template');
const formReview = require('../netlify/functions/form-review');

let failures = 0;
function check(ok, label) {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}
const keys = (issues) => issues.map((issue) => `${issue.key}:${issue.item}`);

async function templateFields(slug) {
  const buffer = await loadCourtTemplate(slug);
  if (!buffer) throw new Error(`no template for ${slug}`);
  const document = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return new Set(document.getForm().getFields().map((field) => field.getName()));
}

// ---- FW-001 ----
const FW = 'FW-001[0].Page2[0].';
const fwClean = {
  [`${FW}List8[0].Lia[0].IncomeSource1[0]`]: 'Wages, TEST CAFE',
  [`${FW}List8[0].Lia[0].IncomeAmount1[0]`]: '1,200',
  [`${FW}List8[0].Lia[0].IncomeSource2[0]`]: 'Child support',
  [`${FW}List8[0].Lia[0].IncomeAmount2[0]`]: '300',
  [`${FW}List8[0].Lib[0].TotalIncome[0]`]: '1500',
  [`${FW}List9[0].Lia[0].HouseholdIncomeName1[0]`]: 'SAMPLE RELATIVE',
  [`${FW}List9[0].Lia[0].HouseholdIncomeAmount1[0]`]: '400',
  [`${FW}List9[0].Lib[0].HouseholdTotalncome[0]`]: '400',
  [`${FW}List9[0].Lib[0].TotalAllIncome[0]`]: '1,900',
  [`${FW}List11[0].Lib[0].ExpenseHousing[0]`]: '1100',
  [`${FW}List11[0].Lic[0].ExpenseFoodSupplies[0]`]: '450',
  [`${FW}List11[0].Lil[0].InstallmentPaymentTo1[0]`]: 'TEST AUTO LOANS',
  [`${FW}List11[0].Lil[0].InstallmentPaymentAmount1[0]`]: '250',
  [`${FW}List11[0].Total[0].Totalmonthlyexpenses[0]`]: '$1,800'
};

// ---- FL-142 ----
const fl142Clean = {
  'FL-142[0].Page1[0].List1[0].Li1[0].TextField4[0]': '350,000',
  'FL-142[0].Page1[0].List1[0].Li1[0].TextField6[0]': '210,000',
  'FL-142[0].Page2[0].List6[0].Li1[0].TextField4[0]': '4,500',
  'FL-142[0].Page2[0].List4[0].Li1[0].TextField5[0]': '6,000',
  'FL-142[0].Page2[0].List4[0].Li1[0].TextField4[0]': '15,000',
  'FL-142[0].Page3[0].List17[0].Li1[0].TextField3[0]': '500',
  'FL-142[0].Page3[0].List18[0].Li1[0].total1[0]': '370,000',
  'FL-142[0].Page3[0].List18[0].Li1[0].total2[0]': '216,000',
  'FL-142[0].Page4[0].List19[0].Li1[0].TextField3[0]': '2,000',
  'FL-142[0].Page4[0].List25[0].Li1[0].TextField2[0]': '800',
  'FL-142[0].Page4[0].List26[0].Li1[0].TotalDebts[0]': '2,800'
};

async function main() {
  const fwFields = await templateFields('fw-001');
  const fl142Fields = await templateFields('fl-142');
  const fl160Fields = await templateFields('fl-160');

  for (const name of Object.keys(fwClean)) check(fwFields.has(name), `FW-001 field exists: ${name}`);
  for (const name of Object.keys(fl142Clean)) check(fl142Fields.has(name), `FL-142 field exists: ${name}`);
  // Every amount and total the FL-142 check reads.
  const page = (n) => (n <= 3 ? 1 : n <= 10 ? 2 : 3);
  const valueField = { 2: 'TextField2', 17: 'TextField3' };
  const owedField = { 2: 'TextField1', 4: 'TextField5', 11: 'TextField5' };
  for (let n = 1; n <= 17; n += 1) {
    check(fl142Fields.has(`FL-142[0].Page${page(n)}[0].List${n}[0].Li1[0].${valueField[n] || 'TextField4'}[0]`), `FL-142 item ${n} value field`);
    check(fl142Fields.has(`FL-142[0].Page${page(n)}[0].List${n}[0].Li1[0].${owedField[n] || 'TextField6'}[0]`), `FL-142 item ${n} owed field`);
  }
  for (const n of [19, 20, 21, 22, 23, 24]) check(fl142Fields.has(`FL-142[0].Page4[0].List${n}[0].Li1[0].TextField3[0]`), `FL-142 item ${n} owed field`);
  // Every FW-001 expense line.
  const L = `${FW}List11[0].`;
  for (const name of [
    ...[1, 2, 3, 4].map((n) => `${L}Lia[0].PayrollAmt${n}[0]`),
    `${L}Lid[0].ExpenseUtilitiesPhone[0]`, `${L}Lie[0].ExpenseClothes[0]`, `${L}Lif[0].ExpenseLaundry[0]`, `${L}Lig[0].ExpenseMedicalDental[0]`,
    `${L}Lih[0].ExpenseInsurance[0]`, `${L}Lii[0].ExpenseSchoolChildCare[0]`, `${L}Lij[0].ExpenseSupport[0]`, `${L}Lik[0].ExpenseTransportation[0]`,
    `${L}Lim[0].EarningsWithholding[0]`, ...[1, 2, 3].map((n) => `${L}Lin[0].OtherExpenseAmount${n}[0]`), ...[1, 2, 3].map((n) => `${L}Lin[0].OtherExpense${n}[0]`)
  ]) check(fwFields.has(name), `FW-001 field exists: ${name}`);

  // FW-001: clean, then wrong totals, then an amount without its source.
  check(reviewTotals('FW-001', fwClean).length === 0, `FW-001 clean: ${keys(reviewTotals('FW-001', fwClean))}`);
  const fwWrong = { ...fwClean, [`${FW}List8[0].Lib[0].TotalIncome[0]`]: '1,400', [`${FW}List11[0].Total[0].Totalmonthlyexpenses[0]`]: '1,700', [`${FW}List8[0].Lia[0].IncomeSource2[0]`]: '' };
  const fwIssues = keys(reviewTotals('FW-001', fwWrong));
  check(fwIssues.includes('totalMismatch:8b'), `FW-001 8b mismatch: ${fwIssues}`);
  check(fwIssues.includes('totalMismatch:8b + 9b'), `FW-001 8b+9b uses the printed 8b: ${fwIssues}`);
  check(fwIssues.includes('totalMismatch:11'), `FW-001 11 mismatch: ${fwIssues}`);
  check(fwIssues.includes('amountWithoutLabel:8a(2)'), `FW-001 source missing: ${fwIssues}`);
  const fwBlank = { ...fwClean, [`${FW}List11[0].Total[0].Totalmonthlyexpenses[0]`]: '' };
  check(keys(reviewTotals('FW-001', fwBlank)).includes('totalMissing:11'), 'FW-001 blank total');

  // FL-142.
  check(reviewTotals('FL-142', fl142Clean).length === 0, `FL-142 clean: ${keys(reviewTotals('FL-142', fl142Clean))}`);
  const fl142Wrong = { ...fl142Clean, 'FL-142[0].Page3[0].List18[0].Li1[0].total1[0]': '365,000', 'FL-142[0].Page4[0].List26[0].Li1[0].TotalDebts[0]': '2,000' };
  const fl142Issues = keys(reviewTotals('FL-142', fl142Wrong));
  check(fl142Issues.includes('totalMismatch:18'), `FL-142 item 18: ${fl142Issues}`);
  check(fl142Issues.includes('totalMismatch:26'), `FL-142 item 26: ${fl142Issues}`);
  check(fl142Issues.filter((key) => key === 'totalMismatch:18').length === 1, `FL-142 owed total is right: ${fl142Issues}`);

  // FL-160: build rows from the real template names.
  const fl160 = [...fl160Fields];
  const find = (re) => fl160.find((name) => re.test(name));
  const houseGross = find(/Page1\[0\]\.Table5\[0\]\..*GrossF/);
  check(Boolean(houseGross), 'FL-160 has an asset row');
  const rowOf = (name) => name.split(/(?<!\\)\./).slice(0, -1).join('.');
  const houseRow = rowOf(houseGross);
  const inRow = (row, re) => fl160.find((name) => rowOf(name) === row && re.test(name.split(/(?<!\\)\./).pop()));
  const house = { gross: houseGross, debt: inRow(houseRow, /Debt/), net: inRow(houseRow, /Net/), pet: inRow(houseRow, /Pet/), res: inRow(houseRow, /Div.*Re/) };
  check(Object.values(house).every(Boolean), `FL-160 first row has all columns: ${JSON.stringify(house)}`);
  const contRow = fl160.find((name) => /AssetsCont/.test(name) && /Gross/.test(name));
  check(Boolean(contRow), 'FL-160 continuation row found');
  const T = 'topmostSubform[0].Page2[0].Table5[0].TotalAssets[0].';
  const totals = { gross: `${T}TotalAssets\\.GrossFMV\\.dc[0]`, debt: `${T}TotalAssets\\.Debt\\.dc[0]`, net: `${T}TotalAssets\\.NetFMV\\.dc[0]`, pet: `${T}TotalAssets\\.Div\\.Pet\\.ft[0]`, res: `${T}TotalAssets\\.Div\\.Res\\.ft[0]` };
  for (const [column, name] of Object.entries(totals)) check(fl160Fields.has(name), `FL-160 asset total ${column}: ${name}`);
  const D = 'topmostSubform[0].Page3[0].Debts[0].TotalDebt_rw[0].';
  for (const name of [`${D}TotalDebt_Debt_dc[0]`, `${D}TotalDebtPet_ft[0]`, `${D}TotalDebtResp_ft[0]`]) check(fl160Fields.has(name), `FL-160 debt total: ${name}`);
  const debtDebt = find(/Page3\[0\]\.Debts\[0\]\.(?!TotalDebt).*Debt_dc/);
  const debtRow = rowOf(debtDebt);
  const debt = { debt: debtDebt, pet: inRow(debtRow, /Pet_ft/), res: inRow(debtRow, /Resp_ft/) };
  check(Object.values(debt).every(Boolean), `FL-160 first debt row has all columns: ${JSON.stringify(debt)}`);

  const fl160Clean = {
    [house.gross]: '400,000', [house.debt]: '250,000', [house.net]: '150,000', [house.pet]: '75,000', [house.res]: '75,000',
    [totals.gross]: '400,000', [totals.debt]: '250,000', [totals.net]: '150,000', [totals.pet]: '75,000', [totals.res]: '75,000',
    [debt.debt]: '9,000', [debt.pet]: '4,500', [debt.res]: '4,500',
    [`${D}TotalDebt_Debt_dc[0]`]: '9,000', [`${D}TotalDebtPet_ft[0]`]: '4,500', [`${D}TotalDebtResp_ft[0]`]: '4,500'
  };
  check(reviewTotals('FL-160', fl160Clean).length === 0, `FL-160 clean: ${keys(reviewTotals('FL-160', fl160Clean))}`);
  const fl160Wrong = { ...fl160Clean, [house.net]: '160,000', [house.res]: '70,000', [debt.res]: '4,000', [totals.gross]: '410,000' };
  const fl160Issues = reviewTotals('FL-160', fl160Wrong);
  const fl160Keys = fl160Issues.map((issue) => issue.key);
  check(fl160Keys.includes('netMismatch'), `FL-160 net = gross - debt: ${keys(fl160Issues)}`);
  check(fl160Keys.filter((key) => key === 'splitMismatch').length === 2, `FL-160 split checks (asset and debt): ${keys(fl160Issues)}`);
  check(fl160Issues.some((issue) => issue.key === 'totalMismatch' && issue.item === '18' && /\(gross value\)/.test(issue.text)), `FL-160 asset total: ${keys(fl160Issues)}`);
  // The continuation row (escaped dots in its names) is read as a row too.
  const contFields = fl160.filter((name) => /AssetsCont/.test(name));
  const contGross = contFields.find((name) => /Gross/.test(name));
  const contNet = contFields.find((name) => /Net/.test(name));
  const withCont = { ...fl160Clean, [contGross]: '1,000', [contNet]: '900' };
  check(reviewTotals('FL-160', withCont).some((issue) => issue.key === 'netMismatch'), `FL-160 continuation row checked: ${keys(reviewTotals('FL-160', withCont))}`);

  // I-864.
  const i864 = {
    i864_total_number_of_immigrants: '1', i864_household_spouse_count: '0', i864_household_dependent_children_count: '2',
    i864_household_other_dependents_count: '0', i864_household_other_sponsored_count: '0', i864_household_same_residence_count: '1',
    household_size: '5',
    current_annual_income: '52,000', include_household_member_income: 'Yes',
    i864_household_income_person1_name: 'SAMPLE RELATIVE', i864_household_income_person1_income: '18,000',
    i864_total_household_income: '70,000',
    i864_tax_year1: '2025', i864_tax_year2: '2024', i864_tax_year3: '2023',
    i864_sponsor_cash_assets: '5,000', i864_sponsor_real_estate_assets: '0', i864_sponsor_stock_bond_assets: '1,000', i864_sponsor_total_assets: '6,000',
    i864_total_value_assets: '6,000'
  };
  check(reviewTotals('I-864', i864).length === 0, `I-864 clean: ${keys(reviewTotals('I-864', i864))}`);
  const i864Wrong = { ...i864, household_size: '4', i864_total_household_income: '52,000', i864_tax_year2: '2023', i864_tax_year3: '2022', i864_sponsor_total_assets: '7,000' };
  const i864Issues = reviewTotals('I-864', i864Wrong).map((issue) => issue.key);
  for (const key of ['householdSize', 'householdIncome', 'taxYears', 'totalMismatch']) check(i864Issues.includes(key), `I-864 ${key}: ${i864Issues}`);
  check(reviewTotals('I-864', { ...i864, include_household_member_income: 'No', i864_total_household_income: '52,000' }).length === 0, 'I-864 others not counted when not included');

  // Messages exist in every language, and the language is used.
  for (const [key, texts] of Object.entries(MESSAGES)) for (const lang of ['en', 'ru', 'uk', 'es']) check(Boolean(texts[lang]), `message ${key} ${lang}`);
  const ru = reviewTotals('FW-001', fwWrong, 'ru');
  check(ru.every((issue) => !/\{\w+\}/.test(issue.text)) && /Пункт/.test(ru[0].text), `ru text filled: ${ru[0] && ru[0].text}`);
  check(reviewTotals('I-130', {}).length === 0, 'other forms: no issues');

  // Endpoint, signed out: needs the site origin.
  const event = (body) => ({ httpMethod: 'POST', headers: { origin: 'https://imverica.com' }, body: JSON.stringify(body) });
  const court = await formReview.handler(event({ formCode: 'fw-001', directFields: fwWrong, lang: 'es' }));
  const courtBody = JSON.parse(court.body);
  check(court.statusCode === 200 && courtBody.issues.some((issue) => issue.key === 'totalMismatch' && /Punto 8b/.test(issue.text)), `endpoint FW-001: ${court.statusCode} ${court.body.slice(0, 200)}`);
  const answers = await formReview.handler(event({ formCode: 'I-864', formAnswers: i864Wrong }));
  check(JSON.parse(answers.body).issues.length >= 4, `endpoint I-864: ${answers.body.slice(0, 200)}`);

  if (failures) {
    console.log(`totals review QA: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log('totals review QA: OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
