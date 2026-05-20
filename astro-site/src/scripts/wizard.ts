/**
 * Imverica intake wizard — ported verbatim from the legacy index.html
 * IIFE (~2330 lines, 2026-05-19). Wrapped in initIntakeWizard() so the
 * Astro island can call it once the DOM is ready. The wizard's own
 * behaviour stays a closed IIFE; only the surrounding wrapper changed.
 *
 * Hard rule: do NOT rewrite logic in this file during Phase 3. We're
 * lifting the legacy code as-is to avoid regression. Refactor + typing
 * comes in a follow-up after the cutover is stable.
 */
/* eslint-disable */
// @ts-nocheck

declare global {
  interface Window {
    __imvIntakeInit?: boolean;
    openIntakeModal?: (prefill?: string) => void;
    closeIntakeModal?: () => void;
  }
}

export function initIntakeWizard(): void {
  if (window.__imvIntakeInit) return;
  window.__imvIntakeInit = true;

  // ============================================================
  // Begin ported IIFE — verbatim from legacy index.html.
(function () {
  var modal = document.getElementById('intakeModal');
  var card = document.getElementById('intakeCard');
  var title = document.getElementById('intakeTitle');
  var sub = document.getElementById('intakeSub');
  var kicker = document.getElementById('intakeKicker');
  var stepsEl = document.getElementById('intakeSteps');
  var railNote = document.getElementById('intakeRailNote');
  var disclaimer = document.getElementById('intakeDisclaimer');
  var progress = document.getElementById('intakeProgress');
  var progressPercent = document.getElementById('intakeProgressPercent');
  var progressLabelEl = document.getElementById('intakeProgressLabel');
  var processingEl = document.getElementById('intakeProcessing');
  var backBtn = document.getElementById('intakeBack');
  var nextBtn = document.getElementById('intakeNext');
  var langEl = document.getElementById('intakeLang');
  if (!modal || !card) return;

  var state = {
    lang: 'en',
    langManual: false,
    step: 0,
    service: '',
    formCode: '',
    situation: '',
    routeResult: null,
    routeLoading: false,
    routeError: '',
    flowSchema: null,
    flowLoading: false,
    flowError: '',
    formAnswers: {},
    addressSuggestions: {},
    officialForm: null,
    i765: { basis: '', legalName: '', dob: '', address: '', immigrationStatus: '', priorEad: '', evidence: '' },
    contact: { name: '', phone: '', email: '' },
    accountMode: 'guest',
    completed: false,
    savedPayload: null,
    orderId: ''
  };
  var INTAKE_PROGRESS_KEY = 'imvericaIntakeProgressV1';
  var addressSuggestTimer = null;

  function persistIntakeProgress() {
    if (!modal.classList.contains('open') || state.completed) return;
    try {
      localStorage.setItem(INTAKE_PROGRESS_KEY, JSON.stringify({
        updatedAt: new Date().toISOString(),
        lang: state.lang,
        langManual: state.langManual,
        step: state.step,
        service: state.service,
        formCode: state.formCode,
        situation: state.situation,
        routeResult: state.routeResult,
        flowSchema: state.flowSchema,
        formAnswers: state.formAnswers,
        officialForm: state.officialForm,
        i765: state.i765,
        contact: state.contact,
        accountMode: state.accountMode
      }));
    } catch (err) {}
  }

  function restoreIntakeProgress() {
    try {
      var raw = localStorage.getItem(INTAKE_PROGRESS_KEY);
      if (!raw) return false;
      var saved = JSON.parse(raw);
      if (!saved || !saved.formCode && !saved.situation && !saved.service) return false;
      state.lang = saved.lang || state.lang;
      state.langManual = Boolean(saved.langManual);
      state.step = Number.isFinite(Number(saved.step)) ? Number(saved.step) : state.step;
      state.service = saved.service || '';
      state.formCode = saved.formCode || '';
      state.situation = saved.situation || '';
      state.routeResult = saved.routeResult || null;
      state.flowSchema = saved.flowSchema || null;
      state.formAnswers = saved.formAnswers || {};
      state.officialForm = saved.officialForm || null;
      state.i765 = saved.i765 || state.i765;
      state.contact = saved.contact || state.contact;
      state.accountMode = saved.accountMode || state.accountMode || 'guest';
      return true;
    } catch (err) {
      return false;
    }
  }

  // (Multi-country phone dropdown removed — Imverica forms only accept US 10-digit phones now.
  // Kept the data block commented out as reference in case international support comes back.)
  /*
  var PHONE_COUNTRIES_PRIORITY = [
    { code: 'US', name: 'United States', flag: '🇺🇸', dial: '+1',   max: 10 },
    { code: 'CA', name: 'Canada',        flag: '🇨🇦', dial: '+1',   max: 10 },
    { code: 'MX', name: 'Mexico',        flag: '🇲🇽', dial: '+52',  max: 10 },
    { code: 'RU', name: 'Russia',        flag: '🇷🇺', dial: '+7',   max: 10 },
    { code: 'UA', name: 'Ukraine',       flag: '🇺🇦', dial: '+380', max: 9  }
  ];
  var PHONE_COUNTRIES_REST = [
    { code: 'AR', name: 'Argentina',       flag: '🇦🇷', dial: '+54',  max: 11 },
    { code: 'AM', name: 'Armenia',         flag: '🇦🇲', dial: '+374', max: 8  },
    { code: 'AU', name: 'Australia',       flag: '🇦🇺', dial: '+61',  max: 9  },
    { code: 'AT', name: 'Austria',         flag: '🇦🇹', dial: '+43',  max: 13 },
    { code: 'AZ', name: 'Azerbaijan',      flag: '🇦🇿', dial: '+994', max: 9  },
    { code: 'BY', name: 'Belarus',         flag: '🇧🇾', dial: '+375', max: 9  },
    { code: 'BE', name: 'Belgium',         flag: '🇧🇪', dial: '+32',  max: 9  },
    { code: 'BR', name: 'Brazil',          flag: '🇧🇷', dial: '+55',  max: 11 },
    { code: 'BG', name: 'Bulgaria',        flag: '🇧🇬', dial: '+359', max: 9  },
    { code: 'CN', name: 'China',           flag: '🇨🇳', dial: '+86',  max: 11 },
    { code: 'CO', name: 'Colombia',        flag: '🇨🇴', dial: '+57',  max: 10 },
    { code: 'CR', name: 'Costa Rica',      flag: '🇨🇷', dial: '+506', max: 8  },
    { code: 'CU', name: 'Cuba',            flag: '🇨🇺', dial: '+53',  max: 8  },
    { code: 'CZ', name: 'Czech Republic',  flag: '🇨🇿', dial: '+420', max: 9  },
    { code: 'DK', name: 'Denmark',         flag: '🇩🇰', dial: '+45',  max: 8  },
    { code: 'DO', name: 'Dominican Rep.',  flag: '🇩🇴', dial: '+1',   max: 10 },
    { code: 'EC', name: 'Ecuador',         flag: '🇪🇨', dial: '+593', max: 9  },
    { code: 'EG', name: 'Egypt',           flag: '🇪🇬', dial: '+20',  max: 10 },
    { code: 'SV', name: 'El Salvador',     flag: '🇸🇻', dial: '+503', max: 8  },
    { code: 'EE', name: 'Estonia',         flag: '🇪🇪', dial: '+372', max: 8  },
    { code: 'ET', name: 'Ethiopia',        flag: '🇪🇹', dial: '+251', max: 9  },
    { code: 'FI', name: 'Finland',         flag: '🇫🇮', dial: '+358', max: 12 },
    { code: 'FR', name: 'France',          flag: '🇫🇷', dial: '+33',  max: 9  },
    { code: 'GE', name: 'Georgia',         flag: '🇬🇪', dial: '+995', max: 9  },
    { code: 'DE', name: 'Germany',         flag: '🇩🇪', dial: '+49',  max: 13 },
    { code: 'GR', name: 'Greece',          flag: '🇬🇷', dial: '+30',  max: 10 },
    { code: 'GT', name: 'Guatemala',       flag: '🇬🇹', dial: '+502', max: 8  },
    { code: 'HT', name: 'Haiti',           flag: '🇭🇹', dial: '+509', max: 8  },
    { code: 'HN', name: 'Honduras',        flag: '🇭🇳', dial: '+504', max: 8  },
    { code: 'HK', name: 'Hong Kong',       flag: '🇭🇰', dial: '+852', max: 8  },
    { code: 'HU', name: 'Hungary',         flag: '🇭🇺', dial: '+36',  max: 9  },
    { code: 'IS', name: 'Iceland',         flag: '🇮🇸', dial: '+354', max: 7  },
    { code: 'IN', name: 'India',           flag: '🇮🇳', dial: '+91',  max: 10 },
    { code: 'ID', name: 'Indonesia',       flag: '🇮🇩', dial: '+62',  max: 11 },
    { code: 'IR', name: 'Iran',            flag: '🇮🇷', dial: '+98',  max: 10 },
    { code: 'IQ', name: 'Iraq',            flag: '🇮🇶', dial: '+964', max: 10 },
    { code: 'IE', name: 'Ireland',         flag: '🇮🇪', dial: '+353', max: 11 },
    { code: 'IL', name: 'Israel',          flag: '🇮🇱', dial: '+972', max: 9  },
    { code: 'IT', name: 'Italy',           flag: '🇮🇹', dial: '+39',  max: 11 },
    { code: 'JM', name: 'Jamaica',         flag: '🇯🇲', dial: '+1',   max: 10 },
    { code: 'JP', name: 'Japan',           flag: '🇯🇵', dial: '+81',  max: 10 },
    { code: 'KZ', name: 'Kazakhstan',      flag: '🇰🇿', dial: '+7',   max: 10 },
    { code: 'KE', name: 'Kenya',           flag: '🇰🇪', dial: '+254', max: 10 },
    { code: 'KR', name: 'South Korea',     flag: '🇰🇷', dial: '+82',  max: 10 },
    { code: 'KG', name: 'Kyrgyzstan',      flag: '🇰🇬', dial: '+996', max: 9  },
    { code: 'LV', name: 'Latvia',          flag: '🇱🇻', dial: '+371', max: 8  },
    { code: 'LB', name: 'Lebanon',         flag: '🇱🇧', dial: '+961', max: 8  },
    { code: 'LT', name: 'Lithuania',       flag: '🇱🇹', dial: '+370', max: 8  },
    { code: 'MY', name: 'Malaysia',        flag: '🇲🇾', dial: '+60',  max: 10 },
    { code: 'MD', name: 'Moldova',         flag: '🇲🇩', dial: '+373', max: 8  },
    { code: 'MN', name: 'Mongolia',        flag: '🇲🇳', dial: '+976', max: 8  },
    { code: 'MA', name: 'Morocco',         flag: '🇲🇦', dial: '+212', max: 9  },
    { code: 'NL', name: 'Netherlands',     flag: '🇳🇱', dial: '+31',  max: 9  },
    { code: 'NZ', name: 'New Zealand',     flag: '🇳🇿', dial: '+64',  max: 10 },
    { code: 'NI', name: 'Nicaragua',       flag: '🇳🇮', dial: '+505', max: 8  },
    { code: 'NG', name: 'Nigeria',         flag: '🇳🇬', dial: '+234', max: 10 },
    { code: 'NO', name: 'Norway',          flag: '🇳🇴', dial: '+47',  max: 8  },
    { code: 'PK', name: 'Pakistan',        flag: '🇵🇰', dial: '+92',  max: 10 },
    { code: 'PA', name: 'Panama',          flag: '🇵🇦', dial: '+507', max: 8  },
    { code: 'PY', name: 'Paraguay',        flag: '🇵🇾', dial: '+595', max: 9  },
    { code: 'PE', name: 'Peru',            flag: '🇵🇪', dial: '+51',  max: 9  },
    { code: 'PH', name: 'Philippines',     flag: '🇵🇭', dial: '+63',  max: 10 },
    { code: 'PL', name: 'Poland',          flag: '🇵🇱', dial: '+48',  max: 9  },
    { code: 'PT', name: 'Portugal',        flag: '🇵🇹', dial: '+351', max: 9  },
    { code: 'PR', name: 'Puerto Rico',     flag: '🇵🇷', dial: '+1',   max: 10 },
    { code: 'RO', name: 'Romania',         flag: '🇷🇴', dial: '+40',  max: 9  },
    { code: 'SA', name: 'Saudi Arabia',    flag: '🇸🇦', dial: '+966', max: 9  },
    { code: 'RS', name: 'Serbia',          flag: '🇷🇸', dial: '+381', max: 9  },
    { code: 'SG', name: 'Singapore',       flag: '🇸🇬', dial: '+65',  max: 8  },
    { code: 'SK', name: 'Slovakia',        flag: '🇸🇰', dial: '+421', max: 9  },
    { code: 'SI', name: 'Slovenia',        flag: '🇸🇮', dial: '+386', max: 8  },
    { code: 'ZA', name: 'South Africa',    flag: '🇿🇦', dial: '+27',  max: 9  },
    { code: 'ES', name: 'Spain',           flag: '🇪🇸', dial: '+34',  max: 9  },
    { code: 'SE', name: 'Sweden',          flag: '🇸🇪', dial: '+46',  max: 9  },
    { code: 'CH', name: 'Switzerland',     flag: '🇨🇭', dial: '+41',  max: 9  },
    { code: 'SY', name: 'Syria',           flag: '🇸🇾', dial: '+963', max: 9  },
    { code: 'TW', name: 'Taiwan',          flag: '🇹🇼', dial: '+886', max: 9  },
    { code: 'TJ', name: 'Tajikistan',      flag: '🇹🇯', dial: '+992', max: 9  },
    { code: 'TH', name: 'Thailand',        flag: '🇹🇭', dial: '+66',  max: 9  },
    { code: 'TR', name: 'Turkey',          flag: '🇹🇷', dial: '+90',  max: 10 },
    { code: 'TM', name: 'Turkmenistan',    flag: '🇹🇲', dial: '+993', max: 8  },
    { code: 'AE', name: 'UAE',             flag: '🇦🇪', dial: '+971', max: 9  },
    { code: 'GB', name: 'United Kingdom',  flag: '🇬🇧', dial: '+44',  max: 10 },
    { code: 'UY', name: 'Uruguay',         flag: '🇺🇾', dial: '+598', max: 8  },
    { code: 'UZ', name: 'Uzbekistan',      flag: '🇺🇿', dial: '+998', max: 9  },
    { code: 'VE', name: 'Venezuela',       flag: '🇻🇪', dial: '+58',  max: 10 },
    { code: 'VN', name: 'Vietnam',         flag: '🇻🇳', dial: '+84',  max: 9  }
  ];

  */
  // End of removed phone country list.

  var i18n = {
    en: {
      processing: 'Processing your answers...',
      loadingNext: 'Loading Next Question...',
      progressLabel: 'Progress',
      invalidEmail: 'Please enter a valid email address.',
      submitLead: 'Submit and continue',
      areaCode: 'Area code',
      phoneNumber: 'Number',
      kicker: 'Step-by-step application',
      title: 'Start document preparation',
      sub: 'Answer a few questions. We will identify possible forms, prepare documents at your direction, and confirm fees before filing anything.',
      rail: 'You can pause and continue later. Imverica is not a law firm and does not provide legal advice.',
      steps: ['Language', 'Document type', 'Details', 'Review', 'Account & payment'],
      qLanguage: 'Choose your preferred language',
      hLanguage: 'We support multiple languages from the first screen.',
      qService: 'What do you need prepared?',
      hService: 'Choose the closest category. We can adjust it after reviewing your answers.',
      qDetails: 'Tell us what happened or enter a form number',
      hDetails: 'Use your own words. If you know the form code, include it here.',
      formCodeLabel: 'Form code',
      detailsLabel: 'Details',
      i765BasisQ: 'What is the work permit based on?',
      i765BasisH: 'Select the closest reason. We will verify the correct category before preparing the form.',
      i765ApplicantQ: 'Applicant information',
      i765ApplicantH: 'Enter the name and date of birth exactly as they should appear on the form.',
      i765AddressQ: 'Address and current status',
      i765AddressH: 'These answers help us prepare the work permit application fields.',
      i765EvidenceQ: 'Documents to upload later',
      i765EvidenceH: 'Tell us what documents you already have. You can upload files after account/guest checkout.',
      basisPendingAos: 'Pending green card / adjustment of status',
      basisAsylum: 'Asylum or pending asylum',
      basisTps: 'TPS',
      basisDaca: 'DACA',
      basisOther: 'Other or not sure',
      legalName: 'Legal name', dob: 'Date of birth', address: 'Mailing address', immigrationStatus: 'Current immigration status', priorEad: 'Prior EAD?', evidence: 'Available evidence',
      qContact: 'Who should we contact?',
      hContact: 'We use this to save your request and send the next steps.',
      qAccount: 'How do you want to continue?',
      hAccount: 'Create a client portal account or continue as a guest before payment.',
      name: 'Full name', phone: 'Phone', email: 'Email',
      back: 'Previous', next: 'Next Question', finish: 'Submit and continue', saving: 'Saving securely...',
      guest: 'Continue as guest', guestSub: 'Use phone/email for this order without creating a password.',
      portal: 'Create client portal', portalSub: 'Save drafts, upload documents, and track this order later.',
      sent: 'Application saved. Next step: connect to portal, Stripe checkout, and PDF filling.',
      contactError: 'Please enter a valid full name, phone number, and email address.',
      saveError: 'We could not save this request securely. Please try again or contact us directly.',
      doneTitle: 'Request saved',
      doneHelp: 'We saved your request. Next we confirm the document package and fee, then send a secure payment link before preparing final PDFs.',
      doneReference: 'Reference number',
      doneReferenceSub: 'Keep this number for this request.',
      doneSaved: 'Draft saved',
      doneSavedSub: 'Your answers and contact information are stored for this order.',
      donePayment: 'Payment link requested',
      donePaymentSub: 'A secure payment link is sent after the package and fee are confirmed.',
      donePdf: 'PDF preparation after payment',
      donePdfSub: 'After payment, your answers are reviewed and used to prepare the official PDF forms.',
      reviewTitle: 'Review before payment',
      reviewHelp: 'Check the form, package, required answers, and contact details before saving this request.',
      reviewForm: 'Form',
      reviewPackage: 'Possible package',
      reviewAnswers: 'Answers collected',
      reviewContact: 'Contact',
      generateDraft: 'Generate I-765 draft PDF',
      generatingDraft: 'Generating draft PDF...',
      draftReady: 'I-765 draft PDF generated. Review before filing.',
      draftError: 'Could not generate the I-765 draft PDF yet. Check the required fields or call us.',
      telegram: 'Telegram',
      callOffice: 'Call +1 (916) 399-3992',
      close: 'Close',
      disclaimer: 'Document preparation only. Possible forms may include official USCIS or California court forms. Imverica is not a law firm or attorney and does not provide legal advice.',
      loadingFlow: 'Checking the current official USCIS form and building the questions...',
      flowError: 'We could not load the form-specific questions. You can continue with general details or call us directly.',
      requiredError: 'Please complete the required fields before continuing.',
      officialForm: 'Official form checked',
      cachedFallback: 'Cached PDF fallback available',
      routing: 'Identifying the right document route...',
      routeError: 'We could not identify the exact route automatically. You can continue with the details you entered.',
      historyEntry: 'Entry',
      historyFrom: 'From',
      historyTo: 'To',
      historyPresent: 'Present',
      historyAddress1: 'Street number and name',
      historyAddress2: 'Apt, suite, unit',
      historyCity: 'City',
      historyState: 'State',
      historyZip: 'ZIP',
      historyCountry: 'Country',
      historyEmployerSchool: 'Employer or school',
      historyActivity: 'Work, school, unemployed, other',
      historyOccupation: 'Occupation or role',
      historyAddAddress: 'Add another address',
      historyRemoveAddress: 'Remove',
      historyCoverageWarning: 'Five full years of U.S. residence history may be incomplete. You may add another address or continue if a shorter history applies to this filing.',
      historyAddEntry: 'Add another entry',
      historyRemoveEntry: 'Remove',
      historyWorkCoverageWarning: 'Five full years of work, school, unemployment, or self-employment history may be incomplete. You may add another entry or continue if a shorter history applies to this filing.',
      addressSuggestion: 'Use USPS/local suggested address',
      addressChecking: 'Checking address...',
      services: [
        ['immigration', 'USCIS | EOIR immigration', 'Green card, work permit, citizenship, EOIR documents'],
        ['family', 'California family law', 'Divorce, custody, support, FL-300 and related forms'],
        ['civil', 'Small claims & civil court', 'SC-100, civil complaint, fee waiver, proof of service'],
        ['restraining', 'Restraining orders', 'CH, EA, GV, WV and related court forms'],
        ['ud', 'Unlawful detainer', 'Landlord and tenant document preparation'],
        ['business', 'Business filings', 'LLC, DBA, EIN and entity documents']
      ]
    },
    ru: {
      processing: 'Обрабатываем ваши ответы...',
      loadingNext: 'Загружаем следующий вопрос...',
      progressLabel: 'Прогресс',
      invalidEmail: 'Введите корректный email.',
      submitLead: 'Отправить заявку',
      areaCode: 'Код города',
      phoneNumber: 'Номер телефона',
      kicker: 'Пошаговое оформление',
      title: 'Начать подготовку документов',
      sub: 'Ответьте на несколько вопросов. Мы определим возможные формы, подготовим документы по вашему поручению и подтвердим стоимость до подачи.',
      rail: 'Можно остановиться и продолжить позже. Imverica не является юридической фирмой и не дает юридические консультации.',
      steps: ['Язык', 'Тип документов', 'Детали', 'Проверка', 'Кабинет и оплата'],
      qLanguage: 'Выберите удобный язык',
      hLanguage: 'Выберите удобный язык.',
      qService: 'Какие документы нужно подготовить?',
      hService: 'Выберите ближайшую категорию. Мы сможем уточнить ее после проверки ответов.',
      qDetails: 'Опишите ситуацию или введите номер формы',
      hDetails: 'Пишите своими словами. Если знаете код формы, укажите его здесь.',
      formCodeLabel: 'Код формы',
      detailsLabel: 'Детали',
      i765BasisQ: 'На чем основан work permit?',
      i765BasisH: 'Выберите ближайший вариант. Мы проверим правильную категорию перед подготовкой формы.',
      i765ApplicantQ: 'Данные заявителя',
      i765ApplicantH: 'Введите имя и дату рождения так, как они должны быть в форме.',
      i765AddressQ: 'Адрес и текущий статус',
      i765AddressH: 'Эти ответы нужны для полей заявления на разрешение на работу.',
      i765EvidenceQ: 'Документы для загрузки позже',
      i765EvidenceH: 'Напишите, какие документы уже есть. Файлы можно будет загрузить после кабинета/гостевого оформления.',
      basisPendingAos: 'Pending green card / adjustment of status',
      basisAsylum: 'Asylum или pending asylum',
      basisTps: 'TPS',
      basisDaca: 'DACA',
      basisOther: 'Другое или не знаю',
      legalName: 'Имя по документам', dob: 'Дата рождения', address: 'Почтовый адрес', immigrationStatus: 'Текущий иммиграционный статус', priorEad: 'Был ли EAD раньше?', evidence: 'Какие документы есть',
      qContact: 'С кем связаться?',
      hContact: 'Эти данные нужны, чтобы сохранить запрос и отправить следующие шаги.',
      qAccount: 'Как хотите продолжить?',
      hAccount: 'Создайте личный кабинет или продолжите как гость перед оплатой.',
      name: 'Полное имя', phone: 'Телефон', email: 'Email',
      back: 'Назад', next: 'Следующий вопрос', finish: 'Отправить заявку', saving: 'Безопасно сохраняем...',
      guest: 'Продолжить как гость', guestSub: 'Без пароля, только через телефон/email для этого заказа.',
      portal: 'Создать личный кабинет', portalSub: 'Сохранять черновики, загружать документы и отслеживать заказ.',
      sent: 'Заявка сохранена. Следующий шаг: подключить портал, оплату и заполнение PDF.',
      contactError: 'Введите корректное полное имя, телефон и email.',
      saveError: 'Не удалось безопасно сохранить заявку. Попробуйте еще раз или свяжитесь с нами напрямую.',
      doneTitle: 'Заявка сохранена',
      doneHelp: 'Заявка сохранена. Дальше мы подтверждаем пакет документов и стоимость, затем отправляем безопасную ссылку на оплату перед подготовкой финальных PDF.',
      doneReference: 'Номер заявки',
      doneReferenceSub: 'Сохраните этот номер для этого запроса.',
      doneSaved: 'Черновик сохранен',
      doneSavedSub: 'Ответы и контактные данные сохранены для этого заказа.',
      donePayment: 'Ссылка на оплату запрошена',
      donePaymentSub: 'Безопасная ссылка на оплату отправляется после подтверждения пакета и стоимости.',
      donePdf: 'Подготовка PDF после оплаты',
      donePdfSub: 'После оплаты ответы проверяются и используются для подготовки официальных PDF-форм.',
      reviewTitle: 'Проверка перед оплатой',
      reviewHelp: 'Проверьте форму, пакет, обязательные ответы и контактные данные перед сохранением заявки.',
      reviewForm: 'Форма',
      reviewPackage: 'Возможный пакет',
      reviewAnswers: 'Собранные ответы',
      reviewContact: 'Контакт',
      generateDraft: 'Сгенерировать черновик PDF I-765',
      generatingDraft: 'Генерируем черновик PDF...',
      draftReady: 'Черновик PDF I-765 сгенерирован. Проверьте перед подачей.',
      draftError: 'Пока не удалось сгенерировать черновик PDF I-765. Проверьте обязательные поля или свяжитесь с нами.',
      telegram: 'Telegram',
      callOffice: 'Позвонить +1 (916) 399-3992',
      close: 'Закрыть',
      disclaimer: 'Только подготовка документов. Возможные формы могут включать официальные формы USCIS или California court. Imverica не является юридической фирмой или адвокатом и не дает юридические консультации.',
      loadingFlow: 'Проверяем актуальную форму USCIS и собираем вопросы...',
      flowError: 'Не удалось загрузить вопросы для этой формы. Можно продолжить с общими деталями или связаться с нами напрямую.',
      requiredError: 'Заполните обязательные поля перед продолжением.',
      officialForm: 'Официальная форма проверена',
      cachedFallback: 'Локальная PDF-копия доступна',
      routing: 'Определяем правильный маршрут документов...',
      routeError: 'Не удалось автоматически определить точный маршрут. Можно продолжить с введенными деталями.',
      historyEntry: 'Запись',
      historyFrom: 'С',
      historyTo: 'По',
      historyPresent: 'По настоящее время',
      historyAddress1: 'Номер дома и улица',
      historyAddress2: 'Квартира, suite, unit',
      historyCity: 'Город',
      historyState: 'Штат',
      historyZip: 'ZIP',
      historyCountry: 'Страна',
      historyEmployerSchool: 'Работодатель или учеба',
      historyActivity: 'Работа, учеба, без работы, другое',
      historyOccupation: 'Должность или роль',
      historyAddAddress: 'Добавить еще адрес',
      historyRemoveAddress: 'Удалить',
      historyCoverageWarning: 'Похоже, не хватает полных 5 лет адресов в США. Можно добавить еще адрес или продолжить, если для этой подачи применим более короткий период.',
      historyAddEntry: 'Добавить еще запись',
      historyRemoveEntry: 'Удалить',
      historyWorkCoverageWarning: 'Похоже, не хватает полных 5 лет работы, учебы, безработицы или self-employment. Можно добавить еще запись или продолжить, если для этой подачи применим более короткий период.',
      addressSuggestion: 'Использовать предложенный адрес',
      addressChecking: 'Проверяем адрес...',
      services: [
        ['immigration', 'USCIS | EOIR иммиграция', 'Green card, work permit, citizenship, EOIR документы'],
        ['family', 'Семейное право California', 'Развод, custody, support, FL-300 и связанные формы'],
        ['civil', 'Small claims и civil court', 'SC-100, civil complaint, fee waiver, proof of service'],
        ['restraining', 'Restraining orders', 'CH, EA, GV, WV и связанные формы'],
        ['ud', 'Unlawful detainer', 'Документы landlord/tenant'],
        ['business', 'Business filings', 'LLC, DBA, EIN и entity documents']
      ]
    },
    uk: {
      processing: 'Обробляємо ваші відповіді...',
      loadingNext: 'Завантажуємо наступне питання...',
      progressLabel: 'Прогрес',
      invalidEmail: 'Введіть коректний email.',
      submitLead: 'Надіслати заявку',
      areaCode: 'Код міста',
      phoneNumber: 'Номер телефону',
      kicker: 'Покрокове оформлення',
      title: 'Почати підготовку документів',
      sub: 'Дайте відповіді на кілька питань. Ми визначимо можливі форми, підготуємо документи за вашим дорученням і підтвердимо оплату до подання.',
      rail: 'Можна зупинитися і продовжити пізніше. Imverica не є юридичною фірмою і не надає юридичних консультацій.',
      steps: ['Мова', 'Тип документів', 'Деталі', 'Перевірка', 'Кабінет і оплата'],
      qLanguage: 'Оберіть зручну мову',
      hLanguage: 'Оберіть зручну мову.',
      qService: 'Які документи потрібно підготувати?',
      hService: 'Оберіть найближчу категорію. Ми уточнимо її після перегляду відповідей.',
      qDetails: 'Опишіть ситуацію або введіть номер форми',
      hDetails: 'Пишіть своїми словами. Якщо знаєте код форми, вкажіть його тут.',
      formCodeLabel: 'Код форми',
      detailsLabel: 'Деталі',
      i765BasisQ: 'На чому базується work permit?',
      i765BasisH: 'Оберіть найближчий варіант. Ми перевіримо правильну категорію перед підготовкою форми.',
      i765ApplicantQ: 'Дані заявника',
      i765ApplicantH: 'Введіть ім’я та дату народження так, як вони мають бути у формі.',
      i765AddressQ: 'Адреса і поточний статус',
      i765AddressH: 'Ці відповіді потрібні для полів заяви на дозвіл на роботу.',
      i765EvidenceQ: 'Документи для завантаження пізніше',
      i765EvidenceH: 'Напишіть, які документи вже є. Файли можна буде завантажити після кабінету/гостьового оформлення.',
      basisPendingAos: 'Pending green card / adjustment of status',
      basisAsylum: 'Asylum або pending asylum',
      basisTps: 'TPS',
      basisDaca: 'DACA',
      basisOther: 'Інше або не знаю',
      legalName: 'Ім’я за документами', dob: 'Дата народження', address: 'Поштова адреса', immigrationStatus: 'Поточний імміграційний статус', priorEad: 'Чи був EAD раніше?', evidence: 'Які документи є',
      qContact: 'З ким зв’язатися?',
      hContact: 'Ці дані потрібні, щоб зберегти запит і надіслати наступні кроки.',
      qAccount: 'Як хочете продовжити?',
      hAccount: 'Створіть особистий кабінет або продовжіть як гість перед оплатою.',
      name: 'Повне ім’я', phone: 'Телефон', email: 'Email',
      back: 'Назад', next: 'Наступне питання', finish: 'Надіслати заявку', saving: 'Безпечно зберігаємо...',
      guest: 'Продовжити як гість', guestSub: 'Без пароля, через телефон/email для цього замовлення.',
      portal: 'Створити кабінет', portalSub: 'Зберігати чернетки, завантажувати документи і відстежувати замовлення.',
      sent: 'Заявку збережено. Наступний крок: портал, оплата і заповнення PDF.',
      contactError: 'Введіть коректне повне ім’я, телефон і email.',
      saveError: 'Не вдалося безпечно зберегти заявку. Спробуйте ще раз або зв’яжіться з нами напряму.',
      doneTitle: 'Заявку збережено',
      doneHelp: 'Заявку збережено. Далі ми підтверджуємо пакет документів і вартість, потім надсилаємо безпечне посилання на оплату перед підготовкою фінальних PDF.',
      doneReference: 'Номер заявки',
      doneReferenceSub: 'Збережіть цей номер для цього запиту.',
      doneSaved: 'Чернетку збережено',
      doneSavedSub: 'Відповіді та контактні дані збережено для цього замовлення.',
      donePayment: 'Посилання на оплату запитано',
      donePaymentSub: 'Безпечне посилання на оплату надсилається після підтвердження пакета і вартості.',
      donePdf: 'Підготовка PDF після оплати',
      donePdfSub: 'Після оплати відповіді перевіряються і використовуються для підготовки офіційних PDF-форм.',
      reviewTitle: 'Перевірка перед оплатою',
      reviewHelp: 'Перевірте форму, пакет, обов’язкові відповіді та контактні дані перед збереженням заявки.',
      reviewForm: 'Форма',
      reviewPackage: 'Можливий пакет',
      reviewAnswers: 'Зібрані відповіді',
      reviewContact: 'Контакт',
      generateDraft: 'Згенерувати чернетку PDF I-765',
      generatingDraft: 'Генеруємо чернетку PDF...',
      draftReady: 'Чернетку PDF I-765 згенеровано. Перевірте перед поданням.',
      draftError: 'Поки не вдалося згенерувати чернетку PDF I-765. Перевірте обов’язкові поля або зв’яжіться з нами.',
      telegram: 'Telegram',
      callOffice: 'Зателефонувати +1 (916) 399-3992',
      close: 'Закрити',
      disclaimer: 'Тільки підготовка документів. Можливі форми можуть включати офіційні форми USCIS або California court. Imverica не є юридичною фірмою чи адвокатом і не надає юридичних консультацій.',
      loadingFlow: 'Перевіряємо актуальну форму USCIS і збираємо питання...',
      flowError: 'Не вдалося завантажити питання для цієї форми. Можна продовжити із загальними деталями або зв’язатися з нами напряму.',
      requiredError: 'Заповніть обов’язкові поля перед продовженням.',
      officialForm: 'Офіційну форму перевірено',
      cachedFallback: 'Локальна PDF-копія доступна',
      routing: 'Визначаємо правильний маршрут документів...',
      routeError: 'Не вдалося автоматично визначити точний маршрут. Можна продовжити з введеними деталями.',
      historyEntry: 'Запис',
      historyFrom: 'З',
      historyTo: 'До',
      historyPresent: 'До сьогодні',
      historyAddress1: 'Номер будинку і вулиця',
      historyAddress2: 'Квартира, suite, unit',
      historyCity: 'Місто',
      historyState: 'Штат',
      historyZip: 'ZIP',
      historyCountry: 'Країна',
      historyEmployerSchool: 'Роботодавець або навчання',
      historyActivity: 'Робота, навчання, без роботи, інше',
      historyOccupation: 'Посада або роль',
      historyAddAddress: 'Додати ще адресу',
      historyRemoveAddress: 'Видалити',
      historyCoverageWarning: 'Схоже, бракує повних 5 років адрес у США. Можна додати ще адресу або продовжити, якщо для цієї подачі підходить коротший період.',
      historyAddEntry: 'Додати ще запис',
      historyRemoveEntry: 'Видалити',
      historyWorkCoverageWarning: 'Схоже, бракує повних 5 років роботи, навчання, безробіття або self-employment. Можна додати ще запис або продовжити, якщо для цієї подачі підходить коротший період.',
      addressSuggestion: 'Використати запропоновану адресу',
      addressChecking: 'Перевіряємо адресу...',
      services: [
        ['immigration', 'USCIS | EOIR імміграція', 'Green card, work permit, citizenship, EOIR документи'],
        ['family', 'Сімейне право California', 'Розлучення, custody, support, FL-300 та пов’язані форми'],
        ['civil', 'Small claims і civil court', 'SC-100, civil complaint, fee waiver, proof of service'],
        ['restraining', 'Restraining orders', 'CH, EA, GV, WV та пов’язані форми'],
        ['ud', 'Unlawful detainer', 'Документи landlord/tenant'],
        ['business', 'Business filings', 'LLC, DBA, EIN та entity documents']
      ]
    },
    es: {
      processing: 'Procesando tus respuestas...',
      loadingNext: 'Cargando la siguiente pregunta...',
      progressLabel: 'Progreso',
      invalidEmail: 'Introduce un correo electrónico válido.',
      submitLead: 'Enviar y continuar',
      areaCode: 'Código de área',
      phoneNumber: 'Número de teléfono',
      kicker: 'Solicitud paso a paso',
      title: 'Iniciar preparación de documentos',
      sub: 'Responda algunas preguntas. Identificaremos posibles formularios, prepararemos documentos bajo su dirección y confirmaremos costos antes de presentar nada.',
      rail: 'Puede pausar y continuar después. Imverica no es un bufete de abogados y no brinda asesoría legal.',
      steps: ['Idioma', 'Tipo de documento', 'Detalles', 'Revisión', 'Cuenta y pago'],
      qLanguage: 'Elija su idioma preferido',
      hLanguage: 'Seleccione su idioma.',
      qService: '¿Qué necesita preparar?',
      hService: 'Elija la categoría más cercana. Podemos ajustarla después de revisar sus respuestas.',
      qDetails: 'Cuéntenos qué pasó o ingrese un número de formulario',
      hDetails: 'Use sus propias palabras. Si sabe el código del formulario, inclúyalo aquí.',
      formCodeLabel: 'Código del formulario',
      detailsLabel: 'Detalles',
      i765BasisQ: '¿En qué se basa el permiso de trabajo?',
      i765BasisH: 'Elija la opción más cercana. Verificaremos la categoría correcta antes de preparar el formulario.',
      i765ApplicantQ: 'Información del solicitante',
      i765ApplicantH: 'Ingrese el nombre y fecha de nacimiento tal como deben aparecer en el formulario.',
      i765AddressQ: 'Dirección y estado actual',
      i765AddressH: 'Estas respuestas ayudan a preparar los campos del permiso de trabajo.',
      i765EvidenceQ: 'Documentos para subir después',
      i765EvidenceH: 'Díganos qué documentos ya tiene. Podrá subir archivos después de cuenta/invitado.',
      basisPendingAos: 'Pending green card / adjustment of status',
      basisAsylum: 'Asylum o pending asylum',
      basisTps: 'TPS',
      basisDaca: 'DACA',
      basisOther: 'Otro o no estoy seguro',
      legalName: 'Nombre legal', dob: 'Fecha de nacimiento', address: 'Dirección postal', immigrationStatus: 'Estatus migratorio actual', priorEad: '¿EAD anterior?', evidence: 'Evidencia disponible',
      qContact: '¿A quién debemos contactar?',
      hContact: 'Usamos esto para guardar su solicitud y enviar los próximos pasos.',
      qAccount: '¿Cómo desea continuar?',
      hAccount: 'Cree un portal de cliente o continúe como invitado antes del pago.',
      name: 'Nombre completo', phone: 'Teléfono', email: 'Email',
      back: 'Anterior', next: 'Siguiente pregunta', finish: 'Enviar y continuar', saving: 'Guardando de forma segura...',
      guest: 'Continuar como invitado', guestSub: 'Use teléfono/email para este pedido sin crear contraseña.',
      portal: 'Crear portal de cliente', portalSub: 'Guardar borradores, subir documentos y seguir el pedido.',
      sent: 'Solicitud guardada. Próximo paso: portal, pago y llenado de PDF.',
      contactError: 'Ingrese un nombre completo, teléfono y email válidos.',
      saveError: 'No pudimos guardar esta solicitud de forma segura. Inténtelo de nuevo o contáctenos directamente.',
      doneTitle: 'Solicitud guardada',
      doneHelp: 'Guardamos su solicitud. Luego confirmamos el paquete de documentos y el costo, y enviamos un enlace de pago seguro antes de preparar los PDF finales.',
      doneReference: 'Número de referencia',
      doneReferenceSub: 'Guarde este número para esta solicitud.',
      doneSaved: 'Borrador guardado',
      doneSavedSub: 'Sus respuestas y datos de contacto están guardados para este pedido.',
      donePayment: 'Enlace de pago solicitado',
      donePaymentSub: 'El enlace de pago seguro se envía después de confirmar el paquete y el costo.',
      donePdf: 'Preparación del PDF después del pago',
      donePdfSub: 'Después del pago, sus respuestas se revisan y se usan para preparar los formularios PDF oficiales.',
      reviewTitle: 'Revisión antes del pago',
      reviewHelp: 'Revise el formulario, paquete, respuestas obligatorias y datos de contacto antes de guardar la solicitud.',
      reviewForm: 'Formulario',
      reviewPackage: 'Paquete posible',
      reviewAnswers: 'Respuestas recopiladas',
      reviewContact: 'Contacto',
      generateDraft: 'Generar borrador PDF I-765',
      generatingDraft: 'Generando borrador PDF...',
      draftReady: 'Borrador PDF I-765 generado. Revíselo antes de presentar.',
      draftError: 'Todavía no se pudo generar el borrador PDF I-765. Revise los campos requeridos o llámenos.',
      telegram: 'Telegram',
      callOffice: 'Llamar +1 (916) 399-3992',
      close: 'Cerrar',
      disclaimer: 'Solo preparación de documentos. Los posibles formularios pueden incluir formularios oficiales de USCIS o California court. Imverica no es un bufete ni abogado y no brinda asesoría legal.',
      loadingFlow: 'Verificando el formulario oficial actual de USCIS y creando las preguntas...',
      flowError: 'No pudimos cargar las preguntas específicas del formulario. Puede continuar con detalles generales o llamarnos directamente.',
      requiredError: 'Complete los campos obligatorios antes de continuar.',
      officialForm: 'Formulario oficial verificado',
      cachedFallback: 'Copia PDF local disponible',
      routing: 'Identificando la ruta correcta de documentos...',
      routeError: 'No pudimos identificar la ruta exacta automáticamente. Puede continuar con los detalles ingresados.',
      historyEntry: 'Entrada',
      historyFrom: 'Desde',
      historyTo: 'Hasta',
      historyPresent: 'Presente',
      historyAddress1: 'Número y calle',
      historyAddress2: 'Apt, suite, unit',
      historyCity: 'Ciudad',
      historyState: 'Estado',
      historyZip: 'ZIP',
      historyCountry: 'País',
      historyEmployerSchool: 'Empleador o escuela',
      historyActivity: 'Trabajo, escuela, desempleado, otro',
      historyOccupation: 'Ocupación o rol',
      historyAddAddress: 'Agregar otra dirección',
      historyRemoveAddress: 'Eliminar',
      historyCoverageWarning: 'Es posible que falten los 5 años completos de historial de residencia en EE. UU. Puede agregar otra dirección o continuar si corresponde un período más corto para esta solicitud.',
      historyAddEntry: 'Agregar otra entrada',
      historyRemoveEntry: 'Eliminar',
      historyWorkCoverageWarning: 'Es posible que falten los 5 años completos de trabajo, escuela, desempleo o trabajo por cuenta propia. Puede agregar otra entrada o continuar si corresponde un período más corto para esta solicitud.',
      addressSuggestion: 'Usar dirección sugerida',
      addressChecking: 'Verificando dirección...',
      services: [
        ['immigration', 'USCIS | EOIR inmigración', 'Green card, work permit, citizenship, documentos EOIR'],
        ['family', 'Derecho familiar de California', 'Divorcio, custodia, manutención, FL-300 y relacionados'],
        ['civil', 'Small claims y civil court', 'SC-100, civil complaint, fee waiver, proof of service'],
        ['restraining', 'Restraining orders', 'CH, EA, GV, WV y formularios relacionados'],
        ['ud', 'Unlawful detainer', 'Documentos de landlord/tenant'],
        ['business', 'Business filings', 'LLC, DBA, EIN y documentos de entidad']
      ]
    }
  };

  function t() { return i18n[state.lang] || i18n.en; }
  function esc(value) { return String(value || '').replace(/[&<>"]/g, function (ch) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }); }
  function selectedService() { return (t().services.find(function (item) { return item[0] === state.service; }) || [state.service, state.service || '-', '']); }
  function normalizeFormCode(value) { return String(value || '').trim().toUpperCase().replace(/\s+/g, ' '); }
  function isImmigrationFormCode(value) { return /^(?:I|N|G)-[0-9A-Z]+(?:\s+SUPPLEMENT(?:\s+[A-Z])?)?$/.test(normalizeFormCode(value)) || normalizeFormCode(value) === 'AR-11'; }
  function shouldUseImmigrationFlow() { return state.service === 'immigration' && isImmigrationFormCode(state.formCode || inferIntakeFormCode(state.situation)); }
  function flowStepStart() { return 3; }
  function flowSteps() { return state.flowSchema && Array.isArray(state.flowSchema.steps) ? state.flowSchema.steps : []; }
  function reviewStepIndex() { return flowStepStart() + flowSteps().length; }
  function accountStepIndex() { return reviewStepIndex() + 1; }
  function isFlowStepIndex(index) {
    return state.service === 'immigration' && flowSteps().length && index >= flowStepStart() && index < reviewStepIndex();
  }
  function visibleFieldsForStepIndex(index) {
    var schemaStep = flowSteps()[index - flowStepStart()];
    return schemaStep ? visibleFlowFields(schemaStep) : [];
  }
  function skipEmptyFlowSteps(direction) {
    if (!(state.service === 'immigration' && flowSteps().length)) return;
    var guard = 0;
    while (isFlowStepIndex(state.step) && visibleFieldsForStepIndex(state.step).length === 0 && guard < flowSteps().length) {
      state.step += direction < 0 ? -1 : 1;
      if (state.step < flowStepStart()) {
        state.step = flowStepStart();
        break;
      }
      if (state.step > reviewStepIndex()) {
        state.step = reviewStepIndex();
        break;
      }
      guard += 1;
    }
  }
  function activeSteps() {
    var copy = t();
    if (state.service === 'immigration' && flowSteps().length) {
      return [copy.steps[0], copy.steps[1], copy.steps[2]].concat(flowSteps().map(function (item) {
        return item.title || item.id || copy.qDetails;
      }), [copy.steps[3], copy.steps[4]]);
    }
    return copy.steps;
  }
  function finalStep() { return activeSteps().length - 1; }
  function inferIntakeFormCode(value) {
    var text = normalizeIntakeText(value);
    // Bare numeric / loose form references where the WHOLE input is just the
    // form code (or a code with a prefix letter). Matches "485", "i485",
    // "i 485", "n-400", "g 28" but NOT phrases like "у меня 485 долларов".
    var bare = text.trim().match(/^(?:(i|n|g)[\s._-]*)?(\d{2,4}[a-z]?)$/i);
    if (bare && bare[2]) {
      var prefix = (bare[1] || 'i').toUpperCase();
      return prefix + '-' + bare[2].toUpperCase();
    }
    if (/ворк\s+п[еэ]рмит|work\s+permit|employment authorization|ead|i-765/.test(text)) return 'I-765';
    if (/гринк|грінк|грин[\s-]*карт|грін[\s-]*карт|green[\s-]*card|adjustment|adjust\s*status|i-485|изменени[ея]\s+статус|зміна\s*статус/.test(text)) return 'I-485';
    if (/свадьб|брак|женит|замуж|spouse|marriage|family\s*petition|i-130/.test(text)) return 'I-130';
    if (/трев[еэ]л|travel|advance\s*parole|разрешени[ея]\s+на\s+выезд|i-131/.test(text)) return 'I-131';
    if (/замен[аы]\s+грин|renew\s+green|replace\s+green|i-90/.test(text)) return 'I-90';
    if (/гражданств|citizenship|naturalization|n-400/.test(text)) return 'N-400';
    if (/убежищ|асайл|asylum|i-589/.test(text)) return 'I-589';
    if (/fee\s*waiver|ф[иі]\s*в[еэ]йв[еэ]р|i-912/.test(text)) return 'I-912';
    if (/смол+\s+кле[ий]м|small\s*claims?|sc-100/.test(text)) return 'SC-100';
    if (/ф[иі]\s*в[еэ]йв[еэ]р|fee\s*waiver|fw-001/.test(text)) return 'FW-001';
    if (/рестре[ий]нинг|ристре[ий]нинг|ch-100/.test(text)) return 'CH-100';
    return '';
  }
  function normalizeIntakeText(value) { return String(value || '').toLowerCase(); }
  function detectIntakeLang(value) {
    var text = normalizeIntakeText(value);
    if (/[іїєґ]/i.test(text)) return 'uk';
    if (/[а-яё]/i.test(text)) return 'ru';
    if (/[¿¡áéíóúñ]/i.test(text)) return 'es';
    return '';
  }
  function inferIntakeService(value) {
    var text = normalizeIntakeText(value);
    if (/uscis|eoir|immigration|иммиграц|імміграц|гринк|грінк|грин|грін|green\s*card|ворк\s+п[еэ]рмит|work\s+permit|i-\d+|n-\d+|g-\d+|свадьб|брак|женит|замуж|marriage|spouse|супруг|супруга|чоловік|дружин|убежищ|асайл|asylum|гражданств|громадянств|citizenship/.test(text)) return 'immigration';
    if (/fl-\d+|dv-\d+|divorce|family|custody|развод|розлуч|алим[еє]нт|кастоди|опек|сімейн|семейн/.test(text)) return 'family';
    if (/small\s*claims?|смол+\s+кле[ий]м|мал\w*\s+иск|sc-\d+|civil|complaint|компле[ий]нт|суд/.test(text)) return 'civil';
    if (/restraining|рестре[ий]нинг|ристре[ий]нинг|защитн\w*\s+ордер|ch-\d+|ea-\d+|gv-\d+|wv-\d+|угрож|преслед|harass|stalk/.test(text)) return 'restraining';
    if (/eviction|unlawful|detainer|уд-\d+|ud-\d+|выселен|аренд|tenant|landlord/.test(text)) return 'ud';
    if (/llc|dba|ein|business|бизнес|компан|корпорац/.test(text)) return 'business';
    return '';
  }

  function renderLangButtons() {
    var FLAGS = { en: '🇺🇸', ru: '🇷🇺', uk: '🇺🇦', es: '🇲🇽' };
    var LABELS = { en: 'EN', ru: 'RU', uk: 'UA', es: 'ES' };
    langEl.innerHTML = ['en','ru','uk','es'].map(function (lang) {
      return '<button type="button" class="' + (state.lang === lang ? 'active' : '') + '" data-intake-lang="' + lang + '"><span class="flag">' + FLAGS[lang] + '</span> ' + LABELS[lang] + '</button>';
    }).join('');
  }

  function renderSteps() {
    stepsEl.innerHTML = activeSteps().map(function (label, index) {
      return '<div class="intake-step-dot ' + (index === state.step ? 'active' : '') + '"><span>' + (index + 1) + '</span>' + esc(label) + '</div>';
    }).join('');
  }

  function canGeneratePdfDraft(formCode) {
    return ['I-765', 'I-485'].indexOf(normalizeFormCode(formCode)) !== -1;
  }

  function draftFormText(text) {
    var code = normalizeFormCode(state.formCode);
    return String(text || '').replace(/I-765/g, code || 'PDF');
  }

  function renderCompleted() {
    var copy = t();
    var canGenerateDraft = canGeneratePdfDraft(state.formCode);
    var draftAction = canGenerateDraft
      ? '<button type="button" class="dark" data-generate-pdf-draft>' + esc(draftFormText(copy.generateDraft)) + '</button><div id="intakeDraftStatus" class="intake-draft-status"></div>'
      : '';
    progress.style.width = '100%';
    backBtn.style.display = 'none';
    nextBtn.textContent = copy.close;
    nextBtn.style.display = '';
    card.innerHTML = '<div class="intake-question">' + esc(copy.doneTitle) + '</div><div class="intake-help">' + esc(copy.doneHelp) + '</div>' +
      '<div class="intake-complete-list">' +
        (state.orderId ? '<div class="intake-complete-item"><strong>' + esc(copy.doneReference) + ': ' + esc(state.orderId) + '</strong><span>' + esc(copy.doneReferenceSub) + '</span></div>' : '') +
        '<div class="intake-complete-item"><strong>' + esc(copy.doneSaved) + '</strong><span>' + esc(copy.doneSavedSub) + '</span></div>' +
        '<div class="intake-complete-item"><strong>' + esc(copy.donePayment) + '</strong><span>' + esc(copy.donePaymentSub) + '</span></div>' +
        '<div class="intake-complete-item"><strong>' + esc(copy.donePdf) + '</strong><span>' + esc(copy.donePdfSub) + '</span></div>' +
      '</div>' +
      '<div class="intake-complete-actions">' +
        draftAction +
        '<a class="dark" href="https://t.me/imverica" target="_blank" rel="noopener">' + esc(copy.telegram) + '</a>' +
        '<a href="tel:+19163993992">' + esc(copy.callOffice) + '</a>' +
      '</div>';
  }

  function usesFilePreview() {
    return window.location.protocol === 'file:';
  }

  function immigrationFlowEndpoint(code) {
    var path = '/.netlify/functions/immigration-flow?code=' + encodeURIComponent(code) + '&lang=' + encodeURIComponent(state.lang);
    return usesFilePreview() ? 'https://imverica.com' + path : path;
  }

  function routeEndpoint(query) {
    var path = '/.netlify/functions/route?q=' + encodeURIComponent(query || '');
    return usesFilePreview() ? 'https://imverica.com' + path : path;
  }

  function addressSuggestEndpoint(query) {
    var path = '/.netlify/functions/address-suggest?q=' + encodeURIComponent(query || '');
    return usesFilePreview() ? 'https://imverica.com' + path : path;
  }

  async function loadRoute() {
    var query = [state.formCode, state.situation].filter(Boolean).join(' ').trim();
    if (!query) return false;
    state.routeLoading = true;
    state.routeError = '';
    render();

    try {
      var response = await fetch(routeEndpoint(query), { headers: { 'Accept': 'application/json' } });
      var data = await response.json();
      if (!response.ok || !data.ok || !data.route) throw new Error(data.error || 'Could not route request');
      state.routeResult = data;
      if (data.language && !state.langManual) state.lang = data.language;
      if (data.route.service) state.service = data.route.service;
      if (data.route.formCode) state.formCode = data.route.formCode;
      state.routeLoading = false;
      state.routeError = '';
      return true;
    } catch (err) {
      state.routeLoading = false;
      state.routeError = t().routeError;
      return false;
    }
  }

  async function loadImmigrationFlow() {
    var code = normalizeFormCode(state.formCode || inferIntakeFormCode(state.situation));
    if (!isImmigrationFormCode(code)) return false;
    if (state.flowSchema && normalizeFormCode(state.flowSchema.code) === code) return true;

    state.formCode = code;
    state.service = 'immigration';
    state.flowLoading = true;
    state.flowError = '';
    render();

    try {
      var response = await fetch(immigrationFlowEndpoint(code), { headers: { 'Accept': 'application/json' } });
      var data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load flow');
      state.flowSchema = data;
      state.officialForm = data.official || null;
      state.flowLoading = false;
      state.flowError = '';
      return true;
    } catch (err) {
      state.flowSchema = null;
      state.officialForm = null;
      state.flowLoading = false;
      state.flowError = t().flowError;
      return false;
    }
  }

  function fieldDomId(id) {
    return 'flow_' + String(id || '').replace(/[^A-Za-z0-9_-]/g, '_');
  }

  function fieldValue(field) {
    if (Object.prototype.hasOwnProperty.call(state.formAnswers, field.id)) return state.formAnswers[field.id];
    return field.value || '';
  }

  function attrsForField(field) {
    var attrs = ' id="' + esc(fieldDomId(field.id)) + '" data-flow-field="' + esc(field.id) + '"';
    if (field.required) attrs += ' required';
    if (field.autocomplete) attrs += ' autocomplete="' + esc(field.autocomplete) + '"';
    if (field.inputmode) attrs += ' inputmode="' + esc(field.inputmode) + '"';
    if (field.maxLength) attrs += ' maxlength="' + esc(field.maxLength) + '"';
    if (field.digits) attrs += ' data-flow-digits="' + esc(field.digits) + '"';
    if (field.placeholder) attrs += ' placeholder="' + esc(field.placeholder) + '"';
    return attrs;
  }

  function optionValue(option) {
    if (option && typeof option === 'object') return String(option.value || option.label || '');
    return String(option || '');
  }

  function optionLabel(option) {
    if (option && typeof option === 'object') return String(option.label || option.value || '');
    return String(option || '');
  }

  function optionMatchesValue(option, value) {
    var optionText = optionValue(option);
    var labelText = optionLabel(option);
    var valueText = String(value || '');
    if (optionText === valueText || labelText === valueText) return true;
    var code = optionText.match(/^([A-Z]{2})\s+-\s+/);
    return Boolean(code && code[1] === valueText.toUpperCase());
  }

  function renderSelectOptions(options, value) {
    return (Array.isArray(options) ? options : []).map(function (option) {
      return '<option value="' + esc(optionValue(option)) + '"' + (optionMatchesValue(option, value) ? ' selected' : '') + '>' + esc(optionLabel(option)) + '</option>';
    }).join('');
  }

  function renderStateSelect(name, value, options) {
    return '<select data-history-part="' + esc(name) + '"><option value=""></option>' + renderSelectOptions(options, value) + '</select>';
  }

  function renderCountrySelect(name, value, options) {
    return '<select data-history-part="' + esc(name) + '"><option value=""></option>' + renderSelectOptions(options, value || 'United States') + '</select>';
  }

  function addressPartValue(parts, part, fallback) {
    var key = parts && parts[part];
    if (!key) return fallback || '';
    if (Object.prototype.hasOwnProperty.call(state.formAnswers, key)) return state.formAnswers[key];
    return fallback || '';
  }

  function renderAddressBlockField(field) {
    var copy = t();
    var parts = field.parts || {};
    var stateOptions = field.stateOptions || [];
    var countryOptions = field.countryOptions || [];
    var country = addressPartValue(parts, 'country', field.countryDefault || 'United States');
    var title = esc(field.label) + (field.required ? ' *' : '');
    var help = field.help ? '<div class="intake-help" style="margin:0;">' + esc(field.help) + '</div>' : '';
    function input(part, label, attrs) {
      var key = parts[part] || '';
      var value = addressPartValue(parts, part, '');
      return '<div class="intake-field ' + esc(part) + '"><label>' + esc(label) + '</label><input type="text" data-flow-address-part="' + esc(part) + '" data-flow-address-key="' + esc(key) + '" value="' + esc(value) + '"' + (attrs || '') + '></div>';
    }
    return '<div class="intake-address-block" data-flow-address-block="' + esc(field.id) + '">' +
      '<div class="intake-address-title">' + title + '</div>' +
      help +
      '<div class="intake-address-grid">' +
        '<div class="intake-field wide"><label>' + esc(copy.historyAddress1) + '</label><div class="intake-address-wrap"><input type="text" data-flow-address-part="line1" data-flow-address-key="' + esc(parts.line1 || '') + '" data-address-autocomplete="' + esc(parts.line1 || field.id) + '" data-street-line autocomplete="address-line1" maxlength="48" value="' + esc(addressPartValue(parts, 'line1', '')) + '"><div class="intake-address-suggestions" data-address-suggestions="' + esc(parts.line1 || field.id) + '"></div></div><div class="intake-address-note" data-address-note="' + esc(parts.line1 || field.id) + '"></div></div>' +
        input('line2', copy.historyAddress2, ' autocomplete="address-line2"') +
        input('city', copy.historyCity, ' autocomplete="address-level2"') +
        '<div class="intake-field state"><label>' + esc(copy.historyState) + '</label><select data-flow-address-part="state" data-flow-address-key="' + esc(parts.state || '') + '" autocomplete="address-level1"><option value=""></option>' + renderSelectOptions(stateOptions, addressPartValue(parts, 'state', '')) + '</select></div>' +
        '<div class="intake-field zip"><label>' + esc(copy.historyZip) + '</label><input type="text" data-flow-address-part="zip" data-flow-address-key="' + esc(parts.zip || '') + '" inputmode="numeric" autocomplete="postal-code" value="' + esc(addressPartValue(parts, 'zip', '')) + '"></div>' +
        '<div class="intake-field wide"><label>' + esc(copy.historyCountry) + '</label><select data-flow-address-part="country" data-flow-address-key="' + esc(parts.country || '') + '" autocomplete="country-name"><option value=""></option>' + renderSelectOptions(countryOptions, country) + '</select></div>' +
      '</div>' +
    '</div>';
  }

  function phoneValue(value, field) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return {
        countryCode: value.countryCode || (field && field.countryCodeDefault) || '+1',
        areaCode: value.areaCode || '',
        number: value.number || ''
      };
    }
    var text = String(value || '').trim();
    var digits = text.replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
    return {
      countryCode: /^\+/.test(text) ? (text.match(/^\+\d{1,4}/) || ['+1'])[0] : ((field && field.countryCodeDefault) || '+1'),
      areaCode: digits.length >= 10 ? digits.slice(0, 3) : '',
      number: digits.length >= 10 ? digits.slice(3) : digits
    };
  }

  // Extract US phone digits (always 10) and format as (XXX) XXX-XXXX for display.
  function phoneDigits(value) {
    var d = String(value == null ? '' : value).replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    return d.slice(0, 10);
  }
  function formatUSPhone(value) {
    var d = phoneDigits(value);
    if (d.length === 0) return '';
    if (d.length <= 3) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }

  // A-Number: USCIS uses a 9-digit identifier displayed as "A123-456-789"
  // (or 123-456-789 when no leading A). We capture exactly 9 digits in
  // state but show the user the formatted version while typing. PDF
  // rendering reads the raw digit string and writes one digit per box.
  function aNumberDigits(value) {
    var raw = String(value == null ? '' : value);
    // Strip optional "A" prefix and any non-digits.
    return raw.replace(/^a/i, '').replace(/\D/g, '').slice(0, 9);
  }
  function formatANumber(value) {
    var d = aNumberDigits(value);
    if (d.length === 0) return '';
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  }

  function historyRows(value, count) {
    var rows = Array.isArray(value) ? value.slice() : [];
    while (rows.length < count) rows.push({});
    return rows.slice(0, count);
  }

  function editableHistoryRows(value) {
    var rows = Array.isArray(value) ? value.slice() : [];
    return rows.length ? rows : [{}];
  }

  function historySuggestionId(fieldId, index) {
    return 'history:' + fieldId + ':' + index;
  }

  function renderAddressHistoryField(field) {
    var copy = t();
    var rows = editableHistoryRows(fieldValue(field));
    var options = field.stateOptions || [];
    var countryOptions = field.countryOptions || [];
    var tracksFiveYears = isFiveYearHistoryFieldId(field.id) || /5|five/i.test(String(field.label || ''));
    var warningActive = tracksFiveYears && shouldWarnAddressHistoryCoverage(rows) ? ' active' : '';
    return '<div class="intake-history" data-flow-address-history="' + esc(field.id) + '"' + (tracksFiveYears ? ' data-history-coverage-years="5"' : '') + '>' +
      '<div class="intake-history-title">' + esc(field.label) + (field.required ? ' *' : '') + '</div>' +
      rows.map(function (row, index) {
        var suggestId = historySuggestionId(field.id, index);
        return '<div class="intake-history-entry" data-history-index="' + index + '">' +
          '<h4><span>' + esc(copy.historyEntry) + ' ' + (index + 1) + '</span>' + (rows.length > 1 ? '<button type="button" class="intake-history-remove" data-remove-history-row="' + esc(field.id) + '" data-remove-history-index="' + index + '">' + esc(copy.historyRemoveAddress) + '</button>' : '') + '</h4>' +
          '<div class="intake-field"><label>' + esc(copy.historyFrom) + '</label><input type="date" data-history-part="from" value="' + esc(row.from || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyTo) + '</label><input type="date" data-history-part="to" value="' + esc(row.to || '') + '" placeholder="' + esc(copy.historyPresent) + '"></div>' +
          '<div class="intake-field intake-field-full"><label>' + esc(copy.historyAddress1) + '</label><div class="intake-address-wrap"><input type="text" data-history-part="line1" data-address-autocomplete="' + esc(suggestId) + '" data-street-line autocomplete="address-line1" maxlength="48" value="' + esc(row.line1 || '') + '"><div class="intake-address-suggestions" data-address-suggestions="' + esc(suggestId) + '"></div></div><div class="intake-address-note" data-address-note="' + esc(suggestId) + '"></div></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyAddress2) + '</label><input type="text" data-history-part="line2" autocomplete="address-line2" value="' + esc(row.line2 || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyCity) + '</label><input type="text" data-history-part="city" autocomplete="address-level2" value="' + esc(row.city || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyState) + '</label>' + renderStateSelect('state', row.state || '', options) + '</div>' +
          '<div class="intake-field"><label>' + esc(copy.historyZip) + '</label><input type="text" data-history-part="zip" inputmode="numeric" autocomplete="postal-code" value="' + esc(row.zip || '') + '"></div>' +
          '<div class="intake-field intake-field-full"><label>' + esc(copy.historyCountry) + '</label>' + renderCountrySelect('country', row.country || 'United States', countryOptions) + '</div>' +
        '</div>';
      }).join('') +
      '<div class="intake-history-actions"><button type="button" class="intake-history-add" data-add-history-row="' + esc(field.id) + '">+ ' + esc(copy.historyAddAddress) + '</button></div>' +
      '<div class="intake-history-warning' + warningActive + '" data-history-coverage-warning="' + esc(field.id) + '">' + esc(copy.historyCoverageWarning) + '</div>' +
      '</div>';
  }

  function renderEmploymentHistoryField(field) {
    var copy = t();
    var rows = editableHistoryRows(fieldValue(field));
    var options = field.stateOptions || [];
    var countryOptions = field.countryOptions || [];
    var tracksFiveYears = isFiveYearHistoryFieldId(field.id) || /5|five/i.test(String(field.label || ''));
    var warningActive = tracksFiveYears && shouldWarnAddressHistoryCoverage(rows) ? ' active' : '';
    return '<div class="intake-history" data-flow-employment-history="' + esc(field.id) + '"' + (tracksFiveYears ? ' data-history-coverage-years="5"' : '') + '>' +
      '<div class="intake-history-title">' + esc(field.label) + (field.required ? ' *' : '') + '</div>' +
      rows.map(function (row, index) {
        var suggestId = historySuggestionId(field.id, index);
        return '<div class="intake-history-entry" data-history-index="' + index + '">' +
          '<h4><span>' + esc(copy.historyEntry) + ' ' + (index + 1) + '</span>' + (rows.length > 1 ? '<button type="button" class="intake-history-remove" data-remove-history-row="' + esc(field.id) + '" data-remove-history-index="' + index + '">' + esc(copy.historyRemoveEntry || copy.historyRemoveAddress) + '</button>' : '') + '</h4>' +
          '<div class="intake-field"><label>' + esc(copy.historyFrom) + '</label><input type="date" data-history-part="from" value="' + esc(row.from || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyTo) + '</label><input type="date" data-history-part="to" value="' + esc(row.to || '') + '" placeholder="' + esc(copy.historyPresent) + '"></div>' +
          '<div class="intake-field intake-field-full"><label>' + esc(copy.historyEmployerSchool) + '</label><input type="text" data-history-part="name" autocomplete="organization" value="' + esc(row.name || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyActivity) + '</label><input type="text" data-history-part="activity" value="' + esc(row.activity || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyOccupation) + '</label><input type="text" data-history-part="occupation" value="' + esc(row.occupation || '') + '"></div>' +
          '<div class="intake-field intake-field-full"><label>' + esc(copy.historyAddress1) + '</label><div class="intake-address-wrap"><input type="text" data-history-part="line1" data-address-autocomplete="' + esc(suggestId) + '" data-street-line autocomplete="address-line1" maxlength="48" value="' + esc(row.line1 || '') + '"><div class="intake-address-suggestions" data-address-suggestions="' + esc(suggestId) + '"></div></div><div class="intake-address-note" data-address-note="' + esc(suggestId) + '"></div></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyAddress2) + '</label><input type="text" data-history-part="line2" autocomplete="address-line2" value="' + esc(row.line2 || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyCity) + '</label><input type="text" data-history-part="city" autocomplete="address-level2" value="' + esc(row.city || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyState) + '</label>' + renderStateSelect('state', row.state || '', options) + '</div>' +
          '<div class="intake-field"><label>' + esc(copy.historyZip) + '</label><input type="text" data-history-part="zip" inputmode="numeric" autocomplete="postal-code" value="' + esc(row.zip || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyCountry) + '</label>' + renderCountrySelect('country', row.country || 'United States', countryOptions) + '</div>' +
        '</div>';
      }).join('') +
      '<div class="intake-history-actions"><button type="button" class="intake-history-add" data-add-history-row="' + esc(field.id) + '">+ ' + esc(copy.historyAddEntry || copy.historyAddAddress) + '</button></div>' +
      '<div class="intake-history-warning' + warningActive + '" data-history-coverage-warning="' + esc(field.id) + '">' + esc(copy.historyWorkCoverageWarning || copy.historyCoverageWarning) + '</div>' +
      '</div>';
  }

  function renderTravelHistoryField(field) {
    var copy = t();
    var rows = editableHistoryRows(fieldValue(field));
    var countryOptions = field.countryOptions || [];
    return '<div class="intake-history" data-flow-travel-history="' + esc(field.id) + '">' +
      '<div class="intake-history-title">' + esc(field.label) + (field.required ? ' *' : '') + '</div>' +
      rows.map(function (row, index) {
        return '<div class="intake-history-entry" data-travel-index="' + index + '">' +
          '<h4><span>' + esc(copy.historyEntry) + ' ' + (index + 1) + '</span>' + (rows.length > 1 ? '<button type="button" class="intake-history-remove" data-remove-travel-row="' + esc(field.id) + '" data-remove-travel-index="' + index + '">' + esc(copy.historyRemoveEntry || copy.historyRemoveAddress) + '</button>' : '') + '</h4>' +
          '<div class="intake-field"><label>' + esc(copy.historyFrom) + '</label><input type="date" data-travel-part="from" value="' + esc(row.from || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyTo) + '</label><input type="date" data-travel-part="to" value="' + esc(row.to || '') + '"></div>' +
          '<div class="intake-field"><label>' + esc(copy.historyCountry) + '</label><select data-travel-part="country"><option value=""></option>' + renderSelectOptions(countryOptions, row.country || '') + '</select></div>' +
          '<div class="intake-field"><label>' + esc(copy.travelDays || 'Total days') + '</label><input type="number" min="0" inputmode="numeric" data-travel-part="days" value="' + esc(row.days || '') + '"></div>' +
        '</div>';
      }).join('') +
      '<div class="intake-history-actions"><button type="button" class="intake-history-add" data-add-travel-row="' + esc(field.id) + '">+ ' + esc(copy.travelAddTrip || 'Add another trip') + '</button></div>' +
      '</div>';
  }

  function parseFlexibleHistoryDate(value) {
    var text = String(value || '').trim();
    if (!text) return null;
    var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    var us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    var date = null;
    if (iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (us) date = new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]));
    if (!date || Number.isNaN(date.getTime())) return null;
    return date;
  }

  function isFiveYearHistoryFieldId(fieldId) {
    return /5|five/i.test(String(fieldId || ''));
  }

  function shouldWarnAddressHistoryCoverage(rows) {
    if (!Array.isArray(rows) || !rows.length) return false;
    var datedRows = rows.map(function (row) {
      return {
        from: parseFlexibleHistoryDate(row && row.from),
        to: parseFlexibleHistoryDate(row && row.to) || new Date()
      };
    }).filter(function (row) {
      return row.from && row.to;
    });
    if (!datedRows.length) return false;
    var earliest = datedRows.reduce(function (min, row) { return !min || row.from < min ? row.from : min; }, null);
    var latest = datedRows.reduce(function (max, row) { return !max || row.to > max ? row.to : max; }, null);
    var fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    var recentEnough = latest && latest >= new Date(Date.now() - 1000 * 60 * 60 * 24 * 45);
    return !(earliest && earliest <= fiveYearsAgo && recentEnough);
  }

  function readHistoryRows(group, keepEmpty) {
    return Array.prototype.slice.call(group.querySelectorAll('[data-history-index]')).map(function (row) {
      var item = {};
      row.querySelectorAll('[data-history-part]').forEach(function (input) {
        item[input.getAttribute('data-history-part')] = input.value.trim();
      });
      return item;
    }).filter(function (item) {
      if (keepEmpty) return true;
      return Object.keys(item).some(function (name) { return String(item[name] || '').trim(); });
    });
  }

  function readTravelRows(group, keepEmpty) {
    return Array.prototype.slice.call(group.querySelectorAll('[data-travel-index]')).map(function (row) {
      var item = {};
      row.querySelectorAll('[data-travel-part]').forEach(function (input) {
        item[input.getAttribute('data-travel-part')] = input.value.trim();
      });
      return item;
    }).filter(function (item) {
      if (keepEmpty) return true;
      return Object.keys(item).some(function (name) { return String(item[name] || '').trim(); });
    });
  }

  function refreshAddressHistoryCoverage(group) {
    if (!group || !(group.hasAttribute('data-flow-address-history') || group.hasAttribute('data-flow-employment-history'))) return;
    var warning = group.querySelector('[data-history-coverage-warning]');
    if (!warning || !group.hasAttribute('data-history-coverage-years')) return;
    warning.classList.toggle('active', shouldWarnAddressHistoryCoverage(readHistoryRows(group, false)));
  }

  function renderFlowField(field) {
    var value = fieldValue(field);
    var label = '<label for="' + esc(fieldDomId(field.id)) + '">' + esc(field.label) + (field.required ? ' *' : '') + '</label>';
    var help = field.help ? '<div class="intake-help" style="margin:4px 0 0;">' + esc(field.help) + '</div>' : '';
    var options = Array.isArray(field.options) ? field.options : [];

    if (field.type === 'textarea') {
      return '<div class="intake-field">' + label + '<textarea' + attrsForField(field) + '>' + esc(value) + '</textarea>' + help + '</div>';
    }

    if (field.type === 'select') {
      return '<div class="intake-field">' + label + '<select' + attrsForField(field) + '><option value=""></option>' +
        renderSelectOptions(options, value) + '</select>' + help + '</div>';
    }

    if (field.type === 'radio') {
      var compact = options.length <= 3 ? ' intake-radio-options' : '';
      return '<div class="intake-field" data-flow-radio-group="' + esc(field.id) + '"><label>' + esc(field.label) + (field.required ? ' *' : '') + '</label><div class="intake-options' + compact + '">' +
        options.map(function (option) {
          var optionVal = optionValue(option);
          var checked = optionMatchesValue(option, value) ? ' checked' : '';
          return '<label class="intake-option ' + (checked ? 'active' : '') + '"><input type="radio" name="' + esc(fieldDomId(field.id)) + '" data-flow-radio="' + esc(field.id) + '" value="' + esc(optionVal) + '"' + checked + '><strong>' + esc(optionLabel(option)) + '</strong></label>';
        }).join('') + '</div>' + help + '</div>';
    }

    if (field.type === 'checkboxes') {
      var selected = Array.isArray(value) ? value : String(value || '').split('|').filter(Boolean);
      return '<div class="intake-field" data-flow-checkbox-group="' + esc(field.id) + '"><label>' + esc(field.label) + (field.required ? ' *' : '') + '</label><div class="intake-options intake-checkbox-options">' +
        options.map(function (option) {
          var optionVal = optionValue(option);
          var checked = selected.indexOf(optionVal) !== -1 || selected.indexOf(optionLabel(option)) !== -1 ? ' checked' : '';
          return '<label class="intake-option ' + (checked ? 'active' : '') + '"><input type="checkbox" data-flow-checkbox="' + esc(field.id) + '" value="' + esc(optionVal) + '"' + checked + '><strong>' + esc(optionLabel(option)) + '</strong></label>';
        }).join('') + '</div>' + help + '</div>';
    }

    if (field.type === 'addressAutocomplete') {
      return '<div class="intake-field">' + label + '<div class="intake-address-wrap"><input type="text"' + attrsForField(field) + ' data-address-autocomplete="' + esc(field.id) + '" value="' + esc(value) + '"><div class="intake-address-suggestions" data-address-suggestions="' + esc(field.id) + '"></div></div><div class="intake-address-note" data-address-note="' + esc(field.id) + '"></div>' + help + '</div>';
    }

    if (field.type === 'phone') {
      // Single US phone input. Stores raw digits in state; displays formatted (XXX) XXX-XXXX.
      var rawPhone = typeof value === 'object' && value !== null
        ? String(value.areaCode || '') + String(value.number || '')
        : value;
      var digits = phoneDigits(rawPhone);
      return '<div class="intake-field">' + label +
        '<input type="tel" inputmode="numeric" autocomplete="tel" maxlength="14" data-flow-phone-us="' + esc(field.id) + '" placeholder="(XXX) XXX-XXXX" value="' + esc(formatUSPhone(digits)) + '">' +
        help + '</div>';
    }

    if (field.type === 'addressHistory') return renderAddressHistoryField(field);

    if (field.type === 'employmentHistory') return renderEmploymentHistoryField(field);

    if (field.type === 'travelHistory') return renderTravelHistoryField(field);

    if (field.type === 'addressBlock') return renderAddressBlockField(field);

    // A-number live formatter: any field id matching "*alien_number*" or
    // ending with "_a_number" gets the 123-456-789 display widget. State
    // keeps raw 9 digits so PDF rendering writes one digit per box.
    if (isANumberField(field)) {
      var digits = aNumberDigits(value);
      return '<div class="intake-field">' + label +
        '<input type="text" inputmode="numeric" autocomplete="off" maxlength="11" data-flow-anumber="' + esc(field.id) + '" placeholder="123-456-789" value="' + esc(formatANumber(digits)) + '">' +
        help + '</div>';
    }

    var type = field.type === 'date' || field.type === 'email' || field.type === 'tel' || field.type === 'number' ? field.type : 'text';
    return '<div class="intake-field">' + label + '<input type="' + esc(type) + '"' + attrsForField(field) + ' value="' + esc(value) + '">' + help + '</div>';
  }

  function isANumberField(field) {
    if (!field || !field.id) return false;
    return /(^|_)alien_number(_|$)|(^|_)a_number(_|$)/i.test(field.id);
  }

  function flowConditionMatches(condition) {
    if (!condition || !condition.id) return true;
    var value = state.formAnswers[condition.id];
    if (condition.equals !== undefined) return String(value || '') === String(condition.equals);
    if (condition.notEquals !== undefined) return String(value || '') !== String(condition.notEquals);
    if (condition.includes !== undefined) {
      if (Array.isArray(value)) return value.map(String).includes(String(condition.includes));
      return String(value || '').split(',').map(function (item) { return item.trim(); }).includes(String(condition.includes));
    }
    if (condition.in !== undefined && Array.isArray(condition.in)) {
      return condition.in.map(String).indexOf(String(value || '')) !== -1;
    }
    if (condition.matches !== undefined) {
      try {
        return new RegExp(String(condition.matches), 'i').test(String(value || ''));
      } catch (e) {
        return false;
      }
    }
    if (condition.gte !== undefined) {
      var n = parseFloat(value);
      return !isNaN(n) && n >= Number(condition.gte);
    }
    if (condition.lte !== undefined) {
      var n2 = parseFloat(value);
      return !isNaN(n2) && n2 <= Number(condition.lte);
    }
    if (condition.hasValue) return !isEmptyFlowValue({ type: 'text' }, value);
    return true;
  }

  function isFlowFieldVisible(field) {
    var all = Array.isArray(field.showWhen) ? field.showWhen : [];
    var any = Array.isArray(field.showWhenAny) ? field.showWhenAny : [];
    if (all.length && !all.every(flowConditionMatches)) return false;
    if (any.length && !any.some(flowConditionMatches)) return false;
    return true;
  }

  function visibleFlowFields(schemaStep) {
    return (schemaStep.fields || []).filter(isFlowFieldVisible);
  }

  function renderFlowStep(schemaStep) {
    var copy = t();
    var official = state.officialForm || {};
    var fields = visibleFlowFields(schemaStep);
    var pageLabel = [schemaStep.formPart, schemaStep.formPage].filter(Boolean).join(' · ');
    var pageBadge = pageLabel ? '<div class="intake-form-page">' + esc(pageLabel) + '</div>' : '';
    var gridClass = fields.length <= 1 ? 'intake-grid intake-grid-single' : 'intake-grid';
    var officialNote = '';
    if (schemaStep.id === 'purpose' && official.pdfUrl) {
      officialNote = '<div class="intake-help"><strong>' + esc(copy.officialForm) + ':</strong> ' + esc(official.title || state.formCode) +
        (official.editionDate ? ' · ' + esc(official.editionDate) : '') +
        (official.cachedPdfUrl ? ' · ' + esc(copy.cachedFallback) : '') + '</div>';
    }
    card.innerHTML = pageBadge + '<div class="intake-question">' + esc(schemaStep.title) + '</div><div class="intake-help">' + esc(schemaStep.help || '') + '</div>' + officialNote +
      '<div class="' + gridClass + '">' + fields.map(renderFlowField).join('') + '</div><div id="intakeFlowError" class="intake-error"></div>';
  }

  function filledAnswerCount() {
    return Object.keys(state.formAnswers || {}).filter(function (key) {
      return !isEmptyFlowValue({ type: Array.isArray(state.formAnswers[key]) ? 'checkboxes' : 'text' }, state.formAnswers[key]);
    }).length;
  }

  function renderReviewStep() {
    var copy = t();
    var packageForms = state.routeResult && state.routeResult.route && Array.isArray(state.routeResult.route.packageForms)
      ? state.routeResult.route.packageForms
      : (state.flowSchema ? [state.flowSchema.code] : []);
    var contactParts = [
      state.contact.name,
      state.contact.phone,
      state.contact.email
    ].filter(Boolean);
    var finalReviewLabel = contactParts.length ? copy.reviewContact : (copy.steps[4] || copy.qAccount);
    var finalReviewValue = contactParts.length ? contactParts.join(' · ') : copy.hAccount;
    card.innerHTML = '<div class="intake-question">' + esc(copy.reviewTitle) + '</div><div class="intake-help">' + esc(copy.reviewHelp) + '</div>' +
      '<div class="intake-grid">' +
        '<div class="intake-field"><label>' + esc(copy.reviewForm) + '</label><input readonly value="' + esc(state.formCode || (state.flowSchema && state.flowSchema.code) || '') + '"></div>' +
        '<div class="intake-field"><label>' + esc(copy.reviewPackage) + '</label><input readonly value="' + esc(packageForms.join(', ') || '-') + '"></div>' +
        '<div class="intake-field"><label>' + esc(copy.reviewAnswers) + '</label><input readonly value="' + esc(String(filledAnswerCount())) + '"></div>' +
        '<div class="intake-field"><label>' + esc(finalReviewLabel) + '</label><input readonly value="' + esc(finalReviewValue) + '"></div>' +
      '</div><div id="intakeFlowError" class="intake-error"></div>';
  }

  function render() {
    var copy = t();
    skipEmptyFlowSteps(1);
    kicker.textContent = copy.kicker;
    title.textContent = copy.title;
    sub.textContent = copy.sub;
    railNote.textContent = copy.rail;
    disclaimer.textContent = copy.disclaimer;
    backBtn.textContent = copy.back;
    var loading = state.flowLoading || state.routeLoading;
    nextBtn.textContent = loading
      ? (copy.loadingNext || 'Loading Next Question...')
      : (state.step === finalStep() ? copy.finish : copy.next);
    backBtn.style.display = '';
    nextBtn.style.display = '';
    backBtn.disabled = state.step === 0 || loading;
    nextBtn.disabled = loading;
    var pct = Math.round((state.step + 1) / activeSteps().length * 100);
    progress.style.width = pct + '%';
    if (progressPercent) progressPercent.textContent = pct + '%';
    if (progressLabelEl && copy.progressLabel) progressLabelEl.textContent = copy.progressLabel;
    if (processingEl) {
      if (loading) {
        processingEl.textContent = (copy.processing || 'Processing your answers...');
        processingEl.classList.add('active');
      } else {
        processingEl.classList.remove('active');
      }
    }
    renderLangButtons();
    renderSteps();
    if (state.completed) {
      renderCompleted();
      return;
    }

    if (state.step === 0) {
      card.innerHTML = '<div class="intake-question">' + esc(copy.qLanguage) + '</div><div class="intake-help">' + esc(copy.hLanguage) + '</div><div class="intake-options">' +
        [['en','English','English'],['ru','Русский','На русском'],['uk','Українська','Українською'],['es','Español','En español']].map(function (item) {
          return '<button type="button" class="intake-option ' + (state.lang === item[0] ? 'active' : '') + '" data-intake-lang="' + item[0] + '"><strong>' + item[1] + '</strong><span>' + item[2] + '</span></button>';
        }).join('') + '</div>';
      return;
    }

    if (state.step === 1) {
      card.innerHTML = '<div class="intake-question">' + esc(copy.qService) + '</div><div class="intake-help">' + esc(copy.hService) + '</div><div class="intake-options">' +
        copy.services.map(function (item) {
          return '<button type="button" class="intake-option ' + (state.service === item[0] ? 'active' : '') + '" data-service="' + item[0] + '"><strong>' + esc(item[1]) + '</strong><span>' + esc(item[2]) + '</span></button>';
        }).join('') + '</div><div id="intakeStepError" class="intake-error"></div>';
      return;
    }

    if (state.flowLoading) {
      card.innerHTML = '<div class="intake-question">' + esc(copy.loadingFlow) + '</div><div class="intake-help">' + esc(state.formCode || '') + '</div>';
      return;
    }

    if (state.routeLoading) {
      card.innerHTML = '<div class="intake-question">' + esc(copy.routing) + '</div><div class="intake-help">' + esc(state.situation || state.formCode || '') + '</div>';
      return;
    }

    if (state.step === 2) {
      card.innerHTML = '<div class="intake-question">' + esc(copy.qDetails) + '</div><div class="intake-help">' + esc(copy.hDetails) + '</div>' +
        '<div class="intake-field"><label>' + esc(copy.formCodeLabel) + '</label><input id="intakeFormCode" value="' + esc(state.formCode) + '" placeholder="FL-300, SC-100, I-90..."></div>' +
        '<div class="intake-field" style="margin-top:14px;"><label>' + esc(copy.detailsLabel) + '</label><textarea id="intakeSituation" placeholder="' + esc(copy.hDetails) + '">' + esc(state.situation) + '</textarea></div>' +
        '<div id="intakeStepError" class="intake-error" style="' + (state.flowError || state.routeError ? 'display:block;' : '') + '">' + esc(state.flowError || state.routeError) + '</div>';
      return;
    }

    if (state.service === 'immigration' && flowSteps().length && state.step >= flowStepStart() && state.step < reviewStepIndex()) {
      renderFlowStep(flowSteps()[state.step - flowStepStart()]);
      return;
    }

    if (state.service === 'immigration' && flowSteps().length && state.step === reviewStepIndex()) {
      renderReviewStep();
      return;
    }

    var contactDigits = phoneDigits(state.contact.phone);
    card.innerHTML = '<div class="intake-question">' + esc(copy.qAccount) + '</div><div class="intake-help">' + esc(copy.hAccount) + '</div>' +
      '<div class="intake-choice-row">' +
        '<div class="intake-account-card ' + (state.accountMode === 'portal' ? 'active' : '') + '" data-account-mode="portal"><h4>' + esc(copy.portal) + '</h4><p>' + esc(copy.portalSub) + '</p></div>' +
        '<div class="intake-account-card ' + (state.accountMode === 'guest' ? 'active' : '') + '" data-account-mode="guest"><h4>' + esc(copy.guest) + '</h4><p>' + esc(copy.guestSub) + '</p></div>' +
      '</div>' +
      '<div class="intake-grid" style="margin-top:16px;">' +
        '<div class="intake-field"><label>' + esc(copy.name) + '</label><input id="intakeName" autocomplete="name" value="' + esc(state.contact.name) + '"></div>' +
        '<div class="intake-field"><label>' + esc(copy.phone) + '</label><input id="intakePhoneUS" type="tel" inputmode="numeric" autocomplete="tel" maxlength="14" placeholder="(XXX) XXX-XXXX" value="' + esc(formatUSPhone(contactDigits)) + '"></div>' +
        '<div class="intake-field" style="grid-column:1/-1;"><label>' + esc(copy.email) + '</label><input id="intakeEmail" type="email" inputmode="email" autocomplete="email" value="' + esc(state.contact.email) + '"><div class="intake-field-error" id="intakeEmailError">' + esc(copy.invalidEmail || 'Invalid email') + '</div></div>' +
      '</div><div id="intakeContactError" class="intake-error"></div><div id="intakeSaved" class="intake-help" style="display:none;margin-top:16px;color:#2a7a5a;"></div>';
  }

  function captureStep() {
    var formCode = document.getElementById('intakeFormCode');
    var situation = document.getElementById('intakeSituation');
    var name = document.getElementById('intakeName');
    var phoneUS = document.getElementById('intakePhoneUS');
    var email = document.getElementById('intakeEmail');
    var i765LegalName = document.getElementById('i765LegalName');
    var i765Dob = document.getElementById('i765Dob');
    var i765Address = document.getElementById('i765Address');
    var i765Status = document.getElementById('i765Status');
    var i765PriorEad = document.getElementById('i765PriorEad');
    var i765Evidence = document.getElementById('i765Evidence');
    if (formCode) state.formCode = normalizeFormCode(formCode.value);
    if (situation) state.situation = situation.value.trim();
    if (i765LegalName) state.i765.legalName = i765LegalName.value.trim();
    if (i765Dob) state.i765.dob = i765Dob.value.trim();
    if (i765Address) state.i765.address = i765Address.value.trim();
    if (i765Status) state.i765.immigrationStatus = i765Status.value.trim();
    if (i765PriorEad) state.i765.priorEad = i765PriorEad.value.trim();
    if (i765Evidence) state.i765.evidence = i765Evidence.value.trim();
    if (name) state.contact.name = name.value.trim();
    if (phoneUS) state.contact.phone = phoneDigits(phoneUS.value);
    if (email) state.contact.email = email.value.trim();

    card.querySelectorAll('[data-flow-field]').forEach(function (input) {
      var key = input.getAttribute('data-flow-field');
      if (!key) return;
      if (input.type === 'checkbox' || input.type === 'radio') return;
      var digitLimit = input.getAttribute('data-flow-digits');
      if (digitLimit) {
        state.formAnswers[key] = input.value.replace(/\D/g, '').slice(0, Number(digitLimit) || 30);
        input.value = state.formAnswers[key];
      } else {
        state.formAnswers[key] = input.value.trim();
      }
    });
    // Single-input US phone widget: store digits raw + structured parts so
    // existing PDF map readers (countryCode/areaCode/number) keep working.
    card.querySelectorAll('[data-flow-phone-us]').forEach(function (input) {
      var key = input.getAttribute('data-flow-phone-us');
      if (!key) return;
      var d = phoneDigits(input.value);
      state.formAnswers[key] = {
        countryCode: '+1',
        areaCode: d.slice(0, 3),
        number: d.slice(3)
      };
    });
    // A-number formatted widget: store raw 9 digits in state so PDF renders
    // one digit per box; UI shows formatted 123-456-789.
    card.querySelectorAll('[data-flow-anumber]').forEach(function (input) {
      var key = input.getAttribute('data-flow-anumber');
      if (!key) return;
      state.formAnswers[key] = aNumberDigits(input.value);
    });
    card.querySelectorAll('[data-flow-address-block]').forEach(function (group) {
      group.querySelectorAll('[data-flow-address-key]').forEach(function (input) {
        var key = input.getAttribute('data-flow-address-key');
        if (key) state.formAnswers[key] = input.value.trim();
      });
    });
    card.querySelectorAll('[data-flow-address-history], [data-flow-employment-history]').forEach(function (group) {
      var key = group.getAttribute('data-flow-address-history') || group.getAttribute('data-flow-employment-history');
      if (!key) return;
      state.formAnswers[key] = readHistoryRows(group, false);
      refreshAddressHistoryCoverage(group);
    });
    card.querySelectorAll('[data-flow-travel-history]').forEach(function (group) {
      var key = group.getAttribute('data-flow-travel-history');
      if (key) state.formAnswers[key] = readTravelRows(group, false);
    });
    card.querySelectorAll('[data-flow-radio-group]').forEach(function (group) {
      var key = group.getAttribute('data-flow-radio-group');
      var checked = group.querySelector('input[data-flow-radio]:checked');
      if (key) state.formAnswers[key] = checked ? checked.value : '';
    });
    card.querySelectorAll('[data-flow-checkbox-group]').forEach(function (group) {
      var key = group.getAttribute('data-flow-checkbox-group');
      if (key) {
        state.formAnswers[key] = Array.prototype.slice.call(group.querySelectorAll('input[data-flow-checkbox]:checked')).map(function (item) {
          return item.value;
        });
      }
    });

    if (!state.formCode) state.formCode = normalizeFormCode(inferIntakeFormCode(state.situation));
    if (isImmigrationFormCode(state.formCode)) state.service = 'immigration';
    persistIntakeProgress();
  }

  function isValidContactName(value) {
    var text = String(value || '').trim().replace(/\s+/g, ' ');
    var letters = (text.match(/[A-Za-zА-Яа-яЁёІіЇїЄєҐґÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
    return letters >= 4 && /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґÁÉÍÓÚÜÑáéíóúüñ'’.\-\s]+$/.test(text);
  }

  function isValidPhone(value) {
    // US format: exactly 10 digits.
    return phoneDigits(value).length === 10;
  }

  function isValidEmail(value) {
    return /^[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(String(value || '').trim());
  }

  function validateContact() {
    var fields = {
      name: document.getElementById('intakeName'),
      phone: document.getElementById('intakePhoneUS'),
      email: document.getElementById('intakeEmail')
    };
    var invalid = [];
    Object.keys(fields).forEach(function (key) {
      if (fields[key]) fields[key].classList.remove('intake-invalid');
    });
    if (!isValidContactName(state.contact.name)) invalid.push(fields.name);
    if (!isValidPhone(state.contact.phone)) invalid.push(fields.phone);
    if (!isValidEmail(state.contact.email)) invalid.push(fields.email);
    invalid.forEach(function (field) {
      if (field) field.classList.add('intake-invalid');
    });
    return invalid.length === 0;
  }

  function showIntakeStepError(message) {
    var error = document.getElementById('intakeStepError');
    if (!error) return;
    error.textContent = message || '';
    error.style.display = message ? 'block' : 'none';
  }

  function validateBaseStep() {
    if (state.step === 1 && !state.service) {
      showIntakeStepError(t().requiredError);
      return false;
    }
    if (state.step === 2 && !state.formCode && !state.situation) {
      showIntakeStepError(t().requiredError);
      return false;
    }
    showIntakeStepError('');
    return true;
  }

  function isEmptyFlowValue(field, value) {
    if (field.type === 'phone') {
      return !value || !String(value.areaCode || '').trim() || !String(value.number || '').trim();
    }
    if (field.type === 'addressBlock') {
      var parts = field.parts || {};
      var requiredParts = field.requiredParts || ['line1', 'city', 'state', 'zip'];
      return requiredParts.some(function (part) {
        var key = parts[part];
        return key && !String(state.formAnswers[key] || '').trim();
      });
    }
    if (field.type === 'addressHistory') {
      return !Array.isArray(value) || !value.some(function (row) {
        return String(row.line1 || row.city || row.state || row.zip || row.from || row.to || '').trim();
      });
    }
    if (field.type === 'employmentHistory') {
      return !Array.isArray(value) || !value.some(function (row) {
        return String(row.name || row.activity || row.occupation || row.line1 || row.city || row.state || row.zip || row.from || row.to || '').trim();
      });
    }
    if (field.type === 'travelHistory') {
      return !Array.isArray(value) || !value.some(function (row) {
        return String(row.from || row.to || row.country || row.days || '').trim();
      });
    }
    return Array.isArray(value) ? value.length === 0 : !String(value || '').trim();
  }

  function streetLineLooksOverfilled(value) {
    var text = String(value || '').trim();
    if (!text) return false;
    return /,/.test(text) || /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(text) || /\b\d{5}(?:-\d{4})?\b/.test(text);
  }

  function isUSAddressCountry(value) {
    var text = String(value || '').trim().toLowerCase();
    return !text || text === 'us' || text === 'usa' || text === 'u.s.' || text === 'united states' || text === 'united states of america';
  }

  function pushInvalid(invalid, labels, item, label) {
    if (item) invalid.push(item);
    if (label) labels.push(String(label).replace(/\s*\*\s*$/, ''));
  }

  function validateStreetLineCompleteness(inputs, invalid, missingLabels, labelPrefix) {
    var line1 = inputs.line1;
    var city = inputs.city;
    var stateInput = inputs.state;
    var zip = inputs.zip;
    var country = inputs.country;
    var hasStreet = line1 && String(line1.value || '').trim();
    if (!hasStreet || !isUSAddressCountry(country && country.value)) return;
    if (streetLineLooksOverfilled(line1.value)) pushInvalid(invalid, missingLabels, line1, (labelPrefix || '') + 'street line only');
    if (city && !String(city.value || '').trim()) pushInvalid(invalid, missingLabels, city, (labelPrefix || '') + 'city');
    if (stateInput && !String(stateInput.value || '').trim()) pushInvalid(invalid, missingLabels, stateInput, (labelPrefix || '') + 'state');
    if (zip && !/^\d{5}(?:-\d{4})?$/.test(String(zip.value || '').trim())) pushInvalid(invalid, missingLabels, zip, (labelPrefix || '') + 'ZIP');
  }

  function validateAddressBlockField(field, invalid, missingLabels) {
    var block = card.querySelector('[data-flow-address-block="' + field.id + '"]');
    if (!block) return;
    validateStreetLineCompleteness({
      line1: block.querySelector('[data-flow-address-part="line1"]'),
      city: block.querySelector('[data-flow-address-part="city"]'),
      state: block.querySelector('[data-flow-address-part="state"]'),
      zip: block.querySelector('[data-flow-address-part="zip"]'),
      country: block.querySelector('[data-flow-address-part="country"]')
    }, invalid, missingLabels, field.label ? field.label + ' ' : '');
  }

  function validateHistoryAddressField(field, invalid, missingLabels) {
    var group = card.querySelector('[data-flow-address-history="' + field.id + '"], [data-flow-employment-history="' + field.id + '"]');
    if (!group) return;
    group.querySelectorAll('[data-history-index]').forEach(function (row, index) {
      validateStreetLineCompleteness({
        line1: row.querySelector('[data-history-part="line1"]'),
        city: row.querySelector('[data-history-part="city"]'),
        state: row.querySelector('[data-history-part="state"]'),
        zip: row.querySelector('[data-history-part="zip"]'),
        country: row.querySelector('[data-history-part="country"]')
      }, invalid, missingLabels, (field.label || 'Address') + ' entry ' + (index + 1) + ' ');
    });
  }

  function validateTravelHistoryField(field, invalid, missingLabels) {
    var group = card.querySelector('[data-flow-travel-history="' + field.id + '"]');
    if (!group) return;
    var rows = Array.prototype.slice.call(group.querySelectorAll('[data-travel-index]'));
    var hasAny = false;
    rows.forEach(function (row, index) {
      var from = row.querySelector('[data-travel-part="from"]');
      var to = row.querySelector('[data-travel-part="to"]');
      var country = row.querySelector('[data-travel-part="country"]');
      var days = row.querySelector('[data-travel-part="days"]');
      var any = [from, to, country, days].some(function (input) { return input && String(input.value || '').trim(); });
      if (!any) return;
      hasAny = true;
      if (from && !from.value) pushInvalid(invalid, missingLabels, from, (field.label || 'Trip') + ' ' + (index + 1) + ' from date');
      if (to && !to.value) pushInvalid(invalid, missingLabels, to, (field.label || 'Trip') + ' ' + (index + 1) + ' return date');
      if (country && !country.value) pushInvalid(invalid, missingLabels, country, (field.label || 'Trip') + ' ' + (index + 1) + ' country');
      if (days && !String(days.value || '').trim()) pushInvalid(invalid, missingLabels, days, (field.label || 'Trip') + ' ' + (index + 1) + ' total days');
    });
    if (field.required && !hasAny) pushInvalid(invalid, missingLabels, group, field.label || 'Trips');
  }

  function validateCurrentFlowStep() {
    if (!(state.service === 'immigration' && flowSteps().length && state.step >= flowStepStart() && state.step < reviewStepIndex())) return true;
    var schemaStep = flowSteps()[state.step - flowStepStart()];
    var invalid = [];
    var missingLabels = [];
    visibleFlowFields(schemaStep).forEach(function (field) {
      var value = state.formAnswers[field.id];
      var empty = isEmptyFlowValue(field, value);
      var digitValue = String(value || '').replace(/\D/g, '');
      var wrongDigits = field.digits && digitValue && digitValue.length !== Number(field.digits);
      if (field.type === 'email' && value && !isValidEmail(value)) {
        var emailInput = document.getElementById(fieldDomId(field.id));
        pushInvalid(invalid, missingLabels, emailInput, field.label);
        return;
      }
      if ((!field.required || !empty) && !wrongDigits) {
        if (field.type === 'addressBlock') validateAddressBlockField(field, invalid, missingLabels);
        if (field.type === 'addressHistory' || field.type === 'employmentHistory') validateHistoryAddressField(field, invalid, missingLabels);
        if (field.type === 'travelHistory') validateTravelHistoryField(field, invalid, missingLabels);
        return;
      }
      var input = document.getElementById(fieldDomId(field.id))
        || card.querySelector('[data-flow-phone-us="' + field.id + '"]');
      var group = card.querySelector('[data-flow-radio-group="' + field.id + '"], [data-flow-checkbox-group="' + field.id + '"], [data-flow-phone-group="' + field.id + '"], [data-flow-address-block="' + field.id + '"], [data-flow-address-history="' + field.id + '"], [data-flow-employment-history="' + field.id + '"], [data-flow-travel-history="' + field.id + '"]');
      pushInvalid(invalid, missingLabels, input || group, field.label);
      if (field.type === 'addressBlock') validateAddressBlockField(field, invalid, missingLabels);
      if (field.type === 'addressHistory' || field.type === 'employmentHistory') validateHistoryAddressField(field, invalid, missingLabels);
      if (field.type === 'travelHistory') validateTravelHistoryField(field, invalid, missingLabels);
    });
    card.querySelectorAll('.intake-invalid').forEach(function (item) { item.classList.remove('intake-invalid'); });
    invalid.forEach(function (item) { if (item) item.classList.add('intake-invalid'); });
    var error = document.getElementById('intakeFlowError');
    if (error) {
      if (invalid.length) {
        var detail = missingLabels.length ? ' — ' + missingLabels.slice(0, 3).join(', ') + (missingLabels.length > 3 ? ', …' : '') : '';
        error.textContent = t().requiredError + detail;
        error.style.display = 'block';
      } else {
        error.textContent = '';
        error.style.display = 'none';
      }
    }
    // Focus + scroll the first invalid field into view so the user sees what is missing.
    if (invalid.length && invalid[0]) {
      try { invalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      try {
        var focusTarget = invalid[0].tagName === 'INPUT' || invalid[0].tagName === 'SELECT' || invalid[0].tagName === 'TEXTAREA'
          ? invalid[0]
          : invalid[0].querySelector('input, select, textarea');
        if (focusTarget) focusTarget.focus({ preventScroll: true });
      } catch (e) {}
    }
    return invalid.length === 0;
  }

  function matchingStateOption(value, select) {
    var text = String(value || '').trim();
    if (!text || !select) return text;
    var options = Array.prototype.slice.call(select.options || []);
    var match = options.find(function (option) { return optionMatchesValue(option.value, text) || optionMatchesValue(option.textContent, text); });
    return match ? match.value : text;
  }

  function setAnswerAndInput(id, value) {
    var input = document.getElementById(fieldDomId(id)) || card.querySelector('[data-flow-address-key="' + id + '"]');
    var nextValue = String(value || '');
    if (input) {
      if (input.tagName === 'SELECT') nextValue = matchingStateOption(nextValue, input);
      input.value = nextValue;
      input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    }
    state.formAnswers[id] = nextValue;
  }

  function findAddressBlockForSuggestion(fieldId) {
    var input = card.querySelector('[data-address-autocomplete="' + fieldId + '"]')
      || card.querySelector('[data-flow-address-key="' + fieldId + '"]');
    return input ? input.closest('[data-flow-address-block]') : null;
  }

  function findAddressHistoryRowForSuggestion(fieldId) {
    var input = card.querySelector('[data-address-autocomplete="' + fieldId + '"]');
    if (!input) return null;
    var row = input.closest('[data-history-index]');
    return row && (row.closest('[data-flow-address-history]') || row.closest('[data-flow-employment-history]')) ? row : null;
  }

  function setAddressBlockPart(block, part, value) {
    if (!block) return;
    var input = block.querySelector('[data-flow-address-part="' + part + '"]');
    if (!input) return;
    var key = input.getAttribute('data-flow-address-key');
    var nextValue = String(value || '');
    if (input.tagName === 'SELECT') nextValue = matchingStateOption(nextValue, input);
    input.value = nextValue;
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    if (key) state.formAnswers[key] = nextValue;
  }

  function setHistoryRowPart(row, part, value) {
    if (!row) return;
    var input = row.querySelector('[data-history-part="' + part + '"]');
    if (!input) return;
    var nextValue = String(value || '');
    if (input.tagName === 'SELECT') nextValue = matchingStateOption(nextValue, input);
    input.value = nextValue;
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }

  function applyAddressSuggestion(fieldId, suggestion) {
    if (!suggestion) return;
    var block = findAddressBlockForSuggestion(fieldId);
    if (block) {
      setAddressBlockPart(block, 'line1', suggestion.line1 || '');
      setAddressBlockPart(block, 'line2', suggestion.line2 || '');
      setAddressBlockPart(block, 'city', suggestion.city || '');
      setAddressBlockPart(block, 'state', suggestion.state || '');
      setAddressBlockPart(block, 'zip', suggestion.zip || '');
      setAddressBlockPart(block, 'country', suggestion.country || 'United States');
    } else {
      var historyRow = findAddressHistoryRowForSuggestion(fieldId);
      if (historyRow) {
        setHistoryRowPart(historyRow, 'line1', suggestion.line1 || '');
        setHistoryRowPart(historyRow, 'line2', suggestion.line2 || '');
        setHistoryRowPart(historyRow, 'city', suggestion.city || '');
        setHistoryRowPart(historyRow, 'state', suggestion.state || '');
        setHistoryRowPart(historyRow, 'zip', suggestion.zip || '');
        setHistoryRowPart(historyRow, 'country', suggestion.country || 'United States');
        var group = historyRow.closest('[data-flow-address-history], [data-flow-employment-history]');
        if (group) {
          var key = group.getAttribute('data-flow-address-history') || group.getAttribute('data-flow-employment-history');
          state.formAnswers[key] = readHistoryRows(group, false);
          refreshAddressHistoryCoverage(group);
        }
      } else {
        setAnswerAndInput(fieldId, suggestion.line1 || '');
      }
    }
    var box = card.querySelector('[data-address-suggestions="' + fieldId + '"]');
    var note = card.querySelector('[data-address-note="' + fieldId + '"]');
    if (box) box.classList.remove('open');
    if (note) note.textContent = suggestion.verified ? 'USPS verified.' : (suggestion.source === 'local-parse' ? 'Address parsed locally. USPS validation will run when configured.' : '');
  }

  function renderAddressSuggestions(fieldId, suggestions) {
    var box = card.querySelector('[data-address-suggestions="' + fieldId + '"]');
    var note = card.querySelector('[data-address-note="' + fieldId + '"]');
    if (!box) return;
    state.addressSuggestions[fieldId] = suggestions || [];
    if (!suggestions || !suggestions.length) {
      box.innerHTML = '';
      box.classList.remove('open');
      if (note) note.textContent = '';
      return;
    }
    box.innerHTML = suggestions.map(function (suggestion, index) {
      return '<button type="button" class="intake-address-suggestion" data-address-suggestion-index="' + index + '" data-address-suggestion-field="' + esc(fieldId) + '">' + esc(t().addressSuggestion) + ': ' + esc(suggestion.label || suggestion.line1 || '') + '</button>';
    }).join('');
    box.classList.add('open');
    if (note) note.textContent = suggestions[0].verified ? 'USPS verified.' : 'Select the closest address. USPS can standardize it when credentials are connected.';
  }

  function localAddressSuggestions(query) {
    var text = String(query || '').trim().replace(/\s+/g, ' ');
    var suggestions = [];
    var m = text.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)(?:,\s*(?:United States|USA|US))?$/i);
    if (!m) m = text.match(/^(.+?)\s*,\s*([^,]+)\s*,\s*([A-Z]{2})\s*,?\s*(\d{5}(?:-\d{4})?)$/i);
    if (m) {
      suggestions.push({
        line1: m[1].trim(),
        line2: '',
        city: m[2].trim(),
        state: m[3].trim().toUpperCase(),
        zip: m[4].trim(),
        country: 'United States',
        label: m[1].trim() + ', ' + m[2].trim() + ', ' + m[3].trim().toUpperCase() + ' ' + m[4].trim() + ', United States',
        source: 'local-parse',
        verified: false
      });
    }
    return suggestions;
  }

  async function suggestAddress(fieldId, query) {
    if (!query || query.trim().length < 8) {
      renderAddressSuggestions(fieldId, []);
      return;
    }
    var note = card.querySelector('[data-address-note="' + fieldId + '"]');
    if (note) note.textContent = t().addressChecking;
    try {
      var response = await fetch(addressSuggestEndpoint(query), { headers: { 'Accept': 'application/json' } });
      var data = await response.json();
      var remoteSuggestions = data.ok ? (data.suggestions || []) : [];
      renderAddressSuggestions(fieldId, remoteSuggestions.length ? remoteSuggestions : localAddressSuggestions(query));
    } catch (err) {
      var local = localAddressSuggestions(query);
      renderAddressSuggestions(fieldId, local);
      if (note && !local.length) note.textContent = '';
    }
  }

  function intakeEndpoint() {
    return usesFilePreview() ? 'https://imverica.com/.netlify/functions/intake' : '/.netlify/functions/intake';
  }

  function pdfDraftEndpoint() {
    return pdfDraftEndpoints()[0];
  }

  function pdfDraftEndpoints() {
    var path = '/.netlify/functions/generate-pdf';
    var localHost = window.location.protocol === 'file:' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === 'localhost';
    var endpoints = [];
    if (window.location.protocol === 'file:') endpoints.push('http://127.0.0.1:8888' + path);
    else endpoints.push(path);
    if (localHost) endpoints.push('https://imverica.com' + path);
    return endpoints;
  }

  async function submitIntake(payload) {
    var response = await fetch(intakeEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = {};
    try {
      data = await response.json();
    } catch (err) {}
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Could not save intake');
    }
    return data;
  }

  async function generatePdfDraft() {
    captureStep();
    var copy = t();
    var button = card.querySelector('[data-generate-pdf-draft]');
    var status = document.getElementById('intakeDraftStatus');
    var formCode = normalizeFormCode(state.formCode);
    if (!button || !canGeneratePdfDraft(formCode)) return;
    if (status) {
      status.className = 'intake-draft-status';
      status.textContent = draftFormText(copy.generatingDraft);
    }
    button.disabled = true;
    button.textContent = draftFormText(copy.generatingDraft);
    var payload = Object.assign({}, state.savedPayload || {}, {
      formCode: state.formCode,
      formAnswers: state.formAnswers,
      contact: state.contact,
      officialForm: state.officialForm || (state.savedPayload && state.savedPayload.officialForm) || null,
      orderId: state.orderId || (state.savedPayload && state.savedPayload.orderId) || ''
    });
    try {
      var response = null;
      var endpoints = pdfDraftEndpoints();
      for (var i = 0; i < endpoints.length; i += 1) {
        try {
          response = await fetch(endpoints[i], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/pdf, application/json' },
            body: JSON.stringify(payload)
          });
          if (response.ok || i === endpoints.length - 1) break;
        } catch (endpointErr) {
          if (i === endpoints.length - 1) throw endpointErr;
        }
      }
      if (!response.ok) {
        var errorData = {};
        try { errorData = await response.json(); } catch (err) {}
        throw new Error(errorData.error || copy.draftError);
      }
      var blob = await response.blob();
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'imverica-' + formCode.toLowerCase() + '-draft.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      if (status) {
        status.className = 'intake-draft-status ok';
        status.textContent = draftFormText(copy.draftReady);
      }
    } catch (err) {
      if (status) {
        status.className = 'intake-draft-status error';
        status.textContent = draftFormText(copy.draftError);
      }
    } finally {
      button.disabled = false;
      button.textContent = draftFormText(copy.generateDraft);
    }
  }

  async function saveIntake() {
    captureStep();
    var saved = document.getElementById('intakeSaved');
    var error = document.getElementById('intakeContactError');
    if (saved) saved.style.display = 'none';
    if (error) error.style.display = 'none';
    if (!validateContact()) {
      if (error) {
        error.textContent = t().contactError;
        error.style.display = 'block';
      }
      return;
    }
    var payload = {
      createdAt: new Date().toISOString(),
      language: state.lang,
      service: state.service,
      serviceLabel: selectedService()[1],
      formCode: state.formCode,
      situation: state.situation,
      routeResult: state.routeResult,
      flowSchemaVersion: state.flowSchema ? state.flowSchema.schemaVersion : '',
      officialForm: state.officialForm || null,
      formAnswers: state.formAnswers,
      packageForms: state.routeResult && state.routeResult.route ? state.routeResult.route.packageForms : (state.flowSchema ? [state.flowSchema.code] : []),
      i765: state.i765,
      contact: state.contact,
      accountMode: state.accountMode
    };
    localStorage.setItem('imvericaIntakeDraft', JSON.stringify({ syncStatus: 'pending', payload: payload }));
    nextBtn.disabled = true;
    nextBtn.textContent = t().saving;
    try {
      var result = await submitIntake(payload);
      payload.orderId = result.orderId;
      payload.syncStatus = 'synced';
      localStorage.setItem('imvericaIntakeDraft', JSON.stringify(payload));
      localStorage.removeItem(INTAKE_PROGRESS_KEY);
      state.savedPayload = payload;
      state.orderId = result.orderId || '';
      state.completed = true;
      render();
    } catch (err) {
      if (error) {
        error.textContent = t().saveError;
        error.style.display = 'block';
      }
      nextBtn.disabled = false;
      nextBtn.textContent = t().finish;
    }
  }

  async function changeIntakeLanguage(lang, advanceFromLanguageStep) {
    state.lang = lang;
    state.langManual = true;
    // Skip the redundant service-category step entirely. Service is inferred
    // from the form code or situation text on the Details step.
    if (advanceFromLanguageStep && state.step === 0) state.step = 2;
    if (state.service === 'immigration' && state.formCode && state.flowSchema) {
      state.flowSchema = null;
      await loadImmigrationFlow();
      render();
      return;
    }
    render();
  }

  card.addEventListener('click', async function (event) {
    var addressSuggestion = event.target.closest('[data-address-suggestion-index]');
    var pdfDraft = event.target.closest('[data-generate-pdf-draft]');
    var addHistoryRow = event.target.closest('[data-add-history-row]');
    var removeHistoryRow = event.target.closest('[data-remove-history-row]');
    var addTravelRow = event.target.closest('[data-add-travel-row]');
    var removeTravelRow = event.target.closest('[data-remove-travel-row]');
    var lang = event.target.closest('[data-intake-lang]');
    var service = event.target.closest('[data-service]');
    var account = event.target.closest('[data-account-mode]');
    if (pdfDraft) {
      await generatePdfDraft();
      return;
    }
    if (addressSuggestion) {
      var fieldId = addressSuggestion.getAttribute('data-address-suggestion-field');
      var index = Number(addressSuggestion.getAttribute('data-address-suggestion-index'));
      applyAddressSuggestion(fieldId, (state.addressSuggestions[fieldId] || [])[index]);
      return;
    }
    if (addHistoryRow) {
      var addKey = addHistoryRow.getAttribute('data-add-history-row');
      var addGroup = card.querySelector('[data-flow-address-history="' + addKey + '"], [data-flow-employment-history="' + addKey + '"]');
      state.formAnswers[addKey] = addGroup ? readHistoryRows(addGroup, true) : editableHistoryRows(state.formAnswers[addKey]);
      state.formAnswers[addKey].push({});
      persistIntakeProgress();
      render();
      return;
    }
    if (removeHistoryRow) {
      var removeKey = removeHistoryRow.getAttribute('data-remove-history-row');
      var removeIndex = Number(removeHistoryRow.getAttribute('data-remove-history-index'));
      var removeGroup = card.querySelector('[data-flow-address-history="' + removeKey + '"], [data-flow-employment-history="' + removeKey + '"]');
      var removeRows = removeGroup ? readHistoryRows(removeGroup, true) : editableHistoryRows(state.formAnswers[removeKey]);
      if (removeRows.length > 1 && removeIndex >= 0) removeRows.splice(removeIndex, 1);
      state.formAnswers[removeKey] = removeRows;
      persistIntakeProgress();
      render();
      return;
    }
    if (addTravelRow) {
      var addTravelKey = addTravelRow.getAttribute('data-add-travel-row');
      var travelGroup = card.querySelector('[data-flow-travel-history="' + addTravelKey + '"]');
      state.formAnswers[addTravelKey] = travelGroup ? readTravelRows(travelGroup, true) : editableHistoryRows(state.formAnswers[addTravelKey]);
      state.formAnswers[addTravelKey].push({});
      persistIntakeProgress();
      render();
      return;
    }
    if (removeTravelRow) {
      var removeTravelKey = removeTravelRow.getAttribute('data-remove-travel-row');
      var removeTravelIndex = Number(removeTravelRow.getAttribute('data-remove-travel-index'));
      var removeTravelGroup = card.querySelector('[data-flow-travel-history="' + removeTravelKey + '"]');
      var travelRows = removeTravelGroup ? readTravelRows(removeTravelGroup, true) : editableHistoryRows(state.formAnswers[removeTravelKey]);
      if (travelRows.length > 1 && removeTravelIndex >= 0) travelRows.splice(removeTravelIndex, 1);
      state.formAnswers[removeTravelKey] = travelRows;
      persistIntakeProgress();
      render();
      return;
    }
    if (lang) {
      await changeIntakeLanguage(lang.getAttribute('data-intake-lang'), true);
      return;
    }
    if (service) {
      state.service = service.getAttribute('data-service');
      if (state.step === 1) state.step = 2;
      render();
      return;
    }
    if (account) {
      state.accountMode = account.getAttribute('data-account-mode');
      render();
    }
  });

  card.addEventListener('input', function (event) {
    // US single-input phone (contact step + flow phone widget): auto-format (XXX) XXX-XXXX.
    // A-number widget: reformat as user types, keep caret roughly in place.
    if (event.target.hasAttribute('data-flow-anumber')) {
      var posA = event.target.selectionStart;
      var beforeA = event.target.value.length;
      var formattedA = formatANumber(event.target.value);
      event.target.value = formattedA;
      var diffA = formattedA.length - beforeA;
      var newA = (posA || formattedA.length) + diffA;
      if (newA < 0) newA = 0;
      if (newA > formattedA.length) newA = formattedA.length;
      try { event.target.setSelectionRange(newA, newA); } catch (e) {}
    }
    if (event.target.id === 'intakePhoneUS' || event.target.hasAttribute('data-flow-phone-us')) {
      var pos = event.target.selectionStart;
      var beforeLen = event.target.value.length;
      var formatted = formatUSPhone(event.target.value);
      event.target.value = formatted;
      // Keep caret roughly where the user was, after re-formatting.
      var diff = formatted.length - beforeLen;
      var newPos = (pos || formatted.length) + diff;
      if (newPos < 0) newPos = 0;
      if (newPos > formatted.length) newPos = formatted.length;
      try { event.target.setSelectionRange(newPos, newPos); } catch (e) {}
    }
    if (event.target.hasAttribute('data-flow-digits')) {
      var limit = Number(event.target.getAttribute('data-flow-digits')) || 30;
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, limit);
    }
    // Email — validate immediately while typing. USCIS-facing emails must be ASCII.
    if (event.target.id === 'intakeEmail') {
      var err = document.getElementById('intakeEmailError');
      if (event.target.value.trim() && !isValidEmail(event.target.value)) {
        if (err) err.classList.add('active');
        event.target.classList.add('intake-invalid');
      } else {
        if (err) err.classList.remove('active');
        event.target.classList.remove('intake-invalid');
      }
    }
    if (event.target.matches('input[type="email"][data-flow-field]')) {
      event.target.classList.toggle('intake-invalid', Boolean(event.target.value.trim() && !isValidEmail(event.target.value)));
    }
    if (event.target.hasAttribute('data-street-line')) {
      event.target.classList.toggle('intake-invalid', streetLineLooksOverfilled(event.target.value));
    }
    var addressInput = event.target.closest('[data-address-autocomplete]');
    var historyGroup = event.target.closest('[data-flow-address-history], [data-flow-employment-history]');
    if (historyGroup) refreshAddressHistoryCoverage(historyGroup);
    if (addressInput) {
      var fieldId = addressInput.getAttribute('data-address-autocomplete');
      if (fieldId.indexOf('history:') !== 0) state.formAnswers[fieldId] = addressInput.value.trim();
      clearTimeout(addressSuggestTimer);
      addressSuggestTimer = setTimeout(function () {
        suggestAddress(fieldId, addressInput.value.trim());
      }, 280);
    }
    persistIntakeProgress();
  });

  // Email blur validation.
  card.addEventListener('focusout', function (event) {
    if (event.target.id === 'intakeEmail') {
      var val = event.target.value.trim();
      var err = document.getElementById('intakeEmailError');
      if (val && !isValidEmail(val)) {
        event.target.classList.add('intake-invalid');
        if (err) err.classList.add('active');
      } else {
        event.target.classList.remove('intake-invalid');
        if (err) err.classList.remove('active');
      }
    }
  }, true);

  card.addEventListener('change', function (event) {
    var historyGroup = event.target.closest('[data-flow-address-history], [data-flow-employment-history]');
    if (historyGroup) refreshAddressHistoryCoverage(historyGroup);
    persistIntakeProgress();
    var radio = event.target.closest('[data-flow-radio]');
    var checkbox = event.target.closest('[data-flow-checkbox]');
    if (!radio && !checkbox) return;
    var group = event.target.closest('[data-flow-radio-group], [data-flow-checkbox-group]');
    if (!group) return;
    if (radio) {
      group.querySelectorAll('.intake-option').forEach(function (item) { item.classList.remove('active'); });
      var radioLabel = radio.closest('.intake-option');
      if (radioLabel) radioLabel.classList.add('active');
    }
    if (checkbox) {
      var checkboxLabel = checkbox.closest('.intake-option');
      if (checkboxLabel) checkboxLabel.classList.toggle('active', checkbox.checked);
    }
    captureStep();
    if (state.service === 'immigration' && flowSteps().length && state.step >= flowStepStart() && state.step < reviewStepIndex()) {
      var schemaStep = flowSteps()[state.step - flowStepStart()];
      var hasConditionalFields = (schemaStep.fields || []).some(function (field) {
        return (Array.isArray(field.showWhen) && field.showWhen.length) || (Array.isArray(field.showWhenAny) && field.showWhenAny.length);
      });
      if (hasConditionalFields) render();
    }
  });

  langEl.addEventListener('click', async function (event) {
    var btn = event.target.closest('[data-intake-lang]');
    if (!btn) return;
    await changeIntakeLanguage(btn.getAttribute('data-intake-lang'), false);
  });

  backBtn.addEventListener('click', function () {
    captureStep();
    if (state.step > 0) state.step -= 1;
    // Service-category step (1) is hidden: skip back over it from Details (2) → Language (0).
    if (state.step === 1) state.step = 0;
    skipEmptyFlowSteps(-1);
    render();
  });

  nextBtn.addEventListener('click', async function () {
    if (state.completed) {
      window.closeIntakeModal();
      return;
    }
    captureStep();
    if (!validateBaseStep()) return;
    if (!validateCurrentFlowStep()) return;
    if (state.step === 2) {
      await loadRoute();
    }
    if (state.step === 2 && shouldUseImmigrationFlow()) {
      var loaded = await loadImmigrationFlow();
      if (loaded && flowSteps().length) {
        state.step = flowStepStart();
        skipEmptyFlowSteps(1);
        render();
      } else {
        render();
      }
      return;
    }
    if (state.step < finalStep()) {
      state.step += 1;
      // Service-category step (1) is hidden: skip it forward from Language (0) → Details (2).
      if (state.step === 1) state.step = 2;
      skipEmptyFlowSteps(1);
      render();
      return;
    }
    await saveIntake();
  });

  window.openIntakeModal = function (prefill) {
    var rememberedLang = state.lang || 'en';
    state.lang = rememberedLang;
    state.langManual = false;
    state.step = 0;
    state.service = '';
    state.formCode = '';
    state.situation = '';
    state.routeResult = null;
    state.routeLoading = false;
    state.routeError = '';
    state.flowSchema = null;
    state.flowLoading = false;
    state.flowError = '';
    state.formAnswers = {};
    state.addressSuggestions = {};
    state.officialForm = null;
    state.i765 = { basis: '', legalName: '', dob: '', address: '', immigrationStatus: '', priorEad: '', evidence: '' };
    state.contact = { name: '', phone: '', email: '' };
    state.accountMode = 'guest';
    state.completed = false;
    state.savedPayload = null;
    state.orderId = '';
    if (!prefill) restoreIntakeProgress();
    if (prefill && typeof prefill === 'string') {
      var text = prefill.trim();
      var codeMatch = text.match(/\b(?:I|N|G|EOIR|FL|DV|CH|EA|GV|WV|SC|UD|FW|POS|CIV|CM|SUM|PLD|DE|GC)-[A-Z0-9]+(?:\([A-Z0-9]+\))?\b/i);
      var detectedLang = detectIntakeLang(text);
      var inferredService = inferIntakeService(text);
      var inferredFormCode = inferIntakeFormCode(text);
      state.situation = text;
      if (detectedLang) {
        state.lang = detectedLang;
        state.langManual = true;
      }
      if (inferredService) state.service = inferredService;
      if (inferredFormCode) state.formCode = inferredFormCode;
      if (codeMatch) {
        state.formCode = codeMatch[0].toUpperCase();
        if (/^(I|N|G|EOIR)-/i.test(state.formCode)) state.service = 'immigration';
        if (/^(FL|DV)-/i.test(state.formCode)) state.service = 'family';
        if (/^(SC|FW|POS|CIV|CM|SUM|PLD)-/i.test(state.formCode)) state.service = 'civil';
        if (/^(CH|EA|GV|WV)-/i.test(state.formCode)) state.service = 'restraining';
        if (/^UD-/i.test(state.formCode)) state.service = 'ud';
        // Have explicit form code from hero — Details step shows briefly while
        // we kick off flow load; advance only AFTER the schema is in hand
        // (handled below). Until then keep step = 2 so user does not land on
        // the account step with an empty form behind it.
        state.step = 2;
      } else if (state.formCode) {
        // Inferred form code — same as above.
        state.step = 2;
      } else if (state.service) {
        // Have service but no form yet — Details step is useful so user can pick.
        state.step = 2;
      } else if (detectedLang) {
        state.step = 1;
      }
    }
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    render();
    // If we have an immigration form code from the prefill, eagerly fetch the
    // flow schema so the user lands directly on the first wizard question
    // instead of slipping past the (empty) flow to the account step.
    if (state.formCode && shouldUseImmigrationFlow()) {
      (async function () {
        var loaded = await loadImmigrationFlow();
        if (loaded && flowSteps().length) {
          state.step = flowStepStart();
          skipEmptyFlowSteps(1);
        }
        render();
      })();
    }
  };

  window.closeIntakeModal = function () {
    captureStep();
    persistIntakeProgress();
    modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') window.closeIntakeModal();
  });
})();
  // End ported IIFE.
  // ============================================================
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initIntakeWizard());
  } else {
    initIntakeWizard();
  }
}

export {};
