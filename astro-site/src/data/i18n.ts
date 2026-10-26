/**
 * Shared i18n strings + language metadata for the Imverica site.
 *
 * Form codes (I-485, N-400, etc.) stay in English — they are official
 * USCIS designators. Statutory citations (INA §245(a), 8 CFR §103.2,
 * Cal. Bus. & Prof. Code §6400, etc.) stay in English — they are
 * legal references that do not translate.
 *
 * The brand "Imverica Legal Solutions" stays as-is across all languages.
 */

export type Locale = 'en' | 'ru' | 'uk' | 'es';

export interface LocaleMeta {
  code: Locale;
  htmlLang: string;
  ogLocale: string;
  flag: string;
  label: string;
  /** Path prefix; '' for the default English root. */
  prefix: string;
}

export const LOCALES: Record<Locale, LocaleMeta> = {
  en: { code: 'en', htmlLang: 'en-US', ogLocale: 'en_US', flag: '🇺🇸', label: 'English', prefix: '' },
  ru: { code: 'ru', htmlLang: 'ru-RU', ogLocale: 'ru_RU', flag: '🇷🇺', label: 'Русский', prefix: '/ru' },
  uk: { code: 'uk', htmlLang: 'uk-UA', ogLocale: 'uk_UA', flag: '🇺🇦', label: 'Українська', prefix: '/ua' },
  es: { code: 'es', htmlLang: 'es-MX', ogLocale: 'es_MX', flag: '🇲🇽', label: 'Español', prefix: '/mx' }
};

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ru', 'uk', 'es'];

const translatedSlugs = new Set<string>([
  '/',
  '/i-485-help',
  '/i-589-asylum-help',
  '/n-400-citizenship-help',
  '/i-130-family-petition',
  '/i-765-work-permit-help',
  '/california-unlawful-detainer',
  '/california-probate',
  '/california-expungement',
  '/california-restraining-orders',
  '/lda',
  '/fl',
  '/sc',
  '/immigration',
  '/business',
  '/u4u',
  '/tps',
  '/u-visa-help',
  '/i-539-change-of-status',
  '/i-90-green-card-renewal',
  '/vawa-self-petition',
  '/eoir-immigration-court',
  '/fl-100-divorce',
  '/fl-120-divorce-response',
  '/fl-150-income-expense-declaration',
  '/fl-160-property-declaration',
  '/fl-300-request-for-order',
  '/fl-105-uccjea',
  '/fw-001-fee-waiver',
  '/demand-letter',
  '/sc-100-plaintiff-claim',
  '/sc-120-defendant-claim',
  '/sc-104-proof-of-service',
  '/sc-133-memorandum-of-costs',
  '/wg-001-wage-garnishment',
  '/ej-001-abstract-of-judgment',
  '/sc-140-installments',
  '/llc-1-form-an-llc',
  '/llc-12-statement-of-information',
  '/arts-gs-incorporation',
  '/fbn-dba',
  '/ss-4-ein',
  '/operating-agreement',
  '/llc-1a-foreign-llc',
  '/si-550-corporation-statement',
  // USCIS form-level dedicated pages
  '/i-131-travel-document',
  '/i-131a-returning-resident',
  '/i-864-affidavit-of-support',
  '/i-864a-household-member',
  '/i-693-medical-examination',
  '/i-751-remove-conditions',
  '/i-824-action-on-approved-application',
  // EOIR form-level dedicated pages
  '/eoir-29-notice-of-appeal',
  '/eoir-42a-cancellation-lpr',
  '/eoir-42b-cancellation-non-lpr',
  '/eoir-40-suspension-of-deportation',
  // Company-level pages (About + B2B paralegal-for-attorneys)
  // NOTE: /pricing is EN-only for now; intentionally NOT in translatedSlugs
  // so RU/UA/MX nav clicks fall back to /pricing (EN) instead of 404.
  // Localised versions are queued as a follow-up.
  '/about',
  '/for-attorneys',
  '/schedule'
]);

/** Build a per-locale URL from a slug. Uses the prefix in LOCALES, so URLs
 *  can diverge from the locale code (e.g. uk → /ua, es → /mx). */
