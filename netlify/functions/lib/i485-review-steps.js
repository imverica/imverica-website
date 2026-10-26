// Form I-485 (edition 09/18/26) wizard steps for the items the original flow
// did not ask: other dates of birth and A-Numbers, the I-94 name, Part 1
// Items 13 and 15-17, the filing category, Part 3, Part 4 Items 1-6, the
// current spouse, public charge (Part 9, Items 56-64) and interpreter and
// preparer contact details. Step order and page metadata live in
// immigration-flow-schema.js.
const {
  CATEGORIES,
  PUBLIC_CHARGE_OPTIONS,
  PUBLIC_CHARGE_NOT_EXEMPT,
  I864_OPTIONS,
  categoriesForBasis
} = require('./i485-categories');

const CATEGORY_KEY_BY_BASIS = {
  'Family petition': 'i485_category_family',
  'Employment petition': 'i485_category_employment',
  'VAWA / special immigrant': 'i485_category_special',
  'Asylee or refugee': 'i485_category_asylee',
  'Other or not sure': 'i485_category_other'
};

const STATUS_EXPIRATION_KINDS = ['A date', 'D/S (duration of status)', 'My status does not expire'];

const INCOME_OPTIONS = ['$0-27,000', '$27,001-52,000', '$52,001-85,000', '$85,001-141,000', 'Over $141,000'];
const ASSET_OPTIONS = ['$0-18,400', '$18,401-136,000', '$136,001-321,400', '$321,401-707,100', 'Over $707,100'];
const LIABILITY_OPTIONS = ['$0', '$1-10,100', '$10,101-57,700', '$57,701-186,800', 'Over $186,800'];
const EDUCATION_OPTIONS = [
  'Less than a high school diploma',
  'High school diploma, GED, or alternative credential',
  '1 or more years of college credit, no degree',
  "Associate's degree",
  "Bachelor's degree",
  "Master's degree",
  'Professional degree (JD, MD, DMD, etc.)',
  'Doctorate degree'
];

const PUBLIC_CHARGE_NOT_EXEMPT_LABEL = PUBLIC_CHARGE_OPTIONS.find(([index]) => index === PUBLIC_CHARGE_NOT_EXEMPT)[1];

// showWhenAny conditions matching the categories for which `predicate` holds.
function whenCategory(predicate) {
  const conditions = [];
  for (const [basis, key] of Object.entries(CATEGORY_KEY_BY_BASIS)) {
    const values = categoriesForBasis(basis).filter(predicate).map((category) => category.value);
    if (values.length) conditions.push({ id: key, in: values });
  }
  const dv = CATEGORIES.find((category) => category.basis === 'Diversity visa');
  if (dv && predicate(dv)) conditions.push({ id: 'adjustment_basis', equals: 'Diversity visa' });
  return conditions;
}

// Part 9, Items 57-64 apply when the category is not exempt from public charge.
function publicChargeAppliesWhenAny() {
  return [
    ...whenCategory((category) => category.publicCharge === PUBLIC_CHARGE_NOT_EXEMPT),
    { id: 'public_charge_exemption', equals: PUBLIC_CHARGE_NOT_EXEMPT_LABEL }
  ];
}

