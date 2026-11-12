'use strict';
/**
 * Navigation to official sources instead of form selection.
 *
 * Imverica prepares the form the client chooses. When a visitor names a
 * topic ("green card", "divorce") instead of a form number, the site points
 * to the official government page for that topic and to the official form
 * directories; the visitor picks the form there and comes back with its
 * number. Topics are matched on the words that name the topic, never on the
 * visitor's circumstances, and no form is suggested.
 *
 * Every URL below was checked against the official site (uscis.gov,
 * selfhelp.courts.ca.gov, courts.ca.gov, justice.gov). Where a court topic
 * has no verified page of its own, it points to the official forms
 * directory by category.
 */

const USCIS_ALL_FORMS = 'https://www.uscis.gov/forms/all-forms';
const COURTS_ALL_FORMS = 'https://selfhelp.courts.ca.gov/find-forms/all-by-category';
const COURTS_GUIDES = 'https://selfhelp.courts.ca.gov/self-help-guide-index-pages';

const L = (en, ru, uk, es) => ({ en, ru, uk, es });

const TOPICS = [
  // USCIS
  { id: 'green-card', agency: 'uscis', url: 'https://www.uscis.gov/green-card',
    match: /green[\s-]*card|permanent\s+resid|грин[\s-]*карт|гринкарт|грін[\s-]*карт|грінкарт|вид\s+на\s+жительств|tarjeta\s+verde|residencia\s+permanente/i,
    label: L('Green card', 'Грин-карта', 'Грін-карта', 'Green card (residencia permanente)') },
  { id: 'replace-green-card', agency: 'uscis', url: 'https://www.uscis.gov/green-card/after-we-grant-your-green-card/replace-your-green-card',
    match: /(replace|renew|lost|expired?)\s+(my\s+)?green[\s-]*card|green[\s-]*card\s+(renewal|replacement)|(замен|продл|потерял|утерян)\w*\s+грин|(замін|продовж|загуби)\w*\s+грін|(renovar|reemplazar)\s+(la\s+)?(green\s*card|tarjeta)/i,
    label: L('Replace or renew a green card', 'Замена или продление грин-карты', 'Заміна або продовження грін-карти', 'Reemplazar o renovar la green card') },
  { id: 'remove-conditions', agency: 'uscis', url: 'https://www.uscis.gov/green-card/after-we-grant-your-green-card/conditional-permanent-residence/removing-conditions-on-permanent-residence-based-on-marriage',
    match: /remov\w*\s+(the\s+)?conditions|conditional\s+(green\s*card|residen)|снят\w*\s+услови|условн\w+\s+грин|зняття\s+умов|умовн\w+\s+грін|condiciones\s+de\s+(la\s+)?residencia/i,
    label: L('Removing conditions on residence', 'Снятие условий с грин-карты', 'Зняття умов з грін-карти', 'Eliminar condiciones de residencia') },
  { id: 'citizenship', agency: 'uscis', url: 'https://www.uscis.gov/citizenship',
    match: /citizenship|naturali[sz]|гражданств|натурализ|громадянств|натураліз|ciudadan[ií]a|naturaliz/i,
    label: L('Citizenship and naturalization', 'Гражданство и натурализация', 'Громадянство та натуралізація', 'Ciudadanía y naturalización') },
  { id: 'work-permit', agency: 'uscis', url: 'https://www.uscis.gov/green-card/green-card-processes-and-procedures/employment-authorization-document',
    match: /work\s+permit|employment\s+authori[sz]ation|\bead\b|разрешени\w+\s+на\s+работу|ворк\s*п[еэ]рмит|дозв[іо]л\w*\s+на\s+роботу|permiso\s+de\s+trabajo/i,
    label: L('Work permit (EAD)', 'Разрешение на работу (EAD)', 'Дозвіл на роботу (EAD)', 'Permiso de trabajo (EAD)') },
  { id: 'travel', agency: 'uscis', url: 'https://www.uscis.gov/green-card/green-card-processes-and-procedures/travel-documents',
    match: /travel\s+document|advance\s+parole|re-?entry\s+permit|тр[еэ]в[еэ]л|разрешени\w+\s+на\s+(выезд|поездк)|дозв[іо]л\w*\s+на\s+(виїзд|подорож)|documento\s+de\s+viaje|permiso\s+de\s+viaje/i,
    label: L('Travel documents', 'Документы для поездок (travel document)', 'Документи для подорожей (travel document)', 'Documentos de viaje') },
  { id: 'family', agency: 'uscis', url: 'https://www.uscis.gov/family',
    match: /family[\s-]*based|petition\s+for\s+(a\s+)?relative|family\s+immigration|семейн\w+\s+(иммиграц|петици)|сімейн\w+\s+(імміграц|петиці)|petici[oó]n\s+familiar|inmigraci[oó]n\s+familiar/i,
    label: L('Family-based immigration', 'Иммиграция через семью', 'Імміграція через родину', 'Inmigración por familia') },
  { id: 'asylum', agency: 'uscis', url: 'https://www.uscis.gov/humanitarian/refugees-and-asylum/asylum',
    match: /asylum|убежищ|асайл|притулок|азил|asilo/i,
    label: L('Asylum', 'Убежище (asylum)', 'Притулок (asylum)', 'Asilo') },
  { id: 'tps-ukraine', agency: 'uscis', url: 'https://www.uscis.gov/humanitarian/temporary-protected-status/TPS-Ukraine',
    match: /tps[^.]{0,40}(ukrain|украин|україн|ucrania)|(ukrain|украин|україн|ucrania)[^.]{0,40}tps/i,
    label: L('TPS for Ukraine', 'TPS для Украины', 'TPS для України', 'TPS para Ucrania') },
  { id: 'tps', agency: 'uscis', url: 'https://www.uscis.gov/humanitarian/temporary-protected-status',
    match: /\btps\b|temporary\s+protected|временн\w+\s+защищ|тимчасов\w+\s+захищ|estatus\s+de\s+protecci[oó]n\s+temporal/i,
    label: L('Temporary Protected Status (TPS)', 'Временный защищённый статус (TPS)', 'Тимчасовий захищений статус (TPS)', 'Estatus de Protección Temporal (TPS)') },
  { id: 'u-visa', agency: 'uscis', url: 'https://www.uscis.gov/humanitarian/victims-of-human-trafficking-and-other-crimes',
    match: /\bu[\s-]*visa\b|u\s+nonimmigrant|t[\s-]*visa|виз\w*\s+u\b|u[\s-]*виз|віз\w*\s+u\b|visa\s+u\b/i,
    label: L('U visa and T visa (victims of crimes)', 'Визы U и T (жертвы преступлений)', 'Візи U і T (жертви злочинів)', 'Visas U y T (víctimas de delitos)') },
  { id: 'sij', agency: 'uscis', url: 'https://www.uscis.gov/working-in-US/eb4/SIJ',
    match: /\bsijs?\b|special\s+immigrant\s+juvenile|специальн\w+\s+иммигрант\w*\s+несовершеннолет|juvenil\s+especial/i,
    label: L('Special Immigrant Juveniles (SIJ)', 'Особый статус для несовершеннолетних (SIJ)', 'Особливий статус для неповнолітніх (SIJ)', 'Jóvenes Inmigrantes Especiales (SIJ)') },
  { id: 'daca', agency: 'uscis', url: 'https://www.uscis.gov/DACA',
    match: /\bdaca\b|deferred\s+action|дака|отсроченн\w+\s+действ|acci[oó]n\s+diferida/i,
    label: L('DACA', 'DACA', 'DACA', 'DACA') },
  { id: 'ukraine', agency: 'uscis', url: 'https://www.uscis.gov/ukraine',
    match: /\bu4u\b|uniting\s+for\s+ukraine|ре-?парол|reparole|re-parole|юнайтинг/i,
    label: L('Uniting for Ukraine (U4U)', 'Uniting for Ukraine (U4U)', 'Uniting for Ukraine (U4U)', 'Uniting for Ukraine (U4U)') },
  { id: 'uscis-fee-waiver', agency: 'uscis', url: 'https://www.uscis.gov/feewaiver',
    match: /uscis[^.]{0,30}(fee\s+waiver|освобожд|звільн)|(fee\s+waiver|освобожд\w+\s+от\s+пошлин)[^.]{0,30}uscis/i,
    label: L('USCIS fee waiver', 'Освобождение от пошлины USCIS', 'Звільнення від мита USCIS', 'Exención de tarifas de USCIS') },
  // California courts
  { id: 'divorce', agency: 'courts', url: 'https://selfhelp.courts.ca.gov/divorce-forms',
    match: /divorce|dissolution|развод|розлуч|divorcio/i,
    label: L('Divorce (California courts)', 'Развод (суды Калифорнии)', 'Розлучення (суди Каліфорнії)', 'Divorcio (cortes de California)') },
  { id: 'court-fee-waiver', agency: 'courts', url: 'https://selfhelp.courts.ca.gov/fee-waiver',
    match: /court\s+fee|fee\s+waiver|освобожд\w+\s+от\s+(судебн|сбор|пошлин)|звільн\w+\s+від\s+(судов|збор)|exenci[oó]n\s+de\s+cuotas/i,
    label: L('Court fee waiver', 'Освобождение от судебных сборов', 'Звільнення від судових зборів', 'Exención de cuotas de la corte') },
  { id: 'family-court', agency: 'courts', url: COURTS_ALL_FORMS,
    match: /custody|child\s+support|visitation|alimony|spousal\s+support|опек|алимент|аліме|опік|custodia|manutenci[oó]n|pensi[oó]n\s+alimenticia/i,
    label: L('Custody and support (California courts forms by category)', 'Опека и алименты (формы судов Калифорнии по категориям)', 'Опіка та аліменти (форми судів Каліфорнії за категоріями)', 'Custodia y manutención (formularios de las cortes por categoría)') },
  { id: 'restraining-order', agency: 'courts', url: COURTS_ALL_FORMS,
    match: /restraining\s+order|protective\s+order|domestic\s+violence\s+order|запретительн|защитн\w+\s+ордер|заборонн|захисн\w+\s+ордер|orden\s+de\s+restricci[oó]n|orden\s+de\s+protecci[oó]n/i,
    label: L('Restraining orders (California courts forms by category)', 'Запретительные приказы (формы судов Калифорнии по категориям)', 'Заборонні накази (форми судів Каліфорнії за категоріями)', 'Órdenes de restricción (formularios de las cortes por categoría)') },
  { id: 'eviction', agency: 'courts', url: COURTS_ALL_FORMS,
    match: /eviction|unlawful\s+detainer|выселен|виселен|desalojo/i,
    label: L('Eviction (California courts forms by category)', 'Выселение (формы судов Калифорнии по категориям)', 'Виселення (форми судів Каліфорнії за категоріями)', 'Desalojo (formularios de las cortes por categoría)') },
  { id: 'small-claims', agency: 'courts', url: COURTS_ALL_FORMS,
    match: /small\s+claims?|смол+\s*кле[ий]м|мал\w+\s+иск|мал\w+\s+позов|reclamos\s+menores|demandas\s+peque/i,
    label: L('Small claims (California courts forms by category)', 'Малые иски (формы судов Калифорнии по категориям)', 'Малі позови (форми судів Каліфорнії за категоріями)', 'Reclamos menores (formularios de las cortes por categoría)') },
  { id: 'name-change', agency: 'courts', url: COURTS_ALL_FORMS,
    match: /name\s+change|change\s+(my\s+)?name|смен\w+\s+(имени|фамил)|змін\w+\s+(імені|прізвищ)|cambio\s+de\s+nombre/i,
    label: L('Name change (California courts forms by category)', 'Смена имени (формы судов Калифорнии по категориям)', 'Зміна імені (форми судів Каліфорнії за категоріями)', 'Cambio de nombre (formularios de las cortes por categoría)') },
  { id: 'guardianship-probate', agency: 'courts', url: COURTS_ALL_FORMS,
    match: /guardianship|probate|conservatorship|опекунств|наследств|спадщин|опікунств|tutela|sucesi[oó]n|herencia/i,
    label: L('Guardianship and probate (California courts forms by category)', 'Опекунство и наследство (формы судов Калифорнии по категориям)', 'Опікунство та спадщина (форми судів Каліфорнії за категоріями)', 'Tutela y sucesiones (formularios de las cortes por categoría)') },
  { id: 'record-clearing', agency: 'courts', url: COURTS_ALL_FORMS,
    match: /expunge|clean\s+(my\s+)?record|record\s+clear|1203\.4|снят\w+\s+судимост|зняття\s+судимост|limpiar\s+(mi\s+)?(record|historial|antecedentes)/i,
    label: L('Clearing a criminal record (California courts forms by category)', 'Снятие судимости (формы судов Калифорнии по категориям)', 'Зняття судимості (форми судів Каліфорнії за категоріями)', 'Limpiar antecedentes (formularios de las cortes por categoría)') }
];

