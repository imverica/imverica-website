/**
 * Apple-style global-nav flyouts (v2 design). One entry per top-level nav
 * item; the item label itself comes from NAV in i18n.ts.
 *
 * Link targets:
 *   slug — an internal page; rendered through localizedPathSafe so RU/UA/MX
 *          visitors stay in their language where the page exists.
 *   href — used verbatim (tel:, sms:, mailto:, external, /account.html).
 *          Hrefs starting with "/#" get the locale prefix (homepage intake).
 *
 * Column 0 of every section is the "big" column (large bold links), the
 * rest are small link lists — same hierarchy as apple.com's flyouts.
 * RU / UA / ES labels come from MEGA_I18N via megaLabel() (bottom).
 */
import type { Locale } from '~/data/i18n';

export type MegaLink = { label: string; slug?: string; href?: string };
export type MegaColumn = { heading: string; links: MegaLink[] };
export type MegaKey =
  | 'uscis' | 'family' | 'civil' | 'criminal' | 'business'
  | 'pricing' | 'forAttorneys' | 'about';
export type MegaSection = { key: MegaKey; slug: string; columns: MegaColumn[] };

export const MEGA_NAV: MegaSection[] = [
  {
    key: 'uscis',
    slug: '/immigration',
    columns: [
      {
        heading: 'Explore Immigration',
        links: [
          { label: 'All Immigration Services', slug: '/immigration' },
          { label: 'Green Card', slug: '/i-485-help' },
          { label: 'Citizenship', slug: '/n-400-citizenship-help' },
          { label: 'Family Petition', slug: '/i-130-family-petition' },
          { label: 'Work Permit', slug: '/i-765-work-permit-help' },
          { label: 'Asylum', slug: '/i-589-asylum-help' },
          { label: 'Immigration Court', slug: '/eoir-immigration-court' }
        ]
      },
      {
        heading: 'Humanitarian',
        links: [
          { label: 'Uniting for Ukraine (U4U)', slug: '/u4u' },
          { label: 'TPS', slug: '/tps' },
          { label: 'U Visa', slug: '/u-visa-help' },
          { label: 'VAWA Self-Petition', slug: '/vawa-self-petition' },
          { label: 'Change of Status · I-539', slug: '/i-539-change-of-status' }
        ]
      },
      {
        heading: 'More USCIS Forms',
        links: [
          { label: 'Green Card Renewal · I-90', slug: '/i-90-green-card-renewal' },
          { label: 'Travel Document · I-131', slug: '/i-131-travel-document' },
          { label: 'Returning Resident · I-131A', slug: '/i-131a-returning-resident' },
          { label: 'Affidavit of Support · I-864', slug: '/i-864-affidavit-of-support' },
          { label: 'Household Member · I-864A', slug: '/i-864a-household-member' },
          { label: 'Medical Exam · I-693', slug: '/i-693-medical-examination' },
          { label: 'Remove Conditions · I-751', slug: '/i-751-remove-conditions' },
          { label: 'Document Review', slug: '/uscis-document-review' }
        ]
      },
      {
        heading: 'Immigration Court',
        links: [
          { label: 'Appeal to the BIA · EOIR-29', slug: '/eoir-29-notice-of-appeal' },
          { label: 'Cancellation (LPR) · EOIR-42A', slug: '/eoir-42a-cancellation-lpr' },
          { label: 'Cancellation (non-LPR) · EOIR-42B', slug: '/eoir-42b-cancellation-non-lpr' },
          { label: 'Suspension · EOIR-40', slug: '/eoir-40-suspension-of-deportation' }
        ]
      }
    ]
  },
  {
    key: 'family',
    slug: '/fl',
    columns: [
      {
        heading: 'Explore Family Law',
        links: [
          { label: 'All Family Law', slug: '/fl' },
          { label: 'Divorce', slug: '/fl-100-divorce' },
          { label: 'Response to Divorce', slug: '/fl-120-divorce-response' },
          { label: 'Request for Order', slug: '/fl-300-request-for-order' },
          { label: 'Restraining Orders', slug: '/california-restraining-orders' }
        ]
      },
      {
        heading: 'Disclosures & Filings',
        links: [
          { label: 'Income & Expense · FL-150', slug: '/fl-150-income-expense-declaration' },
          { label: 'Property Declaration · FL-160', slug: '/fl-160-property-declaration' },
          { label: 'Custody Jurisdiction · FL-105', slug: '/fl-105-uccjea' },
          { label: 'Court Fee Waiver · FW-001', slug: '/fw-001-fee-waiver' }
        ]
      },
      {
        heading: 'Good to Know',
        links: [
          { label: 'What a Legal Document Assistant Does', slug: '/lda' },
          { label: 'Flat-Fee Pricing', slug: '/pricing' },
          { label: 'Schedule a Consultation', slug: '/schedule' }
        ]
      }
    ]
  },
  {
    key: 'civil',
    slug: '/sc',
    columns: [
      {
        heading: 'Explore Civil',
        links: [
          { label: 'All Civil & Small Claims', slug: '/sc' },
          { label: 'Small Claims', slug: '/sc-100-plaintiff-claim' },
          { label: 'Demand Letter', slug: '/demand-letter' },
          { label: 'Eviction', slug: '/california-unlawful-detainer' },
          { label: 'Name Change', slug: '/california-name-change' },
          { label: 'Probate', slug: '/california-probate' }
        ]
      },
      {
        heading: 'Small Claims Forms',
        links: [
          { label: "Defendant's Claim · SC-120", slug: '/sc-120-defendant-claim' },
          { label: 'Proof of Service · SC-104', slug: '/sc-104-proof-of-service' },
          { label: 'Memorandum of Costs · SC-133', slug: '/sc-133-memorandum-of-costs' },
          { label: 'Installment Payments · SC-140', slug: '/sc-140-installments' }
        ]
      },
      {
        heading: 'Collect a Judgment',
        links: [
          { label: 'Wage Garnishment · WG-001', slug: '/wg-001-wage-garnishment' },
          { label: 'Abstract of Judgment · EJ-001', slug: '/ej-001-abstract-of-judgment' },
          { label: 'Court Fee Waiver · FW-001', slug: '/fw-001-fee-waiver' }
        ]
      }
    ]
  },
  {
    key: 'criminal',
    slug: '/criminal',
    columns: [
      {
        heading: 'Explore Record Clearing',
        links: [
          { label: 'All Record Clearing', slug: '/criminal' },
          { label: 'Expungement', slug: '/california-expungement' },
          { label: 'Start a Record-Clearing Packet', href: '/#get-started?service=record-clearing' }
        ]
      },
      {
        heading: 'Petitions We Prepare',
        links: [
          { label: 'Misdemeanor & Felony Dismissal', slug: '/california-expungement' },
          { label: 'Felony → Misdemeanor Reduction', slug: '/criminal' },
          { label: 'Early Probation Termination', slug: '/criminal' },
          { label: 'Arrest & Juvenile Record Sealing', slug: '/criminal' },
          { label: 'Prop 64 Cannabis Relief', slug: '/criminal' }
        ]
      },
      {
        heading: 'Good to Know',
        links: [
          { label: 'Court Fee Waiver · FW-001', slug: '/fw-001-fee-waiver' },
          { label: 'What a Legal Document Assistant Does', slug: '/lda' }
        ]
      }
    ]
  },
  {
    key: 'business',
    slug: '/business',
    columns: [
      {
        heading: 'Explore Business',
        links: [
          { label: 'All Business Filings', slug: '/business' },
          { label: 'Form an LLC', slug: '/llc-1-form-an-llc' },
          { label: 'Incorporate', slug: '/arts-gs-incorporation' },
          { label: 'DBA', slug: '/fbn-dba' },
          { label: 'EIN', slug: '/ss-4-ein' }
        ]
      },
      {
        heading: 'Stay Compliant',
        links: [
          { label: 'LLC Statement · LLC-12', slug: '/llc-12-statement-of-information' },
          { label: 'Corporation Statement · SI-550', slug: '/si-550-corporation-statement' },
          { label: 'Operating Agreement', slug: '/operating-agreement' },
          { label: 'Foreign LLC · LLC-1A', slug: '/llc-1a-foreign-llc' }
        ]
      }
    ]
  },
  {
    key: 'pricing',
    slug: '/pricing',
    columns: [
      {
        heading: 'Pricing',
        links: [
          { label: 'All Flat-Fee Prices', slug: '/pricing' },
          { label: 'Start Your Case', href: '/#get-started' },
          { label: 'Schedule a Consultation', slug: '/schedule' }
        ]
      },
      {
        heading: 'Good to Know',
        links: [
          { label: 'Court Fee Waivers', slug: '/fw-001-fee-waiver' },
          { label: 'What a Legal Document Assistant Does', slug: '/lda' },
          { label: 'Client Reviews', slug: '/testimonials' }
        ]
      }
    ]
  },
  {
    key: 'forAttorneys',
    slug: '/for-attorneys',
    columns: [
      {
        heading: 'For Attorneys',
        links: [
          { label: 'Overflow Document Preparation', slug: '/for-attorneys' },
          { label: 'Send a Sample Matter', href: '/#get-started?topic=for-attorneys' },
          { label: 'Book a Partnership Call', slug: '/schedule' }
        ]
      },
      {
        heading: 'Practice Areas',
        links: [
          { label: 'USCIS & EOIR', slug: '/immigration' },
          { label: 'Family Law', slug: '/fl' },
          { label: 'Civil & Small Claims', slug: '/sc' },
          { label: 'Business Filings', slug: '/business' }
        ]
      }
    ]
  },
  {
    key: 'about',
    slug: '/about',
    columns: [
      {
        heading: 'About Imverica',
        links: [
          { label: 'About Us', slug: '/about' },
          { label: 'Client Reviews', slug: '/testimonials' },
          { label: 'What Is an LDA?', slug: '/lda' }
        ]
      },
      {
        heading: 'Contact',
        links: [
          { label: 'Call +1 (916) 399-3992', href: 'tel:+19163993992' },
          { label: 'Message Us', href: 'sms:+19163993992' },
          { label: 'Schedule a Consultation', slug: '/schedule' },
          { label: 'Telegram', href: 'https://t.me/imverica' },
          { label: 'info@imverica.com', href: 'mailto:info@imverica.com' }
        ]
      },
      {
        heading: 'Company',
        links: [
          { label: 'Company Facts & Registration', slug: '/about-imverica-legal-solutions' },
          { label: 'Client Portal', href: '/account.html' }
        ]
      }
    ]
  }
];