function i485ReviewSteps({ field, step, addressBlockField, COUNTRY_OPTIONS }) {
  const yesNo = (id, label, extra = {}) => field(id, label, 'radio', { required: true, options: ['Yes', 'No'], ...extra });
  const married = [{ id: 'marital_status', equals: 'Married' }];

  return [
    step('i485_other_dob', 'I-485 other dates of birth', 'Part 1, Item 3.', [
      yesNo('other_dob_used', 'Have you ever used any other date of birth?'),
      field('other_dob_1', 'Other date of birth used', 'date', { required: true, showWhen: [{ id: 'other_dob_used', equals: 'Yes' }] }),
      field('other_dob_2', 'Another date of birth used, if any', 'date', { showWhen: [{ id: 'other_dob_used', equals: 'Yes' }] })
    ]),
    step('i485_other_names_detail', 'I-485 other names', 'Part 1, Item 2: family name at birth, other legal names, nicknames, aliases.', [
      field('other_name_family', 'Other name 1: family name', 'text', { required: true, showWhen: [{ id: 'has_other_names', equals: 'Yes' }] }),
      field('other_name_given', 'Other name 1: given name', 'text', { showWhen: [{ id: 'has_other_names', equals: 'Yes' }] }),
      field('other_name_middle', 'Other name 1: middle name', 'text', { showWhen: [{ id: 'has_other_names', equals: 'Yes' }] }),
      field('other_name2_family', 'Other name 2: family name', 'text', { showWhen: [{ id: 'has_other_names', equals: 'Yes' }] }),
      field('other_name2_given', 'Other name 2: given name', 'text', { showWhen: [{ id: 'has_other_names', equals: 'Yes' }] }),
      field('other_name2_middle', 'Other name 2: middle name', 'text', { showWhen: [{ id: 'has_other_names', equals: 'Yes' }] })
    ]),
    step('i485_prior_a_numbers', 'I-485 other A-Numbers', 'Part 1, Item 5.', [
      yesNo('has_prior_alien_number', 'Have you ever used, or been assigned, any other A-Number?'),
      field('prior_alien_number_1', 'Other A-Number', 'text', { required: true, autocomplete: 'off', showWhen: [{ id: 'has_prior_alien_number', equals: 'Yes' }] }),
      field('prior_alien_number_2', 'Another A-Number, if any', 'text', { autocomplete: 'off', showWhen: [{ id: 'has_prior_alien_number', equals: 'Yes' }] })
    ]),
    step('i485_i94_name', 'I-485 name on the I-94', 'Part 1, Item 12. Exactly as printed on your most recent I-94. Leave blank if it matches your legal name.', [
      field('i94_family_name', 'Family name as shown on the I-94', 'text'),
      field('i94_given_name', 'Given name as shown on the I-94', 'text')
    ]),
    step('i485_first_arrival', 'I-485 first time in the United States', 'Part 1, Item 13.', [
      yesNo('first_time_in_us', 'Was your last arrival the first time you were physically present in the United States?')
    ]),
    step('i485_current_status_expiration', 'I-485 expiration of current status', 'Part 1, Item 15. Asylee and refugee status does not expire.', [
      field('current_status_expiration_kind', 'When does your current immigration status expire?', 'radio', { required: true, options: STATUS_EXPIRATION_KINDS }),
      field('current_status_expires_on', 'Expiration date of your current immigration status', 'date', {
        required: true,
        showWhen: [{ id: 'current_status_expiration_kind', equals: STATUS_EXPIRATION_KINDS[0] }]
      })
    ]),
    step('i485_crewman', 'I-485 crewman questions', 'Part 1, Items 16-17.', [
      yesNo('crewman_visa_issued', 'Have you ever been issued an "alien crewman" visa?'),
      yesNo('arrived_as_crewman', 'Did you last arrive in the United States to join a vessel as a seaman or crewman, or while serving in any capacity aboard a vessel or aircraft?')
    ]),
    step('i485_category', 'I-485 filing category', 'Part 2, Item 3. Choose the exact category of your petition or status.', Object.entries(CATEGORY_KEY_BY_BASIS).map(([basis, key]) =>
      field(key, 'Exact filing category', 'select', {
        required: true,
        options: categoriesForBasis(basis).map((category) => category.value),
        showWhen: [{ id: 'adjustment_basis', equals: basis }]
      })
    )),
    step('i485_category_details', 'I-485 category details', 'Part 2, Item 3 follow-up questions.', [
      field('asylum_grant_date', 'Date you were granted asylum', 'date', {
        required: true,
        showWhen: [{ id: 'i485_category_asylee', equals: 'Asylee (INA 208, Form I-589 or I-730)' }]
      }),
      field('refugee_admission_date', 'Date of initial admission as a refugee', 'date', {
        required: true,
        showWhen: [{ id: 'i485_category_asylee', equals: 'Refugee (INA 207, Form I-590 or I-730)' }]
      }),
      field('dv_rank_number', 'Diversity Visa rank number', 'text', { required: true, showWhen: [{ id: 'adjustment_basis', equals: 'Diversity visa' }] }),
      field('other_eligibility_text', 'Describe your other eligibility', 'text', { required: true, showWhen: [{ id: 'i485_category_other', equals: 'Other eligibility' }] }),
      yesNo('eb_relative_petitioner', 'Did a relative file the Form I-140 for you, or does a relative own 5% or more of the business that filed it?', {
        showWhenAny: whenCategory((category) => category.i864 === 'relative')
      })
    ]),
    step('i485_filing_as', 'I-485 principal or derivative applicant', 'Part 2, Item 2.', [
      field('filing_as', 'I am filing this Form I-485 as a', 'radio', { required: true, options: ['Principal applicant', 'Derivative applicant'] }),
      field('principal_family_name', "Principal applicant's family name", 'text', { required: true, showWhen: [{ id: 'filing_as', equals: 'Derivative applicant' }] }),
      field('principal_given_name', "Principal applicant's given name", 'text', { required: true, showWhen: [{ id: 'filing_as', equals: 'Derivative applicant' }] }),
      field('principal_middle_name', "Principal applicant's middle name", 'text', { showWhen: [{ id: 'filing_as', equals: 'Derivative applicant' }] }),
      field('principal_alien_number', "Principal applicant's A-Number, if any", 'text', { autocomplete: 'off', showWhen: [{ id: 'filing_as', equals: 'Derivative applicant' }] }),
      field('principal_dob', "Principal applicant's date of birth", 'date', { required: true, showWhen: [{ id: 'filing_as', equals: 'Derivative applicant' }] })
    ]),
    step('i485_affidavit_support', 'I-485 Affidavit of Support', 'Part 3. Skipped when your category answers it.', [
      field('affidavit_support_exemption', 'Affidavit of Support (Form I-864)', 'select', {
        required: true,
        options: I864_OPTIONS.map(([, label]) => label),
        showWhenAny: whenCategory((category) => category.i864 === 'ask')
      })
    ]),
    step('i485_prior_applications', 'I-485 immigrant visa abroad', 'Part 4, Items 1-4.', [
      yesNo('immigrant_visa_abroad', 'Have you ever applied for an immigrant visa to obtain permanent resident status at a U.S. Embassy or U.S. Consulate abroad?'),
      field('consulate_city', 'Embassy or consulate city', 'text', { required: true, showWhen: [{ id: 'immigrant_visa_abroad', equals: 'Yes' }] }),
      field('consulate_country', 'Embassy or consulate country', 'select', { required: true, options: COUNTRY_OPTIONS, showWhen: [{ id: 'immigrant_visa_abroad', equals: 'Yes' }] }),
      field('consulate_decision', 'Decision (for example, approved, refused, denied, withdrawn)', 'text', { required: true, showWhen: [{ id: 'immigrant_visa_abroad', equals: 'Yes' }] }),
      field('consulate_decision_date', 'Date of decision', 'date', { showWhen: [{ id: 'immigrant_visa_abroad', equals: 'Yes' }] })
    ]),
    step('i485_prior_adjustment', 'I-485 prior permanent residence', 'Part 4, Items 5-6.', [
      yesNo('prior_lpr_application_us', 'Have you previously applied for permanent residence while in the United States?'),
      yesNo('lpr_rescinded', 'Have you EVER held lawful permanent resident status which was later rescinded under INA section 246?')
    ]),
    step('i485_current_spouse_details', 'I-485 current spouse details', 'Part 6, Items 2, 6 and 10.', [
      field('spouse_middle_name', 'Current spouse middle name', 'text', { showWhen: married }),
      field('spouse_dob', 'Current spouse date of birth', 'date', { required: true, showWhen: married }),
      yesNo('spouse_in_armed_forces', 'Is your spouse a current member of the U.S. armed forces or U.S. Coast Guard?', { showWhen: married }),
      yesNo('spouse_applying_with_you', 'Is your current spouse applying with you?', { showWhen: married })
    ]),
    step('i485_current_spouse_address', 'I-485 current spouse address', 'Part 6, Item 8.', [
      yesNo('spouse_same_address', 'Does your spouse live at your current physical address?', { showWhen: married }),
      addressBlockField('spouse_address', "Current spouse's physical address", 'spouse_physical', {
        required: true,
        showWhen: [...married, { id: 'spouse_same_address', equals: 'No' }]
      })
    ]),
    step('i485_prior_spouse_middle', 'I-485 prior spouse middle name', 'Part 6, Item 11.', [
      field('prior_spouse_middle_name', 'Prior spouse middle name', 'text', {
        showWhenAny: [{ id: 'marital_status', in: ['Divorced', 'Widowed', 'Separated', 'Annulled'] }, { id: 'times_married', gte: 2 }]
      })
    ]),
    step('i485_interpreter_contact', 'I-485 interpreter contact', 'Part 11.', [
      field('interpreter_language', 'Language the interpreter used with the applicant', 'text', { required: true, showWhen: [{ id: 'has_interpreter', equals: 'Yes' }] }),
      field('interpreter_phone', "Interpreter's daytime phone", 'phone', { required: true, showWhen: [{ id: 'has_interpreter', equals: 'Yes' }] }),
      field('interpreter_mobile', "Interpreter's mobile phone, if any", 'phone', { showWhen: [{ id: 'has_interpreter', equals: 'Yes' }] }),
      field('interpreter_email', "Interpreter's email, if any", 'email', { showWhen: [{ id: 'has_interpreter', equals: 'Yes' }] })
    ]),
    step('i485_preparer_contact', 'I-485 preparer contact', 'Part 12.', [
      field('preparer_phone', "Preparer's daytime phone", 'phone', { required: true, showWhen: [{ id: 'has_preparer', equals: 'Yes' }] }),
      field('preparer_mobile', "Preparer's mobile phone, if any", 'phone', { showWhen: [{ id: 'has_preparer', equals: 'Yes' }] }),
      field('preparer_email', "Preparer's email, if any", 'email', { showWhen: [{ id: 'has_preparer', equals: 'Yes' }] })
    ])
  ];
}

// Part 9, Items 56-62 (before Item 63) and 64 (after it).
function i485PublicChargeSteps({ field, step }) {
  const applies = publicChargeAppliesWhenAny();
  const before = [
    step('i485_part9_public_charge_56', 'Part 9 public charge: exemption', 'Part 9, Item 56. Skipped when your filing category answers it.', [
      field('public_charge_exemption', 'I am exempt from the public charge ground of inadmissibility because I am a/an', 'select', {
        required: true,
        options: PUBLIC_CHARGE_OPTIONS.map(([, label]) => label),
        showWhenAny: whenCategory((category) => category.publicCharge === null)
      })
    ]),
    step('i485_part9_public_charge_57', 'Part 9 public charge: household', 'Part 9, Items 57-59. Only for categories subject to public charge.', [
      field('pc_household', 'Describe your family status (for example, your household size)', 'text', { required: true, showWhenAny: applies }),
      field('pc_income', 'Annual household income', 'select', { required: true, options: INCOME_OPTIONS, showWhenAny: applies }),
      field('pc_assets', 'Total value of household assets', 'select', { required: true, options: ASSET_OPTIONS, showWhenAny: applies })
    ]),
    step('i485_part9_public_charge_60', 'Part 9 public charge: liabilities and education', 'Part 9, Items 60-61.', [
      field('pc_liabilities', 'Total value of household liabilities', 'select', { required: true, options: LIABILITY_OPTIONS, showWhenAny: applies }),
      field('pc_education', 'Highest degree or level of school completed', 'select', { required: true, options: EDUCATION_OPTIONS, showWhenAny: applies }),
      field('pc_highest_grade', 'Highest grade of school completed', 'text', { required: true, showWhen: [{ id: 'pc_education', equals: EDUCATION_OPTIONS[0] }] })
    ]),
    step('i485_part9_public_charge_62', 'Part 9 public charge: skills', 'Part 9, Item 62. One per line: certifications, licenses, work skills, languages.', [
      field('pc_skills', 'Your skills, licenses and certificates (one per line)', 'textarea', { required: true, showWhenAny: applies })
    ])
  ];
  const after = [1, 2, 3, 4].map((row) => {
    const showWhen = [{ id: 'Pt9Line63_YesNo', equals: 'Yes' }, ...(row > 1 ? [{ id: `pc_benefit${row - 1}_name`, hasValue: true }] : [])];
    return step(`i485_part9_public_charge_64_${row}`, `Part 9 public charge: benefit ${row}`, 'Part 9, Item 64. Leave blank if there are no more benefits.', [
      field(`pc_benefit${row}_name`, 'Means-tested public benefit received', 'text', { required: row === 1, showWhen }),
      field(`pc_benefit${row}_start`, 'Start date', 'date', { showWhen }),
      field(`pc_benefit${row}_end`, 'End date', 'date', { showWhen }),
      field(`pc_benefit${row}_amount`, 'Dollar amount (if applicable)', 'text', { showWhen }),
      field(`pc_benefit${row}_reason`, 'Reason you received the benefit', 'text', { showWhen })
    ]);
  });
  return { before, after, applies };
}

