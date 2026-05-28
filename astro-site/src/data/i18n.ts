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
  en: { code: 'en', htmlLang: 'en-US', ogLocale: 'en_US', flag: '🇺🇸', label: 'EN', prefix: '' },
  ru: { code: 'ru', htmlLang: 'ru-RU', ogLocale: 'ru_RU', flag: '🇷🇺', label: 'RU', prefix: '/ru' },
  uk: { code: 'uk', htmlLang: 'uk-UA', ogLocale: 'uk_UA', flag: '🇺🇦', label: 'UA', prefix: '/ua' },
  es: { code: 'es', htmlLang: 'es-MX', ogLocale: 'es_MX', flag: '🇲🇽', label: 'MX', prefix: '/mx' }
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
  '/eoir-immigration-court'
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
  business: string;
  about: string;
  portal: string;
  quote: string;
  start: string;
  phoneCta: string;
}> = {
  en: {
    uscis: 'USCIS | EOIR',
    family: 'Family Law',
    civil: 'Small Claims & Civil',
    business: 'Business',
    about: 'About Us',
    portal: 'Client Portal',
    quote: 'Start Your Case',
    start: 'Start document preparation',
    phoneCta: '📞 +1 (916) 399-3992'
  },
  ru: {
    uscis: 'USCIS | EOIR',
    family: 'Семейное право',
    civil: 'Малые иски и гражданские дела',
    business: 'Бизнес',
    about: 'О нас',
    portal: 'Кабинет',
    quote: 'Начать кейс',
    start: 'Начать подготовку документов',
    phoneCta: '📞 +1 (916) 399-3992'
  },
  uk: {
    uscis: 'USCIS | EOIR',
    family: 'Сімейне право',
    civil: 'Малі позови та цивільні справи',
    business: 'Бізнес',
    about: 'Про нас',
    portal: 'Кабінет',
    quote: 'Почати кейс',
    start: 'Почати підготовку документів',
    phoneCta: '📞 +1 (916) 399-3992'
  },
  es: {
    uscis: 'USCIS | EOIR',
    family: 'Familia',
    civil: 'Reclamos menores',
    business: 'Negocios',
    about: 'Acerca',
    portal: 'Mi portal',
    quote: 'Iniciar su caso',
    start: 'Iniciar preparación de documentos',
    phoneCta: '📞 +1 (916) 399-3992'
  }
};

export const FOOTER: Record<Locale, {
  servicesUscis: string;
  servicesCivil: string;
  about: string;
  brandLine: string;
  disclaimer: string;
}> = {
  // The footer renders the disclaimer as two lines: legal status first,
  // then the bonding/registration cite. The `||` marker is the split
  // point — keeping it as one string lets each locale read naturally
  // when the markers are removed.
  en: {
    servicesUscis: 'USCIS / EOIR',
    servicesCivil: 'California Court',
    about: 'About',
    brandLine: 'Legal Document Assistant · Immigration Consultant · California',
    disclaimer: '© {year} Imverica Legal Solutions — a registered & bonded California Legal Document Assistant and Immigration Consultant (Cal. Bus. & Prof. Code §§6400-6415 and §§22440-22448).||Imverica is not a law firm and is not a substitute for an attorney. We do not provide legal advice, and no attorney-client relationship is created by use of this site. Documents are prepared solely at the client\'s direction. If you need legal advice, consult a licensed attorney.'
  },
  ru: {
    servicesUscis: 'USCIS / EOIR',
    servicesCivil: 'Калифорнийский суд',
    about: 'О нас',
    brandLine: 'Помощник по юридическим документам · Иммиграционный консультант · Калифорния',
    disclaimer: '© {year} Imverica Legal Solutions — зарегистрированный и застрахованный California Legal Document Assistant и Immigration Consultant (Cal. Bus. & Prof. Code §§6400-6415 и §§22440-22448).||Imverica не является юридической фирмой и не заменяет адвоката. Мы не предоставляем юридических консультаций; отношения «адвокат-клиент» не возникают при использовании этого сайта. Документы готовятся исключительно по поручению клиента. Если вам нужна юридическая консультация — обратитесь к лицензированному адвокату.'
  },
  uk: {
    servicesUscis: 'USCIS / EOIR',
    servicesCivil: 'Каліфорнійський суд',
    about: 'Про нас',
    brandLine: 'Помічник з юридичних документів · Імміграційний консультант · Каліфорнія',
    disclaimer: '© {year} Imverica Legal Solutions — зареєстрований і застрахований California Legal Document Assistant та Immigration Consultant (Cal. Bus. & Prof. Code §§6400-6415 та §§22440-22448).||Imverica не є юридичною фірмою і не замінює адвоката. Ми не надаємо юридичних консультацій; відносини «адвокат-клієнт» не виникають при використанні цього сайту. Документи готуються виключно за дорученням клієнта. Якщо вам потрібна юридична консультація — зверніться до ліцензованого адвоката.'
  },
  es: {
    servicesUscis: 'USCIS / EOIR',
    servicesCivil: 'Corte de California',
    about: 'Sobre nosotros',
    brandLine: 'Asistente de Documentos Legales · Consultor de Inmigración · California',
    disclaimer: '© {year} Imverica Legal Solutions — California Legal Document Assistant e Immigration Consultant registrado y afianzado (Cal. Bus. & Prof. Code §§6400-6415 y §§22440-22448).||Imverica no es un bufete de abogados ni un sustituto de un abogado. No brindamos asesoría legal; no se crea relación abogado-cliente por el uso de este sitio. Los documentos se preparan únicamente bajo la dirección del cliente. Si necesita asesoría legal, consulte a un abogado con licencia.'
  }
};