const DIRECTORIES = [
  { id: 'uscis-all', agency: 'uscis', url: USCIS_ALL_FORMS, label: L('All USCIS forms', 'Все формы USCIS', 'Усі форми USCIS', 'Todos los formularios de USCIS') },
  { id: 'courts-all', agency: 'courts', url: COURTS_ALL_FORMS, label: L('All California court forms by category', 'Все формы судов Калифорнии по категориям', 'Усі форми судів Каліфорнії за категоріями', 'Todos los formularios de las cortes de California por categoría') }
];

const FREE_HELP = [
  { id: 'courts-self-help', url: COURTS_GUIDES, label: L('California Courts self-help guides', 'Справочник самопомощи судов Калифорнии', 'Довідник самодопомоги судів Каліфорнії', 'Guías de autoayuda de las cortes de California') },
  { id: 'eoir-free', url: 'https://www.justice.gov/eoir/list-pro-bono-legal-service-providers', label: L('Free immigration legal service providers (EOIR list)', 'Бесплатная иммиграционная юридическая помощь (список EOIR)', 'Безкоштовна імміграційна юридична допомога (список EOIR)', 'Proveedores de servicios legales gratuitos de inmigración (lista de EOIR)') }
];

const LANGS = ['en', 'ru', 'uk', 'es'];
function pickLang(lang) { const l = String(lang || 'en').slice(0, 2).toLowerCase(); return LANGS.includes(l) ? l : 'en'; }

