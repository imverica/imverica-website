const SCHEMA_VERSION = 'immigration-flow-v1';
const { stateSelectOptions } = require('./us-address');

const DISCLAIMER = 'Document preparation only. Possible forms may include official USCIS forms. Imverica is not a law firm or attorney and does not provide legal advice.';

const LOCALIZATION = {
  ru: {
    steps: {
      purpose: 'Назначение формы',
      applicant: 'Данные заявителя',
      address_contact: 'Адрес и контакт',
      immigration_history: 'Иммиграционная история',
      documents_review: 'Документы и проверка',
      work_authorization: 'Основание для work permit',
      family_petition: 'Детали семейной петиции',
      spouse_biographic: 'Биографические данные супруга',
      travel_document: 'Запрос travel document',
      adjustment_basis: 'Основание для adjustment of status',
      asylum_claim: 'Asylum / withholding request',
      support_affidavit: 'Affidavit of support',
      fee_waiver: 'Основание fee waiver',
      naturalization: 'Подготовка naturalization'
    },
    stepHelp: {
      purpose: 'Подтвердите, зачем готовится эта форма и есть ли связанные подачи.',
      applicant: 'Укажите данные так, как они должны быть в форме.',
      address_contact: 'Автозаполнение телефона может помочь с именем, телефоном, email и адресом.',
      immigration_history: 'Эти ответы помогают подготовить USCIS-поля и список документов.',
      documents_review: 'Укажите, какие документы уже есть. Файлы можно будет загрузить после checkout или кабинета.'
    },
    fields: {
      form_code_confirmed: 'Запрошенная форма',
      preparation_goal: 'Что нужно подготовить по этой форме?',
      related_forms_known: 'Вы уже знаете связанные формы или receipt numbers?',
      deadline_or_notice: 'Есть deadline, RFE, court date или USCIS notice?',
      applicant_full_name: 'Полное имя заявителя по документам',
      applicant_given_name: 'Имя',
      applicant_family_name: 'Фамилия',
      other_names_used: 'Другие имена, которые использовались',
      date_of_birth: 'Дата рождения',
      country_of_birth: 'Страна рождения',
      country_of_citizenship: 'Гражданство / nationality',
      alien_number: 'A-number, если есть',
      uscis_online_account_number: 'USCIS online account number, если есть',
      mailing_address_line1: 'Почтовый адрес, строка 1',
      mailing_address_line2: 'Квартира, suite или unit',
      mailing_city: 'Город',
      mailing_state: 'Штат',
      mailing_zip: 'ZIP code',
      mailing_country: 'Страна',
      physical_same_as_mailing: 'Физический адрес совпадает с почтовым?',
      daytime_phone: 'Телефон',
      email_address: 'Email',
      current_immigration_status: 'Текущий иммиграционный статус или категория',
      last_arrival_date: 'Дата последнего въезда в США',
      i94_number: 'I-94 number, если есть',
      passport_number: 'Номер паспорта, если относится к форме',
      passport_expiration: 'Дата окончания паспорта',
      prior_uscis_filings: 'Предыдущие или pending USCIS filings',
      identity_documents_available: 'Какие identity documents есть',
      supporting_documents_available: 'Какие supporting documents есть',
      translation_needed: 'Нужен перевод документов?',
      interpreter_or_preparer_needed: 'Нужна секция interpreter/preparer?',
      extra_notes_for_preparer: 'Что еще должен знать preparer?',
      ead_basis: 'На чем основан work permit?',
      eligibility_category_code: 'Eligibility category code, если знаете',
      prior_ead: 'EAD уже был раньше?',
      pending_application_receipt: 'Receipt number связанного pending case, если есть',
      petitioner_status: 'Статус petitioner',
      relationship_to_beneficiary: 'Отношение к beneficiary',
      beneficiary_full_name: 'Полное имя beneficiary',
      beneficiary_location: 'Beneficiary находится в США?',
      marriage_date: 'Если spouse case, дата брака',
      prior_marriages: 'Были ли предыдущие браки у кого-либо?',
      adjustment_basis: 'Основание для adjustment',
      petitioner_or_sponsor: 'Имя petitioner, employer или sponsor',
      underlying_receipt_number: 'Receipt number основной петиции, если есть',
      inside_us_now: 'Вы сейчас физически находитесь в США?',
      inspection_or_parole: 'Последний въезд был inspected, admitted или paroled?',
      medical_exam_status: 'Статус medical exam I-693',
      travel_document_type: 'Тип travel document',
      planned_departure_date: 'Планируемая дата выезда',
      planned_return_date: 'Планируемая дата возвращения',
      countries_to_visit: 'Страны поездки',
      purpose_of_travel: 'Цель поездки',
      asylum_basis: 'Основание asylum по описанию заявителя',
      harm_or_fear_summary: 'Краткое описание harm/fear',
      family_members_included: 'Family members для включения',
      sponsor_full_name: 'Полное имя sponsor',
      household_size: 'Household size',
      current_annual_income: 'Текущий годовой income',
      fee_waiver_basis: 'Основание fee waiver',
      household_income: 'Household income',
      green_card_date: 'Дата получения permanent resident status',
      basis_for_naturalization: 'Основание naturalization',
      addresses_last_five_years: 'Адреса за последние 5 лет',
      employment_school_last_five_years: 'Работа или учеба за последние 5 лет',
      spouse_residence_history: 'Адреса beneficiary за последние 5 лет',
      spouse_employment_history: 'Работа beneficiary за последние 5 лет'
    },
    options: {
      Yes: 'Да',
      No: 'Нет',
      'Not sure': 'Не знаю',
      Other: 'Другое',
      'Other or not sure': 'Другое или не знаю',
      'Pending green card / adjustment of status': 'Pending green card / adjustment of status',
      'Asylum or pending asylum': 'Asylum или pending asylum',
      TPS: 'TPS',
      DACA: 'DACA',
      'Student category': 'Студенческая категория',
      'Parole or humanitarian category': 'Parole или humanitarian category'
    }
  },
  uk: {
    steps: {
      purpose: 'Призначення форми',
      applicant: 'Дані заявника',
      address_contact: 'Адреса і контакт',
      immigration_history: 'Імміграційна історія',
      documents_review: 'Документи і перевірка',
      work_authorization: 'Підстава для work permit',
      family_petition: 'Деталі сімейної петиції',
      travel_document: 'Запит travel document',
      adjustment_basis: 'Підстава для adjustment of status',
      fee_waiver: 'Підстава fee waiver',
      naturalization: 'Підготовка naturalization'
    },
    fields: {
      form_code_confirmed: 'Запитана форма',
      preparation_goal: 'Що потрібно підготувати за цією формою?',
      related_forms_known: 'Ви вже знаєте пов’язані форми або receipt numbers?',
      deadline_or_notice: 'Є deadline, RFE, court date або USCIS notice?',
      applicant_full_name: 'Повне ім’я заявника за документами',
      applicant_given_name: 'Ім’я',
      applicant_family_name: 'Прізвище',
      date_of_birth: 'Дата народження',
      country_of_birth: 'Країна народження',
      country_of_citizenship: 'Громадянство / nationality',
      mailing_address_line1: 'Поштова адреса, рядок 1',
      mailing_city: 'Місто',
      mailing_state: 'Штат',
      mailing_zip: 'ZIP code',
      daytime_phone: 'Телефон',
      email_address: 'Email',
      current_immigration_status: 'Поточний імміграційний статус або категорія',
      ead_basis: 'На чому базується work permit?',
      eligibility_category_code: 'Eligibility category code, якщо знаєте',
      prior_ead: 'EAD вже був раніше?',
      beneficiary_full_name: 'Повне ім’я beneficiary',
      inside_us_now: 'Ви зараз фізично перебуваєте у США?',
      addresses_last_five_years: 'Адреси за останні 5 років',
      employment_school_last_five_years: 'Робота або навчання за останні 5 років',
      spouse_residence_history: 'Адреси beneficiary за останні 5 років',
      spouse_employment_history: 'Робота beneficiary за останні 5 років'
    },
    options: { Yes: 'Так', No: 'Ні', 'Not sure': 'Не знаю', Other: 'Інше', 'Other or not sure': 'Інше або не знаю' }
  },
  es: {
    steps: {
      purpose: 'Propósito del formulario',
      applicant: 'Información del solicitante',
      address_contact: 'Dirección y contacto',
      immigration_history: 'Historial migratorio',
      documents_review: 'Documentos y revisión',
      work_authorization: 'Base del permiso de trabajo',
      family_petition: 'Detalles de petición familiar',
      travel_document: 'Solicitud de travel document',
      adjustment_basis: 'Base para adjustment of status',
      fee_waiver: 'Base de fee waiver',
      naturalization: 'Preparación de naturalization'
    },
    fields: {
      form_code_confirmed: 'Formulario solicitado',
      preparation_goal: '¿Qué desea preparar con este formulario?',
      related_forms_known: '¿Conoce formularios relacionados o receipt numbers?',
      deadline_or_notice: '¿Hay deadline, RFE, court date o USCIS notice?',
      applicant_full_name: 'Nombre legal completo del solicitante',
      applicant_given_name: 'Nombre',
      applicant_family_name: 'Apellido',
      date_of_birth: 'Fecha de nacimiento',
      country_of_birth: 'País de nacimiento',
      country_of_citizenship: 'Ciudadanía / nationality',
      mailing_address_line1: 'Dirección postal línea 1',
      mailing_city: 'Ciudad',
      mailing_state: 'Estado',
      mailing_zip: 'ZIP code',
      daytime_phone: 'Teléfono',
      email_address: 'Email',
      current_immigration_status: 'Estado migratorio actual o categoría',
      ead_basis: '¿En qué se basa el permiso de trabajo?',
      eligibility_category_code: 'Eligibility category code, si lo sabe',
      prior_ead: '¿Ha tenido EAD antes?',
      beneficiary_full_name: 'Nombre completo del beneficiario',
      inside_us_now: '¿Está físicamente dentro de Estados Unidos ahora?',
      addresses_last_five_years: 'Direcciones de los últimos 5 años',
      employment_school_last_five_years: 'Trabajo o escuela de los últimos 5 años',
      spouse_residence_history: 'Direcciones del beneficiary de los últimos 5 años',
      spouse_employment_history: 'Trabajo del beneficiary de los últimos 5 años'
    },
    options: { Yes: 'Sí', No: 'No', 'Not sure': 'No estoy seguro', Other: 'Otro', 'Other or not sure': 'Otro o no estoy seguro' }
  }
};

