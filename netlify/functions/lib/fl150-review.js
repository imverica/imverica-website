'use strict';

// FL-150 Income and Expense Declaration (Rev. September 1, 2024): a review of
// the client's own answers before the draft is generated. It only checks
// arithmetic, whether related items agree with each other, blanks that the
// form itself asks to fill, and the attachments the form asks for. Every
// result is phrased as something to double-check; none of it is advice on
// what to report.
//
// Field ids are the PDF field names; only the part from "PageN[0]." on is used.

const P1 = 'Page1[0].';
const P2 = 'Page2[0].';
const P3 = 'Page3[0].';
const P4 = 'Page4[0].';

// Item 5 rows a-l: [letter, last month, average monthly].
const INCOME_ROWS = [
  ['5a', 'List5[0].Li1[0].FillText1[0]', 'List5[0].Li1[0].TextField7[0]'],
  ['5b', 'List5[0].Li2[0].FillText1[0]', 'List5[0].Li2[0].TextField8[0]'],
  ['5c', 'List5[0].Li3[0].FillText1[0]', 'List5[0].Li3[0].TextField9[0]'],
  ['5d', 'List5[0].Li4[0].FillText1[0]', 'List5[0].Li4[0].TextField10[0]'],
  ['5e', 'List5[0].Li5[0].FillText1[0]', 'List5[0].Li5[0].TextField11[0]'],
  ['5f', 'List5[0].Li6[0].FillText1[0]', 'List5[0].Li6[0].TextField12[0]'],
  ['5g', 'List5[0].Li7[0].FillText1[0]', 'List5[0].Li7[0].TextField13[0]'],
  ['5h', 'List5[0].Li8[0].FillText1[0]', 'List5[0].Li8[0].TextField14[0]'],
  ['5i', 'List5[0].Li9[0].FillText1[0]', 'List5[0].Li9[0].TextField15[0]'],
  ['5j', 'List5[0].Li10[0].FillText1[0]', 'List5[0].Li10[0].TextField16[0]'],
  ['5k', 'List5[0].Li11[0].FillText1[0]', 'List5[0].Li11[0].TextField17[0]'],
  ['5l', 'List5[0].Li12[0].FillText2[0]', 'List5[0].Li12[0].TextField18[0]'],
  ['6a', 'List6[0].Li1[0].FillText1[0]', 'List6[0].Li1[0].TextField23[0]'],
  ['6b', 'List6[0].L2[0].FillText1[0]', 'List6[0].L2[0].TextField22[0]'],
  ['6c', 'List6[0].L3[0].FillText1[0]', 'List6[0].L3[0].TextField21[0]'],
  ['6d', 'List6[0].L4[0].FillText2[0]', 'List6[0].L4[0].TextField20[0]'],
  ['7', 'List7[0].L1[0].FillTxt1[0]', 'List7[0].L1[0].TextField[0]']
].map(([item, last, average]) => [item, P2 + last, P2 + average]);

const DEDUCTIONS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((letter, index) => [`10${letter}`, `${P2}List10[0].L${index + 1}[0].FillText1[0]`]);

// Item 13: a(1) rent or mortgage, a(1)(a)/(b) principal and interest (not
// added to the total), a(2)-a(4), then b-q, r total, s paid by others.
const E = `${P3}List13[0].`;
const EXPENSES = [
  ['13a(1)', `${E}Li1[0].List[0].L1[0].EXPN[0]`],
  ['13a(2)', `${E}Li1[0].List[0].L2[0].EXPN[0]`],
  ['13a(3)', `${E}Li1[0].List[0].L3[0].EXPN[0]`],
  ['13a(4)', `${E}Li1[0].List[0].L4[0].EXPN[0]`],
  ...'bcdefghijklmnop'.split('').map((letter, index) => [`13${letter}`, `${E}Li${index + 2}[0].EXPN[0]`]),
  ['13q', `${E}Li17[0].EXPN[0]`]
];
const MORTGAGE = `${E}Li1[0].List[0].L1[0].`;
const EXPENSE_TOTAL = `${E}Li18[0].TOTAL[0]`;
const INSTALLMENT_AMOUNTS = [1, 3, 5, 7, 9, 11].map((n) => `${P3}List14[0].L1[0].FillText${n}[0]`);
const INSTALLMENT_PAID_TO = [1, 3, 5, 7, 9, 11].map((n) => `${P3}List14[0].L1[0].TextField${n}[0]`);

