/**
 * Copy for the v2 footer (components/SiteFooterV2.astro), laid out like
 * apple.com: numbered legal notes in small type, a link directory, the
 * "more ways to reach us" line and a copyright bar.
 *
 * The notes carry the disclosures California requires of us:
 *  - LDA: name, county, registration number and expiry, and the statement
 *    of Bus. & Prof. Code § 6408.5 ("I am not an attorney. I can only
 *    provide self help services at your specific direction.") in the
 *    language of the page (§ 6408.5(c));
 *  - Immigration Consultant: bond on file with the Secretary of State and
 *    "not an attorney and may not perform the legal services that an
 *    attorney performs" (§ 22442(b)(3)).
 * Non-English text never translates "licensed", "attorney" or "notary
 * public" as a description of Imverica (§ 6126.7, § 22442.3).
 */
import type { Locale } from '~/data/i18n';

export const LDA_LINE = 'LDA Reg. No. 2026-010, Sacramento County, expires 09/27/2028, Imverica LLC';

interface Note { lead: string; text: string }
interface Column { title: string; links: Array<[slug: string, label: string]> }
export interface FooterV2Copy {
  notes: Note[];
  columns: Column[];
  reach: { lead: string; call: string; email: string };
  copyright: string;
  bottom: Array<[href: string, label: string]>;
  region: string;
  languages: string;
}

