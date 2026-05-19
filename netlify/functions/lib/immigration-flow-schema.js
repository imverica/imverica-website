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
      applicant_birth: 'Рождение и гражданство',
      applicant_birth_date: 'Дата рождения',
      applicant_birth_place: 'Место рождения',
      applicant_birth_country: 'Страна рождения',
      applicant_citizenship: 'Гражданство / nationality',
      applicant_identity: 'ID номера и биография',
      applicant_sex_marital: 'Пол и семейное положение',
      applicant_uscis_numbers: 'USCIS номера',
      physical_address_match: 'Физический адрес',
      contact_info: 'Телефон и email',
      immigration_entry_record: 'I-94 и место въезда',
      immigration_passport: 'Паспорт или travel document',
      immigration_passport_expiration: 'Срок действия паспорта',
      immigration_prior_filings: 'Предыдущие USCIS подачи',
      documents_identity: 'Документы личности',
      documents_supporting: 'Подтверждающие документы',
      documents_translation: 'Переводы документов',
      documents_interpreter_choice: 'Interpreter / preparer',
      documents_interpreter_preparer_need: 'Нужна секция interpreter/preparer?',
      documents_interpreter: 'Данные interpreter',
      documents_interpreter_business: 'Организация interpreter',
      documents_preparer: 'Данные preparer',
      documents_preparer_business: 'Организация preparer',
      documents_notes: 'Заметки для preparer',
      work_authorization: 'Основание для разрешения на работу',
      family_petition: 'Детали семейной петиции',
      spouse_biographic: 'Биографические данные супруга',
      travel_document: 'Запрос проездного документа',
      adjustment_basis: 'Основание для изменения статуса',
      i485_related_petition: 'I-485: петиция или спонсор',
      i485_location_status: 'I-485: нахождение в США и въезд',
      i485_medical_exam: 'I-485: medical exam I-693',
      i485_last_entry_type: 'I-485: тип последнего въезда',
      i485_parole_details: 'I-485: parole details',
      i485_i94_status: 'I-485: I-94 и статус при въезде',
      i485_status_expiration: 'I-485: срок разрешенного пребывания',
      i485_visa_number: 'I-485: номер визы',
      i485_removal_history: 'I-485: removal / deportation',
      i485_residence_period: 'I-485: проживание по текущему адресу',
      i485_prior_us_address: 'I-485: предыдущий адрес в США',
      i485_foreign_address: 'I-485: последний адрес за пределами США',
      i485_social_security: 'I-485: Social Security',
      i485_petition_filing: 'I-485: основная петиция',
      i485_petition_person: 'I-485: данные петиционера',
      i485_petition_category: 'I-485: категория подачи',
      i485_work_status: 'I-485: работа в США',
      i485_current_work_history: 'I-485: текущая работа или учеба',
      i485_foreign_work_history: 'I-485: последняя работа за пределами США',
      i485_parent1_name: 'I-485: родитель 1',
      i485_parent1_birth: 'I-485: рождение родителя 1',
      i485_parent2_current_name: 'I-485: родитель 2',
      i485_parent2_birth_name: 'I-485: имя родителя 2 при рождении',
      i485_parent2_birth: 'I-485: рождение родителя 2',
      i485_marriage_count: 'I-485: количество браков',
      i485_current_spouse_name: 'I-485: текущий супруг',
      i485_current_spouse_birth: 'I-485: страна рождения супруга',
      i485_current_marriage: 'I-485: текущий брак',
      i485_prior_spouse_name: 'I-485: предыдущий супруг',
      i485_prior_spouse_birth: 'I-485: рождение и гражданство бывшего супруга',
      i485_prior_spouse_marriage: 'I-485: брак с бывшим супругом',
      i485_prior_spouse_end: 'I-485: окончание предыдущего брака',
      i485_prior_spouse_end_place: 'I-485: где закончился предыдущий брак',
      i485_prior_spouse_end_result: 'I-485: дата и тип окончания брака',
      i485_children_count: 'I-485: количество детей',
      i485_child1_identity: 'I-485: ребенок 1',
      i485_child1_details: 'I-485: данные ребенка 1',
      i485_biographic_identity: 'I-485: ethnicity и race',
      i485_biographic_physical: 'I-485: рост, вес, глаза и волосы',
      i485_biographic_body: 'I-485: рост и вес',
      i485_biographic_colors: 'I-485: глаза и волосы',
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
      i765_application_reason: 'I-765: причина подачи',
      i765_work_permit_basis: 'I-765: основание work permit',
      i765_eligibility_category: 'I-765: eligibility category',
      i765_pending_receipt: 'I-765: связанное pending дело',
      i765_prior_ead: 'I-765: предыдущий EAD',
      i765_social_security: 'I-765: Social Security',
      i765_applicant_statement: 'I-765: заявление заявителя',
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
      applicant_birth: 'Место рождения, страна рождения и гражданство должны совпадать с документами.',
      applicant_birth_date: 'Дата рождения должна совпадать с документами.',
      applicant_birth_place: 'Город, штат/провинция и страна рождения.',
      applicant_citizenship: 'Укажите страну гражданства или nationality.',
      applicant_identity: 'A-number и USCIS account number указывайте только если они есть.',
      applicant_sex_marital: 'Эти ответы идут в biographic section формы.',
      applicant_uscis_numbers: 'A-number и USCIS online account number вводятся только если они есть.',
      contact_info: 'Телефон вводится отдельно: country code, area code, local number.',
      immigration_entry_record: 'Место въезда и I-94 должны совпадать с entry record.',
      immigration_passport: 'Паспортные данные вводятся только если относятся к форме.',
      immigration_prior_filings: 'Receipt numbers и предыдущие подачи помогают собрать правильный пакет.',
      documents_identity: 'Выберите документы личности, которые уже есть.',
      documents_supporting: 'Перечислите подтверждающие документы без загрузки файлов на этом шаге.',
      documents_translation: 'Отметьте, нужны ли переводы.',
      documents_interpreter_choice: 'Эти ответы управляют секциями interpreter и preparer.',
      documents_interpreter: 'Заполняется только если будет interpreter.',
      documents_preparer: 'Заполняется только если будет preparer.',
      documents_notes: 'Дополнительные заметки для подготовки документов.',
      adjustment_basis: 'Это помогает определить возможные связанные формы и подтверждающие документы.',
      i485_related_petition: 'Если есть основная петиция, receipt number, employer или sponsor, укажите здесь.',
      i485_location_status: 'Эти ответы определяют последующие вопросы про последний въезд и статус.',
      i485_medical_exam: 'I-693 можно приложить сразу или предоставить позже, если это допустимо.',
      i485_last_entry_type: 'Ответьте строго по последнему въезду в США.',
      i485_parole_details: 'Если въезд был через parole, укажите parole class или текст из I-94.',
      i485_i94_status: 'Данные должны совпадать с I-94 или entry record.',
      i485_status_expiration: 'Если в документе указано D/S, вводите D/S.',
      i485_visa_number: 'Если визы не было или не относится, оставьте пустым.',
      i485_removal_history: 'Эти вопросы идут отдельным блоком, потому что Yes требует проверки и объяснения.',
      i485_residence_period: 'Сначала подтвердите, закрывает ли текущий адрес требуемый период.',
      i485_prior_us_address: 'Если текущий адрес не покрывает весь период, добавьте предыдущий адрес в США.',
      i485_foreign_address: 'Последний адрес за пределами США нужен отдельным структурированным блоком.',
      i485_social_security: 'SSN должен быть 9 цифр, если он есть.',
      i485_petition_filing: 'Receipt number основной петиции нужен только если такая петиция есть.',
      i485_petition_person: 'Если петиционер человек, укажите имя. Если организация, используйте поле sponsor/employer выше.',
      i485_petition_category: 'Эти ответы помогают выбрать правильную часть формы без гадания.',
      i485_work_status: 'Работа в США влияет на отдельные вопросы I-485.',
      i485_current_work_history: 'Введите текущую работу или учебу как структурированную запись.',
      i485_foreign_work_history: 'Введите последнюю работу за пределами США как структурированную запись.',
      i485_parent1_name: 'Данные родителя 1 должны идти как в форме.',
      i485_parent1_birth: 'Дата и место рождения родителя 1.',
      i485_parent2_current_name: 'Текущее имя родителя 2.',
      i485_parent2_birth_name: 'Имя родителя 2 при рождении, если отличается.',
      i485_parent2_birth: 'Дата и место рождения родителя 2.',
      i485_marriage_count: 'Количество браков используется для spouse/prior spouse секций.',
      i485_current_spouse_name: 'Заполняется только если есть текущий супруг.',
      i485_current_spouse_birth: 'Страна рождения текущего супруга.',
      i485_current_marriage: 'Дата и место текущего брака.',
      i485_prior_spouse_name: 'Заполняется, если был предыдущий супруг.',
      i485_prior_spouse_birth: 'Дата рождения и страны бывшего супруга.',
      i485_prior_spouse_marriage: 'Дата и место брака с бывшим супругом.',
      i485_prior_spouse_end: 'Дата, место и способ окончания предыдущего брака.',
      i485_prior_spouse_end_place: 'Место, где закончился предыдущий брак.',
      i485_prior_spouse_end_result: 'Дата и способ окончания предыдущего брака.',
      i485_children_count: 'Сначала укажите количество детей.',
      i485_child1_identity: 'Данные первого ребенка.',
      i485_child1_details: 'Дата рождения, страна и отношение ребенка.',
      i485_biographic_identity: 'Эти значения идут в biographic section.',
      i485_biographic_physical: 'Рост, вес, цвет глаз и волос.',
      i485_biographic_body: 'Рост и вес в американском формате.',
      i485_biographic_colors: 'Цвет глаз и волос.',
      work_authorization: 'Выберите ближайшее основание. Точную категорию проверим перед подготовкой формы.',
      family_petition: 'Информация о петиционере, бенефициаре и родстве.',
      spouse_biographic: 'Данные супруга-бенефициара для семейной петиции.',
      travel_document: 'Укажите, какой проездной документ нужен и для какой поездки.',
      naturalization: 'Базовые вопросы для подготовки N-400.',
      biographic_history: 'USCIS может требовать адреса и работу за последние 5 лет.',
      i485_part9_entries: 'Отвечайте по официальной логике I-485. Дополнительные поля появятся только если нужны.',
      i485_part9_criminal: 'Если ответ Yes, flow потребует объяснение для Part 14 перед генерацией PDF.',
      i485_part9_security: 'Security-related Yes ответы требуют объяснение с датами и местом.',
      i485_part9_other: 'Оставшиеся вопросы Part 9 помогают определить дополнительные объяснения или документы.',
      i765_application_reason: 'Первый официальный блок I-765: initial, replacement или renewal.',
      i765_work_permit_basis: 'Выберите, на чем основан work permit. Точную категорию проверим отдельно.',
      i765_eligibility_category: 'Eligibility category должна быть точной. Для (c)(8) Item 30 задается отдельно.',
      i765_pending_receipt: 'Receipt number нужен только если категория требует связанное pending дело.',
      i765_prior_ead: 'Отметьте, был ли раньше EAD, чтобы собрать копию или объяснение.',
      i765_social_security: 'SSN должен быть ровно 9 цифр, если он есть.',
      i765_applicant_statement: 'Этот блок управляет applicant statement и interpreter/preparer секциями.'
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
      mailing_address: 'Почтовый адрес',
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
      'Pending asylum (c)(8)': 'Pending asylum (c)(8)',
      'Granted asylum (a)(5)': 'Полученный asylum (a)(5)',
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
    },
    placeholders: {
      preparation_goal: 'Опишите запрос своими словами.',
      related_forms_known: 'Например: I-130 receipt, pending I-485, I-797 notice, A-number.',
      deadline_or_notice: 'Укажите дату и тип уведомления, если оно есть.',
      other_names_used: 'Девичья фамилия, прежние legal names, aliases.',
      current_immigration_status: 'Например: pending asylum, TPS, F-1, parolee, no status, lawful permanent resident.',
      place_entry: 'Например: Los Angeles, CA; San Ysidro, CA; JFK, New York.',
      prior_uscis_filings: 'Укажите form codes, receipt numbers, filing dates, approvals, denials, RFEs.',
      supporting_documents_available: 'Receipt notices, court records, marriage certificate, tax returns, pay stubs, translations, photos, letters и т.д.'
    }
  },
  uk: {
    steps: {
      purpose: 'Призначення форми',
      applicant: 'Дані заявника',
      address_contact: 'Адреса і контакт',
      immigration_history: 'Імміграційна історія',
      documents_review: 'Документи і перевірка',
      applicant_birth: 'Народження і громадянство',
      applicant_birth_date: 'Дата народження',
      applicant_birth_place: 'Місце народження',
      applicant_citizenship: 'Громадянство / nationality',
      applicant_identity: 'ID номери і біографія',
      applicant_sex_marital: 'Стать і сімейний стан',
      applicant_uscis_numbers: 'USCIS номери',
      contact_info: 'Фізична адреса і контакт',
      immigration_entry_record: 'I-94 і місце в’їзду',
      immigration_passport: 'Паспорт або travel document',
      immigration_prior_filings: 'Попередні USCIS подання',
      documents_identity: 'Документи особи',
      documents_supporting: 'Підтверджуючі документи',
      documents_translation: 'Переклади документів',
      documents_interpreter_choice: 'Interpreter / preparer',
      documents_interpreter: 'Дані interpreter',
      documents_preparer: 'Дані preparer',
      documents_notes: 'Нотатки для preparer',
      work_authorization: 'Підстава для work permit',
      family_petition: 'Деталі сімейної петиції',
      travel_document: 'Запит travel document',
      adjustment_basis: 'Підстава для adjustment of status',
      i485_related_petition: 'I-485: петиція або sponsor',
      i485_location_status: 'I-485: перебування у США і в’їзд',
      i485_medical_exam: 'I-485: medical exam I-693',
      i485_part9_entries: 'Part 9: в’їзд та імміграційні питання',
      i485_part9_criminal: 'Part 9: criminal та trafficking питання',
      i485_part9_security: 'Part 9: security питання',
      i485_part9_other: 'Part 9: інші admissibility питання',
      i765_application_reason: 'I-765: причина подання',
      i765_work_permit_basis: 'I-765: підстава work permit',
      i765_eligibility_category: 'I-765: eligibility category',
      i765_pending_receipt: 'I-765: пов’язане pending діло',
      i765_prior_ead: 'I-765: попередній EAD',
      i765_social_security: 'I-765: Social Security',
      i765_applicant_statement: 'I-765: заява заявника',
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
      mailing_address: 'Поштова адреса',
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
      'Pending green card / adjustment of status': 'Очікувана green card / adjustment of status',
      'Pending asylum (c)(8)': 'Pending asylum (c)(8)',
      'Granted asylum (a)(5)': 'Наданий asylum (a)(5)',
      TPS: 'TPS',
      DACA: 'DACA',
      'Student category': 'Студентська категорія',
      'Parole or humanitarian category': 'Parole або гуманітарна категорія',
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
      applicant_birth: 'Nacimiento y ciudadanía',
      applicant_birth_date: 'Fecha de nacimiento',
      applicant_birth_place: 'Lugar de nacimiento',
      applicant_citizenship: 'Ciudadanía / nationality',
      applicant_identity: 'Números ID y biografía',
      applicant_sex_marital: 'Sexo y estado civil',
      applicant_uscis_numbers: 'Números USCIS',
      contact_info: 'Dirección física y contacto',
      immigration_entry_record: 'I-94 y lugar de entrada',
      immigration_passport: 'Pasaporte o travel document',
      immigration_prior_filings: 'Solicitudes USCIS anteriores',
      documents_identity: 'Documentos de identidad',
      documents_supporting: 'Documentos de apoyo',
      documents_translation: 'Traducciones de documentos',
      documents_interpreter_choice: 'Interpreter / preparer',
      documents_interpreter: 'Datos del interpreter',
      documents_preparer: 'Datos del preparer',
      documents_notes: 'Notas para preparer',
      work_authorization: 'Base del permiso de trabajo',
      family_petition: 'Detalles de petición familiar',
      travel_document: 'Solicitud de travel document',
      adjustment_basis: 'Base para adjustment of status',
      i485_related_petition: 'I-485: petición o sponsor',
      i485_location_status: 'I-485: presencia en EE.UU. y entrada',
      i485_medical_exam: 'I-485: medical exam I-693',
      i485_part9_entries: 'Parte 9: entrada y preguntas migratorias',
      i485_part9_criminal: 'Parte 9: preguntas criminales y trafficking',
      i485_part9_security: 'Parte 9: preguntas de seguridad',
      i485_part9_other: 'Parte 9: otras preguntas de admisibilidad',
      i765_application_reason: 'I-765: motivo de solicitud',
      i765_work_permit_basis: 'I-765: base del work permit',
      i765_eligibility_category: 'I-765: eligibility category',
      i765_pending_receipt: 'I-765: caso pending relacionado',
      i765_prior_ead: 'I-765: EAD anterior',
      i765_social_security: 'I-765: Social Security',
      i765_applicant_statement: 'I-765: declaración del solicitante',
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
      mailing_address: 'Dirección postal',
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
      'Pending green card / adjustment of status': 'Green card / ajuste de estatus pendiente',
      'Pending asylum (c)(8)': 'Asilo pendiente (c)(8)',
      'Granted asylum (a)(5)': 'Asilo concedido (a)(5)',
      TPS: 'TPS',
      DACA: 'DACA',
      'Student category': 'Categoría de estudiante',
      'Parole or humanitarian category': 'Parole o categoría humanitaria',
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

const I485_EXTRA_LOCALIZATION = {
  ru: {
    steps: {
      i485_entry_details: 'I-485: въезд и текущий статус',
      i485_prior_addresses_ssn: 'I-485: адреса и Social Security',
      i485_processing_employment: 'I-485: петиция и работа',
      i485_family_history: 'I-485: родители и супруг',
      i485_prior_spouse_children_bio: 'I-485: предыдущий супруг, дети и биография'
    },
    stepHelp: {
      i485_entry_details: 'Эти ответы заполняют официальный раздел I-485 про последний въезд и текущий статус.',
      i485_prior_addresses_ssn: 'I-485 спрашивает предыдущие адреса и данные Social Security.',
      i485_processing_employment: 'Текущая и последняя работа помогают заполнить разделы о занятости.',
      i485_family_history: 'Родители, супруг и история брака нужны для точного заполнения PDF.',
      i485_prior_spouse_children_bio: 'Оставшиеся семейные и биографические поля перед Part 9.'
    },
    fields: {
      admission_basis: 'Основание при последнем въезде',
      status_at_last_entry: 'Статус при последнем въезде, если был admitted',
      paroled_as: 'Если был parole, class of admission или тип parole',
      date_of_last_entry: 'Дата последнего въезда по I-94',
      manner_of_last_entry: 'Статус на I-94 или entry document',
      authorized_stay_expires: 'Дата окончания разрешенного пребывания или D/S',
      status_expiration_date: 'Дата окончания неиммиграционного статуса, если есть',
      visa_number: 'Номер неиммиграционной визы, если есть',
      in_removal_proceedings: 'Вы сейчас в removal/deportation proceedings?',
      prior_removal_order: 'Был ли когда-либо removal/deportation order?',
      ever_removed_excluded: 'Вас когда-либо removed, excluded или deported?',
      same_address_five_years: 'Вы жили по текущему физическому адресу весь нужный период?',
      prior_us_addresses: 'Предыдущий физический адрес в США, если текущий адрес не покрывает период',
      last_foreign_address: 'Последний адрес за пределами США',
      has_ssn: 'SSA когда-либо выдавала вам SSN?',
      ssn: 'Social Security number',
      ssn_ssa_consent: 'Хотите, чтобы SSA выдала новую/заменяющую Social Security card через эту форму?',
      petition_previously_filed: 'Основная immigrant petition уже подавалась?',
      petition_receipt_number: 'Receipt number основной петиции',
      petition_date: 'Дата подачи или approval основной петиции',
      petitioner_family_name: 'Фамилия петиционера, если это человек',
      petitioner_given_name: 'Имя петиционера, если это человек',
      petitioner_alien_number: 'A-number петиционера, если есть',
      concurrent_filing: 'Основная петиция подается вместе с I-485?',
      eligibility_basis: 'Точная категория или основание adjustment',
      currently_working: 'Вы сейчас работаете?',
      worked_without_authorization: 'Вы когда-либо работали в США без разрешения?',
      current_employment_history: 'Текущая работа или учеба в США',
      foreign_employment_history: 'Последняя работа за пределами США',
      father_family_name: 'Родитель 1: фамилия',
      father_given_name: 'Родитель 1: имя',
      father_middle_name: 'Родитель 1: middle name',
      father_dob: 'Родитель 1: дата рождения',
      father_city_of_birth: 'Родитель 1: страна/место рождения',
      mother_family_name: 'Родитель 2: текущая фамилия',
      mother_given_name: 'Родитель 2: текущее имя',
      mother_middle_name: 'Родитель 2: middle name',
      mother_birth_family_name: 'Родитель 2: фамилия при рождении',
      mother_birth_given_name: 'Родитель 2: имя при рождении',
      mother_birth_middle_name: 'Родитель 2: middle name при рождении',
      mother_dob: 'Родитель 2: дата рождения',
      mother_city_of_birth: 'Родитель 2: страна/место рождения',
      times_married: 'Сколько раз вы были в браке?',
      spouse_family_name: 'Текущий супруг: фамилия, если есть',
      spouse_given_name: 'Текущий супруг: имя, если есть',
      spouse_alien_number: 'Текущий супруг: A-number, если есть',
      spouse_country_of_birth: 'Текущий супруг: страна рождения',
      current_marriage_date: 'Дата текущего брака',
      current_marriage_city: 'Город текущего брака',
      current_marriage_state: 'Штат/провинция текущего брака',
      current_marriage_country: 'Страна текущего брака',
      prior_spouse_family_name: 'Предыдущий супруг: фамилия',
      prior_spouse_given_name: 'Предыдущий супруг: имя',
      prior_spouse_dob: 'Предыдущий супруг: дата рождения',
      prior_spouse_country_of_birth: 'Предыдущий супруг: страна рождения',
      prior_spouse_country_of_citizenship: 'Предыдущий супруг: гражданство',
      prior_spouse_marriage_date: 'Дата брака с предыдущим супругом',
      prior_spouse_marriage_city: 'Город брака с предыдущим супругом',
      prior_spouse_marriage_state: 'Штат/провинция брака с предыдущим супругом',
      prior_spouse_marriage_country: 'Страна брака с предыдущим супругом',
      prior_spouse_marriage_end_city: 'Город, где закончился предыдущий брак',
      prior_spouse_marriage_end_state: 'Штат/провинция, где закончился предыдущий брак',
      prior_spouse_marriage_end_country: 'Страна, где закончился предыдущий брак',
      prior_spouse_marriage_end_date: 'Дата окончания предыдущего брака',
      prior_spouse_marriage_end_type: 'Как закончился предыдущий брак',
      total_children: 'Общее количество детей',
      child1_family_name: 'Ребенок 1: фамилия',
      child1_given_name: 'Ребенок 1: имя',
      child1_alien_number: 'Ребенок 1: A-number, если есть',
      child1_dob: 'Ребенок 1: дата рождения',
      child1_country_of_birth: 'Ребенок 1: страна рождения',
      child1_relationship: 'Ребенок 1: родство',
      child1_applying_with_you: 'Ребенок 1 подает вместе с вами?',
      ethnicity: 'Ethnicity',
      race: 'Race',
      height_feet: 'Рост: футы',
      height_inches: 'Рост: дюймы',
      weight_lbs: 'Вес в фунтах',
      eye_color: 'Цвет глаз',
      hair_color: 'Цвет волос'
    },
    options: {
      Immigrant: 'Immigrant',
      Nonimmigrant: 'Nonimmigrant',
      Paroled: 'Paroled',
      Annulled: 'Аннулирован',
      'Hispanic or Latino': 'Латиноамериканское происхождение',
      'Not Hispanic or Latino': 'Не латиноамериканское происхождение',
      White: 'Белый',
      Asian: 'Азиат',
      'Black or African American': 'Black or African American',
      'American Indian or Alaska Native': 'American Indian or Alaska Native',
      'Native Hawaiian or Other Pacific Islander': 'Native Hawaiian or Other Pacific Islander',
      Black: 'Черный',
      Blue: 'Голубой',
      Brown: 'Карий/коричневый',
      Gray: 'Серый',
      Green: 'Зеленый',
      Hazel: 'Hazel',
      Maroon: 'Maroon',
      Pink: 'Розовый',
      Unknown: 'Неизвестно',
      Bald: 'Без волос',
      Blond: 'Блонд',
      Red: 'Рыжий',
      Sandy: 'Sandy'
    },
    placeholders: {
      status_at_last_entry: 'Например: B-2, F-1, parolee, asylee.',
      paroled_as: 'Например: PAROLED, DT, UHP.',
      manner_of_last_entry: 'Например: ASYLEE, PAROLEE, D/S.',
      authorized_stay_expires: 'Например: D/S или 05/11/2026.',
      ssn: '9 цифр.',
      eligibility_basis: 'Например: asylee, refugee, IR-1 spouse of U.S. citizen, EB-3.',
      child1_relationship: 'Например: biological child, stepchild.'
    }
  },
  uk: {
    steps: {
      i485_entry_details: 'I-485: в’їзд і поточний статус',
      i485_prior_addresses_ssn: 'I-485: адреси і Social Security',
      i485_processing_employment: 'I-485: петиція і робота',
      i485_family_history: 'I-485: батьки і подружжя',
      i485_prior_spouse_children_bio: 'I-485: попередній шлюб, діти і біографія',
      i485_last_entry_type: 'I-485: тип останнього в’їзду',
      i485_parole_details: 'I-485: parole details',
      i485_i94_status: 'I-485: I-94 і статус при в’їзді',
      i485_status_expiration: 'I-485: строк дозволеного перебування',
      i485_visa_number: 'I-485: номер візи',
      i485_removal_history: 'I-485: removal / deportation',
      i485_residence_period: 'I-485: проживання за поточною адресою',
      i485_prior_us_address: 'I-485: попередня адреса у США',
      i485_foreign_address: 'I-485: остання адреса за межами США',
      i485_social_security: 'I-485: Social Security',
      i485_petition_filing: 'I-485: основна петиція',
      i485_petition_person: 'I-485: дані петиціонера',
      i485_petition_category: 'I-485: категорія подання',
      i485_work_status: 'I-485: робота у США',
      i485_current_work_history: 'I-485: поточна робота або навчання',
      i485_foreign_work_history: 'I-485: остання робота за межами США',
      i485_parent1_name: 'I-485: батько/мати 1',
      i485_parent1_birth: 'I-485: народження батька/матері 1',
      i485_parent2_current_name: 'I-485: батько/мати 2',
      i485_parent2_birth_name: 'I-485: ім’я батька/матері 2 при народженні',
      i485_parent2_birth: 'I-485: народження батька/матері 2',
      i485_marriage_count: 'I-485: кількість шлюбів',
      i485_current_spouse_name: 'I-485: поточний чоловік/дружина',
      i485_current_spouse_birth: 'I-485: країна народження чоловіка/дружини',
      i485_current_marriage: 'I-485: поточний шлюб',
      i485_prior_spouse_name: 'I-485: попередній чоловік/дружина',
      i485_prior_spouse_birth: 'I-485: народження і громадянство попереднього чоловіка/дружини',
      i485_prior_spouse_marriage: 'I-485: шлюб з попереднім чоловіком/дружиною',
      i485_prior_spouse_end: 'I-485: завершення попереднього шлюбу',
      i485_prior_spouse_end_place: 'I-485: де завершився попередній шлюб',
      i485_prior_spouse_end_result: 'I-485: дата і тип завершення шлюбу',
      i485_children_count: 'I-485: кількість дітей',
      i485_child1_identity: 'I-485: дитина 1',
      i485_child1_details: 'I-485: дані дитини 1',
      i485_biographic_identity: 'I-485: ethnicity і race',
      i485_biographic_physical: 'I-485: зріст, вага, очі та волосся',
      i485_biographic_body: 'I-485: зріст і вага',
      i485_biographic_colors: 'I-485: очі та волосся'
    },
    fields: {
      admission_basis: 'Підстава при останньому в’їзді',
      status_at_last_entry: 'Статус при останньому в’їзді, якщо був admitted',
      paroled_as: 'Якщо був parole, тип parole',
      date_of_last_entry: 'Дата останнього в’їзду за I-94',
      manner_of_last_entry: 'Статус на I-94 або entry document',
      authorized_stay_expires: 'Дата закінчення дозволеного перебування або D/S',
      visa_number: 'Номер неімміграційної візи, якщо є',
      same_address_five_years: 'Ви жили за поточною фізичною адресою весь потрібний період?',
      prior_us_addresses: 'Попередня фізична адреса у США',
      last_foreign_address: 'Остання адреса за межами США',
      has_ssn: 'SSA коли-небудь видавала вам SSN?',
      ssn: 'Social Security number',
      ssn_ssa_consent: 'Хочете, щоб SSA видала нову/замінну Social Security card через цю форму?',
      eligibility_basis: 'Точна категорія або підстава adjustment',
      currently_working: 'Ви зараз працюєте?',
      worked_without_authorization: 'Ви коли-небудь працювали у США без дозволу?',
      current_employment_history: 'Поточна робота або навчання у США',
      foreign_employment_history: 'Остання робота за межами США',
      times_married: 'Скільки разів ви були у шлюбі?',
      prior_spouse_marriage_end_type: 'Як закінчився попередній шлюб',
      total_children: 'Загальна кількість дітей',
      ethnicity: 'Ethnicity',
      race: 'Race',
      weight_lbs: 'Вага у фунтах',
      eye_color: 'Колір очей',
      hair_color: 'Колір волосся'
    },
    options: {
      Immigrant: 'Immigrant',
      Nonimmigrant: 'Nonimmigrant',
      Paroled: 'Paroled',
      Annulled: 'Анульовано',
      'Hispanic or Latino': 'Латиноамериканське походження',
      'Not Hispanic or Latino': 'Не латиноамериканське походження',
      White: 'Білий',
      Asian: 'Азіат',
      Brown: 'Карий/коричневий',
      Blue: 'Блакитний',
      Black: 'Чорний',
      Gray: 'Сірий',
      Green: 'Зелений',
      Unknown: 'Невідомо',
      Bald: 'Без волосся',
      Blond: 'Блонд',
      Red: 'Рудий'
    }
  },
  es: {
    steps: {
      i485_entry_details: 'I-485: entrada y estado actual',
      i485_prior_addresses_ssn: 'I-485: direcciones y Social Security',
      i485_processing_employment: 'I-485: petición y empleo',
      i485_family_history: 'I-485: padres y cónyuge',
      i485_prior_spouse_children_bio: 'I-485: cónyuge anterior, hijos y biografía',
      i485_last_entry_type: 'I-485: tipo de última entrada',
      i485_parole_details: 'I-485: detalles de parole',
      i485_i94_status: 'I-485: I-94 y estado de entrada',
      i485_status_expiration: 'I-485: vencimiento de estadía autorizada',
      i485_visa_number: 'I-485: número de visa',
      i485_removal_history: 'I-485: removal / deportation',
      i485_residence_period: 'I-485: residencia en dirección actual',
      i485_prior_us_address: 'I-485: dirección anterior en EE.UU.',
      i485_foreign_address: 'I-485: última dirección fuera de EE.UU.',
      i485_social_security: 'I-485: Social Security',
      i485_petition_filing: 'I-485: petición principal',
      i485_petition_person: 'I-485: datos del peticionario',
      i485_petition_category: 'I-485: categoría de solicitud',
      i485_work_status: 'I-485: trabajo en EE.UU.',
      i485_current_work_history: 'I-485: trabajo o escuela actual',
      i485_foreign_work_history: 'I-485: último trabajo fuera de EE.UU.',
      i485_parent1_name: 'I-485: padre/madre 1',
      i485_parent1_birth: 'I-485: nacimiento de padre/madre 1',
      i485_parent2_current_name: 'I-485: padre/madre 2',
      i485_parent2_birth_name: 'I-485: nombre de nacimiento de padre/madre 2',
      i485_parent2_birth: 'I-485: nacimiento de padre/madre 2',
      i485_marriage_count: 'I-485: número de matrimonios',
      i485_current_spouse_name: 'I-485: cónyuge actual',
      i485_current_spouse_birth: 'I-485: país de nacimiento del cónyuge',
      i485_current_marriage: 'I-485: matrimonio actual',
      i485_prior_spouse_name: 'I-485: cónyuge anterior',
      i485_prior_spouse_birth: 'I-485: nacimiento y ciudadanía del cónyuge anterior',
      i485_prior_spouse_marriage: 'I-485: matrimonio con cónyuge anterior',
      i485_prior_spouse_end: 'I-485: fin del matrimonio anterior',
      i485_prior_spouse_end_place: 'I-485: lugar del fin del matrimonio anterior',
      i485_prior_spouse_end_result: 'I-485: fecha y tipo de fin del matrimonio',
      i485_children_count: 'I-485: número de hijos',
      i485_child1_identity: 'I-485: hijo/a 1',
      i485_child1_details: 'I-485: datos de hijo/a 1',
      i485_biographic_identity: 'I-485: ethnicity y race',
      i485_biographic_physical: 'I-485: altura, peso, ojos y cabello',
      i485_biographic_body: 'I-485: altura y peso',
      i485_biographic_colors: 'I-485: ojos y cabello'
    },
    fields: {
      admission_basis: 'Base de admisión en la última entrada',
      status_at_last_entry: 'Estado en la última entrada, si fue admitted',
      paroled_as: 'Si fue parole, tipo de parole',
      date_of_last_entry: 'Fecha de última entrada según I-94',
      manner_of_last_entry: 'Estado en I-94 o documento de entrada',
      authorized_stay_expires: 'Fecha de vencimiento de estadía autorizada o D/S',
      visa_number: 'Número de visa no inmigrante, si tiene',
      same_address_five_years: '¿Ha vivido en la dirección física actual durante el período requerido?',
      prior_us_addresses: 'Dirección física anterior en Estados Unidos',
      last_foreign_address: 'Última dirección fuera de Estados Unidos',
      has_ssn: '¿SSA alguna vez le emitió un SSN?',
      ssn: 'Social Security number',
      ssn_ssa_consent: '¿Desea que SSA emita una tarjeta Social Security nueva o de reemplazo usando esta solicitud?',
      eligibility_basis: 'Categoría o base exacta de adjustment',
      currently_working: '¿Está trabajando actualmente?',
      worked_without_authorization: '¿Alguna vez trabajó en Estados Unidos sin autorización?',
      current_employment_history: 'Empleo o escuela actual en Estados Unidos',
      foreign_employment_history: 'Empleo más reciente fuera de Estados Unidos',
      times_married: '¿Cuántas veces ha estado casado/a?',
      prior_spouse_marriage_end_type: 'Cómo terminó el matrimonio anterior',
      total_children: 'Número total de hijos',
      ethnicity: 'Ethnicity',
      race: 'Race',
      weight_lbs: 'Peso en libras',
      eye_color: 'Color de ojos',
      hair_color: 'Color de cabello'
    },
    options: {
      Immigrant: 'Immigrant',
      Nonimmigrant: 'Nonimmigrant',
      Paroled: 'Paroled',
      Annulled: 'Anulado',
      'Hispanic or Latino': 'Hispano o latino',
      'Not Hispanic or Latino': 'No hispano o latino',
      White: 'Blanco',
      Asian: 'Asiático',
      Brown: 'Marrón',
      Blue: 'Azul',
      Black: 'Negro',
      Gray: 'Gris',
      Green: 'Verde',
      Unknown: 'Desconocido',
      Bald: 'Sin cabello',
      Blond: 'Rubio',
      Red: 'Rojo'
    }
  }
};

Object.entries(I485_EXTRA_LOCALIZATION).forEach(([lang, extra]) => {
  if (!LOCALIZATION[lang]) return;
  ['steps', 'stepHelp', 'fields', 'options', 'placeholders'].forEach((bucket) => {
    LOCALIZATION[lang][bucket] = {
      ...(LOCALIZATION[lang][bucket] || {}),
      ...(extra[bucket] || {})
    };
  });
});

const PURPOSE_SPLIT_LOCALIZATION = {
  ru: {
    steps: {
      related_forms: 'Связанные формы и receipt numbers',
      deadline_notice: 'Deadline, RFE или notice'
    },
    stepHelp: {
      related_forms: 'Если есть I-797, receipt number, pending case или связанная форма, укажите это отдельно.',
      deadline_notice: 'Если есть срок, RFE, court date или notice, укажите дату и тип документа.'
    }
  },
  uk: {
    steps: {
      related_forms: "Пов'язані форми та receipt numbers",
      deadline_notice: 'Deadline, RFE або notice'
    },
    stepHelp: {
      related_forms: 'Якщо є I-797, receipt number, pending case або пов’язана форма, вкажіть це окремо.',
      deadline_notice: 'Якщо є строк, RFE, court date або notice, вкажіть дату та тип документа.'
    }
  },
  es: {
    steps: {
      related_forms: 'Formularios relacionados y receipt numbers',
      deadline_notice: 'Deadline, RFE o notice'
    },
    stepHelp: {
      related_forms: 'Si tiene I-797, receipt number, caso pendiente o formulario relacionado, inclúyalo aquí.',
      deadline_notice: 'Si existe un plazo, RFE, court date o notice, indique la fecha y el tipo de documento.'
    }
  }
};

Object.entries(PURPOSE_SPLIT_LOCALIZATION).forEach(([lang, extra]) => {
  if (!LOCALIZATION[lang]) return;
  ['steps', 'stepHelp'].forEach((bucket) => {
    LOCALIZATION[lang][bucket] = {
      ...(LOCALIZATION[lang][bucket] || {}),
      ...(extra[bucket] || {})
    };
  });
});

const TEXT = {
  purpose: {
    title: 'Form purpose',
    help: 'Confirm why this form is being prepared and whether there are related filings.'
  },
  relatedForms: {
    title: 'Related forms or receipt numbers',
    help: 'Add any known USCIS receipt numbers, related forms, or pending cases.'
  },
  deadlineNotice: {
    title: 'Deadline, RFE, or notice',
    help: 'Tell us about any deadline, USCIS notice, RFE, or court date.'
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

function step(id, title, help, fields, options = {}) {
  return { id, title, help, fields, ...options };
}

const US_STATE_OPTIONS = stateSelectOptions();
const COUNTRY_OPTIONS = countrySelectOptions();

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function titleFromEntry(code, entry, official) {
  return official?.title || entry?.names?.en || entry?.name || entry?.title || code;
}

function purposeSteps(code, title) {
  const formRequested = [
    field('form_code_confirmed', 'Form requested', 'text', {
      required: true,
      value: code,
      autocomplete: 'off',
      help: title
    }),
    // 'preparation_goal' textarea was redundant — once the form code is
    // selected, asking again "what do you want prepared with this form?"
    // duplicates the hero textarea. The hero situation text is already
    // captured in state.situation and is shown back on the Review step.
    // Field still rendered if the form schema explicitly demands it, but
    // no longer required and hidden by default to remove the friction.
    field('preparation_goal', 'Notes for the preparer (optional)', 'textarea', {
      required: false,
      placeholder: 'Add any context, deadline, or special instructions you want us to know about this filing.',
      help: 'Optional. We already have your initial description from the start of the wizard.'
    })
  ];

  return [
    step('purpose', TEXT.purpose.title, TEXT.purpose.help, formRequested),
    step('related_forms', TEXT.relatedForms.title, TEXT.relatedForms.help, [
      field('related_forms_known', 'Do you already know any related forms or receipt numbers?', 'textarea', {
        placeholder: 'Example: I-130 receipt, I-485 pending, I-797 notice, A-number.',
        rows: 4
      })
    ]),
    step('deadline_notice', TEXT.deadlineNotice.title, TEXT.deadlineNotice.help, [
      field('deadline_or_notice', 'Is there a deadline, RFE, court date, or USCIS notice?', 'textarea', {
        placeholder: 'Include the date and notice type if you have one.',
        rows: 4
      })
    ])
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
    mailingAddressBlockField({ required: true }),
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

function mailingAddressBlockField(options = {}) {
  return field('mailing_address', 'Mailing address', 'addressBlock', {
    required: Boolean(options.required),
    requiredParts: ['line1', 'city', 'state', 'zip'],
    parts: {
      line1: 'mailing_address_line1',
      line2: 'mailing_address_line2',
      city: 'mailing_city',
      state: 'mailing_state',
      zip: 'mailing_zip',
      country: 'mailing_country'
    },
    countryDefault: 'United States',
    stateOptions: US_STATE_OPTIONS,
    countryOptions: COUNTRY_OPTIONS
  });
}

function applicantSteps() {
  return [
    step('applicant_name_parts', 'Applicant legal name', 'Enter the applicant name exactly as it appears on official documents. These map to Family Name (Last), Given Name (First), and Middle Name on USCIS forms.', [
      field('applicant_family_name', 'Family name (last name)', 'text', {
        required: true,
        autocomplete: 'family-name'
      }),
      field('applicant_given_name', 'Given name (first name)', 'text', {
        required: true,
        autocomplete: 'given-name'
      }),
      field('applicant_middle_name', 'Middle name', 'text', {
        autocomplete: 'additional-name'
      })
    ]),
    step('applicant_other_names', 'Other names used', 'Have you ever used another legal name (maiden name, prior name, alias)? If yes, list them all on the next field.', [
      field('has_other_names', 'Have you used any other names?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      }),
      field('other_names_used', 'List all other names you have used', 'textarea', {
        placeholder: 'Maiden name, prior legal names, aliases.',
        showWhen: [{ id: 'has_other_names', equals: 'Yes' }]
      })
    ]),
    step('applicant_birth_date', 'Birth date', 'Enter the applicant date of birth exactly as shown on documents.', [
      field('date_of_birth', 'Date of birth', 'date', {
        required: true,
        autocomplete: 'bday'
      })
    ]),
    step('applicant_birth_place', 'Place of birth', 'City, state or province, and country of birth.', [
      field('city_of_birth', 'City/town/village of birth', 'text', {
        autocomplete: 'off'
      }),
      field('state_or_province_of_birth', 'State/province of birth', 'text', {
        autocomplete: 'off'
      })
    ]),
    step('applicant_birth_country', 'Country of birth', 'Select the country of birth from the official list.', [
      field('country_of_birth', 'Country of birth', 'select', {
        autocomplete: 'country-name',
        options: COUNTRY_OPTIONS
      })
    ]),
    step('applicant_citizenship', 'Citizenship or nationality', 'Use the country where the applicant is currently a citizen or national.', [
      field('country_of_citizenship', 'Country of citizenship or nationality', 'select', {
        autocomplete: 'country-name',
        options: COUNTRY_OPTIONS
      })
    ]),
    step('applicant_sex_marital', 'Sex and marital status', 'These values map to the biographic section.', [
      field('sex', 'Sex', 'radio', {
        options: ['Male', 'Female']
      }),
      field('marital_status', 'Marital status', 'select', {
        options: ['Single', 'Married', 'Divorced', 'Widowed']
      })
    ]),
    step('applicant_uscis_numbers', 'USCIS numbers', 'Use numbers exactly as shown on USCIS records, if available.', [
      field('alien_number', 'A-number, if any', 'text', {
        autocomplete: 'off',
        placeholder: 'A###-###-###'
      }),
      field('uscis_online_account_number', 'USCIS online account number, if any', 'text', {
        autocomplete: 'off'
      })
    ])
  ];
}

function immigrationHistorySteps() {
  return [
    step('immigration_history', TEXT.immigration.title, TEXT.immigration.help, [
      field('current_immigration_status', 'Current immigration status or category', 'text', {
        placeholder: 'Example: pending asylum, TPS, F-1, parolee, no status, lawful permanent resident.'
      }),
      field('last_arrival_date', 'Most recent U.S. arrival date', 'date')
    ]),
    step('immigration_entry_record', 'Entry place and I-94', 'Use the most recent U.S. arrival and I-94 record.', [
      field('place_entry', 'Place of your last arrival into the United States', 'text', {
        placeholder: 'Example: Los Angeles, CA; San Ysidro, CA; JFK, New York.'
      }),
      field('i94_number', 'I-94 number, if any', 'text', {
        autocomplete: 'off'
      })
    ]),
    step('immigration_passport', 'Passport or travel document', 'Passport fields appear on many USCIS forms.', [
      field('passport_number', 'Passport number, if relevant', 'text', {
        autocomplete: 'off'
      }),
      field('passport_country_of_issuance', 'Country that issued passport or travel document', 'select', {
        autocomplete: 'country-name',
        options: COUNTRY_OPTIONS
      })
    ]),
    step('immigration_passport_expiration', 'Passport expiration', 'Enter the expiration date only if a passport or travel document is used.', [
      field('passport_expiration', 'Passport expiration date', 'date')
    ]),
    step('immigration_prior_filings', 'Prior USCIS filings', 'List previous or pending USCIS filings if known.', [
      field('prior_uscis_filings', 'Prior or pending USCIS filings', 'textarea', {
        placeholder: 'List form codes, receipt numbers, filing dates, approvals, denials, RFEs.'
      })
    ])
  ];
}

function evidenceSteps() {
  return [
    step('documents_identity', 'Identity documents', 'Select the identity documents already available.', [
      field('identity_documents_available', 'Identity documents available', 'checkboxes', {
        options: ['Passport', 'Birth certificate', 'State ID / driver license', 'Green card', 'EAD card', 'I-94', 'Other']
      })
    ]),
    step('documents_supporting', 'Supporting documents', 'List supporting documents without uploading files yet.', [
      field('supporting_documents_available', 'Supporting documents available', 'textarea', {
        placeholder: 'Receipt notices, court records, marriage certificate, tax returns, pay stubs, translations, photos, letters, etc.'
      })
    ]),
    step('documents_translation', 'Document translations', 'Confirm whether any documents need translation.', [
      field('translation_needed', 'Do any documents need translation?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      })
    ]),
    step('documents_interpreter_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter or preparer information is collected.', [
      field('has_interpreter', 'Will an interpreter be used for this application?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
      field('has_preparer', 'Will someone prepare this application for the applicant?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      })
    ]),
    step('documents_interpreter_preparer_need', 'Interpreter or preparer note', 'Use this only when you are not sure which signature section applies.', [
      field('interpreter_or_preparer_needed', 'Will an interpreter or preparer section be needed?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      })
    ]),
    step('documents_interpreter', 'Interpreter information', 'Fill only if an interpreter will be used.', [
      field('interpreter_family_name', 'Interpreter family name, if any', 'text', { autocomplete: 'family-name' }),
      field('interpreter_given_name', 'Interpreter given name, if any', 'text', { autocomplete: 'given-name' })
    ]),
    step('documents_interpreter_business', 'Interpreter organization', 'Fill only if the interpreter has a business or organization name.', [
      field('interpreter_business_name', 'Interpreter business or organization, if any', 'text', { autocomplete: 'organization' })
    ]),
    step('documents_preparer', 'Preparer information', 'Fill only if someone will prepare this application.', [
      field('preparer_family_name', 'Preparer family name, if any', 'text', { autocomplete: 'family-name' }),
      field('preparer_given_name', 'Preparer given name, if any', 'text', { autocomplete: 'given-name' })
    ]),
    step('documents_preparer_business', 'Preparer organization', 'Fill only if the preparer has a business or organization name.', [
      field('preparer_business_name', 'Preparer business or organization, if any', 'text', { autocomplete: 'organization' })
    ]),
    step('documents_notes', 'Additional preparer notes', 'Anything else the preparer should know before checkout.', [
      field('extra_notes_for_preparer', 'Anything else the preparer should know?', 'textarea')
    ])
  ];
}

function addressContactSteps() {
  return [
    step('address_contact', 'Mailing address', 'Enter the full mailing address as a structured address block.', [
      mailingAddressBlockField({ required: true })
    ]),
    step('physical_address_match', 'Physical address', 'Confirm whether the physical address is the same as the mailing address.', [
      field('physical_same_as_mailing', 'Is physical address the same as mailing address?', 'radio', {
        options: ['Yes', 'No']
      })
    ]),
    step('contact_info', 'Phone and email', 'Phone is split for clean USCIS formatting; email is validated before saving.', [
      field('daytime_phone', 'Daytime phone', 'phone', {
        autocomplete: 'tel',
        inputmode: 'tel',
        countryCodeDefault: '+1'
      }),
      field('email_address', 'Email address', 'email', {
        autocomplete: 'email',
        inputmode: 'email'
      })
    ])
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

// Generate the four steps for child N (1..8) on I-485 Part 6.
// Each child gets the same field set as the original child1; all fields hidden
// until total_children >= N so the wizard auto-skips child blocks the user does
// not need.
function i485ChildBlock(n) {
  const cond = [{ id: 'total_children', gte: n }];
  const skipNote = `Skipped automatically when the applicant reports fewer than ${n} child${n === 1 ? '' : 'ren'}.`;
  return [
    step(`i485_child${n}_identity`, `I-485 child ${n} identity`, skipNote, [
      field(`child${n}_family_name`, `Child ${n} family name`, 'text', { autocomplete: 'family-name', showWhen: cond }),
      field(`child${n}_given_name`, `Child ${n} given name`, 'text', { autocomplete: 'given-name', showWhen: cond })
    ]),
    step(`i485_child${n}_number`, `I-485 child ${n} A-number`, skipNote, [
      field(`child${n}_alien_number`, `Child ${n} A-number, if any`, 'text', { autocomplete: 'off', showWhen: cond })
    ]),
    step(`i485_child${n}_details`, `I-485 child ${n} details`, skipNote, [
      field(`child${n}_dob`, `Child ${n} date of birth`, 'date', { showWhen: cond }),
      field(`child${n}_country_of_birth`, `Child ${n} country of birth`, 'select', { options: COUNTRY_OPTIONS, showWhen: cond })
    ]),
    step(`i485_child${n}_relationship`, `I-485 child ${n} relationship`, skipNote, [
      field(`child${n}_relationship`, `Child ${n} relationship`, 'text', { placeholder: 'Example: biological child, stepchild', showWhen: cond }),
      field(`child${n}_applying_with_you`, `Is child ${n} applying with you?`, 'radio', { options: ['Yes', 'No'], showWhen: cond })
    ])
  ];
}

function i485CoreSteps() {
  return [
    step('i485_last_entry_type', 'I-485 last entry type', 'Answer only for the most recent entry into the United States.', [
      field('admission_basis', 'Admission basis at last entry', 'select', {
        options: ['Immigrant', 'Nonimmigrant', 'Paroled', 'Other']
      }),
      field('status_at_last_entry', 'Status at last entry, if admitted', 'text', {
        placeholder: 'Example: B-2, F-1, parolee, asylee'
      })
    ]),
    step('i485_parole_details', 'I-485 parole details', 'Skipped automatically when the last entry was not by parole.', [
      field('paroled_as', 'If paroled, class of admission or parole type', 'text', {
        placeholder: 'Example: PAROLED, DT, UHP',
        showWhen: [{ id: 'admission_basis', equals: 'Paroled' }]
      })
    ]),
    step('i485_i94_status', 'I-485 I-94 and arrival status', 'Use the I-94 or entry document for these two fields.', [
      field('date_of_last_entry', 'Date of last entry shown on I-94', 'date'),
      field('manner_of_last_entry', 'Status on Form I-94 or entry document', 'text', {
        placeholder: 'Example: ASYLEE, PAROLEE, D/S'
      })
    ]),
    step('i485_status_expiration', 'I-485 authorized stay', 'If the document shows D/S, enter D/S.', [
      field('authorized_stay_expires', 'Authorized stay expiration date or D/S', 'text', {
        placeholder: 'Example: D/S or 05/11/2026'
      }),
      field('status_expiration_date', 'Nonimmigrant status expiration date, if any', 'text')
    ]),
    step('i485_visa_number', 'I-485 visa number', 'Skipped automatically when the last entry was not as a nonimmigrant visa holder.', [
      field('visa_number', 'Nonimmigrant visa number, if any', 'text', { autocomplete: 'off', showWhen: [{ id: 'admission_basis', equals: 'Nonimmigrant' }] }),
    ]),
    step('i485_removal_history', 'I-485 removal history', 'These official questions must be answered carefully.', [
      field('in_removal_proceedings', 'Are you in removal, exclusion, rescission, or deportation proceedings?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
      field('prior_removal_order', 'Have you ever had a prior removal/deportation order?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      })
    ]),
    step('i485_removal_exclusion_history', 'I-485 prior removal or exclusion', 'Answer only from your own history or official documents.', [
      field('ever_removed_excluded', 'Have you ever been removed, excluded, or deported?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      })
    ]),
    step('i485_residence_period', 'I-485 current residence period', 'Confirm whether the current physical address covers the required period.', [
      field('same_address_five_years', 'Have you lived at your current physical address for the required residence period?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      })
    ]),
    step('i485_prior_us_address', 'I-485 prior U.S. addresses (last 5 years)', 'List every U.S. physical address from the last 5 years. Add as many entries as needed to cover the full 5-year period before today.', [
      addressHistoryField('prior_us_addresses', 'Prior U.S. addresses for the last 5 years', {
        entries: 5,
        showWhen: [{ id: 'same_address_five_years', equals: 'No' }]
      })
    ]),
    step('i485_foreign_address', 'I-485 last foreign address', 'Enter the most recent address outside the United States as a complete address.', [
      addressHistoryField('last_foreign_address', 'Most recent address outside the United States', {
        entries: 1
      })
    ]),
    step('i485_social_security', 'I-485 Social Security', 'SSN must be exactly 9 digits if one was issued.', [
      field('has_ssn', 'Has the Social Security Administration ever issued you an SSN?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      }),
      field('ssn', 'Social Security number', 'text', {
        inputmode: 'numeric',
        autocomplete: 'off',
        placeholder: '9 digits',
        showWhen: [{ id: 'has_ssn', equals: 'Yes' }]
      })
    ]),
    step('i485_social_security_card', 'I-485 Social Security card request', 'Answer whether SSA should issue a card using this application.', [
      field('ssn_ssa_consent', 'Do you want SSA to issue a replacement/new Social Security card using this application?', 'radio', {
        options: ['Yes', 'No']
      })
    ]),
    step('i485_petition_filing', 'I-485 underlying petition', 'Capture whether a petition exists and its receipt number.', [
      field('petition_previously_filed', 'Was an underlying immigrant petition previously filed?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
      field('petition_receipt_number', 'Underlying petition receipt number', 'text', { autocomplete: 'off', showWhen: [{ id: 'petition_previously_filed', equals: 'Yes' }] }),
    ]),
    step('i485_petition_person', 'I-485 petitioner identity', 'Skipped automatically when no underlying petition was filed.', [
      field('petitioner_family_name', 'Petitioner family name, if person', 'text', { autocomplete: 'family-name', showWhen: [{ id: 'petition_previously_filed', equals: 'Yes' }] }),
      field('petitioner_given_name', 'Petitioner given name, if person', 'text', { autocomplete: 'given-name', showWhen: [{ id: 'petition_previously_filed', equals: 'Yes' }] })
    ]),
    step('i485_petition_date', 'I-485 petition date', 'Skipped automatically when no underlying petition was filed.', [
      field('petition_date', 'Underlying petition filing or approval date', 'date', { showWhen: [{ id: 'petition_previously_filed', equals: 'Yes' }] }),
    ]),
    step('i485_petition_category', 'I-485 filing category', 'Skipped automatically when no underlying petition was filed.', [
      field('petitioner_alien_number', 'Petitioner A-number, if any', 'text', { autocomplete: 'off', showWhen: [{ id: 'petition_previously_filed', equals: 'Yes' }] }),
      field('concurrent_filing', 'Is the underlying petition being filed together with I-485?', 'radio', {
        options: ['Yes', 'No', 'Not sure'],
        showWhen: [{ id: 'petition_previously_filed', equals: 'Yes' }]
      })
    ]),
    step('i485_eligibility_basis', 'I-485 exact eligibility basis', 'Use the exact category or basis that should appear in the filing.', [
      field('eligibility_basis', 'Exact adjustment category or basis', 'text', {
        placeholder: 'Example: asylee, refugee, IR-1 spouse of U.S. citizen, EB-3'
      }),
    ]),
    step('i485_work_status', 'I-485 U.S. work status', 'These two answers drive the employment-history section.', [
      field('currently_working', 'Are you currently employed?', 'radio', { options: ['Yes', 'No'] }),
      field('worked_without_authorization', 'Have you ever worked in the United States without authorization?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
    ]),
    step('i485_current_work_history', 'I-485 employment history (last 5 years)', 'List every employer, school, unemployment period, or self-employment over the past 5 years. List most recent first. Add as many entries as needed.', [
      employmentHistoryField('current_employment_history', 'U.S. employment / school history for the last 5 years', { entries: 5 }),
    ]),
    step('i485_foreign_work_history', 'I-485 foreign employment (last 5 years)', 'List employment outside the United States during the past 5 years. Add as many entries as needed.', [
      employmentHistoryField('foreign_employment_history', 'Employment outside the United States for the last 5 years', { entries: 3 })
    ]),
    step('i485_parent1_name', 'I-485 parent 1 name', 'Enter parent 1 name exactly as known.', [
      field('father_family_name', 'Parent 1 family name', 'text', { autocomplete: 'family-name' }),
      field('father_given_name', 'Parent 1 given name', 'text', { autocomplete: 'given-name' })
    ]),
    step('i485_parent1_middle_name', 'I-485 parent 1 middle name', 'Enter only if there is a middle name.', [
      field('father_middle_name', 'Parent 1 middle name', 'text'),
    ]),
    step('i485_parent1_birth', 'I-485 parent 1 birth', 'Enter parent 1 birth date and place.', [
      field('father_dob', 'Parent 1 date of birth', 'date'),
      field('father_city_of_birth', 'Parent 1 country/place of birth', 'text'),
    ]),
    step('i485_parent2_current_name', 'I-485 parent 2 current name', 'Enter parent 2 current legal name.', [
      field('mother_family_name', 'Parent 2 current family name', 'text', { autocomplete: 'family-name' }),
      field('mother_given_name', 'Parent 2 current given name', 'text', { autocomplete: 'given-name' })
    ]),
    step('i485_parent2_middle_name', 'I-485 parent 2 middle name', 'Enter only if there is a middle name.', [
      field('mother_middle_name', 'Parent 2 middle name', 'text'),
    ]),
    step('i485_parent2_birth_name', 'I-485 parent 2 birth name', 'Enter parent 2 name at birth if known.', [
      field('mother_birth_family_name', 'Parent 2 family name at birth', 'text', { autocomplete: 'family-name' }),
      field('mother_birth_given_name', 'Parent 2 given name at birth', 'text', { autocomplete: 'given-name' })
    ]),
    step('i485_parent2_birth_middle_name', 'I-485 parent 2 birth middle name', 'Enter only if the birth middle name is known.', [
      field('mother_birth_middle_name', 'Parent 2 middle name at birth', 'text'),
    ]),
    step('i485_parent2_birth', 'I-485 parent 2 birth', 'Enter parent 2 birth date and place.', [
      field('mother_dob', 'Parent 2 date of birth', 'date'),
      field('mother_city_of_birth', 'Parent 2 country/place of birth', 'text'),
    ]),
    step('i485_marriage_count', 'I-485 marriage count', 'This controls current-spouse and prior-spouse sections.', [
      field('times_married', 'How many times have you been married?', 'number', { inputmode: 'numeric' }),
    ]),
    // Current-spouse fields: show only when applicant is currently married.
    // Uses showWhen on every field; if all are hidden, the step is auto-skipped.
    step('i485_current_spouse_name', 'I-485 current spouse name', 'Skipped automatically when the applicant is not currently married.', [
      field('spouse_family_name', 'Current spouse family name', 'text', { autocomplete: 'family-name', showWhen: [{ id: 'marital_status', equals: 'Married' }] }),
      field('spouse_given_name', 'Current spouse given name', 'text', { autocomplete: 'given-name', showWhen: [{ id: 'marital_status', equals: 'Married' }] })
    ]),
    step('i485_current_spouse_number', 'I-485 current spouse A-number', 'Fill only if the current spouse has an A-number.', [
      field('spouse_alien_number', 'Current spouse A-number, if any', 'text', { autocomplete: 'off', showWhen: [{ id: 'marital_status', equals: 'Married' }] }),
    ]),
    step('i485_current_spouse_birth', 'I-485 current spouse birth country', 'Skipped automatically when the applicant is not currently married.', [
      field('spouse_country_of_birth', 'Current spouse country of birth', 'select', { options: COUNTRY_OPTIONS, showWhen: [{ id: 'marital_status', equals: 'Married' }] }),
    ]),
    step('i485_current_marriage', 'I-485 current marriage', 'Skipped automatically when the applicant is not currently married.', [
      field('current_marriage_date', 'Current marriage date', 'date', { showWhen: [{ id: 'marital_status', equals: 'Married' }] }),
      field('current_marriage_city', 'Current marriage city or town', 'text', { showWhen: [{ id: 'marital_status', equals: 'Married' }] })
    ]),
    step('i485_current_marriage_place', 'I-485 current marriage place', 'State/province and country where the current marriage occurred.', [
      field('current_marriage_state', 'Current marriage state or province', 'text', { showWhen: [{ id: 'marital_status', equals: 'Married' }] }),
      field('current_marriage_country', 'Current marriage country', 'select', { options: COUNTRY_OPTIONS, showWhen: [{ id: 'marital_status', equals: 'Married' }] })
    ]),
    // Prior-spouse fields: show when applicant is currently divorced/widowed/separated/annulled
    // OR when times_married >= 2 (currently married but had prior).
    step('i485_prior_spouse_name', 'I-485 prior spouse name', 'Skipped automatically when there is no prior spouse to report.', [
      field('prior_spouse_family_name', 'Prior spouse family name', 'text', { autocomplete: 'family-name', showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] }),
      field('prior_spouse_given_name', 'Prior spouse given name', 'text', { autocomplete: 'given-name', showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] }),
    ]),
    step('i485_prior_spouse_birth', 'I-485 prior spouse birth and citizenship', 'Skipped automatically when there is no prior spouse to report.', [
      field('prior_spouse_dob', 'Prior spouse date of birth', 'date', { showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] }),
      field('prior_spouse_country_of_birth', 'Prior spouse country of birth', 'select', { options: COUNTRY_OPTIONS, showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] })
    ]),
    step('i485_prior_spouse_citizenship', 'I-485 prior spouse citizenship', 'Skipped automatically when there is no prior spouse to report.', [
      field('prior_spouse_country_of_citizenship', 'Prior spouse country of citizenship', 'select', { options: COUNTRY_OPTIONS, showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] }),
    ]),
    step('i485_prior_spouse_marriage', 'I-485 prior spouse marriage', 'Where and when the prior marriage started.', [
      field('prior_spouse_marriage_date', 'Date of marriage to prior spouse', 'date', { showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] }),
      field('prior_spouse_marriage_city', 'Marriage city or town with prior spouse', 'text', { showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] })
    ]),
    step('i485_prior_spouse_marriage_place', 'I-485 prior spouse marriage place', 'State/province and country where the prior marriage occurred.', [
      field('prior_spouse_marriage_state', 'Marriage state/province with prior spouse', 'text', { showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] }),
      field('prior_spouse_marriage_country', 'Marriage country with prior spouse', 'select', { options: COUNTRY_OPTIONS, showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] }),
    ]),
    step('i485_prior_spouse_end_place', 'I-485 prior marriage end place', 'Where the prior marriage ended.', [
      field('prior_spouse_marriage_end_city', 'City/town where prior marriage ended', 'text', { showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] }),
      field('prior_spouse_marriage_end_state', 'State/province where prior marriage ended', 'text', { showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] })
    ]),
    step('i485_prior_spouse_end_country', 'I-485 prior marriage end country', 'Country where the prior marriage ended.', [
      field('prior_spouse_marriage_end_country', 'Country where prior marriage ended', 'select', { options: COUNTRY_OPTIONS, showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] }),
    ]),
    step('i485_prior_spouse_end_result', 'I-485 prior marriage end date and type', 'When and how the prior marriage ended.', [
      field('prior_spouse_marriage_end_date', 'Date prior marriage ended', 'date', { showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }] }),
      field('prior_spouse_marriage_end_type', 'How prior marriage ended', 'select', {
        options: ['Divorced', 'Annulled', 'Widowed', 'Other'],
        showWhenAny: [{ id: 'marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'times_married', gte: 2 }]
      }),
    ]),
    step('i485_children_count', 'I-485 children count', 'Start with the total number of children.', [
      field('total_children', 'Total number of children', 'number', { inputmode: 'numeric' }),
    ]),
    // Child 1-8 fields: show only when total_children >= N. USCIS Form I-485
    // Part 6 (Items 12-19) has space for up to 8 children. Each child block has
    // four sub-steps: identity, A-number, details, relationship.
    ...i485ChildBlock(1),
    ...i485ChildBlock(2),
    ...i485ChildBlock(3),
    ...i485ChildBlock(4),
    ...i485ChildBlock(5),
    ...i485ChildBlock(6),
    ...i485ChildBlock(7),
    ...i485ChildBlock(8),
    step('i485_biographic_identity', 'I-485 ethnicity and race', 'These values map to the biographic information section.', [
      field('ethnicity', 'Ethnicity', 'select', { options: ['Hispanic or Latino', 'Not Hispanic or Latino'] }),
      field('race', 'Race', 'checkboxes', { options: ['White', 'Asian', 'Black or African American', 'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander'] }),
    ]),
    step('i485_biographic_body', 'I-485 height and weight', 'Height and weight in U.S. format.', [
      field('height_feet', 'Height feet', 'number', { inputmode: 'numeric' }),
      field('height_inches', 'Height inches', 'number', { inputmode: 'numeric' })
    ]),
    step('i485_biographic_weight', 'I-485 weight', 'Weight in pounds.', [
      field('weight_lbs', 'Weight in pounds', 'number', { inputmode: 'numeric' }),
    ]),
    step('i485_biographic_colors', 'I-485 eye and hair color', 'Eye color and hair color.', [
      field('eye_color', 'Eye color', 'select', { options: ['Black', 'Blue', 'Brown', 'Gray', 'Green', 'Hazel', 'Maroon', 'Pink', 'Unknown'] }),
      field('hair_color', 'Hair color', 'select', { options: ['Bald', 'Black', 'Blond', 'Brown', 'Gray', 'Red', 'Sandy', 'White', 'Unknown'] })
    ])
  ];
}

function addressBlockField(id, label, prefix, options = {}) {
  return field(id, label, 'addressBlock', {
    required: Boolean(options.required),
    help: options.help || '',
    requiredParts: options.requiredParts || ['line1', 'city', 'country'],
    parts: {
      line1: `${prefix}_address_line1`,
      line2: `${prefix}_address_line2`,
      city: `${prefix}_city`,
      state: `${prefix}_state`,
      zip: `${prefix}_zip`,
      country: `${prefix}_country`
    },
    countryDefault: options.countryDefault || 'United States',
    stateOptions: US_STATE_OPTIONS,
    countryOptions: COUNTRY_OPTIONS,
    showWhen: options.showWhen,
    showWhenAny: options.showWhenAny
  });
}

function i130SpecificSteps() {
  return [
    // I-130 Part 1, page 1: relationship.
    step('i130_relationship', 'I-130 relationship to beneficiary', 'Start with the exact relationship selected in Part 1.', [
      field('relationship_to_beneficiary', 'Relationship to beneficiary', 'select', {
        required: true,
        options: ['Spouse', 'Parent', 'Brother or sister', 'Child']
      }),
      field('child_relationship_basis', 'If filing for a child, what type of child relationship applies?', 'select', {
        options: ['Born to parents who were married', 'Stepchild', 'Adopted child', 'Born out of wedlock', 'Not applicable'],
        showWhen: [{ id: 'relationship_to_beneficiary', equals: 'Child' }]
      })
    ]),
    step('i130_prior_petitions', 'I-130 prior filings for relatives', 'These are the two Yes/No questions at the end of Part 1.', [
      field('filed_for_same_beneficiary_before', 'Have you ever filed a petition for this same beneficiary before?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('filed_for_other_relatives_before', 'Have you ever filed a petition for any other alien before?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ]),

    // I-130 Part 2, pages 1-4: petitioner.
    step('i130_petitioner_numbers', 'Petitioner USCIS numbers', 'Use the petitioner numbers exactly as shown on USCIS records, if any.', [
      field('petitioner_alien_number', 'Petitioner A-number, if any', 'text', { autocomplete: 'off' }),
      field('petitioner_uscis_online_account_number', 'Petitioner USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i130_petitioner_ssn', 'Petitioner Social Security number', 'USCIS expects a 9-digit SSN if one exists.', [
      field('petitioner_ssn', 'Petitioner Social Security number', 'text', { inputmode: 'numeric', autocomplete: 'off', placeholder: '9 digits' })
    ]),
    step('i130_petitioner_name', 'Petitioner legal name', 'Enter the petitioner name as it appears on legal documents.', [
      field('petitioner_family_name', 'Petitioner family name', 'text', { required: true, autocomplete: 'family-name' }),
      field('petitioner_given_name', 'Petitioner given name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i130_petitioner_middle_other_names', 'Petitioner middle and other names', 'If there is no middle name, leave it blank. Add prior names only if used.', [
      field('petitioner_middle_name', 'Petitioner middle name', 'text', { autocomplete: 'additional-name' }),
      field('petitioner_other_names_used', 'Other names petitioner has used', 'textarea', { placeholder: 'Maiden name, prior legal names, aliases, or N/A if required.' })
    ]),
    step('i130_petitioner_birth_place', 'Petitioner place of birth', 'City/town/village and country of birth.', [
      field('petitioner_city_of_birth', 'Petitioner city/town/village of birth', 'text'),
      field('petitioner_country_of_birth', 'Petitioner country of birth', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i130_petitioner_birth_sex', 'Petitioner date of birth and sex', 'These map to Part 2, Items 8 and 9.', [
      field('petitioner_date_of_birth', 'Petitioner date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('petitioner_sex', 'Petitioner sex', 'radio', { options: ['Male', 'Female'] })
    ]),
    step('i130_petitioner_mailing_address', 'Petitioner mailing address', 'Enter the full mailing address as a structured address.', [
      field('petitioner_in_care_of_name', 'In care of name, if any', 'text'),
      addressBlockField('petitioner_mailing_address', 'Petitioner mailing address', 'petitioner_mailing', { required: true })
    ]),
    step('i130_petitioner_physical_same', 'Petitioner physical address', 'Confirm whether the physical address is the same as the mailing address.', [
      field('petitioner_physical_same_as_mailing', 'Is the petitioner physical address the same as mailing address?', 'radio', { options: ['Yes', 'No'] })
    ]),
    step('i130_petitioner_physical_address', 'Petitioner current physical address', 'If different from mailing, enter the complete physical address.', [
      addressBlockField('petitioner_physical_address', 'Petitioner current physical address', 'petitioner_physical', {
        showWhen: [{ id: 'petitioner_physical_same_as_mailing', equals: 'No' }]
      }),
      field('petitioner_current_address_from', 'Date petitioner started living at this address', 'date')
    ]),
    step('i130_petitioner_prior_address', 'Petitioner prior addresses (last 5 years)', 'List the petitioner physical addresses for the last 5 years. Most recent first. This is I-130 Part 2, Item 12.', [
      addressHistoryField('petitioner_prior_address', 'Petitioner prior physical addresses for the last 5 years', { entries: 5 })
    ]),
    step('i130_petitioner_marital_status', 'Petitioner marital history', 'Number of marriages and current marital status.', [
      field('petitioner_number_of_marriages', 'How many times has the petitioner been married?', 'number', { inputmode: 'numeric' }),
      field('petitioner_marital_status', 'Petitioner marital status', 'select', { options: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated', 'Annulled'] })
    ]),
    step('i130_petitioner_current_marriage', 'Petitioner current marriage', 'Skipped automatically when the petitioner is not currently married.', [
      field('petitioner_current_marriage_date', 'Petitioner current marriage date', 'date', { showWhen: [{ id: 'petitioner_marital_status', equals: 'Married' }] }),
      field('petitioner_current_marriage_place', 'Petitioner current marriage place', 'text', { placeholder: 'City/state/province/country', showWhen: [{ id: 'petitioner_marital_status', equals: 'Married' }] })
    ]),
    step('i130_petitioner_prior_spouse', 'Petitioner prior spouse', 'Skipped automatically when the petitioner has no prior spouse.', [
      field('petitioner_prior_spouse_name', 'Prior spouse full name', 'text', { autocomplete: 'name', showWhenAny: [{ id: 'petitioner_marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'petitioner_number_of_marriages', gte: 2 }] }),
      field('petitioner_prior_marriage_end_date', 'Date prior marriage ended', 'date', { showWhenAny: [{ id: 'petitioner_marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'petitioner_number_of_marriages', gte: 2 }] })
    ]),
    step('i130_petitioner_parent1', 'Petitioner parent 1', 'Parent 1 name, date of birth, country of birth, and residence.', [
      field('petitioner_parent1_full_name', 'Petitioner parent 1 full name', 'text'),
      field('petitioner_parent1_details', 'Parent 1 date/place/residence details', 'textarea')
    ]),
    step('i130_petitioner_parent2', 'Petitioner parent 2', 'Parent 2 name, date of birth, country of birth, and residence.', [
      field('petitioner_parent2_full_name', 'Petitioner parent 2 full name', 'text'),
      field('petitioner_parent2_details', 'Parent 2 date/place/residence details', 'textarea')
    ]),
    step('i130_petitioner_status', 'Petitioner citizenship or LPR status', 'This controls the citizenship/LPR fields in Part 2.', [
      field('petitioner_status', 'Petitioner status', 'select', {
        required: true,
        options: ['U.S. citizen', 'Lawful permanent resident', 'U.S. national', 'Not sure']
      }),
      field('petitioner_status_acquired_by', 'If U.S. citizen, how was citizenship acquired?', 'select', {
        options: ['Birth in the United States', 'Naturalization', 'Parents', 'Not applicable', 'Not sure']
      })
    ]),
    step('i130_petitioner_certificate', 'Petitioner citizenship certificate', 'Skipped automatically when the petitioner is not a naturalized or derived U.S. citizen.', [
      field('petitioner_certificate_number', 'Certificate number, if any', 'text', { autocomplete: 'off', showWhenAny: [{ id: 'petitioner_status_acquired_by', equals: 'Naturalization' }, { id: 'petitioner_status_acquired_by', equals: 'Parents' }] }),
      field('petitioner_certificate_issuance', 'Place and date of issuance', 'text', { showWhenAny: [{ id: 'petitioner_status_acquired_by', equals: 'Naturalization' }, { id: 'petitioner_status_acquired_by', equals: 'Parents' }] })
    ]),
    step('i130_petitioner_lpr_admission', 'Petitioner LPR admission details', 'Skipped automatically when the petitioner is not a lawful permanent resident.', [
      field('petitioner_lpr_class_of_admission', 'Class of admission', 'text', { showWhen: [{ id: 'petitioner_status', equals: 'Lawful permanent resident' }] }),
      field('petitioner_lpr_date_place_of_admission', 'Date and place of admission', 'text', { showWhen: [{ id: 'petitioner_status', equals: 'Lawful permanent resident' }] })
    ]),
    step('i130_petitioner_employment_current', 'Petitioner current employment', 'Current employer, occupation, address, and dates.', [
      employmentHistoryField('petitioner_current_employment', 'Petitioner current employment', { entries: 1 })
    ]),
    step('i130_petitioner_employment_prior', 'Petitioner prior employment (last 5 years)', 'List petitioner employment for the last 5 years (most recent first), excluding the current employer captured in the previous step.', [
      employmentHistoryField('petitioner_prior_employment', 'Petitioner prior employment for the last 5 years', { entries: 5 })
    ]),
    step('i130_petitioner_biographic_identity', 'Petitioner ethnicity and race', 'These are Part 3 biographic fields.', [
      field('petitioner_ethnicity', 'Petitioner ethnicity', 'select', { options: ['Hispanic or Latino', 'Not Hispanic or Latino'] }),
      field('petitioner_race', 'Petitioner race', 'checkboxes', { options: ['White', 'Asian', 'Black or African American', 'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander'] })
    ]),
    step('i130_petitioner_biographic_body', 'Petitioner height and weight', 'Height and weight in U.S. format.', [
      field('petitioner_height_feet', 'Height feet', 'number', { inputmode: 'numeric' }),
      field('petitioner_weight_lbs', 'Weight in pounds', 'number', { inputmode: 'numeric' })
    ]),
    step('i130_petitioner_biographic_colors', 'Petitioner eyes and hair', 'Eye color and hair color.', [
      field('petitioner_eye_color', 'Eye color', 'select', { options: ['Black', 'Blue', 'Brown', 'Gray', 'Green', 'Hazel', 'Maroon', 'Pink', 'Unknown'] }),
      field('petitioner_hair_color', 'Hair color', 'select', { options: ['Bald', 'Black', 'Blond', 'Brown', 'Gray', 'Red', 'Sandy', 'White', 'Unknown'] })
    ]),

    // I-130 Part 4, pages 5-8: beneficiary.
    step('i130_beneficiary_numbers', 'Beneficiary USCIS numbers', 'Use beneficiary numbers exactly as shown, if any.', [
      field('beneficiary_alien_number', 'Beneficiary A-number, if any', 'text', { autocomplete: 'off' }),
      field('beneficiary_ssn', 'Beneficiary SSN, if any', 'text', { inputmode: 'numeric', autocomplete: 'off', placeholder: '9 digits' })
    ]),
    step('i130_beneficiary_name', 'Beneficiary legal name', 'Enter the beneficiary name exactly as shown on documents.', [
      field('beneficiary_family_name', 'Beneficiary family name', 'text', { required: true, autocomplete: 'family-name' }),
      field('beneficiary_given_name', 'Beneficiary given name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i130_beneficiary_middle_other_names', 'Beneficiary middle and other names', 'If no middle name, leave it blank. Add prior names only if used.', [
      field('beneficiary_middle_name', 'Beneficiary middle name', 'text'),
      field('beneficiary_other_names_used', 'Other names beneficiary has used', 'textarea')
    ]),
    step('i130_beneficiary_birth_place', 'Beneficiary birth information', 'Birth city, country, date, and sex.', [
      field('beneficiary_city_of_birth', 'Beneficiary city/town/village of birth', 'text'),
      field('beneficiary_country_of_birth', 'Beneficiary country of birth', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i130_beneficiary_birth_sex', 'Beneficiary date of birth and sex', 'These map to Part 4 birth and sex fields.', [
      field('beneficiary_date_of_birth', 'Beneficiary date of birth', 'date', { required: true }),
      field('beneficiary_sex', 'Beneficiary sex', 'radio', { options: ['Male', 'Female'] })
    ]),
    step('i130_beneficiary_current_address', 'Beneficiary current physical address', 'Enter the beneficiary current address as a structured address.', [
      addressBlockField('beneficiary_current_address', 'Beneficiary current physical address', 'beneficiary_current', { required: true })
    ]),
    step('i130_beneficiary_other_address', 'Beneficiary other address', 'Use this for an address outside the United States or another current address shown on the form.', [
      addressBlockField('beneficiary_other_address', 'Beneficiary other address', 'beneficiary_other')
    ]),
    step('i130_beneficiary_contact', 'Beneficiary contact', 'Beneficiary phone and email.', [
      field('beneficiary_daytime_phone', 'Beneficiary daytime phone', 'phone', { countryCodeDefault: '+1' }),
      field('beneficiary_email_address', 'Beneficiary email address', 'email', { autocomplete: 'email' })
    ]),
    step('i130_beneficiary_marital_status', 'Beneficiary marital history', 'Number of marriages and current marital status.', [
      field('beneficiary_number_of_marriages', 'How many times has the beneficiary been married?', 'number', { inputmode: 'numeric' }),
      field('beneficiary_marital_status', 'Beneficiary marital status', 'select', { options: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated', 'Annulled'] })
    ]),
    step('i130_beneficiary_current_marriage', 'Beneficiary current marriage', 'Skipped automatically when the beneficiary is not currently married.', [
      field('beneficiary_current_marriage_date', 'Beneficiary current marriage date', 'date', { showWhen: [{ id: 'beneficiary_marital_status', equals: 'Married' }] }),
      field('beneficiary_current_marriage_place', 'Beneficiary current marriage place', 'text', { showWhen: [{ id: 'beneficiary_marital_status', equals: 'Married' }] })
    ]),
    step('i130_beneficiary_spouse_prior', 'Beneficiary current or prior spouse', 'Skipped automatically when the beneficiary has no current or prior spouse to report.', [
      field('beneficiary_spouse_name', 'Beneficiary spouse or prior spouse full name', 'text', { showWhenAny: [{ id: 'beneficiary_marital_status', in: ['Married','Divorced','Widowed','Separated','Annulled'] }, { id: 'beneficiary_number_of_marriages', gte: 1 }] }),
      field('beneficiary_prior_marriage_end_date', 'Date prior marriage ended, if any', 'date', { showWhenAny: [{ id: 'beneficiary_marital_status', in: ['Divorced','Widowed','Separated','Annulled'] }, { id: 'beneficiary_number_of_marriages', gte: 2 }] })
    ]),
    step('i130_beneficiary_children', 'Beneficiary children', 'Enter beneficiary children exactly as needed for Part 4.', [
      field('beneficiary_children_count', 'How many children does the beneficiary have?', 'number', { inputmode: 'numeric' }),
      field('beneficiary_children_details', 'Children names, dates of birth, countries of birth, and relationship', 'textarea', { showWhen: [{ id: 'beneficiary_children_count', gte: 1 }] })
    ]),
    step('i130_beneficiary_entry_status', 'Beneficiary entry and immigration status', 'If the beneficiary is in the United States, capture entry/status details.', [
      field('beneficiary_in_us_now', 'Is the beneficiary currently in the United States?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('beneficiary_class_i94_status', 'Class of admission / I-94 status, if in the United States', 'text', { showWhen: [{ id: 'beneficiary_in_us_now', equals: 'Yes' }] })
    ]),
    step('i130_beneficiary_i94_passport', 'Beneficiary I-94 and passport', 'Skipped automatically when the beneficiary is not in the United States.', [
      field('beneficiary_i94_number', 'Beneficiary I-94 number, if any', 'text', { autocomplete: 'off', showWhen: [{ id: 'beneficiary_in_us_now', equals: 'Yes' }] }),
      field('beneficiary_passport_or_travel_document', 'Passport or travel document number', 'text', { autocomplete: 'off' })
    ]),
    step('i130_beneficiary_passport_country', 'Beneficiary passport country and expiration', 'Country of issuance and expiration date.', [
      field('beneficiary_passport_country', 'Country of issuance', 'select', { options: COUNTRY_OPTIONS }),
      field('beneficiary_passport_expiration', 'Passport/travel document expiration date', 'date')
    ]),
    step('i130_beneficiary_employment', 'Beneficiary employment', 'Current employer, address, occupation, and start date.', [
      employmentHistoryField('beneficiary_current_employment', 'Beneficiary current employment', { entries: 1 })
    ]),
    step('i130_beneficiary_removal', 'Beneficiary immigration proceedings', 'Removal, exclusion, rescission, or judicial proceedings questions.', [
      field('beneficiary_in_removal_proceedings', 'Is the beneficiary in removal/exclusion/rescission/judicial proceedings?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('beneficiary_proceedings_details', 'If yes, city/state/date and details', 'textarea')
    ]),
    step('i130_beneficiary_other_relatives', 'Beneficiary relatives in the United States', 'List spouse, children, parents, or siblings in the United States if applicable.', [
      field('beneficiary_us_relative_1', 'Relative 1 name and relationship', 'text'),
      field('beneficiary_us_relative_2', 'Relative 2 name and relationship', 'text')
    ]),
    step('i130_prior_beneficiary_petition', 'Prior petition for beneficiary', 'Answer the Part 5 prior petition question.', [
      field('prior_petition_filed_for_beneficiary', 'Has anyone else ever filed a petition for this beneficiary?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('prior_petition_details', 'Prior petition filer, place filed, date filed, and result', 'textarea')
    ]),

    // I-130 Part 6-9: statement, interpreter, preparer, additional information.
    step('i130_petitioner_statement', 'Petitioner statement', 'Choose the petitioner statement that applies before signature.', [
      field('petitioner_statement', 'Petitioner statement', 'radio', {
        options: ['I can read and understand English', 'Interpreter read the petition to me']
      }),
      field('petitioner_statement_language', 'Language used by interpreter, if any', 'text')
    ]),
    step('i130_petitioner_contact', 'Petitioner contact information', 'Petitioner phone and email for Part 6.', [
      field('petitioner_daytime_phone', 'Petitioner daytime phone', 'phone', { countryCodeDefault: '+1' }),
      field('petitioner_email_address', 'Petitioner email address', 'email', { autocomplete: 'email' })
    ]),
    step('i130_interpreter_preparer_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer details are collected.', [
      field('has_interpreter', 'Will an interpreter be used for this petition?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this petition for the petitioner?', 'radio', { options: ['Yes', 'No'] })
    ]),
    step('i130_additional_information', 'Additional information', 'Use only for extra explanations that do not fit in earlier fields.', [
      field('i130_additional_information', 'Additional information for Part 9, if any', 'textarea')
    ])
  ];
}

function i130aSpecificSteps() {
  return [
    // I-130A Part 1, pages 1-2: spouse beneficiary.
    step('i130a_spouse_numbers', 'Spouse beneficiary USCIS numbers', 'Use spouse beneficiary numbers exactly as shown, if any.', [
      field('spouse_alien_number', 'Spouse beneficiary A-number, if any', 'text', { autocomplete: 'off' }),
      field('spouse_uscis_online_account_number', 'Spouse beneficiary USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i130a_spouse_name', 'Spouse beneficiary legal name', 'Enter the spouse beneficiary name as shown on documents.', [
      field('spouse_family_name', 'Spouse family name', 'text', { required: true, autocomplete: 'family-name' }),
      field('spouse_given_name', 'Spouse given name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i130a_spouse_middle', 'Spouse beneficiary middle name', 'If there is no middle name, leave this blank.', [
      field('spouse_middle_name', 'Spouse middle name', 'text', { autocomplete: 'additional-name' })
    ]),
    step('i130a_spouse_current_address', 'Spouse current physical address', 'Complete address with dates at this residence.', [
      addressBlockField('spouse_current_address', 'Spouse current physical address', 'spouse_current', { required: true }),
      field('spouse_current_address_from', 'Date from', 'date')
    ]),
    step('i130a_spouse_prior_address_1', 'Spouse prior physical address', 'Prior address with dates, if needed for the five-year history.', [
      addressHistoryField('spouse_residence_history', 'Spouse residence history for the last five years', { entries: 2, required: true })
    ]),
    step('i130a_spouse_last_foreign_address', 'Spouse last address outside the United States', 'Use this only if the spouse lived outside the United States.', [
      addressBlockField('spouse_last_foreign_address', 'Spouse last address outside the United States', 'spouse_last_foreign', {
        countryDefault: ''
      })
    ]),
    step('i130a_spouse_other_names', 'Spouse other names used', 'Prior legal names, maiden names, aliases, or N/A if required.', [
      field('spouse_other_names_used', 'Other names spouse has used', 'textarea')
    ]),
    step('i130a_spouse_birth_sex', 'Spouse date of birth and sex', 'These map to Part 1 birth and sex fields.', [
      field('spouse_date_of_birth', 'Spouse date of birth', 'date', { required: true }),
      field('spouse_sex', 'Spouse sex', 'radio', { options: ['Male', 'Female'] })
    ]),
    step('i130a_spouse_birth_place', 'Spouse place of birth', 'City/town/village, country of birth, citizenship, and country of residence.', [
      field('spouse_city_of_birth', 'Spouse city/town/village of birth', 'text'),
      field('spouse_country_of_birth', 'Spouse country of birth', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i130a_spouse_citizenship_residence', 'Spouse citizenship and residence country', 'Country of citizenship and country of residence.', [
      field('spouse_country_of_citizenship', 'Spouse country of citizenship or nationality', 'select', { options: COUNTRY_OPTIONS }),
      field('spouse_country_of_residence', 'Spouse country of residence', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i130a_spouse_parent1', 'Spouse parent 1', 'Parent 1 name, date of birth, place of birth, and residence.', [
      field('spouse_parent1_full_name', 'Spouse parent 1 full name', 'text'),
      field('spouse_parent1_details', 'Parent 1 birth/residence details', 'textarea')
    ]),
    step('i130a_spouse_parent2', 'Spouse parent 2', 'Parent 2 name, date of birth, place of birth, and residence.', [
      field('spouse_parent2_full_name', 'Spouse parent 2 full name', 'text'),
      field('spouse_parent2_details', 'Parent 2 birth/residence details', 'textarea')
    ]),

    // I-130A Parts 2-3, pages 2-3: employment.
    step('i130a_spouse_current_employment', 'Spouse current employment', 'Current employer, address, occupation, and dates.', [
      employmentHistoryField('spouse_current_employment', 'Spouse current employment', { entries: 1 })
    ]),
    step('i130a_spouse_prior_employment', 'Spouse prior employment', 'Prior employment record if needed for the history period.', [
      employmentHistoryField('spouse_employment_history', 'Spouse employment history for the last five years', { entries: 2 })
    ]),
    step('i130a_spouse_last_foreign_employment', 'Spouse last foreign employment', 'Last employment outside the United States, if applicable.', [
      employmentHistoryField('spouse_last_foreign_employment', 'Spouse last foreign employment', { entries: 1 })
    ]),

    // I-130A Parts 4-7: statement, interpreter, preparer, additional information.
    step('i130a_spouse_statement', 'Spouse beneficiary statement', 'Choose the statement that applies before signature.', [
      field('spouse_statement', 'Spouse beneficiary statement', 'radio', {
        options: ['I can read and understand English', 'Interpreter read the supplement to me']
      }),
      field('spouse_statement_language', 'Language used by interpreter, if any', 'text')
    ]),
    step('i130a_spouse_contact', 'Spouse beneficiary contact', 'Spouse phone and email.', [
      field('spouse_daytime_phone', 'Spouse daytime phone', 'phone', { countryCodeDefault: '+1' }),
      field('spouse_email_address', 'Spouse email address', 'email', { autocomplete: 'email' })
    ]),
    step('i130a_interpreter_preparer_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer details are collected.', [
      field('has_interpreter', 'Will an interpreter be used for this supplement?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this supplement for the spouse beneficiary?', 'radio', { options: ['Yes', 'No'] })
    ]),
    step('i130a_additional_information', 'Additional information', 'Use only for extra explanations that do not fit in earlier fields.', [
      field('i130a_additional_information', 'Additional information for Part 7, if any', 'textarea')
    ])
  ];
}

function i131SpecificSteps() {
  const correctionActions = ['Renewal', 'Replacement', 'Correction', 'Record request'];
  const deliveryAwayFromApplicant = ['U.S. Embassy or Consulate', 'DHS office outside the United States', 'Attorney or accredited representative'];
  const forPersonOutsideTypes = ['Advance parole document for person outside the United States', 'Initial parole document'];
  const travelTripTypes = [
    'Advance parole document while inside the United States',
    'Advance parole document for person outside the United States',
    'TPS travel authorization',
    'Initial parole document'
  ];
  const longTripTypes = ['Reentry permit', 'Refugee travel document'];
  return [
    // I-131 Part 1, pages 1-4: application type and requested document.
    step('i131_application_type', 'I-131 application type', 'Start with the exact travel document or parole document requested on the form.', [
      field('i131_application_type', 'What are you applying for?', 'select', {
        required: true,
        options: [
          'Reentry permit',
          'Refugee travel document',
          'Advance parole document while inside the United States',
          'Advance parole document for person outside the United States',
          'TPS travel authorization',
          'Initial parole document',
          'Replacement or correction of a travel/parole document',
          'Arrival/departure record or parole record',
          'Not sure'
        ]
      })
    ]),
    step('i131_document_action', 'Requested action', 'Confirm whether this is a new document, renewal, replacement, correction, or record request.', [
      field('i131_document_action', 'Requested action', 'select', {
        required: true,
        options: ['Initial document', 'Renewal', 'Replacement', 'Correction', 'Record request', 'Not sure']
      }),
      field('i131_prior_document_number', 'Prior travel/parole document or receipt number, if any', 'text', {
        autocomplete: 'off',
        showWhen: [{ id: 'i131_document_action', in: correctionActions }]
      })
    ]),
    step('i131_replacement_reason', 'Replacement or correction details', 'Complete this only if a prior document needs replacement or correction.', [
      field('i131_replacement_reason', 'Reason for replacement or correction', 'select', {
        options: ['Lost', 'Stolen', 'Damaged', 'Never received', 'USCIS error', 'Biographic correction', 'Other'],
        showWhenAny: [
          { id: 'i131_document_action', equals: 'Replacement' },
          { id: 'i131_document_action', equals: 'Correction' }
        ]
      }),
      field('i131_replacement_explanation', 'Explain what happened or what must be corrected', 'textarea', {
        showWhenAny: [
          { id: 'i131_document_action', equals: 'Replacement' },
          { id: 'i131_document_action', equals: 'Correction' }
        ]
      })
    ]),

    // I-131 Part 2, pages 4-6: applicant information.
    step('i131_applicant_name', 'Applicant legal name', 'Use the name exactly as it should appear on the USCIS form.', [
      field('i131_family_name', 'Family name / last name', 'text', { required: true, autocomplete: 'family-name' }),
      field('i131_given_name', 'Given name / first name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i131_applicant_middle_other_names', 'Middle name and other names', 'Leave middle name blank if there is no middle name. Add prior names only if used.', [
      field('i131_middle_name', 'Middle name', 'text', { autocomplete: 'additional-name' }),
      field('i131_other_names_used', 'Other names used, if any', 'textarea')
    ]),
    step('i131_mailing_address', 'Applicant mailing address', 'Enter the complete mailing address as one structured address block.', [
      addressBlockField('i131_mailing_address', 'Mailing address', 'i131_mailing', { required: true })
    ]),
    step('i131_physical_address_match', 'Applicant physical address', 'USCIS asks whether the physical address is the same as the mailing address.', [
      field('i131_physical_same_as_mailing', 'Is the physical address the same as the mailing address?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      })
    ]),
    step('i131_physical_address', 'Applicant current physical address', 'Complete this only if the physical address is different from the mailing address.', [
      addressBlockField('i131_physical_address', 'Physical address', 'i131_physical', {
        showWhen: [{ id: 'i131_physical_same_as_mailing', equals: 'No' }]
      })
    ]),
    step('i131_applicant_numbers', 'Applicant USCIS numbers', 'A-number, SSN, USCIS online account number, class of admission, and I-94 fields appear in Part 2.', [
      field('i131_alien_number', 'Alien registration number / A-number, if any', 'text', { autocomplete: 'off' }),
      field('i131_uscis_online_account_number', 'USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i131_ssn_i94', 'SSN and I-94', 'Use only digits for SSN and I-94 when available.', [
      field('i131_ssn', 'Social Security number, if any', 'text', { autocomplete: 'off' }),
      field('i131_i94_number', 'I-94 record number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i131_birth_citizenship', 'Birth and citizenship', 'These fields map to the Part 2 country and birth questions.', [
      field('i131_country_of_birth', 'Country of birth', 'select', { options: COUNTRY_OPTIONS, autocomplete: 'country-name' }),
      field('i131_country_of_citizenship', 'Country of citizenship or nationality', 'select', { options: COUNTRY_OPTIONS, autocomplete: 'country-name' })
    ]),
    step('i131_birth_date_gender', 'Date of birth and gender', 'Use the applicant date of birth and the form gender selection.', [
      field('i131_date_of_birth', 'Date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('i131_gender', 'Gender', 'radio', { options: ['Male', 'Female', 'Another gender identity'] })
    ]),
    step('i131_admission_status', 'Class of admission and status', 'Capture current or most recent class of admission and I-94 expiration when applicable.', [
      field('i131_class_of_admission', 'Class of admission', 'text', { placeholder: 'Example: ASYLEE, PAROLEE, TPS, F-1, B-2.' }),
      field('i131_i94_expiration_date', 'I-94 expiration date, if any', 'date')
    ]),

    // I-131 pages 6-7: beneficiary information for requests made for another person.
    step('i131_for_someone_else', 'Beneficiary information', 'Some I-131 filings are for a beneficiary other than the person preparing the request.', [
      field('i131_for_beneficiary', 'Is this application for someone other than the applicant above?', 'radio', {
        required: true,
        options: ['No, this is for the applicant', 'Yes, this is for another person'],
        showWhen: [{ id: 'i131_application_type', in: forPersonOutsideTypes }]
      })
    ]),
    step('i131_beneficiary_name', 'Beneficiary legal name', 'Complete this if the request is for another person.', [
      field('i131_beneficiary_family_name', 'Beneficiary family name / last name', 'text', {
        showWhen: [{ id: 'i131_for_beneficiary', equals: 'Yes, this is for another person' }]
      }),
      field('i131_beneficiary_given_name', 'Beneficiary given name / first name', 'text', {
        showWhen: [{ id: 'i131_for_beneficiary', equals: 'Yes, this is for another person' }]
      })
    ]),
    step('i131_beneficiary_birth_contact', 'Beneficiary birth and contact', 'Date of birth, citizenship, phone, and email for the beneficiary.', [
      field('i131_beneficiary_date_of_birth', 'Beneficiary date of birth', 'date', {
        showWhen: [{ id: 'i131_for_beneficiary', equals: 'Yes, this is for another person' }]
      }),
      field('i131_beneficiary_email', 'Beneficiary email, if any', 'email', {
        autocomplete: 'email',
        showWhen: [{ id: 'i131_for_beneficiary', equals: 'Yes, this is for another person' }]
      })
    ]),
    step('i131_beneficiary_address', 'Beneficiary current physical address', 'Enter the beneficiary address as one complete address block.', [
      addressBlockField('i131_beneficiary_address', 'Beneficiary address', 'i131_beneficiary', {
        showWhen: [{ id: 'i131_for_beneficiary', equals: 'Yes, this is for another person' }]
      })
    ]),
    step('i131_beneficiary_status', 'Beneficiary immigration status', 'Complete class of admission and I-94 fields when the beneficiary has them.', [
      field('i131_beneficiary_class_of_admission', 'Beneficiary class of admission', 'text', {
        showWhen: [{ id: 'i131_for_beneficiary', equals: 'Yes, this is for another person' }]
      }),
      field('i131_beneficiary_i94_number', 'Beneficiary I-94 number, if any', 'text', {
        autocomplete: 'off',
        showWhen: [{ id: 'i131_for_beneficiary', equals: 'Yes, this is for another person' }]
      })
    ]),

    // I-131 Part 3, page 7: biographic information.
    step('i131_biographic_ethnicity_race', 'Biographic information', 'Ethnicity and race questions follow the official Part 3 layout.', [
      field('i131_ethnicity', 'Ethnicity', 'radio', { options: ['Hispanic or Latino', 'Not Hispanic or Latino'] }),
      field('i131_race', 'Race', 'checkboxes', { options: ['American Indian or Alaska Native', 'Asian', 'Black or African American', 'Native Hawaiian or Other Pacific Islander', 'White'] })
    ]),
    step('i131_biographic_body', 'Height and weight', 'Use the same units as the USCIS form.', [
      field('i131_height_feet', 'Height feet', 'select', { options: ['3', '4', '5', '6', '7', '8'] }),
      field('i131_height_inches', 'Height inches', 'select', { options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] })
    ]),
    step('i131_biographic_colors', 'Eye color and hair color', 'Select the closest USCIS option.', [
      field('i131_eye_color', 'Eye color', 'select', { options: ['Black', 'Blue', 'Brown', 'Gray', 'Green', 'Hazel', 'Maroon', 'Pink', 'Unknown'] }),
      field('i131_hair_color', 'Hair color', 'select', { options: ['Bald', 'Black', 'Blond', 'Brown', 'Gray', 'Red', 'Sandy', 'White', 'Unknown'] })
    ]),

    // I-131 Part 4, pages 7-9: prior travel document and delivery.
    step('i131_prior_document_history', 'Prior travel or parole documents', 'USCIS asks whether a prior travel/parole document was issued and what happened to it.', [
      field('i131_prior_document_issued', 'Has USCIS ever issued you a travel document, parole document, or arrival/departure record?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
      field('i131_prior_document_disposition', 'What happened to the prior document?', 'select', {
        options: ['Still valid', 'Expired', 'Lost', 'Stolen', 'Damaged', 'Returned to USCIS', 'Other', 'Not applicable'],
        showWhen: [{ id: 'i131_prior_document_issued', equals: 'Yes' }]
      })
    ]),
    step('i131_prior_document_details', 'Prior document details', 'Use receipt or document numbers only if known.', [
      field('i131_prior_document_receipt', 'Prior receipt or document number', 'text', {
        autocomplete: 'off',
        showWhen: [{ id: 'i131_prior_document_issued', equals: 'Yes' }]
      }),
      field('i131_prior_document_explanation', 'Explanation for prior document or correction', 'textarea', {
        showWhen: [{ id: 'i131_prior_document_issued', equals: 'Yes' }]
      })
    ]),
    step('i131_document_delivery', 'Where should the document be sent?', 'For some I-131 categories, USCIS asks where to send the approved document.', [
      field('i131_delivery_option', 'Delivery option', 'select', {
        options: ['Mail to applicant U.S. address', 'U.S. Embassy or Consulate', 'DHS office outside the United States', 'Attorney or accredited representative', 'Not sure']
      }),
      field('i131_delivery_contact_email', 'Delivery contact email, if any', 'email', {
        autocomplete: 'email',
        showWhen: [{ id: 'i131_delivery_option', in: deliveryAwayFromApplicant }]
      })
    ]),
    step('i131_delivery_address', 'Document delivery address', 'Complete only if the document should be sent somewhere other than the applicant mailing address.', [
      addressBlockField('i131_delivery_address', 'Delivery address', 'i131_delivery', {
        showWhen: [{ id: 'i131_delivery_option', in: deliveryAwayFromApplicant }]
      })
    ]),

    // I-131 Parts 5-8, pages 9-11: travel and category questions.
    step('i131_time_outside_us', 'Time outside the United States', 'For reentry permits and some travel documents, USCIS asks about expected time outside the United States.', [
      field('i131_expected_time_outside_us', 'Expected time outside the United States', 'select', {
        options: ['Less than 6 months', '6 months to 1 year', '1 to 2 years', '2 to 3 years', '3 to 4 years', 'More than 4 years', 'Not sure'],
        showWhen: [{ id: 'i131_application_type', in: longTripTypes }]
      }),
      field('i131_country_of_refugee_status', 'Country of refugee/asylee status, if applicable', 'select', {
        options: COUNTRY_OPTIONS,
        showWhen: [{ id: 'i131_application_type', equals: 'Refugee travel document' }]
      })
    ]),
    step('i131_prior_removal_or_status_issues', 'Prior removal or status issues', 'These are Yes/No questions from the travel document eligibility sections.', [
      field('i131_exclusion_deportation_or_removal', 'Have you ever been in exclusion, deportation, removal, or rescission proceedings?', 'radio', {
        options: ['Yes', 'No', 'Not sure']
      }),
      field('i131_traveled_to_country_of_persecution', 'For refugee/asylee travel, have you returned or plan to return to the country of claimed persecution?', 'radio', {
        options: ['Yes', 'No', 'Not applicable', 'Not sure'],
        showWhen: [{ id: 'i131_application_type', equals: 'Refugee travel document' }]
      })
    ]),
    step('i131_advance_parole_trip', 'Advance parole trip details', 'Travel date, destination countries, and purpose of travel.', [
      field('i131_planned_departure_date', 'Planned departure date', 'date', {
        showWhen: [{ id: 'i131_application_type', in: travelTripTypes }]
      }),
      field('i131_countries_to_visit', 'Countries to visit', 'textarea', {
        showWhen: [{ id: 'i131_application_type', in: travelTripTypes }]
      })
    ]),
    step('i131_trip_purpose_length', 'Purpose and expected trip length', 'Keep the purpose factual and short.', [
      field('i131_purpose_of_travel', 'Purpose of travel', 'textarea', {
        required: true,
        showWhen: [{ id: 'i131_application_type', in: travelTripTypes }]
      }),
      field('i131_expected_trip_length', 'Expected length of trip', 'text', {
        showWhen: [{ id: 'i131_application_type', in: travelTripTypes }]
      })
    ]),
    step('i131_prior_advance_parole', 'Prior advance parole travel', 'USCIS asks whether you left the United States before with advance parole.', [
      field('i131_left_us_with_advance_parole_before', 'Have you left the United States before with advance parole?', 'radio', {
        options: ['Yes', 'No', 'Not sure'],
        showWhen: [{ id: 'i131_application_type', in: travelTripTypes }]
      }),
      field('i131_prior_advance_parole_location', 'If yes, city/town and country of prior arrival', 'textarea', {
        showWhen: [
          { id: 'i131_application_type', in: travelTripTypes },
          { id: 'i131_left_us_with_advance_parole_before', equals: 'Yes' }
        ]
      })
    ]),
    step('i131_person_outside_us', 'Person outside the United States', 'Use this only for parole requests involving a person outside the United States.', [
      field('i131_person_outside_us_explanation', 'Why should parole be issued for a person outside the United States?', 'textarea', {
        showWhen: [{ id: 'i131_application_type', in: forPersonOutsideTypes }]
      }),
      field('i131_intended_arrival_date_us', 'Intended U.S. arrival date', 'date', {
        showWhen: [{ id: 'i131_application_type', in: forPersonOutsideTypes }]
      })
    ]),
    step('i131_intended_us_arrival_place', 'Intended place of arrival in the United States', 'City/town and country for the intended U.S. arrival.', [
      field('i131_intended_arrival_city', 'City or town of intended arrival', 'text', {
        showWhen: [{ id: 'i131_application_type', in: forPersonOutsideTypes }]
      }),
      field('i131_intended_arrival_country', 'Country', 'select', {
        options: COUNTRY_OPTIONS,
        countryDefault: 'United States',
        showWhen: [{ id: 'i131_application_type', in: forPersonOutsideTypes }]
      })
    ]),

    // I-131 Part 10 and optional interpreter/preparer sections.
    step('i131_applicant_contact', 'Applicant contact information', 'USCIS phone fields should be captured cleanly for the signature/contact section.', [
      field('i131_daytime_phone', 'Daytime phone', 'phone', { autocomplete: 'tel' }),
      field('i131_mobile_phone', 'Mobile phone, if any', 'phone', { autocomplete: 'tel' })
    ]),
    step('i131_applicant_email', 'Applicant email', 'Use a valid email address if the applicant has one.', [
      field('i131_email', 'Email address', 'email', { autocomplete: 'email' })
    ])
  ];
}

function i589SpecificSteps() {
  return [
    // I-589 Part A.I, page 1: applicant identity.
    step('i589_applicant_numbers', 'I-589 applicant numbers', 'Start with USCIS numbers exactly as shown, if any.', [
      field('alien_number', 'A-number, if any', 'text', { autocomplete: 'off', placeholder: '9 digits' }),
      field('uscis_online_account_number', 'USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i589_legal_name', 'Applicant legal name', 'Enter the applicant name exactly as it should appear on the asylum application.', [
      field('applicant_family_name', 'Family name / last name', 'text', { required: true, autocomplete: 'family-name' }),
      field('applicant_given_name', 'Given name / first name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i589_middle_other_names', 'Middle and other names', 'Leave middle name blank if none. List other names only if used.', [
      field('applicant_middle_name', 'Middle name', 'text', { autocomplete: 'additional-name' }),
      field('other_names_used', 'Other names used, if any', 'textarea')
    ]),
    step('i589_residential_address', 'Current U.S. address', 'Complete the current U.S. residential address.', [
      addressBlockField('i589_residential_address', 'Current U.S. residential address', 'i589_residential', { required: true })
    ]),
    step('i589_mailing_address_match', 'Mailing address', 'USCIS asks for a separate mailing address if different.', [
      field('physical_same_as_mailing', 'Is your mailing address the same as your current residential address?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      })
    ]),
    step('i589_mailing_address', 'Separate mailing address', 'Complete only if mailing address is different.', [
      addressBlockField('mailing_address', 'Mailing address', 'mailing', {
        showWhen: [{ id: 'physical_same_as_mailing', equals: 'No' }]
      })
    ]),
    step('i589_contact', 'Applicant contact information', 'Phone and email for contact and signature sections.', [
      field('daytime_phone', 'Daytime phone', 'phone', { autocomplete: 'tel' }),
      field('email_address', 'Email address', 'email', { autocomplete: 'email' })
    ]),
    step('i589_birth_sex_marital', 'Birth, sex, and marital status', 'These appear in the applicant information section.', [
      field('date_of_birth', 'Date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('sex', 'Sex', 'radio', { options: ['Male', 'Female'] })
    ]),
    step('i589_marital_status', 'Marital status', 'Choose the current marital status.', [
      field('marital_status', 'Marital status', 'select', { options: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'] })
    ]),
    step('i589_birth_place', 'Place of birth', 'City/town and country of birth.', [
      field('city_of_birth', 'City/town/village of birth', 'text', { autocomplete: 'off' }),
      field('country_of_birth', 'Country of birth', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i589_citizenship_identity', 'Citizenship, nationality, and identity', 'Nationality, citizenship, ethnicity, tribe, and religion questions.', [
      field('country_of_citizenship', 'Country of citizenship or nationality', 'select', { options: COUNTRY_OPTIONS }),
      field('i589_nationality_at_birth', 'Nationality at birth, if different', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i589_ethnicity_religion', 'Ethnicity, tribe, and religion', 'Use factual identity descriptions from the applicant.', [
      field('i589_ethnic_or_tribal_group', 'Ethnic or tribal group', 'text'),
      field('i589_religion', 'Religion', 'text')
    ]),

    // I-589 Part A.I, pages 1-2: travel, passport, and status.
    step('i589_last_country_residence', 'Last country and address before the U.S.', 'Capture the last foreign residence before coming to the United States.', [
      field('i589_last_country_lived', 'Country where you last lived before the United States', 'select', { options: COUNTRY_OPTIONS }),
      addressBlockField('i589_last_foreign_address', 'Last foreign address', 'i589_last_foreign', { countryDefault: '' })
    ]),
    step('i589_residences_5y', 'Residences during the past 5 years', 'List all residences for the past 5 years; list the present address first. This is I-589 Part A.III Item 2.', [
      addressHistoryField('i589_residences_last_5_years', 'Residences during the past 5 years', { entries: 5 })
    ]),
    step('i589_education_history', 'Education history', 'List education beginning with the most recent school attended. This is I-589 Part A.III Item 3.', [
      employmentHistoryField('i589_education_history', 'Education history (most recent first)', { entries: 4 })
    ]),
    step('i589_employment_5y', 'Employment during the past 5 years', 'List employment for the past 5 years; list the present employment first. This is I-589 Part A.III Item 4.', [
      employmentHistoryField('i589_employment_last_5_years', 'Employment during the past 5 years', { entries: 3 })
    ]),
    step('i589_passport_travel_document', 'Passport or travel document', 'Passport/travel document details if available.', [
      field('passport_number', 'Passport or travel document number', 'text', { autocomplete: 'off' }),
      field('passport_country_of_issuance', 'Country that issued passport or travel document', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i589_passport_expiration', 'Passport expiration', 'Expiration date if known.', [
      field('passport_expiration', 'Passport expiration date', 'date')
    ]),
    step('i589_last_entry', 'Last entry into the United States', 'Place, date, and manner of last entry.', [
      field('place_entry', 'Place of last entry into the United States', 'text', { required: true }),
      field('date_last_entered_us', 'Date last entered the United States', 'date', { required: true })
    ]),
    step('i589_i94_status', 'I-94 and status', 'Use I-94 and status information exactly as shown.', [
      field('i94_number', 'I-94 number, if any', 'text', { autocomplete: 'off' }),
      field('current_immigration_status', 'Current immigration status', 'text')
    ]),
    step('i589_status_expiration', 'Authorized stay expiration', 'Use the I-94 expiration date or D/S if applicable.', [
      field('authorized_stay_expires', 'Authorized stay expiration date or D/S', 'text'),
      field('one_year_deadline_issue', 'Is the filing close to or after one year from entry?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ]),

    // I-589 Part A.II, pages 2-4: spouse and children.
    step('i589_spouse_included', 'Spouse information', 'Answer whether a spouse exists and whether they are included.', [
      field('i589_has_spouse', 'Do you have a spouse?', 'radio', { options: ['Yes', 'No'] }),
      field('i589_spouse_included', 'Is the spouse included in this application?', 'radio', {
        options: ['Yes', 'No'],
        showWhen: [{ id: 'i589_has_spouse', equals: 'Yes' }]
      })
    ]),
    step('i589_spouse_name', 'Spouse name', 'Complete only if there is a spouse.', [
      field('spouse_family_name', 'Spouse family name', 'text', {
        autocomplete: 'family-name',
        showWhen: [{ id: 'i589_has_spouse', equals: 'Yes' }]
      }),
      field('spouse_given_name', 'Spouse given name', 'text', {
        autocomplete: 'given-name',
        showWhen: [{ id: 'i589_has_spouse', equals: 'Yes' }]
      })
    ]),
    step('i589_spouse_birth_status', 'Spouse birth and status', 'Spouse date of birth, nationality, and current status.', [
      field('spouse_date_of_birth', 'Spouse date of birth', 'date', {
        showWhen: [{ id: 'i589_has_spouse', equals: 'Yes' }]
      }),
      field('spouse_country_of_citizenship', 'Spouse country of citizenship or nationality', 'select', {
        options: COUNTRY_OPTIONS,
        showWhen: [{ id: 'i589_has_spouse', equals: 'Yes' }]
      })
    ]),
    step('i589_spouse_entry', 'Spouse entry and I-94', 'Complete if the spouse is in the United States or included.', [
      field('spouse_place_entry', 'Spouse place of last U.S. entry', 'text', {
        showWhen: [{ id: 'i589_has_spouse', equals: 'Yes' }]
      }),
      field('spouse_i94_number', 'Spouse I-94 number, if any', 'text', {
        autocomplete: 'off',
        showWhen: [{ id: 'i589_has_spouse', equals: 'Yes' }]
      })
    ]),
    step('i589_children_summary', 'Children', 'USCIS asks how many children you have and whether they are included.', [
      field('total_children', 'Total number of children', 'number', { inputmode: 'numeric' }),
      field('family_members_included', 'Family members included in this I-589', 'textarea', {
        showWhen: [{ id: 'total_children', gte: 1 }]
      })
    ]),
    step('i589_child1', 'Child 1 information', 'Collect child details in the same form order.', [
      field('child1_family_name', 'Child 1 family name', 'text', {
        autocomplete: 'family-name',
        showWhen: [{ id: 'total_children', gte: 1 }]
      }),
      field('child1_given_name', 'Child 1 given name', 'text', {
        autocomplete: 'given-name',
        showWhen: [{ id: 'total_children', gte: 1 }]
      })
    ]),
    step('i589_child1_details', 'Child 1 birth and status', 'Birth, citizenship, A-number, and included/not included status.', [
      field('child1_dob', 'Child 1 date of birth', 'date', {
        showWhen: [{ id: 'total_children', gte: 1 }]
      }),
      field('child1_country_of_birth', 'Child 1 country of birth', 'select', {
        options: COUNTRY_OPTIONS,
        showWhen: [{ id: 'total_children', gte: 1 }]
      })
    ]),

    // I-589 Part B-C, pages 5-8: claim facts and prior filings.
    step('i589_asylum_basis', 'Asylum basis', 'Select the bases described by the applicant. This is not legal advice.', [
      field('asylum_basis', 'Primary basis described by applicant', 'checkboxes', {
        required: true,
        options: ['Race', 'Religion', 'Nationality', 'Political opinion', 'Particular social group', 'CAT / torture concern', 'Not sure']
      })
    ]),
    step('i589_harm_summary', 'What happened or what do you fear?', 'Capture the factual harm/fear summary in the applicant’s own words.', [
      field('harm_or_fear_summary', 'Short summary of harm or fear', 'textarea', { required: true })
    ]),
    step('i589_harm_details', 'Harm and fear details', 'Dates, locations, people involved, reports, injuries, threats, and evidence.', [
      field('i589_harm_timeline', 'Timeline of harm, threats, or fear', 'textarea'),
      field('i589_evidence_available', 'Evidence available', 'textarea')
    ]),
    step('i589_family_harm', 'Family harm or fear', 'USCIS asks whether family members were harmed, threatened, or fear harm.', [
      field('i589_family_harmed_or_threatened', 'Have family members been harmed, threatened, arrested, or targeted?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i589_family_harm_details', 'Family harm details', 'textarea', {
        showWhenAny: [
          { id: 'i589_family_harmed_or_threatened', equals: 'Yes' },
          { id: 'i589_family_harmed_or_threatened', equals: 'Not sure' }
        ]
      })
    ]),
    step('i589_return_fear', 'Fear of return', 'Explain what the applicant believes may happen if returned.', [
      field('i589_return_fear_details', 'What do you fear will happen if you return?', 'textarea', { required: true })
    ]),
    step('i589_safe_relocation', 'Relocation and protection', 'Questions about relocation, police/government protection, and safe alternatives.', [
      field('i589_sought_government_protection', 'Did you seek protection from police or government authorities?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i589_relocation_possible', 'Could you safely relocate within your country?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ]),
    step('i589_prior_applications', 'Prior asylum applications', 'USCIS asks about prior applications by the applicant or family members.', [
      field('i589_prior_asylum_application', 'Have you or a family member ever applied for asylum, withholding, or CAT protection?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i589_prior_asylum_details', 'Prior application details', 'textarea', {
        showWhenAny: [
          { id: 'i589_prior_asylum_application', equals: 'Yes' },
          { id: 'i589_prior_asylum_application', equals: 'Not sure' }
        ]
      })
    ]),
    step('i589_third_country', 'Travel through or status in other countries', 'USCIS asks about lawful status, applications, and travel in other countries.', [
      field('i589_third_country_status', 'Did you receive lawful status, apply for protection, or live in another country before the U.S.?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i589_third_country_details', 'Third-country details', 'textarea', {
        showWhenAny: [
          { id: 'i589_third_country_status', equals: 'Yes' },
          { id: 'i589_third_country_status', equals: 'Not sure' }
        ]
      })
    ]),
    step('i589_criminal_or_security', 'Criminal, military, and security questions', 'Any Yes or unsure answer needs careful document review.', [
      field('i589_arrest_or_conviction', 'Have you ever been arrested, charged, convicted, detained, or imprisoned?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i589_military_or_security_service', 'Have you ever served in military, police, security, intelligence, or armed groups?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ]),
    step('i589_criminal_security_details', 'Criminal or security details', 'Details only if any criminal, detention, military, or security answer is Yes or unsure.', [
      field('i589_criminal_security_details', 'Details and documents', 'textarea', {
        showWhenAny: [
          { id: 'i589_arrest_or_conviction', equals: 'Yes' },
          { id: 'i589_arrest_or_conviction', equals: 'Not sure' },
          { id: 'i589_military_or_security_service', equals: 'Yes' },
          { id: 'i589_military_or_security_service', equals: 'Not sure' }
        ]
      })
    ]),

    // I-589 Parts D-E and optional interpreter/preparer sections.
    step('i589_statement_contact', 'Applicant statement and signature contact', 'Applicant statement, phone, and email before signature.', [
      field('applicant_statement', 'Applicant statement', 'radio', {
        options: ['I can read and understand English', 'Interpreter read the application to me']
      }),
      field('applicant_statement_language', 'Language used by interpreter, if any', 'text', {
        showWhen: [{ id: 'applicant_statement', equals: 'Interpreter read the application to me' }]
      })
    ]),
    step('i589_interpreter_preparer_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer sections must be completed.', [
      field('has_interpreter', 'Will an interpreter be used for this application?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this application for the applicant?', 'radio', { options: ['Yes', 'No'] })
    ])
  ];
}

function i864SpecificSteps() {
  return [
    // I-864 Part 1-2: basis and immigrant.
    step('i864_sponsor_basis', 'Sponsor basis', 'Start with why this sponsor is submitting Form I-864.', [
      field('i864_sponsor_basis', 'Sponsor basis', 'select', {
        required: true,
        options: [
          'Petitioner filing for the intending immigrant',
          'Joint sponsor',
          'Substitute sponsor',
          'First joint sponsor',
          'Second joint sponsor',
          'Not sure'
        ]
      }),
      field('joint_sponsor_needed', 'Is a joint sponsor needed?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ]),
    step('i864_principal_immigrant', 'Principal immigrant', 'The intending immigrant listed first on the affidavit.', [
      field('principal_immigrant_family_name', 'Principal immigrant family name', 'text', { required: true, autocomplete: 'family-name' }),
      field('principal_immigrant_given_name', 'Principal immigrant given name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i864_principal_numbers', 'Principal immigrant numbers', 'Use A-number, USCIS account number, and receipt number if available.', [
      field('principal_immigrant_alien_number', 'Principal immigrant A-number, if any', 'text', { autocomplete: 'off' }),
      field('principal_immigrant_receipt_number', 'Related USCIS receipt number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i864_principal_address', 'Principal immigrant mailing address', 'Complete the intending immigrant mailing address.', [
      addressBlockField('principal_immigrant_mailing_address', 'Principal immigrant mailing address', 'principal_immigrant_mailing', { required: true })
    ]),
    step('i864_other_immigrants', 'Other immigrants sponsored', 'List other family members immigrating with the principal immigrant.', [
      field('i864_other_immigrants_count', 'Number of other immigrants included', 'number', { inputmode: 'numeric' }),
      field('i864_other_immigrants_details', 'Other immigrants names and relationships', 'textarea')
    ]),

    // I-864 Part 4: sponsor.
    step('i864_sponsor_name', 'Sponsor legal name', 'Enter sponsor name exactly as shown on tax and identity records.', [
      field('sponsor_family_name', 'Sponsor family name', 'text', { required: true, autocomplete: 'family-name' }),
      field('sponsor_given_name', 'Sponsor given name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i864_sponsor_full_name', 'Sponsor full name and organization', 'Use this when a full-name line or organization name is needed.', [
      field('sponsor_full_name', 'Sponsor full legal name', 'text', { required: true, autocomplete: 'name' }),
      field('sponsor_organization_name', 'Sponsor organization name, if any', 'text', { autocomplete: 'organization' })
    ]),
    step('i864_sponsor_mailing_address', 'Sponsor mailing address', 'Complete sponsor mailing address as a structured block.', [
      addressBlockField('sponsor_mailing_address', 'Sponsor mailing address', 'sponsor_mailing', { required: true })
    ]),
    step('i864_sponsor_physical_address_match', 'Sponsor physical address', 'USCIS asks whether physical address is the same as mailing.', [
      field('sponsor_physical_same_as_mailing', 'Is sponsor physical address the same as mailing address?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      })
    ]),
    step('i864_sponsor_physical_address', 'Sponsor physical address details', 'Complete only if physical address differs from mailing.', [
      addressBlockField('sponsor_physical_address', 'Sponsor physical address', 'sponsor_physical', {
        showWhen: [{ id: 'sponsor_physical_same_as_mailing', equals: 'No' }]
      })
    ]),
    step('i864_sponsor_birth', 'Sponsor birth and citizenship', 'Sponsor date of birth, country of birth, and citizenship/residency status.', [
      field('sponsor_date_of_birth', 'Sponsor date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('sponsor_country_of_birth', 'Sponsor country of birth', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i864_sponsor_status', 'Sponsor immigration status', 'Status must match the I-864 sponsor eligibility section.', [
      field('sponsor_status', 'Sponsor status', 'select', {
        required: true,
        options: ['U.S. citizen', 'Lawful permanent resident', 'U.S. national', 'Not sure']
      }),
      field('sponsor_alien_number', 'Sponsor A-number, if LPR', 'text', {
        autocomplete: 'off',
        showWhen: [{ id: 'sponsor_status', equals: 'Lawful permanent resident' }]
      })
    ]),
    step('i864_sponsor_identifiers', 'Sponsor SSN and USCIS account', 'I-864 requires the sponsor SSN.', [
      field('sponsor_ssn', 'Sponsor Social Security number', 'text', { required: true, inputmode: 'numeric', autocomplete: 'off', placeholder: '9 digits' }),
      field('sponsor_uscis_online_account_number', 'Sponsor USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),

    // I-864 Part 5-6: household and income.
    step('i864_household_size', 'Household size', 'Calculate household size in the same order as the form.', [
      field('household_size', 'Household size', 'number', { required: true, inputmode: 'numeric' }),
      field('i864_household_size_notes', 'Household size notes', 'textarea')
    ]),
    step('i864_employment_status', 'Sponsor employment status', 'Current employment or self-employment.', [
      field('sponsor_employment_status', 'Sponsor employment status', 'select', {
        options: ['Employed', 'Self-employed', 'Retired', 'Unemployed', 'Student', 'Other']
      }),
      field('sponsor_employer_name', 'Current employer or business name', 'text', { autocomplete: 'organization' })
    ]),
    step('i864_current_income', 'Sponsor current annual income', 'Use current annual income before optional assets.', [
      field('current_annual_income', 'Current annual income', 'text', { required: true, inputmode: 'decimal' }),
      field('sponsor_income_source_details', 'Income source details', 'textarea')
    ]),
    step('i864_household_member_income', 'Household member income', 'Use only when household member income will be included.', [
      field('include_household_member_income', 'Will household member income be included?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('household_member_income_details', 'Household member names, relationship, and income', 'textarea', {
        showWhenAny: [
          { id: 'include_household_member_income', equals: 'Yes' },
          { id: 'include_household_member_income', equals: 'Not sure' }
        ]
      })
    ]),
    step('i864_tax_returns', 'Federal tax returns', 'List tax return years and available proof.', [
      field('tax_returns_available', 'Federal tax returns available', 'checkboxes', {
        options: ['Most recent year', 'Last 2 years', 'Last 3 years', 'W-2/1099', 'Pay stubs', 'Employment letter']
      }),
      field('i864_most_recent_tax_year_income', 'Most recent tax year total income', 'text', { inputmode: 'decimal' })
    ]),
    step('i864_assets', 'Assets', 'Use assets only if income may not meet the guideline.', [
      field('i864_assets_used', 'Will assets be used?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i864_asset_details', 'Asset details and approximate values', 'textarea', {
        showWhenAny: [
          { id: 'i864_assets_used', equals: 'Yes' },
          { id: 'i864_assets_used', equals: 'Not sure' }
        ]
      })
    ]),

    // I-864 Part 8-10: contact, interpreter, preparer.
    step('i864_sponsor_contact', 'Sponsor contact information', 'Phone and email for the sponsor signature/contact section.', [
      field('daytime_phone', 'Sponsor daytime phone', 'phone', { autocomplete: 'tel' }),
      field('email_address', 'Sponsor email address', 'email', { autocomplete: 'email' })
    ]),
    step('i864_interpreter_preparer_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer sections must be completed.', [
      field('has_interpreter', 'Will an interpreter be used for this affidavit?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this affidavit for the sponsor?', 'radio', { options: ['Yes', 'No'] })
    ])
  ];
}

function i912SpecificSteps() {
  return [
    // I-912 Part 1: request type and forms.
    step('i912_request_type', 'Fee waiver request type', 'Start with the forms and applicants covered by this fee waiver request.', [
      field('fee_waiver_forms', 'Forms requesting fee waiver', 'textarea', {
        required: true,
        placeholder: 'Example: I-485, I-765, I-131, N-400.'
      }),
      field('fee_waiver_applicant_count', 'Number of applicants included', 'number', { inputmode: 'numeric' })
    ]),
    step('i912_primary_applicant_name', 'Primary applicant name', 'Enter the primary applicant name exactly as shown on the USCIS form.', [
      field('applicant_family_name', 'Family name / last name', 'text', { required: true, autocomplete: 'family-name' }),
      field('applicant_given_name', 'Given name / first name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i912_primary_applicant_middle', 'Middle name and numbers', 'Middle name may be blank if none. Add USCIS numbers if available.', [
      field('applicant_middle_name', 'Middle name', 'text', { autocomplete: 'additional-name' }),
      field('alien_number', 'A-number, if any', 'text', { autocomplete: 'off', placeholder: '9 digits' })
    ]),
    step('i912_applicant_birth_status', 'Applicant birth and status', 'Date of birth, marital status, and immigration status.', [
      field('date_of_birth', 'Date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('current_immigration_status', 'Current immigration status', 'text')
    ]),
    step('i912_mailing_address', 'Mailing address', 'Complete applicant mailing address as a structured block.', [
      addressBlockField('mailing_address', 'Mailing address', 'mailing', { required: true })
    ]),
    step('i912_contact', 'Applicant contact information', 'Phone and email for contact and signature sections.', [
      field('daytime_phone', 'Daytime phone', 'phone', { autocomplete: 'tel' }),
      field('email_address', 'Email address', 'email', { autocomplete: 'email' })
    ]),

    // I-912 Part 2-4: basis for fee waiver.
    step('i912_basis', 'Fee waiver basis', 'Select each basis that applies. This is factual intake, not eligibility advice.', [
      field('fee_waiver_basis', 'Fee waiver basis', 'checkboxes', {
        required: true,
        options: ['Means-tested benefit', 'Household income at or below guideline', 'Financial hardship', 'Not sure']
      })
    ]),
    step('i912_means_tested_benefits', 'Means-tested benefits', 'Complete only if a means-tested benefit is being used.', [
      field('benefits_received', 'Public benefits received', 'textarea', {
        placeholder: 'Benefit name, recipient, agency, approval date, and proof available.',
        showWhenAny: [
          { id: 'fee_waiver_basis', includes: 'Means-tested benefit' },
          { id: 'fee_waiver_basis', includes: 'Not sure' }
        ]
      })
    ]),
    step('i912_household_size', 'Household size', 'Household size must match income evidence.', [
      field('household_size_fee_waiver', 'Household size', 'number', { required: true, inputmode: 'numeric' }),
      field('i912_household_members_details', 'Household members and relationships', 'textarea')
    ]),
    step('i912_household_income', 'Household income', 'Income, employment, unemployment, and support information.', [
      field('household_income', 'Household monthly or annual income', 'text', { required: true, inputmode: 'decimal' }),
      field('i912_income_evidence_available', 'Income evidence available', 'checkboxes', {
        options: ['Pay stubs', 'Tax return', 'W-2/1099', 'Benefit letter', 'Bank statements', 'Employer letter', 'Other']
      })
    ]),
    step('i912_assets', 'Assets and resources', 'List assets only if relevant to the hardship analysis.', [
      field('i912_assets_total', 'Approximate total assets/resources', 'text', { inputmode: 'decimal' }),
      field('i912_assets_details', 'Asset/resource details', 'textarea')
    ]),
    step('i912_monthly_expenses', 'Monthly expenses', 'Capture rent, utilities, food, medical, debt, and other expenses.', [
      field('i912_monthly_expenses_total', 'Approximate total monthly expenses', 'text', { inputmode: 'decimal' }),
      field('i912_expenses_details', 'Expense details', 'textarea')
    ]),
    step('i912_financial_hardship', 'Financial hardship', 'Complete only if hardship is part of the request or the basis is not clear.', [
      field('hardship_explanation', 'Financial hardship explanation', 'textarea', {
        showWhenAny: [
          { id: 'fee_waiver_basis', includes: 'Financial hardship' },
          { id: 'fee_waiver_basis', includes: 'Not sure' }
        ]
      })
    ]),
    step('i912_hardship_documents', 'Hardship documents', 'List documents available to support the hardship request.', [
      field('i912_hardship_documents_available', 'Hardship documents available', 'checkboxes', {
        options: ['Medical bills', 'Eviction notice', 'Utility shutoff notice', 'Unemployment proof', 'Debt/collection notices', 'Other']
      }),
      field('i912_additional_hardship_notes', 'Additional hardship notes', 'textarea')
    ]),

    // I-912 statement/interpreter/preparer.
    step('i912_applicant_statement', 'Applicant statement', 'Choose whether applicant reads English or used an interpreter.', [
      field('applicant_statement', 'Applicant statement', 'radio', {
        options: ['I can read and understand English', 'Interpreter read the request to me']
      }),
      field('applicant_statement_language', 'Language used by interpreter, if any', 'text')
    ]),
    step('i912_interpreter_preparer_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer sections must be completed.', [
      field('has_interpreter', 'Will an interpreter be used for this request?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this request for the applicant?', 'radio', { options: ['Yes', 'No'] })
    ])
  ];
}

function i751SpecificSteps() {
  return [
    // I-751 Part 1-2: conditional resident and filing basis.
    step('i751_filing_type', 'I-751 filing basis', 'Start with the exact filing basis selected on the form.', [
      field('i751_filing_type', 'Filing type', 'select', {
        required: true,
        options: ['Joint filing with spouse', 'Divorce waiver', 'Abuse or extreme cruelty waiver', 'Hardship waiver', 'Death of spouse waiver', 'Not sure']
      }),
      field('conditional_green_card_expiration', 'Conditional green card expiration date', 'date', { required: true })
    ]),
    step('i751_conditional_resident_numbers', 'Conditional resident numbers', 'Use A-number and USCIS account number if available.', [
      field('alien_number', 'Conditional resident A-number', 'text', { required: true, autocomplete: 'off', placeholder: '9 digits' }),
      field('uscis_online_account_number', 'USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i751_conditional_resident_name', 'Conditional resident legal name', 'Enter the conditional resident name exactly as shown on documents.', [
      field('applicant_family_name', 'Family name / last name', 'text', { required: true, autocomplete: 'family-name' }),
      field('applicant_given_name', 'Given name / first name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i751_middle_other_names', 'Middle and other names', 'Leave middle name blank if none. Add prior names only if used.', [
      field('applicant_middle_name', 'Middle name', 'text', { autocomplete: 'additional-name' }),
      field('other_names_used', 'Other names used, if any', 'textarea')
    ]),
    step('i751_birth_sex', 'Birth and sex', 'Date of birth, country of birth, and sex.', [
      field('date_of_birth', 'Date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('sex', 'Sex', 'radio', { options: ['Male', 'Female'] })
    ]),
    step('i751_birth_country', 'Country of birth and citizenship', 'Country fields from the conditional resident section.', [
      field('country_of_birth', 'Country of birth', 'select', { options: COUNTRY_OPTIONS }),
      field('country_of_citizenship', 'Country of citizenship or nationality', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i751_mailing_address', 'Conditional resident mailing address', 'Complete the mailing address as a structured address block.', [
      addressBlockField('mailing_address', 'Mailing address', 'mailing', { required: true })
    ]),
    step('i751_physical_address_match', 'Conditional resident physical address', 'USCIS asks whether physical address differs from mailing address.', [
      field('physical_same_as_mailing', 'Is physical address the same as mailing address?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      })
    ]),
    step('i751_physical_address', 'Physical address details', 'Complete only if physical address differs from mailing address.', [
      addressBlockField('physical_address', 'Physical address', 'physical', {
        showWhen: [{ id: 'physical_same_as_mailing', equals: 'No' }]
      })
    ]),

    // I-751 relationship and spouse.
    step('i751_marriage_status', 'Current marriage status', 'Marriage status drives joint filing or waiver facts.', [
      field('marriage_status_now', 'Current marriage status', 'select', {
        required: true,
        options: ['Married living together', 'Married but separated', 'Divorced', 'Widowed', 'Annulled', 'Other']
      }),
      field('conditional_residence_basis', 'How did you receive conditional residence?', 'select', {
        options: ['Marriage to U.S. citizen', 'Marriage to lawful permanent resident', 'Entrepreneur/investor', 'Dependent child', 'Not sure']
      })
    ]),
    step('i751_spouse_name', 'Spouse or former spouse name', 'Use the spouse connected to the conditional residence.', [
      field('spouse_family_name', 'Spouse/former spouse family name', 'text', { required: true, autocomplete: 'family-name' }),
      field('spouse_given_name', 'Spouse/former spouse given name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i751_spouse_status', 'Spouse status and birth', 'Spouse citizenship/status and basic identity.', [
      field('spouse_status', 'Spouse/former spouse status', 'select', { options: ['U.S. citizen', 'Lawful permanent resident', 'Other', 'Not sure'] }),
      field('spouse_date_of_birth', 'Spouse/former spouse date of birth', 'date')
    ]),
    step('i751_marriage_details', 'Marriage details', 'Marriage date and place from the I-751 relationship section.', [
      field('current_marriage_date', 'Date of marriage', 'date', { required: true }),
      field('current_marriage_city', 'City or town of marriage', 'text')
    ]),
    step('i751_marriage_place', 'Marriage state and country', 'State/province and country where the marriage occurred.', [
      field('current_marriage_state', 'State or province of marriage', 'text'),
      field('current_marriage_country', 'Country of marriage', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i751_divorce_or_waiver', 'Waiver or divorce details', 'Complete when this is not a joint living-together filing.', [
      field('i751_waiver_details', 'Divorce, abuse, hardship, death, or separation facts', 'textarea', {
        showWhenAny: [
          { id: 'i751_filing_type', equals: 'Divorce waiver' },
          { id: 'i751_filing_type', equals: 'Abuse or extreme cruelty waiver' },
          { id: 'i751_filing_type', equals: 'Hardship waiver' },
          { id: 'i751_filing_type', equals: 'Death of spouse waiver' },
          { id: 'i751_filing_type', equals: 'Not sure' }
        ]
      })
    ]),

    // I-751 children, addresses, criminal history, evidence, contact.
    step('i751_children', 'Children included', 'List children included as dependents, if any.', [
      field('total_children', 'Number of children included', 'number', { inputmode: 'numeric' }),
      field('children_details', 'Children details', 'textarea', {
        placeholder: 'For each child: full name, A-number if any, DOB, relationship.',
        showWhen: [{ id: 'total_children', gte: 1 }]
      })
    ]),
    step('i751_residence_history', 'Residence history', 'Use this when the case needs a relationship/residence timeline.', [
      addressHistoryField('residence_history', 'Residence history during conditional residence', { entries: 3 })
    ]),
    step('i751_criminal_history', 'Criminal history', 'Any arrest, charge, citation, conviction, or immigration problem needs review.', [
      field('i751_arrested_or_convicted', 'Have you ever been arrested, charged, cited, convicted, or detained?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i751_criminal_history_details', 'Criminal or immigration issue details', 'textarea', {
        showWhenAny: [
          { id: 'i751_arrested_or_convicted', equals: 'Yes' },
          { id: 'i751_arrested_or_convicted', equals: 'Not sure' }
        ]
      })
    ]),
    step('i751_relationship_evidence', 'Relationship evidence', 'Evidence for bona fide marriage or waiver basis.', [
      field('joint_evidence_available', 'Joint evidence available', 'textarea', {
        placeholder: 'Lease, mortgage, taxes, bank accounts, insurance, children, photos, affidavits.'
      })
    ]),
    step('i751_applicant_contact', 'Applicant contact information', 'Phone and email for the signature/contact section.', [
      field('daytime_phone', 'Daytime phone', 'phone', { autocomplete: 'tel' }),
      field('email_address', 'Email address', 'email', { autocomplete: 'email' })
    ]),
    step('i751_interpreter_preparer_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer sections must be completed.', [
      field('has_interpreter', 'Will an interpreter be used for this petition?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this petition for the applicant?', 'radio', { options: ['Yes', 'No'] })
    ])
  ];
}

function i539SpecificSteps() {
  return [
    // I-539 applicant and request.
    step('i539_request_type', 'I-539 request type', 'Start with whether the request is extension, change of status, or reinstatement.', [
      field('i539_request_type', 'Request type', 'select', {
        required: true,
        options: ['Extend stay in current status', 'Change to another status', 'Reinstatement', 'Other or not sure']
      }),
      field('requested_status', 'Requested status', 'text', { required: true, placeholder: 'Example: B-2, F-1, H-4, L-2.' })
    ]),
    step('i539_applicant_name', 'Applicant legal name', 'Enter the applicant name exactly as it should appear on the form.', [
      field('applicant_family_name', 'Family name / last name', 'text', { required: true, autocomplete: 'family-name' }),
      field('applicant_given_name', 'Given name / first name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i539_middle_other_names', 'Middle and other names', 'Leave middle name blank if none. List other names only if used.', [
      field('applicant_middle_name', 'Middle name', 'text', { autocomplete: 'additional-name' }),
      field('other_names_used', 'Other names used, if any', 'textarea')
    ]),
    step('i539_numbers', 'Applicant USCIS numbers', 'Use A-number, USCIS account number, and SSN if available.', [
      field('alien_number', 'A-number, if any', 'text', { autocomplete: 'off', placeholder: '9 digits' }),
      field('uscis_online_account_number', 'USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i539_birth_citizenship', 'Birth and citizenship', 'Date of birth, country of birth, and citizenship/nationality.', [
      field('date_of_birth', 'Date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('country_of_birth', 'Country of birth', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i539_citizenship', 'Citizenship or nationality', 'Country of citizenship or nationality.', [
      field('country_of_citizenship', 'Country of citizenship or nationality', 'select', { options: COUNTRY_OPTIONS }),
      field('sex', 'Sex', 'radio', { options: ['Male', 'Female'] })
    ]),

    // I-539 address, status, and travel document.
    step('i539_mailing_address', 'Mailing address', 'Complete applicant mailing address as a structured block.', [
      addressBlockField('mailing_address', 'Mailing address', 'mailing', { required: true })
    ]),
    step('i539_physical_address_match', 'Physical address', 'USCIS asks whether physical address is the same as mailing.', [
      field('physical_same_as_mailing', 'Is your physical address the same as mailing address?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      })
    ]),
    step('i539_physical_address', 'Physical address details', 'Complete only if physical address differs from mailing.', [
      addressBlockField('physical_address', 'Physical address', 'physical', {
        showWhen: [{ id: 'physical_same_as_mailing', equals: 'No' }]
      })
    ]),
    step('i539_current_status', 'Current status and I-94', 'Current nonimmigrant status and I-94 details.', [
      field('current_nonimmigrant_status', 'Current nonimmigrant status', 'text', { required: true }),
      field('i94_number', 'I-94 number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i539_i94_dates', 'Entry and expiration dates', 'Use dates from the I-94 and passport records.', [
      field('last_arrival_date', 'Most recent U.S. arrival date', 'date'),
      field('current_i94_expiration', 'Current I-94 expiration date', 'date')
    ]),
    step('i539_passport', 'Passport or travel document', 'Passport number, issuing country, and expiration.', [
      field('passport_number', 'Passport number', 'text', { autocomplete: 'off' }),
      field('passport_country_of_issuance', 'Country that issued passport', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i539_passport_expiration', 'Passport expiration', 'Expiration date from the passport or travel document.', [
      field('passport_expiration', 'Passport expiration date', 'date')
    ]),

    // I-539 dependents and explanations.
    step('i539_dependents', 'Dependents', 'I-539 may include dependents on I-539A.', [
      field('dependents_included', 'Are dependents included?', 'radio', { options: ['Yes', 'No'] }),
      field('i539_dependents_details', 'Dependent names, DOBs, status, and relationship', 'textarea', {
        showWhen: [{ id: 'dependents_included', equals: 'Yes' }]
      })
    ]),
    step('i539_reason', 'Reason for extension or change', 'Explain the requested extension/change in factual terms.', [
      field('reason_for_extension_or_change', 'Reason for extension or change', 'textarea', { required: true })
    ]),
    step('i539_maintenance_of_status', 'Maintenance of status', 'Facts and documents showing the applicant has maintained status.', [
      field('i539_status_maintenance_details', 'How have you maintained current status?', 'textarea'),
      field('i539_status_documents_available', 'Status documents available', 'checkboxes', {
        options: ['I-94', 'Passport', 'Visa', 'Approval notice', 'Pay stubs', 'School records', 'Other']
      })
    ]),
    step('i539_public_benefits_criminal', 'Public benefits and criminal history', 'Any Yes or unsure answer needs document review.', [
      field('i539_public_benefits_received', 'Have you received public benefits that must be disclosed?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i539_public_benefits_details', 'Public benefits details', 'textarea', {
        showWhenAny: [
          { id: 'i539_public_benefits_received', equals: 'Yes' },
          { id: 'i539_public_benefits_received', equals: 'Not sure' }
        ]
      }),
      field('i539_arrested_or_convicted', 'Have you ever been arrested, charged, cited, convicted, or detained?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i539_criminal_history_details', 'Criminal history details and documents', 'textarea', {
        showWhenAny: [
          { id: 'i539_arrested_or_convicted', equals: 'Yes' },
          { id: 'i539_arrested_or_convicted', equals: 'Not sure' }
        ]
      })
    ]),
    step('i539_contact', 'Applicant contact information', 'Phone and email for the signature/contact section.', [
      field('daytime_phone', 'Daytime phone', 'phone', { autocomplete: 'tel' }),
      field('email_address', 'Email address', 'email', { autocomplete: 'email' })
    ]),
    step('i539_interpreter_preparer_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer sections must be completed.', [
      field('has_interpreter', 'Will an interpreter be used for this application?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this application for the applicant?', 'radio', { options: ['Yes', 'No'] })
    ])
  ];
}

function i821SpecificSteps() {
  return [
    step('i821_tps_request_type', 'TPS request type', 'Start with TPS country and initial/re-registration selection.', [
      field('tps_country', 'TPS country designation', 'select', { required: true, options: COUNTRY_OPTIONS }),
      field('initial_or_reregistration', 'Initial TPS or re-registration?', 'select', {
        required: true,
        options: ['Initial TPS', 'Re-registration', 'Late initial filing', 'Not sure']
      })
    ]),
    step('i821_applicant_name', 'Applicant legal name', 'Enter the applicant name exactly as it should appear on Form I-821.', [
      field('applicant_family_name', 'Family name / last name', 'text', { required: true, autocomplete: 'family-name' }),
      field('applicant_given_name', 'Given name / first name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i821_middle_other_names', 'Middle and other names', 'Leave middle name blank if none. List prior names only if used.', [
      field('applicant_middle_name', 'Middle name', 'text', { autocomplete: 'additional-name' }),
      field('other_names_used', 'Other names used, if any', 'textarea')
    ]),
    step('i821_numbers', 'Applicant USCIS numbers', 'A-number, USCIS account number, and SSN if available.', [
      field('alien_number', 'A-number, if any', 'text', { autocomplete: 'off', placeholder: '9 digits' }),
      field('uscis_online_account_number', 'USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i821_birth_citizenship', 'Birth and citizenship', 'Date of birth, country of birth, and citizenship/nationality.', [
      field('date_of_birth', 'Date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('country_of_birth', 'Country of birth', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i821_citizenship_identity', 'Citizenship and identity', 'Country of citizenship and identity details.', [
      field('country_of_citizenship', 'Country of citizenship or nationality', 'select', { options: COUNTRY_OPTIONS }),
      field('sex', 'Sex', 'radio', { options: ['Male', 'Female'] })
    ]),
    step('i821_mailing_address', 'Mailing address', 'Complete mailing address as a structured block.', [
      addressBlockField('mailing_address', 'Mailing address', 'mailing', { required: true })
    ]),
    step('i821_physical_address_match', 'Physical address', 'USCIS asks whether physical address is the same as mailing.', [
      field('physical_same_as_mailing', 'Is your physical address the same as mailing address?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      })
    ]),
    step('i821_physical_address', 'Physical address details', 'Complete only if physical address differs from mailing.', [
      addressBlockField('physical_address', 'Physical address', 'physical', {
        showWhen: [{ id: 'physical_same_as_mailing', equals: 'No' }]
      })
    ]),
    step('i821_contact', 'Applicant contact information', 'Phone and email for contact and signature sections.', [
      field('daytime_phone', 'Daytime phone', 'phone', { autocomplete: 'tel' }),
      field('email_address', 'Email address', 'email', { autocomplete: 'email' })
    ]),
    step('i821_entry_status', 'Entry and current status', 'Most recent entry, I-94, and current immigration status.', [
      field('last_arrival_date', 'Most recent U.S. arrival date', 'date'),
      field('current_immigration_status', 'Current immigration status', 'text')
    ]),
    step('i821_i94_passport', 'I-94 and passport', 'I-94 and passport/travel document details.', [
      field('i94_number', 'I-94 number, if any', 'text', { autocomplete: 'off' }),
      field('passport_number', 'Passport number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i821_tps_dates', 'TPS residence and physical presence dates', 'Dates required for TPS continuous residence and physical presence.', [
      field('continuous_residence_date', 'Date of continuous residence in the U.S.', 'date'),
      field('continuous_physical_presence_date', 'Date of continuous physical presence in the U.S.', 'date')
    ]),
    step('i821_prior_tps', 'Prior TPS filings', 'Prior TPS approval, denial, withdrawal, or receipt information.', [
      field('tps_prior_approval', 'Prior TPS approval or receipt numbers', 'textarea'),
      field('tps_prior_denial_or_withdrawal', 'Prior TPS denial, withdrawal, or termination details', 'textarea')
    ]),
    step('i821_criminal_security', 'Criminal and security questions', 'Any Yes or unsure answer needs document review.', [
      field('i821_arrested_or_convicted', 'Have you ever been arrested, charged, cited, convicted, or detained?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i821_criminal_history_details', 'Criminal-history details and documents', 'textarea', {
        showWhenAny: [
          { id: 'i821_arrested_or_convicted', equals: 'Yes' },
          { id: 'i821_arrested_or_convicted', equals: 'Not sure' }
        ]
      }),
      field('i821_security_or_persecution_issue', 'Any security, persecution, terrorism, or human-rights issue?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i821_security_issue_details', 'Security, persecution, terrorism, or human-rights details', 'textarea', {
        showWhenAny: [
          { id: 'i821_security_or_persecution_issue', equals: 'Yes' },
          { id: 'i821_security_or_persecution_issue', equals: 'Not sure' }
        ]
      })
    ]),
    step('i821_interpreter_preparer_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer sections must be completed.', [
      field('has_interpreter', 'Will an interpreter be used for this application?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this application for the applicant?', 'radio', { options: ['Yes', 'No'] })
    ])
  ];
}

function i821dSpecificSteps() {
  return [
    step('i821d_request_type', 'DACA request type', 'Start with initial or renewal DACA request type.', [
      field('daca_request_type', 'Request type', 'select', {
        required: true,
        options: ['Renewal', 'Initial', 'Not sure']
      }),
      field('prior_daca_dates', 'Prior DACA approval dates and receipt numbers', 'textarea', {
        showWhen: [{ id: 'daca_request_type', equals: 'Renewal' }]
      })
    ]),
    step('i821d_applicant_name', 'Applicant legal name', 'Enter the applicant name exactly as it should appear on Form I-821D.', [
      field('applicant_family_name', 'Family name / last name', 'text', { required: true, autocomplete: 'family-name' }),
      field('applicant_given_name', 'Given name / first name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i821d_middle_other_names', 'Middle and other names', 'Leave middle name blank if none. List prior names only if used.', [
      field('applicant_middle_name', 'Middle name', 'text', { autocomplete: 'additional-name' }),
      field('other_names_used', 'Other names used, if any', 'textarea')
    ]),
    step('i821d_numbers', 'Applicant USCIS numbers', 'A-number, USCIS account number, and SSN if available.', [
      field('alien_number', 'A-number, if any', 'text', { autocomplete: 'off', placeholder: '9 digits' }),
      field('uscis_online_account_number', 'USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i821d_birth_citizenship', 'Birth and citizenship', 'Date of birth, country of birth, and citizenship/nationality.', [
      field('date_of_birth', 'Date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('country_of_birth', 'Country of birth', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i821d_mailing_address', 'Mailing address', 'Complete mailing address as a structured block.', [
      addressBlockField('mailing_address', 'Mailing address', 'mailing', { required: true })
    ]),
    step('i821d_physical_address_match', 'Physical address', 'USCIS asks whether physical address is the same as mailing.', [
      field('physical_same_as_mailing', 'Is your physical address the same as mailing address?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      })
    ]),
    step('i821d_physical_address', 'Physical address details', 'Complete only if physical address differs from mailing.', [
      addressBlockField('physical_address', 'Physical address', 'physical', {
        showWhen: [{ id: 'physical_same_as_mailing', equals: 'No' }]
      })
    ]),
    step('i821d_contact', 'Applicant contact information', 'Phone and email for contact and signature sections.', [
      field('daytime_phone', 'Daytime phone', 'phone', { autocomplete: 'tel' }),
      field('email_address', 'Email address', 'email', { autocomplete: 'email' })
    ]),
    step('i821d_arrival_before_16', 'Arrival before age 16', 'Core DACA factual timeline question.', [
      field('arrival_before_age_16', 'Did you arrive before age 16?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('date_last_entered_us', 'Date last entered the United States', 'date')
    ]),
    step('i821d_entry_status', 'Entry and status', 'Entry place, I-94, and current status if any.', [
      field('place_entry', 'Place of last entry into the United States', 'text'),
      field('current_immigration_status', 'Current immigration status, if any', 'text')
    ]),
    step('i821d_residence_history', 'Residence history', 'Residence history for the relevant DACA period.', [
      addressHistoryField('residence_history', 'Residence history', { entries: 4, required: true })
    ]),
    step('i821d_education_military', 'Education or military status', 'School, graduation, GED, or military service evidence.', [
      field('education_or_military_status', 'School, GED, graduation, or military status', 'textarea'),
      field('i821d_education_documents_available', 'Education or military documents available', 'checkboxes', {
        options: ['School records', 'Diploma', 'GED certificate', 'Transcript', 'Military records', 'Other']
      })
    ]),
    step('i821d_criminal_history', 'Criminal history', 'Any Yes or unsure answer needs document review.', [
      field('i821d_arrested_or_convicted', 'Have you ever been arrested, charged, cited, convicted, or detained?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('i821d_criminal_history_details', 'Criminal-history details and documents', 'textarea', {
        showWhenAny: [
          { id: 'i821d_arrested_or_convicted', equals: 'Yes' },
          { id: 'i821d_arrested_or_convicted', equals: 'Not sure' }
        ]
      })
    ]),
    step('i821d_interpreter_preparer_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer sections must be completed.', [
      field('has_interpreter', 'Will an interpreter be used for this request?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this request for the applicant?', 'radio', { options: ['Yes', 'No'] })
    ])
  ];
}

function i90SpecificSteps() {
  return [
    // I-90 Part 1, page 1: applicant numbers and name.
    step('i90_numbers', 'I-90 USCIS numbers', 'Start with the A-number and USCIS online account number if available.', [
      field('alien_number', 'A-number', 'text', { required: true, autocomplete: 'off', placeholder: '9 digits' }),
      field('uscis_online_account_number', 'USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i90_legal_name', 'Current legal name', 'Enter the name exactly as it should appear on Form I-90.', [
      field('applicant_family_name', 'Family name / last name', 'text', { required: true, autocomplete: 'family-name' }),
      field('applicant_given_name', 'Given name / first name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('i90_middle_name', 'Middle name', 'If there is no middle name, leave this blank.', [
      field('applicant_middle_name', 'Middle name', 'text', { autocomplete: 'additional-name' })
    ]),
    step('i90_other_names', 'Other names used', 'Prior legal names, maiden names, aliases, or nicknames.', [
      field('other_names_used', 'Other names used', 'textarea')
    ]),

    // I-90 Part 1, pages 1-2: mailing and physical address.
    step('i90_mailing_address', 'Mailing address', 'Complete the mailing address as a structured address block.', [
      addressBlockField('mailing_address', 'Mailing address', 'mailing', { required: true })
    ]),
    step('i90_physical_address_match', 'Physical address', 'USCIS asks whether the physical address is the same as the mailing address.', [
      field('physical_same_as_mailing', 'Is your physical address the same as your mailing address?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      })
    ]),
    step('i90_physical_address', 'Current physical address', 'Complete this only if the physical address is different from the mailing address.', [
      addressBlockField('physical_address', 'Physical address', 'physical', {
        showWhen: [{ id: 'physical_same_as_mailing', equals: 'No' }]
      })
    ]),

    // I-90 Part 1, page 2: birth, identity, and admission.
    step('i90_birth_sex', 'Birth date and sex', 'These fields appear together on page 2.', [
      field('date_of_birth', 'Date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('sex', 'Sex', 'radio', { options: ['Male', 'Female'] })
    ]),
    step('i90_birth_place', 'Place of birth', 'City/town and country of birth.', [
      field('city_of_birth', 'City or town of birth', 'text', { autocomplete: 'off' }),
      field('country_of_birth', 'Country of birth', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('i90_parent_names', 'Parent given names', 'I-90 asks for mother and father given names.', [
      field('mother_given_name', 'Mother given name', 'text', { autocomplete: 'given-name' }),
      field('father_given_name', 'Father given name', 'text', { autocomplete: 'given-name' })
    ]),
    step('i90_ssn_admission', 'SSN and admission details', 'USCIS expects a 9-digit SSN if one exists and the admission date/class from the green card record.', [
      field('ssn', 'Social Security number, if any', 'text', { inputmode: 'numeric', autocomplete: 'off', placeholder: '9 digits', digits: 9, maxLength: 9 }),
      field('class_of_admission', 'Class of admission', 'text', { autocomplete: 'off' })
    ]),
    step('i90_admission_date', 'Admission date', 'Date admitted as a permanent resident or adjusted to permanent resident.', [
      field('date_of_admission', 'Date of admission or adjustment', 'date')
    ]),

    // I-90 Part 2, pages 2-3: application type and reason.
    step('i90_application_type', 'I-90 application type', 'Choose the closest official I-90 Part 2 application type.', [
      field('i90_application_type', 'Application type', 'select', {
        required: true,
        options: [
          'Lawful permanent resident',
          'Permanent resident in commuter status',
          'Conditional permanent resident',
          'Other or not sure'
        ]
      })
    ]),
    step('i90_reason', 'Reason for I-90', 'This is the main Part 2 reason for replacement, renewal, or correction.', [
      field('i90_reason', 'Reason for I-90', 'select', {
        required: true,
        options: [
          'Renew expiring or expired card',
          'Replace lost, stolen, or damaged card',
          'Correct card error',
          'Name or biographic change',
          'Never received card',
          'Card issued but contains DHS error',
          'Other or not sure'
        ]
      })
    ]),
    step('i90_card_details', 'Green card details', 'Use the current or prior green card information when available.', [
      field('green_card_expiration', 'Current green card expiration date', 'date'),
      field('green_card_lost_or_stolen_details', 'If lost, stolen, damaged, or never received, explain what happened', 'textarea', {
        showWhenAny: [
          { id: 'i90_reason', equals: 'Replace lost, stolen, or damaged card' },
          { id: 'i90_reason', equals: 'Never received card' }
        ]
      })
    ]),
    step('i90_correction_details', 'Correction or biographic change', 'Complete only if the card needs a correction or biographic update.', [
      field('biographic_change_details', 'Name, biographic, or DHS error correction details', 'textarea', {
        showWhenAny: [
          { id: 'i90_reason', equals: 'Correct card error' },
          { id: 'i90_reason', equals: 'Name or biographic change' },
          { id: 'i90_reason', equals: 'Card issued but contains DHS error' }
        ]
      })
    ]),
    step('i90_processing_info', 'Prior card processing information', 'Complete if known from the original immigrant visa or adjustment record.', [
      field('i90_visa_or_adjustment_location', 'Location where immigrant visa or adjustment was applied for', 'text'),
      field('i90_card_issued_location', 'Location where immigrant visa or green card was issued', 'text')
    ]),

    // I-90 Part 3-4, page 3: biographic information and accommodations.
    step('i90_biographic_ethnicity_race', 'Ethnicity and race', 'Use the official USCIS biographic options.', [
      field('ethnicity', 'Ethnicity', 'radio', { options: ['Hispanic or Latino', 'Not Hispanic or Latino'] }),
      field('race', 'Race', 'checkboxes', { options: ['American Indian or Alaska Native', 'Asian', 'Black or African American', 'Native Hawaiian or Other Pacific Islander', 'White'] })
    ]),
    step('i90_biographic_body', 'Height and weight', 'Use feet, inches, and pounds.', [
      field('height_feet', 'Height feet', 'select', { options: ['3', '4', '5', '6', '7', '8'] }),
      field('height_inches', 'Height inches', 'select', { options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] })
    ]),
    step('i90_biographic_colors', 'Eye color and hair color', 'Select the closest USCIS option.', [
      field('eye_color', 'Eye color', 'select', { options: ['Black', 'Blue', 'Brown', 'Gray', 'Green', 'Hazel', 'Maroon', 'Pink', 'Unknown'] }),
      field('hair_color', 'Hair color', 'select', { options: ['Bald', 'Black', 'Blond', 'Brown', 'Gray', 'Red', 'Sandy', 'White', 'Unknown'] })
    ]),
    step('i90_accommodations', 'Disability accommodation', 'Complete only if an accommodation is requested.', [
      field('disability_accommodation_needed', 'Do you need a disability accommodation?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('disability_accommodation_details', 'Accommodation details', 'textarea', {
        showWhenAny: [
          { id: 'disability_accommodation_needed', equals: 'Yes' },
          { id: 'disability_accommodation_needed', equals: 'Not sure' }
        ]
      })
    ]),

    // I-90 Part 5 and optional interpreter/preparer sections.
    step('i90_applicant_statement', 'Applicant statement', 'Choose whether the applicant reads English or used an interpreter.', [
      field('applicant_statement', 'Applicant statement', 'radio', {
        options: ['I can read and understand English', 'Interpreter read the application to me']
      }),
      field('applicant_statement_language', 'Language used by interpreter, if any', 'text', {
        showWhen: [{ id: 'applicant_statement', equals: 'Interpreter read the application to me' }]
      })
    ]),
    step('i90_applicant_contact', 'Applicant contact information', 'USCIS phone fields should be captured cleanly for the signature/contact section.', [
      field('daytime_phone', 'Daytime phone', 'phone', { autocomplete: 'tel' }),
      field('mobile_phone', 'Mobile phone, if any', 'phone', { autocomplete: 'tel' })
    ]),
    step('i90_applicant_email', 'Applicant email', 'Use a valid email address if the applicant has one.', [
      field('email_address', 'Email address', 'email', { autocomplete: 'email' })
    ]),
    step('i90_interpreter_preparer_choice', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer sections must be completed.', [
      field('has_interpreter', 'Will an interpreter be used for this application?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this application for the applicant?', 'radio', { options: ['Yes', 'No'] })
    ])
  ];
}

function n400SpecificSteps() {
  return [
    // N-400 Part 1, page 1: eligibility.
    step('n400_eligibility_basis', 'N-400 eligibility basis', 'Start with the exact eligibility basis selected in Part 1.', [
      field('basis_for_naturalization', 'Basis for naturalization', 'select', {
        required: true,
        options: ['5-year permanent resident', '3-year marriage to U.S. citizen', 'Military service', 'Other or not sure']
      }),
      field('alien_number', 'A-number, if any', 'text', { autocomplete: 'off', placeholder: '9 digits' })
    ]),
    step('n400_other_basis', 'Other eligibility basis', 'Complete only when the selected basis is other or not sure.', [
      field('n400_other_basis_explanation', 'Explain the other eligibility basis', 'textarea', {
        showWhen: [{ id: 'basis_for_naturalization', equals: 'Other or not sure' }]
      })
    ]),

    // N-400 Part 2, pages 1-2: names, birth, numbers, and disability accommodation.
    step('n400_legal_name', 'Current legal name', 'Enter the applicant name exactly as shown on current legal documents.', [
      field('applicant_family_name', 'Family name / last name', 'text', { required: true, autocomplete: 'family-name' }),
      field('applicant_given_name', 'Given name / first name', 'text', { required: true, autocomplete: 'given-name' })
    ]),
    step('n400_middle_name', 'Middle name', 'If there is no middle name, leave this blank.', [
      field('applicant_middle_name', 'Middle name', 'text', { autocomplete: 'additional-name' })
    ]),
    step('n400_green_card_name', 'Name exactly as shown on green card', 'Use the permanent resident card name if it differs from the current legal name.', [
      field('green_card_family_name', 'Green card family name', 'text', { autocomplete: 'family-name' }),
      field('green_card_given_name', 'Green card given name', 'text', { autocomplete: 'given-name' })
    ]),
    step('n400_other_names', 'Other names used', 'Prior legal names, maiden names, aliases, or nicknames used.', [
      field('other_names_used', 'Other names used', 'textarea', {
        placeholder: 'If no other names were used, enter N/A only where the office requires it.'
      })
    ]),
    step('n400_name_change', 'Name change request', 'USCIS asks whether the applicant wants to legally change their name.', [
      field('wants_name_change', 'Do you want to legally change your name?', 'radio', { options: ['Yes', 'No'] }),
      field('requested_new_name', 'Requested new legal name', 'text', {
        autocomplete: 'name',
        showWhen: [{ id: 'wants_name_change', equals: 'Yes' }]
      })
    ]),
    step('n400_birth_gender_lpr', 'Birth, gender, and permanent resident date', 'These fields appear together in Part 2.', [
      field('date_of_birth', 'Date of birth', 'date', { required: true, autocomplete: 'bday' }),
      field('green_card_date', 'Date you became a permanent resident', 'date', { required: true })
    ]),
    step('n400_gender_account', 'Gender and USCIS online account', 'Use the form selection and account number if one exists.', [
      field('sex', 'Gender', 'radio', { options: ['Female', 'Male', 'Another gender identity'] }),
      field('uscis_online_account_number', 'USCIS online account number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('n400_birth_citizenship', 'Birthplace and nationality', 'City/state/country of birth and current citizenship or nationality.', [
      field('city_of_birth', 'City or town of birth', 'text', { autocomplete: 'off' }),
      field('state_or_province_of_birth', 'State or province of birth', 'text', { autocomplete: 'off' })
    ]),
    step('n400_birth_country', 'Country of birth and citizenship', 'Select country values from the official country list.', [
      field('country_of_birth', 'Country of birth', 'select', { options: COUNTRY_OPTIONS }),
      field('country_of_citizenship', 'Country of citizenship or nationality', 'select', { options: COUNTRY_OPTIONS })
    ]),
    step('n400_disability_accommodation', 'Disability accommodation', 'Complete this if accommodation is requested for the naturalization process.', [
      field('disability_accommodation_needed', 'Do you need a disability accommodation?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('citizenship_exemptions_needed', 'Accommodation or exemption details', 'textarea', {
        showWhenAny: [
          { id: 'disability_accommodation_needed', equals: 'Yes' },
          { id: 'disability_accommodation_needed', equals: 'Not sure' }
        ]
      })
    ]),
    step('n400_ssn_card', 'Social Security information', 'Capture the SSN and SSA card questions if applicable.', [
      field('has_ssn', 'Has the Social Security Administration ever issued you an SSN?', 'radio', { options: ['Yes', 'No'] }),
      field('ssn', 'Social Security number', 'text', {
        inputmode: 'numeric',
        autocomplete: 'off',
        placeholder: '9 digits',
        showWhen: [{ id: 'has_ssn', equals: 'Yes' }]
      })
    ]),

    // N-400 Part 7-8, page 3: biographic information and residence.
    step('n400_biographic_ethnicity_race', 'Ethnicity and race', 'Use the Part 7 options from the official form.', [
      field('ethnicity', 'Ethnicity', 'radio', { options: ['Hispanic or Latino', 'Not Hispanic or Latino'] }),
      field('race', 'Race', 'checkboxes', { options: ['White', 'Asian', 'Black or African American', 'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander'] })
    ]),
    step('n400_biographic_body', 'Height and weight', 'Use feet, inches, and pounds.', [
      field('height_feet', 'Height feet', 'select', { options: ['3', '4', '5', '6', '7', '8'] }),
      field('height_inches', 'Height inches', 'select', { options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] })
    ]),
    step('n400_biographic_colors', 'Eye color and hair color', 'Select the closest USCIS option.', [
      field('eye_color', 'Eye color', 'select', { options: ['Black', 'Blue', 'Brown', 'Gray', 'Green', 'Hazel', 'Maroon', 'Pink', 'Unknown'] }),
      field('hair_color', 'Hair color', 'select', { options: ['Bald', 'Black', 'Blond', 'Brown', 'Gray', 'Red', 'Sandy', 'White', 'Unknown'] })
    ]),
    step('n400_current_address', 'Current physical address', 'Enter the complete current physical address.', [
      addressBlockField('n400_current_physical_address', 'Current physical address', 'n400_current_physical', { required: true })
    ]),
    step('n400_current_address_dates', 'Current address dates', 'Dates at the current address and mailing-address difference.', [
      field('n400_current_address_from', 'Date you started living at this address', 'date', { required: true }),
      field('physical_same_as_mailing', 'Is your mailing address the same as your physical address?', 'radio', { options: ['Yes', 'No'] })
    ]),
    step('n400_mailing_address', 'Mailing address', 'Complete only if the mailing address is different from the physical address.', [
      addressBlockField('n400_mailing_address', 'Mailing address', 'n400_mailing', {
        showWhen: [{ id: 'physical_same_as_mailing', equals: 'No' }]
      })
    ]),
    step('n400_address_history', 'Address history (last 5 years)', 'List every address from the last 5 years of physical presence in the United States. List most recent first; add more entries as needed.', [
      addressHistoryField('addresses_last_five_years', 'Addresses for the last 5 years', { required: true, entries: 5 })
    ]),

    // N-400 family and work/travel history.
    step('n400_marital_status', 'Marital status', 'Use the current marital status from the N-400 family section.', [
      field('marital_status', 'Marital status', 'select', { options: ['Single, never married', 'Married', 'Divorced', 'Widowed', 'Separated', 'Marriage annulled'] }),
      field('times_married', 'How many times have you been married?', 'number', { inputmode: 'numeric' })
    ]),
    step('n400_spouse_name', 'Current spouse name', 'Complete only if currently married.', [
      field('spouse_family_name', 'Spouse family name', 'text', {
        autocomplete: 'family-name',
        showWhen: [{ id: 'marital_status', equals: 'Married' }]
      }),
      field('spouse_given_name', 'Spouse given name', 'text', {
        autocomplete: 'given-name',
        showWhen: [{ id: 'marital_status', equals: 'Married' }]
      })
    ]),
    step('n400_spouse_citizenship', 'Current spouse citizenship', 'Spouse citizenship and immigration details when applicable.', [
      field('spouse_citizenship_status', 'Spouse citizenship or immigration status', 'select', {
        options: ['U.S. citizen', 'Lawful permanent resident', 'Other', 'Not sure'],
        showWhen: [{ id: 'marital_status', equals: 'Married' }]
      }),
      field('spouse_citizenship_details', 'Spouse citizenship details', 'textarea', {
        showWhen: [{ id: 'marital_status', equals: 'Married' }]
      })
    ]),
    step('n400_children', 'Children', 'Total children and children who should be listed on N-400.', [
      field('total_children', 'Total number of children', 'number', { inputmode: 'numeric' }),
      field('children_details', 'Children details', 'textarea', {
        placeholder: 'For each child: full name, A-number if any, DOB, country of birth, relationship, address.',
        showWhen: [{ id: 'total_children', gte: 1 }]
      })
    ]),
    step('n400_military_service', 'Military service', 'Military service questions appear before employment/trips in the current workflow.', [
      field('military_service', 'Have you ever served in the U.S. Armed Forces?', 'radio', { options: ['Yes', 'No'] }),
      field('military_service_details', 'Military service details', 'textarea', {
        showWhen: [{ id: 'military_service', equals: 'Yes' }]
      })
    ]),
    step('n400_employment_history', 'Employment and school history (last 5 years)', 'List every employer, school, unemployment period, or self-employment over the past 5 years. List most recent first; add more entries as needed.', [
      employmentHistoryField('employment_school_last_five_years', 'Employment or school for the last 5 years', { required: true, entries: 5 })
    ]),
    step('n400_trips_outside_us', 'Trips outside the United States', 'List trips outside the United States during the eligibility period.', [
      field('trips_outside_us', 'Trips outside the U.S. during eligibility period', 'textarea', {
        placeholder: 'For each trip: departure date, return date, countries visited, total days.'
      })
    ]),
    step('n400_long_absence', 'Long absences', 'USCIS asks about long trips and continuous residence.', [
      field('n400_trip_over_six_months', 'Any trip outside the U.S. for 6 months or more?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('n400_trip_over_one_year', 'Any trip outside the U.S. for 1 year or more?', 'radio', {
        options: ['Yes', 'No', 'Not sure'],
        showWhenAny: [
          { id: 'n400_trip_over_six_months', equals: 'Yes' },
          { id: 'n400_trip_over_six_months', equals: 'Not sure' }
        ]
      })
    ]),

    // N-400 Part 9: eligibility and moral character. These are split in form order.
    step('n400_citizenship_voting', 'Citizenship and voting questions', 'Answer the first Part 9 citizenship and voting questions in order.', [
      field('n400_claimed_us_citizen', 'Have you ever claimed to be a U.S. citizen?', 'radio', { options: ['Yes', 'No'] }),
      field('n400_registered_or_voted', 'Have you ever registered to vote or voted in a U.S. election?', 'radio', { options: ['Yes', 'No'] })
    ]),
    step('n400_taxes_support', 'Taxes and support obligations', 'Tax filing and dependent-support questions.', [
      field('n400_failed_to_file_taxes', 'Have you ever failed to file required taxes?', 'radio', { options: ['Yes', 'No'] }),
      field('n400_failed_to_support_dependents', 'Have you ever failed to support dependents or pay alimony?', 'radio', { options: ['Yes', 'No'] })
    ]),
    step('n400_groups_organizations', 'Groups and organizations', 'Membership, association, and organization questions. Additional details are needed for any Yes answer.', [
      field('n400_organization_member', 'Have you ever been a member of or associated with any group, club, party, society, or organization?', 'radio', { options: ['Yes', 'No'] }),
      field('n400_organization_details', 'Organization details if yes', 'textarea', {
        showWhen: [{ id: 'n400_organization_member', equals: 'Yes' }]
      })
    ]),
    step('n400_criminal_history_1', 'Criminal history questions', 'Arrest, citation, charge, conviction, and sentence questions.', [
      field('n400_ever_arrested_cited_charged', 'Have you ever been arrested, cited, charged, or detained?', 'radio', { options: ['Yes', 'No'] }),
      field('n400_ever_convicted_or_pled', 'Have you ever pled guilty to or been convicted of a crime or offense?', 'radio', { options: ['Yes', 'No'] })
    ]),
    // Criminal history follow-up: only ask the catch-all "any other crime" question and the
    // details textarea when at least one arrest/conviction answer was Yes (or Not sure).
    step('n400_criminal_history_2', 'Criminal history details', 'Skipped automatically when no arrest or conviction was reported.', [
      field('n400_criminal_history_other_yes', 'Any other criminal, probation, controlled substance, prostitution, trafficking, or gambling answer is Yes?', 'radio', {
        options: ['Yes', 'No', 'Not sure'],
        showWhenAny: [
          { id: 'n400_ever_arrested_cited_charged', equals: 'Yes' },
          { id: 'n400_ever_convicted_or_pled', equals: 'Yes' }
        ]
      }),
      field('n400_criminal_history_details', 'Criminal-history explanation and documents needed', 'textarea', {
        showWhenAny: [
          { id: 'n400_ever_arrested_cited_charged', equals: 'Yes' },
          { id: 'n400_ever_convicted_or_pled', equals: 'Yes' },
          { id: 'n400_criminal_history_other_yes', equals: 'Yes' },
          { id: 'n400_criminal_history_other_yes', equals: 'Not sure' }
        ]
      })
    ]),
    step('n400_immigration_issues', 'Prior immigration issues', 'Admission, visa, unauthorized work, status violation, and removal questions.', [
      field('n400_denied_admission_or_visa', 'Have you ever been denied admission, a visa, or immigration benefit?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('n400_removal_or_status_problem', 'Have you ever had removal proceedings, a final order, unauthorized work, or status violation?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ]),
    step('n400_security_questions', 'Security and related questions', 'Security, military, Communist Party, persecution, and weapons questions.', [
      field('n400_security_any_yes', 'Is any security, military, weapons, Communist Party, torture, genocide, or persecution answer Yes?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('n400_security_details', 'Security-related explanation if needed', 'textarea', {
        showWhenAny: [
          { id: 'n400_security_any_yes', equals: 'Yes' },
          { id: 'n400_security_any_yes', equals: 'Not sure' }
        ]
      })
    ]),
    step('n400_oath_questions', 'Oath and allegiance questions', 'Answer the oath, Constitution, service, and allegiance questions in Part 9.', [
      field('n400_support_constitution', 'Do you support the Constitution and form of government of the United States?', 'radio', { options: ['Yes', 'No', 'Not sure'] }),
      field('n400_willing_oath_service', 'Are you willing to take the oath and perform required service if required by law?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ]),

    // N-400 statement, contact, interpreter/preparer, and review.
    step('n400_household_contact', 'Household and contact permission', 'Current household and contact-permission questions before signature.', [
      field('n400_household_size', 'Household size', 'number', { inputmode: 'numeric' }),
      field('n400_contact_permission', 'May USCIS contact you by phone or email about this application?', 'radio', { options: ['Yes', 'No'] })
    ]),
    step('n400_applicant_contact', 'Applicant contact information', 'USCIS phone fields should be captured cleanly for Part 10.', [
      field('daytime_phone', 'Daytime phone', 'phone', { autocomplete: 'tel' }),
      field('mobile_phone', 'Mobile phone, if any', 'phone', { autocomplete: 'tel' })
    ]),
    step('n400_applicant_email', 'Applicant email', 'Use a valid email address if the applicant has one.', [
      field('email_address', 'Email address', 'email', { autocomplete: 'email' })
    ]),
    step('n400_statement_interpreter_preparer', 'Interpreter and preparer sections', 'These answers control whether interpreter/preparer sections must be completed.', [
      field('has_interpreter', 'Will an interpreter be used for this application?', 'radio', { options: ['Yes', 'No'] }),
      field('has_preparer', 'Will someone prepare this application for the applicant?', 'radio', { options: ['Yes', 'No'] })
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
  'I-90': i90SpecificSteps(),
  'I-130': i130SpecificSteps(),
  'I-130A': i130aSpecificSteps(),
  'I-131': i131SpecificSteps(),
  'I-485': [
    step('adjustment_basis', 'Adjustment of status basis', 'Start with the exact basis shown by the official I-485 category.', [
      field('adjustment_basis', 'Basis for adjustment', 'select', {
        required: true,
        options: ['Family petition', 'Employment petition', 'Diversity visa', 'Asylee or refugee', 'VAWA / special immigrant', 'Other or not sure']
      })
    ]),
    step('i485_related_petition', 'Related petition or sponsor', 'If there is an underlying petition, receipt, employer, or sponsor, capture it here.', [
      field('petitioner_or_sponsor', 'Petitioner, employer, or sponsor name', 'text', { autocomplete: 'organization' }),
      field('underlying_receipt_number', 'Underlying petition receipt number, if any', 'text', { autocomplete: 'off' })
    ]),
    step('i485_location_status', 'Physical presence and last admission', 'These two answers drive conditional questions for entry and eligibility.', [
      field('inside_us_now', 'Are you physically inside the United States now?', 'radio', { required: true, options: ['Yes', 'No'] }),
      field('inspection_or_parole', 'Last entry was inspected, admitted, or paroled?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ]),
    step('i485_medical_exam', 'Medical exam I-693', 'Confirm whether the medical exam is ready or will be handled later.', [
      field('medical_exam_status', 'Medical exam I-693 status', 'select', { options: ['Already completed', 'Need to schedule', 'Will submit later if allowed', 'Not sure'] })
    ]),
    ...i485CoreSteps(),
    ...buildI485Part9Steps(field, step)
  ],
  'I-539': i539SpecificSteps(),
  'I-589': i589SpecificSteps(),
  'I-751': i751SpecificSteps(),
  'I-765': [
    step('i765_application_reason', 'I-765 reason for applying', 'Part 1 of Form I-765: select only one reason for applying.', [
      field('i765_application_reason', 'Reason for applying on I-765', 'select', {
        required: true,
        options: ['Initial permission to accept employment', 'Replacement of lost, stolen, or damaged EAD', 'Renewal of permission to accept employment']
      })
    ]),
    step('i765_work_permit_basis', 'I-765 work permit basis', 'Select the closest basis. We verify the exact eligibility category before preparing the form.', [
      field('ead_basis', 'What is the work permit based on?', 'select', {
        required: true,
        options: ['Pending green card / adjustment of status', 'Pending asylum (c)(8)', 'Granted asylum (a)(5)', 'TPS', 'DACA', 'Student category', 'Parole or humanitarian category', 'Other or not sure']
      })
    ]),
    step('i765_eligibility_category', 'I-765 eligibility category', 'Use the exact category code that belongs in Item 27. Do not guess.', [
      field('eligibility_category_code', 'Eligibility category code, if known', 'text', { placeholder: 'Example: (c)(9), (c)(8), (a)(12)' }),
      field('c8_arrested_or_convicted', 'For category (c)(8), have you ever been arrested for or convicted of any crime?', 'radio', {
        options: ['Yes', 'No', 'Not sure'],
        showWhenAny: [
          { id: 'ead_basis', equals: 'Pending asylum (c)(8)' },
          { id: 'eligibility_category_code', matches: '\\(?\\s*c\\s*\\)?\\s*\\(?\\s*8\\s*\\)?' }
        ]
      })
    ]),
    step('i765_pending_receipt', 'I-765 related pending case', 'Receipt numbers are needed only for categories that depend on a pending case.', [
      field('pending_application_receipt', 'Related pending application receipt number, if any', 'text', {
        autocomplete: 'off',
        showWhenAny: [
          { id: 'ead_basis', in: ['Pending green card / adjustment of status', 'Pending asylum (c)(8)', 'TPS', 'DACA'] },
          { id: 'eligibility_category_code', matches: '\\(?\\s*c\\s*\\)?\\s*\\(?\\s*(?:8|9|19|33)\\s*\\)?' },
          { id: 'eligibility_category_code', matches: '\\(?\\s*a\\s*\\)?\\s*\\(?\\s*12\\s*\\)?' }
        ]
      })
    ]),
    step('i765_prior_ead', 'I-765 prior EAD', 'Confirm whether the applicant had an EAD before.', [
      field('prior_ead', 'Have you had an EAD before?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ]),
    step('i765_social_security', 'I-765 Social Security', 'SSN must be exactly 9 digits if one was issued.', [
      field('has_ssn', 'Has the Social Security Administration ever issued you an SSN?', 'radio', {
        required: true,
        options: ['Yes', 'No']
      }),
      field('ssn', 'Social Security number', 'text', {
        inputmode: 'numeric',
        autocomplete: 'off',
        placeholder: '9 digits',
        digits: 9,
        maxLength: 9,
        showWhen: [{ id: 'has_ssn', equals: 'Yes' }]
      })
    ]),
    step('i765_applicant_statement', 'I-765 applicant statement', 'Part 3 of Form I-765: applicant statement and interpreter/preparer routing.', [
      field('applicant_statement', 'Applicant statement', 'radio', {
        required: true,
        options: ['I can read and understand English', 'Interpreter read the application to me']
      })
    ])
  ],
  'I-821': i821SpecificSteps(),
  'I-821D': i821dSpecificSteps(),
  'I-864': i864SpecificSteps(),
  'I-864A': [
    step('household_member_contract', 'Household member income', 'Details for a household member contributing income.', [
      field('household_member_name', 'Household member full name', 'text', { autocomplete: 'name' }),
      field('relationship_to_sponsor', 'Relationship to sponsor', 'text'),
      field('household_member_income', 'Household member current annual income', 'text', { inputmode: 'decimal' }),
      field('proof_of_residence_available', 'Proof of same residence or household relationship available?', 'radio', { options: ['Yes', 'No', 'Not sure'] })
    ])
  ],
  'I-912': i912SpecificSteps(),
  'N-400': n400SpecificSteps(),
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

function uniqueSteps(steps) {
  const seen = new Set();
  return steps.filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function stepsById(...groups) {
  const map = new Map();
  groups.flat().forEach((item) => {
    if (item?.id && !map.has(item.id)) map.set(item.id, item);
  });
  return map;
}

function orderedSteps(map, ids) {
  return ids.map((id) => map.get(id)).filter(Boolean);
}

const I485_STEP_META = {
  applicant: ['Part 1', 'Page 1'],
  applicant_name_parts: ['Part 1', 'Page 1'],
  applicant_other_names: ['Part 1', 'Page 1'],
  applicant_birth_date: ['Part 1', 'Page 1'],
  applicant_birth_place: ['Part 1', 'Page 1'],
  applicant_birth_country: ['Part 1', 'Page 2'],
  applicant_citizenship: ['Part 1', 'Page 2'],
  applicant_sex_marital: ['Part 1', 'Page 2'],
  applicant_uscis_numbers: ['Part 1', 'Page 2'],
  immigration_passport: ['Part 1', 'Page 2'],
  immigration_passport_expiration: ['Part 1', 'Page 2'],
  immigration_entry_record: ['Part 1', 'Page 2'],
  i485_last_entry_type: ['Part 1', 'Page 2'],
  i485_parole_details: ['Part 1', 'Page 2'],
  i485_i94_status: ['Part 1', 'Page 3'],
  i485_status_expiration: ['Part 1', 'Page 3'],
  i485_visa_number: ['Part 1', 'Page 3'],
  address_contact: ['Part 1', 'Page 3'],
  physical_address_match: ['Part 1', 'Page 3'],
  i485_residence_period: ['Part 1', 'Page 3'],
  i485_prior_us_address: ['Part 1', 'Page 4'],
  i485_foreign_address: ['Part 1', 'Page 4'],
  i485_social_security: ['Part 1', 'Page 4'],
  i485_social_security_card: ['Part 1', 'Page 4'],
  adjustment_basis: ['Part 2', 'Page 5'],
  i485_location_status: ['Part 2', 'Page 5'],
  i485_medical_exam: ['Part 2', 'Page 5'],
  i485_petition_filing: ['Part 2', 'Page 5'],
  i485_related_petition: ['Part 2', 'Page 5'],
  i485_petition_person: ['Part 2', 'Page 5'],
  i485_petition_date: ['Part 2', 'Page 6'],
  i485_petition_category: ['Part 2', 'Page 6'],
  i485_eligibility_basis: ['Part 2', 'Page 7'],
  i485_work_status: ['Part 3', 'Page 8'],
  i485_current_work_history: ['Part 3', 'Page 8'],
  i485_foreign_work_history: ['Part 4', 'Page 8'],
  i485_parent1_name: ['Part 5', 'Page 9'],
  i485_parent1_middle_name: ['Part 5', 'Page 9'],
  i485_parent1_birth: ['Part 5', 'Page 9'],
  i485_parent2_current_name: ['Part 5', 'Page 10'],
  i485_parent2_middle_name: ['Part 5', 'Page 10'],
  i485_parent2_birth_name: ['Part 5', 'Page 10'],
  i485_parent2_birth_middle_name: ['Part 5', 'Page 10'],
  i485_parent2_birth: ['Part 5', 'Page 10'],
  i485_marriage_count: ['Part 6', 'Page 10'],
  i485_current_spouse_name: ['Part 6', 'Page 10'],
  i485_current_spouse_number: ['Part 6', 'Page 10'],
  i485_current_spouse_birth: ['Part 6', 'Page 10'],
  i485_current_marriage: ['Part 6', 'Page 10'],
  i485_current_marriage_place: ['Part 6', 'Page 11'],
  i485_prior_spouse_name: ['Part 6', 'Page 11'],
  i485_prior_spouse_birth: ['Part 6', 'Page 11'],
  i485_prior_spouse_citizenship: ['Part 6', 'Page 11'],
  i485_prior_spouse_marriage: ['Part 6', 'Page 11'],
  i485_prior_spouse_marriage_place: ['Part 6', 'Page 11'],
  i485_prior_spouse_end_place: ['Part 6', 'Page 11'],
  i485_prior_spouse_end_country: ['Part 6', 'Page 11'],
  i485_prior_spouse_end_result: ['Part 6', 'Page 11'],
  i485_children_count: ['Part 7', 'Page 12'],
  i485_child1_identity: ['Part 7', 'Page 12'],
  i485_child1_number: ['Part 7', 'Page 12'],
  i485_child1_details: ['Part 7', 'Page 12'],
  i485_child1_relationship: ['Part 7', 'Page 12'],
  i485_biographic_identity: ['Part 8', 'Page 13'],
  i485_biographic_body: ['Part 8', 'Page 13'],
  i485_biographic_weight: ['Part 8', 'Page 13'],
  i485_biographic_colors: ['Part 8', 'Page 13'],
  contact_info: ['Part 10', 'Page 22'],
  documents_interpreter_choice: ['Parts 11-12', 'Pages 22-23'],
  documents_interpreter_preparer_need: ['Parts 11-12', 'Pages 22-23'],
  documents_interpreter: ['Part 11', 'Page 22'],
  documents_interpreter_business: ['Part 11', 'Page 22'],
  documents_preparer: ['Part 12', 'Page 23'],
  documents_preparer_business: ['Part 12', 'Page 23']
};

function annotateI485Steps(steps) {
  return steps.map((item) => {
    if (!item || item.formPart || item.formPage) return item;
    let meta = I485_STEP_META[item.id];
    if (!meta && /^i485_part9_/.test(item.id)) meta = ['Part 9', 'Pages 14-21'];
    if (!meta) return item;
    return { ...item, formPart: meta[0], formPage: meta[1] };
  });
}

function i485OrderedSteps() {
  const commonApplicant = applicantSteps();
  const commonAddress = addressContactSteps();
  const commonImmigration = immigrationHistorySteps();
  const commonEvidence = evidenceSteps();
  const i485Specific = FORM_OVERRIDES['I-485'] || [];
  const map = stepsById(commonApplicant, commonAddress, commonImmigration, commonEvidence, i485Specific);
  const part9Steps = i485Specific.filter((item) => item?.id && /^i485_part9_/.test(item.id));

  const beforePart9 = orderedSteps(map, [
    // Form I-485 Part 1, pages 1-4: information about the applicant.
    'applicant_name_parts',
    'applicant_other_names',
    'applicant_birth_date',
    'applicant_birth_place',
    'applicant_birth_country',
    'applicant_citizenship',
    'applicant_sex_marital',
    'applicant_uscis_numbers',
    'immigration_passport',
    'immigration_passport_expiration',
    'immigration_entry_record',
    'i485_last_entry_type',
    'i485_parole_details',
    'i485_i94_status',
    'i485_status_expiration',
    'i485_visa_number',
    'address_contact',
    'physical_address_match',
    'i485_residence_period',
    'i485_prior_us_address',
    'i485_foreign_address',
    'i485_social_security',
    'i485_social_security_card',

    // Form I-485 Parts 2-4, pages 5-8: adjustment category and work/school facts.
    'adjustment_basis',
    'i485_location_status',
    'i485_medical_exam',
    'i485_petition_filing',
    'i485_related_petition',
    'i485_petition_person',
    'i485_petition_date',
    'i485_petition_category',
    'i485_eligibility_basis',
    'i485_work_status',
    'i485_current_work_history',
    'i485_foreign_work_history',

    // Form I-485 Parts 5-8, pages 9-13: parents, spouse, children, biographic data.
    'i485_parent1_name',
    'i485_parent1_middle_name',
    'i485_parent1_birth',
    'i485_parent2_current_name',
    'i485_parent2_middle_name',
    'i485_parent2_birth_name',
    'i485_parent2_birth_middle_name',
    'i485_parent2_birth',
    'i485_marriage_count',
    'i485_current_spouse_name',
    'i485_current_spouse_number',
    'i485_current_spouse_birth',
    'i485_current_marriage',
    'i485_current_marriage_place',
    'i485_prior_spouse_name',
    'i485_prior_spouse_birth',
    'i485_prior_spouse_citizenship',
    'i485_prior_spouse_marriage',
    'i485_prior_spouse_marriage_place',
    'i485_prior_spouse_end_place',
    'i485_prior_spouse_end_country',
    'i485_prior_spouse_end_result',
    'i485_children_count',
    'i485_child1_identity',
    'i485_child1_number',
    'i485_child1_details',
    'i485_child1_relationship',
    'i485_biographic_identity',
    'i485_biographic_body',
    'i485_biographic_weight',
    'i485_biographic_colors'
  ]);

  const afterPart9 = orderedSteps(map, [
    // Form I-485 Parts 10-13, pages 22-23: contact, interpreter, preparer.
    'contact_info',
    'documents_interpreter_choice',
    'documents_interpreter_preparer_need',
    'documents_interpreter',
    'documents_interpreter_business',
    'documents_preparer',
    'documents_preparer_business',

    // Form I-485 supporting intake / review layer after the official-page sequence.
    'immigration_history',
    'immigration_prior_filings',
    'documents_identity',
    'documents_supporting',
    'documents_translation',
    'documents_notes'
  ]);
  const ordered = [...beforePart9, ...part9Steps, ...afterPart9];

  const orderedIds = new Set(ordered.map((item) => item.id));
  const leftovers = [
    ...i485Specific,
    ...commonApplicant,
    ...commonAddress,
    ...commonImmigration,
    ...commonEvidence
  ].filter((item) => item?.id && !orderedIds.has(item.id));

  return annotateI485Steps(uniqueSteps([...ordered, ...leftovers]));
}

function i765OrderedSteps() {
  const commonApplicant = applicantSteps();
  const commonAddress = addressContactSteps();
  const commonImmigration = immigrationHistorySteps();
  const commonEvidence = evidenceSteps();
  const i765Specific = FORM_OVERRIDES['I-765'] || [];
  const map = stepsById(commonApplicant, commonAddress, commonImmigration, commonEvidence, i765Specific);

  const ordered = orderedSteps(map, [
    // Form I-765 Part 1, page 1.
    'i765_application_reason',

    // Form I-765 Part 2, pages 1-3: information about the applicant.
    'applicant_name_parts',
    'applicant_other_names',
    'address_contact',
    'physical_address_match',
    'applicant_uscis_numbers',
    'i765_social_security',
    'applicant_citizenship',
    'applicant_birth_place',
    'applicant_birth_country',
    'applicant_birth_date',
    'applicant_sex_marital',
    'immigration_entry_record',
    'immigration_passport',
    'immigration_passport_expiration',
    'immigration_history',
    'i765_work_permit_basis',
    'i765_eligibility_category',
    'i765_pending_receipt',
    'i765_prior_ead',

    // Form I-765 Parts 3-5, pages 4-6: statement, contact, interpreter, preparer.
    'i765_applicant_statement',
    'contact_info',
    'documents_interpreter_choice',
    'documents_interpreter_preparer_need',
    'documents_interpreter',
    'documents_interpreter_business',
    'documents_preparer',
    'documents_preparer_business',

    // Supporting intake layer after official-page sequence.
    'immigration_prior_filings',
    'documents_identity',
    'documents_supporting',
    'documents_translation',
    'documents_notes'
  ]);

  const orderedIds = new Set(ordered.map((item) => item.id));
  const leftovers = [
    ...i765Specific,
    ...commonApplicant,
    ...commonAddress,
    ...commonImmigration,
    ...commonEvidence
  ].filter((item) => item?.id && !orderedIds.has(item.id));

  return uniqueSteps([...ordered, ...leftovers]);
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

  const steps = code === 'I-485'
    ? [
      ...i485OrderedSteps(),
      ...purposeSteps(code, title)
    ]
    : code === 'I-765'
      ? [
        ...purposeSteps(code, title),
        ...i765OrderedSteps()
      ]
      : code === 'I-130'
        ? [
          ...purposeSteps(code, title),
          ...i130SpecificSteps(),
          ...evidenceSteps()
        ]
        : code === 'I-130A'
          ? [
            ...purposeSteps(code, title),
            ...i130aSpecificSteps(),
            ...evidenceSteps()
          ]
          : code === 'I-131'
            ? [
              ...purposeSteps(code, title),
              ...i131SpecificSteps(),
              ...evidenceSteps()
            ]
            : code === 'I-90'
              ? [
                ...purposeSteps(code, title),
                ...i90SpecificSteps(),
                ...evidenceSteps()
              ]
              : code === 'I-589'
                ? [
                  ...purposeSteps(code, title),
                  ...i589SpecificSteps(),
                  ...evidenceSteps()
                ]
                : code === 'I-864'
                  ? [
                    ...purposeSteps(code, title),
                    ...i864SpecificSteps(),
                    ...evidenceSteps()
                  ]
                  : code === 'I-912'
                    ? [
                      ...purposeSteps(code, title),
                      ...i912SpecificSteps(),
                      ...evidenceSteps()
                    ]
                    : code === 'I-751'
                      ? [
                        ...purposeSteps(code, title),
                        ...i751SpecificSteps(),
                        ...evidenceSteps()
                      ]
                      : code === 'I-539'
                        ? [
                          ...purposeSteps(code, title),
                          ...i539SpecificSteps(),
                          ...evidenceSteps()
                        ]
                        : code === 'I-821'
                          ? [
                            ...purposeSteps(code, title),
                            ...i821SpecificSteps(),
                            ...evidenceSteps()
                          ]
                          : code === 'I-821D'
                            ? [
                              ...purposeSteps(code, title),
                              ...i821dSpecificSteps(),
                              ...evidenceSteps()
                            ]
                            : code === 'N-400'
                              ? [
                                ...purposeSteps(code, title),
                                ...n400SpecificSteps(),
                                ...evidenceSteps()
                              ]
      : [
      ...purposeSteps(code, title),
      ...groupSpecificSteps(code, entry),
      ...applicantSteps(),
      ...addressContactSteps(),
      ...immigrationHistorySteps(),
      ...evidenceSteps()
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

  const translatedByStepId = (bucket, id) => {
    const values = copy[bucket] || {};
    if (values[id]) return values[id];
    const prefix = Object.keys(values)
      .sort((a, b) => b.length - a.length)
      .find((key) => id.startsWith(`${key}_`));
    return prefix ? values[prefix] : undefined;
  };

  const translated = JSON.parse(JSON.stringify(flow));
  translated.steps = translated.steps.map((item) => ({
    ...item,
    title: translatedByStepId('steps', item.id) || item.title,
    help: translatedByStepId('stepHelp', item.id) || item.help,
    fields: (item.fields || []).map((fieldItem) => ({
      ...fieldItem,
      label: copy.fields?.[fieldItem.id] || fieldItem.label,
      placeholder: copy.placeholders?.[fieldItem.id] || fieldItem.placeholder,
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