// Clearer labels for the portal wizard, where the PDF tooltips only say "$",
// "Last month" or "Average monthly".
const INCOME_NAMES = {
  '5a': 'Salary or wages (gross, before taxes)', '5b': 'Overtime (gross, before taxes)', '5c': 'Commissions or bonuses',
  '5d': 'Public assistance (TANF, SSI, GA/GR)', '5e': 'Spousal support received', '5f': 'Partner support received',
  '5g': 'Pension/retirement fund payments', '5h': 'Social Security retirement (not SSI)', '5i': 'Disability benefits',
  '5j': 'Unemployment compensation', '5k': "Workers' compensation", '5l': 'Other income (military allowances, royalties)',
  '6a': 'Dividends/interest', '6b': 'Rental property income', '6c': 'Trust income', '6d': 'Other investment income',
  '7': 'Self-employment income, after business expenses'
};
const DEDUCTION_NAMES = {
  '10a': 'Required union dues', '10b': 'Required retirement payments (not Social Security, FICA, 401(k), or IRA)',
  '10c': 'Health insurance premiums (total monthly)', '10d': 'Child support I pay for children from other relationships',
  '10e': 'Spousal support I pay by court order (different marriage)', '10f': 'Partner support I pay by court order (different partnership)',
  '10g': 'Job-related expenses not reimbursed by my employer'
};
const EXPENSE_NAMES = {
  '13a(1)': 'Rent or mortgage', '13a(2)': 'Real property taxes', '13a(3)': "Homeowner's or renter's insurance (if not included above)",
  '13a(4)': 'Home maintenance and repair', '13b': 'Health-care costs not paid by insurance', '13c': 'Child care',
  '13d': 'Groceries and household supplies', '13e': 'Eating out', '13f': 'Utilities (gas, electric, water, trash)',
  '13g': 'Telephone, cell phone, and e-mail', '13h': 'Laundry and cleaning', '13i': 'Clothes', '13j': 'Education',
  '13k': 'Entertainment, gifts, and vacation', '13l': 'Auto expenses and transportation', '13m': 'Insurance (life, accident; not auto, home, or health)',
  '13n': 'Savings and investments', '13o': 'Charitable contributions', '13p': 'Monthly payments listed in item 14 (total)', '13q': 'Other expenses'
};

function buildLabels() {
  const labels = {};
  for (const [item, last, average] of INCOME_ROWS) {
    labels[last] = `${item}. ${INCOME_NAMES[item]}: last month ($)`;
    labels[average] = `${item}. ${INCOME_NAMES[item]}: average monthly, last 12 months ($)`;
  }
  for (const [item, id] of DEDUCTIONS) labels[id] = `${item}. ${DEDUCTION_NAMES[item]}: last month ($)`;
  for (const [item, id] of EXPENSES) labels[id] = `${item}. ${EXPENSE_NAMES[item]} ($ per month)`;
  Object.assign(labels, {
    [`${MORTGAGE}List[0].L1[0].MortPrin[0]`]: '13a(1)(a). If mortgage: average principal ($)',
    [`${MORTGAGE}List[0].L2[0].MortInt[0]`]: '13a(1)(b). If mortgage: average interest ($)',
    [EXPENSE_TOTAL]: '13r. TOTAL EXPENSES, items a-q (do not add a(1)(a) and (b)) ($)',
    [`${E}Li19[0].EXPNother[0]`]: '13s. Amount of expenses paid by others ($)',
    [`${E}Li17[0].FillText1[0]`]: '13q. Other expenses (specify)',
    [`${P2}List5[0].Li12[0].FillText1[0]`]: '5l. Other income (specify)',
    [`${P2}List6[0].L4[0].FillText1[0]`]: '6d. Other investment income (specify)',
    [`${P2}List11[0].L1[0].FillText1[0]`]: '11a. Cash, checking, savings, and other deposit accounts: total ($)',
    [`${P2}List11[0].L2[0].FillText1[0]`]: '11b. Stocks, bonds, and other assets I could easily sell: total ($)',
    [`${P2}List11[0].L3[0].FillText1[0]`]: '11c. All other property (fair market value minus debts owed): total ($)'
  });
  [1, 3, 5, 7, 9, 11].forEach((n, row) => {
    labels[`${P3}List14[0].L1[0].TextField${n}[0]`] = `14. Installment payment ${row + 1}: paid to`;
    labels[`${P3}List14[0].L1[0].TextField${n + 1}[0]`] = `14. Installment payment ${row + 1}: for`;
    labels[`${P3}List14[0].L1[0].FillText${n}[0]`] = `14. Installment payment ${row + 1}: monthly amount ($)`;
    labels[`${P3}List14[0].L1[0].FillText${n + 1}[0]`] = `14. Installment payment ${row + 1}: balance ($)`;
    labels[`${P3}List14[0].L1[0].DateField${row + 1}[0]`] = `14. Installment payment ${row + 1}: date of last payment`;
  });
  [['18', 1], ['18', 2], ['18', 3]].forEach(([item, n]) => {
    labels[`${P4}List18[0].L${n}[0].FillText1[0]`] = `${item}${'abc'[n - 1]}. ${['Childcare so I can work or get job training', "Children's health care not covered by insurance", 'Travel expenses for visitation'][n - 1]} ($ per month)`;
  });
  labels[`${P4}List18[0].L4[0].FillText2[0]`] = "18d. Children's educational or other special needs ($ per month)";
  Object.assign(labels, {
    [`${P4}List19[0].L1[0].FillText1[0]`]: '19a. Extraordinary health expenses not included in 18b ($ per month)',
    [`${P4}List19[0].L1[0].TextField24[0]`]: '19a. For how many months?',
    [`${P4}List19[0].L2[0].FillText1[0]`]: '19b. Major losses not covered by insurance ($ per month)',
    [`${P4}List19[0].L2[0].TextField25[0]`]: '19b. For how many months?',
    [`${P4}List19[0].L3[0].List[0].L1[0].FillText1[0]`]: '19c(1). Expenses for my minor children from other relationships living with me ($ per month)',
    [`${P4}List19[0].L3[0].List[0].L1[0].TextField26[0]`]: '19c(1). For how many months?',
    [`${P4}List19[0].L3[0].List[0].L3[0].FillText1[0]`]: '19c(3). Child support I receive for those children ($ per month)'
  });
  return labels;
}