const I485_REVIEW_LOCALIZATION = {
  ru: {
    steps: {
      i485_other_dob: 'I-485: другие даты рождения',
      i485_other_names_detail: 'I-485: другие имена',
      i485_prior_a_numbers: 'I-485: другие A-номера',
      i485_i94_name: 'I-485: имя в I-94',
      i485_first_arrival: 'I-485: первый въезд в США',
      i485_current_status_expiration: 'I-485: срок текущего статуса',
      i485_crewman: 'I-485: вопросы о членах экипажа',
      i485_category: 'I-485: категория подачи',
      i485_category_details: 'I-485: детали категории',
      i485_filing_as: 'I-485: основной заявитель или derivative',
      i485_affidavit_support: 'I-485: Affidavit of Support (I-864)',
      i485_prior_applications: 'I-485: иммиграционная виза за рубежом',
      i485_prior_adjustment: 'I-485: прежние заявления на green card',
      i485_current_spouse_details: 'I-485: данные текущего супруга',
      i485_current_spouse_address: 'I-485: адрес текущего супруга',
      i485_prior_spouse_middle: 'I-485: middle name бывшего супруга',
      i485_interpreter_contact: 'I-485: контакты переводчика',
      i485_preparer_contact: 'I-485: контакты составителя',
      i485_part9_public_charge: 'Part 9: public charge'
    },
    fields: {
      other_dob_used: 'Использовали ли вы когда-либо другую дату рождения?',
      other_dob_1: 'Другая дата рождения',
      other_dob_2: 'Ещё одна дата рождения, если есть',
      other_name_family: 'Другое имя 1: фамилия',
      other_name_given: 'Другое имя 1: имя',
      other_name_middle: 'Другое имя 1: middle name',
      other_name2_family: 'Другое имя 2: фамилия',
      other_name2_given: 'Другое имя 2: имя',
      other_name2_middle: 'Другое имя 2: middle name',
      has_prior_alien_number: 'Был ли у вас когда-либо другой A-номер?',
      prior_alien_number_1: 'Другой A-номер',
      prior_alien_number_2: 'Ещё один A-номер, если есть',
      i94_family_name: 'Фамилия, как в I-94',
      i94_given_name: 'Имя, как в I-94',
      first_time_in_us: 'Был ли последний въезд вашим первым пребыванием в США?',
      current_status_expiration_kind: 'Когда истекает ваш текущий иммиграционный статус?',
      current_status_expires_on: 'Дата окончания текущего статуса',
      crewman_visa_issued: 'Выдавалась ли вам когда-либо виза члена экипажа ("alien crewman")?',
      arrived_as_crewman: 'Прибыли ли вы в последний раз в США, чтобы присоединиться к судну как моряк или член экипажа, или во время службы на судне или самолёте?',
      i485_category_family: 'Точная категория подачи',
      i485_category_employment: 'Точная категория подачи',
      i485_category_special: 'Точная категория подачи',
      i485_category_asylee: 'Точная категория подачи',
      i485_category_other: 'Точная категория подачи',
      asylum_grant_date: 'Дата предоставления асайлума',
      refugee_admission_date: 'Дата первого въезда в статусе беженца',
      dv_rank_number: 'Номер Diversity Visa (rank number)',
      other_eligibility_text: 'Опишите другое основание',
      eb_relative_petitioner: 'Подал ли I-140 ваш родственник, или владеет ли родственник 5% или более компании-петиционера?',
      filing_as: 'Я подаю эту I-485 как',
      principal_family_name: 'Основной заявитель: фамилия',
      principal_given_name: 'Основной заявитель: имя',
      principal_middle_name: 'Основной заявитель: middle name',
      principal_alien_number: 'Основной заявитель: A-номер, если есть',
      principal_dob: 'Основной заявитель: дата рождения',
      affidavit_support_exemption: 'Affidavit of Support (форма I-864)',
      immigrant_visa_abroad: 'Подавали ли вы когда-либо на иммиграционную визу в посольстве или консульстве США за рубежом?',
      consulate_city: 'Город посольства или консульства',
      consulate_country: 'Страна посольства или консульства',
      consulate_decision: 'Решение (например, approved, refused, denied, withdrawn)',
      consulate_decision_date: 'Дата решения',
      prior_lpr_application_us: 'Подавали ли вы раньше на постоянное жительство, находясь в США?',
      lpr_rescinded: 'Был ли у вас КОГДА-ЛИБО статус постоянного жителя, позже отменённый по INA 246?',
      spouse_middle_name: 'Текущий супруг: middle name',
      spouse_dob: 'Текущий супруг: дата рождения',
      spouse_in_armed_forces: 'Служит ли ваш супруг сейчас в вооружённых силах США или в Береговой охране?',
      spouse_applying_with_you: 'Подаёт ли ваш текущий супруг вместе с вами?',
      spouse_same_address: 'Живёт ли супруг по вашему текущему адресу?',
      spouse_address: 'Физический адрес текущего супруга',
      prior_spouse_middle_name: 'Бывший супруг: middle name',
      interpreter_language: 'Язык, на котором переводчик работал с заявителем',
      interpreter_phone: 'Дневной телефон переводчика',
      interpreter_mobile: 'Мобильный телефон переводчика, если есть',
      interpreter_email: 'Email переводчика, если есть',
      preparer_phone: 'Дневной телефон составителя',
      preparer_mobile: 'Мобильный телефон составителя, если есть',
      preparer_email: 'Email составителя, если есть',
      public_charge_exemption: 'Я освобождён от public charge, потому что я',
      pc_household: 'Опишите семейное положение (например, размер домохозяйства)',
      pc_income: 'Годовой доход домохозяйства',
      pc_assets: 'Общая стоимость активов домохозяйства',
      pc_liabilities: 'Общая сумма долгов домохозяйства',
      pc_education: 'Наивысший уровень образования',
      pc_highest_grade: 'Последний законченный класс школы',
      pc_skills: 'Ваши навыки, лицензии и сертификаты (по одному в строке)',
      pc_benefit1_name: 'Полученное means-tested пособие',
      pc_benefit2_name: 'Полученное means-tested пособие',
      pc_benefit3_name: 'Полученное means-tested пособие',
      pc_benefit4_name: 'Полученное means-tested пособие'
    },
    options: {
      'A date': 'Конкретная дата',
      'D/S (duration of status)': 'D/S (на срок статуса)',
      'My status does not expire': 'Мой статус не истекает',
      'Principal applicant': 'Основной заявитель',
      'Derivative applicant': 'Derivative (член семьи основного заявителя)',
      'A sponsor will file Form I-864 or I-864EZ for me': 'Спонсор подаст за меня I-864 или I-864EZ',
      'I have earned or can be credited with 40 qualifying quarters of work': 'У меня есть 40 кварталов работы (credits)',
      'I am under 18, unmarried, the child of a U.S. citizen and will become a citizen automatically (INA 320)': 'Мне меньше 18, я не в браке, ребёнок гражданина США и стану гражданином автоматически (INA 320)',
      'An Affidavit of Support is not required for my category': 'Для моей категории Affidavit of Support не требуется',
      'I do not fall under any of the exempt categories': 'Я не отношусь ни к одной из освобождённых категорий',
      'Less than a high school diploma': 'Без аттестата о среднем образовании',
      'High school diploma, GED, or alternative credential': 'Аттестат о среднем образовании или GED',
      '1 or more years of college credit, no degree': '1 год или больше колледжа, без диплома',
      "Associate's degree": 'Associate (2-летний диплом)',
      "Bachelor's degree": 'Бакалавр',
      "Master's degree": 'Магистр',
      'Professional degree (JD, MD, DMD, etc.)': 'Профессиональная степень (JD, MD, DMD и т. п.)',
      'Doctorate degree': 'Доктор наук (PhD)'
    }
  },
  uk: {
    steps: {
      i485_other_dob: 'I-485: інші дати народження',
      i485_other_names_detail: 'I-485: інші імена',
      i485_prior_a_numbers: 'I-485: інші A-номери',
      i485_i94_name: "I-485: ім'я в I-94",
      i485_first_arrival: 'I-485: перший в’їзд до США',
      i485_current_status_expiration: 'I-485: строк поточного статусу',
      i485_crewman: 'I-485: питання про членів екіпажу',
      i485_category: 'I-485: категорія подачі',
      i485_category_details: 'I-485: деталі категорії',
      i485_filing_as: 'I-485: основний заявник чи derivative',
      i485_affidavit_support: 'I-485: Affidavit of Support (I-864)',
      i485_prior_applications: 'I-485: імміграційна віза за кордоном',
      i485_prior_adjustment: 'I-485: попередні заяви на green card',
      i485_current_spouse_details: 'I-485: дані чинного подружжя',
      i485_current_spouse_address: 'I-485: адреса чинного подружжя',
      i485_prior_spouse_middle: 'I-485: middle name колишнього подружжя',
      i485_interpreter_contact: 'I-485: контакти перекладача',
      i485_preparer_contact: 'I-485: контакти укладача',
      i485_part9_public_charge: 'Part 9: public charge'
    },
    fields: {
      other_dob_used: 'Чи використовували ви колись іншу дату народження?',
      other_dob_1: 'Інша дата народження',
      other_dob_2: 'Ще одна дата народження, якщо є',
      other_name_family: "Інше ім'я 1: прізвище",
      other_name_given: "Інше ім'я 1: ім'я",
      other_name_middle: "Інше ім'я 1: middle name",
      other_name2_family: "Інше ім'я 2: прізвище",
      other_name2_given: "Інше ім'я 2: ім'я",
      other_name2_middle: "Інше ім'я 2: middle name",
      has_prior_alien_number: 'Чи був у вас колись інший A-номер?',
      prior_alien_number_1: 'Інший A-номер',
      prior_alien_number_2: 'Ще один A-номер, якщо є',
      i94_family_name: 'Прізвище, як в I-94',
      i94_given_name: "Ім'я, як в I-94",
      first_time_in_us: 'Чи був останній в’їзд вашим першим перебуванням у США?',
      current_status_expiration_kind: 'Коли закінчується ваш поточний імміграційний статус?',
      current_status_expires_on: 'Дата закінчення поточного статусу',
      crewman_visa_issued: 'Чи видавали вам колись візу члена екіпажу ("alien crewman")?',
      arrived_as_crewman: 'Чи прибули ви востаннє до США, щоб приєднатися до судна як моряк або член екіпажу, або під час служби на судні чи літаку?',
      i485_category_family: 'Точна категорія подачі',
      i485_category_employment: 'Точна категорія подачі',
      i485_category_special: 'Точна категорія подачі',
      i485_category_asylee: 'Точна категорія подачі',
      i485_category_other: 'Точна категорія подачі',
      asylum_grant_date: 'Дата надання притулку',
      refugee_admission_date: 'Дата першого в’їзду в статусі біженця',
      dv_rank_number: 'Номер Diversity Visa (rank number)',
      other_eligibility_text: 'Опишіть іншу підставу',
      eb_relative_petitioner: 'Чи подав I-140 ваш родич, або чи володіє родич 5% або більше компанії-петиціонера?',
      filing_as: 'Я подаю цю I-485 як',
      principal_family_name: 'Основний заявник: прізвище',
      principal_given_name: "Основний заявник: ім'я",
      principal_middle_name: 'Основний заявник: middle name',
      principal_alien_number: 'Основний заявник: A-номер, якщо є',
      principal_dob: 'Основний заявник: дата народження',
      affidavit_support_exemption: 'Affidavit of Support (форма I-864)',
      immigrant_visa_abroad: 'Чи подавали ви колись на імміграційну візу в посольстві чи консульстві США за кордоном?',
      consulate_city: 'Місто посольства чи консульства',
      consulate_country: 'Країна посольства чи консульства',
      consulate_decision: 'Рішення (наприклад, approved, refused, denied, withdrawn)',
      consulate_decision_date: 'Дата рішення',
      prior_lpr_application_us: 'Чи подавали ви раніше на постійне проживання, перебуваючи у США?',
      lpr_rescinded: 'Чи мали ви КОЛИСЬ статус постійного жителя, пізніше скасований за INA 246?',
      spouse_middle_name: 'Чинне подружжя: middle name',
      spouse_dob: 'Чинне подружжя: дата народження',
      spouse_in_armed_forces: 'Чи служить ваш чоловік або дружина зараз у збройних силах США чи Береговій охороні?',
      spouse_applying_with_you: 'Чи подає ваш чоловік або дружина разом з вами?',
      spouse_same_address: 'Чи живе чоловік або дружина за вашою поточною адресою?',
      spouse_address: 'Фізична адреса чинного подружжя',
      prior_spouse_middle_name: 'Колишнє подружжя: middle name',
      interpreter_language: 'Мова, якою перекладач працював із заявником',
      interpreter_phone: 'Денний телефон перекладача',
      interpreter_mobile: 'Мобільний телефон перекладача, якщо є',
      interpreter_email: 'Email перекладача, якщо є',
      preparer_phone: 'Денний телефон укладача',
      preparer_mobile: 'Мобільний телефон укладача, якщо є',
      preparer_email: 'Email укладача, якщо є',
      public_charge_exemption: 'Я звільнений від public charge, тому що я',
      pc_household: 'Опишіть сімейний стан (наприклад, розмір домогосподарства)',
      pc_income: 'Річний дохід домогосподарства',
      pc_assets: 'Загальна вартість активів домогосподарства',
      pc_liabilities: 'Загальна сума боргів домогосподарства',
      pc_education: 'Найвищий рівень освіти',
      pc_highest_grade: 'Останній закінчений клас школи',
      pc_skills: 'Ваші навички, ліцензії та сертифікати (по одному в рядку)',
      pc_benefit1_name: 'Отримана means-tested допомога',
      pc_benefit2_name: 'Отримана means-tested допомога',
      pc_benefit3_name: 'Отримана means-tested допомога',
      pc_benefit4_name: 'Отримана means-tested допомога'
    },
    options: {
      'A date': 'Конкретна дата',
      'D/S (duration of status)': 'D/S (на строк статусу)',
      'My status does not expire': 'Мій статус не закінчується',
      'Principal applicant': 'Основний заявник',
      'Derivative applicant': 'Derivative (член родини основного заявника)',
      'A sponsor will file Form I-864 or I-864EZ for me': 'Спонсор подасть за мене I-864 або I-864EZ',
      'I have earned or can be credited with 40 qualifying quarters of work': 'Я маю 40 кварталів роботи (credits)',
      'I am under 18, unmarried, the child of a U.S. citizen and will become a citizen automatically (INA 320)': 'Мені менше 18, я не в шлюбі, дитина громадянина США і стану громадянином автоматично (INA 320)',
      'An Affidavit of Support is not required for my category': 'Для моєї категорії Affidavit of Support не потрібен',
      'I do not fall under any of the exempt categories': 'Я не належу до жодної зі звільнених категорій',
      'Less than a high school diploma': 'Без атестата про середню освіту',
      'High school diploma, GED, or alternative credential': 'Атестат про середню освіту або GED',
      '1 or more years of college credit, no degree': '1 рік або більше коледжу, без диплома',
      "Associate's degree": 'Associate (2-річний диплом)',
      "Bachelor's degree": 'Бакалавр',
      "Master's degree": 'Магістр',
      'Professional degree (JD, MD, DMD, etc.)': 'Професійний ступінь (JD, MD, DMD тощо)',
      'Doctorate degree': 'Доктор наук (PhD)'
    }
  },
  es: {
    steps: {
      i485_other_dob: 'I-485: otras fechas de nacimiento',
      i485_other_names_detail: 'I-485: otros nombres',
      i485_prior_a_numbers: 'I-485: otros números A',
      i485_i94_name: 'I-485: nombre en el I-94',
      i485_first_arrival: 'I-485: primera llegada a EE. UU.',
      i485_current_status_expiration: 'I-485: vencimiento del estatus actual',
      i485_crewman: 'I-485: preguntas sobre tripulantes',
      i485_category: 'I-485: categoría de solicitud',
      i485_category_details: 'I-485: detalles de la categoría',
      i485_filing_as: 'I-485: solicitante principal o derivado',
      i485_affidavit_support: 'I-485: Affidavit of Support (I-864)',
      i485_prior_applications: 'I-485: visa de inmigrante en el extranjero',
      i485_prior_adjustment: 'I-485: solicitudes previas de residencia',
      i485_current_spouse_details: 'I-485: datos del cónyuge actual',
      i485_current_spouse_address: 'I-485: dirección del cónyuge actual',
      i485_prior_spouse_middle: 'I-485: segundo nombre del cónyuge anterior',
      i485_interpreter_contact: 'I-485: contacto del intérprete',
      i485_preparer_contact: 'I-485: contacto del preparador',
      i485_part9_public_charge: 'Part 9: carga pública'
    },
    fields: {
      other_dob_used: '¿Alguna vez ha usado otra fecha de nacimiento?',
      other_dob_1: 'Otra fecha de nacimiento',
      other_dob_2: 'Otra fecha de nacimiento más, si la hay',
      other_name_family: 'Otro nombre 1: apellido',
      other_name_given: 'Otro nombre 1: nombre',
      other_name_middle: 'Otro nombre 1: segundo nombre',
      other_name2_family: 'Otro nombre 2: apellido',
      other_name2_given: 'Otro nombre 2: nombre',
      other_name2_middle: 'Otro nombre 2: segundo nombre',
      has_prior_alien_number: '¿Alguna vez ha usado o se le ha asignado otro número A?',
      prior_alien_number_1: 'Otro número A',
      prior_alien_number_2: 'Otro número A más, si lo hay',
      i94_family_name: 'Apellido como aparece en el I-94',
      i94_given_name: 'Nombre como aparece en el I-94',
      first_time_in_us: '¿Su última llegada fue la primera vez que estuvo físicamente en EE. UU.?',
      current_status_expiration_kind: '¿Cuándo vence su estatus migratorio actual?',
      current_status_expires_on: 'Fecha de vencimiento del estatus actual',
      crewman_visa_issued: '¿Alguna vez se le emitió una visa de tripulante ("alien crewman")?',
      arrived_as_crewman: '¿Llegó a EE. UU. la última vez para unirse a un barco como marinero o tripulante, o mientras servía a bordo de un barco o avión?',
      i485_category_family: 'Categoría exacta de solicitud',
      i485_category_employment: 'Categoría exacta de solicitud',
      i485_category_special: 'Categoría exacta de solicitud',
      i485_category_asylee: 'Categoría exacta de solicitud',
      i485_category_other: 'Categoría exacta de solicitud',
      asylum_grant_date: 'Fecha en que se le otorgó asilo',
      refugee_admission_date: 'Fecha de admisión inicial como refugiado',
      dv_rank_number: 'Número de rango de la Diversity Visa',
      other_eligibility_text: 'Describa su otra elegibilidad',
      eb_relative_petitioner: '¿Un familiar presentó el I-140 por usted, o un familiar es dueño del 5% o más de la empresa peticionaria?',
      filing_as: 'Presento este I-485 como',
      principal_family_name: 'Solicitante principal: apellido',
      principal_given_name: 'Solicitante principal: nombre',
      principal_middle_name: 'Solicitante principal: segundo nombre',
      principal_alien_number: 'Solicitante principal: número A, si lo tiene',
      principal_dob: 'Solicitante principal: fecha de nacimiento',
      affidavit_support_exemption: 'Affidavit of Support (Formulario I-864)',
      immigrant_visa_abroad: '¿Alguna vez solicitó una visa de inmigrante en una embajada o consulado de EE. UU. en el extranjero?',
      consulate_city: 'Ciudad de la embajada o consulado',
      consulate_country: 'País de la embajada o consulado',
      consulate_decision: 'Decisión (por ejemplo, approved, refused, denied, withdrawn)',
      consulate_decision_date: 'Fecha de la decisión',
      prior_lpr_application_us: '¿Ha solicitado antes la residencia permanente estando en EE. UU.?',
      lpr_rescinded: '¿ALGUNA VEZ tuvo residencia permanente que luego fue rescindida según INA 246?',
      spouse_middle_name: 'Cónyuge actual: segundo nombre',
      spouse_dob: 'Cónyuge actual: fecha de nacimiento',
      spouse_in_armed_forces: '¿Su cónyuge es miembro actual de las fuerzas armadas o de la Guardia Costera de EE. UU.?',
      spouse_applying_with_you: '¿Su cónyuge actual solicita con usted?',
      spouse_same_address: '¿Su cónyuge vive en su dirección física actual?',
      spouse_address: 'Dirección física del cónyuge actual',
      prior_spouse_middle_name: 'Cónyuge anterior: segundo nombre',
      interpreter_language: 'Idioma que el intérprete usó con el solicitante',
      interpreter_phone: 'Teléfono diurno del intérprete',
      interpreter_mobile: 'Teléfono móvil del intérprete, si lo tiene',
      interpreter_email: 'Email del intérprete, si lo tiene',
      preparer_phone: 'Teléfono diurno del preparador',
      preparer_mobile: 'Teléfono móvil del preparador, si lo tiene',
      preparer_email: 'Email del preparador, si lo tiene',
      public_charge_exemption: 'Estoy exento de carga pública porque soy',
      pc_household: 'Describa su situación familiar (por ejemplo, el tamaño de su hogar)',
      pc_income: 'Ingreso anual del hogar',
      pc_assets: 'Valor total de los bienes del hogar',
      pc_liabilities: 'Valor total de las deudas del hogar',
      pc_education: 'Nivel más alto de estudios completado',
      pc_highest_grade: 'Último grado escolar completado',
      pc_skills: 'Sus habilidades, licencias y certificados (uno por línea)',
      pc_benefit1_name: 'Beneficio público basado en necesidad recibido',
      pc_benefit2_name: 'Beneficio público basado en necesidad recibido',
      pc_benefit3_name: 'Beneficio público basado en necesidad recibido',
      pc_benefit4_name: 'Beneficio público basado en necesidad recibido'
    },
    options: {
      'A date': 'Una fecha',
      'D/S (duration of status)': 'D/S (duración del estatus)',
      'My status does not expire': 'Mi estatus no vence',
      'Principal applicant': 'Solicitante principal',
      'Derivative applicant': 'Solicitante derivado',
      'A sponsor will file Form I-864 or I-864EZ for me': 'Un patrocinador presentará el I-864 o I-864EZ por mí',
      'I have earned or can be credited with 40 qualifying quarters of work': 'Tengo 40 trimestres de trabajo (créditos)',
      'I am under 18, unmarried, the child of a U.S. citizen and will become a citizen automatically (INA 320)': 'Soy menor de 18, soltero, hijo de ciudadano de EE. UU. y seré ciudadano automáticamente (INA 320)',
      'An Affidavit of Support is not required for my category': 'Mi categoría no requiere Affidavit of Support',
      'I do not fall under any of the exempt categories': 'No pertenezco a ninguna categoría exenta',
      'Less than a high school diploma': 'Sin diploma de escuela secundaria',
      'High school diploma, GED, or alternative credential': 'Diploma de secundaria, GED o equivalente',
      '1 or more years of college credit, no degree': '1 o más años de universidad, sin título',
      "Associate's degree": 'Título de asociado',
      "Bachelor's degree": 'Licenciatura',
      "Master's degree": 'Maestría',
      'Professional degree (JD, MD, DMD, etc.)': 'Título profesional (JD, MD, DMD, etc.)',
      'Doctorate degree': 'Doctorado'
    }
  }
};