export function localizedPath(locale: Locale, slug: string): string {
  const clean = slug.startsWith('/') ? slug : '/' + slug;
  if (locale === 'en') return clean;
  return `${LOCALES[locale].prefix}${clean}`;
}

/**
 * Link to a localized page only when that page actually exists.
 * Until every landing page is translated, this prevents RU/UK/ES pages from
 * linking users and crawlers into /ru/... 404 routes.
 */
export function localizedPathSafe(locale: Locale, slug: string): string {
  const clean = slug.startsWith('/') ? slug : '/' + slug;
  if (locale === 'en' || translatedSlugs.has(clean)) return localizedPath(locale, clean);
  return clean;
}

/** Return all locale alternates for a given slug — used for hreflang link tags. */
export function alternateUrls(slug: string): Array<{ locale: Locale; href: string; htmlLang: string }> {
  return SUPPORTED_LOCALES.map((locale) => ({
    locale,
    href: 'https://imverica.com' + localizedPath(locale, slug),
    htmlLang: LOCALES[locale].htmlLang
  }));
}

/**
 * Header / footer / common UI strings per locale.
 */
export const NAV: Record<Locale, {
  uscis: string;
  family: string;
  civil: string;
  criminal: string;
  business: string;
  pricing: string;
  forAttorneys: string;
  about: string;
  portal: string;
  quote: string;
  start: string;
  phoneCta: string;
  schedule: string;
}> = {
  en: {
    uscis: 'USCIS',
    family: 'Family Law',
    civil: 'Civil',
    criminal: 'Record Clearing',
    business: 'Business',
    pricing: 'Pricing',
    forAttorneys: 'For Attorneys',
    about: 'About Us',
    portal: 'Client Portal',
    quote: 'Start Your Case',
    start: 'Start document preparation',
    phoneCta: '📞 +1 (916) 399-3992',
    schedule: 'Schedule a Consultation'
  },
  ru: {
    uscis: 'USCIS',
    family: 'Семейное право',
    civil: 'Гражданские',
    criminal: 'Очистка судимости',
    business: 'Бизнес',
    pricing: 'Цены',
    forAttorneys: 'Для адвокатов',
    about: 'О нас',
    portal: 'Кабинет',
    quote: 'Начать кейс',
    start: 'Начать подготовку документов',
    phoneCta: '📞 +1 (916) 399-3992',
    schedule: 'Записаться'
  },
  uk: {
    uscis: 'USCIS',
    family: 'Сімейне право',
    civil: 'Цивільні',
    criminal: 'Очищення судимості',
    business: 'Бізнес',
    pricing: 'Ціни',
    forAttorneys: 'Для адвокатів',
    about: 'Про нас',
    portal: 'Кабінет',
    quote: 'Почати кейс',
    start: 'Почати підготовку документів',
    phoneCta: '📞 +1 (916) 399-3992',
    schedule: 'Записатися'
  },
  es: {
    uscis: 'USCIS',
    family: 'Familia',
    civil: 'Civil',
    criminal: 'Limpieza de antecedentes',
    business: 'Negocios',
    pricing: 'Precios',
    forAttorneys: 'Para Firmas Jurídicas',
    about: 'Acerca',
    portal: 'Mi portal',
    quote: 'Iniciar su caso',
    start: 'Iniciar preparación de documentos',
    phoneCta: '📞 +1 (916) 399-3992',
    schedule: 'Agendar cita'
  }
};