const TEXT = {
  purpose: {
    title: 'Form purpose',
    help: 'Confirm why this form is being prepared and whether there are related filings.'
  },
  applicant: {
    title: 'Applicant information',
    help: 'Use the information exactly as it should appear on the form.'
  },
  address: {
    title: 'Address and contact',
    help: 'Device autofill can help complete name, phone, email, and address fields.'
  },
  immigration: {
    title: 'Immigration history',
    help: 'These answers help prepare USCIS fields and identify supporting documents.'
  },
  evidence: {
    title: 'Documents and review',
    help: 'List what you already have. Files can be uploaded after checkout or portal setup.'
  }
};

function field(id, label, type = 'text', options = {}) {
  return { id, label, type, ...options };
}

function step(id, title, help, fields) {
  return { id, title, help, fields };
}

const US_STATE_OPTIONS = stateSelectOptions();

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function titleFromEntry(code, entry, official) {
  return official?.title || entry?.names?.en || entry?.name || entry?.title || code;
}

function commonPurposeFields(code, title) {
  return [
    field('form_code_confirmed', 'Form requested', 'text', {
      required: true,
      value: code,
      autocomplete: 'off',
      help: title
    }),
    field('preparation_goal', 'What do you want prepared with this form?', 'textarea', {
      required: true,
      placeholder: 'Describe the request in your own words.'
    }),
    field('related_forms_known', 'Do you already know any related forms or receipt numbers?', 'textarea', {
      placeholder: 'Example: I-130 receipt, I-485 pending, I-797 notice, A-number.'
    }),
    field('deadline_or_notice', 'Is there a deadline, RFE, court date, or USCIS notice?', 'textarea', {
      placeholder: 'Include the date and notice type if you have one.'
    })
  ];
}