// Category and Item 56 option labels: [ru, uk, es]. The English value stays
// the stored answer; the wizard shows it next to the translation.
const OPTION_TRANSLATIONS = {
  'Spouse of a U.S. citizen': ['Супруг(а) гражданина США', 'Чоловік/дружина громадянина США', 'Cónyuge de ciudadano de EE. UU.'],
  'Unmarried child under 21 of a U.S. citizen': ['Неженатый ребёнок до 21 года гражданина США', 'Неодружена дитина до 21 року громадянина США', 'Hijo soltero menor de 21 de ciudadano de EE. UU.'],
  'Parent of a U.S. citizen (citizen is 21 or older)': ['Родитель гражданина США (гражданину 21+)', 'Батько/мати громадянина США (громадянину 21+)', 'Padre o madre de ciudadano de EE. UU. (ciudadano de 21+)'],
  'K-1 fiance(e) or K-2 child of a U.S. citizen': ['Жених/невеста K-1 или ребёнок K-2 гражданина США', 'Наречений(а) K-1 або дитина K-2 громадянина США', 'Prometido(a) K-1 o hijo K-2 de ciudadano de EE. UU.'],
  'Widow or widower of a U.S. citizen': ['Вдова или вдовец гражданина США', 'Вдова або вдівець громадянина США', 'Viudo(a) de ciudadano de EE. UU.'],
  'Spouse, child or parent of a deceased U.S. service member (NDAA)': ['Супруг, ребёнок или родитель погибшего военнослужащего США (NDAA)', 'Чоловік/дружина, дитина або батьки загиблого військовослужбовця США (NDAA)', 'Cónyuge, hijo o padre de militar de EE. UU. fallecido (NDAA)'],
  'F1: Unmarried son or daughter (21+) of a U.S. citizen': ['F1: неженатый сын или дочь (21+) гражданина США', 'F1: неодружений син або донька (21+) громадянина США', 'F1: hijo(a) soltero(a) (21+) de ciudadano de EE. UU.'],
  'F3: Married son or daughter of a U.S. citizen': ['F3: женатый сын или замужняя дочь гражданина США', 'F3: одружений син або заміжня донька громадянина США', 'F3: hijo(a) casado(a) de ciudadano de EE. UU.'],
  'F4: Brother or sister of a U.S. citizen (citizen is 21 or older)': ['F4: брат или сестра гражданина США (гражданину 21+)', 'F4: брат або сестра громадянина США (громадянину 21+)', 'F4: hermano(a) de ciudadano de EE. UU. (ciudadano de 21+)'],
  'F2A: Spouse of a permanent resident': ['F2A: супруг(а) постоянного жителя', 'F2A: чоловік/дружина постійного жителя', 'F2A: cónyuge de residente permanente'],
  'F2A: Unmarried child under 21 of a permanent resident': ['F2A: неженатый ребёнок до 21 года постоянного жителя', 'F2A: неодружена дитина до 21 року постійного жителя', 'F2A: hijo soltero menor de 21 de residente permanente'],
  'F2B: Unmarried son or daughter (21+) of a permanent resident': ['F2B: неженатый сын или дочь (21+) постоянного жителя', 'F2B: неодружений син або донька (21+) постійного жителя', 'F2B: hijo(a) soltero(a) (21+) de residente permanente'],
  'VAWA self-petitioning spouse': ['VAWA: супруг(а), подающий(ая) сам(а)', 'VAWA: чоловік/дружина, що подає самостійно', 'VAWA: cónyuge autopeticionario'],
  'VAWA self-petitioning child': ['VAWA: ребёнок, подающий сам', 'VAWA: дитина, що подає самостійно', 'VAWA: hijo autopeticionario'],
  'VAWA self-petitioning parent': ['VAWA: родитель, подающий сам', 'VAWA: батько/мати, що подає самостійно', 'VAWA: padre autopeticionario'],
  'Investor (Form I-526 or I-526E)': ['Инвестор (I-526 или I-526E)', 'Інвестор (I-526 або I-526E)', 'Inversionista (I-526 o I-526E)'],
  'EB-1: Alien of extraordinary ability': ['EB-1: выдающиеся способности', 'EB-1: видатні здібності', 'EB-1: habilidad extraordinaria'],
  'EB-1: Outstanding professor or researcher': ['EB-1: выдающийся профессор или исследователь', 'EB-1: видатний професор або дослідник', 'EB-1: profesor o investigador destacado'],
  'EB-1: Multinational executive or manager': ['EB-1: руководитель международной компании', 'EB-1: керівник міжнародної компанії', 'EB-1: ejecutivo o gerente multinacional'],
  'EB-2: Advanced degree or exceptional ability (no NIW)': ['EB-2: учёная степень или исключительные способности (без NIW)', 'EB-2: науковий ступінь або виняткові здібності (без NIW)', 'EB-2: título avanzado o habilidad excepcional (sin NIW)'],
  'EB-3: Professional': ['EB-3: специалист с высшим образованием', 'EB-3: фахівець з вищою освітою', 'EB-3: profesional'],
  'EB-3: Skilled worker': ['EB-3: квалифицированный работник', 'EB-3: кваліфікований працівник', 'EB-3: trabajador calificado'],
  'EB-3: Other worker': ['EB-3: другой работник', 'EB-3: інший працівник', 'EB-3: otro trabajador'],
  'EB-2: National Interest Waiver': ['EB-2: National Interest Waiver (NIW)', 'EB-2: National Interest Waiver (NIW)', 'EB-2: National Interest Waiver (NIW)'],
  'Special Immigrant Juvenile': ['Особый иммигрант-несовершеннолетний (SIJ)', 'Особливий іммігрант-неповнолітній (SIJ)', 'Menor Inmigrante Especial (SIJ)'],
  'Certain Afghan or Iraqi national': ['Некоторые граждане Афганистана или Ирака', 'Деякі громадяни Афганістану або Іраку', 'Ciertos nacionales afganos o iraquíes'],
  'Certain international broadcaster': ['Сотрудник международного вещания', 'Працівник міжнародного мовлення', 'Ciertos locutores internacionales'],
  'Certain G-4 international organization or NATO-6 employee or family member': ['Сотрудник G-4 или NATO-6 или член семьи', 'Працівник G-4 або NATO-6 чи член родини', 'Empleado G-4 u OTAN-6 o familiar'],
  'Certain U.S. armed forces member (Six and Six program)': ['Военнослужащий США (программа Six and Six)', 'Військовослужбовець США (програма Six and Six)', 'Miembro de las fuerzas armadas (programa Six and Six)'],
  'Panama Canal Zone employee': ['Сотрудник зоны Панамского канала', 'Працівник зони Панамського каналу', 'Empleado de la Zona del Canal de Panamá'],
  'Certain physician': ['Некоторые врачи', 'Деякі лікарі', 'Ciertos médicos'],
  'Certain employee or former employee of the U.S. government abroad': ['Сотрудник (бывший) правительства США за рубежом', 'Працівник (колишній) уряду США за кордоном', 'Empleado o exempleado del gobierno de EE. UU. en el extranjero'],
  'Religious worker: minister of religion': ['Религиозный работник: священнослужитель', 'Релігійний працівник: священнослужитель', 'Trabajador religioso: ministro de culto'],
  'Religious worker: other religious worker': ['Другой религиозный работник', 'Інший релігійний працівник', 'Otro trabajador religioso'],
  'Asylee (INA 208, Form I-589 or I-730)': ['Получивший асайлум (INA 208, I-589 или I-730)', 'Отримав притулок (INA 208, I-589 або I-730)', 'Asilado (INA 208, I-589 o I-730)'],
  'Refugee (INA 207, Form I-590 or I-730)': ['Беженец (INA 207, I-590 или I-730)', 'Біженець (INA 207, I-590 або I-730)', 'Refugiado (INA 207, I-590 o I-730)'],
  'T nonimmigrant (human trafficking victim)': ['Статус T (жертва торговли людьми)', 'Статус T (жертва торгівлі людьми)', 'No inmigrante T (víctima de trata)'],
  'U nonimmigrant (victim of qualifying criminal activity)': ['Статус U (жертва преступления)', 'Статус U (жертва злочину)', 'No inmigrante U (víctima de delito)'],
  'Cuban Adjustment Act': ['Cuban Adjustment Act (закон о кубинцах)', 'Cuban Adjustment Act (закон про кубинців)', 'Ley de Ajuste Cubano'],
  'Cuban Adjustment Act: battered spouse or child': ['Cuban Adjustment Act: пострадавший супруг или ребёнок', 'Cuban Adjustment Act: постраждалий чоловік/дружина або дитина', 'Ley de Ajuste Cubano: cónyuge o hijo maltratado'],
  'HRIFA: dependent status': ['HRIFA: член семьи (dependent)', 'HRIFA: член родини (dependent)', 'HRIFA: estatus de dependiente'],
  'HRIFA: battered spouse or child': ['HRIFA: пострадавший супруг или ребёнок', 'HRIFA: постраждалий чоловік/дружина або дитина', 'HRIFA: cónyuge o hijo maltratado'],
  'Lautenberg parolee': ['Пароль по программе Lautenberg', 'Пароль за програмою Lautenberg', 'Parolee de Lautenberg'],
  'Diplomat or high-ranking official unable to return home (Section 13)': ['Дипломат, не способный вернуться (Section 13)', 'Дипломат, що не може повернутися (Section 13)', 'Diplomático que no puede regresar (Sección 13)'],
  'National of Vietnam, Cambodia or Laos (section 586 of Public Law 106-429)': ['Гражданин Вьетнама, Камбоджи или Лаоса (Public Law 106-429)', 'Громадянин В’єтнаму, Камбоджі або Лаосу (Public Law 106-429)', 'Nacional de Vietnam, Camboya o Laos (Ley Pública 106-429)'],
  'Amerasian Act (October 22, 1982)': ['Amerasian Act (22 октября 1982)', 'Amerasian Act (22 жовтня 1982)', 'Ley Amerasiática (22 de octubre de 1982)'],
  'Diversity Visa program': ['Программа Diversity Visa (лотерея)', 'Програма Diversity Visa (лотерея)', 'Programa de Visa de Diversidad'],
  'Continuous residence since before January 1, 1972 (Registry)': ['Проживание с до 1 января 1972 (Registry)', 'Проживання з до 1 січня 1972 (Registry)', 'Residencia continua desde antes del 1 de enero de 1972 (Registry)'],
  'Born in the United States under diplomatic status': ['Рождён в США в дипломатическом статусе', 'Народжений у США в дипломатичному статусі', 'Nacido en EE. UU. bajo estatus diplomático'],
  'S nonimmigrant or qualifying family member': ['Статус S или член семьи', 'Статус S або член родини', 'No inmigrante S o familiar calificado'],
  'Other eligibility': ['Другое основание', 'Інша підстава', 'Otra elegibilidad'],
  'VAWA self-petitioner (Form I-360)': ['VAWA (I-360)', 'VAWA (I-360)', 'VAWA (I-360)'],
  'Special Immigrant Juvenile (Form I-360)': ['Особый иммигрант-несовершеннолетний (I-360)', 'Особливий іммігрант-неповнолітній (I-360)', 'Menor Inmigrante Especial (I-360)'],
  'Certain Afghan or Iraqi national (Form I-360 or DS-157)': ['Граждане Афганистана или Ирака (I-360 или DS-157)', 'Громадяни Афганістану або Іраку (I-360 або DS-157)', 'Nacionales afganos o iraquíes (I-360 o DS-157)'],
  'Asylee (Form I-589 or I-730)': ['Получивший асайлум (I-589 или I-730)', 'Отримав притулок (I-589 або I-730)', 'Asilado (I-589 o I-730)'],
  'Refugee (Form I-590 or I-730)': ['Беженец (I-590 или I-730)', 'Біженець (I-590 або I-730)', 'Refugiado (I-590 o I-730)'],
  'U nonimmigrant adjusting under INA 245(m)': ['Статус U, подача по INA 245(m)', 'Статус U, подача за INA 245(m)', 'No inmigrante U según INA 245(m)'],
  'Another category, but in valid U nonimmigrant status when filing': ['Другая категория, но действующий статус U при подаче', 'Інша категорія, але чинний статус U під час подачі', 'Otra categoría, pero con estatus U vigente al presentar'],
  'T nonimmigrant adjusting under INA 245(l)': ['Статус T, подача по INA 245(l)', 'Статус T, подача за INA 245(l)', 'No inmigrante T según INA 245(l)'],
  'Another category, but with a pending prima facie or approved T application': ['Другая категория, но поданное или одобренное заявление на T', 'Інша категорія, але подана або схвалена заява на T', 'Otra categoría, pero con solicitud T pendiente (prima facie) o aprobada'],
  'Cuban and Haitian entrant (IRCA section 202)': ['Кубинцы и гаитяне по IRCA, раздел 202', 'Кубинці та гаїтяни за IRCA, розділ 202', 'Entrante cubano o haitiano (IRCA, sección 202)'],
  'National of Vietnam, Cambodia or Laos': ['Гражданин Вьетнама, Камбоджи или Лаоса', 'Громадянин В’єтнаму, Камбоджі або Лаосу', 'Nacional de Vietnam, Camboya o Laos'],
  'Registry (continuous residence since before January 1, 1972)': ['Registry (проживание с до 1 января 1972)', 'Registry (проживання з до 1 січня 1972)', 'Registry (residencia desde antes del 1 de enero de 1972)'],
  'Amerasian Homecoming Act': ['Amerasian Homecoming Act', 'Amerasian Homecoming Act', 'Ley de Regreso Amerasiático'],
  'Polish or Hungarian parolee': ['Пароль для граждан Польши или Венгрии', 'Пароль для громадян Польщі або Угорщини', 'Parolee polaco o húngaro'],
  'NACARA section 203': ['NACARA, раздел 203', 'NACARA, розділ 203', 'NACARA, sección 203'],
  'American Indian born in Canada or Texas Band of Kickapoo Indians': ['Американский индеец, рождённый в Канаде, или кикапу Техаса', 'Американський індіанець, народжений у Канаді, або кікапу Техасу', 'Indígena americano nacido en Canadá o kickapoo de Texas'],
  'Liberian Refugee Immigration Fairness (NDAA FY2020 section 7611)': ['Закон о либерийских беженцах (NDAA 2020, раздел 7611)', 'Закон про ліберійських біженців (NDAA 2020, розділ 7611)', 'Ley de Equidad para Refugiados Liberianos (NDAA 2020, sección 7611)'],
  'Syrian national under Public Law 106-378': ['Гражданин Сирии (Public Law 106-378)', 'Громадянин Сирії (Public Law 106-378)', 'Nacional sirio (Ley Pública 106-378)'],
  'Spouse, child or parent of a U.S. active-duty service member (NDAA)': ['Супруг, ребёнок или родитель военнослужащего США (NDAA)', 'Чоловік/дружина, дитина або батьки військовослужбовця США (NDAA)', 'Cónyuge, hijo o padre de militar activo de EE. UU. (NDAA)']
};
const BENEFIT_FIELD_LABELS = {
  start: ['Дата начала', 'Дата початку', 'Fecha de inicio'],
  end: ['Дата окончания', 'Дата закінчення', 'Fecha de fin'],
  amount: ['Сумма в долларах (если применимо)', 'Сума в доларах (якщо застосовно)', 'Monto en dólares (si aplica)'],
  reason: ['Причина получения пособия', 'Причина отримання допомоги', 'Motivo por el que recibió el beneficio']
};
['ru', 'uk', 'es'].forEach((lang, index) => {
  const copy = I485_REVIEW_LOCALIZATION[lang];
  for (const [value, labels] of Object.entries(OPTION_TRANSLATIONS)) copy.options[value] = labels[index];
  for (let row = 1; row <= 4; row += 1) {
    for (const [part, labels] of Object.entries(BENEFIT_FIELD_LABELS)) copy.fields[`pc_benefit${row}_${part}`] = labels[index];
  }
});