const FL150_LABELS = buildLabels();

// Messages per language. {item} is the form item, other {names} are values.
const MESSAGES = {
  payBasis: {
    en: 'Item 1h: tick exactly one box for how you are paid (per month, per week, or per hour).',
    ru: 'Пункт 1h: отметьте ровно один вариант оплаты (в месяц, в неделю или в час).',
    uk: 'Пункт 1h: позначте рівно один варіант оплати (на місяць, на тиждень або на годину).',
    es: 'Punto 1h: marque una sola casilla sobre cómo le pagan (por mes, por semana o por hora).'
  },
  payMissing: {
    en: 'Item 1h: the gross pay is blank, but Item 1 names an employer and no end date.',
    ru: 'Пункт 1h: не указан доход до налогов, хотя в пункте 1 есть работодатель и нет даты увольнения.',
    uk: 'Пункт 1h: не вказано дохід до податків, хоча в пункті 1 є роботодавець і немає дати звільнення.',
    es: 'Punto 1h: el pago bruto está en blanco, pero el punto 1 indica un empleador sin fecha de fin.'
  },
  hoursMissing: {
    en: 'Item 1g: hours per week are blank, so the hourly pay in Item 1h cannot be compared with Item 5a.',
    ru: 'Пункт 1g: не указано число часов в неделю, поэтому почасовую оплату из 1h нельзя сверить с пунктом 5a.',
    uk: 'Пункт 1g: не вказано кількість годин на тиждень, тому погодинну оплату з 1h не можна звірити з пунктом 5a.',
    es: 'Punto 1g: las horas por semana están en blanco, así que el pago por hora del punto 1h no se puede comparar con el punto 5a.'
  },
  wagesMismatch: {
    en: 'Item 1h works out to about {monthly} a month, but Item 5a shows {average} as the average monthly wages. Check that both are right (overtime and bonuses go in 5b and 5c).',
    ru: 'По пункту 1h выходит около {monthly} в месяц, а в пункте 5a средняя зарплата {average}. Проверьте обе цифры (сверхурочные и бонусы — в 5b и 5c).',
    uk: 'За пунктом 1h виходить близько {monthly} на місяць, а в пункті 5a середня зарплата {average}. Перевірте обидві цифри (понаднормові й бонуси — у 5b і 5c).',
    es: 'El punto 1h equivale a unos {monthly} al mes, pero el punto 5a muestra {average} de salario mensual promedio. Revise ambas cifras (horas extra y bonos van en 5b y 5c).'
  },
  wagesMissing: {
    en: 'Item 5a is blank, but Item 1h shows that you are paid. Check the salary or wages in Item 5a.',
    ru: 'Пункт 5a пуст, хотя в пункте 1h указана оплата. Проверьте зарплату в пункте 5a.',
    uk: 'Пункт 5a порожній, хоча в пункті 1h вказано оплату. Перевірте зарплату в пункті 5a.',
    es: 'El punto 5a está en blanco, pero el punto 1h indica que recibe pago. Revise el salario en el punto 5a.'
  },
  averageMissing: {
    en: 'Item {item}: "last month" is filled in but "average monthly" is blank. The average is the last 12 months added up and divided by 12.',
    ru: 'Пункт {item}: заполнено «за прошлый месяц», но пусто «в среднем в месяц». Среднее — сумма за 12 месяцев, делённая на 12.',
    uk: 'Пункт {item}: заповнено «за минулий місяць», але порожньо «в середньому на місяць». Середнє — сума за 12 місяців, поділена на 12.',
    es: 'Punto {item}: "el mes pasado" está lleno pero "promedio mensual" está en blanco. El promedio es lo recibido en 12 meses dividido entre 12.'
  },
  lastMissing: {
    en: 'Item {item}: "average monthly" is filled in but "last month" is blank. If nothing was received last month, enter 0.',
    ru: 'Пункт {item}: заполнено «в среднем в месяц», но пусто «за прошлый месяц». Если в прошлом месяце ничего не было, укажите 0.',
    uk: 'Пункт {item}: заповнено «в середньому на місяць», але порожньо «за минулий місяць». Якщо минулого місяця нічого не було, вкажіть 0.',
    es: 'Punto {item}: "promedio mensual" está lleno pero "el mes pasado" está en blanco. Si no recibió nada el mes pasado, escriba 0.'
  },
  specifyMissing: {
    en: 'Item {item}: an amount is entered but the "specify" line is blank.',
    ru: 'Пункт {item}: сумма указана, но строка «уточните» пуста.',
    uk: 'Пункт {item}: суму вказано, але рядок «уточніть» порожній.',
    es: 'Punto {item}: hay una cantidad pero la línea "especifique" está en blanco.'
  },
  boxMissing: {
    en: 'Item {item}: an amount is entered but none of the boxes on that line is ticked.',
    ru: 'Пункт {item}: сумма указана, но ни один флажок в этой строке не отмечен.',
    uk: 'Пункт {item}: суму вказано, але жодну позначку в цьому рядку не поставлено.',
    es: 'Punto {item}: hay una cantidad pero no hay ninguna casilla marcada en esa línea.'
  },
  boxWithoutText: {
    en: 'Item {item}: the box is ticked but the explanation is blank.',
    ru: 'Пункт {item}: флажок отмечен, но пояснение не заполнено.',
    uk: 'Пункт {item}: позначку поставлено, але пояснення не заповнено.',
    es: 'Punto {item}: la casilla está marcada pero la explicación está en blanco.'
  },
  textWithoutBox: {
    en: 'Item {item}: there is an explanation but the box is not ticked.',
    ru: 'Пункт {item}: пояснение есть, но флажок не отмечен.',
    uk: 'Пункт {item}: пояснення є, але позначку не поставлено.',
    es: 'Punto {item}: hay una explicación pero la casilla no está marcada.'
  },
  businessDetails: {
    en: 'Item 7: self-employment income is entered; the business name, type, years in business and your role (owner, partner, other) should be filled in too.',
    ru: 'Пункт 7: указан доход от самозанятости — заполните также название и вид бизнеса, сколько лет он работает и вашу роль (владелец, партнёр, другое).',
    uk: 'Пункт 7: вказано дохід від самозайнятості — заповніть також назву й вид бізнесу, скільки років він працює і вашу роль (власник, партнер, інше).',
    es: 'Punto 7: hay ingresos por cuenta propia; complete también el nombre y tipo de negocio, los años en el negocio y su función (dueño, socio, otro).'
  },
  deductionsExceed: {
    en: 'Item 10: last month\'s deductions ({deductions}) are more than last month\'s income in Items 5-7 ({income}). Check both.',
    ru: 'Пункт 10: вычеты за прошлый месяц ({deductions}) больше дохода за прошлый месяц по пунктам 5-7 ({income}). Проверьте обе суммы.',
    uk: 'Пункт 10: відрахування за минулий місяць ({deductions}) більші за дохід за минулий місяць у пунктах 5-7 ({income}). Перевірте обидві суми.',
    es: 'Punto 10: las deducciones del mes pasado ({deductions}) superan los ingresos del mes pasado en los puntos 5-7 ({income}). Revise ambas.'
  },
  expenseTotalMissing: {
    en: 'Item 13r: the total is blank. Items a-q add up to {sum} (a(1)(a) and (b) are not added).',
    ru: 'Пункт 13r: итог не заполнен. Пункты a-q в сумме дают {sum} (a(1)(a) и (b) не складываются).',
    uk: 'Пункт 13r: підсумок не заповнено. Пункти a-q разом дають {sum} (a(1)(a) і (b) не додаються).',
    es: 'Punto 13r: el total está en blanco. Los puntos a-q suman {sum} (a(1)(a) y (b) no se suman).'
  },
  expenseTotalMismatch: {
    en: 'Item 13r shows {total}, but items a-q add up to {sum} (a(1)(a) and (b) are not added).',
    ru: 'В пункте 13r указано {total}, а пункты a-q в сумме дают {sum} (a(1)(a) и (b) не складываются).',
    uk: 'У пункті 13r вказано {total}, а пункти a-q разом дають {sum} (a(1)(a) і (b) не додаються).',
    es: 'El punto 13r muestra {total}, pero los puntos a-q suman {sum} (a(1)(a) y (b) no se suman).'
  },
  expenseBasis: {
    en: 'Item 13: tick whether the expenses are estimated, actual, or proposed needs.',
    ru: 'Пункт 13: отметьте, расходы оценочные, фактические или предлагаемые потребности.',
    uk: 'Пункт 13: позначте, витрати орієнтовні, фактичні чи пропоновані потреби.',
    es: 'Punto 13: marque si los gastos son estimados, reales o necesidades propuestas.'
  },
  mortgageSplit: {
    en: 'Item 13a(1): principal plus interest ({split}) is more than the mortgage payment ({payment}).',
    ru: 'Пункт 13a(1): основной долг плюс проценты ({split}) больше платежа по ипотеке ({payment}).',
    uk: 'Пункт 13a(1): основний борг плюс відсотки ({split}) більші за платіж за іпотекою ({payment}).',
    es: 'Punto 13a(1): el capital más los intereses ({split}) superan el pago de la hipoteca ({payment}).'
  },
  installments: {
    en: 'Item 13p should be the total of the monthly payments listed in Item 14 ({sum}); it shows {shown}.',
    ru: 'В пункте 13p должна стоять сумма ежемесячных платежей из пункта 14 ({sum}); сейчас там {shown}.',
    uk: 'У пункті 13p має бути сума щомісячних платежів із пункту 14 ({sum}); зараз там {shown}.',
    es: 'El punto 13p debe ser el total de los pagos mensuales del punto 14 ({sum}); ahora muestra {shown}.'
  },
  installmentPayee: {
    en: 'Item 14: a monthly amount is entered without "paid to".',
    ru: 'Пункт 14: сумма платежа указана, но не указано, кому он платится.',
    uk: 'Пункт 14: суму платежу вказано, але не вказано, кому він сплачується.',
    es: 'Punto 14: hay un pago mensual sin indicar a quién se paga.'
  },
  household: {
    en: 'Item 12, row {row}: tick Yes or No for whether this person pays some of the household expenses.',
    ru: 'Пункт 12, строка {row}: отметьте «Да» или «Нет» — оплачивает ли этот человек часть расходов семьи.',
    uk: 'Пункт 12, рядок {row}: позначте «Так» або «Ні» — чи сплачує ця особа частину витрат домогосподарства.',
    es: 'Punto 12, fila {row}: marque Sí o No sobre si esta persona paga parte de los gastos del hogar.'
  },
  otherPartyBasis: {
    en: 'Item 4: the other party\'s income is estimated but the basis for the estimate is blank.',
    ru: 'Пункт 4: доход другой стороны указан, но не объяснено, на чём основана оценка.',
    uk: 'Пункт 4: дохід іншої сторони вказано, але не пояснено, на чому ґрунтується оцінка.',
    es: 'Punto 4: se estimó el ingreso de la otra parte pero falta en qué se basa la estimación.'
  },
  taxYear: {
    en: 'Item 3a: the last tax year you filed is blank.',
    ru: 'Пункт 3a: не указан последний год, за который вы подавали налоги.',
    uk: 'Пункт 3a: не вказано останній рік, за який ви подавали податки.',
    es: 'Punto 3a: falta el último año en que presentó impuestos.'
  },
  taxStatus: {
    en: 'Item 3b: tick one tax filing status.',
    ru: 'Пункт 3b: отметьте один статус подачи налогов.',
    uk: 'Пункт 3b: позначте один статус подання податків.',
    es: 'Punto 3b: marque un estado civil tributario.'
  },
  attorneySource: {
    en: 'Item 15: an amount paid to an attorney is entered, but its source (15b) is blank.',
    ru: 'Пункт 15: указана сумма, уплаченная адвокату, но не указан источник денег (15b).',
    uk: 'Пункт 15: вказано суму, сплачену адвокату, але не вказано джерело коштів (15b).',
    es: 'Punto 15: hay un monto pagado a un abogado, pero falta de dónde salió el dinero (15b).'
  },
  timeshare: {
    en: 'Item 16b: the percentages of time with you ({mine}%) and with the other parent ({other}%) add up to {sum}%, not 100%.',
    ru: 'Пункт 16b: проценты времени с вами ({mine}%) и с другим родителем ({other}%) в сумме дают {sum}%, а не 100%.',
    uk: 'Пункт 16b: відсотки часу з вами ({mine}%) та з іншим батьком ({other}%) разом дають {sum}%, а не 100%.',
    es: 'Punto 16b: los porcentajes de tiempo con usted ({mine}%) y con el otro padre ({other}%) suman {sum}%, no 100%.'
  },
  childInsurance: {
    en: 'Item 17: you ticked that insurance for the children is available through your job; the company name (17b) and the monthly cost (17d) should be filled in.',
    ru: 'Пункт 17: отмечено, что страховка для детей доступна через работу — укажите страховую компанию (17b) и ежемесячную стоимость (17d).',
    uk: 'Пункт 17: позначено, що страховка для дітей доступна через роботу — вкажіть страхову компанію (17b) і щомісячну вартість (17d).',
    es: 'Punto 17: marcó que tiene seguro para los niños por su trabajo; complete la compañía (17b) y el costo mensual (17d).'
  },
  hardshipMonths: {
    en: 'Item 19{item}: an amount is entered without "for how many months".',
    ru: 'Пункт 19{item}: сумма указана, но не указано, сколько месяцев.',
    uk: 'Пункт 19{item}: суму вказано, але не вказано, скільки місяців.',
    es: 'Punto 19{item}: hay una cantidad sin indicar por cuántos meses.'
  },
  hardshipReason: {
    en: 'Item 19: hardship amounts are entered, but the explanation of the extreme financial hardship is blank.',
    ru: 'Пункт 19: суммы особых обстоятельств указаны, но не объяснено, почему они создают крайние финансовые трудности.',
    uk: 'Пункт 19: суми особливих обставин вказано, але не пояснено, чому вони створюють надзвичайні фінансові труднощі.',
    es: 'Punto 19: hay montos de dificultades especiales, pero falta la explicación de la dificultad financiera extrema.'
  },
  declarant: {
    en: 'Page 1: your printed name and the date under the declaration are blank.',
    ru: 'Страница 1: не заполнены ваше имя печатными буквами и дата под декларацией.',
    uk: 'Сторінка 1: не заповнено ваше ім\'я друкованими літерами та дату під декларацією.',
    es: 'Página 1: faltan su nombre en letra de molde y la fecha debajo de la declaración.'
  },
  attachPayStubs: {
    en: 'Attach your pay stubs for the last two months and proof of any other income; black out your Social Security number. Take your latest federal tax return to the hearing.',
    ru: 'Приложите расчётные листки (pay stubs) за последние два месяца и подтверждение других доходов, закрасив номер Social Security. Возьмите на заседание последнюю федеральную налоговую декларацию.',
    uk: 'Додайте розрахункові листи (pay stubs) за останні два місяці та підтвердження інших доходів, замалювавши номер Social Security. Візьміть на засідання останню федеральну податкову декларацію.',
    es: 'Adjunte sus talones de pago de los últimos dos meses y prueba de otros ingresos; tache su número de Seguro Social. Lleve su última declaración federal de impuestos a la audiencia.'
  },
  attachInvestment: {
    en: 'Item 6: attach a schedule showing gross receipts less cash expenses for each piece of property.',
    ru: 'Пункт 6: приложите расчёт по каждому объекту — валовые поступления минус денежные расходы.',
    uk: 'Пункт 6: додайте розрахунок по кожному об\'єкту — валові надходження мінус грошові витрати.',
    es: 'Punto 6: adjunte un anexo con los ingresos brutos menos los gastos en efectivo de cada propiedad.'
  },
  attachBusiness: {
    en: 'Item 7: attach a profit and loss statement for the last two years or a Schedule C from your last federal tax return; black out your Social Security number.',
    ru: 'Пункт 7: приложите отчёт о прибылях и убытках за два года или Schedule C из последней федеральной декларации, закрасив номер Social Security.',
    uk: 'Пункт 7: додайте звіт про прибутки та збитки за два роки або Schedule C з останньої федеральної декларації, замалювавши номер Social Security.',
    es: 'Punto 7: adjunte un estado de pérdidas y ganancias de los últimos dos años o el Schedule C de su última declaración federal; tache su número de Seguro Social.'
  },
  attach10g: {
    en: 'Item 10g: attach an explanation labeled "Question 10g".',
    ru: 'Пункт 10g: приложите пояснение с заголовком «Question 10g».',
    uk: 'Пункт 10g: додайте пояснення із заголовком «Question 10g».',
    es: 'Punto 10g: adjunte una explicación titulada "Question 10g".'
  },
  attachHardship: {
    en: 'Item 19: attach documentation for each hardship listed, including court orders.',
    ru: 'Пункт 19: приложите документы по каждому указанному обстоятельству, включая судебные приказы.',
    uk: 'Пункт 19: додайте документи щодо кожної вказаної обставини, зокрема судові накази.',
    es: 'Punto 19: adjunte documentación de cada dificultad indicada, incluidas órdenes judiciales.'
  },
  pagesAttached: {
    en: 'Page 1: write the number of pages attached.',
    ru: 'Страница 1: укажите число приложенных страниц.',
    uk: 'Сторінка 1: вкажіть кількість доданих сторінок.',
    es: 'Página 1: escriba el número de páginas adjuntas.'
  }
};

