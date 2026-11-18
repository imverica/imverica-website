/**
 * Pricing page content in four languages, rendered by
 * components/PricingPage.astro for /pricing, /ru/pricing, /ua/pricing and
 * /mx/pricing.
 *
 * Every amount lives here once, so all four pages always show the same
 * prices. The English page shows each price as before; the Russian,
 * Ukrainian and Spanish pages put "от / від / desde" in front of every
 * price (the owner's rule). scripts/qa-pricing-locales.js checks both.
 */
import type { Locale } from '~/data/i18n';
// Last snapshot of the official USCIS fees (G-1055); the page refreshes it
// live from /api/uscis-fees.
import uscisSnapshot from '../../../netlify/functions/data/uscis-fees.json';

export type L = Record<Locale, string>;

/** A price: a flat amount, a range, or a custom quote. */
export type Price =
  | { amount: number; to?: number; from?: boolean; unit?: 'each' | 'page' }
  | 'quote';

export type Gov = 'uscis' | 'court' | 'agency' | 'eoir' | 'county' | 'ifApplicable' | 'na';

export interface Row {
  /** Bold part: a form number (same in every language) or a localized name. */
  strong: string | L;
  /** Plain text after the bold part. */
  rest?: L;
  /** Second line under the name (a list of form numbers or a short note). */
  meta?: string | L;
  price: Price;
  gov: Gov;
  prefill?: L;
  formCode?: string;
  popular?: boolean;
}

export interface Category {
  color: 'navy' | 'terracotta' | 'terracotta-deep' | 'sage' | 'gold';
  icon: string;
  iconPrefill: L;
  iconAria: L;
  kicker: L;
  title: L;
  sub: L;
  /** Header of the fee column (English page only; others use the shared one). */
  feeHead?: L;
  govHead: 'filing' | 'court';
  rows: Row[];
  /** Optional divider row inserted before the row with this index. */
  divider?: { before: number; label: L };
  /** Disclaimer under the table (may contain <strong>/<em>). */
  disclaimerHtml: L;
}

const l = (en: string, ru: string, uk: string, es: string): L => ({ en, ru, uk, es });

// ── Shared labels ──────────────────────────────────────────────────────────
export const UI = {
  service: l('Service', 'Услуга', 'Послуга', 'Servicio'),
  fee: l('Imverica fee', 'Стоимость Imverica', 'Вартість Imverica', 'Tarifa de Imverica'),
  startingAt: l('Starting at', 'Стоимость Imverica', 'Вартість Imverica', 'Tarifa de Imverica'),
  govFiling: l('Official filing fee*', 'Госпошлина*', 'Держмито*', 'Tarifa oficial de presentación*'),
  govCourt: l('Official court fee*', 'Судебный сбор*', 'Судовий збір*', 'Tarifa oficial de la corte*'),
  from: l('from', 'от', 'від', 'desde'),
  to: l('–', 'до', 'до', 'hasta'),
  each: l('each', 'за документ', 'за документ', 'por documento'),
  page: l('/page', 'за страницу', 'за сторінку', 'por página'),
  /** Link to the form's current fee on USCIS G-1055, Fee Schedule. */
  uscisFee: l('USCIS fee ↗', 'Госпошлина USCIS ↗', 'Держмито USCIS ↗', 'Tarifa de USCIS ↗'),
  uscisFeeTitle: l('Current filing fee on the official USCIS Fee Schedule (G-1055)', 'Актуальная госпошлина в официальной таблице USCIS (G-1055)', 'Актуальне держмито в офіційній таблиці USCIS (G-1055)', 'Tarifa vigente en la tabla oficial de USCIS (G-1055)'),
  feeTip: {
    paper: l('Paper filing', 'Подача на бумаге', 'Подання на папері', 'Presentación en papel'),
    online: l('online', 'онлайн', 'онлайн', 'en línea'),
    extra: l('Plus the separate fees required by Pub. L. 119-21 — see uscis.gov.', 'Плюс отдельные сборы по закону Pub. L. 119-21 — см. uscis.gov.', 'Плюс окремі збори за законом Pub. L. 119-21 — див. uscis.gov.', 'Más las tarifas aparte que exige la Pub. L. 119-21; vea uscis.gov.'),
    source: l('Source: USCIS Fee Schedule, Form G-1055.', 'Источник: таблица пошлин USCIS, форма G-1055.', 'Джерело: таблиця мит USCIS, форма G-1055.', 'Fuente: tabla de tarifas de USCIS, formulario G-1055.')
  },
  feeFootnote: l(
    '* USCIS fees are read from the official USCIS Fee Schedule (Form G-1055): the general filing category, paper filing. Other categories and online filing can cost less; click the amount to see every category on uscis.gov. Court and agency fees: verify with the court or agency.',
    '* Госпошлины USCIS берутся из официальной таблицы USCIS (форма G-1055): общая категория, подача на бумаге. Для других категорий и онлайн-подачи сумма может быть меньше; нажмите на сумму, чтобы увидеть все категории на uscis.gov. Судебные сборы и пошлины ведомств уточняйте в суде или ведомстве.',
    '* Держмито USCIS береться з офіційної таблиці USCIS (форма G-1055): загальна категорія, подання на папері. Для інших категорій та онлайн-подання сума може бути меншою; натисніть на суму, щоб побачити всі категорії на uscis.gov. Судові збори та мита відомств уточнюйте в суді або відомстві.',
    '* Las tarifas de USCIS se leen de la tabla oficial de USCIS (formulario G-1055): categoría general, presentación en papel. Otras categorías y la presentación en línea pueden costar menos; haga clic en el monto para ver todas las categorías en uscis.gov. Las tarifas de la corte o de otras agencias se verifican con ellas.'
  ),
  quote: l('custom quote', 'индивидуальный расчёт', 'індивідуальний розрахунок', 'cotización personalizada'),
  gov: {
    uscis: l('Verify with USCIS', 'Уточняйте в USCIS', 'Уточнюйте в USCIS', 'Verifique con USCIS'),
    court: l('Verify with court', 'Уточняйте в суде', 'Уточнюйте в суді', 'Verifique con la corte'),
    agency: l('Verify with agency', 'Уточняйте в ведомстве', 'Уточнюйте у відомстві', 'Verifique con la agencia'),
    eoir: l('Verify with EOIR', 'Уточняйте в EOIR', 'Уточнюйте в EOIR', 'Verifique con EOIR'),
    county: l('Verify with county', 'Уточняйте в округе', 'Уточнюйте в окрузі', 'Verifique con el condado'),
    ifApplicable: l('Verify if applicable', 'Уточняйте, если применимо', 'Уточнюйте, якщо застосовно', 'Verifique si aplica'),
    na: l('Not applicable', 'Не применяется', 'Не застосовується', 'No aplica')
  } as Record<Gov, L>
};

/**
 * The official USCIS fee page for a row: G-1055 with the form preselected,
 * or the whole schedule for a multi-form package.
 */
export interface UscisFee { paper: number; online: number | null; category: string; extraFees?: boolean }

/** The USCIS fee of a single-form row from the last snapshot, if known. */
export function uscisFee(row: Row): UscisFee | null {
  if (row.gov !== 'uscis' || !row.formCode || row.meta) return null;
  const fees = (uscisSnapshot as { fees: Record<string, UscisFee> }).fees || {};
  return fees[row.formCode] || null;
}

/** "$1,440" */
export const usd = (n: number) => '$' + n.toLocaleString('en-US');

/** Tooltip of a USCIS fee: paper and online amounts and the category. */
export function uscisFeeTitle(fee: UscisFee, lang: Locale): string {
  const L = UI.feeTip;
  const online = fee.online === null ? '' : ` · ${L.online[lang]} ${usd(fee.online)}`;
  const category = fee.category ? ` (${fee.category})` : '';
  const extra = fee.extraFees ? ` ${L.extra[lang]}` : '';
  return `${L.paper[lang]} ${usd(fee.paper)}${online}${category}.${extra} ${L.source[lang]}`;
}

/** The amount shown in the cell: "$1,440", or "$0+" when Pub. L. 119-21 fees apply too. */
export const uscisFeeLabel = (fee: UscisFee) => `${usd(fee.paper)}${fee.extraFees ? '+' : ''} ↗`;

export function uscisFeeUrl(row: Row): string | null {
  if (row.gov !== 'uscis' || !row.formCode) return null;
  return row.meta ? 'https://www.uscis.gov/g-1055' : `https://www.uscis.gov/g-1055?form=${row.formCode.toLowerCase()}`;
}

/** The price as shown on the page in the given language. */
export function priceText(price: Price, lang: Locale): string {
  if (price === 'quote') return UI.quote[lang];
  const usd = (n: number) => '$' + n.toLocaleString('en-US');
  if (lang === 'en') {
    let s = usd(price.amount);
    if (price.to) s += '–' + usd(price.to);
    if (price.unit === 'page') s += '/page';
    if (price.unit === 'each') s += ' each';
    return price.from ? 'from ' + s : s;
  }
  // Russian, Ukrainian, Spanish: "от" before every price.
  let s = `${UI.from[lang]} ${usd(price.amount)}`;
  if (price.to) s += ` ${UI.to[lang]} ${usd(price.to)}`;
  if (price.unit) s += ' ' + (price.unit === 'page' ? UI.page[lang] : UI.each[lang]);
  return s;
}