/** Hero strings for the homepage per locale. */
export const HERO: Record<Locale, {
  eyebrow: string;
  heading: string;
  sub: string;
}> = {
  en: {
    eyebrow: 'California · Licensed LDA · Immigration Consultant',
    heading: 'What document do you need prepared?',
    sub: 'Describe your situation or enter a form number. We prepare USCIS petitions (I-485, I-130, I-765, I-589, N-400, I-131, I-90), EOIR immigration court documents, California family law forms (FL-100, FL-300), small claims (SC-100), unlawful detainer, restraining orders, probate, and fee waivers — for clients across California and worldwide.'
  },
  ru: {
    eyebrow: 'Калифорния · Лицензированный LDA · Иммиграционный консультант',
    heading: 'Какой документ нужно подготовить?',
    sub: 'Опишите свою ситуацию или введите номер формы. Мы готовим петиции USCIS (I-485, I-130, I-765, I-589, N-400, I-131, I-90), документы иммиграционного суда EOIR, калифорнийские формы семейного права (FL-100, FL-300), малые иски (SC-100), unlawful detainer (выселение), защитные ордера, наследственные дела и заявления об освобождении от пошлины — для клиентов по всей Калифорнии и по всему миру.'
  },
  uk: {
    eyebrow: 'Каліфорнія · Ліцензований LDA · Імміграційний консультант',
    heading: 'Який документ потрібно підготувати?',
    sub: 'Опишіть свою ситуацію або введіть номер форми. Ми готуємо петиції USCIS (I-485, I-130, I-765, I-589, N-400, I-131, I-90), документи імміграційного суду EOIR, каліфорнійські форми сімейного права (FL-100, FL-300), малі позови (SC-100), unlawful detainer (виселення), захисні ордери, спадкові справи та заяви про звільнення від мита — для клієнтів по всій Каліфорнії та по всьому світу.'
  },
  es: {
    eyebrow: 'California · LDA con licencia · Consultor de inmigración',
    heading: '¿Qué documento necesita preparar?',
    sub: 'Describa su situación o ingrese un número de formulario. Preparamos peticiones de USCIS (I-485, I-130, I-765, I-589, N-400, I-131, I-90), documentos del tribunal de inmigración EOIR, formularios de derecho familiar de California (FL-100, FL-300), reclamos menores (SC-100), unlawful detainer (desalojo), órdenes de restricción, sucesiones y exenciones de tasas — para clientes en todo California y en todo el mundo.'
  }
};

/** Stats strip labels per locale. Numbers stay numeric. */
export const STATS: Record<Locale, string[]> = {
  en: [
    'USCIS, EOIR & California forms supported',
    'Priority forms with curated flows',
    'Languages — EN · RU · UA · ES',
    'Years preparing California & USCIS forms'
  ],
  ru: [
    'Форм USCIS, EOIR и Калифорнии в работе',
    'Приоритетных форм с готовой анкетой',
    'Языка — EN · RU · UA · ES',
    'Лет подготовки документов USCIS и Калифорнии'
  ],
  uk: [
    'Форм USCIS, EOIR і Каліфорнії в роботі',
    'Пріоритетних форм з готовою анкетою',
    'Мови — EN · RU · UA · ES',
    'Років підготовки документів USCIS і Каліфорнії'
  ],
  es: [
    'Formularios USCIS, EOIR y California compatibles',
    'Formularios prioritarios con flujos guiados',
    'Idiomas — EN · RU · UA · ES',
    'Años preparando formularios de California y USCIS'
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
