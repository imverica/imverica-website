const SCHEMA_VERSION = 'immigration-flow-v1';
const { stateSelectOptions } = require('./us-address');
const { countrySelectOptions } = require('./country-options');
const { buildI485Part9Steps } = require('./i485-part9-flow');

const DISCLAIMER = 'Document preparation only. Possible forms may include official USCIS forms. Imverica is not a law firm or attorney and does not provide legal advice.';

const LOCALIZATION = {
  ru: {
    steps: {
      purpose: 'Назначение формы',
      applicant: 'Данные заявителя',
      address_contact: 'Адрес и контакт',
      immigration_history: 'Иммиграционная история',
      documents_review: 'Документы и проверка',
      work_authorization: 'Основание для разрешения на работу',
      family_petition: 'Детали семейной петиции',
      spouse_biographic: 'Биографические данные супруга',
      travel_document: 'Запрос проездного документа',
      adjustment_basis: 'Основание для изменения статуса',
      asylum_claim: 'Запрос asylum / withholding',
      support_affidavit: 'Финансовая поддержка спонсора',
      fee_waiver: 'Основание для освобождения от пошлины',
      naturalization: 'Подготовка гражданства',
      green_card_replacement: 'Замена или продление green card',
      nonimmigrant_extension: 'Изменение или продление статуса',
      remove_conditions: 'Снятие условий с green card',
      i485_part9_entries: 'Part 9: въезд и иммиграционные вопросы',
      i485_part9_criminal: 'Part 9: criminal и trafficking вопросы',
      i485_part9_security: 'Part 9: security вопросы',
      i485_part9_other: 'Part 9: другие admissibility вопросы',
      tps_details: 'Детали TPS',
      daca_details: 'Детали DACA',
      household_member_contract: 'Доход члена household',
      certificate_replacement: 'Замена сертификата',
      citizenship_certificate: 'Сертификат гражданства',
      biographic_history: 'Адреса и работа за 5 лет'
    },
    stepHelp: {
      purpose: 'Подтвердите, зачем готовится эта форма и есть ли связанные подачи.',
      applicant: 'Укажите данные так, как они должны быть в форме.',
      address_contact: 'Автозаполнение телефона может помочь с именем, телефоном, email и адресом.',
      immigration_history: 'Эти ответы помогают подготовить USCIS-поля и список документов.',
      documents_review: 'Укажите, какие документы уже есть. Файлы можно будет загрузить после checkout или кабинета.',
      adjustment_basis: 'Это помогает определить возможные связанные формы и подтверждающие документы.',
      work_authorization: 'Выберите ближайшее основание. Точную категорию проверим перед подготовкой формы.',
      family_petition: 'Информация о петиционере, бенефициаре и родстве.',
      spouse_biographic: 'Данные супруга-бенефициара для семейной петиции.',
      travel_document: 'Укажите, какой проездной документ нужен и для какой поездки.',
      naturalization: 'Базовые вопросы для подготовки N-400.',
      biographic_history: 'USCIS может требовать адреса и работу за последние 5 лет.',
      i485_part9_entries: 'Отвечайте по официальной логике I-485. Дополнительные поля появятся только если нужны.',
      i485_part9_criminal: 'Если ответ Yes, flow потребует объяснение для Part 14 перед генерацией PDF.',
      i485_part9_security: 'Security-related Yes ответы требуют объяснение с датами и местом.',
      i485_part9_other: 'Оставшиеся вопросы Part 9 помогают определить дополнительные объяснения или документы.'
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
      city_of_birth: 'Город/населенный пункт рождения',
      state_or_province_of_birth: 'Штат/провинция рождения',
      country_of_birth: 'Страна рождения',
      country_of_citizenship: 'Страна гражданства или национальности',
      sex: 'Пол',
      marital_status: 'Семейное положение',
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
      place_entry: 'Место последнего въезда в США',
      i94_number: 'I-94 number, если есть',
      passport_number: 'Номер паспорта, если относится к форме',
      passport_country_of_issuance: 'Страна, выдавшая паспорт или travel document',
      passport_expiration: 'Дата окончания паспорта',
      prior_uscis_filings: 'Предыдущие или ожидающие подачи в USCIS',
      identity_documents_available: 'Какие документы личности есть',
      supporting_documents_available: 'Какие подтверждающие документы есть',
      translation_needed: 'Нужен перевод документов?',
      interpreter_or_preparer_needed: 'Нужна секция interpreter/preparer?',
      has_interpreter: 'Будет interpreter?',
      has_preparer: 'Будет preparer?',
      interpreter_family_name: 'Фамилия interpreter',
      interpreter_given_name: 'Имя interpreter',
      interpreter_business_name: 'Организация interpreter, если есть',
      preparer_family_name: 'Фамилия preparer',
      preparer_given_name: 'Имя preparer',
      preparer_business_name: 'Организация preparer, если есть',
      extra_notes_for_preparer: 'Что еще должен знать preparer?',
      ead_basis: 'Основание для разрешения на работу',
      i765_application_reason: 'Причина подачи I-765',
      eligibility_category_code: 'Код категории права на разрешение, если знаете',
      c8_arrested_or_convicted: 'Для категории (c)(8): были ли аресты или судимости?',
      prior_ead: 'EAD уже был раньше?',
      applicant_statement: 'Заявление заявителя',
      pending_application_receipt: 'Receipt number связанного pending дела, если есть',
      petitioner_status: 'Статус петиционера',
      relationship_to_beneficiary: 'Степень родства с бенефициаром',
      beneficiary_full_name: 'Полное имя бенефициара',
      beneficiary_location: 'Бенефициар находится в США?',
      marriage_date: 'Если дело супруга, дата брака',
      prior_marriages: 'Были ли предыдущие браки у кого-либо?',
      adjustment_basis: 'Основание для изменения статуса',
      petitioner_or_sponsor: 'Имя петиционера, работодателя или спонсора',
      underlying_receipt_number: 'Receipt number основной петиции, если есть',
      inside_us_now: 'Вы сейчас физически находитесь в США?',
      inspection_or_parole: 'Последний въезд был официально разрешен на границе или через parole?',
      medical_exam_status: 'Статус медосмотра I-693',
      travel_document_type: 'Тип проездного документа',
      planned_departure_date: 'Планируемая дата выезда',
      planned_return_date: 'Планируемая дата возвращения',
      countries_to_visit: 'Страны поездки',
      purpose_of_travel: 'Цель поездки',
      asylum_basis: 'Основание asylum по описанию заявителя',
      harm_or_fear_summary: 'Краткое описание harm/fear',
      family_members_included: 'Family members для включения',
      sponsor_full_name: 'Полное имя спонсора',
      household_size: 'Размер household',
      current_annual_income: 'Текущий годовой доход',
      fee_waiver_basis: 'Основание для освобождения от пошлины',
      household_income: 'Доход household',
      green_card_date: 'Дата получения статуса permanent resident',
      basis_for_naturalization: 'Основание для гражданства',
      addresses_last_five_years: 'Адреса за последние 5 лет',
      employment_school_last_five_years: 'Работа или учеба за последние 5 лет',
      spouse_residence_history: 'Адреса beneficiary за последние 5 лет',
      spouse_employment_history: 'Работа beneficiary за последние 5 лет',
      g325a_residence_history: 'Адреса за последние 5 лет',
      g325a_employment_history: 'Работа за последние 5 лет',
      i90_reason: 'Причина подготовки I-90',
      green_card_expiration: 'Дата окончания текущей green card',
      green_card_lost_or_stolen_details: 'Если карта потеряна, украдена или повреждена, опишите что произошло',
      biographic_change_details: 'Если изменились имя или биографические данные, опишите изменение',
      spouse_residence_history: 'Адреса супруга-бенефициара за последние 5 лет',
      spouse_employment_history: 'Работа супруга-бенефициара за последние 5 лет',
      spouse_parents_names: 'Имена родителей бенефициара и места рождения',
      last_address_together: 'Последний общий адрес супругов',
      pending_case_receipt: 'Receipt number ожидающего USCIS-дела, если есть',
      current_nonimmigrant_status: 'Текущий неиммиграционный статус',
      requested_status: 'Запрашиваемый статус',
      current_i94_expiration: 'Дата окончания текущего I-94',
      dependents_included: 'Включены ли члены семьи/dependents?',
      reason_for_extension_or_change: 'Причина изменения или продления статуса',
      date_last_entered_us: 'Дата последнего въезда в США',
      one_year_deadline_issue: 'Подача близко к одному году после въезда или позже?',
      i751_filing_type: 'Тип подачи I-751',
      conditional_green_card_expiration: 'Дата окончания conditional green card',
      marriage_status_now: 'Текущий статус брака',
      joint_evidence_available: 'Какие совместные доказательства есть',
      tps_country: 'Страна TPS designation',
      initial_or_reregistration: 'Первичная подача TPS или повторная регистрация?',
      continuous_residence_date: 'Дата начала непрерывного проживания в США',
      tps_prior_approval: 'Предыдущие TPS approval или receipt numbers',
      daca_request_type: 'Тип запроса DACA',
      arrival_before_age_16: 'Въехали до 16 лет?',
      education_or_military_status: 'Школа, GED, окончание учебы или military status',
      prior_daca_dates: 'Предыдущие DACA approval dates и receipt numbers',
      sponsor_status: 'Статус спонсора',
      tax_returns_available: 'Какие налоговые декларации доступны',
      joint_sponsor_needed: 'Нужен ли дополнительный спонсор?',
      household_member_name: 'Полное имя члена household',
      relationship_to_sponsor: 'Отношение к спонсору',
      household_member_income: 'Годовой доход члена household',
      proof_of_residence_available: 'Есть подтверждение общего адреса или household relationship?',
      benefits_received: 'Получаемые социальные пособия/public benefits, если есть',
      household_size_fee_waiver: 'Размер household',
      hardship_explanation: 'Объяснение финансовых трудностей',
      trips_outside_us: 'Поездки за пределы США за нужный период',
      citizenship_exemptions_needed: 'Нужны документы для disability/accommodation или language exemption?',
      certificate_type: 'Тип сертификата',
      replacement_reason: 'Причина замены или исправления',
      certificate_number: 'Номер сертификата, если знаете',
      name_change_details: 'Детали смены имени или исправления',
      citizenship_claim_basis: 'Основание заявления о гражданстве',
      us_citizen_parent_details: 'Данные родителя-гражданина США',
      parent_citizenship_evidence: 'Доказательства гражданства родителя',
      custody_or_residence_history: 'История custody и проживания'
    },
    options: {
      Yes: 'Да',
      No: 'Нет',
      'Not sure': 'Не знаю',
      Other: 'Другое',
      'Other or not sure': 'Другое или не знаю',
      'Family petition': 'Семейная петиция',
      'Employment petition': 'Петиция через работодателя',
      'Diversity visa': 'Diversity visa',
      'Asylee or refugee': 'Получивший asylum или refugee',
      'VAWA / special immigrant': 'VAWA / special immigrant',
      'Pending green card / adjustment of status': 'Ожидающее заявление на green card / изменение статуса',
      'Asylum or pending asylum': 'Asylum или pending asylum',
      'Initial permission to accept employment': 'Первичное разрешение на работу',
      'Replacement of lost, stolen, or damaged EAD': 'Замена потерянного, украденного или поврежденного EAD',
      'Renewal of permission to accept employment': 'Продление разрешения на работу',
      'I can read and understand English': 'Я читаю и понимаю английский',
      'Interpreter read the application to me': 'Interpreter прочитал(а) мне заявление',
      Male: 'Мужской',
      Female: 'Женский',
      Single: 'Не в браке',
      Married: 'В браке',
      Divorced: 'Разведен(а)',
      Widowed: 'Вдовец/вдова',
      TPS: 'TPS',
      DACA: 'DACA',
      'Student category': 'Студенческая категория',
      'Parole or humanitarian category': 'Parole или гуманитарная категория',
      'Already completed': 'Уже пройден',
      'Need to schedule': 'Нужно записаться',
      'Will submit later if allowed': 'Предоставлю позже, если возможно',
      'U.S. citizen': 'Гражданин США',
      'Lawful permanent resident': 'Постоянный резидент',
      'U.S. national': 'U.S. national',
      Spouse: 'Супруг/супруга',
      Parent: 'Родитель',
      Child: 'Ребенок',
      Sibling: 'Брат/сестра',
      'Advance parole': 'Advance parole (разрешение на выезд)',
      'Re-entry permit': 'Re-entry permit',
      'Refugee travel document': 'Проездной документ refugee',
      'TPS travel authorization': 'TPS travel authorization',
      Race: 'Раса',
      Religion: 'Религия',
      Nationality: 'Национальность',
      'Political opinion': 'Политическое мнение',
      'Particular social group': 'Particular social group',
      'CAT / torture concern': 'CAT / риск пыток',
      'Joint filing with spouse': 'Совместная подача с супругом',
      'Divorce waiver': 'Waiver после развода',
      'Abuse or extreme cruelty waiver': 'Waiver из-за abuse / extreme cruelty',
      'Hardship waiver': 'Hardship waiver',
      'Married living together': 'В браке, проживают вместе',
      Separated: 'Раздельно проживают',
      Divorced: 'Разведены',
      Widowed: 'Вдовец/вдова',
      'Initial TPS': 'Первичная подача TPS',
      'Re-registration': 'Re-registration',
      'Late initial filing': 'Late initial filing',
      Renewal: 'Продление',
      Initial: 'Первичная подача',
      'Means-tested benefit': 'Means-tested benefit',
      'Household income at or below guideline': 'Доход household на уровне guideline или ниже',
      'Financial hardship': 'Финансовые трудности',
      '5-year permanent resident': 'Permanent resident 5 лет',
      '3-year marriage to U.S. citizen': '3 года в браке с гражданином США',
      Military: 'Military',
      'Naturalization certificate': 'Сертификат naturalization',
      'Citizenship certificate': 'Сертификат гражданства',
      'Declaration of intention': 'Declaration of intention',
      'Repatriation certificate': 'Repatriation certificate',
      Lost: 'Потерян',
      Stolen: 'Украден',
      Damaged: 'Поврежден',
      'Name change': 'Смена имени',
      'USCIS error': 'Ошибка USCIS',
      'Gender change': 'Смена gender marker',
      'U.S. citizen parent at birth': 'Родитель был гражданином США при рождении',
      'Derived citizenship after birth': 'Derived citizenship после рождения',
      Adoption: 'Adoption',
      Passport: 'Паспорт',
      'Birth certificate': 'Свидетельство о рождении',
      'State ID / driver license': 'State ID / водительские права',
      'Green card': 'Green card',
      'EAD card': 'EAD card',
      'I-94': 'I-94',
      'United States': 'United States / США',
      Russia: 'Russia / Россия',
      Ukraine: 'Ukraine / Украина',
      Belarus: 'Belarus / Беларусь',
      Kazakhstan: 'Kazakhstan / Казахстан',
      Uzbekistan: 'Uzbekistan / Узбекистан',
      Moldova: 'Moldova / Молдова',
      Georgia: 'Georgia / Грузия',
      Armenia: 'Armenia / Армения',
      Azerbaijan: 'Azerbaijan / Азербайджан',
      Kyrgyzstan: 'Kyrgyzstan / Кыргызстан',
      Tajikistan: 'Tajikistan / Таджикистан',
      Turkmenistan: 'Turkmenistan / Туркменистан'
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
      i485_part9_entries: 'Part 9: в’їзд та імміграційні питання',
      i485_part9_criminal: 'Part 9: criminal та trafficking питання',
      i485_part9_security: 'Part 9: security питання',
      i485_part9_other: 'Part 9: інші admissibility питання',
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
      city_of_birth: 'Місто/населений пункт народження',
      state_or_province_of_birth: 'Штат/провінція народження',
      country_of_birth: 'Країна народження',
      country_of_citizenship: 'Громадянство / nationality',
      sex: 'Стать',
      marital_status: 'Сімейний стан',
      mailing_address_line1: 'Поштова адреса, рядок 1',
      mailing_city: 'Місто',
      mailing_state: 'Штат',
      mailing_zip: 'ZIP code',
      daytime_phone: 'Телефон',
      email_address: 'Email',
      current_immigration_status: 'Поточний імміграційний статус або категорія',
      last_arrival_date: 'Дата останнього в’їзду до США',
      place_entry: 'Місце останнього в’їзду до США',
      passport_country_of_issuance: 'Країна, що видала паспорт або travel document',
      ead_basis: 'На чому базується work permit?',
      i765_application_reason: 'Причина подання I-765',
      eligibility_category_code: 'Eligibility category code, якщо знаєте',
      prior_ead: 'EAD вже був раніше?',
      applicant_statement: 'Заява заявника',
      beneficiary_full_name: 'Повне ім’я beneficiary',
      inside_us_now: 'Ви зараз фізично перебуваєте у США?',
      addresses_last_five_years: 'Адреси за останні 5 років',
      employment_school_last_five_years: 'Робота або навчання за останні 5 років',
      spouse_residence_history: 'Адреси beneficiary за останні 5 років',
      spouse_employment_history: 'Робота beneficiary за останні 5 років',
      g325a_residence_history: 'Адреси за останні 5 років',
      g325a_employment_history: 'Робота за останні 5 років'
    },
    options: {
      Yes: 'Так',
      No: 'Ні',
      'Not sure': 'Не знаю',
      Other: 'Інше',
      'Other or not sure': 'Інше або не знаю',
      'Initial permission to accept employment': 'Первинний дозвіл на роботу',
      'Replacement of lost, stolen, or damaged EAD': 'Заміна втраченого, викраденого або пошкодженого EAD',
      'Renewal of permission to accept employment': 'Продовження дозволу на роботу',
      'I can read and understand English': 'Я читаю і розумію англійську',
      'Interpreter read the application to me': 'Перекладач прочитав мені заяву',
      Male: 'Чоловіча',
      Female: 'Жіноча',
      Single: 'Не в шлюбі',
      Married: 'У шлюбі',
      Divorced: 'Розлучений/розлучена',
      Widowed: 'Вдівець/вдова'
    }
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
      i485_part9_entries: 'Parte 9: entrada y preguntas migratorias',
      i485_part9_criminal: 'Parte 9: preguntas criminales y trafficking',
      i485_part9_security: 'Parte 9: preguntas de seguridad',
      i485_part9_other: 'Parte 9: otras preguntas de admisibilidad',
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
      city_of_birth: 'Ciudad/pueblo de nacimiento',
      state_or_province_of_birth: 'Estado/provincia de nacimiento',
      country_of_birth: 'País de nacimiento',
      country_of_citizenship: 'Ciudadanía / nationality',
      sex: 'Sexo',
      marital_status: 'Estado civil',
      mailing_address_line1: 'Dirección postal línea 1',
      mailing_city: 'Ciudad',
      mailing_state: 'Estado',
      mailing_zip: 'ZIP code',
      daytime_phone: 'Teléfono',
      email_address: 'Email',
      current_immigration_status: 'Estado migratorio actual o categoría',
      last_arrival_date: 'Fecha de la última entrada a Estados Unidos',
      place_entry: 'Lugar de la última entrada a Estados Unidos',
      passport_country_of_issuance: 'País que emitió el pasaporte o travel document',
      ead_basis: '¿En qué se basa el permiso de trabajo?',
      i765_application_reason: 'Motivo de la solicitud I-765',
      eligibility_category_code: 'Eligibility category code, si lo sabe',
      prior_ead: '¿Ha tenido EAD antes?',
      applicant_statement: 'Declaración del solicitante',
      beneficiary_full_name: 'Nombre completo del beneficiario',
      inside_us_now: '¿Está físicamente dentro de Estados Unidos ahora?',
      addresses_last_five_years: 'Direcciones de los últimos 5 años',
      employment_school_last_five_years: 'Trabajo o escuela de los últimos 5 años',
      spouse_residence_history: 'Direcciones del beneficiary de los últimos 5 años',
      spouse_employment_history: 'Trabajo del beneficiary de los últimos 5 años',
      g325a_residence_history: 'Direcciones de los últimos 5 años',
      g325a_employment_history: 'Trabajo de los últimos 5 años'
    },
    options: {
      Yes: 'Sí',
      No: 'No',
      'Not sure': 'No estoy seguro',
      Other: 'Otro',
      'Other or not sure': 'Otro o no estoy seguro',
      'Initial permission to accept employment': 'Permiso inicial para aceptar empleo',
      'Replacement of lost, stolen, or damaged EAD': 'Reemplazo de EAD perdido, robado o dañado',
      'Renewal of permission to accept employment': 'Renovación del permiso para aceptar empleo',
      'I can read and understand English': 'Puedo leer y entender inglés',
      'Interpreter read the application to me': 'Un intérprete me leyó la solicitud',
      Male: 'Masculino',
      Female: 'Femenino',
      Single: 'Soltero/a',
      Married: 'Casado/a',
      Divorced: 'Divorciado/a',
      Widowed: 'Viudo/a'
    }
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
const COUNTRY_OPTIONS = countrySelectOptions();

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
      required: true,
      autocomplete: 'given-name'
    }),
    field('applicant_family_name', 'Family name', 'text', {
      required: true,
      autocomplete: 'family-name'
    }),
    field('other_names_used', 'Other names used', 'textarea', {
      placeholder: 'Maiden name, prior legal names, aliases.'
    }),
    field('date_of_birth', 'Date of birth', 'date', {
      required: true,
      autocomplete: 'bday'
    }),
    field('city_of_birth', 'City/town/village of birth', 'text', {
      autocomplete: 'off'
    }),
    field('state_or_province_of_birth', 'State/province of birth', 'text', {
      autocomplete: 'off'
    }),
    field('country_of_birth', 'Country of birth', 'select', {
      autocomplete: 'country-name',
      options: COUNTRY_OPTIONS
    }),
    field('country_of_citizenship', 'Country of citizenship or nationality', 'select', {
      autocomplete: 'country-name',
      options: COUNTRY_OPTIONS
    }),
    field('sex', 'Sex', 'radio', {
      options: ['Male', 'Female']
    }),
    field('marital_status', 'Marital status', 'select', {
      options: ['Single', 'Married', 'Divorced', 'Widowed']
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
    field('mailing_country', 'Country', 'select', {
      autocomplete: 'country-name',
      value: 'United States',
      options: COUNTRY_OPTIONS
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
    stateOptions: US_STATE_OPTIONS,
    countryOptions: COUNTRY_OPTIONS
  });
}

function employmentHistoryField(id, label, options = {}) {
  return field(id, label, 'employmentHistory', {
    entries: options.entries || 4,
    required: Boolean(options.required),
    stateOptions: US_STATE_OPTIONS,
    countryOptions: COUNTRY_OPTIONS
  });
}

function immigrationHistoryFields() {
  return [
    field('current_immigration_status', 'Current immigration status or category', 'text', {
      placeholder: 'Example: pending asylum, TPS, F-1, parolee, no status, lawful permanent resident.'
    }),
    field('last_arrival_date', 'Most recent U.S. arrival date', 'date'),
    field('place_entry', 'Place of your last arrival into the United States', 'text', {
      placeholder: 'Example: Los Angeles, CA; San Ysidro, CA; JFK, New York.'
    }),
    field('i94_number', 'I-94 number, if any', 'text', {
      autocomplete: 'off'
    }),
    field('passport_number', 'Passport number, if relevant', 'text', {
      autocomplete: 'off'
    }),
    field('passport_country_of_issuance', 'Country that issued passport or travel document', 'select', {
      autocomplete: 'country-name',
      options: COUNTRY_OPTIONS
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
    field('has_interpreter', 'Will an interpreter be used for this application?', 'radio', {
      options: ['Yes', 'No', 'Not sure']
    }),
    field('has_preparer', 'Will someone prepare this application for the applicant?', 'radio', {
      options: ['Yes', 'No', 'Not sure']
    }),
    field('interpreter_family_name', 'Interpreter family name, if any', 'text', { autocomplete: 'family-name' }),
    field('interpreter_given_name', 'Interpreter given name, if any', 'text', { autocomplete: 'given-name' }),
    field('interpreter_business_name', 'Interpreter business or organization, if any', 'text', { autocomplete: 'organization' }),
    field('preparer_family_name', 'Preparer family name, if any', 'text', { autocomplete: 'family-name' }),
    field('preparer_given_name', 'Preparer given name, if any', 'text', { autocomplete: 'given-name' }),
    field('preparer_business_name', 'Preparer business or organization, if any', 'text', { autocomplete: 'organization' }),
    field('extra_notes_for_preparer', 'Anything else the preparer should know?', 'textarea')
  ];
}

function i485CoreSteps() {
  return [
    step('i485_entry_details', 'I-485 entry and status details', 'These fields map to the official I-485 arrival and status section.', [
      field('admission_basis', 'Admission basis at last entry', 'select', {
        options: ['Immigrant', 'Nonimmigrant', 'Paroled', 'Other']
      }),
      field('status_at_last_entry', 'Status at last entry, if admitted', 'text', {
        placeholder: 'Example: B-2, F-1, parolee, asylee'
      }),
      field('paroled_as', 'If paroled, class of admission or parole type', 'text', {
        placeholder: 'Example: PAROLED, DT, UHP'
      }),
      field('date_of_last_entry', 'Date of last entry shown on I-94', 'date'),
      field('manner_of_last_entry', 'Status on Form I-94 or entry document', 'text', {
        placeholder: 'Example: ASYLEE, PAROLEE, D/S'
      }),
      field('authorized_stay_expires', 'Authorized stay expiration date or D/S', 'text', {
        placeholder: 'Example: D/S or 05/11/2026'
      }),
      field('status_expiration_date', 'Nonimmigrant status expiration date, if any', 'text'),
      field('visa_number', 'Nonimmigrant visa number, if any', 'text', { autocomplete: 'off' }),
      field('in_removal_proceedings', 'Are you in removal, exclusion, rescission, or deportation proceedings?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
      field('prior_removal_order', 'Have you ever had a prior removal/deportation order?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
      field('ever_removed_excluded', 'Have you ever been removed, excluded, or deported?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      })
    ]),
    step('i485_prior_addresses_ssn', 'I-485 prior addresses and Social Security', 'I-485 asks for prior residence history and Social Security details.', [
      field('same_address_five_years', 'Have you lived at your current physical address for the required residence period?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      }),
      addressHistoryField('prior_us_addresses', 'Prior U.S. physical address, if current address does not cover the period', {
        entries: 1
      }),
      addressHistoryField('last_foreign_address', 'Most recent address outside the United States', {
        entries: 1
      }),
      field('has_ssn', 'Has the Social Security Administration ever issued you an SSN?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      }),
      field('ssn', 'Social Security number', 'text', {
        inputmode: 'numeric',
        autocomplete: 'off',
        placeholder: '9 digits'
      }),
      field('ssn_ssa_consent', 'Do you want SSA to issue a replacement/new Social Security card using this application?', 'radio', {
        options: ['Yes', 'No']
      })
    ]),
    step('i485_processing_employment', 'I-485 processing and work history', 'Current and most recent work history helps complete the I-485 employment sections.', [
      field('petition_previously_filed', 'Was an underlying immigrant petition previously filed?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
      field('petition_receipt_number', 'Underlying petition receipt number', 'text', { autocomplete: 'off' }),
      field('petition_date', 'Underlying petition filing or approval date', 'date'),
      field('petitioner_family_name', 'Petitioner family name, if person', 'text', { autocomplete: 'family-name' }),
      field('petitioner_given_name', 'Petitioner given name, if person', 'text', { autocomplete: 'given-name' }),
      field('petitioner_alien_number', 'Petitioner A-number, if any', 'text', { autocomplete: 'off' }),
      field('concurrent_filing', 'Is the underlying petition being filed together with I-485?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
      field('eligibility_basis', 'Exact adjustment category or basis', 'text', {
        placeholder: 'Example: asylee, refugee, IR-1 spouse of U.S. citizen, EB-3'
      }),
      field('currently_working', 'Are you currently employed?', 'radio', { options: ['Yes', 'No'] }),
      field('worked_without_authorization', 'Have you ever worked in the United States without authorization?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
      employmentHistoryField('current_employment_history', 'Current U.S. employment or school', { entries: 1 }),
      employmentHistoryField('foreign_employment_history', 'Most recent employment outside the United States', { entries: 1 })
    ]),
    step('i485_family_history', 'I-485 family history', 'Parents, spouse, prior spouse, and children are structured so the PDF can be filled accurately.', [
      field('father_family_name', 'Parent 1 family name', 'text', { autocomplete: 'family-name' }),
      field('father_given_name', 'Parent 1 given name', 'text', { autocomplete: 'given-name' }),
      field('father_middle_name', 'Parent 1 middle name', 'text'),
      field('father_dob', 'Parent 1 date of birth', 'date'),
      field('father_city_of_birth', 'Parent 1 country/place of birth', 'text'),
      field('mother_family_name', 'Parent 2 current family name', 'text', { autocomplete: 'family-name' }),
      field('mother_given_name', 'Parent 2 current given name', 'text', { autocomplete: 'given-name' }),
      field('mother_middle_name', 'Parent 2 middle name', 'text'),
      field('mother_birth_family_name', 'Parent 2 family name at birth', 'text', { autocomplete: 'family-name' }),
      field('mother_birth_given_name', 'Parent 2 given name at birth', 'text', { autocomplete: 'given-name' }),
      field('mother_birth_middle_name', 'Parent 2 middle name at birth', 'text'),
      field('mother_dob', 'Parent 2 date of birth', 'date'),
      field('mother_city_of_birth', 'Parent 2 country/place of birth', 'text'),
      field('times_married', 'How many times have you been married?', 'number', { inputmode: 'numeric' }),
      field('spouse_family_name', 'Current spouse family name, if any', 'text', { autocomplete: 'family-name' }),
      field('spouse_given_name', 'Current spouse given name, if any', 'text', { autocomplete: 'given-name' }),
      field('spouse_alien_number', 'Current spouse A-number, if any', 'text', { autocomplete: 'off' }),
      field('spouse_country_of_birth', 'Current spouse country of birth', 'select', { options: COUNTRY_OPTIONS }),
      field('current_marriage_date', 'Current marriage date', 'date'),
      field('current_marriage_city', 'Current marriage city or town', 'text'),
      field('current_marriage_state', 'Current marriage state or province', 'text'),
      field('current_marriage_country', 'Current marriage country', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i485_prior_spouse_children_bio', 'Prior spouse, children, and biographic details', 'This covers the remaining I-485 family and biographic fields before the admissibility questions.', [
      field('prior_spouse_family_name', 'Prior spouse family name', 'text', { autocomplete: 'family-name' }),
      field('prior_spouse_given_name', 'Prior spouse given name', 'text', { autocomplete: 'given-name' }),
      field('prior_spouse_dob', 'Prior spouse date of birth', 'date'),
      field('prior_spouse_country_of_birth', 'Prior spouse country of birth', 'select', { options: COUNTRY_OPTIONS }),
      field('prior_spouse_country_of_citizenship', 'Prior spouse country of citizenship', 'select', { options: COUNTRY_OPTIONS }),
      field('prior_spouse_marriage_date', 'Date of marriage to prior spouse', 'date'),
      field('prior_spouse_marriage_city', 'Marriage city or town with prior spouse', 'text'),
      field('prior_spouse_marriage_state', 'Marriage state/province with prior spouse', 'text'),
      field('prior_spouse_marriage_country', 'Marriage country with prior spouse', 'select', { options: COUNTRY_OPTIONS }),
      field('prior_spouse_marriage_end_city', 'City/town where prior marriage ended', 'text'),
      field('prior_spouse_marriage_end_state', 'State/province where prior marriage ended', 'text'),
      field('prior_spouse_marriage_end_country', 'Country where prior marriage ended', 'select', { options: COUNTRY_OPTIONS }),
      field('prior_spouse_marriage_end_date', 'Date prior marriage ended', 'date'),
      field('prior_spouse_marriage_end_type', 'How prior marriage ended', 'select', {
        options: [
          { value: '3', label: 'Divorced' },
          { value: '1', label: 'Annulled' },
          { value: '0', label: 'Widowed' },
          { value: '2', label: 'Other' }
        ]
      }),
      field('total_children', 'Total number of children', 'number', { inputmode: 'numeric' }),
      field('child1_family_name', 'Child 1 family name', 'text', { autocomplete: 'family-name' }),
      field('child1_given_name', 'Child 1 given name', 'text', { autocomplete: 'given-name' }),
      field('child1_alien_number', 'Child 1 A-number, if any', 'text', { autocomplete: 'off' }),
      field('child1_dob', 'Child 1 date of birth', 'date'),
      field('child1_country_of_birth', 'Child 1 country of birth', 'select', { options: COUNTRY_OPTIONS }),
      field('child1_relationship', 'Child 1 relationship', 'text', { placeholder: 'Example: biological child, stepchild' }),
      field('child1_applying_with_you', 'Is child 1 applying with you?', 'radio', { options: ['Yes', 'No'] }),
      field('ethnicity', 'Ethnicity', 'select', { options: ['Hispanic or Latino', 'Not Hispanic or Latino'] }),
      field('race', 'Race', 'checkboxes', { options: ['White', 'Asian', 'Black or African American', 'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander'] }),
      field('height_feet', 'Height feet', 'number', { inputmode: 'numeric' }),
      field('height_inches', 'Height inches', 'number', { inputmode: 'numeric' }),
      field('weight_lbs', 'Weight in pounds', 'number', { inputmode: 'numeric' }),
      field('eye_color', 'Eye color', 'select', { options: ['Black', 'Blue', 'Brown', 'Gray', 'Green', 'Hazel', 'Maroon', 'Pink', 'Unknown'] }),
      field('hair_color', 'Hair color', 'select', { options: ['Bald', 'Black', 'Blond', 'Brown', 'Gray', 'Red', 'Sandy', 'White', 'Unknown'] })
    ])
  ];
}

const FORM_OVERRIDES = {
  'G-325A': [
    step('biographic_history', 'Biographic residence and employment history', 'Biographic information forms commonly require structured residence and employment history.', [
      addressHistoryField('g325a_residence_history', 'Residence history for the last five years', { required: true }),
      employmentHistoryField('g325a_employment_history', 'Employment history for the last five years', { required: true }),
      field('g325a_parents_spouses', 'Parents, spouses, and prior names', 'textarea'),
      field('g325a_additional_history_notes', 'Additional biographic history notes', 'textarea')
    ])
  ],
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
    ]),
    ...i485CoreSteps(),
    ...buildI485Part9Steps(field, step)
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
      field('i765_application_reason', 'Reason for applying on I-765', 'select', {
        required: true,
        options: ['Initial permission to accept employment', 'Replacement of lost, stolen, or damaged EAD', 'Renewal of permission to accept employment']
      }),
      field('ead_basis', 'What is the work permit based on?', 'select', {
        required: true,
        options: ['Pending green card / adjustment of status', 'Asylum or pending asylum', 'TPS', 'DACA', 'Student category', 'Parole or humanitarian category', 'Other or not sure']
      }),
      field('eligibility_category_code', 'Eligibility category code, if known', 'text', { placeholder: 'Example: (c)(9), (c)(8), (a)(12)' }),
      field('c8_arrested_or_convicted', 'For category (c)(8), have you ever been arrested for or convicted of any crime?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('prior_ead', 'Have you had an EAD before?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('applicant_statement', 'Applicant statement', 'radio', {
        required: true,
        options: ['I can read and understand English', 'Interpreter read the application to me']
      }),
      field('pending_application_receipt', 'Related pending application receipt number, if any', 'text', { autocomplete: 'off' })
    ])
  ],
  'I-821': [
    step('tps_details', 'TPS request details', 'Temporary Protected Status preparation details.', [
      field('tps_country', 'TPS country designation', 'select', { required: true, options: COUNTRY_OPTIONS }),
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

  const localizeOption = (option) => {
    if (option && typeof option === 'object') {
      const value = String(option.value ?? option.label ?? '');
      return {
        ...option,
        value,
        label: copy.options?.[value] || option.label || value
      };
    }

    const value = String(option || '');
    const label = copy.options?.[value];
    return label ? { value, label } : option;
  };

  const translated = JSON.parse(JSON.stringify(flow));
  translated.steps = translated.steps.map((item) => ({
    ...item,
    title: copy.steps?.[item.id] || item.title,
    help: copy.stepHelp?.[item.id] || item.help,
    fields: (item.fields || []).map((fieldItem) => ({
      ...fieldItem,
      label: copy.fields?.[fieldItem.id] || fieldItem.label,
      options: Array.isArray(fieldItem.options)
        ? fieldItem.options.map(localizeOption)
        : fieldItem.options,
      countryOptions: Array.isArray(fieldItem.countryOptions)
        ? fieldItem.countryOptions.map(localizeOption)
        : fieldItem.countryOptions
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