// ── Page copy ─────────────────────────────────────────────────────────────
export const PAGE = {
  title: l(
    'Pricing — Flat-Fee Document Preparation | Imverica Legal Solutions',
    'Цены на подготовку документов | Imverica Legal Solutions',
    'Ціни на підготовку документів | Imverica Legal Solutions',
    'Precios de preparación de documentos | Imverica Legal Solutions'
  ),
  description: l(
    'Transparent pricing for client-selected USCIS and California documents, plus separate attorney-directed EOIR support. Larger document packets are quoted after complete intake. Imverica is not a law firm.',
    'Цены на подготовку выбранных клиентом документов USCIS и судов Калифорнии. Отдельно — поддержка по делам EOIR по поручению адвоката. Крупные пакеты рассчитываются после анкеты. Imverica не юридическая фирма.',
    'Ціни на підготовку обраних клієнтом документів USCIS і судів Каліфорнії. Окремо — підтримка у справах EOIR за дорученням адвоката. Великі пакети розраховуються після анкети. Imverica не юридична фірма.',
    'Precios para preparar los documentos de USCIS y de las cortes de California que el cliente elige, y apoyo aparte en asuntos de EOIR bajo la dirección de un abogado. Los paquetes grandes se cotizan tras el cuestionario. Imverica no es un bufete de abogados.'
  ),
  eyebrow: l(
    'Flat fees · no hourly creep · no surprises',
    'Фиксированная цена · без почасовой оплаты · без сюрпризов',
    'Фіксована ціна · без погодинної оплати · без сюрпризів',
    'Tarifas fijas · sin cobro por hora · sin sorpresas'
  ),
  heading: l('Transparent flat-fee pricing', 'Прозрачные фиксированные цены', 'Прозорі фіксовані ціни', 'Precios fijos y transparentes'),
  headingHtml: l(
    'Transparent <em class="hero-em">flat-fee</em> pricing',
    'Прозрачные <em class="hero-em">фиксированные</em> цены',
    'Прозорі <em class="hero-em">фіксовані</em> ціни',
    'Precios <em class="hero-em">fijos</em> y transparentes'
  ),
  sub: l(
    'Flat fees per client-selected document or packet. Government filing fees are paid separately to USCIS, the court, or the Secretary of State. Documents are prepared at your direction — Imverica is not a law firm and does not provide legal advice.',
    'Фиксированная цена за документ или пакет, который вы выбрали. Госпошлины оплачиваются отдельно — в USCIS, суд или Secretary of State. Документы готовятся по вашему поручению. Imverica не юридическая фирма и не даёт юридических консультаций.',
    'Фіксована ціна за документ або пакет, який ви обрали. Держмито сплачується окремо — до USCIS, суду або Secretary of State. Документи готуються за вашим дорученням. Imverica не юридична фірма і не надає юридичних консультацій.',
    'Tarifa fija por cada documento o paquete que usted elige. Las tarifas del gobierno se pagan aparte a USCIS, a la corte o al Secretary of State. Preparamos los documentos bajo su dirección: Imverica no es un bufete de abogados y no da asesoría legal.'
  ),
  ctaQuote: l('Request a written quote', 'Запросить письменный расчёт', 'Запросити письмовий розрахунок', 'Pedir una cotización por escrito'),
  ctaHeading: l('Ready to request a written quote?', 'Готовы запросить письменный расчёт?', 'Готові запросити письмовий розрахунок?', '¿Listo para pedir una cotización por escrito?'),
  ctaSub: l(
    'Send a short intake or call us. After you identify the documents you selected and complete intake, we confirm the scope, flat fee, and estimated preparation schedule in writing.',
    'Заполните короткую анкету или позвоните нам. Когда вы назовёте выбранные документы и заполните анкету, мы письменно подтвердим объём работы, фиксированную цену и примерные сроки подготовки.',
    'Заповніть коротку анкету або зателефонуйте нам. Коли ви назвете обрані документи й заповните анкету, ми письмово підтвердимо обсяг роботи, фіксовану ціну та орієнтовні строки підготовки.',
    'Envíe un cuestionario corto o llámenos. Cuando nos indique los documentos que eligió y complete el cuestionario, confirmamos por escrito el alcance, la tarifa fija y el plazo estimado de preparación.'
  ),
  ctaPrimary: l('Request a quote', 'Запросить расчёт', 'Запросити розрахунок', 'Pedir cotización')
};

const CA_REMOTE = l('California clients · remote document preparation', 'Клиенты в Калифорнии · удалённая подготовка документов', 'Клієнти в Каліфорнії · дистанційна підготовка документів', 'Clientes en California · preparación de documentos a distancia');
const LDA_LAW = '<em>Cal. Bus. & Prof. Code §§6400–6415.</em>';

const pf = (code: string) => l(
  `I selected Form ${code} and want a preparation quote`,
  `Я выбрал(а) форму ${code} и хочу расчёт подготовки`,
  `Я обрав(ла) форму ${code} і хочу розрахунок підготовки`,
  `Elegí el formulario ${code} y quiero una cotización de preparación`
);
const pfMany = (codes: string) => l(
  `I selected ${codes} and want a preparation quote`,
  `Я выбрал(а) ${codes} и хочу расчёт подготовки`,
  `Я обрав(ла) ${codes} і хочу розрахунок підготовки`,
  `Elegí ${codes} y quiero una cotización de preparación`
);
const clientSelectedForms = l('client-selected forms', 'формы, выбранные клиентом', 'форми, обрані клієнтом', 'formularios elegidos por el cliente');
const clientSelectedForm = l('client-selected form', 'форма, выбранная клиентом', 'форма, обрана клієнтом', 'formulario elegido por el cliente');