function applicantFields() {
  return [
    field('applicant_full_name', 'Applicant full legal name', 'text', {
      required: true,
      autocomplete: 'name'
    }),
    field('applicant_given_name', 'Given name', 'text', {
      autocomplete: 'given-name'
    }),
    field('applicant_family_name', 'Family name', 'text', {
      autocomplete: 'family-name'
    }),
    field('other_names_used', 'Other names used', 'textarea', {
      placeholder: 'Maiden name, prior legal names, aliases.'
    }),
    field('date_of_birth', 'Date of birth', 'date', {
      required: true,
      autocomplete: 'bday'
    }),
    field('country_of_birth', 'Country of birth', 'text', {
      autocomplete: 'country-name'
    }),
    field('country_of_citizenship', 'Country of citizenship or nationality', 'text', {
      autocomplete: 'country-name'
    }),
    field('alien_number', 'A-number, if any', 'text', {
      autocomplete: 'off',
      placeholder: 'A###-###-###'
    }),
    field('uscis_online_account_number', 'USCIS online account number, if any', 'text', {
      autocomplete: 'off'
    })
  ];
}

function addressFields() {
  return [
    field('mailing_address_line1', 'Mailing address line 1', 'addressAutocomplete', {
      required: true,
      autocomplete: 'address-line1'
    }),
    field('mailing_address_line2', 'Apartment, suite, or unit', 'text', {
      autocomplete: 'address-line2'
    }),
    field('mailing_city', 'City', 'text', {
      required: true,
      autocomplete: 'address-level2'
    }),
    field('mailing_state', 'State', 'select', {
      required: true,
      autocomplete: 'address-level1',
      options: US_STATE_OPTIONS
    }),
    field('mailing_zip', 'ZIP code', 'text', {
      required: true,
      autocomplete: 'postal-code',
      inputmode: 'numeric'
    }),
    field('mailing_country', 'Country', 'text', {
      autocomplete: 'country-name',
      value: 'United States'
    }),
    field('physical_same_as_mailing', 'Is physical address the same as mailing address?', 'radio', {
      options: ['Yes', 'No']
    }),
    field('daytime_phone', 'Daytime phone', 'phone', {
      autocomplete: 'tel',
      inputmode: 'tel',
      countryCodeDefault: '+1'
    }),
    field('email_address', 'Email address', 'email', {
      autocomplete: 'email',
      inputmode: 'email'
    })
  ];
}

