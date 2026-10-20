/**
 * Immigration court (EOIR) matters are attorney-only for Imverica: removal
 * (deportation) proceedings, cancellation of removal, BIA appeals, court
 * motions, detention and bond. Only an attorney or a DOJ-accredited
 * representative may advise or represent a respondent before EOIR
 * (8 C.F.R. 1292.1), so the finder, the intake and the chat say so instead of
 * pointing to a form. Imverica works on EOIR cases only as a paralegal under
 * an attorney's direction.
 */
const PRO_BONO_URL = 'https://www.justice.gov/eoir/list-pro-bono-legal-service-providers';

const EOIR_ATTORNEY_ONLY = new RegExp([
  String.raw`\beoir\b`,
  String.raw`immigration\s+(?:court|judge|hearing|bond|detention)`,
  String.raw`\bbia\b`,
  String.raw`board\s+of\s+immigration\s+appeals`,
  String.raw`\bremoval\s+(?:proceeding|hearing|case|order|defen[cs]e)`,
  String.raw`order\s+of\s+(?:removal|deportation)`,
  String.raw`cancell?ation\s+of\s+(?:removal|deportation)`,
  String.raw`suspension\s+of\s+deportation`,
  String.raw`\bdeport(?:ation|ed|ing)?\b`,
  String.raw`\bnta\b`,
  String.raw`notice\s+to\s+appear`,
  String.raw`voluntary\s+departure`,
  String.raw`defensive\s+asylum`,
  String.raw`asylum\s+(?:in|before)\s+(?:the\s+)?(?:immigration\s+)?court`,
  String.raw`\bice\s+(?:detention|custody)|detained\s+by\s+ice|bond\s+hearing`,
  // Russian / Ukrainian
  String.raw`депорт`,
  String.raw`высылк|видворен`,
  String.raw`иммиграционн[а-яё]*\s+суд|суд[а-яё]*\s+по\s+иммиграц|імміграційн[а-яіїєґ]*\s+суд`,
  // Spanish
  String.raw`deportaci[oó]n|deportad[oa]s?\b|deportar`,
  String.raw`(?:corte|tribunal|juez|jueza|audiencia)\s+de\s+inmigraci[oó]n`,
  String.raw`cancelaci[oó]n\s+de\s+(?:la\s+)?(?:remoci[oó]n|deportaci[oó]n|removal)`,
  String.raw`procedimientos?\s+de\s+(?:remoci[oó]n|deportaci[oó]n|removal)`,
  String.raw`aviso\s+de\s+comparecencia`,
  String.raw`salida\s+voluntaria`
].join('|'), 'i');

const EOIR_MESSAGE = {
  en: `Immigration court (EOIR) matters, such as removal or deportation proceedings, cancellation of removal, BIA appeals and court motions, need a licensed immigration attorney or a DOJ-accredited representative. Imverica does not prepare immigration court filings for individuals: we work on EOIR cases only as a paralegal under an attorney's direction. Free or low-cost legal help: ${PRO_BONO_URL}. General information, not legal advice.`,
  ru: `Дела в иммиграционном суде (EOIR) — депортация (removal proceedings), cancellation of removal, апелляции в BIA и ходатайства в суд — требуют лицензированного иммиграционного адвоката или аккредитованного представителя (DOJ-accredited representative). Imverica не готовит документы в иммиграционный суд для частных лиц: по делам EOIR мы работаем только как помощник юриста (paralegal) под руководством адвоката. Бесплатная или недорогая юридическая помощь: ${PRO_BONO_URL}. Общая информация, не юридическая консультация.`,
  uk: `Справи в імміграційному суді (EOIR) — депортація (removal proceedings), cancellation of removal, апеляції до BIA та клопотання до суду — потребують ліцензованого імміграційного адвоката або акредитованого представника (DOJ-accredited representative). Imverica не готує документи до імміграційного суду для приватних осіб: у справах EOIR ми працюємо лише як помічник юриста (paralegal) під керівництвом адвоката. Безкоштовна або недорога юридична допомога: ${PRO_BONO_URL}. Загальна інформація, не юридична консультація.`,
  es: `Los asuntos de la corte de inmigración (EOIR), como procedimientos de deportación (removal), cancelación de remoción, apelaciones ante la BIA y mociones ante la corte, requieren un abogado de inmigración con licencia o un representante acreditado por el DOJ. Imverica no prepara escritos para la corte de inmigración para particulares: en casos de EOIR trabajamos solo como asistente legal (paralegal) bajo la dirección de un abogado. Ayuda legal gratuita o de bajo costo: ${PRO_BONO_URL}. Información general, no asesoría legal.`
};

module.exports = { EOIR_ATTORNEY_ONLY, EOIR_MESSAGE, PRO_BONO_URL };