// ── Categories ────────────────────────────────────────────────────────────
export const CATEGORIES: Category[] = [
  {
    color: 'navy',
    icon: '🛂',
    iconPrefill: l('I already selected a USCIS form and want a preparation quote.', 'Я уже выбрал(а) форму USCIS и хочу расчёт подготовки.', 'Я вже обрав(ла) форму USCIS і хочу розрахунок підготовки.', 'Ya elegí un formulario de USCIS y quiero una cotización de preparación.'),
    iconAria: l('Request a quote for a client-selected USCIS form', 'Запросить расчёт для выбранной формы USCIS', 'Запросити розрахунок для обраної форми USCIS', 'Pedir cotización para un formulario de USCIS elegido'),
    kicker: CA_REMOTE,
    title: l('Simple USCIS forms', 'Простые формы USCIS', 'Прості форми USCIS', 'Formularios sencillos de USCIS'),
    sub: l(
      'For a form you have already selected. The estimated preparation schedule is confirmed after complete intake.',
      'Для формы, которую вы уже выбрали. Примерные сроки подготовки подтверждаем после полной анкеты.',
      'Для форми, яку ви вже обрали. Орієнтовні строки підготовки підтверджуємо після повної анкети.',
      'Para un formulario que usted ya eligió. El plazo estimado de preparación se confirma tras el cuestionario completo.'
    ),
    govHead: 'filing',
    rows: [
      { strong: 'I-90', rest: l('Green Card renewal / replacement', 'Продление / замена грин-карты', 'Продовження / заміна грін-карти', 'Renovación / reemplazo de la Green Card'), price: { amount: 199 }, gov: 'uscis', prefill: pf('I-90'), formCode: 'I-90' },
      { strong: 'I-765', rest: l('Work Permit / EAD', 'Разрешение на работу / EAD', 'Дозвіл на роботу / EAD', 'Permiso de trabajo / EAD'), price: { amount: 199 }, gov: 'uscis', prefill: pf('I-765'), formCode: 'I-765' },
      { strong: 'I-131', rest: l('Travel Document / Re-entry Permit', 'Документ для поездок / Re-entry Permit', 'Документ для поїздок / Re-entry Permit', 'Documento de viaje / Re-entry Permit'), price: { amount: 179 }, gov: 'uscis', prefill: pf('I-131'), formCode: 'I-131' },
      { strong: 'I-864', rest: l('Affidavit of Support (standalone)', 'Аффидевит о финансовой поддержке (отдельно)', 'Афідевіт про фінансову підтримку (окремо)', 'Declaración jurada de patrocinio (por separado)'), price: { amount: 199 }, gov: 'uscis', prefill: pf('I-864'), formCode: 'I-864' },
      { strong: 'I-693', rest: l('Medical Exam package coordination', 'Координация пакета медосмотра', 'Координація пакета медогляду', 'Coordinación del paquete del examen médico'), price: { amount: 129 }, gov: 'uscis', prefill: l('I selected Form I-693 and want a coordination quote', 'Я выбрал(а) форму I-693 и хочу расчёт координации', 'Я обрав(ла) форму I-693 і хочу розрахунок координації', 'Elegí el formulario I-693 y quiero una cotización de coordinación'), formCode: 'I-693' },
      { strong: 'G-639', rest: l('FOIA Request to USCIS', 'Запрос FOIA в USCIS', 'Запит FOIA до USCIS', 'Solicitud FOIA a USCIS'), price: { amount: 149 }, gov: 'uscis', prefill: pf('G-639'), formCode: 'G-639' },
      { strong: 'AR-11', rest: l('Change of Address', 'Смена адреса', 'Зміна адреси', 'Cambio de dirección'), price: { amount: 79 }, gov: 'uscis', prefill: pf('AR-11'), formCode: 'AR-11' }
    ],
    disclaimerHtml: l(
      'Document preparation only — no legal advice, no form selection on your behalf, no outcome guarantees. Imverica is not a law firm.',
      'Только подготовка документов — без юридических консультаций, без выбора формы за вас, без гарантий результата. Imverica не юридическая фирма.',
      'Лише підготовка документів — без юридичних консультацій, без вибору форми за вас, без гарантій результату. Imverica не юридична фірма.',
      'Solo preparación de documentos: sin asesoría legal, sin elegir el formulario por usted y sin garantía de resultados. Imverica no es un bufete de abogados.'
    )
  },
  {
    color: 'terracotta',
    icon: '👨‍👩‍👧',
    iconPrefill: l('I already selected family-based immigration forms and want a preparation quote.', 'Я уже выбрал(а) формы семейной иммиграции и хочу расчёт подготовки.', 'Я вже обрав(ла) форми сімейної імміграції і хочу розрахунок підготовки.', 'Ya elegí formularios de inmigración familiar y quiero una cotización de preparación.'),
    iconAria: l('Request a quote for client-selected family-based immigration forms', 'Запросить расчёт для выбранных форм семейной иммиграции', 'Запросити розрахунок для обраних форм сімейної імміграції', 'Pedir cotización para formularios de inmigración familiar elegidos'),
    kicker: CA_REMOTE,
    title: l('Family-based immigration', 'Семейная иммиграция', 'Сімейна імміграція', 'Inmigración familiar'),
    sub: l(
      'Clerical preparation for forms the client has already selected. Multi-form pricing applies only to the requested forms listed in the written scope.',
      'Техническая подготовка форм, которые клиент уже выбрал. Цена за несколько форм действует только для форм, перечисленных в письменном объёме работ.',
      'Технічна підготовка форм, які клієнт уже обрав. Ціна за кілька форм діє лише для форм, перелічених у письмовому обсязі робіт.',
      'Preparación administrativa de los formularios que el cliente ya eligió. El precio por varios formularios aplica solo a los formularios indicados en el alcance por escrito.'
    ),
    govHead: 'filing',
    rows: [
      { strong: 'I-130', rest: l('Family Petition (standalone)', 'Семейная петиция (отдельно)', 'Сімейна петиція (окремо)', 'Petición familiar (por separado)'), price: { amount: 499 }, gov: 'uscis', prefill: pf('I-130'), formCode: 'I-130' },
      { strong: 'I-485', rest: l('Adjustment of Status (single applicant)', 'Смена статуса (один заявитель)', 'Зміна статусу (один заявник)', 'Ajuste de estatus (un solicitante)'), price: { amount: 999 }, gov: 'uscis', prefill: pf('I-485'), formCode: 'I-485' },
      {
        strong: l('Client-selected I-485 package', 'Пакет I-485, выбранный клиентом', 'Пакет I-485, обраний клієнтом', 'Paquete I-485 elegido por el cliente'),
        meta: l('I-130 + I-485 + I-765 + I-864 + client-selected attachments', 'I-130 + I-485 + I-765 + I-864 + выбранные клиентом приложения', 'I-130 + I-485 + I-765 + I-864 + обрані клієнтом додатки', 'I-130 + I-485 + I-765 + I-864 + anexos elegidos por el cliente'),
        price: { amount: 1799 }, gov: 'uscis', prefill: pfMany('I-130, I-485, I-765, and I-864'), formCode: 'I-485', popular: true
      },
      { strong: 'I-751', rest: l('Remove Conditions on Green Card', 'Снятие условий с грин-карты', 'Зняття умов з грін-карти', 'Quitar condiciones de la Green Card'), price: { amount: 899 }, gov: 'uscis', prefill: pf('I-751'), formCode: 'I-751' },
      { strong: 'N-400', rest: l('Naturalization', 'Натурализация', 'Натуралізація', 'Naturalización'), price: { amount: 599 }, gov: 'uscis', prefill: pf('N-400'), formCode: 'N-400' },
      { strong: 'I-824', rest: l('Action on Approved Application', 'Действие по одобренному заявлению', 'Дія щодо схваленої заяви', 'Acción sobre una solicitud aprobada'), price: { amount: 249 }, gov: 'uscis', prefill: pf('I-824'), formCode: 'I-824' }
    ],
    disclaimerHtml: l(
      'Final pricing depends on the number of applicants, forms, pages, and client-selected attachments in the written scope. Government filing fees are paid directly to USCIS. Imverica is not a law firm.',
      'Итоговая цена зависит от числа заявителей, форм, страниц и выбранных клиентом приложений в письменном объёме работ. Госпошлины оплачиваются напрямую в USCIS. Imverica не юридическая фирма.',
      'Підсумкова ціна залежить від кількості заявників, форм, сторінок і обраних клієнтом додатків у письмовому обсязі робіт. Держмито сплачується безпосередньо до USCIS. Imverica не юридична фірма.',
      'El precio final depende del número de solicitantes, formularios, páginas y anexos elegidos por el cliente en el alcance por escrito. Las tarifas del gobierno se pagan directamente a USCIS. Imverica no es un bufete de abogados.'
    )
  },
  {
    color: 'terracotta-deep',
    icon: '📋',
    iconPrefill: l('I already selected an immigration form or document packet and want a clerical preparation quote.', 'Я уже выбрал(а) иммиграционную форму или пакет документов и хочу расчёт технической подготовки.', 'Я вже обрав(ла) імміграційну форму або пакет документів і хочу розрахунок технічної підготовки.', 'Ya elegí un formulario o paquete de inmigración y quiero una cotización de preparación administrativa.'),
    iconAria: l('Request a quote for a client-selected immigration document packet', 'Запросить расчёт для выбранного пакета иммиграционных документов', 'Запросити розрахунок для обраного пакета імміграційних документів', 'Pedir cotización para un paquete de documentos de inmigración elegido'),
    kicker: l('California direct clients · separate attorney-directed EOIR support', 'Клиенты в Калифорнии · отдельно: EOIR по поручению адвоката', 'Клієнти в Каліфорнії · окремо: EOIR за дорученням адвоката', 'Clientes en California · aparte: EOIR bajo la dirección de un abogado'),
    title: l('Complex immigration document packages', 'Сложные пакеты иммиграционных документов', 'Складні пакети імміграційних документів', 'Paquetes complejos de documentos de inmigración'),
    sub: l(
      'USCIS preparation is for forms and document packets a California client already selected. EOIR work is accepted only in a separate engagement from a licensed attorney who directs and reviews the work.',
      'Подготовка для USCIS — для форм и пакетов, которые клиент в Калифорнии уже выбрал. Работа по EOIR принимается только по отдельному договору с лицензированным адвокатом, который руководит работой и проверяет её.',
      'Підготовка для USCIS — для форм і пакетів, які клієнт у Каліфорнії вже обрав. Робота з EOIR приймається лише за окремим договором з ліцензованим адвокатом, який керує роботою та перевіряє її.',
      'La preparación para USCIS es para formularios y paquetes que un cliente en California ya eligió. El trabajo de EOIR se acepta solo en un contrato aparte con un abogado con licencia que dirige y revisa el trabajo.'
    ),
    feeHead: UI.startingAt,
    govHead: 'filing',
    rows: [
      { strong: 'I-589', rest: l('client-selected form preparation', 'подготовка формы, выбранной клиентом', 'підготовка форми, обраної клієнтом', 'preparación del formulario elegido por el cliente'), price: { amount: 1599, from: true }, gov: 'uscis', prefill: l('I selected Form I-589 and want a clerical preparation quote', 'Я выбрал(а) форму I-589 и хочу расчёт технической подготовки', 'Я обрав(ла) форму I-589 і хочу розрахунок технічної підготовки', 'Elegí el formulario I-589 y quiero una cotización de preparación administrativa'), formCode: 'I-589' },
      { strong: l('RFE document packet', 'Пакет документов по RFE', 'Пакет документів за RFE', 'Paquete de documentos para RFE'), rest: l('at client direction', 'по поручению клиента', 'за дорученням клієнта', 'bajo la dirección del cliente'), price: { amount: 399, to: 899 }, gov: 'uscis', prefill: l('I received an RFE and selected the documents for a clerical response packet', 'Я получил(а) RFE и выбрал(а) документы для пакета ответа', 'Я отримав(ла) RFE і обрав(ла) документи для пакета відповіді', 'Recibí un RFE y elegí los documentos para el paquete de respuesta') },
      { strong: l('Client-selected evidence packet', 'Пакет доказательств, выбранных клиентом', 'Пакет доказів, обраних клієнтом', 'Paquete de pruebas elegidas por el cliente'), rest: l('assembly', '— сборка', '— збирання', '— armado'), price: { amount: 599, from: true }, gov: 'agency', prefill: l('I selected documents for an evidence packet and want an assembly quote', 'Я выбрал(а) документы для пакета доказательств и хочу расчёт сборки', 'Я обрав(ла) документи для пакета доказів і хочу розрахунок збирання', 'Elegí documentos para un paquete de pruebas y quiero una cotización de armado') },
      { strong: l('Attorney-directed EOIR filing support', 'Подготовка подачи в EOIR по поручению адвоката', 'Підготовка подання до EOIR за дорученням адвоката', 'Apoyo de presentación ante EOIR bajo la dirección de un abogado'), price: 'quote', gov: 'eoir', prefill: l('I am a licensed attorney requesting EOIR filing support', 'Я лицензированный адвокат, мне нужна подготовка подачи в EOIR', 'Я ліцензований адвокат, мені потрібна підготовка подання до EOIR', 'Soy abogado con licencia y necesito apoyo de presentación ante EOIR') },
      { strong: l('Attorney-directed EOIR exhibit and document assembly', 'Сборка приложений и документов для EOIR по поручению адвоката', 'Збирання додатків і документів для EOIR за дорученням адвоката', 'Armado de anexos y documentos para EOIR bajo la dirección de un abogado'), price: 'quote', gov: 'eoir', prefill: l('I am a licensed attorney requesting EOIR exhibit and document assembly', 'Я лицензированный адвокат, мне нужна сборка приложений и документов для EOIR', 'Я ліцензований адвокат, мені потрібне збирання додатків і документів для EOIR', 'Soy abogado con licencia y necesito el armado de anexos y documentos para EOIR') },
      { strong: l('Client-selected humanitarian forms', 'Гуманитарные формы, выбранные клиентом', 'Гуманітарні форми, обрані клієнтом', 'Formularios humanitarios elegidos por el cliente'), price: 'quote', gov: 'agency', prefill: l('I already selected a humanitarian form and want a clerical preparation quote', 'Я уже выбрал(а) гуманитарную форму и хочу расчёт технической подготовки', 'Я вже обрав(ла) гуманітарну форму і хочу розрахунок технічної підготовки', 'Ya elegí un formulario humanitario y quiero una cotización de preparación administrativa') }
    ],
    disclaimerHtml: l(
      "Direct document preparation is limited to California clients who already selected the USCIS form or document. EOIR support is provided only to a licensed attorney under that attorney's direction and review. We do not give legal advice, determine eligibility, select defenses or strategy, predict outcomes, or provide representation. Imverica is not a law firm.",
      'Подготовка документов напрямую — только для клиентов в Калифорнии, которые уже выбрали форму или документ USCIS. Поддержка по EOIR — только лицензированному адвокату, под его руководством и с его проверкой. Мы не даём юридических консультаций, не определяем право на льготу, не выбираем защиту или стратегию, не прогнозируем результат и не представляем интересы. Imverica не юридическая фирма.',
      'Підготовка документів напряму — лише для клієнтів у Каліфорнії, які вже обрали форму або документ USCIS. Підтримка з EOIR — лише ліцензованому адвокату, під його керівництвом і з його перевіркою. Ми не надаємо юридичних консультацій, не визначаємо право на пільгу, не обираємо захист чи стратегію, не прогнозуємо результат і не представляємо інтереси. Imverica не юридична фірма.',
      'La preparación directa de documentos es solo para clientes en California que ya eligieron el formulario o documento de USCIS. El apoyo en EOIR se da solo a un abogado con licencia, bajo su dirección y revisión. No damos asesoría legal, no determinamos elegibilidad, no elegimos defensas ni estrategia, no predecimos resultados y no representamos a nadie. Imverica no es un bufete de abogados.'
    )
  },
  {
    color: 'sage',
    icon: '⚖️',
    iconPrefill: l('I already selected California court forms and want a preparation quote.', 'Я уже выбрал(а) формы судов Калифорнии и хочу расчёт подготовки.', 'Я вже обрав(ла) форми судів Каліфорнії і хочу розрахунок підготовки.', 'Ya elegí formularios de las cortes de California y quiero una cotización de preparación.'),
    iconAria: l('Request a quote for client-selected California court forms', 'Запросить расчёт для выбранных форм судов Калифорнии', 'Запросити розрахунок для обраних форм судів Каліфорнії', 'Pedir cotización para formularios de las cortes de California elegidos'),
    kicker: l('California state courts only', 'Только суды штата Калифорния', 'Лише суди штату Каліфорнія', 'Solo cortes del estado de California'),
    title: l('California court forms', 'Формы судов Калифорнии', 'Форми судів Каліфорнії', 'Formularios de las cortes de California'),
    sub: l(
      'Clerical preparation of California court forms selected by the client. Package pricing covers only the forms listed in the written scope.',
      'Техническая подготовка форм судов Калифорнии, выбранных клиентом. Цена пакета включает только формы, перечисленные в письменном объёме работ.',
      'Технічна підготовка форм судів Каліфорнії, обраних клієнтом. Ціна пакета включає лише форми, перелічені в письмовому обсязі робіт.',
      'Preparación administrativa de formularios de las cortes de California elegidos por el cliente. El precio del paquete cubre solo los formularios indicados en el alcance por escrito.'
    ),
    govHead: 'court',
    rows: [
      { strong: l('Client-selected FL-100 package', 'Пакет FL-100, выбранный клиентом', 'Пакет FL-100, обраний клієнтом', 'Paquete FL-100 elegido por el cliente'), meta: 'FL-100 + FL-110 + FL-115', price: { amount: 349, from: true }, gov: 'court', prefill: pfMany('FL-100, FL-110, and FL-115'), formCode: 'FL-100', popular: true },
      { strong: l('FL-100 Full Divorce', 'FL-100 полный развод', 'FL-100 повне розлучення', 'FL-100 divorcio completo'), rest: l('client-selected package', '— пакет, выбранный клиентом', '— пакет, обраний клієнтом', '— paquete elegido por el cliente'), price: { amount: 799, from: true }, gov: 'court', prefill: l('I selected an FL-100 package with the forms I need', 'Я выбрал(а) пакет FL-100 с нужными мне формами', 'Я обрав(ла) пакет FL-100 з потрібними мені формами', 'Elegí un paquete FL-100 con los formularios que necesito'), formCode: 'FL-100' },
      { strong: 'FL-300', rest: l('Request for Order', 'Request for Order (ходатайство)', 'Request for Order (клопотання)', 'Request for Order (solicitud de orden)'), price: { amount: 349 }, gov: 'court', prefill: pf('FL-300'), formCode: 'FL-300' },
      { strong: 'FL-150 / FL-160', rest: l('Financial disclosures', 'Финансовые декларации', 'Фінансові декларації', 'Declaraciones financieras'), price: { amount: 199, unit: 'each' }, gov: 'court', prefill: pfMany('FL-150 or FL-160'), formCode: 'FL-150' },
      { strong: l('Client-selected post-judgment forms', 'Формы после решения суда, выбранные клиентом', 'Форми після рішення суду, обрані клієнтом', 'Formularios posteriores a la sentencia elegidos por el cliente'), price: { amount: 499, from: true }, gov: 'court', prefill: l('I already selected post-judgment forms and want a preparation quote', 'Я уже выбрал(а) формы после решения суда и хочу расчёт подготовки', 'Я вже обрав(ла) форми після рішення суду і хочу розрахунок підготовки', 'Ya elegí formularios posteriores a la sentencia y quiero una cotización de preparación') },
      { strong: l('Client-selected SC-100 package', 'Пакет SC-100, выбранный клиентом', 'Пакет SC-100, обраний клієнтом', 'Paquete SC-100 elegido por el cliente'), meta: 'SC-100 + POS-010', price: { amount: 249 }, gov: 'court', prefill: pfMany('SC-100 and POS-010'), formCode: 'SC-100', popular: true },
      { strong: l('Client-directed demand letter', 'Письмо-требование по указанию клиента', 'Лист-вимога за вказівкою клієнта', 'Carta de reclamo bajo la dirección del cliente'), price: { amount: 149 }, gov: 'ifApplicable', prefill: l('I selected a demand-letter document and want a preparation quote', 'Я выбрал(а) письмо-требование и хочу расчёт подготовки', 'Я обрав(ла) лист-вимогу і хочу розрахунок підготовки', 'Elegí una carta de reclamo y quiero una cotización de preparación') },
      { strong: 'WG-001 / EJ-001', rest: clientSelectedForms, price: { amount: 199 }, gov: 'court', prefill: pfMany('WG-001 or EJ-001') },
      { strong: l('Client-selected UD response form', 'Форма ответа по выселению (UD), выбранная клиентом', 'Форма відповіді щодо виселення (UD), обрана клієнтом', 'Formulario de respuesta de desalojo (UD) elegido por el cliente'), price: { amount: 349 }, gov: 'court', prefill: l('I selected an unlawful-detainer response form and want a preparation quote', 'Я выбрал(а) форму ответа по выселению и хочу расчёт подготовки', 'Я обрав(ла) форму відповіді щодо виселення і хочу розрахунок підготовки', 'Elegí un formulario de respuesta de desalojo y quiero una cotización de preparación') },
      { strong: l('Client-selected restraining-order forms', 'Формы запретительного ордера, выбранные клиентом', 'Форми заборонного ордера, обрані клієнтом', 'Formularios de orden de restricción elegidos por el cliente'), price: 'quote', gov: 'court', prefill: l('I selected restraining-order forms and want a preparation quote', 'Я выбрал(а) формы запретительного ордера и хочу расчёт подготовки', 'Я обрав(ла) форми заборонного ордера і хочу розрахунок підготовки', 'Elegí formularios de orden de restricción y quiero una cotización de preparación') },
      { strong: l('Client-selected probate starter', 'Стартовый документ по наследству, выбранный клиентом', 'Стартовий документ щодо спадщини, обраний клієнтом', 'Documento inicial de sucesión elegido por el cliente'), rest: l('/ small-estate document', '/ документ по малому наследству', '/ документ щодо малої спадщини', '/ documento de herencia pequeña'), price: { amount: 249, from: true }, gov: 'court', prefill: l('I selected a small-estate or probate document and want a preparation quote', 'Я выбрал(а) документ по наследству и хочу расчёт подготовки', 'Я обрав(ла) документ щодо спадщини і хочу розрахунок підготовки', 'Elegí un documento de sucesión o herencia pequeña y quiero una cotización de preparación'), formCode: 'DE-111' },
      { strong: l('DE-111 Probate', 'DE-111 наследство', 'DE-111 спадщина', 'DE-111 sucesión'), rest: l('petition', '— петиция', '— петиція', '— petición'), price: { amount: 799, from: true }, gov: 'court', prefill: pf('DE-111'), formCode: 'DE-111' },
      { strong: l('Client-selected probate forms', 'Формы по наследству, выбранные клиентом', 'Форми щодо спадщини, обрані клієнтом', 'Formularios de sucesión elegidos por el cliente'), rest: l('package', '— пакет', '— пакет', '— paquete'), price: { amount: 1599, from: true }, gov: 'court', prefill: l('I selected DE-111, DE-121, DE-160, or DE-221 and want a package quote', 'Я выбрал(а) DE-111, DE-121, DE-160 или DE-221 и хочу расчёт пакета', 'Я обрав(ла) DE-111, DE-121, DE-160 або DE-221 і хочу розрахунок пакета', 'Elegí DE-111, DE-121, DE-160 o DE-221 y quiero una cotización del paquete'), formCode: 'DE-111' },
      { strong: 'DE-295', rest: l('client-selected probate form', 'форма по наследству, выбранная клиентом', 'форма щодо спадщини, обрана клієнтом', 'formulario de sucesión elegido por el cliente'), price: { amount: 499, from: true }, gov: 'court', prefill: pf('DE-295'), formCode: 'DE-295' }
    ],
    disclaimerHtml: l(
      `Document preparation under your direction. We do not give legal advice, choose the form for you, or represent you in court. ${LDA_LAW}`,
      `Подготовка документов по вашему поручению. Мы не даём юридических консультаций, не выбираем форму за вас и не представляем вас в суде. ${LDA_LAW}`,
      `Підготовка документів за вашим дорученням. Ми не надаємо юридичних консультацій, не обираємо форму за вас і не представляємо вас у суді. ${LDA_LAW}`,
      `Preparación de documentos bajo su dirección. No damos asesoría legal, no elegimos el formulario por usted y no lo representamos en la corte. ${LDA_LAW}`
    )
  },
  {
    color: 'terracotta',
    icon: '🧹',
    iconPrefill: l('I want to clear my California record myself and need the petition prepared.', 'Я хочу сам(а) снять судимость в Калифорнии, нужна подготовка петиции.', 'Я хочу сам(а) зняти судимість у Каліфорнії, потрібна підготовка петиції.', 'Quiero limpiar mis antecedentes en California por mi cuenta y necesito preparar la petición.'),
    iconAria: l('Start record-clearing intake', 'Начать анкету по снятию судимости', 'Почати анкету щодо зняття судимості', 'Empezar el cuestionario para limpiar antecedentes'),
    kicker: l('Clear your own record · In Pro Per', 'Снятие судимости самостоятельно · In Pro Per', 'Зняття судимості самостійно · In Pro Per', 'Limpie sus antecedentes por su cuenta · In Pro Per'),
    title: l('California record clearing', 'Снятие судимости в Калифорнии', 'Зняття судимості в Каліфорнії', 'Limpieza de antecedentes en California'),
    sub: l(
      'Petitions you file yourself, prepared by us. Flat fees, no hidden costs. Court filing fees, if any, are separate and often waivable (FW-001).',
      'Петиции, которые вы подаёте сами, а готовим мы. Фиксированная цена, без скрытых платежей. Судебные сборы, если есть, оплачиваются отдельно, и от них часто можно освободиться (FW-001).',
      'Петиції, які ви подаєте самі, а готуємо ми. Фіксована ціна, без прихованих платежів. Судові збори, якщо є, сплачуються окремо, і від них часто можна звільнитися (FW-001).',
      'Peticiones que usted presenta por su cuenta y que nosotros preparamos. Tarifas fijas, sin costos ocultos. Las tarifas de la corte, si las hay, son aparte y a menudo se pueden exentar (FW-001).'
    ),
    govHead: 'court',
    rows: [
      { strong: 'CR-180 / CR-181', rest: clientSelectedForms, price: { amount: 449, from: true }, gov: 'court', prefill: pfMany('CR-180 or CR-181'), formCode: 'CR-180' },
      { strong: 'CR-180', rest: l('client-selected form · DUI-related matter', 'форма, выбранная клиентом · дело, связанное с DUI', 'форма, обрана клієнтом · справа, пов’язана з DUI', 'formulario elegido por el cliente · caso relacionado con DUI'), price: { amount: 449, from: true }, gov: 'court', prefill: l('I selected CR-180 for a DUI-related matter and want a preparation quote', 'Я выбрал(а) CR-180 по делу, связанному с DUI, и хочу расчёт подготовки', 'Я обрав(ла) CR-180 у справі, пов’язаній з DUI, і хочу розрахунок підготовки', 'Elegí CR-180 para un caso relacionado con DUI y quiero una cotización de preparación'), formCode: 'CR-180' },
      { strong: 'CR-180', rest: l('client-selected form · felony matter', 'форма, выбранная клиентом · дело о тяжком преступлении (felony)', 'форма, обрана клієнтом · справа про тяжкий злочин (felony)', 'formulario elegido por el cliente · caso de delito grave (felony)'), price: { amount: 499, from: true }, gov: 'court', prefill: l('I selected CR-180 for a felony matter and want a preparation quote', 'Я выбрал(а) CR-180 по делу felony и хочу расчёт подготовки', 'Я обрав(ла) CR-180 у справі felony і хочу розрахунок підготовки', 'Elegí CR-180 para un caso de delito grave y quiero una cotización de preparación'), formCode: 'CR-180' },
      { strong: 'CR-180', rest: l('client-selected form · infraction matter', 'форма, выбранная клиентом · дело о нарушении (infraction)', 'форма, обрана клієнтом · справа про порушення (infraction)', 'formulario elegido por el cliente · caso de infracción'), price: { amount: 349, from: true }, gov: 'court', prefill: l('I selected CR-180 for an infraction matter and want a preparation quote', 'Я выбрал(а) CR-180 по делу о нарушении и хочу расчёт подготовки', 'Я обрав(ла) CR-180 у справі про порушення і хочу розрахунок підготовки', 'Elegí CR-180 para un caso de infracción y quiero una cotización de preparación'), formCode: 'CR-180' },
      { strong: l('Attorney-advised PC §17(b) document preparation', 'Подготовка документов по PC §17(b) по совету адвоката', 'Підготовка документів за PC §17(b) за порадою адвоката', 'Preparación de documentos PC §17(b) por consejo de un abogado'), price: { amount: 499, from: true }, gov: 'court', prefill: l('An attorney advised me to request a PC 17(b) reduction and I want a clerical preparation quote', 'Адвокат посоветовал мне запросить снижение по PC 17(b), хочу расчёт технической подготовки', 'Адвокат порадив мені запросити зниження за PC 17(b), хочу розрахунок технічної підготовки', 'Un abogado me aconsejó pedir una reducción PC 17(b) y quiero una cotización de preparación administrativa'), formCode: 'CR-180' },
      { strong: l('Attorney-advised PC §1203.3 document preparation', 'Подготовка документов по PC §1203.3 по совету адвоката', 'Підготовка документів за PC §1203.3 за порадою адвоката', 'Preparación de documentos PC §1203.3 por consejo de un abogado'), price: { amount: 449, from: true }, gov: 'court', prefill: l('An attorney advised me to request early termination of probation and I want a clerical preparation quote', 'Адвокат посоветовал мне запросить досрочное прекращение пробации, хочу расчёт технической подготовки', 'Адвокат порадив мені запросити дострокове припинення пробації, хочу розрахунок технічної підготовки', 'Un abogado me aconsejó pedir la terminación anticipada de la libertad condicional y quiero una cotización de preparación administrativa') },
      { strong: 'CR-409 / CR-410', rest: clientSelectedForms, price: { amount: 499, from: true }, gov: 'court', prefill: pfMany('CR-409 or CR-410'), formCode: 'CR-409' },
      { strong: 'JV-595', rest: clientSelectedForm, price: { amount: 499, from: true }, gov: 'court', prefill: pfMany('JV-595'), formCode: 'JV-595' },
      { strong: l('Attorney-advised Prop 64 document preparation', 'Подготовка документов по Prop 64 по совету адвоката', 'Підготовка документів за Prop 64 за порадою адвоката', 'Preparación de documentos de la Prop 64 por consejo de un abogado'), price: { amount: 399, from: true }, gov: 'court', prefill: l('An attorney advised me about Prop 64 relief and I want a clerical preparation quote', 'Адвокат проконсультировал меня по Prop 64, хочу расчёт технической подготовки', 'Адвокат проконсультував мене щодо Prop 64, хочу розрахунок технічної підготовки', 'Un abogado me aconsejó sobre la Prop 64 y quiero una cotización de preparación administrativa') },
      { strong: l('Multiple client-selected record-clearing forms', 'Несколько форм по снятию судимости, выбранных клиентом', 'Кілька форм щодо зняття судимості, обраних клієнтом', 'Varios formularios de limpieza de antecedentes elegidos por el cliente'), price: 'quote', gov: 'court', prefill: l('I selected record-clearing forms for multiple matters and want a preparation quote', 'Я выбрал(а) формы по снятию судимости по нескольким делам и хочу расчёт подготовки', 'Я обрав(ла) форми щодо зняття судимості в кількох справах і хочу розрахунок підготовки', 'Elegí formularios de limpieza de antecedentes para varios casos y quiero una cotización de preparación'), formCode: 'CR-180' }
    ],
    disclaimerHtml: l(
      `Self-help document preparation under your direction. We do not decide eligibility, give legal advice, or appear in court. We do <strong>not</strong> handle Certificates of Rehabilitation, Governor's Pardons, ending PC 290 registration, or firearm-rights restoration — those need a criminal-defense attorney. ${LDA_LAW}`,
      `Подготовка документов для самостоятельной подачи по вашему поручению. Мы не решаем, имеете ли вы право на снятие судимости, не даём юридических консультаций и не выступаем в суде. Мы <strong>не</strong> занимаемся Certificates of Rehabilitation, помилованием губернатора, прекращением регистрации по PC 290 и восстановлением права на оружие — для этого нужен адвокат по уголовным делам. ${LDA_LAW}`,
      `Підготовка документів для самостійного подання за вашим дорученням. Ми не вирішуємо, чи маєте ви право на зняття судимості, не надаємо юридичних консультацій і не виступаємо в суді. Ми <strong>не</strong> займаємося Certificates of Rehabilitation, помилуванням губернатора, припиненням реєстрації за PC 290 і відновленням права на зброю — для цього потрібен адвокат у кримінальних справах. ${LDA_LAW}`,
      `Preparación de documentos de autoayuda bajo su dirección. No decidimos la elegibilidad, no damos asesoría legal ni comparecemos en la corte. <strong>No</strong> tramitamos Certificates of Rehabilitation, indultos del gobernador, el fin del registro PC 290 ni la restauración del derecho a armas: eso requiere un abogado penalista. ${LDA_LAW}`
    )
  },
  {
    color: 'gold',
    icon: '🏢',
    iconPrefill: l('I already selected a business filing, translation, or notary service and want a quote.', 'Я уже выбрал(а) бизнес-регистрацию, перевод или нотариальную услугу и хочу расчёт.', 'Я вже обрав(ла) бізнес-реєстрацію, переклад або нотаріальну послугу і хочу розрахунок.', 'Ya elegí un trámite de negocio, una traducción o un servicio notarial y quiero una cotización.'),
    iconAria: l('Request a quote for a selected business filing or document service', 'Запросить расчёт для выбранной бизнес-регистрации или услуги', 'Запросити розрахунок для обраної бізнес-реєстрації або послуги', 'Pedir cotización para un trámite de negocio o servicio elegido'),
    kicker: l('California business + service add-ons', 'Бизнес в Калифорнии + дополнительные услуги', 'Бізнес у Каліфорнії + додаткові послуги', 'Negocios en California + servicios adicionales'),
    title: l('Business filings · translation · notary', 'Бизнес-регистрация · перевод · нотариус', 'Бізнес-реєстрація · переклад · нотаріус', 'Trámites de negocio · traducción · notario'),
    sub: l(
      'For clients who have already selected the entity and filing. Entity choice and tax questions require an attorney or CPA. Translation and mobile-notary services are also available.',
      'Для клиентов, которые уже выбрали форму компании и регистрацию. Выбор формы компании и налоговые вопросы — к адвокату или CPA. Также доступны переводы и выездной нотариус.',
      'Для клієнтів, які вже обрали форму компанії та реєстрацію. Вибір форми компанії та податкові питання — до адвоката або CPA. Також доступні переклади й виїзний нотаріус.',
      'Para clientes que ya eligieron el tipo de empresa y el trámite. La elección del tipo de empresa y los temas de impuestos requieren un abogado o un CPA. También ofrecemos traducciones y notario a domicilio.'
    ),
    govHead: 'filing',
    divider: { before: 8, label: l('Translation & notary', 'Перевод и нотариус', 'Переклад і нотаріус', 'Traducción y notario') },
    rows: [
      { strong: l('Client-selected LLC forms package', 'Пакет форм LLC, выбранный клиентом', 'Пакет форм LLC, обраний клієнтом', 'Paquete de formularios de LLC elegido por el cliente'), meta: l('LLC-1 + LLC-12 + SS-4 + operating-agreement template', 'LLC-1 + LLC-12 + SS-4 + шаблон операционного соглашения', 'LLC-1 + LLC-12 + SS-4 + шаблон операційної угоди', 'LLC-1 + LLC-12 + SS-4 + plantilla de acuerdo operativo'), price: { amount: 449 }, gov: 'agency', prefill: pfMany('LLC-1, LLC-12, SS-4, and an operating-agreement template'), formCode: 'LLC-1', popular: true },
      { strong: l('Client-selected corporation forms package', 'Пакет форм корпорации, выбранный клиентом', 'Пакет форм корпорації, обраний клієнтом', 'Paquete de formularios de corporación elegido por el cliente'), meta: l('ARTS-GS + SI-550 + EIN + bylaws template', 'ARTS-GS + SI-550 + EIN + шаблон устава', 'ARTS-GS + SI-550 + EIN + шаблон статуту', 'ARTS-GS + SI-550 + EIN + plantilla de estatutos'), price: { amount: 549 }, gov: 'agency', prefill: pfMany('ARTS-GS and SI-550'), formCode: 'ARTS-GS' },
      { strong: 'LLC-1', rest: l('standalone preparation', 'отдельная подготовка', 'окрема підготовка', 'preparación por separado'), price: { amount: 199 }, gov: 'agency', prefill: pfMany('LLC-1'), formCode: 'LLC-1' },
      { strong: 'LLC-12', rest: l('Statement of Information', 'Statement of Information (сведения о компании)', 'Statement of Information (відомості про компанію)', 'Statement of Information (declaración de información)'), price: { amount: 129 }, gov: 'agency', prefill: pfMany('LLC-12'), formCode: 'LLC-12' },
      { strong: 'SS-4 EIN', rest: l('application', '— заявление', '— заява', '— solicitud'), price: { amount: 99 }, gov: 'agency', prefill: pfMany('SS-4'), formCode: 'SS-4' },
      { strong: 'DBA / FBN', rest: l('(Fictitious Business Name)', '(вымышленное название бизнеса)', '(вигадана назва бізнесу)', '(nombre comercial ficticio)'), price: { amount: 129 }, gov: 'county', prefill: l('I selected a DBA or FBN filing and want a preparation quote', 'Я выбрал(а) регистрацию DBA или FBN и хочу расчёт подготовки', 'Я обрав(ла) реєстрацію DBA або FBN і хочу розрахунок підготовки', 'Elegí un trámite de DBA o FBN y quiero una cotización de preparación'), formCode: 'FBN' },
      { strong: 'LLC-1A', rest: l('foreign-LLC registration', 'регистрация иностранной LLC', 'реєстрація іноземної LLC', 'registro de una LLC extranjera'), price: { amount: 299 }, gov: 'agency', prefill: pfMany('LLC-1A'), formCode: 'LLC-1A' },
      { strong: l('Operating agreement', 'Операционное соглашение', 'Операційна угода', 'Acuerdo operativo'), rest: l('(client-selected template)', '(шаблон, выбранный клиентом)', '(шаблон, обраний клієнтом)', '(plantilla elegida por el cliente)'), price: { amount: 149 }, gov: 'ifApplicable', prefill: l('I selected an operating-agreement template and want a document-preparation quote', 'Я выбрал(а) шаблон операционного соглашения и хочу расчёт подготовки', 'Я обрав(ла) шаблон операційної угоди і хочу розрахунок підготовки', 'Elegí una plantilla de acuerdo operativo y quiero una cotización de preparación') },
      { strong: l('Certified translation', 'Заверенный перевод', 'Засвідчений переклад', 'Traducción certificada'), rest: l('(RU / UA / ES ↔ EN)', '(RU / UA / ES ↔ EN)', '(RU / UA / ES ↔ EN)', '(RU / UA / ES ↔ EN)'), price: { amount: 35, from: true, unit: 'page' }, gov: 'na', prefill: l('I need a certified translation (Russian / Ukrainian / Spanish ↔ English)', 'Мне нужен заверенный перевод (русский / украинский / испанский ↔ английский)', 'Мені потрібен засвідчений переклад (російська / українська / іспанська ↔ англійська)', 'Necesito una traducción certificada (ruso / ucraniano / español ↔ inglés)') },
      { strong: l('Standard certificate', 'Стандартное свидетельство', 'Стандартне свідоцтво', 'Certificado estándar'), rest: l('(birth/marriage/divorce)', '(рождение / брак / развод)', '(народження / шлюб / розлучення)', '(nacimiento / matrimonio / divorcio)'), price: { amount: 45, unit: 'each' }, gov: 'na', prefill: l('I need a certified translation of a birth / marriage / divorce / death certificate', 'Мне нужен заверенный перевод свидетельства о рождении / браке / разводе / смерти', 'Мені потрібен засвідчений переклад свідоцтва про народження / шлюб / розлучення / смерть', 'Necesito la traducción certificada de un acta de nacimiento / matrimonio / divorcio / defunción') },
      { strong: l('Diploma / transcript', 'Диплом / приложение к диплому', 'Диплом / додаток до диплома', 'Diploma / certificado de estudios'), rest: l('translation', '— перевод', '— переклад', '— traducción'), price: { amount: 75, unit: 'each' }, gov: 'na', prefill: l('I need a certified translation of a diploma / academic transcript', 'Мне нужен заверенный перевод диплома / приложения к диплому', 'Мені потрібен засвідчений переклад диплома / додатка до диплома', 'Necesito la traducción certificada de un diploma / certificado de estudios') },
      { strong: l('Apostille coordination', 'Координация апостиля', 'Координація апостиля', 'Coordinación de apostilla'), rest: l('(CA Secretary of State)', '(CA Secretary of State)', '(CA Secretary of State)', '(CA Secretary of State)'), price: { amount: 129 }, gov: 'agency', prefill: l('I need apostille coordination through California Secretary of State', 'Мне нужна координация апостиля через California Secretary of State', 'Мені потрібна координація апостиля через California Secretary of State', 'Necesito coordinar una apostilla con el California Secretary of State') },
      { strong: l('Mobile notary', 'Выездной нотариус', 'Виїзний нотаріус', 'Notario a domicilio'), rest: l('(Sacramento metro, up to 3 signatures)', '(район Сакраменто, до 3 подписей)', '(район Сакраменто, до 3 підписів)', '(área de Sacramento, hasta 3 firmas)'), price: { amount: 75, from: true }, gov: 'na', prefill: l('I need a mobile notary in the Sacramento area', 'Мне нужен выездной нотариус в районе Сакраменто', 'Мені потрібен виїзний нотаріус у районі Сакраменто', 'Necesito un notario a domicilio en el área de Sacramento') }
    ],
    disclaimerHtml: l(
      'We do not give business or tax advice. We prepare and file the forms; consult a CPA or attorney for entity-choice questions. Imverica is not a law firm.',
      'Мы не даём бизнес- и налоговых консультаций. Мы готовим и подаём формы; по выбору формы компании обращайтесь к CPA или адвокату. Imverica не юридическая фирма.',
      'Ми не надаємо бізнес- і податкових консультацій. Ми готуємо й подаємо форми; щодо вибору форми компанії звертайтеся до CPA або адвоката. Imverica не юридична фірма.',
      'No damos asesoría de negocios ni de impuestos. Preparamos y presentamos los formularios; para elegir el tipo de empresa consulte a un CPA o a un abogado. Imverica no es un bufete de abogados.'
    )
  }
];