export const FOOTER: Record<Locale, {
  servicesUscis: string;
  servicesCivil: string;
  about: string;
  brandLine: string;
  disclaimer: string;
}> = {
  // The footer renders the disclaimer as separate lines: legal status,
  // registration and bond numbers, then the not-a-law-firm notice. The `||`
  // marker is the split point — keeping it as one string lets each locale
  // read naturally when the markers are removed.
  en: {
    servicesUscis: 'USCIS',
    servicesCivil: 'California Court',
    about: 'About',
    brandLine: 'Legal Document Assistant · Immigration Consultant · California',
    disclaimer: '© {year} Imverica LLC, dba Imverica Legal Solutions — a California limited liability company; a registered & bonded California Legal Document Assistant and Immigration Consultant (Cal. Bus. & Prof. Code §§6400-6415 and §§22440-22448).||LDA Reg. No. 2026-010, Sacramento County, expires 09/27/2028, Imverica LLC. Immigration Consultant bond No. 67347671 (Western Surety Company), on file with the California Secretary of State.||Imverica is not a law firm and is not a substitute for an attorney. We do not provide legal advice, and no attorney-client relationship is created by use of this site. Documents are prepared solely at the client\'s direction. If you need legal advice, consult a licensed attorney.'
  },
  ru: {
    servicesUscis: 'USCIS',
    servicesCivil: 'Калифорнийский суд',
    about: 'О нас',
    brandLine: 'Помощник по юридическим документам · Иммиграционный консультант · Калифорния',
    disclaimer: '© {year} Imverica LLC (Imverica Legal Solutions) — компания с ограниченной ответственностью, Калифорния; зарегистрированный помощник по юридическим документам (Legal Document Assistant) и иммиграционный консультант с гарантийным залогом (Cal. Bus. & Prof. Code §§6400-6415 и §§22440-22448).||LDA Reg. No. 2026-010, Sacramento County, expires 09/27/2028, Imverica LLC. Залог иммиграционного консультанта № 67347671 (Western Surety Company) хранится у Государственного секретаря Калифорнии.||Imverica — не юридическая фирма и не заменяет адвоката. Мы не даём юридических консультаций, и пользование сайтом не создаёт отношений «адвокат — клиент». Документы готовятся только по указанию клиента. За юридической консультацией обращайтесь к лицензированному адвокату.'
  },
  uk: {
    servicesUscis: 'USCIS',
    servicesCivil: 'Каліфорнійський суд',
    about: 'Про нас',
    brandLine: 'Помічник з юридичних документів · Імміграційний консультант · Каліфорнія',
    disclaimer: '© {year} Imverica LLC (Imverica Legal Solutions) — товариство з обмеженою відповідальністю, Каліфорнія; зареєстрований помічник з юридичних документів (Legal Document Assistant) та імміграційний консультант із гарантійною заставою (Cal. Bus. & Prof. Code §§6400-6415 та §§22440-22448).||LDA Reg. No. 2026-010, Sacramento County, expires 09/27/2028, Imverica LLC. Застава імміграційного консультанта № 67347671 (Western Surety Company) зберігається в Державного секретаря Каліфорнії.||Imverica — не юридична фірма і не замінює адвоката. Ми не надаємо юридичних консультацій, і користування сайтом не створює відносин «адвокат — клієнт». Документи готуються лише за вказівкою клієнта. По юридичну консультацію звертайтеся до ліцензованого адвоката.'
  },
  es: {
    servicesUscis: 'USCIS',
    servicesCivil: 'Corte de California',
    about: 'Sobre nosotros',
    brandLine: 'Asistente de Documentos Legales · Consultor de Inmigración · California',
    disclaimer: '© {year} Imverica LLC, que opera como Imverica Legal Solutions, sociedad de responsabilidad limitada de California; Asistente de Documentos Legales (Legal Document Assistant) y Consultor de Inmigración registrado y con fianza (Cal. Bus. & Prof. Code §§6400-6415 y §§22440-22448).||LDA Reg. No. 2026-010, Sacramento County, expires 09/27/2028, Imverica LLC. Fianza de consultor de inmigración n.º 67347671 (Western Surety Company), registrada ante la Secretaría de Estado de California.||Imverica no está autorizada para ejercer el derecho y no brinda asesoría legal ni representación. El uso de este sitio no crea una relación de representación jurídica. Los documentos se preparan únicamente bajo la dirección específica del cliente. Si necesita asesoría legal, consulte a una persona con licencia para ejercer el derecho.'
  }
};