/**
 * RU / UA / ES labels for the flyouts. kind 'form': a form, case type or
 * program name — the English stays and the exact translation follows in
 * parentheses ("Green Card Renewal · I-90 (продление грин-карты)").
 * kind 'text': everything else, fully translated.
 */
type MegaTr = { kind: 'form' | 'text'; ru: string; uk: string; es: string };
const f = (ru: string, uk: string, es: string): MegaTr => ({ kind: 'form', ru, uk, es });
const x = (ru: string, uk: string, es: string): MegaTr => ({ kind: 'text', ru, uk, es });

export const MEGA_I18N: Record<string, MegaTr> = {
  // headings
  'Explore Immigration': x('Иммиграция', 'Імміграція', 'Inmigración'),
  'Humanitarian': x('Гуманитарные программы', 'Гуманітарні програми', 'Programas humanitarios'),
  'More USCIS Forms': x('Другие формы USCIS', 'Інші форми USCIS', 'Más formularios de USCIS'),
  'Immigration Court': f('иммиграционный суд', 'імміграційний суд', 'tribunal de inmigración'),
  'Explore Family Law': x('Семейное право', 'Сімейне право', 'Derecho familiar'),
  'Disclosures & Filings': x('Раскрытие сведений и подача', 'Розкриття відомостей і подання', 'Declaraciones y presentaciones'),
  'Good to Know': x('Полезно знать', 'Корисно знати', 'Información útil'),
  'Explore Civil': x('Гражданские дела', 'Цивільні справи', 'Asuntos civiles'),
  'Small Claims Forms': x('Формы малых исков', 'Форми малих позовів', 'Formularios de reclamos menores'),
  'Collect a Judgment': x('Взыскание по решению суда', 'Стягнення за рішенням суду', 'Cobrar una sentencia'),
  'Explore Record Clearing': x('Очистка судимости', 'Очищення судимості', 'Limpieza de antecedentes'),
  'Petitions We Prepare': x('Ходатайства, которые мы готовим', 'Клопотання, які ми готуємо', 'Peticiones que preparamos'),
  'Explore Business': x('Бизнес', 'Бізнес', 'Negocios'),
  'Stay Compliant': x('Отчётность и соответствие', 'Звітність і відповідність', 'Cumplimiento'),
  'Pricing': x('Цены', 'Ціни', 'Precios'),
  'For Attorneys': x('Для адвокатов', 'Для адвокатів', 'Para abogados'),
  'Practice Areas': x('Направления', 'Напрями', 'Áreas de práctica'),
  'About Imverica': x('Об Imverica', 'Про Imverica', 'Sobre Imverica'),
  'Contact': x('Контакты', 'Контакти', 'Contacto'),
  'Company': x('Компания', 'Компанія', 'Empresa'),
  'Language': x('Язык', 'Мова', 'Idioma'),

  // USCIS | EOIR
  'All Immigration Services': x('Все иммиграционные услуги', 'Усі імміграційні послуги', 'Todos los servicios de inmigración'),
  'Green Card': f('грин-карта', 'грін-карта', 'tarjeta de residencia'),
  'Citizenship': f('гражданство', 'громадянство', 'ciudadanía'),
  'Family Petition': f('семейная петиция', 'сімейна петиція', 'petición familiar'),
  'Work Permit': f('разрешение на работу', 'дозвіл на роботу', 'permiso de trabajo'),
  'Asylum': f('убежище', 'притулок', 'asilo'),
  'Uniting for Ukraine (U4U)': x('Uniting for Ukraine · U4U (Объединяемся ради Украины)', 'Uniting for Ukraine · U4U (Об’єднуємося заради України)', 'Uniting for Ukraine · U4U (Unidos por Ucrania)'),
  'TPS': x('TPS (временный защищённый статус)', 'TPS (тимчасовий захищений статус)', 'TPS (estatus de protección temporal)'),
  'U Visa': f('виза U', 'віза U', 'visa U'),
  'VAWA Self-Petition': f('самостоятельная петиция по VAWA', 'самостійна петиція за VAWA', 'autopetición VAWA'),
  'Change of Status · I-539': f('смена статуса', 'зміна статусу', 'cambio de estatus'),
  'Green Card Renewal · I-90': f('продление грин-карты', 'поновлення грін-карти', 'renovación de la tarjeta de residencia'),
  'Travel Document · I-131': f('проездной документ', 'проїзний документ', 'documento de viaje'),
  'Returning Resident · I-131A': f('возвращающийся резидент', 'резидент, що повертається', 'residente que regresa'),
  'Affidavit of Support · I-864': f('аффидевит о финансовой поддержке', 'афідевіт про фінансову підтримку', 'declaración jurada de patrocinio económico'),
  'Household Member · I-864A': f('член домохозяйства', 'член домогосподарства', 'miembro del hogar'),
  'Medical Exam · I-693': f('медицинский осмотр', 'медичний огляд', 'examen médico'),
  'Remove Conditions · I-751': f('снятие условий', 'зняття умов', 'eliminación de condiciones'),
  'Document Review': x('Проверка документов', 'Перевірка документів', 'Revisión de documentos'),
  'Appeal to the BIA · EOIR-29': f('апелляция в BIA', 'апеляція до BIA', 'apelación ante la BIA'),
  'Cancellation (LPR) · EOIR-42A': f('отмена высылки для LPR', 'скасування видворення для LPR', 'cancelación de deportación para LPR'),
  'Cancellation (non-LPR) · EOIR-42B': f('отмена высылки для non-LPR', 'скасування видворення для non-LPR', 'cancelación de deportación para no LPR'),
  'Suspension · EOIR-40': f('приостановление депортации', 'призупинення депортації', 'suspensión de deportación'),

  // Family Law
  'All Family Law': x('Всё по семейному праву', 'Усе із сімейного права', 'Todo derecho familiar'),
  'Divorce': f('развод', 'розлучення', 'divorcio'),
  'Response to Divorce': f('ответ на иск о разводе', 'відповідь на позов про розлучення', 'respuesta al divorcio'),
  'Request for Order': f('ходатайство о судебном приказе', 'клопотання про судовий наказ', 'solicitud de orden judicial'),
  'Restraining Orders': f('защитные ордера', 'захисні ордери', 'órdenes de restricción'),
  'Income & Expense · FL-150': f('декларация о доходах и расходах', 'декларація про доходи та витрати', 'declaración de ingresos y gastos'),
  'Property Declaration · FL-160': f('декларация об имуществе', 'декларація про майно', 'declaración de bienes'),
  'Custody Jurisdiction · FL-105': f('юрисдикция по опеке', 'юрисдикція щодо опіки', 'jurisdicción de custodia'),
  'Court Fee Waiver · FW-001': f('освобождение от судебной пошлины', 'звільнення від судового збору', 'exención de cuotas judiciales'),
  'What a Legal Document Assistant Does': x('Чем занимается Legal Document Assistant', 'Чим займається Legal Document Assistant', 'Qué hace un Legal Document Assistant'),
  'Flat-Fee Pricing': x('Фиксированные цены', 'Фіксовані ціни', 'Precios fijos'),
  'Schedule a Consultation': x('Записаться на консультацию', 'Записатися на консультацію', 'Agendar una consulta'),

  // Civil
  'All Civil & Small Claims': x('Все гражданские дела и малые иски', 'Усі цивільні справи та малі позови', 'Todo civil y reclamos menores'),
  'Small Claims': f('малые иски', 'малі позови', 'reclamos menores'),
  'Demand Letter': f('досудебная претензия', 'досудова претензія', 'carta de demanda'),
  'Eviction': f('выселение', 'виселення', 'desalojo'),
  'Name Change': f('смена имени', 'зміна імені', 'cambio de nombre'),
  'Probate': f('наследственное дело', 'спадкова справа', 'sucesión'),
  "Defendant's Claim · SC-120": f('встречный иск ответчика', 'зустрічний позов відповідача', 'reclamo del demandado'),
  'Proof of Service · SC-104': f('подтверждение вручения', 'підтвердження вручення', 'prueba de entrega'),
  'Memorandum of Costs · SC-133': f('меморандум о расходах', 'меморандум про витрати', 'memorándum de costos'),
  'Installment Payments · SC-140': f('выплата в рассрочку', 'виплата в розстрочку', 'pagos a plazos'),
  'Wage Garnishment · WG-001': f('удержание из заработной платы', 'утримання із заробітної плати', 'embargo de salario'),
  'Abstract of Judgment · EJ-001': f('выписка из судебного решения', 'витяг із судового рішення', 'extracto de sentencia'),

  // Record Clearing
  'All Record Clearing': x('Всё об очистке судимости', 'Усе про очищення судимості', 'Toda la limpieza de antecedentes'),
  'Expungement': f('снятие судимости', 'зняття судимості', 'eliminación de antecedentes penales'),
  'Start a Record-Clearing Packet': x('Начать пакет по очистке судимости', 'Почати пакет з очищення судимості', 'Iniciar un paquete de limpieza de antecedentes'),
  'Misdemeanor & Felony Dismissal': f('прекращение дела о проступке или тяжком преступлении', 'закриття справи про проступок або тяжкий злочин', 'desestimación de delito menor o grave'),
  'Felony → Misdemeanor Reduction': f('переквалификация тяжкого преступления в проступок', 'перекваліфікація тяжкого злочину на проступок', 'reducción de delito grave a menor'),
  'Early Probation Termination': f('досрочное прекращение пробации', 'дострокове припинення пробації', 'terminación anticipada de la libertad condicional'),
  'Arrest & Juvenile Record Sealing': f('засекречивание записей об аресте и несовершеннолетних', 'засекречування записів про арешт і неповнолітніх', 'sellado de registros de arresto y de menores'),
  'Prop 64 Cannabis Relief': f('смягчение по делам о каннабисе по Prop 64', 'пом’якшення у справах про канабіс за Prop 64', 'alivio por cannabis según la Prop 64'),

  // Business
  'All Business Filings': x('Все документы для бизнеса', 'Усі документи для бізнесу', 'Todos los trámites de negocios'),
  'Form an LLC': f('регистрация LLC', 'реєстрація LLC', 'formar una LLC'),
  'Incorporate': f('регистрация корпорации', 'реєстрація корпорації', 'constituir una corporación'),
  'DBA': f('вымышленное название бизнеса', 'фіктивна назва бізнесу', 'nombre comercial ficticio'),
  'EIN': f('идентификационный номер работодателя', 'ідентифікаційний номер роботодавця', 'número de identificación del empleador'),
  'LLC Statement · LLC-12': f('сведения об LLC', 'відомості про LLC', 'declaración informativa de la LLC'),
  'Corporation Statement · SI-550': f('сведения о корпорации', 'відомості про корпорацію', 'declaración informativa de la corporación'),
  'Operating Agreement': f('операционное соглашение', 'операційна угода', 'acuerdo operativo'),
  'Foreign LLC · LLC-1A': f('иностранная LLC', 'іноземна LLC', 'LLC extranjera'),

  // Pricing
  'All Flat-Fee Prices': x('Все фиксированные цены', 'Усі фіксовані ціни', 'Todos los precios fijos'),
  'Start Your Case': x('Начать кейс', 'Почати кейс', 'Iniciar su caso'),
  'Court Fee Waivers': f('освобождение от судебных пошлин', 'звільнення від судових зборів', 'exenciones de cuotas judiciales'),
  'Client Reviews': x('Отзывы клиентов', 'Відгуки клієнтів', 'Opiniones de clientes'),

  // For Attorneys
  'Overflow Document Preparation': x('Подготовка документов при перегрузке', 'Підготовка документів у разі перевантаження', 'Preparación de documentos por exceso de trabajo'),
  'Send a Sample Matter': x('Отправить пример дела', 'Надіслати приклад справи', 'Enviar un caso de muestra'),
  'Book a Partnership Call': x('Записаться на звонок о партнёрстве', 'Записатися на дзвінок щодо партнерства', 'Agendar una llamada de colaboración'),
  'Family Law': x('Семейное право', 'Сімейне право', 'Derecho familiar'),
  'Civil & Small Claims': x('Гражданские дела и малые иски', 'Цивільні справи та малі позови', 'Civil y reclamos menores'),
  'Business Filings': x('Документы для бизнеса', 'Документи для бізнесу', 'Trámites de negocios'),

  // About
  'About Us': x('О нас', 'Про нас', 'Sobre nosotros'),
  'What Is an LDA?': x('Что такое LDA?', 'Що таке LDA?', '¿Qué es un LDA?'),
  'Call +1 (916) 399-3992': x('Позвонить +1 (916) 399-3992', 'Зателефонувати +1 (916) 399-3992', 'Llamar al +1 (916) 399-3992'),
  'Message Us': x('Написать нам', 'Написати нам', 'Escríbanos'),
  'Company Facts & Registration': x('Сведения о компании и регистрация', 'Відомості про компанію та реєстрація', 'Datos de la empresa y registro'),
  'Client Portal': x('Личный кабинет', 'Особистий кабінет', 'Portal del cliente')
};

/**
 * Flyout label for a locale: `main` is what reads first, `note` the
 * parenthesised translation of a form name (empty otherwise). English and
 * unknown labels pass through.
 */
export function megaLabel(label: string, lang: Locale): { main: string; note: string } {
  const tr = lang === 'en' ? undefined : MEGA_I18N[label];
  if (!tr) return { main: label, note: '' };
  return tr.kind === 'form' ? { main: label, note: `(${tr[lang]})` } : { main: tr[lang], note: '' };
}