// ── Discounts, support levels, FAQ, legal note ──────────────────────────
export const DISCOUNTS = {
  heading: l('Discounts & family packages', 'Скидки и семейные пакеты', 'Знижки та сімейні пакети', 'Descuentos y paquetes familiares'),
  sub: l('Layer these on top of any package. Multiple discounts can stack.', 'Скидки добавляются к любому пакету и могут суммироваться.', 'Знижки додаються до будь-якого пакета й можуть підсумовуватися.', 'Se suman a cualquier paquete. Se pueden combinar varios descuentos.'),
  cards: [
    { pct: '−15%', title: l('First-time client', 'Новый клиент', 'Новий клієнт', 'Cliente nuevo'), desc: l('First matter with Imverica gets an introductory discount, applied automatically.', 'На первое дело с Imverica — вводная скидка, применяется автоматически.', 'На першу справу з Imverica — вступна знижка, застосовується автоматично.', 'Su primer asunto con Imverica tiene un descuento de bienvenida que se aplica automáticamente.'), prefill: l("I'm a first-time Imverica client and would like the introductory discount applied.", 'Я новый клиент Imverica, прошу применить вводную скидку.', 'Я новий клієнт Imverica, прошу застосувати вступну знижку.', 'Soy cliente nuevo de Imverica y quiero que se aplique el descuento de bienvenida.') },
    { pct: '−10%', title: l('Family bundle', 'Семейный пакет', 'Сімейний пакет', 'Paquete familiar'), desc: l('Two or more family members on the same I-130 / I-485 flow — discount on the second relative onward.', 'Два и более члена семьи в одном процессе I-130 / I-485 — скидка начиная со второго родственника.', 'Двоє й більше членів родини в одному процесі I-130 / I-485 — знижка починаючи з другого родича.', 'Dos o más familiares en el mismo trámite I-130 / I-485: descuento a partir del segundo familiar.'), prefill: l('I have two or more family members on the same I-130 / I-485 flow — please apply the family-bundle discount.', 'У меня два и более члена семьи в одном процессе I-130 / I-485 — прошу применить семейную скидку.', 'У мене двоє й більше членів родини в одному процесі I-130 / I-485 — прошу застосувати сімейну знижку.', 'Tengo dos o más familiares en el mismo trámite I-130 / I-485; por favor apliquen el descuento familiar.') },
    { pct: '−10%', title: l('Multi-form bundle', 'Пакет из нескольких форм', 'Пакет із кількох форм', 'Paquete de varios formularios'), desc: l('Three or more forms from the same family (e.g. full I-485 package) — discount on the bundle total.', 'Три и более формы для одной семьи (например, полный пакет I-485) — скидка на общую сумму.', 'Три й більше форми для однієї родини (наприклад, повний пакет I-485) — знижка на загальну суму.', 'Tres o más formularios de la misma familia (por ejemplo, el paquete completo I-485): descuento sobre el total.'), prefill: l("I'd like a multi-form bundle (3+ forms from the same family) — please quote with the bundle discount.", 'Мне нужен пакет из 3+ форм для одной семьи — прошу расчёт со скидкой на пакет.', 'Мені потрібен пакет із 3+ форм для однієї родини — прошу розрахунок зі знижкою на пакет.', 'Quiero un paquete de 3 o más formularios de la misma familia; por favor coticen con el descuento por paquete.') },
    { pct: '−10%', title: l('Referral credit', 'Бонус за рекомендацию', 'Бонус за рекомендацію', 'Crédito por recomendación'), desc: l('You refer a new client to Imverica — both of you get a credit on the next invoice.', 'Вы рекомендуете Imverica новому клиенту — вы оба получаете скидку на следующий счёт.', 'Ви рекомендуєте Imverica новому клієнту — ви обоє отримуєте знижку на наступний рахунок.', 'Usted recomienda a un cliente nuevo a Imverica y ambos reciben un crédito en la siguiente factura.'), prefill: l('I was referred by an existing Imverica client — please apply the referral credit.', 'Меня порекомендовал клиент Imverica — прошу применить бонус за рекомендацию.', 'Мене порекомендував клієнт Imverica — прошу застосувати бонус за рекомендацію.', 'Me recomendó un cliente de Imverica; por favor apliquen el crédito por recomendación.') },
    { pct: '−25%', title: l('Client-selected fee-waiver request', 'Запрос освобождения от пошлины, выбранный клиентом', 'Запит звільнення від мита, обраний клієнтом', 'Solicitud de exención de tarifas elegida por el cliente'), desc: l("If you independently choose to submit a government fee-waiver request, ask whether a separate discount on Imverica's preparation fee is available. We do not determine eligibility.", 'Если вы сами решили подать запрос об освобождении от госпошлины, спросите, доступна ли отдельная скидка на подготовку у Imverica. Мы не определяем, имеете ли вы на это право.', 'Якщо ви самі вирішили подати запит про звільнення від держмита, запитайте, чи доступна окрема знижка на підготовку в Imverica. Ми не визначаємо, чи маєте ви на це право.', 'Si usted decide por su cuenta pedir una exención de tarifas del gobierno, pregunte si hay un descuento aparte en la tarifa de preparación de Imverica. No determinamos la elegibilidad.'), prefill: l('I independently selected a fee-waiver request and want to ask whether an Imverica service discount is available.', 'Я сам(а) выбрал(а) запрос об освобождении от пошлины и хочу узнать, есть ли скидка на услуги Imverica.', 'Я сам(а) обрав(ла) запит про звільнення від мита і хочу дізнатися, чи є знижка на послуги Imverica.', 'Elegí por mi cuenta una solicitud de exención de tarifas y quiero saber si hay un descuento en los servicios de Imverica.') }
  ],
  b2b: {
    title: l('Attorney retainer', 'Абонемент для адвокатов', 'Абонемент для адвокатів', 'Retención para abogados'),
    desc: l('Law firms with a monthly retainer (10+ hours/month) bill at our reduced paralegal rate.', 'Юридические фирмы с ежемесячным абонементом (от 10 часов в месяц) платят по сниженной ставке параюриста.', 'Юридичні фірми з щомісячним абонементом (від 10 годин на місяць) платять за зниженою ставкою параюриста.', 'Los bufetes con una retención mensual (10+ horas al mes) pagan nuestra tarifa reducida de asistente legal.'),
    action: l('See attorney pricing →', 'Цены для адвокатов →', 'Ціни для адвокатів →', 'Ver precios para abogados →')
  }
};