/** Hero strings for the homepage per locale. */
export const HERO: Record<Locale, {
  eyebrow: string;
  heading: string;
  /** Heading with the closing word emphasized (gold italic) to match the brand hero. */
  headingHtml: string;
  sub: string;
}> = {
  en: {
    eyebrow: 'California · Registered LDA · Immigration Consultant',
    heading: 'What document do you need prepared?',
    headingHtml: 'What document do you need <em class="hero-em">prepared?</em>',
    sub: 'Describe the document you want prepared or enter a form number. We prepare USCIS and California court documents at the client’s specific direction throughout California. EOIR support is for attorneys only. No legal advice.'
  },
  ru: {
    eyebrow: 'Калифорния · Зарегистрированный LDA · Иммиграционный консультант',
    heading: 'Какой документ нужно подготовить?',
    headingHtml: 'Какой документ нужно <em class="hero-em">подготовить?</em>',
    sub: 'Опишите документ, который вы хотите подготовить, или введите номер формы. Мы готовим документы USCIS и судов Калифорнии по конкретному указанию клиента по всей Калифорнии. Поддержка EOIR — только для адвокатов. Без юридических консультаций.'
  },
  uk: {
    eyebrow: 'Каліфорнія · Зареєстрований LDA · Імміграційний консультант',
    heading: 'Який документ потрібно підготувати?',
    headingHtml: 'Який документ потрібно <em class="hero-em">підготувати?</em>',
    sub: 'Опишіть документ, який ви хочете підготувати, або введіть номер форми. Ми готуємо документи USCIS та судів Каліфорнії за конкретною вказівкою клієнта по всій Каліфорнії. Підтримка EOIR — лише для адвокатів. Без юридичних консультацій.'
  },
  es: {
    eyebrow: 'California · LDA registrado · Consultor de inmigración',
    heading: '¿Qué documento necesita preparar?',
    headingHtml: '¿Qué documento necesita <em class="hero-em">preparar?</em>',
    sub: 'Describa el documento que desea preparar o ingrese un número de formulario. Preparamos documentos de USCIS y de las cortes de California bajo la dirección específica del cliente en todo California. El apoyo de EOIR es solo para firmas jurídicas. Sin asesoría legal.'
  }
};

/** Verified facts in the stats strip. Numbers stay numeric. */
export const STATS: Record<Locale, string[]> = {
  en: [
    'Languages — EN · RU · UA · ES',
    'Years preparing immigration documents',
    'Registered roles — LDA & Immigration Consultant',
    'LDA registration current through Sep. 27'
  ],
  ru: [
    'Языка — EN · RU · UA · ES',
    'Лет подготовки иммиграционных документов',
    'Регистрации — LDA и Immigration Consultant',
    'Регистрация LDA действует до 27 сентября'
  ],
  uk: [
    'Мови — EN · RU · UA · ES',
    'Років підготовки імміграційних документів',
    'Реєстрації — LDA та Immigration Consultant',
    'Реєстрація LDA чинна до 27 вересня'
  ],
  es: [
    'Idiomas — EN · RU · UA · ES',
    'Años preparando documentos de inmigración',
    'Registros — LDA y Consultor de Inmigración',
    'Registro LDA vigente hasta el 27 de septiembre'
  ]
};

/** CTA strip default heading + sub per locale. */
export const CTA: Record<Locale, {
  heading: string;
  sub: string;
  startBtn: string;
}> = {
  en: {
    heading: 'Ready to start your document package?',
    sub: 'Flat-fee pricing. No legal advice — document preparation only, at your direction. Multilingual intake in English, Russian, Ukrainian, and Spanish.',
    startBtn: 'Start document preparation'
  },
  ru: {
    heading: 'Готовы начать подготовку вашего пакета документов?',
    sub: 'Фиксированная цена. Без юридических консультаций — только подготовка документов по вашему поручению. Интерфейс на английском, русском, украинском и испанском.',
    startBtn: 'Начать подготовку документов'
  },
  uk: {
    heading: 'Готові розпочати підготовку вашого пакету документів?',
    sub: 'Фіксована ціна. Без юридичних консультацій — лише підготовка документів за вашим дорученням. Інтерфейс англійською, російською, українською та іспанською.',
    startBtn: 'Почати підготовку документів'
  },
  es: {
    heading: '¿Listo para comenzar su paquete de documentos?',
    sub: 'Precio fijo. Sin asesoría legal — solo preparación de documentos bajo su dirección. Atención multilingüe en inglés, ruso, ucraniano y español.',
    startBtn: 'Iniciar preparación de documentos'
  }
};