export const FOOTER_V2: Record<Locale, FooterV2Copy> = {
  en: {
    notes: [
      { lead: 'Not a law firm.', text: 'Imverica Legal Solutions is a trade name of Imverica LLC, a California limited liability company. Imverica is not a law firm and is not a substitute for an attorney. We do not give legal advice, choose forms or legal strategy for you, or represent anyone before a court or government agency. Use of this website, our chat or our services does not create an attorney-client relationship.' },
      { lead: 'Legal Document Assistant.', text: `${LDA_LINE} (Cal. Bus. & Prof. Code §§ 6400–6415). Statement required by Cal. Bus. & Prof. Code § 6408.5: “I am not an attorney. I can only provide self help services at your specific direction.”` },
      { lead: 'Immigration Consultant.', text: 'Imverica LLC is an immigration consultant under Cal. Bus. & Prof. Code §§ 22440–22448, bonded by Western Surety Company, Bond No. 67347671, on file with the California Secretary of State. An immigration consultant is not an attorney and may not perform the legal services that an attorney performs. We complete forms with the information you provide, translate your answers and assemble supporting documents; we do not advise you which form to file or how to answer it.' },
      { lead: 'Fees.', text: 'Our flat fees cover document preparation only. Government filing fees (USCIS, EOIR, California courts and the Secretary of State), service of process, notarization and other third-party costs are paid separately unless a written agreement states otherwise.' },
      { lead: 'No guarantee; no government affiliation.', text: 'We cannot guarantee any result. Every application, petition and court matter is decided solely by the government agency or the court. Imverica is not affiliated with or endorsed by USCIS, EOIR, the U.S. Department of State, the Judicial Council of California or any court or government agency.' },
      { lead: 'General information.', text: 'Content on this website is general information, not legal advice, and may not reflect the latest changes in the law or in agency forms. If you need legal advice, consult a licensed California attorney; the State Bar of California lists certified lawyer referral services.' }
    ],
    columns: [
      { title: 'USCIS | EOIR', links: [['/immigration', 'All immigration forms'], ['/i-485-help', 'Green Card | I-485'], ['/i-765-work-permit-help', 'Work Permit | EAD'], ['/n-400-citizenship-help', 'Citizenship | N-400'], ['/i-130-family-petition', 'Family Petition | I-130'], ['/i-589-asylum-help', 'Asylum | I-589'], ['/eoir-immigration-court', 'Immigration Court | EOIR'], ['/u4u', 'Uniting for Ukraine | U4U'], ['/tps', 'TPS']] },
      { title: 'California Courts', links: [['/fl', 'Family Law | Divorce'], ['/california-restraining-orders', 'Restraining Orders | DVRO'], ['/sc', 'Small Claims | SC-100'], ['/california-unlawful-detainer', 'Eviction | UD-100'], ['/california-probate', 'Probate | DE-111'], ['/california-expungement', 'Record Clearing | CR-180'], ['/fw-001-fee-waiver', 'Fee Waiver | FW-001']] },
      { title: 'Business', links: [['/business', 'All business filings'], ['/llc-1-form-an-llc', 'LLC | LLC-1'], ['/arts-gs-incorporation', 'Corporation | ARTS-GS'], ['/fbn-dba', 'FBN | DBA'], ['/ss-4-ein', 'EIN | SS-4'], ['/operating-agreement', 'Operating Agreement']] },
      { title: 'Imverica', links: [['/about', 'About Imverica'], ['/pricing', 'Pricing'], ['/for-attorneys', 'For Attorneys'], ['/lda', 'What Is an LDA'], ['/schedule', 'Schedule a Call'], ['/account.html', 'Client Portal']] }
    ],
    reach: { lead: 'More ways to reach us', call: 'Call', email: 'Email' },
    copyright: 'Copyright © {year} Imverica LLC. All rights reserved.',
    bottom: [['/terms.html', 'Terms of Service'], ['/pricing', 'Pricing'], ['/lda', 'What Is an LDA'], ['/for-attorneys', 'For Attorneys']],
    region: 'California, USA',
    languages: 'Language'
  },
  ru: {
    notes: [
      { lead: 'Не юридическая фирма.', text: 'Imverica Legal Solutions — торговое наименование Imverica LLC, общества с ограниченной ответственностью, учреждённого в штате Калифорния. Imverica не является юридической фирмой (law firm) и не заменяет адвоката. Мы не даём юридических консультаций, не выбираем за вас формы и правовую стратегию и не представляем чьи-либо интересы в суде или государственных органах. Пользование сайтом, чатом или нашими услугами не создаёт отношений «адвокат — клиент».' },
      { lead: 'Помощник по юридическим документам (Legal Document Assistant).', text: `${LDA_LINE} (Cal. Bus. & Prof. Code §§ 6400–6415). Заявление, предусмотренное § 6408.5 Cal. Bus. & Prof. Code: «Я не являюсь адвокатом (attorney). Я могу оказывать услуги самопомощи только по вашему конкретному указанию».` },
      { lead: 'Иммиграционный консультант (Immigration Consultant).', text: 'Imverica LLC осуществляет деятельность иммиграционного консультанта в соответствии с Cal. Bus. & Prof. Code §§ 22440–22448. Гарантийный залог (bond) № 67347671 выдан Western Surety Company и хранится у Государственного секретаря Калифорнии. Иммиграционный консультант не является адвокатом и не вправе оказывать юридические услуги, которые оказывает адвокат. Мы заполняем формы на основании предоставленных вами сведений, переводим ваши ответы и собираем подтверждающие документы; мы не советуем, какую форму подавать и как отвечать на её вопросы.' },
      { lead: 'Стоимость.', text: 'Фиксированная цена включает только подготовку документов. Государственные пошлины (USCIS, EOIR, суды Калифорнии, Государственный секретарь), вручение документов (service of process), нотариальное заверение и иные расходы третьих лиц оплачиваются отдельно, если письменным договором не предусмотрено иное.' },
      { lead: 'Результат не гарантируется; связи с государственными органами нет.', text: 'Мы не можем гарантировать какой-либо результат. Решение по каждому заявлению, петиции и судебному делу принимает исключительно государственный орган или суд. Imverica не связана с USCIS, EOIR, Государственным департаментом США, Судебным советом Калифорнии (Judicial Council of California), каким-либо судом или государственным органом и не одобрена ими.' },
      { lead: 'Общая информация.', text: 'Материалы сайта носят общий информационный характер, не являются юридической консультацией и могут не отражать последних изменений законодательства и форм. Если вам нужна юридическая консультация, обратитесь к адвокату, имеющему лицензию в Калифорнии; сертифицированные службы направления к адвокатам перечислены на сайте State Bar of California.' }
    ],
    columns: [
      { title: 'USCIS | EOIR', links: [['/immigration', 'Все иммиграционные формы'], ['/i-485-help', 'Грин-карта | I-485'], ['/i-765-work-permit-help', 'Разрешение на работу | EAD'], ['/n-400-citizenship-help', 'Гражданство | N-400'], ['/i-130-family-petition', 'Семейная петиция | I-130'], ['/i-589-asylum-help', 'Убежище | I-589'], ['/eoir-immigration-court', 'Иммиграционный суд | EOIR'], ['/u4u', 'Uniting for Ukraine | U4U'], ['/tps', 'TPS']] },
      { title: 'Суды Калифорнии', links: [['/fl', 'Семейное право | развод'], ['/california-restraining-orders', 'Защитные ордера | DVRO'], ['/sc', 'Малые иски | SC-100'], ['/california-unlawful-detainer', 'Выселение | UD-100'], ['/california-probate', 'Наследство | DE-111'], ['/california-expungement', 'Снятие судимости | CR-180'], ['/fw-001-fee-waiver', 'Освобождение от пошлины | FW-001']] },
      { title: 'Бизнес', links: [['/business', 'Все документы для бизнеса'], ['/llc-1-form-an-llc', 'LLC | LLC-1'], ['/arts-gs-incorporation', 'Корпорация | ARTS-GS'], ['/fbn-dba', 'FBN | DBA'], ['/ss-4-ein', 'EIN | SS-4'], ['/operating-agreement', 'Operating Agreement (устав LLC)']] },
      { title: 'Imverica', links: [['/about', 'О компании'], ['/pricing', 'Цены'], ['/for-attorneys', 'Адвокатам'], ['/lda', 'Что такое LDA'], ['/schedule', 'Записаться на звонок'], ['/account.html', 'Кабинет клиента']] }
    ],
    reach: { lead: 'Другие способы связаться', call: 'Позвонить', email: 'Написать на почту' },
    copyright: 'Copyright © {year} Imverica LLC. Все права защищены.',
    bottom: [['/terms.html', 'Условия обслуживания'], ['/pricing', 'Цены'], ['/lda', 'Что такое LDA'], ['/for-attorneys', 'Адвокатам']],
    region: 'Калифорния, США',
    languages: 'Язык'
  },
  uk: {
    notes: [
      { lead: 'Не юридична фірма.', text: 'Imverica Legal Solutions — торговельне найменування Imverica LLC, товариства з обмеженою відповідальністю, заснованого в штаті Каліфорнія. Imverica не є юридичною фірмою (law firm) і не замінює адвоката. Ми не надаємо юридичних консультацій, не обираємо за вас форми та правову стратегію і не представляємо будь-чиї інтереси в суді чи державних органах. Користування сайтом, чатом або нашими послугами не створює відносин «адвокат — клієнт».' },
      { lead: 'Помічник з юридичних документів (Legal Document Assistant).', text: `${LDA_LINE} (Cal. Bus. & Prof. Code §§ 6400–6415). Заява, передбачена § 6408.5 Cal. Bus. & Prof. Code: «Я не є адвокатом (attorney). Я можу надавати послуги самодопомоги лише за вашою конкретною вказівкою».` },
      { lead: 'Імміграційний консультант (Immigration Consultant).', text: 'Imverica LLC провадить діяльність імміграційного консультанта відповідно до Cal. Bus. & Prof. Code §§ 22440–22448. Гарантійну заставу (bond) № 67347671 видано Western Surety Company, вона зберігається в Державного секретаря Каліфорнії. Імміграційний консультант не є адвокатом і не має права надавати юридичні послуги, які надає адвокат. Ми заповнюємо форми на підставі наданих вами відомостей, перекладаємо ваші відповіді та збираємо підтвердні документи; ми не радимо, яку форму подавати і як відповідати на її запитання.' },
      { lead: 'Вартість.', text: 'Фіксована ціна охоплює лише підготовку документів. Державні збори (USCIS, EOIR, суди Каліфорнії, Державний секретар), вручення документів (service of process), нотаріальне засвідчення та інші витрати третіх осіб сплачуються окремо, якщо письмовим договором не передбачено інше.' },
      { lead: 'Результат не гарантується; зв’язку з державними органами немає.', text: 'Ми не можемо гарантувати будь-який результат. Рішення щодо кожної заяви, петиції та судової справи ухвалює виключно державний орган або суд. Imverica не пов’язана з USCIS, EOIR, Державним департаментом США, Судовою радою Каліфорнії (Judicial Council of California), будь-яким судом чи державним органом і не схвалена ними.' },
      { lead: 'Загальна інформація.', text: 'Матеріали сайту мають загальний інформаційний характер, не є юридичною консультацією і можуть не відображати останніх змін у законодавстві та формах. Якщо вам потрібна юридична консультація, зверніться до адвоката з ліцензією в Каліфорнії; сертифіковані служби направлення до адвокатів наведено на сайті State Bar of California.' }
    ],
    columns: [
      { title: 'USCIS | EOIR', links: [['/immigration', 'Усі імміграційні форми'], ['/i-485-help', 'Грін-карта | I-485'], ['/i-765-work-permit-help', 'Дозвіл на роботу | EAD'], ['/n-400-citizenship-help', 'Громадянство | N-400'], ['/i-130-family-petition', 'Сімейна петиція | I-130'], ['/i-589-asylum-help', 'Притулок | I-589'], ['/eoir-immigration-court', 'Імміграційний суд | EOIR'], ['/u4u', 'Uniting for Ukraine | U4U'], ['/tps', 'TPS']] },
      { title: 'Суди Каліфорнії', links: [['/fl', 'Сімейне право | розлучення'], ['/california-restraining-orders', 'Захисні ордери | DVRO'], ['/sc', 'Малі позови | SC-100'], ['/california-unlawful-detainer', 'Виселення | UD-100'], ['/california-probate', 'Спадщина | DE-111'], ['/california-expungement', 'Зняття судимості | CR-180'], ['/fw-001-fee-waiver', 'Звільнення від мита | FW-001']] },
      { title: 'Бізнес', links: [['/business', 'Усі документи для бізнесу'], ['/llc-1-form-an-llc', 'LLC | LLC-1'], ['/arts-gs-incorporation', 'Корпорація | ARTS-GS'], ['/fbn-dba', 'FBN | DBA'], ['/ss-4-ein', 'EIN | SS-4'], ['/operating-agreement', 'Operating Agreement (статут LLC)']] },
      { title: 'Imverica', links: [['/about', 'Про компанію'], ['/pricing', 'Ціни'], ['/for-attorneys', 'Адвокатам'], ['/lda', 'Що таке LDA'], ['/schedule', 'Записатися на дзвінок'], ['/account.html', 'Кабінет клієнта']] }
    ],
    reach: { lead: 'Інші способи зв’язатися', call: 'Зателефонувати', email: 'Написати на пошту' },
    copyright: 'Copyright © {year} Imverica LLC. Усі права захищено.',
    bottom: [['/terms.html', 'Умови обслуговування'], ['/pricing', 'Ціни'], ['/lda', 'Що таке LDA'], ['/for-attorneys', 'Адвокатам']],
    region: 'Каліфорнія, США',
    languages: 'Мова'
  },
  es: {
    notes: [
      { lead: 'No somos un bufete de abogados.', text: 'Imverica Legal Solutions es el nombre comercial de Imverica LLC, una sociedad de responsabilidad limitada constituida en California. Imverica no es un bufete de abogados (law firm) ni sustituye a un abogado. No brindamos asesoría legal, no elegimos por usted formularios ni estrategia legal y no representamos a nadie ante ningún tribunal ni agencia de gobierno. El uso de este sitio, de nuestro chat o de nuestros servicios no crea una relación abogado-cliente.' },
      { lead: 'Asistente de Documentos Legales (Legal Document Assistant).', text: `${LDA_LINE} (Cal. Bus. & Prof. Code §§ 6400–6415). Declaración exigida por el § 6408.5 del Cal. Bus. & Prof. Code: «No soy abogado (attorney). Solo puedo prestar servicios de autoayuda según sus instrucciones específicas».` },
      { lead: 'Consultor de Inmigración (Immigration Consultant).', text: 'Imverica LLC actúa como consultor de inmigración conforme al Cal. Bus. & Prof. Code §§ 22440–22448, con fianza n.º 67347671 emitida por Western Surety Company y registrada ante la Secretaría de Estado de California. Un consultor de inmigración no es abogado y no puede prestar los servicios legales que presta un abogado. Llenamos los formularios con la información que usted nos da, traducimos sus respuestas y reunimos los documentos de respaldo; no le aconsejamos qué formulario presentar ni cómo responderlo.' },
      { lead: 'Tarifas.', text: 'Nuestras tarifas fijas cubren únicamente la preparación de documentos. Las cuotas de gobierno (USCIS, EOIR, tribunales de California y la Secretaría de Estado), la entrega de documentos (service of process), los servicios de notary public y otros costos de terceros se pagan por separado, salvo que un contrato escrito disponga otra cosa.' },
      { lead: 'Sin garantía; sin afiliación con el gobierno.', text: 'No podemos garantizar ningún resultado. Cada solicitud, petición o caso judicial lo decide exclusivamente la agencia de gobierno o el tribunal. Imverica no está afiliada a USCIS, EOIR, el Departamento de Estado de EE. UU., el Consejo Judicial de California (Judicial Council of California) ni a ningún tribunal o agencia de gobierno, ni cuenta con su respaldo.' },
      { lead: 'Información general.', text: 'El contenido de este sitio es información general, no asesoría legal, y puede no reflejar los cambios más recientes en la ley o en los formularios. Si necesita asesoría legal, consulte a un abogado con licencia en California; el State Bar of California publica los servicios certificados de referencia de abogados.' }
    ],
    columns: [
      { title: 'USCIS | EOIR', links: [['/immigration', 'Todos los formularios de inmigración'], ['/i-485-help', 'Green Card | I-485'], ['/i-765-work-permit-help', 'Permiso de trabajo | EAD'], ['/n-400-citizenship-help', 'Ciudadanía | N-400'], ['/i-130-family-petition', 'Petición familiar | I-130'], ['/i-589-asylum-help', 'Asilo | I-589'], ['/eoir-immigration-court', 'Corte de inmigración | EOIR'], ['/u4u', 'Uniting for Ukraine | U4U'], ['/tps', 'TPS']] },
      { title: 'Tribunales de California', links: [['/fl', 'Derecho familiar | divorcio'], ['/california-restraining-orders', 'Órdenes de restricción | DVRO'], ['/sc', 'Reclamos menores | SC-100'], ['/california-unlawful-detainer', 'Desalojo | UD-100'], ['/california-probate', 'Sucesión | DE-111'], ['/california-expungement', 'Limpiar antecedentes | CR-180'], ['/fw-001-fee-waiver', 'Exención de cuotas | FW-001']] },
      { title: 'Negocios', links: [['/business', 'Todos los trámites de negocio'], ['/llc-1-form-an-llc', 'LLC | LLC-1'], ['/arts-gs-incorporation', 'Corporación | ARTS-GS'], ['/fbn-dba', 'FBN | DBA'], ['/ss-4-ein', 'EIN | SS-4'], ['/operating-agreement', 'Operating Agreement (acuerdo operativo)']] },
      { title: 'Imverica', links: [['/about', 'Sobre Imverica'], ['/pricing', 'Precios'], ['/for-attorneys', 'Para abogados'], ['/lda', 'Qué es un LDA'], ['/schedule', 'Agendar una llamada'], ['/account.html', 'Portal del cliente']] }
    ],
    reach: { lead: 'Otras formas de contactarnos', call: 'Llamar', email: 'Escribir un correo' },
    copyright: 'Copyright © {year} Imverica LLC. Todos los derechos reservados.',
    bottom: [['/terms.html', 'Términos del servicio'], ['/pricing', 'Precios'], ['/lda', 'Qué es un LDA'], ['/for-attorneys', 'Para abogados']],
    region: 'California, EE. UU.',
    languages: 'Idioma'
  }
};