export const SUPPORT = {
  heading: l('Choose the right level of support', 'Выберите нужный уровень помощи', 'Оберіть потрібний рівень допомоги', 'Elija el nivel de apoyo adecuado'),
  intro: l(
    'Not every matter needs the same kind of help. Use this section to understand what Imverica can prepare, what you handle yourself, and when a licensed professional should be involved.',
    'Не каждому делу нужна одинаковая помощь. Здесь видно, что может подготовить Imverica, что вы делаете сами и когда нужен лицензированный специалист.',
    'Не кожній справі потрібна однакова допомога. Тут видно, що може підготувати Imverica, що ви робите самі і коли потрібен ліцензований фахівець.',
    'No todos los asuntos necesitan la misma ayuda. Aquí verá qué puede preparar Imverica, qué hace usted por su cuenta y cuándo debe intervenir un profesional con licencia.'
  ),
  cols: [
    {
      kind: 'software', tier: l('Self-prepared', 'Самостоятельно', 'Самостійно', 'Por su cuenta'),
      name: l('You complete and file the paperwork', 'Вы сами заполняете и подаёте документы', 'Ви самі заповнюєте й подаєте документи', 'Usted llena y presenta los documentos'),
      items: [
        l('You choose the forms and instructions', 'Вы выбираете формы и инструкции', 'Ви обираєте форми та інструкції', 'Usted elige los formularios y las instrucciones'),
        l('You type the answers and gather evidence', 'Вы вписываете ответы и собираете доказательства', 'Ви вписуєте відповіді та збираєте докази', 'Usted escribe las respuestas y reúne las pruebas'),
        l('You file, serve, mail, and track deadlines', 'Вы подаёте, вручаете, отправляете и следите за сроками', 'Ви подаєте, вручаєте, надсилаєте й стежите за строками', 'Usted presenta, entrega, envía y vigila los plazos'),
        l('Best for very simple, familiar paperwork', 'Подходит для очень простых, знакомых документов', 'Підходить для дуже простих, знайомих документів', 'Ideal para trámites muy sencillos y conocidos'),
        l('No Imverica preparation fee', 'Без оплаты Imverica', 'Без оплати Imverica', 'Sin tarifa de preparación de Imverica')
      ]
    },
    {
      kind: 'imverica', tier: l('Imverica', 'Imverica', 'Imverica', 'Imverica'), featured: true,
      name: l('Document preparation at your direction', 'Подготовка документов по вашему поручению', 'Підготовка документів за вашим дорученням', 'Preparación de documentos bajo su dirección'),
      items: [
        l('Flat fee confirmed before work begins', 'Фиксированная цена подтверждается до начала работы', 'Фіксована ціна підтверджується до початку роботи', 'Tarifa fija confirmada antes de empezar'),
        l('Human intake and clerical completeness review', 'Анкету принимает человек, проверка полноты заполнения', 'Анкету приймає людина, перевірка повноти заповнення', 'Cuestionario revisado por una persona y control de que esté completo'),
        l('English, Russian, Ukrainian, and Spanish', 'Английский, русский, украинский и испанский', 'Англійська, російська, українська та іспанська', 'Inglés, ruso, ucraniano y español'),
        l('Forms, attachments, exhibits, and filing packets', 'Формы, приложения, доказательства и пакеты для подачи', 'Форми, додатки, докази та пакети для подання', 'Formularios, anexos, pruebas y paquetes para presentar'),
        l('No legal advice or court representation', 'Без юридических консультаций и представительства в суде', 'Без юридичних консультацій і представництва в суді', 'Sin asesoría legal ni representación en la corte')
      ]
    },
    {
      kind: 'attorney', tier: l('Legal representation', 'Юридическое представительство', 'Юридичне представництво', 'Representación legal'),
      name: l('For advice, strategy, or court appearance', 'Для консультаций, стратегии или выступления в суде', 'Для консультацій, стратегії або виступу в суді', 'Para asesoría, estrategia o comparecer en la corte'),
      items: [
        l('Eligibility, risk, defenses, and strategy', 'Право на льготу, риски, защита и стратегия', 'Право на пільгу, ризики, захист і стратегія', 'Elegibilidad, riesgos, defensas y estrategia'),
        l('Contested hearings or negotiations', 'Спорные заседания или переговоры', 'Спірні засідання або переговори', 'Audiencias disputadas o negociaciones'),
        l('Appeals, denials, waivers, or deadlines', 'Апелляции, отказы, waivers или сроки', 'Апеляції, відмови, waivers або строки', 'Apelaciones, negaciones, perdones (waivers) o plazos'),
        l('Complex facts or possible criminal consequences', 'Сложные обстоятельства или возможные уголовные последствия', 'Складні обставини або можливі кримінальні наслідки', 'Hechos complejos o posibles consecuencias penales'),
        l('Attorney or accredited representative required', 'Нужен адвокат или аккредитованный представитель', 'Потрібен адвокат або акредитований представник', 'Se requiere un abogado o un representante acreditado')
      ]
    }
  ]
};