/**
 * Official topic pages for the topics the text names (most specific first,
 * at most `limit`). No form is ever returned.
 */
function topicsFor(text, lang = 'en', limit = 2) {
  const t = String(text || '');
  const l = pickLang(lang);
  const found = [];
  for (const topic of TOPICS) {
    if (!topic.match.test(t)) continue;
    // A more specific topic (TPS for Ukraine, replacing a green card)
    // supersedes the general one it contains.
    if (topic.id === 'tps' && found.some((f) => f.id === 'tps-ukraine')) continue;
    if (topic.id === 'green-card' && found.some((f) => f.id === 'replace-green-card' || f.id === 'remove-conditions')) continue;
    if (topic.id === 'court-fee-waiver' && found.some((f) => f.id === 'uscis-fee-waiver')) continue;
    found.push({ id: topic.id, agency: topic.agency, url: topic.url, label: topic.label[l] });
    if (found.length >= limit) break;
  }
  return found;
}

/** Topic pages plus the official directories and free-help links, localized. */
function navigationFor(text, lang = 'en') {
  const l = pickLang(lang);
  const topics = topicsFor(text, l);
  const agencies = new Set(topics.map((t) => t.agency));
  const directories = DIRECTORIES
    .filter((d) => !agencies.size || agencies.has(d.agency))
    .map((d) => ({ id: d.id, url: d.url, label: d.label[l] }));
  return {
    topics,
    directories,
    freeHelp: FREE_HELP.map((h) => ({ id: h.id, url: h.url, label: h.label[l] }))
  };
}

/**
 * Form numbers the text itself contains, normalized ("i485", "I 485",
 * "fl-100", "EOIR-42B"). Only these may be prepared without the client
 * naming a number first.
 */
const CODE_RE = /\b(I|N|G|AR|EOIR|FL|DV|SC|UD|CH|EA|GV|WV|FW|NC|MC|CIV|POS|SUM|PLD|GC|DE|CR|JV|DS|ADR|APP|EJ|WG|SER|SUBP|INT|LA|ICWA|CM|TR|AT|DAL|RA|CP|SFL)[\s._-]?(\d{1,4}[A-Z]{0,4})\b/gi;
function explicitFormCodes(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(CODE_RE)) out.add(`${m[1].toUpperCase()}-${m[2].toUpperCase()}`);
  return [...out];
}

module.exports = { TOPICS, DIRECTORIES, FREE_HELP, topicsFor, navigationFor, explicitFormCodes, USCIS_ALL_FORMS, COURTS_ALL_FORMS };