function normalizeFields(fields) {
  const result = {};
  for (const [name, value] of Object.entries(fields || {})) {
    const key = String(name).replace(/^.*?(Page\d\[0\]\.)/, '$1');
    if (value && typeof value === 'object') result[key] = value.radio || value.dropdown || '';
    else result[key] = value;
  }
  return result;
}

function amount(value) {
  if (value === undefined || value === null || value === true) return null;
  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function filled(value) {
  return value === true || (value !== undefined && value !== null && String(value).trim() !== '');
}

function money(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function reviewFl150(rawFields, lang = 'en') {
  const language = MESSAGES.payBasis[lang] ? lang : 'en';
  const f = normalizeFields(rawFields);
  const issues = [];
  const add = (kind, item, key, values = {}) => {
    const text = MESSAGES[key][language].replace(/\{(\w+)\}/g, (_, name) => (name in values ? values[name] : `{${name}}`));
    issues.push({ kind, item, key, text });
  };
  const has = (id) => filled(f[id]);
  const num = (id) => amount(f[id]);
  const sum = (ids) => ids.reduce((total, id) => total + (num(id) || 0), 0);

  // Item 1: pay and its basis.
  const pay = num(`${P1}List1[0].Li8[0].gross_tf[0]`);
  const basis = [0, 1, 2].filter((index) => f[`${P1}List1[0].Li8[0].Gross_cb[${index}]`] === true);
  const employed = has(`${P1}List1[0].Li1[0].Employer_tf[0]`) && !has(`${P1}List1[0].Li6[0].FillText1[0]`);
  if (pay !== null && basis.length !== 1) add('check', '1h', 'payBasis');
  if (pay === null && employed) add('check', '1h', 'payMissing');

  const wagesAverage = num(INCOME_ROWS[0][2]);
  if (pay !== null && basis.length === 1) {
    const hours = num(`${P1}List1[0].Li7[0].hours_tf[0]`);
    let monthly = null;
    if (basis[0] === 0) monthly = pay;
    if (basis[0] === 1) monthly = pay * 52 / 12;
    if (basis[0] === 2) {
      if (hours) monthly = pay * hours * 52 / 12;
      else add('check', '1g', 'hoursMissing');
    }
    if (monthly !== null && wagesAverage === null && num(INCOME_ROWS[0][1]) === null && employed) add('check', '5a', 'wagesMissing');
    if (monthly !== null && wagesAverage !== null && monthly > 0 && Math.abs(monthly - wagesAverage) / monthly > 0.15) {
      add('math', '5a', 'wagesMismatch', { monthly: money(monthly), average: money(wagesAverage) });
    }
  }

  // Items 5-7: both columns, "specify" lines and the boxes on a line.
  for (const [item, last, average] of INCOME_ROWS) {
    if (has(last) && !has(average)) add('check', item, 'averageMissing', { item });
    if (!has(last) && has(average)) add('check', item, 'lastMissing', { item });
  }
  const rowHasAmount = (item) => {
    const row = INCOME_ROWS.find(([name]) => name === item);
    return (num(row[1]) || 0) > 0 || (num(row[2]) || 0) > 0;
  };
  if (rowHasAmount('5l') && !has(`${P2}List5[0].Li12[0].FillText1[0]`)) add('check', '5l', 'specifyMissing', { item: '5l' });
  if (rowHasAmount('6d') && !has(`${P2}List6[0].L4[0].FillText1[0]`)) add('check', '6d', 'specifyMissing', { item: '6d' });
  if (rowHasAmount('5e') && !['CBChoice1_cb[0]', 'CBChoice1_cb2[0]'].some((box) => f[`${P2}List5[0].Li5[0].${box}`] === true)) add('check', '5e', 'boxMissing', { item: '5e' });
  if (rowHasAmount('5f') && !['CBChoice1_cb[0]', 'CBChoice1_cb2[0]'].some((box) => f[`${P2}List5[0].Li6[0].${box}`] === true)) add('check', '5f', 'boxMissing', { item: '5f' });
  if (rowHasAmount('5i') && !['CBChoice1_cb[0]', 'CBChoice1_cb1[0]', 'CBChoice1_cb2[0]'].some((box) => f[`${P2}List5[0].Li9[0].${box}`] === true)) add('check', '5i', 'boxMissing', { item: '5i' });

  const business = `${P2}List7[0].L1[0].`;
  if (rowHasAmount('7')) {
    const role = ['CBChoice1_cb[0]', 'CBChoice1_cb1[0]', 'RB2Choices[0]'].some((box) => f[business + box] === true);
    if (!role || !has(`${business}FillText1[0]`) || !has(`${business}FillText2[0]`) || !has(`${business}FillText3[0]`)) add('check', '7', 'businessDetails');
    if (f[`${business}RB2Choices[0]`] === true && !has(`${business}FillText109[0]`)) add('check', '7', 'specifyMissing', { item: '7' });
  }

  // Items 8 and 9: box and explanation go together.
  for (const [item, box, text] of [['8', `${P2}List8[0].Li1[0].CheckBox19[0]`, `${P2}List8[0].Li1[0].TextField6[0]`], ['9', `${P2}List9[0].L1[0].CheckBox1[0]`, `${P2}List9[0].L1[0].TextField6[0]`]]) {
    if (f[box] === true && !has(text)) add('check', item, 'boxWithoutText', { item });
    if (f[box] !== true && has(text)) add('check', item, 'textWithoutBox', { item });
  }

  // Item 10 against last month's income.
  const incomeLastMonth = sum(INCOME_ROWS.map((row) => row[1]));
  const deductions = sum(DEDUCTIONS.map(([, id]) => id));
  if (incomeLastMonth > 0 && deductions > incomeLastMonth) {
    add('math', '10', 'deductionsExceed', { deductions: money(deductions), income: money(incomeLastMonth) });
  }

  // Item 13: total, basis, mortgage split.
  const expenseSum = sum(EXPENSES.map(([, id]) => id));
  const total = num(EXPENSE_TOTAL);
  if (expenseSum > 0 && total === null) add('math', '13r', 'expenseTotalMissing', { sum: money(expenseSum) });
  if (total !== null && Math.abs(total - expenseSum) > 1) add('math', '13r', 'expenseTotalMismatch', { total: money(total), sum: money(expenseSum) });
  if (expenseSum > 0 && ![0, 1, 2].some((index) => f[`${E}MonthEx_cb[${index}]`] === true)) add('check', '13', 'expenseBasis');
  if (num(EXPENSES[EXPENSES.length - 1][1]) && !has(`${E}Li17[0].FillText1[0]`)) add('check', '13q', 'specifyMissing', { item: '13q' });
  const payment = num(`${MORTGAGE}EXPN[0]`);
  const split = sum([`${MORTGAGE}List[0].L1[0].MortPrin[0]`, `${MORTGAGE}List[0].L2[0].MortInt[0]`]);
  if (payment !== null && split > payment + 1) add('math', '13a(1)', 'mortgageSplit', { split: money(split), payment: money(payment) });

  // Item 14 against 13p.
  const installments = sum(INSTALLMENT_AMOUNTS);
  const line13p = num(`${E}Li16[0].EXPN[0]`);
  if (installments > 0 && (line13p === null || Math.abs(line13p - installments) > 1)) {
    add('math', '13p', 'installments', { sum: money(installments), shown: line13p === null ? '—' : money(line13p) });
  }
  if (INSTALLMENT_AMOUNTS.some((id, index) => has(id) && !has(INSTALLMENT_PAID_TO[index]))) add('check', '14', 'installmentPayee');

  // Item 12: who lives with you.
  const householdRows = [
    ['a', 'L1[0].FillText1[0]', 'L1[0].item12a_cb'],
    ['b', 'L2[0].FillText1[0]', 'L2[0].People2_cb'],
    ['c', 'L3[0].FillText1[0]', 'L3[0].People3_cb'],
    ['d', 'L4[0].FillText1[0]', 'L4[0].People4_cb'],
    ['e', 'L5[0].FillText1[0]', 'L5[0].People5_cb']
  ];
  for (const [row, name, box] of householdRows) {
    if (has(`${P3}List12[0].${name}`) && f[`${P3}List12[0].${box}[0]`] !== true && f[`${P3}List12[0].${box}[1]`] !== true) add('check', '12', 'household', { row });
  }

  // Items 3, 4 and the declaration on page 1.
  if (has(`${P1}List4[0].Li1[0].FillTextincm[0]`) && !has(`${P1}List4[0].Li1[0].FillText1[0]`)) add('check', '4', 'otherPartyBasis');
  if (!has(`${P1}List3[0].Li1[0].FillText109[0]`)) add('check', '3a', 'taxYear');
  const statuses = ['Tax_cb1[0]', 'Tax_cb2[0]', 'Tax_cb3[0]', 'RB2Choices[0]'].filter((box) => f[`${P1}List3[0].Li2[0].${box}`] === true);
  if (statuses.length !== 1) add('check', '3b', 'taxStatus');
  if (!has(`${P1}FillText56[0]`) || !has(`${P1}Signdate[0]`)) add('check', '1', 'declarant');

  // Items 15-19.
  if (has(`${P3}List15[0].L1[0].FillText1[0]`) && (num(`${P3}List15[0].L1[0].FillText1[0]`) || 0) > 0 && !has(`${P3}List15[0].L2[0].FillText1[0]`)) add('check', '15b', 'attorneySource');
  const mine = num(`${P4}List16[0].L2[0].TextField[0]`);
  const other = num(`${P4}List16[0].L2[0].TextField1[0]`);
  if (mine !== null && other !== null && Math.abs(mine + other - 100) > 0.5) add('math', '16b', 'timeshare', { mine, other, sum: mine + other });
  if (f[`${P4}List17[0].L1[0].ChildHC_cb[0]`] === true && (!has(`${P4}List17[0].L2[0].FillText1[0]`) || !has(`${P4}List17[0].L4[0].FillText1[0]`))) add('check', '17', 'childInsurance');
  const hardships = [
    ['a', `${P4}List19[0].L1[0].FillText1[0]`, `${P4}List19[0].L1[0].TextField24[0]`],
    ['b', `${P4}List19[0].L2[0].FillText1[0]`, `${P4}List19[0].L2[0].TextField25[0]`],
    ['c', `${P4}List19[0].L3[0].List[0].L1[0].FillText1[0]`, `${P4}List19[0].L3[0].List[0].L1[0].TextField26[0]`]
  ];
  for (const [item, value, months] of hardships) {
    if ((num(value) || 0) > 0 && !has(months)) add('check', `19${item}`, 'hardshipMonths', { item });
  }
  const anyHardship = hardships.some(([, value]) => (num(value) || 0) > 0);
  if (anyHardship && !has(`${P4}List19[0].L3[0].TextField6[0]`)) add('check', '19', 'hardshipReason');

  // Attachments the form asks for.
  const attachments = [];
  if (pay !== null || ['5a', '5b', '5c'].some(rowHasAmount)) attachments.push(['5', 'attachPayStubs']);
  if (['6a', '6b', '6c', '6d'].some(rowHasAmount)) attachments.push(['6', 'attachInvestment']);
  if (rowHasAmount('7')) attachments.push(['7', 'attachBusiness']);
  if ((num(DEDUCTIONS[6][1]) || 0) > 0) attachments.push(['10g', 'attach10g']);
  if (anyHardship) attachments.push(['19', 'attachHardship']);
  for (const [item, key] of attachments) add('attach', item, key);
  if (attachments.length && !has(`${P1}FillTextpage[0]`)) add('check', '1', 'pagesAttached');

  return issues;
}

module.exports = { reviewFl150, FL150_LABELS, MESSAGES };