export const FAQ = {
  heading: l('Pricing basics', 'Коротко о ценах', 'Коротко про ціни', 'Lo básico sobre precios'),
  items: [
    {
      q: l('What is included in the Imverica fee?', 'Что входит в стоимость Imverica?', 'Що входить у вартість Imverica?', '¿Qué incluye la tarifa de Imverica?'),
      a: l(
        'Our fee covers document preparation, form assembly, formatting, attachment organization, and final delivery of a filing-ready packet based on the information and documents you provide.',
        'Стоимость включает подготовку документов, сборку форм, оформление, упорядочивание приложений и передачу готового к подаче пакета на основе ваших сведений и документов.',
        'Вартість включає підготовку документів, збирання форм, оформлення, упорядкування додатків і передачу готового до подання пакета на основі ваших відомостей і документів.',
        'La tarifa cubre la preparación de documentos, el armado de formularios, el formato, la organización de anexos y la entrega final de un paquete listo para presentar, con la información y los documentos que usted nos da.'
      )
    },
    {
      q: l('What is not included?', 'Что не входит?', 'Що не входить?', '¿Qué no incluye?'),
      a: l(
        'Government filing fees, court fees, mailing, service of process, certified copies, translations, notary fees, attorney review, and legal advice are separate unless your written quote specifically includes them.',
        'Госпошлины, судебные сборы, отправка почтой, вручение документов, заверенные копии, переводы, услуги нотариуса, проверка адвокатом и юридические консультации оплачиваются отдельно, если письменный расчёт прямо их не включает.',
        'Держмито, судові збори, надсилання поштою, вручення документів, засвідчені копії, переклади, послуги нотаріуса, перевірка адвокатом і юридичні консультації оплачуються окремо, якщо письмовий розрахунок прямо їх не включає.',
        'Las tarifas del gobierno y de la corte, el envío por correo, la entrega legal de documentos, las copias certificadas, las traducciones, el notario, la revisión de un abogado y la asesoría legal van aparte, salvo que su cotización por escrito los incluya.'
      )
    },
    {
      q: l('Why do some prices say "from" or "custom quote"?', 'Почему цены указаны «от» или «индивидуальный расчёт»?', 'Чому ціни вказані «від» або «індивідуальний розрахунок»?', '¿Por qué los precios dicen «desde» o «cotización personalizada»?'),
      a: l(
        'Some packets depend on page count, number of applicants, number of defendants, exhibits, prior filings, or court history. We review the intake first and send a written quote before any paid work begins.',
        'Цена зависит от числа страниц, заявителей, ответчиков, приложений, прежних подач или истории дела в суде. Сначала мы изучаем анкету и присылаем письменный расчёт до начала любой платной работы.',
        'Ціна залежить від кількості сторінок, заявників, відповідачів, додатків, попередніх подань або історії справи в суді. Спочатку ми вивчаємо анкету й надсилаємо письмовий розрахунок до початку будь-якої платної роботи.',
        'El precio depende del número de páginas, solicitantes, demandados, anexos, trámites anteriores o el historial en la corte. Primero revisamos el cuestionario y enviamos una cotización por escrito antes de cualquier trabajo pagado.'
      )
    },
    {
      q: l('Can discounts or payment plans apply?', 'Бывают ли скидки или рассрочка?', 'Чи бувають знижки або розстрочка?', '¿Hay descuentos o planes de pago?'),
      a: l(
        'Yes. First-time client, family bundle, multi-form bundle, referral, and fee-waiver discounts may apply. Payment plans are available for selected larger packages when approved before work starts.',
        'Да. Возможны скидки для новых клиентов, семейные, за пакет форм, за рекомендацию и при освобождении от пошлины. Рассрочка доступна для некоторых крупных пакетов, если её согласовать до начала работы.',
        'Так. Можливі знижки для нових клієнтів, сімейні, за пакет форм, за рекомендацію та при звільненні від мита. Розстрочка доступна для деяких великих пакетів, якщо її погодити до початку роботи.',
        'Sí. Pueden aplicar descuentos para clientes nuevos, familiares, por paquete de formularios, por recomendación y por exención de tarifas. Hay planes de pago para algunos paquetes grandes si se aprueban antes de empezar.'
      )
    },
    {
      q: l('When is the final price locked?', 'Когда цена становится окончательной?', 'Коли ціна стає остаточною?', '¿Cuándo queda fijo el precio final?'),
      a: l(
        'The final price is locked in the written engagement agreement. If the client later requests additional documents or clerical work, we quote the add-on first and only proceed after approval.',
        'Окончательная цена фиксируется в письменном договоре. Если позже клиент просит дополнительные документы или работу, мы сначала называем цену и продолжаем только после согласия.',
        'Остаточна ціна фіксується в письмовому договорі. Якщо пізніше клієнт просить додаткові документи чи роботу, ми спочатку називаємо ціну й продовжуємо лише після згоди.',
        'El precio final queda fijo en el contrato por escrito. Si después el cliente pide documentos o trabajo adicional, primero lo cotizamos y solo seguimos con su aprobación.'
      )
    },
    {
      q: l('When should I talk to an attorney?', 'Когда нужен адвокат?', 'Коли потрібен адвокат?', '¿Cuándo debo hablar con un abogado?'),
      a: l(
        'Use an attorney or accredited representative when you need legal advice, strategy, representation, contested hearings, appeals, waivers, criminal consequences, or help deciding what legal option to choose.',
        'Обращайтесь к адвокату или аккредитованному представителю, если нужны юридическая консультация, стратегия, представительство, спорные заседания, апелляции, waivers, вопросы уголовных последствий или помощь в выборе юридического варианта.',
        'Звертайтеся до адвоката або акредитованого представника, якщо потрібні юридична консультація, стратегія, представництво, спірні засідання, апеляції, waivers, питання кримінальних наслідків або допомога у виборі юридичного варіанта.',
        'Acuda a un abogado o a un representante acreditado si necesita asesoría legal, estrategia, representación, audiencias disputadas, apelaciones, perdones (waivers), consecuencias penales o ayuda para decidir qué opción legal elegir.'
      )
    }
  ]
};