// Step help: [ru, uk, es].
const STEP_HELP = {
  i485_other_dob: ['Часть 1, пункт 3.', 'Частина 1, пункт 3.', 'Parte 1, punto 3.'],
  i485_other_names_detail: ['Часть 1, пункт 2: фамилия при рождении, другие юридические имена, прозвища, псевдонимы.', 'Частина 1, пункт 2: прізвище при народженні, інші юридичні імена, прізвиська, псевдоніми.', 'Parte 1, punto 2: apellido de nacimiento, otros nombres legales, apodos, alias.'],
  i485_prior_a_numbers: ['Часть 1, пункт 5.', 'Частина 1, пункт 5.', 'Parte 1, punto 5.'],
  i485_i94_name: ['Часть 1, пункт 12. Точно как в последнем I-94. Оставьте пустым, если совпадает с юридическим именем.', 'Частина 1, пункт 12. Точно як в останньому I-94. Залиште порожнім, якщо збігається з юридичним іменем.', 'Parte 1, punto 12. Exactamente como en su I-94 más reciente. Déjelo en blanco si coincide con su nombre legal.'],
  i485_first_arrival: ['Часть 1, пункт 13.', 'Частина 1, пункт 13.', 'Parte 1, punto 13.'],
  i485_current_status_expiration: ['Часть 1, пункт 15. Статус asylee и refugee не истекает.', 'Частина 1, пункт 15. Статус asylee та refugee не закінчується.', 'Parte 1, punto 15. El estatus de asilado y refugiado no vence.'],
  i485_crewman: ['Часть 1, пункты 16-17.', 'Частина 1, пункти 16-17.', 'Parte 1, puntos 16-17.'],
  i485_category: ['Часть 2, пункт 3. Выберите точную категорию петиции или статуса.', 'Частина 2, пункт 3. Оберіть точну категорію петиції або статусу.', 'Parte 2, punto 3. Elija la categoría exacta de su petición o estatus.'],
  i485_category_details: ['Часть 2, уточнения к пункту 3.', 'Частина 2, уточнення до пункту 3.', 'Parte 2, preguntas sobre el punto 3.'],
  i485_filing_as: ['Часть 2, пункт 2.', 'Частина 2, пункт 2.', 'Parte 2, punto 2.'],
  i485_affidavit_support: ['Часть 3. Пропускается, если ответ определяет категория.', 'Частина 3. Пропускається, якщо відповідь визначає категорія.', 'Parte 3. Se omite cuando su categoría ya lo responde.'],
  i485_prior_applications: ['Часть 4, пункты 1-4.', 'Частина 4, пункти 1-4.', 'Parte 4, puntos 1-4.'],
  i485_prior_adjustment: ['Часть 4, пункты 5-6.', 'Частина 4, пункти 5-6.', 'Parte 4, puntos 5-6.'],
  i485_current_spouse_details: ['Часть 6, пункты 2, 6 и 10.', 'Частина 6, пункти 2, 6 і 10.', 'Parte 6, puntos 2, 6 y 10.'],
  i485_current_spouse_address: ['Часть 6, пункт 8.', 'Частина 6, пункт 8.', 'Parte 6, punto 8.'],
  i485_prior_spouse_middle: ['Часть 6, пункт 11.', 'Частина 6, пункт 11.', 'Parte 6, punto 11.'],
  i485_interpreter_contact: ['Часть 11.', 'Частина 11.', 'Parte 11.'],
  i485_preparer_contact: ['Часть 12.', 'Частина 12.', 'Parte 12.'],
  i485_part9_public_charge_56: ['Часть 9, пункт 56. Пропускается, если ответ определяет категория.', 'Частина 9, пункт 56. Пропускається, якщо відповідь визначає категорія.', 'Parte 9, punto 56. Se omite cuando su categoría ya lo responde.'],
  i485_part9_public_charge_57: ['Часть 9, пункты 57-59. Только для категорий, на которые распространяется public charge.', 'Частина 9, пункти 57-59. Лише для категорій, на які поширюється public charge.', 'Parte 9, puntos 57-59. Solo para categorías sujetas a carga pública.'],
  i485_part9_public_charge_60: ['Часть 9, пункты 60-61.', 'Частина 9, пункти 60-61.', 'Parte 9, puntos 60-61.'],
  i485_part9_public_charge_62: ['Часть 9, пункт 62. По одному в строке: сертификаты, лицензии, навыки, языки.', 'Частина 9, пункт 62. По одному в рядку: сертифікати, ліцензії, навички, мови.', 'Parte 9, punto 62. Uno por línea: certificados, licencias, habilidades, idiomas.'],
  i485_part9_public_charge_64: ['Часть 9, пункт 64. Оставьте пустым, если пособий больше нет.', 'Частина 9, пункт 64. Залиште порожнім, якщо допомог більше немає.', 'Parte 9, punto 64. Déjelo en blanco si no hay más beneficios.']
};
['ru', 'uk', 'es'].forEach((lang, index) => {
  const copy = I485_REVIEW_LOCALIZATION[lang];
  copy.stepHelp = copy.stepHelp || {};
  for (const [id, texts] of Object.entries(STEP_HELP)) copy.stepHelp[id] = texts[index];
});

module.exports = {
  CATEGORY_KEY_BY_BASIS,
  whenCategory,
  STATUS_EXPIRATION_KINDS,
  INCOME_OPTIONS,
  ASSET_OPTIONS,
  LIABILITY_OPTIONS,
  EDUCATION_OPTIONS,
  PUBLIC_CHARGE_NOT_EXEMPT_LABEL,
  publicChargeAppliesWhenAny,
  i485ReviewSteps,
  i485PublicChargeSteps,
  I485_REVIEW_LOCALIZATION
};