function addressHistoryField(id, label, options = {}) {
  return field(id, label, 'addressHistory', {
    entries: options.entries || 4,
    required: Boolean(options.required),
    stateOptions: US_STATE_OPTIONS
  });
}

function employmentHistoryField(id, label, options = {}) {
  return field(id, label, 'employmentHistory', {
    entries: options.entries || 4,
    required: Boolean(options.required),
    stateOptions: US_STATE_OPTIONS
  });
}

function immigrationHistoryFields() {
  return [
    field('current_immigration_status', 'Current immigration status or category', 'text', {
      placeholder: 'Example: pending asylum, TPS, F-1, parolee, no status, lawful permanent resident.'
    }),
    field('last_arrival_date', 'Most recent U.S. arrival date', 'date'),
    field('i94_number', 'I-94 number, if any', 'text', {
      autocomplete: 'off'
    }),
    field('passport_number', 'Passport number, if relevant', 'text', {
      autocomplete: 'off'
    }),
    field('passport_expiration', 'Passport expiration date', 'date'),
    field('prior_uscis_filings', 'Prior or pending USCIS filings', 'textarea', {
      placeholder: 'List form codes, receipt numbers, filing dates, approvals, denials, RFEs.'
    })
  ];
}

function evidenceFields() {
  return [
    field('identity_documents_available', 'Identity documents available', 'checkboxes', {
      options: ['Passport', 'Birth certificate', 'State ID / driver license', 'Green card', 'EAD card', 'I-94', 'Other']
    }),
    field('supporting_documents_available', 'Supporting documents available', 'textarea', {
      placeholder: 'Receipt notices, court records, marriage certificate, tax returns, pay stubs, translations, photos, letters, etc.'
    }),
    field('translation_needed', 'Do any documents need translation?', 'radio', {
      options: ['Yes', 'No', 'Not sure']
    }),
    field('interpreter_or_preparer_needed', 'Will an interpreter or preparer section be needed?', 'radio', {
      options: ['Yes', 'No', 'Not sure']
    }),
    field('extra_notes_for_preparer', 'Anything else the preparer should know?', 'textarea')
  ];
}