export const LEGAL = {
  heading: l('Important — please read', 'Важно — прочитайте', 'Важливо — прочитайте', 'Importante: lea esto'),
  p1Html: l(
    'All prices above are for <strong>document preparation only</strong> for California clients. They are quoted in US dollars, exclude government filing fees (USCIS / court / Secretary of State / county clerk), and exclude optional services like mailing, translation certification, or attorney review. A written engagement agreement locks the final price before any work begins, in your language (English, Russian, Ukrainian, or Spanish), per Cal. Bus. &amp; Prof. Code §§6410, 6411 and §§22441, 22442.',
    'Все цены выше — <strong>только за подготовку документов</strong> для клиентов в Калифорнии. Цены в долларах США, без госпошлин (USCIS / суд / Secretary of State / окружной клерк) и без дополнительных услуг — отправки почтой, заверения перевода или проверки адвокатом. Письменный договор фиксирует окончательную цену до начала работы, на вашем языке (английском, русском, украинском или испанском), согласно Cal. Bus. &amp; Prof. Code §§6410, 6411 и §§22441, 22442.',
    'Усі ціни вище — <strong>лише за підготовку документів</strong> для клієнтів у Каліфорнії. Ціни в доларах США, без держмита (USCIS / суд / Secretary of State / окружний клерк) і без додаткових послуг — надсилання поштою, засвідчення перекладу чи перевірки адвокатом. Письмовий договір фіксує остаточну ціну до початку роботи, вашою мовою (англійською, російською, українською чи іспанською), згідно з Cal. Bus. &amp; Prof. Code §§6410, 6411 і §§22441, 22442.',
    'Todos los precios de arriba son <strong>solo por preparación de documentos</strong> para clientes en California. Están en dólares estadounidenses, no incluyen las tarifas del gobierno (USCIS / corte / Secretary of State / secretario del condado) ni servicios opcionales como envío por correo, certificación de traducciones o revisión de un abogado. Un contrato por escrito fija el precio final antes de empezar, en su idioma (inglés, ruso, ucraniano o español), según Cal. Bus. &amp; Prof. Code §§6410, 6411 y §§22441, 22442.'
  ),
  p2Html: l(
    "<strong>Imverica Legal Solutions is not a law firm.</strong> Imverica Legal Solutions is the trade name (dba) of Imverica LLC, a California-registered Legal Document Assistant (Cal. Bus. &amp; Prof. Code §§6400–6415) and Immigration Consultant (§§22440–22448). We do not give legal advice, do not establish an attorney-client relationship, do not represent you in court or before USCIS / EOIR, and do not recommend which form you should file. All work is performed under the California self-represented party's direction. Government fees change and depend on filing method and category; verify the current amount directly with the responsible agency immediately before filing. If your situation needs legal advice, consult a licensed attorney.",
    '<strong>Imverica Legal Solutions не юридическая фирма.</strong> Imverica Legal Solutions — торговое название (dba) компании Imverica LLC, зарегистрированного в Калифорнии Legal Document Assistant (Cal. Bus. &amp; Prof. Code §§6400–6415) и Immigration Consultant (§§22440–22448). Мы не даём юридических консультаций, не вступаем в отношения «адвокат — клиент», не представляем вас в суде или перед USCIS / EOIR и не советуем, какую форму подавать. Вся работа выполняется по поручению стороны, которая сама представляет себя в Калифорнии. Госпошлины меняются и зависят от способа подачи и категории; проверяйте актуальную сумму в соответствующем ведомстве непосредственно перед подачей. Если вашей ситуации нужна юридическая консультация, обратитесь к лицензированному адвокату.',
    '<strong>Imverica Legal Solutions не юридична фірма.</strong> Imverica Legal Solutions — торгова назва (dba) компанії Imverica LLC, зареєстрованого в Каліфорнії Legal Document Assistant (Cal. Bus. &amp; Prof. Code §§6400–6415) та Immigration Consultant (§§22440–22448). Ми не надаємо юридичних консультацій, не вступаємо у відносини «адвокат — клієнт», не представляємо вас у суді чи перед USCIS / EOIR і не радимо, яку форму подавати. Уся робота виконується за дорученням сторони, яка сама представляє себе в Каліфорнії. Держмито змінюється і залежить від способу подання та категорії; перевіряйте актуальну суму у відповідному відомстві безпосередньо перед поданням. Якщо вашій ситуації потрібна юридична консультація, зверніться до ліцензованого адвоката.',
    '<strong>Imverica Legal Solutions no es un bufete de abogados.</strong> Imverica Legal Solutions es el nombre comercial (dba) de Imverica LLC, Legal Document Assistant (Cal. Bus. &amp; Prof. Code §§6400–6415) e Immigration Consultant (§§22440–22448) registrado en California. No damos asesoría legal, no establecemos una relación abogado-cliente, no lo representamos en la corte ni ante USCIS / EOIR y no recomendamos qué formulario presentar. Todo el trabajo se hace bajo la dirección de la persona en California que se representa a sí misma. Las tarifas del gobierno cambian y dependen del método de presentación y la categoría; verifique el monto vigente directamente con la agencia responsable justo antes de presentar. Si su situación requiere asesoría legal, consulte a un abogado con licencia.'
  )
};

/** Structured data: the same offers on every language version. */
export const PRICING_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Imverica Document Preparation Pricing',
  provider: { '@id': 'https://imverica.com/#organization' },
  description: 'Flat-fee document preparation for USCIS, EOIR, and California state-court forms. Imverica is a California-registered Legal Document Assistant and Immigration Consultant — not a law firm. Documents prepared at client direction. Government filing fees are separate.',
  areaServed: { '@type': 'State', name: 'California' },
  offers: [
    { '@type': 'Offer', name: 'I-90 Green Card Renewal',       priceCurrency: 'USD', price: '199' },
    { '@type': 'Offer', name: 'I-765 Work Permit',             priceCurrency: 'USD', price: '199' },
    { '@type': 'Offer', name: 'I-130 Family Petition',         priceCurrency: 'USD', price: '499' },
    { '@type': 'Offer', name: 'I-485 Adjustment (single)',     priceCurrency: 'USD', price: '999' },
    { '@type': 'Offer', name: 'I-485 Marriage AOS Package',    priceCurrency: 'USD', price: '1799' },
    { '@type': 'Offer', name: 'N-400 Naturalization',          priceCurrency: 'USD', price: '599' },
    { '@type': 'Offer', name: 'SC-100 Small Claims Package',   priceCurrency: 'USD', price: '249' },
    { '@type': 'Offer', name: 'FL-100 Simple Divorce',         priceCurrency: 'USD', price: '349' },
    { '@type': 'Offer', name: 'Probate Starter / Small Estate', priceCurrency: 'USD', price: '249' },
    { '@type': 'Offer', name: 'CR-180 Record Cleanup Packet',   priceCurrency: 'USD', price: '449' },
    { '@type': 'Offer', name: 'LLC Launch Package',            priceCurrency: 'USD', price: '449' }
  ]
};