const FORM_OVERRIDES = {
  'I-90': [
    step('green_card_replacement', 'Green card replacement or renewal', 'Tell us why Form I-90 is being prepared.', [
      field('i90_reason', 'Reason for I-90', 'select', {
        required: true,
        options: ['Renew expiring or expired card', 'Replace lost, stolen, or damaged card', 'Correct card error', 'Name or biographic change', 'Never received card', 'Other']
      }),
      field('green_card_expiration', 'Current green card expiration date', 'date'),
      field('green_card_lost_or_stolen_details', 'If lost/stolen/damaged, explain what happened', 'textarea'),
      field('biographic_change_details', 'If name or biographic information changed, describe the change', 'textarea')
    ])
  ],
  'I-130': [
    step('family_petition', 'Family petition details', 'Information about the petitioner, beneficiary, and relationship.', [
      field('petitioner_status', 'Petitioner status', 'select', {
        required: true,
        options: ['U.S. citizen', 'Lawful permanent resident', 'Not sure']
      }),
      field('relationship_to_beneficiary', 'Relationship to beneficiary', 'select', {
        required: true,
        options: ['Spouse', 'Parent', 'Child', 'Sibling', 'Other']
      }),
      field('beneficiary_full_name', 'Beneficiary full legal name', 'text', {
        required: true,
        autocomplete: 'name'
      }),
      field('beneficiary_location', 'Is the beneficiary inside the United States?', 'radio', {
        required: true,
        options: ['Yes', 'No', 'Not sure']
      }),
      field('marriage_date', 'If spouse case, date of marriage', 'date'),
      field('prior_marriages', 'Any prior marriages for either person?', 'textarea')
    ])
  ],
  'I-130A': [
    step('spouse_biographic', 'Spouse beneficiary biographic details', 'Form I-130A usually supports a spouse petition.', [
      addressHistoryField('spouse_residence_history', 'Beneficiary residence history for the last five years', { required: true }),
      employmentHistoryField('spouse_employment_history', 'Beneficiary employment history for the last five years'),
      field('spouse_parents_names', 'Beneficiary parents names and places of birth', 'textarea'),
      field('last_address_together', 'Last address where spouses lived together', 'textarea')
    ])
  ],
  'I-131': [
    step('travel_document', 'Travel document request', 'Tell us which travel document is needed and why.', [
      field('travel_document_type', 'Type of travel document', 'select', {
        required: true,
        options: ['Advance parole', 'Re-entry permit', 'Refugee travel document', 'TPS travel authorization', 'Not sure']
      }),
      field('planned_departure_date', 'Planned departure date', 'date'),
      field('planned_return_date', 'Planned return date', 'date'),
      field('countries_to_visit', 'Countries to visit', 'textarea'),
      field('purpose_of_travel', 'Purpose of travel', 'textarea', { required: true }),
      field('pending_case_receipt', 'Pending USCIS case receipt number, if any', 'text', { autocomplete: 'off' })
    ])
  ],
  'I-485': [
    step('adjustment_basis', 'Adjustment of status basis', 'This helps identify possible related forms and evidence.', [
      field('adjustment_basis', 'Basis for adjustment', 'select', {
        required: true,
        options: ['Family petition', 'Employment petition', 'Diversity visa', 'Asylee or refugee', 'VAWA / special immigrant', 'Other or not sure']
      }),
      field('petitioner_or_sponsor', 'Petitioner, employer, or sponsor name', 'text', { autocomplete: 'organization' }),
      field('underlying_receipt_number', 'Underlying petition receipt number, if any', 'text', { autocomplete: 'off' }),
      field('inside_us_now', 'Are you physically inside the United States now?', 'radio', { required: true, options: ['Yes', 'No'] }),
      field('inspection_or_parole', 'Last entry was inspected, admitted, or paroled?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('medical_exam_status', 'Medical exam I-693 status', 'select', { options: ['Already completed', 'Need to schedule', 'Will submit later if allowed', 'Not sure'] })
    ])
  ],
  'I-539': [
    step('nonimmigrant_extension', 'Change or extend status', 'Information about the status being requested.', [
      field('current_nonimmigrant_status', 'Current nonimmigrant status', 'text', { required: true }),
      field('requested_status', 'Requested status', 'text', { required: true }),
      field('current_i94_expiration', 'Current I-94 expiration date', 'date'),
      field('dependents_included', 'Are dependents included?', 'radio', { options: ['Yes', 'No'] }),
      field('reason_for_extension_or_change', 'Reason for extension or change', 'textarea', { required: true })
    ])
  ],
  'I-589': [
    step('asylum_claim', 'Asylum or withholding request', 'Collects the first layer of facts for document preparation, not legal advice.', [
      field('asylum_basis', 'Primary basis described by applicant', 'checkboxes', {
        options: ['Race', 'Religion', 'Nationality', 'Political opinion', 'Particular social group', 'CAT / torture concern', 'Not sure']
      }),
      field('date_last_entered_us', 'Date last entered the United States', 'date'),
      field('one_year_deadline_issue', 'Is the filing close to or after one year from entry?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('harm_or_fear_summary', 'Short summary of harm or fear', 'textarea', { required: true }),
      field('family_members_included', 'Family members to include', 'textarea')
    ])
  ],
  'I-751': [
    step('remove_conditions', 'Remove conditions on residence', 'Marriage-based conditional resident details.', [
      field('i751_filing_type', 'Filing type', 'select', {
        required: true,
        options: ['Joint filing with spouse', 'Divorce waiver', 'Abuse or extreme cruelty waiver', 'Hardship waiver', 'Not sure']
      }),
      field('conditional_green_card_expiration', 'Conditional green card expiration date', 'date'),
      field('marriage_status_now', 'Current marriage status', 'select', { options: ['Married living together', 'Separated', 'Divorced', 'Widowed', 'Other'] }),
      field('joint_evidence_available', 'Joint evidence available', 'textarea', { placeholder: 'Lease, mortgage, taxes, bank accounts, insurance, children, photos, affidavits.' })
    ])
  ],
  'I-765': [
    step('work_authorization', 'Work permit basis', 'Select the closest category. We verify the exact eligibility category before preparing the form.', [
      field('ead_basis', 'What is the work permit based on?', 'select', {
        required: true,
        options: ['Pending green card / adjustment of status', 'Asylum or pending asylum', 'TPS', 'DACA', 'Student category', 'Parole or humanitarian category', 'Other or not sure']
      }),
      field('eligibility_category_code', 'Eligibility category code, if known', 'text', { placeholder: 'Example: (c)(9), (c)(8), (a)(12)' }),
      field('prior_ead', 'Have you had an EAD before?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('pending_application_receipt', 'Related pending application receipt number, if any', 'text', { autocomplete: 'off' })
    ])
  ],
  'I-821': [
    step('tps_details', 'TPS request details', 'Temporary Protected Status preparation details.', [
      field('tps_country', 'TPS country designation', 'text', { required: true }),
      field('initial_or_reregistration', 'Initial TPS or re-registration?', 'select', { required: true, options: ['Initial TPS', 'Re-registration', 'Late initial filing', 'Not sure'] }),
      field('continuous_residence_date', 'Date of continuous residence in the U.S.', 'date'),
      field('tps_prior_approval', 'Prior TPS approval or receipt numbers', 'textarea')
    ])
  ],
  'I-821D': [
    step('daca_details', 'DACA request details', 'Deferred Action for Childhood Arrivals preparation details.', [
      field('daca_request_type', 'Request type', 'select', { required: true, options: ['Renewal', 'Initial', 'Not sure'] }),
      field('arrival_before_age_16', 'Did you arrive before age 16?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('education_or_military_status', 'School, GED, graduation, or military status', 'textarea'),
      field('prior_daca_dates', 'Prior DACA approval dates and receipt numbers', 'textarea')
    ])
  ],
  'I-864': [
    step('support_affidavit', 'Affidavit of support', 'Sponsor household and income details.', [
      field('sponsor_full_name', 'Sponsor full legal name', 'text', { required: true, autocomplete: 'name' }),
      field('sponsor_status', 'Sponsor status', 'select', { options: ['U.S. citizen', 'Lawful permanent resident', 'U.S. national', 'Not sure'] }),
      field('household_size', 'Household size', 'number', { inputmode: 'numeric' }),
      field('current_annual_income', 'Current annual income', 'text', { inputmode: 'decimal' }),
      field('tax_returns_available', 'Federal tax returns available', 'checkboxes', { options: ['Most recent year', 'Last 2 years', 'Last 3 years', 'W-2/1099', 'Pay stubs', 'Employment letter'] }),
      field('joint_sponsor_needed', 'Is a joint sponsor needed?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ])
  ],
  'I-864A': [
    step('household_member_contract', 'Household member income', 'Details for a household member contributing income.', [
      field('household_member_name', 'Household member full name', 'text', { autocomplete: 'name' }),
      field('relationship_to_sponsor', 'Relationship to sponsor', 'text'),
      field('household_member_income', 'Household member current annual income', 'text', { inputmode: 'decimal' }),
      field('proof_of_residence_available', 'Proof of same residence or household relationship available?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ])
  ],
  'I-912': [
    step('fee_waiver', 'Fee waiver basis', 'Fee waiver facts and documents.', [
      field('fee_waiver_basis', 'Fee waiver basis', 'checkboxes', {
        required: true,
        options: ['Means-tested benefit', 'Household income at or below guideline', 'Financial hardship', 'Not sure']
      }),
      field('benefits_received', 'Public benefits received, if any', 'textarea'),
      field('household_income', 'Household income', 'text', { inputmode: 'decimal' }),
      field('household_size_fee_waiver', 'Household size', 'number', { inputmode: 'numeric' }),
      field('hardship_explanation', 'Financial hardship explanation', 'textarea')
    ])
  ],
  'N-400': [
    step('naturalization', 'Naturalization preparation', 'Basic eligibility and history questions for N-400 preparation.', [
      field('green_card_date', 'Date you became a permanent resident', 'date', { required: true }),
      field('basis_for_naturalization', 'Basis for naturalization', 'select', { options: ['5-year permanent resident', '3-year marriage to U.S. citizen', 'Military', 'Other or not sure'] }),
      field('trips_outside_us', 'Trips outside the U.S. during eligibility period', 'textarea'),
      addressHistoryField('addresses_last_five_years', 'Addresses for the last five years', { required: true }),
      employmentHistoryField('employment_school_last_five_years', 'Employment or school for the last five years', { required: true }),
      field('citizenship_exemptions_needed', 'Any disability/accommodation or language exemption documents?', 'textarea')
    ])
  ],
  'N-565': [
    step('certificate_replacement', 'Certificate replacement', 'Replacement or correction of citizenship/naturalization certificate.', [
      field('certificate_type', 'Certificate type', 'select', { options: ['Naturalization certificate', 'Citizenship certificate', 'Declaration of intention', 'Repatriation certificate', 'Not sure'] }),
      field('replacement_reason', 'Reason for replacement/correction', 'select', { options: ['Lost', 'Stolen', 'Damaged', 'Name change', 'USCIS error', 'Gender change', 'Other'] }),
      field('certificate_number', 'Certificate number, if known', 'text', { autocomplete: 'off' }),
      field('name_change_details', 'Name change or correction details', 'textarea')
    ])
  ],
  'N-600': [
    step('citizenship_certificate', 'Certificate of citizenship', 'Claim to U.S. citizenship through parent or law.', [
      field('citizenship_claim_basis', 'Claim basis', 'select', { options: ['U.S. citizen parent at birth', 'Derived citizenship after birth', 'Adoption', 'Other or not sure'] }),
      field('us_citizen_parent_details', 'U.S. citizen parent details', 'textarea'),
      field('parent_citizenship_evidence', 'Parent citizenship evidence available', 'textarea'),
      field('custody_or_residence_history', 'Custody and residence history', 'textarea')
    ])
  ]
};

function groupSpecificSteps(code, entry) {
  if (FORM_OVERRIDES[code]) return FORM_OVERRIDES[code];

  const subcategory = String(entry?.subcategory || '').toLowerCase();

  if (/864|134|support|sponsor/.test(code.toLowerCase() + ' ' + subcategory)) {
    return FORM_OVERRIDES['I-864'];
  }

  if (/129|140|526|956|employment|investor|petition/.test(code.toLowerCase() + ' ' + subcategory)) {
    return [
      step('petitioner_employer_business', 'Petitioner, employer, or business details', 'Business and employment-based forms need organization-level facts.', [
        field('petitioner_or_business_name', 'Petitioner, employer, or business name', 'text', { autocomplete: 'organization', required: true }),
        field('beneficiary_or_worker_name', 'Beneficiary, investor, or worker name', 'text', { autocomplete: 'name' }),
        field('requested_classification', 'Requested classification or visa category', 'text', { required: true }),
        field('job_or_project_summary', 'Job, investment, or project summary', 'textarea'),
        field('prior_petition_receipts', 'Prior petition receipt numbers, if any', 'textarea')
      ])
    ];
  }

  if (/589|590|730|914|918|929|360|humanitarian|asylum|refugee|victim|vawa|t visa|u visa/.test(code.toLowerCase() + ' ' + subcategory)) {
    return [
      step('humanitarian_case_details', 'Humanitarian case details', 'Collects a structured summary and known related documents.', [
        field('humanitarian_request_type', 'Request type or case category', 'text', { required: true }),
        field('principal_applicant_receipt', 'Principal applicant receipt number, if any', 'text', { autocomplete: 'off' }),
        field('qualifying_event_summary', 'Short factual summary', 'textarea', { required: true }),
        field('family_members_included', 'Family members included or following to join', 'textarea'),
        field('law_enforcement_or_agency_docs', 'Agency, court, or law enforcement documents available', 'textarea')
      ])
    ];
  }

  if (/912|942|fee/.test(code.toLowerCase() + ' ' + subcategory)) {
    return FORM_OVERRIDES['I-912'];
  }

  if (/n-|naturalization|citizenship|certificate/.test(code.toLowerCase() + ' ' + subcategory)) {
    return [
      step('citizenship_naturalization_details', 'Citizenship or naturalization details', 'Information needed to prepare citizenship-related USCIS forms.', [
        field('citizenship_request_type', 'What certificate, benefit, or action is requested?', 'text', { required: true }),
        field('green_card_or_citizenship_date', 'Permanent resident or citizenship date, if any', 'date'),
        field('parent_or_spouse_citizenship_details', 'Parent/spouse citizenship details, if relevant', 'textarea'),
        field('travel_residence_history', 'Travel, residence, or physical presence history', 'textarea'),
        field('prior_certificate_or_case', 'Prior certificate, application, denial, or receipt information', 'textarea')
      ])
    ];
  }

  if (/g-|ar-11|record|foia|biographic|attorney|notice|request/.test(code.toLowerCase() + ' ' + subcategory)) {
    return [
      step('records_or_notice_details', 'Records, notice, or representation details', 'Details for records requests, attorney notices, address changes, or biographic forms.', [
        field('requester_name', 'Requester full name', 'text', { autocomplete: 'name', required: true }),
        field('record_subject_name', 'Record subject full name, if different', 'text', { autocomplete: 'name' }),
        field('request_or_notice_type', 'Type of request or notice', 'text', { required: true }),
        field('records_needed', 'Records, action, or notice details', 'textarea', { required: true }),
        field('delivery_or_account_details', 'Delivery address, account, or representative details', 'textarea')
      ])
    ];
  }

  return [
    step('form_specific_details', `${code} specific details`, 'Answer the questions that identify the purpose and supporting facts for this form.', [
      field('specific_request_type', `What is the specific ${code} request?`, 'text', { required: true }),
      field('people_involved', 'People involved and their roles', 'textarea'),
      field('important_dates', 'Important dates', 'textarea'),
      field('prior_decisions_or_receipts', 'Prior decisions, notices, or receipt numbers', 'textarea'),
      field('desired_outcome', 'What should this preparation accomplish?', 'textarea', { required: true })
    ])
  ];
}

function buildImmigrationFlow(codeValue, entry = {}, official = {}) {
  const code = normalizeCode(codeValue);
  const title = titleFromEntry(code, entry, official);
  const officialSummary = {
    title: official?.title || title,
    pdfUrl: official?.pdfUrl || '',
    cachedPdfUrl: official?.cachedPdfUrl || '',
    instructionsUrl: official?.instructionsUrl || '',
    editionDate: official?.editionDate || '',
    status: official?.status || '',
    cacheStatus: official?.cacheStatus || '',
    cacheNeedsRefresh: Boolean(official?.cacheNeedsRefresh),
    checkedAt: official?.checkedAt || ''
  };

  const steps = [
    step('purpose', TEXT.purpose.title, TEXT.purpose.help, commonPurposeFields(code, title)),
    ...groupSpecificSteps(code, entry),
    step('applicant', TEXT.applicant.title, TEXT.applicant.help, applicantFields()),
    step('address_contact', TEXT.address.title, TEXT.address.help, addressFields()),
    step('immigration_history', TEXT.immigration.title, TEXT.immigration.help, immigrationHistoryFields()),
    step('documents_review', TEXT.evidence.title, TEXT.evidence.help, evidenceFields())
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    code,
    title,
    category: 'immigration',
    official: officialSummary,
    steps,
    disclaimer: DISCLAIMER
  };
}

function localizeFlow(flow, langValue = 'en') {
  const lang = String(langValue || 'en').toLowerCase();
  const copy = LOCALIZATION[lang];
  if (!copy) return flow;

  const translated = JSON.parse(JSON.stringify(flow));
  translated.steps = translated.steps.map((item) => ({
    ...item,
    title: copy.steps?.[item.id] || item.title,
    help: copy.stepHelp?.[item.id] || item.help,
    fields: (item.fields || []).map((fieldItem) => ({
      ...fieldItem,
      label: copy.fields?.[fieldItem.id] || fieldItem.label,
      options: Array.isArray(fieldItem.options)
        ? fieldItem.options.map((option) => copy.options?.[option] || option)
        : fieldItem.options
    }))
  }));
  return translated;
}

module.exports = {
  SCHEMA_VERSION,
  buildImmigrationFlow,
  localizeFlow,
  normalizeCode
};
