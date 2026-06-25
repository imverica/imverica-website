const catalogs = {
  immigration: require('./forms/immigration.json'),
  fl: require('./forms/fl.json'),
  civ: require('./forms/civ.json'),
  sc: require('./forms/sc.json'),
  ud: require('./forms/ud.json'),
  ro: require('./forms/ro.json'),
  fee: require('./forms/fee.json'),
  service: require('./forms/service.json'),
  probate: require('./forms/probate.json'),
  nc: require('./forms/nc.json'),
  enforce: require('./forms/enforce.json'),
  juvenile: require('./forms/juvenile.json'),
  criminal: require('./forms/criminal.json'),
  appeals: require('./forms/appeals.json'),
  general: require('./forms/general.json')
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const SERVICE_BY_CATALOG = {
  immigration: 'immigration',
  fl: 'family',
  civ: 'civil',
  sc: 'civil',
  ud: 'ud',
  ro: 'restraining',
  fee: 'civil',
  service: 'civil',
  probate: 'probate',
  nc: 'civil',
  enforce: 'civil',
  juvenile: 'juvenile',
  criminal: 'criminal',
  appeals: 'appeals',
  general: 'civil'
};

const JURISDICTION_BY_CATALOG = {
  immigration: 'USCIS',
  fl: 'California Superior Court',
  civ: 'California Superior Court',
  sc: 'California Superior Court',
  ud: 'California Superior Court',
  ro: 'California Superior Court',
  fee: 'California Superior Court',
  service: 'California Superior Court',
  probate: 'California Superior Court',
  nc: 'California Superior Court',
  enforce: 'California Superior Court',
  juvenile: 'California Superior Court',
  criminal: 'California Superior Court',
  appeals: 'California Court of Appeal',
  general: 'California Superior Court'
};

// Multi-language NLP routing rules. Each rule covers EN / RU / UA / ES
// vocabulary for one topic and maps to a starting form. Rules are checked
// in declared order, so place more specific patterns FIRST (a rule for
// "removal of conditions" must beat the broader "green card" rule).
//
// Convention: use word stems (e.g. `развод|развест`) so all inflections
// match; combine languages in one regex per rule to keep things readable.
//
// When extending: add the form code to the right catalog JSON so the
// `findByCode` lookup at the end of routing returns a real row.
const PACKAGE_RULES = [
  // ===== Top-of-list priority overrides for ambiguous phrases =====
  // These three rules sit ABOVE the broader matchers below because the
  // phrasing they catch (e.g. "translation of marriage certificate")
  // otherwise gets hijacked by the marriage / unlawful-detainer rules.
  {
    id: 'translation_priority',
    formCode: 'TRANSLATION',
    service: 'translation',
    packageForms: ['TRANSLATION'],
    confidence: 0.96,
    patterns: [/(translat\w+\s+(of\s+|my\s+)?(birth|marriage|divorce|diploma|degree|certificate|passport|document|record|paper)|certified\s+translat|translation\s+(service|certified|notari[zs]ed))/i],
    reason: 'Document translation phrasing → translation package (priority).'
  },
  {
    id: 'passport_renewal',
    formCode: 'DS-82',
    service: 'passport',
    packageForms: ['DS-82'],
    confidence: 0.95,
    patterns: [/(renew\s+(my\s+)?passport|passport\s+(expired|renewal|expires?)|expired\s+passport|обновить\s+(загран)?паспорт|поновити\s+паспорт|renovar\s+(mi\s+)?pasaporte)/i],
    reason: 'Passport renewal phrasing → DS-82 (priority over the general DS-11 passport rule).'
  },
  {
    id: 'security_deposit_priority',
    formCode: 'SC-100',
    service: 'civil',
    packageForms: ['SC-100', 'DEMAND-LETTER'],
    confidence: 0.94,
    // A security-deposit dispute (tenant vs landlord) is ALWAYS a small-claims
    // matter (SC-100) — never an unlawful detainer. The broad UD rule further
    // down grabs bare "landlord"/"tenant", so this MUST fire first whenever a
    // deposit is mentioned in a rental context (EN/RU/UA/ES).
    patterns: [
      /security\s+deposit/i,
      /\bdeposit\b[\s\S]{0,60}\b(landlord|tenant|renter|lessor|lessee|rent|lease|apartment|rental)\b|\b(landlord|tenant|renter|lessor|lessee|rent|lease|apartment|rental)\b[\s\S]{0,60}\bdeposit\b/i,
      /(депозит|завдаток|застав\w*)[\s\S]{0,50}(оренд|аренд|квартир|жил|лендлорд|арендодател|арендатор|орендар|орендодав|tenant|landlord)|(оренд|аренд|квартир|жил|лендлорд|арендодател|арендатор|орендар|орендодав)[\s\S]{0,50}(депозит|завдаток|застав\w*)/i,
      /dep[oó]sito\s+(de\s+(seguridad|garant\w*)|de\s+alquiler|del\s+inquilino)|dep[oó]sito[\s\S]{0,50}(arrendador|arrendatario|inquilino|alquiler|renta)/i
    ],
    reason: 'Security-deposit dispute (tenant vs landlord) → SC-100 small claims — must beat the broad unlawful-detainer rule.'
  },
  {
    id: 'lawsuit_response',
    formCode: 'SC-120',
    service: 'civil',
    packageForms: ['SC-120'],
    confidence: 0.85,
    patterns: [/(i\s+was\s+sued|got\s+sued|been\s+sued|i\s+was\s+served(?![\s\S]{0,30}(unlawful|evict|detainer))|served\s+(with\s+)?(a\s+)?(lawsuit|small\s+claims|complaint|summons|court\s+papers)|need\s+to\s+(file\s+a\s+)?respon(d|se)\s+(to\s+)?(small\s+claims|lawsuit|claim)|меня\s+подали\s+в\s+суд|против\s+меня\s+(подали\s+)?иск|подали\s+иск\s+против|мне\s+вручили\s+(иск|повестк))/i],
    reason: 'Generic "I was sued / file a response" → SC-120 defendant counter.'
  },
  {
    id: 'name_change_after_marriage_priority',
    formCode: 'NC-100',
    service: 'civil',
    packageForms: ['NC-100'],
    confidence: 0.85,
    patterns: [/(got|after)\s+(married|marriage|divorced?|divorce).*(change\s+(my\s+)?(last\s+)?name)|(change\s+(my\s+)?(last\s+)?name\s+(back\s+)?after\s+(getting\s+)?(married|marriage|wedding|divorced?|divorce))|(last\s+)?name\s+change\s+(back\s+)?(after|due\s+to|following|because\s+of)\s+(my\s+)?(marriage|wedding|divorced?|divorce)|(restore|change\s+back)\s+(my\s+)?(maiden|former|previous)\s+name|change\s+(my\s+)?name\s+back\s+to\s+(my\s+)?maiden/i],
    reason: 'Name change after marriage OR divorce (incl. restoring a maiden name) → NC-100 (priority over the FL-100 / marriage rule).'
  },
  {
    id: 'record_cleanup_expungement',
    formCode: 'CR-180',
    service: 'civil',
    packageForms: ['CR-180', 'CR-181', 'POS-030', 'FW-001'],
    confidence: 0.92,
    patterns: [/(cr-?180|cr-?181|expung(e|ement)|record\s+(clean|cleanup|clear|clearance|cleaning|seal)|clean\s+(my\s+)?record|petition\s+for\s+dismissal|dismiss\s+(my\s+)?conviction|dui\s+(expungement|dismissal|record|cleanup|clean|clear)|early\s+termination\s+of\s+probation|terminat\w*\s+(my\s+)?probation|end\s+(my\s+)?probation\s+early|1203\.[34]|reduce\s+(my\s+)?felony|felony\s+to\s+(a\s+)?misdemeanor|17\s*\(?\s*b\s*\)?|wobbler|seal\s+(my\s+|an?\s+)?(arrest|juvenile|record)|arrest\s+(record\s+)?seal|juvenile\s+(record\s+)?seal|851\.91|\bwic\s*781\b|prop(osition)?\s*64|11361\.8|redesignat\w*|снять\s+судим|снятие\s+судим|погашение\s+судим|очистить\s+(запись|рекорд)|досрочн\w*\s+(прекращ|окончан)|прекрат\w*\s+испытат|опечат\w*\s+арест|экспандж|экспундж|видалити\s+судим|очистити\s+запис|limpiar\s+(mi\s+)?(record|antecedentes)|borrar\s+antecedentes|terminaci[oó]n\s+anticipada|sellar\s+(mi\s+)?(arresto|registro))/i],
    reason: 'California record-clearing language (expungement/dismissal, early termination of probation, felony reduction, arrest/juvenile sealing, Prop 64) maps to the CR-180 record-cleanup intake.'
  },

  // ===== EOIR (immigration court) — most specific first =====
  {
    id: 'bia_appeal',
    formCode: 'EOIR-29',
    service: 'immigration',
    packageForms: ['EOIR-29'],
    confidence: 0.95,
    patterns: [/eoir-?29|bia\s*appeal|board\s*of\s*immigration\s*appeals|notice\s*of\s*appeal|апелляц[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(в|до)\s+(bia|совет|раду)|апеляц[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+в\s+bia|apelaci[oó]n\s+bia/i],
    reason: 'BIA appeal language maps to Form EOIR-29.'
  },
  {
    id: 'cancellation_removal_lpr',
    formCode: 'EOIR-42A',
    service: 'immigration',
    packageForms: ['EOIR-42A', 'EOIR-28'],
    confidence: 0.92,
    patterns: [/eoir-?42a|cancellation\s+of\s+removal\s+(for|of)\s+(lpr|permanent\s+resident)|отмена\s+removal\s+для\s+lpr|відмін[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+removal/i],
    reason: 'LPR cancellation-of-removal language maps to EOIR-42A.'
  },
  {
    id: 'cancellation_removal_non_lpr',
    formCode: 'EOIR-42B',
    service: 'immigration',
    packageForms: ['EOIR-42B', 'EOIR-28'],
    confidence: 0.92,
    patterns: [/eoir-?42b|cancellation\s+of\s+removal|cancelaci[oó]n\s+de\s+(removal|deportaci[oó]n)|отмена\s+(депортац|removal)|відмін[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+депортац|10\s+years?\s+(physical\s+)?presence/i],
    reason: 'Non-LPR cancellation-of-removal language maps to EOIR-42B.'
  },
  {
    id: 'removal_proceedings',
    formCode: 'EOIR-42B',
    service: 'immigration',
    packageForms: ['EOIR-42B', 'EOIR-28'],
    confidence: 0.78,
    patterns: [/removal\s+proceed|immigration\s+court|deportation\s+(hearing|case)|депортац[\wа-яёіїєґА-ЯЁІЇЄҐ]*|removal\s+depo|procedimiento\s+de\s+(removal|deportaci[oó]n)|nta|notice\s+to\s+appear|про\s+депорта|іммігр[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+суд/i],
    reason: 'Generic removal/deportation language defaults to EOIR-42B prep.'
  },

  // ===== USCIS humanitarian (high specificity) =====
  {
    id: 'asylum',
    formCode: 'I-589',
    service: 'immigration',
    packageForms: ['I-589', 'I-765', 'I-912'],
    confidence: 0.93,
    patterns: [/asylum|asilo\b|i-?589|withholding\s*of\s*removal|political\s+asylum|убежищ|притул|переслідуван|преследовани|persecu(tion|ción|cija)|refugee\s+status|статус\s+беженц|статус\s+біженц|estatus\s+de\s+refugiad/i],
    reason: 'Asylum language maps to Form I-589 + companion EAD / fee waiver.'
  },
  {
    id: 'u_visa',
    formCode: 'I-918',
    service: 'immigration',
    packageForms: ['I-918', 'I-918A'],
    confidence: 0.93,
    patterns: [/u-?visa|u\s+visa|i-?918|crime\s+victim|жертв[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+преступл|жертв[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+злочин|v[ií]ctima\s+de\s+(delito|crimen)/i],
    reason: 'U-visa / crime-victim language maps to Form I-918.'
  },
  {
    id: 'vawa_self_petition',
    formCode: 'I-360',
    service: 'immigration',
    packageForms: ['I-360'],
    confidence: 0.93,
    patterns: [/vawa|violence\s+against\s+women|i-?360|self-?petition|насили[ея]\s+в\s+семь|домашн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+насили|домашн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+насильств|abuso\s+(dom[eé]stico|conyugal)|battered\s+spouse|battered\s+sp/i],
    reason: 'VAWA / domestic-violence-survivor language maps to Form I-360.'
  },
  {
    id: 'tps',
    formCode: 'I-821',
    service: 'immigration',
    packageForms: ['I-821', 'I-765'],
    confidence: 0.95,
    patterns: [/\btps\b|temporary\s+protected\s+status|i-?821(?!d)|временн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+защищ[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+статус|тимчасов[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+захист|estatus\s+(temporal\s+)?protegido|estado\s+de\s+protecci[oó]n\s+temporal/i],
    reason: 'TPS language maps to Form I-821 + EAD.'
  },
  {
    id: 'daca',
    formCode: 'I-821D',
    service: 'immigration',
    packageForms: ['I-821D', 'I-765'],
    confidence: 0.95,
    patterns: [/\bdaca\b|i-?821d|deferred\s+action\s+for\s+childhood|dreamers?|даклишник|программа\s+daca|deferred\s+action/i],
    reason: 'DACA language maps to Form I-821D.'
  },
  {
    id: 'u4u_uniting',
    formCode: 'I-134A',
    service: 'immigration',
    packageForms: ['I-134A'],
    confidence: 0.93,
    patterns: [/u4u|uniting\s+for\s+ukraine|програма\s+u4u|об[єе]днан[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+за\s+україну|за\s+украин|sponsor\s+from\s+ukraine|спонсор\s+украин/i],
    reason: 'Uniting for Ukraine sponsor language maps to Form I-134A.'
  },

  // ===== USCIS family-petition + green-card status moves =====
  {
    id: 'remove_conditions_marriage',
    formCode: 'I-751',
    service: 'immigration',
    packageForms: ['I-751'],
    confidence: 0.93,
    patterns: [/i-?751|remove?\s+conditions?|removal\s+of\s+conditions|10-?year\s+card|conditional\s+(green\s*card|resident)|снят[ьие]\s+услов|снять\s+условн|условн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(резидент|green)|умов[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+резидент|зняти\s+умов/i],
    reason: 'Conditional-residence language maps to Form I-751.'
  },
  {
    id: 'green_card_renewal',
    formCode: 'I-90',
    service: 'immigration',
    packageForms: ['I-90'],
    confidence: 0.93,
    patterns: [/i-?90\b|renew\s+green\s*card|replace\s+green\s*card|green\s*card\s+(renew|replace|lost|stolen|expir)|обнов[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(green|грин)|замен[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(green|грин)|потер[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(green|грин)|поновлен[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(green|грін)|renovar\s+(green\s*card|tarjeta\s+verde)|reemplaz\w*\s+(green|tarjeta\s+verde)|(lost|stolen|damaged|потерял|украли|повредил|загубив)[\s\S]{0,25}(green ?card|грин[- ]?карт)(?![\s\S]{0,30}(abroad|overseas|outside|за границ|за кордон))|(green ?card|грин[- ]?карт)[\s\S]{0,25}(lost|stolen|damaged|потерял|украли)(?![\s\S]{0,30}(abroad|overseas|outside|за границ|за кордон))/i],
    reason: 'Green card renewal / replacement language maps to Form I-90.'
  },
  {
    id: 'naturalization_citizenship',
    formCode: 'N-400',
    service: 'immigration',
    packageForms: ['N-400'],
    confidence: 0.95,
    patterns: [/n-?400|naturali[zs]e|naturali(zation|zaci[oó]n)|citizenship|сдать\s+на\s+гражданств|подать\s+на\s+гражданств|стать\s+гражданин|гражданств[оа]?|громадянств|ciudadan[ií]a|hacerse\s+ciudadan/i],
    reason: 'Citizenship / naturalization language maps to Form N-400.'
  },
  {
    id: 'family_petition_relative',
    formCode: 'I-130',
    service: 'immigration',
    packageForms: ['I-130', 'I-130A'],
    confidence: 0.88,
    patterns: [/i-?130|family\s+petition|petition\s+for\s+(relative|spouse|parent|child|brother|sister)|петиц[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(для\s+)?(семь|родственник|супруг|родител|жен|муж|ребен|брат|сестр|дет)|петиц[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(для\s+)?родич|перевезт[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(родител|жен|муж|ребен|брат|сестр|дет|семь)|вызвать\s+(родител|жен|муж|ребен|брат|сестр|дет)|переїхати\s+(жінк|чоловік|дитин|брат|сестр|батьк)|petici[oó]n\s+(de|para)\s+(familiar|hijo|padre|c[oó]nyuge|esposo|esposa|hermano)/i],
    reason: 'Family-petition language maps to Form I-130 + I-130A.'
  },
  {
    id: 'travel_doc_advance_parole',
    formCode: 'I-131',
    service: 'immigration',
    packageForms: ['I-131'],
    confidence: 0.9,
    patterns: [/i-?131(?!a)|advance\s+parole|reentry\s+permit|re-?entry|travel\s+document|refugee\s+travel\s+doc|выехать\s+за\s+границ|выезд\s+(временн|долго)|разрешен[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+на\s+(поездк|выезд|въезд|въезжа)|тревел\s+документ|документ\s+(на\s+)?поездк|advance\s+parol|adelantado\s+de\s+permiso|permiso\s+de\s+viaje|документ\s+на\s+поверненн/i],
    reason: 'Advance Parole / Re-entry Permit language maps to Form I-131.'
  },
  {
    id: 'returning_resident_i131a',
    formCode: 'I-131A',
    service: 'immigration',
    packageForms: ['I-131A'],
    confidence: 0.95,
    patterns: [/i-?131a|returning resident|carrier documentation|(lost|stolen|потерял|украли|загубив|вкрали)[\s\S]{0,30}(green ?card|грин[- ]?карт)[\s\S]{0,30}(abroad|overseas|outside|за границ|за кордон|travel)|(green ?card|грин[- ]?карт)[\s\S]{0,30}(lost|stolen|потерял|украли)[\s\S]{0,30}(abroad|overseas|за границ|за кордон)/i],
    reason: 'Returning-resident with expired green card maps to Form I-131A.'
  },
  {
    id: 'affidavit_of_support',
    formCode: 'I-864',
    service: 'immigration',
    packageForms: ['I-864', 'I-864A'],
    confidence: 0.9,
    patterns: [/i-?864|affidavit\s+of\s+support|sponsor(\s+immigrant)?|спонсор[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(на\s+|для\s+)?(иммигрант|семь|родственник)|финансов[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+поручительств|финансов[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+гарант|поручительств[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+иммигр|спонсорств|patrocinador|declaraci[oó]n\s+jurada\s+de\s+(apoyo|patrocinio)/i],
    reason: 'Affidavit-of-Support language maps to Form I-864.'
  },
  {
    id: 'change_of_status',
    formCode: 'I-539',
    service: 'immigration',
    packageForms: ['I-539', 'I-539A'],
    confidence: 0.93,
    patterns: [/i-?539|change\s+of\s+status|extend\s+(non-?immigrant\s+)?status|extension\s+of\s+stay|продл(ить|и|е|евая|ева|евае|ит|и)\w*\s+(статус|виз|пребыв)|сменить\s+статус|сменить\s+виз|change\s+status\s+(to\s+)?(b|f|h|l|j)|продовж[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(статус|віз)|сменить\s+(в|на)\s+(студент|h-?\d|туристичн|рабоч)|extender\s+(estatus|visa)|cambiar\s+estatus/i],
    reason: 'Status change / extension language maps to Form I-539.'
  },
  {
    id: 'medical_exam',
    formCode: 'I-693',
    service: 'immigration',
    packageForms: ['I-693'],
    confidence: 0.93,
    patterns: [/i-?693|medical\s+exam(ination)?|civil\s+surgeon|медицин[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(осмотр|обследован|прохожден)|пройти\s+мед|медогляд|examen\s+m[eé]dico/i],
    reason: 'Medical examination language maps to Form I-693.'
  },
  {
    id: 'action_on_approved',
    formCode: 'I-824',
    service: 'immigration',
    packageForms: ['I-824'],
    confidence: 0.93,
    patterns: [/i-?824|duplicate\s+approval|follow-?to-?join|action\s+on\s+approved|дублика[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+approval|дублика[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+i-?797|повторн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+approval|follow\s+to\s+join|воссоединен[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+семь/i],
    reason: 'Duplicate approval / follow-to-join language maps to Form I-824.'
  },
  {
    id: 'fee_waiver_uscis',
    formCode: 'I-912',
    service: 'immigration',
    packageForms: ['I-912'],
    confidence: 0.9,
    patterns: [/i-?912|fee\s+waiver\s+(uscis|immigration)|освобожден[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+от\s+пошлин[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+uscis|не\s+могу\s+заплатить\s+uscis|exenci[oó]n\s+de\s+cuota\s+uscis/i],
    reason: 'USCIS fee waiver language maps to Form I-912.'
  },

  // ===== Existing immigration rules (kept after more specific ones) =====
  {
    id: 'work_permit',
    formCode: 'I-765',
    service: 'immigration',
    packageForms: ['I-765'],
    confidence: 0.92,
    patterns: [/ворк\s*п[еэ]рмит|work\s*permit|employment\s+authoriz|i-?765|\bead\b|разрешени[ея]\s+на\s+работ|дозвіл\s+на\s+роботу|permiso\s+de\s+trabajo|autorizaci[oó]n\s+de\s+empleo/i],
    reason: 'Work permit language maps to Form I-765.'
  },
  {
    id: 'green_card_aos',
    formCode: 'I-485',
    service: 'immigration',
    packageForms: ['I-485', 'I-765', 'I-131', 'I-864', 'I-693'],
    confidence: 0.84,
    patterns: [/i-?485|adjustment\s+of\s+status|adjust\s+status|грин\s*карт|green\s*card|изменени[ея]\s+статус|изменить\s+статус\s+на\s+резидент|получить\s+грин|получить\s+green|оформ[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+грин|оформ[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+green|зміна\s+статусу|отримати\s+green|tarjeta\s+verde|residencia\s+permanente|ajustar?\s+(de\s+)?estatus/i],
    reason: 'Adjustment of status / green card in the US maps to Form I-485.'
  },
  {
    id: 'marriage_uscis',
    formCode: 'I-130',
    service: 'immigration',
    packageForms: ['I-130', 'I-130A', 'I-485', 'I-765', 'I-131', 'I-864'],
    confidence: 0.86,
    // Require BOTH a marriage term AND an immigration signal in proximity (either
    // order) so a bare spouse word ("муж", "развестись с мужем") no longer pulls
    // an immigration petition, while real "marriage + USCIS/green card" queries do.
    patterns: [/(?:marriage|married|spouse|husband|wife|fianc|свадьб|брак|замуж|женит|вийти\s+заміж|одружит|matrimonio|esposo|esposa|c[oó]nyuge|муж|жен|супруг)[\s\S]{0,45}(?:uscis|green\s*card|citizen|residen|\bvisa\b|petition|immigrat|грин[\s-]?карт|гражданств|иммигра|петиц|\bвиз[аыу]|спонсир|іммігра|громадянств)|(?:uscis|green\s*card|citizen|residen|\bvisa\b|petition\s+for|immigrat|грин[\s-]?карт|гражданств|иммигра|петиц|спонсир|іммігра|громадянств)[\s\S]{0,45}(?:marriage|married|spouse|husband|wife|свадьб|брак|замуж|женит|matrimonio|esposo|esposa|c[oó]nyuge|муж|жен|супруг)/i],
    reason: 'Marriage/family immigration language maps to a family petition + AOS package.'
  },

  // ===== Family Law (California) =====
  {
    id: 'divorce_response',
    formCode: 'FL-120',
    service: 'family',
    packageForms: ['FL-120', 'FL-150'],
    confidence: 0.9,
    patterns: [/fl-?120|response\s+to\s+(divorce|petition|dissolution)|respond\s+to\s+(divorce|petition)|ответ\s+на\s+(развод|иск\s+на\s+развод|петиц[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+о\s+развод)|відповід[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+на\s+розлуч|contestar\s+(divorcio|petici[oó]n\s+de\s+divorcio)/i],
    reason: 'Response-to-divorce language maps to Form FL-120.'
  },
  {
    id: 'property_division',
    formCode: 'FL-160',
    service: 'family',
    packageForms: ['FL-160', 'FL-150'],
    confidence: 0.88,
    patterns: [/fl-?160|property\s+(division|declaration)|division\s+of\s+(assets|property|community\s+property)|раздел\s+(имуществ|собственност|совместн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+имуществ)|поділ\s+майна|divisi[oó]n\s+de\s+(bienes|propiedad|comunidad)/i],
    reason: 'Property division language maps to Form FL-160.'
  },
  {
    id: 'income_expense',
    formCode: 'FL-150',
    service: 'family',
    packageForms: ['FL-150'],
    confidence: 0.93,
    patterns: [/fl-?150|income\s+(and\s+)?expense|income.expense\s+declaration|декларац[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(доход|расход)|доход[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+и\s+расход[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(декл|для\s+суд)|declaraci[oó]n\s+de\s+(ingresos|gastos)/i],
    reason: 'Income/expense declaration maps to Form FL-150.'
  },
  {
    id: 'custody_jurisdiction_uccjea',
    formCode: 'FL-105',
    service: 'family',
    packageForms: ['FL-105'],
    confidence: 0.85,
    patterns: [/fl-?105|uccjea|child(ren)?\s+(jurisdiction|custody\s+jurisdiction)|interstate\s+custody|юрисдикц[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+по\s+(ребен|дет)|переезд\s+с\s+ребен|переехать\s+с\s+ребен/i],
    reason: 'UCCJEA / interstate custody jurisdiction maps to Form FL-105.'
  },
  {
    // Opening probate after a death → DE-111 petition (the keyword scorer was
    // landing on DE-122 Citation for "died without a will" queries).
    id: 'probate_open',
    formCode: 'DE-111',
    service: 'probate',
    packageForms: ['DE-111', 'DE-121', 'DE-140'],
    confidence: 0.9,
    patterns: [/petition for probate|de-?111|(father|mother|parent|husband|wife|spouse|brother|sister|отец|мать|муж|жена|батько|мати|padre|madre|esposo|esposa)[\s\S]{0,30}(died|passed away|умер|помер|falleci)|died (with|without) a will|умер (без|с) завещани|помер (без|із) заповіт|открыть наследств|відкрити спадщин|estate of (my|the) (late|deceased)/i],
    reason: 'Opening a decedent estate → DE-111 Petition for Probate (CA).'
  },
  {
    // Guardianship of a minor (by a non-parent, e.g. grandparent) or
    // conservatorship of an adult → GC series (probate), NOT family-law custody.
    // Placed before family_request_order so "опека над внуком" doesn't read as
    // parent custody (FL-300).
    id: 'guardianship_conservatorship',
    formCode: 'GC-210',
    service: 'probate',
    packageForms: ['GC-210', 'GC-110', 'GC-310'],
    confidence: 0.86,
    patterns: [/guardianship|conservatorship|legal\s+guardian|become\s+(a\s+)?guardian|guardian\s+of\s+(a\s+)?(minor|child|grandchild|grandson|granddaughter)|conservator(ship)?\s+(of|for)|опек[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+над\s+(внук|несовершеннолетн|недееспособн|онук)|попечительств|опіка\s+над\s+(онук|дитин|неповнолітн)|tutela\s+(legal|de\s+un\s+menor|de\s+menor)|curadur[ií]a|conservadur[ií]a/i],
    reason: 'Guardianship of a minor / conservatorship of an adult → GC series (CA probate).'
  },
  {
    id: 'family_request_order',
    formCode: 'FL-300',
    service: 'family',
    packageForms: ['FL-300', 'FL-311', 'FL-150'],
    confidence: 0.82,
    patterns: [/fl-?300|request\s+for\s+order|custody|visitation|child\s+support|spousal\s+support|(see|visit)\s+my\s+(kid|child|son|daughter|children)|won'?t\s+let\s+me\s+see\s+(my\s+)?(kid|child)|кастоди|опек(?![\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+над\s+(внук|онук))|алимент|алімент|содержан[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+ребен|содержан[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+супруг|делить\s+дет|раздел[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+дет|видеть\s+(детей|ребён|ребен)|не\s+да[её]т\s+видеть|поділ\s+(діт|опік)|с\s+кем\s+(будут|останут)\s+дет|pensi[oó]n\s+(alimenticia|de\s+manutenci[oó]n)|custodia|visitas/i],
    reason: 'Family-law request (custody / support / visitation) maps to Form FL-300.'
  },
  {
    id: 'divorce',
    formCode: 'FL-100',
    service: 'family',
    packageForms: ['FL-100', 'FL-105', 'FL-110', 'FL-115'],
    confidence: 0.86,
    patterns: [/fl-?100|divorce|dissolution|развод|развест|разводи|розлуч|розвест|divorci|separaci[oó]n\s+legal|legal\s+separation/i],
    reason: 'Divorce / dissolution language maps to Form FL-100.'
  },
  {
    id: 'fee_waiver_court',
    formCode: 'FW-001',
    service: 'civil',
    packageForms: ['FW-001'],
    confidence: 0.9,
    patterns: [/fw-?001|fee\s+waiver\s+(court|california|c[ao])|waive\s+(court\s+|filing\s+)?fees|(can'?t|cannot|unable\s+to)\s+afford\s+(the\s+)?(court\s+|filing\s+){0,2}fee|afford\s+the\s+(court|filing)\s+fee|(court|filing)\s+fees?\b.{0,15}(waiv|afford|can'?t\s+pay|too\s+expensive)|waive\s+.{0,12}court\s+fee|освобожден[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+от\s+(пошлин|судебн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+сбор)|не\s+могу\s+(за)?платить\s+(пошлин|судебн|сбор\s+в\s+суд)|exenci[oó]n\s+de\s+cuota\s+(de\s+corte|judicial)/i],
    reason: 'Court fee waiver language maps to Form FW-001.'
  },

  // ===== Restraining orders / unlawful detainer =====
  // Subtype-specific rules FIRST so the correct lead form is chosen; the
  // generic DV-100 rule below is the domestic / fallback case.
  {
    id: 'civil_harassment_ro',
    formCode: 'CH-100',
    service: 'restraining',
    packageForms: ['CH-100', 'CH-109', 'CH-110', 'CH-130'],
    confidence: 0.9,
    patterns: [/civil\s+harassment|harassment\s+(order|restraining).*(neighbor|stranger|co-?worker|roommate|landlord)|(neighbor|stranger|roommate)\s+.{0,20}(harass|threaten|stalk)|non-?domestic\s+harass|гражданск[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+преслед|сосед[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+.{0,15}(угрож|преслед|домога|пресліду)|(угрож|преслед|домога)[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+.{0,10}сосед|vecino\s+.{0,15}(amenaz|acos|hostig)|acoso\s+civil/i],
    reason: 'Civil (non-domestic) harassment → CH-100.'
  },
  {
    id: 'workplace_violence_ro',
    formCode: 'WV-100',
    service: 'restraining',
    packageForms: ['WV-100', 'WV-109', 'WV-110'],
    confidence: 0.9,
    patterns: [/workplace\s+violence|violence\s+(at|in)\s+(the\s+)?work(place)?|(co-?worker|colleague|employee|boss|supervisor)\s+.{0,25}(threat|violen|harass|assault|stalk)|(threat|violen|harass|assault)[\wa-z]*\s+.{0,15}(at\s+work|workplace|co-?worker|colleague)|employer\s+(seeking|filing).*(restraining|protective)|коллег[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(угрож|насил)|угрож[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+на\s+работе|насили[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+на\s+работе|violencia\s+(en\s+el\s+)?(trabajo|lugar\s+de\s+trabajo)|compañero\s+de\s+trabajo\s+.{0,20}(amenaz|acos)/i],
    reason: 'Workplace violence restraining order → WV-100.'
  },
  {
    id: 'elder_abuse_ro',
    formCode: 'EA-100',
    service: 'restraining',
    packageForms: ['EA-100', 'EA-109', 'EA-110'],
    confidence: 0.9,
    patterns: [/elder\s+(or\s+dependent\s+adult\s+)?abuse|abus(e|ed|ing|er)\s+.{0,20}(elder|elderly|senior|grandparent|grandmother|grandfather|aging\s+(parent|mother|father))|(elder|elderly|senior|grandparent|grandmother|grandfather|dependent\s+adult)\s+.{0,20}abus|abuse\s+of\s+(an?\s+)?(elder|elderly|senior|dependent)|насили[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+над\s+(пожил|престарел|літн)|обижа[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(пожил|престарел)|abuso\s+de\s+(ancian|adulto\s+mayor|persona\s+mayor)|(abuelo|abuela|anciano|adulto\s+mayor|persona\s+mayor)\s+.{0,25}(abus|maltrat)|(abus|maltrat)[\wa-zá-ú]*\s+.{0,15}(abuelo|abuela|anciano|adulto\s+mayor)/i],
    reason: 'Elder/dependent-adult abuse restraining order → EA-100.'
  },
  {
    id: 'gun_violence_ro',
    formCode: 'GV-100',
    service: 'restraining',
    packageForms: ['GV-100', 'GV-109', 'GV-110'],
    confidence: 0.9,
    patterns: [/gun\s+violence|firearm\s+(restraining|removal)|red\s+flag\s+(order|law)/i],
    reason: 'Gun violence restraining order → GV-100.'
  },
  {
    id: 'restraining_order',
    formCode: 'DV-100',
    service: 'restraining',
    packageForms: ['DV-100', 'CH-100', 'EA-100', 'GV-100', 'WV-100'],
    confidence: 0.9,
    patterns: [/restraining\s+order|protective\s+order|harass|stalk|domestic\s+(violence|abuse)|hits?\s+me|beat(s|en|ing)?\s+me|abus(e|ed|ing)\s+(me|by\s+my)|afraid\s+of\s+my\s+(husband|wife|partner|boyfriend|girlfriend|ex)|need\s+protection\s+from|рестре[ий]нинг|ристре[ий]нинг|защитн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+ордер|охоронн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+наказ|угрож|преслед[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+меня|бьёт|бьет|избива|побои|домашн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+насил|нужна\s+защит|боюсь\s+(муж|парт|сожит|бывш)|orden\s+(de\s+)?(restricci[oó]n|protecci[oó]n|alejamiento)|acoso|violencia\s+(dom[eé]stica|de\s+pareja|familiar)|me\s+(pega|golpea)/i],
    reason: 'Restraining-order / harassment language maps to the DV-100/CH-100 family.'
  },
  // Tenant / DEFENDANT side of an eviction — MUST fire BEFORE the broad
  // unlawful_detainer rule below (which defaults to the landlord's UD-100
  // complaint). A tenant who is "being evicted", was "served", or wants to
  // "respond/answer" needs UD-105 (the Answer), NOT the landlord's complaint.
  // Patterns require a clear defendant-side signal, so landlord phrasing
  // ("evict my tenant" / "выселить жильца") still falls through to UD-100.
  {
    id: 'unlawful_detainer_tenant',
    formCode: 'UD-105',
    service: 'ud',
    packageForms: ['UD-105', 'FW-001'],
    confidence: 0.9,
    patterns: [
      /\bbeing\s+evicted\b/i,
      /\bmy\s+landlord\b/i,
      /\b(respond|reply|answer|fight|contest|dispute|oppose)\b[\s\S]{0,40}\b(evict|unlawful\s+detainer|ud-?105|eviction)\b/i,
      /\b(served|summons)\b[\s\S]{0,25}\b(evict|unlawful\s+detainer|eviction)\b|\b(evict|unlawful\s+detainer|eviction)\b[\s\S]{0,25}\b(served|summons)\b/i,
      /\bud-?105\b/i,
      /(меня|мене|нас|нам|мне|мені)[\s\S]{0,25}(высел|висел)/i,
      /(мо[йя]|мій)\s+(арендодател|хозяин|лендлорд|орендодав|господар)/i,
      /(ответ\w*|відповіст\w*|оспор\w*|оскарж\w*)[\s\S]{0,30}(высел|висел|иск|позов)/i,
      /(получил\w*|пришл\w*|отримав\w*)[\s\S]{0,25}(повестк|повістк)[\s\S]{0,30}(высел|висел|оренд|аренд|квартир)/i,
      /me\s+est[aá]n?\s+desaloj|responder[\s\S]{0,30}desalojo|mi\s+(arrendador|casero|propietario)[\s\S]{0,25}desaloj|recib[ií][\s\S]{0,20}desalojo/i
    ],
    reason: 'Tenant/defendant side of an eviction (being evicted / served / responding) → UD-105 Answer, not the landlord complaint.'
  },
  {
    id: 'unlawful_detainer',
    formCode: 'UD-100',
    service: 'ud',
    packageForms: ['UD-100', 'UD-105', 'UD-110'],
    confidence: 0.92,
    patterns: [/unlawful\s+detainer|eviction|evicted|высел[\wа-яёіїєґА-ЯЁІЇЄҐ]*|эвикш|tenant|landlord|арендатор|арендодател|орендар|висел[\wа-яёіїєґА-ЯЁІЇЄҐ]*|выгон[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+из\s+квартир|desalojo|inquilino|propietario|3-?day\s+notice|30-?day\s+notice|notice\s+to\s+(quit|vacate|pay)/i],
    reason: 'Eviction / unlawful detainer language maps to UD-100 (landlord/plaintiff side).'
  },

  // ===== Small Claims / Civil =====
  {
    id: 'sc_subpoena',
    formCode: 'SC-107',
    service: 'civil',
    packageForms: ['SC-107'],
    confidence: 0.9,
    patterns: [/small claims subpoena|subpoena[\s\S]{0,30}(witness|small claims|hearing|trial)|(witness|свидетел|свідок|testigo)[\s\S]{0,40}(refus|won.?t come|не яв|не прид|повестк|subpoena)|вызвать свидетел|викликати свідк/i],
    reason: 'Compelling a witness/documents in small claims → SC-107 subpoena.'
  },
  {
    id: 'small_claims_plaintiff',
    formCode: 'SC-100',
    service: 'civil',
    packageForms: ['SC-100', 'SC-104'],
    confidence: 0.9,
    patterns: [
      /sc-?100|smol+\s*кле[ий]м|small\s+claims?|подать\s+в\s+(суд\s+по\s+)?мал[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+иск|мал(ый|ые|ого)?\s+иск|невозвращ[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(долг|деньг)|не\s+вернул\s+(долг|деньг)|депозит\s+не\s+вернул|reclamos?\s+menores?|deuda\s+(no\s+pagada|peque[ñn]a)/i,
      // "sue someone" / money owed → a money dispute = small claims (NOT an
      // immigration or family form). \bsue\b excludes "sued" (defendant) and "issue".
      /\bsue\b(?!\s+(me|us|by))|someone\s+owes\s+me|owes?\s+me\s+(money|\$|\d)|money\s+(owed|owes\s+to\s+me)|должен\s+мне\s+деньг|мне\s+должны\s+(деньг|\d)|взыскать\s+долг|винен\s+мені\s+грош|стягнути\s+борг|me\s+debe\s+(dinero|\$|\d)|reclamar\s+(una\s+)?deuda/i,
      // unpaid wages / employer didn't pay → small-claims money dispute
      /unpaid\s+wages?|wage\s+claim|didn'?t\s+pay\s+(me|my\s+(wages?|salary))|(employer|boss|company|client)\s+(didn'?t|won'?t|never|hasn'?t)\s+pa(y|id)|не\s+(за)?плат[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(зарплат|за\s+работ)|не\s+виплат[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(зарплат|за\s+робот)|позов\s+(на|до)\s+роботодав[\wа-яёіїєґА-ЯЁІЇЄҐ]*|salario\s+no\s+pagado|no\s+me\s+pag[oó]\s+(el\s+)?(salario|sueldo)/i
    ],
    reason: 'Small claims plaintiff language (sue / money owed / unpaid wages) maps to Form SC-100.'
  },
  {
    id: 'sc_defendant_claim',
    formCode: 'SC-120',
    service: 'civil',
    packageForms: ['SC-120'],
    confidence: 0.95,
    patterns: [/sc-?120|defendant'?s?\s+claim|countersuit\s+small\s+claims|встречн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+иск|контріск/i],
    reason: 'Small-claims defendant counterclaim maps to Form SC-120.'
  },
  {
    id: 'sc_proof_of_service',
    formCode: 'SC-104',
    service: 'civil',
    packageForms: ['SC-104'],
    confidence: 0.93,
    patterns: [/sc-?104|proof\s+of\s+service\s+small|small\s+claims\s+service|подтвержд[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+вруч[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+малы[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+иск|proof\s+of\s+service.*small/i],
    reason: 'Small-claims proof of service maps to Form SC-104.'
  },
  {
    id: 'demand_letter',
    formCode: 'DEMAND-LETTER',
    service: 'civil',
    packageForms: ['DEMAND-LETTER'],
    confidence: 0.92,
    patterns: [/demand\s+letter|pre-?suit\s+demand|претензи[\wа-яёіїєґА-ЯЁІЇЄҐ]*|досудебн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+претензи|досудов[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+претенз|carta\s+de\s+demanda|requerimiento\s+previo/i],
    reason: 'Pre-suit demand letter language maps to the demand-letter package.'
  },
  // ===== High-value scenarios that need routing even without a CA-court
  //       form code — translations, notary, FOIA, security deposit, breach
  //       of contract. These resolve to SC-100 (small claims) or a
  //       service-product code so the wizard still routes the visitor.
  {
    id: 'security_deposit',
    formCode: 'SC-100',
    service: 'civil',
    packageForms: ['SC-100', 'DEMAND-LETTER'],
    confidence: 0.92,
    patterns: [/security\s+deposit|landlord\s+(kept|didn'?t\s+return|wouldn'?t\s+return)\s+(my\s+)?deposit|deposit\s+(not\s+)?return|вернул\s+депозит|депозит\s+не\s+вернул|dep[oó]sito\s+(de\s+seguridad|no\s+devolvi)/i],
    reason: 'Unreturned security deposit maps to a demand letter + SC-100 if no response.'
  },
  {
    id: 'breach_of_contract',
    formCode: 'SC-100',
    service: 'civil',
    packageForms: ['SC-100', 'DEMAND-LETTER'],
    confidence: 0.88,
    patterns: [/breach\s+of\s+contract|broke\s+(the\s+)?contract|contractor\s+(took|stole|kept|won'?t\s+(finish|complete|return))|paid.*never\s+(finished|delivered|did\s+the\s+work)|нарушени[ея]\s+контракт|нарушени[ея]\s+договор|подрядчик\s+(не\s+(закончил|вернул|сделал))|incumplimiento\s+de\s+contrato/i],
    reason: 'Breach of contract / contractor dispute → demand letter then SC-100.'
  },
  {
    id: 'translation',
    formCode: 'TRANSLATION',
    service: 'translation',
    packageForms: ['TRANSLATION'],
    confidence: 0.94,
    patterns: [/(translat\w+|translation\s+(service|certified|notari[zs]ed))|certifi(ed|cate(d)?)\s+translat|translate\s+(my\s+)?(birth|marriage|divorce|diploma|degree|certificate|passport)|перевод\s+(документ|свидетельств|паспорт|диплом)|нотариальн\w*\s+перевод|переклад\s+(документ|свідоцт|паспорт)|traducci[oó]n\s+(certificada|jurada|de\s+documentos)/i],
    reason: 'Document translation → translation package.'
  },
  {
    id: 'notary',
    formCode: 'NOTARY',
    service: 'notary',
    packageForms: ['NOTARY'],
    confidence: 0.92,
    patterns: [/notar(y|ize|ization|ized)|need\s+(it\s+|to\s+be\s+)?notari[zs]ed|notary\s+(public|service)|нотариально\s+заверить|нотариальн\w*\s+(заверени|услуг)|у\s+нотариус|нотаріальн\w*|notar(io|izar|izaci[oó]n)/i],
    reason: 'Notary request → notary service package.'
  },
  {
    id: 'foia',
    formCode: 'G-639',
    service: 'immigration',
    packageForms: ['G-639'],
    confidence: 0.93,
    patterns: [/foia|g-?639|freedom\s+of\s+information|uscis\s+(file|records|a-?file|alien\s+file)|copy\s+of\s+(my\s+)?(uscis|immigration)\s+(file|records)|мой\s+иммиграционн\w*\s+файл|записи\s+(uscis|иммиграц)|solicitar\s+(mi\s+)?archivo\s+uscis|(request|get|copy of|запрос)[\s\S]{0,25}(my )?(immigration|uscis|иммиграцион)[\s\S]{0,15}(file|record|history|файл|дел[оа]|истори)/i],
    reason: 'FOIA / USCIS records request → Form G-639.'
  },
  {
    // Gender marker / sex identifier recognition → NC-300 series (before the
    // generic name-change rule so "gender marker" doesn't read as plain NC-100).
    id: 'gender_recognition',
    formCode: 'NC-300',
    service: 'civil',
    packageForms: ['NC-300', 'NC-125'],
    confidence: 0.92,
    patterns: [/gender (marker|identifier|recognition|change)|change (my )?gender|sex identifier|смен[аить]+ (пола|гендер)|гендерн|зміна статі|cambio de g[eé]nero|marcador de g[eé]nero/i],
    reason: 'Gender/sex-identifier recognition → NC-300 series (CA).'
  },
  {
    id: 'name_change_court',
    formCode: 'NC-100',
    service: 'civil',
    packageForms: ['NC-100', 'NC-110', 'NC-120', 'NC-130'],
    confidence: 0.93,
    patterns: [/name\s+chang|change\s+(my\s+)?(legal\s+)?name|change\s+(my\s+)?(child|kid|son|daughter|minor)('?s)?\s+name|change\s+the\s+name\s+of\s+my\s+(child|son|daughter|kid)|(nc-?100|nc-?110|nc-?120|nc-?130)|legally\s+change\s+name|сменить\s+имя|поменять\s+(имя|фамили)|изменить\s+(имя|фамили|имя\s+ребен)|змін[іиа][\wа-яёіїєґ'’]*\s+(ім|прізвищ)|зміна\s+(імен|прізвищ)|поміня[\wа-яёіїєґ'’]*\s+(ім|прізвищ)|cambio\s+de\s+nombre|cambiar\s+(mi\s+|el\s+)?nombre/i],
    reason: 'Legal name change → NC-100 series (CA).'
  },
  {
    id: 'name_change_after_marriage',
    formCode: 'FL-100',
    service: 'family',
    packageForms: ['FL-100'],
    confidence: 0.7,
    patterns: [/(got|after)\s+(married|marriage).*change\s+(my\s+)?(last\s+)?name|change\s+(my\s+)?(last\s+)?name\s+after\s+(marriage|wedding)|сменить\s+фамили\w*\s+после\s+(брак|свадьб)|cambiar\s+(mi\s+)?apellido\s+(despu[eé]s\s+del?\s+)?matrimonio/i],
    reason: 'Surname change after marriage usually happens through the marriage certificate; only flag here if explicit court order needed.'
  },
  {
    id: 'dmv',
    formCode: 'DMV',
    service: 'dmv',
    packageForms: ['DMV'],
    confidence: 0.93,
    patterns: [/dmv|driver(\'?s)?\s+licen[cs]e|lost\s+(my\s+)?licen[cs]e|car\s+title|vehicle\s+title|transfer\s+(the\s+)?title|smog\s+check|registration\s+(of\s+)?(car|vehicle)|водительск\w*\s+(удостоверени|прав)|потер\w*\s+прав|техосмотр|регистраци\w*\s+автомобил|licencia\s+de\s+conducir|registro\s+vehicular/i],
    reason: 'DMV-related (license / title) → CA DMV form packet.'
  },
  {
    id: 'passport',
    formCode: 'DS-11',
    service: 'passport',
    packageForms: ['DS-11', 'DS-82'],
    confidence: 0.94,
    patterns: [/passport|ds-?11|ds-?82|u\.?\s?s\.?\s+passport|renew\s+(my\s+)?passport|expired\s+passport|passport\s+for\s+(my\s+)?child|загранпаспорт|паспорт\s+сша|обновить\s+паспорт|renovar\s+(mi\s+)?pasaporte|pasaporte\s+(americano|de\s+ee)/i],
    reason: 'US Passport request → DS-11 (new) or DS-82 (renewal).'
  },
  {
    id: 'wage_garnishment',
    formCode: 'WG-001',
    service: 'civil',
    packageForms: ['WG-001'],
    confidence: 0.93,
    patterns: [/wg-?001|wage\s+garnish|garnish(ment)?\s+(of\s+)?wages?|удержан[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+зарплат|стяг[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+із\s+зарплат|embargo\s+(de\s+)?salario/i],
    reason: 'Wage garnishment language maps to Form WG-001.'
  },
  {
    id: 'abstract_of_judgment',
    formCode: 'EJ-001',
    service: 'civil',
    packageForms: ['EJ-001'],
    confidence: 0.93,
    patterns: [/ej-?001|abstract\s+of\s+judgment|judgment\s+lien|выписк[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+судебн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+решен|регистрац[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+судебн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+решен|gravamen\s+por\s+sentencia|abstracto\s+de\s+(juicio|sentencia)/i],
    reason: 'Abstract-of-judgment / judgment-lien language maps to Form EJ-001.'
  },
  {
    id: 'sc_installments',
    formCode: 'SC-140',
    service: 'civil',
    packageForms: ['SC-140'],
    confidence: 0.93,
    patterns: [/sc-?140|pay\s+in\s+installments|installment\s+(plan|payment)|оплат[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+в\s+рассрочк|расрочк[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+судебн|pago\s+a\s+plazos/i],
    reason: 'Installment-payment request maps to Form SC-140.'
  },

  // ===== Business filings (California) =====
  {
    id: 'form_llc',
    formCode: 'LLC-1',
    service: 'business',
    packageForms: ['LLC-1', 'LLC-12', 'OPERATING-AGREEMENT', 'SS-4'],
    confidence: 0.92,
    patterns: [/llc-?1\b|form\s+(an?\s+)?llc|start\s+(an?\s+)?(llc|business|company)|open\s+(an?\s+)?(llc|business|company)|create\s+(an?\s+)?(llc|business|company)|register\s+(an?\s+)?(llc|business|company)|article\s+of\s+organization|open\s+business|открыть\s+(ооо|бизнес|компани|llc|фирм)|зарегистрир[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(ооо|бизнес|компани|llc|фирм)|создат[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(ооо|компани|llc|фирм)|відкрит[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(бізнес|llc|тов|компані|фірм)|crear?\s+(llc|empresa|negocio|compa[ñn][ií]a)|abrir\s+(empresa|negocio|llc)/i],
    reason: 'Form-LLC / open-business language maps to Form LLC-1.'
  },
  {
    id: 'statement_of_information',
    formCode: 'LLC-12',
    service: 'business',
    packageForms: ['LLC-12'],
    confidence: 0.95,
    patterns: [/llc-?12|statement\s+of\s+information|biennial\s+statement|biennial\s+(filing|report)|информац[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+отчет\s+(llc|ооо)|двух?годичн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+отчет|informe\s+bienal|declaraci[oó]n\s+de\s+informaci[oó]n/i],
    reason: 'Biennial statement of information maps to Form LLC-12.'
  },
  {
    id: 'incorporation',
    formCode: 'ARTS-GS',
    service: 'business',
    packageForms: ['ARTS-GS', 'SI-550', 'SS-4'],
    confidence: 0.92,
    patterns: [/arts-?gs|articles?\s+of\s+incorporation|inc(orporate|orporation)|form\s+a\s+corporation|открыть\s+корпорац|зарегистр[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+корпорац|створит[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+корпорац|crear?\s+(corporaci[oó]n|inc)|abrir\s+corporaci[oó]n|si-?550/i],
    reason: 'Incorporation language maps to Form ARTS-GS.'
  },
  {
    id: 'dba_fbn',
    formCode: 'FBN',
    service: 'business',
    packageForms: ['FBN'],
    confidence: 0.93,
    patterns: [/\bdba\b|d\.b\.a\.|fbn|fictitious\s+business\s+name|doing\s+business\s+as|вымышлен[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(назван|им)\s+бизнес|вигадан[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+назв|nombre\s+(ficticio|comercial|de\s+negocio)|dba\s+registration/i],
    reason: 'Fictitious-business-name / DBA language maps to FBN packet.'
  },
  {
    id: 'ein',
    formCode: 'SS-4',
    service: 'business',
    packageForms: ['SS-4'],
    confidence: 0.95,
    patterns: [/\bein\b|ss-?4|employer\s+identification\s+number|tax\s+id\s+(for\s+)?business|идентификац[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+номер\s+работодател|ИНН\s+для\s+бизнес|n[uú]mero\s+de\s+identificaci[oó]n\s+(de\s+empleador|patronal)/i],
    reason: 'EIN / employer identification number maps to Form SS-4.'
  },
  {
    id: 'operating_agreement',
    formCode: 'OPERATING-AGREEMENT',
    service: 'business',
    packageForms: ['OPERATING-AGREEMENT'],
    confidence: 0.92,
    patterns: [/operating\s+agreement|llc\s+(operating\s+)?agreement|оперативн[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+соглашен|соглашение\s+llc|устав\s+llc|устав\s+ооо|acuerdo\s+operativo|acuerdo\s+de\s+operaci[oó]n/i],
    reason: 'LLC operating agreement language maps to the operating-agreement package.'
  },
  {
    id: 'foreign_llc',
    formCode: 'LLC-1A',
    service: 'business',
    packageForms: ['LLC-1A'],
    confidence: 0.93,
    patterns: [/llc-?1a|foreign\s+llc|register\s+(my\s+)?out-?of-?state\s+(llc|business)|зарегистр[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+(llc|компани)\s+из\s+друг[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+штат|llc\s+(из|от)\s+друг[\wа-яёіїєґА-ЯЁІЇЄҐ]*\s+штат|llc\s+(extranjera|de\s+otro\s+estado)/i],
    reason: 'Foreign / out-of-state LLC registration maps to Form LLC-1A.'
  },

  // ===== Probate =====
  {
    id: 'probate_closing',
    formCode: 'DE-295',
    service: 'probate',
    packageForms: ['DE-295', 'DE-160', 'DE-165'],
    confidence: 0.9,
    patterns: [/(de-?295|close\s+(probate|estate)|closing\s+(probate|estate)|probate\s+closing|final\s+(distribution|discharge|accounting|account|report)|discharge\s+(personal\s+representative|executor|administrator)|закрыть\s+probate|закрытие\s+(probate|наследств)|финальн\w*\s+(распредел|отчет)|final\s+distribution|закриття\s+probate|cerrar\s+probate|descargo\s+final|distribuci[oó]n\s+final)/i],
    reason: 'Probate closing / final discharge language maps to Form DE-295 packet.'
  },
  {
    id: 'probate_petition',
    formCode: 'DE-111',
    service: 'probate',
    packageForms: ['DE-111', 'DE-121'],
    confidence: 0.88,
    patterns: [/de-?111|de-?121|probate(\s+petition)?|estate\s+(administration|petition)|наследств|наследник|спадщин|спадкоємц|herencia|sucesi[oó]n|testamento\s+(probate|valid)/i],
    reason: 'Probate / estate administration language maps to Form DE-111.'
  }
];

// (Older 8-rule version replaced by the comprehensive multi-language
// ruleset above. Earlier rules now live inside PACKAGE_RULES in expanded
// form: restraining_order, unlawful_detainer, family_request_order,
// divorce — each with full RU / UK / ES vocabulary.)

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function detectLanguage(value) {
  const text = String(value || '');
  if (/[іїєґ]/i.test(text)) return 'uk';
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[¿¡áéíóúñ]/i.test(text)) return 'es';
  return 'en';
}

function allForms() {
  return Object.entries(catalogs).flatMap(([catalogKey, catalog]) => {
    return (catalog.forms || []).map((form) => ({
      catalogKey,
      form,
      code: normalizeCode(form.code),
      service: SERVICE_BY_CATALOG[catalogKey] || catalogKey,
      jurisdiction: JURISDICTION_BY_CATALOG[catalogKey] || 'Unknown'
    }));
  });
}

function formTitle(form, lang) {
  return form.names?.[lang] || form.names?.en || form.title || form.name || form.code;
}

function officialEndpointFor(catalogKey) {
  return catalogKey === 'immigration' ? '/api/uscis-form' : '/api/ca-form';
}

function flowEndpointFor(catalogKey) {
  return catalogKey === 'immigration' ? '/api/immigration-flow' : '';
}

// CR-180/CR-181 are the statewide criminal record-clearing forms we hand-map and
// can generate, so mark them schema-ready from public search — consistent with
// the local criminal forms (CR-9/CRM-319) that already return schema-ready via
// the relief path. Small-claims/family/UD intentionally stay catalog-only from
// public search (they generate via their own cabinet wizards), and the 345-form
// statewide catalog stays catalog-only (search/download, not fill).
const { normalizeSlug: normalizeCourtSlug } = require('./lib/ca-court-registry');
const CRIMINAL_GENERATABLE_SLUGS = new Set(['cr-180', 'cr-181']);

function routeFromForm(row, lang, confidence, reason, packageForms = []) {
  const generatable = row.catalogKey === 'immigration' || CRIMINAL_GENERATABLE_SLUGS.has(normalizeCourtSlug(row.code));
  return {
    service: row.service,
    catalog: row.catalogKey,
    jurisdiction: row.jurisdiction,
    formCode: row.code,
    formTitle: formTitle(row.form, lang),
    officialEndpoint: officialEndpointFor(row.catalogKey),
    flowEndpoint: row.catalogKey === 'immigration' ? '/api/immigration-flow' : (generatable ? '/api/court-flow' : ''),
    flowStatus: generatable ? 'schema-ready' : 'catalog-only',
    packageForms: packageForms.length ? packageForms : [row.code],
    confidence,
    reason
  };
}

function findByCode(code) {
  return allForms().find((row) => row.code === code);
}

// ---- Local (non-Judicial-Council) county form lookup ---------------------
// Public-search fallback: recognise a LOCAL county Superior Court form code
// (e.g. LASC-ADM-080, CVE-100, AC014) that has no statewide catalog entry.
// Loaded from the compact code index, normalised (strip non-alphanumerics) so
// "lasc adm 080" and "LASC-ADM-080" both resolve.
const LOCAL_CODE_INDEX = require('../../assets/form-cache/ca-local-court-code-index.json');
const CRIMINAL_RELIEF_INDEX = require('../../assets/form-cache/ca-criminal-relief-index.json');
const NORMALIZED_LOCAL_CODES = (() => {
  const map = new Map();
  for (const [code, entries] of Object.entries(LOCAL_CODE_INDEX.codes || {})) {
    const key = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (key.length >= 4) map.set(key, { code, entries });
  }
  return map;
})();

const LOCAL_COUNTIES = (() => {
  const counties = new Map();
  for (const entries of Object.values(LOCAL_CODE_INDEX.codes || {})) {
    for (const entry of entries || []) {
      if (!entry.county || !entry.countySlug) continue;
      counties.set(entry.countySlug, { name: entry.county, slug: entry.countySlug });
    }
  }
  return [...counties.values()].sort((a, b) => a.name.localeCompare(b.name));
})();
const LOCAL_COUNTY_BY_SLUG = new Map(LOCAL_COUNTIES.map((county) => [county.slug, county]));
const CRIMINAL_RELIEF_BY_COUNTY = new Map((CRIMINAL_RELIEF_INDEX.counties || []).map((county) => [county.slug, county]));
const COUNTY_ALIASES = new Map([
  ['la', 'los-angeles'],
  ['l-a', 'los-angeles'],
  ['sf', 'san-francisco'],
  ['s-f', 'san-francisco'],
  ['oc', 'orange'],
  ['o-c', 'orange']
]);

function normalizeCounty(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\bcounty\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveCounty(value) {
  const slug = normalizeCounty(value);
  if (!slug) return null;
  return LOCAL_COUNTY_BY_SLUG.get(slug) || LOCAL_COUNTY_BY_SLUG.get(COUNTY_ALIASES.get(slug)) || null;
}

// Russian / Ukrainian (Cyrillic) county-name aliases → slug. countyFromQuery's
// Latin matcher strips non-[a-z0-9], so a Cyrillic county name ("сакраменто")
// never matched and RU/UA queries fell to "awaiting-county". Curated common
// renderings for the counties this clientele files in; whole-token matched so
// short names ("напа","юба") don't false-positive. Spanish queries are written
// in Latin script and already resolve via the Latin matcher. Verified spellings
// only — rural counties with no common Cyrillic form are left to the Latin path.
const COUNTY_NL_ALIASES = [
  ['sacramento', ['сакраменто']],
  ['placer', ['плейсер', 'пласер']],
  ['los-angeles', ['лос анджелес', 'лос анжелес']],
  ['san-francisco', ['сан франциско', 'сан франсиско']],
  ['san-diego', ['сан диего', 'сан дієго']],
  ['orange', ['ориндж', 'орандж', 'оранж']],
  ['riverside', ['риверсайд']],
  ['san-bernardino', ['сан бернардино']],
  ['santa-clara', ['санта клара']],
  ['alameda', ['аламеда', 'аламида']],
  ['contra-costa', ['контра коста']],
  ['san-mateo', ['сан матео']],
  ['sonoma', ['сонома']],
  ['solano', ['солано']],
  ['fresno', ['фресно', 'фрезно']],
  ['kern', ['керн']],
  ['yolo', ['йоло']],
  ['san-joaquin', ['сан хоакин', 'сан жоакин']],
  ['stanislaus', ['станислаус']],
  ['ventura', ['вентура']],
  ['santa-barbara', ['санта барбара']],
  ['monterey', ['монтерей']],
  ['santa-cruz', ['санта круз']],
  ['marin', ['марин']],
  ['napa', ['напа']],
  ['el-dorado', ['эль дорадо', 'эльдорадо']],
  ['sutter', ['саттер']],
  ['yuba', ['юба']],
  ['butte', ['бьютт', 'бьют']],
  ['san-luis-obispo', ['сан луис обиспо']]
];

function countyBySlug(slug) {
  const fromLocal = LOCAL_COUNTY_BY_SLUG.get(slug);
  if (fromLocal) return fromLocal;
  const relief = CRIMINAL_RELIEF_BY_COUNTY.get(slug);
  return relief ? { name: relief.name, slug } : null;
}

function countyFromCyrillic(query) {
  const q = ` ${String(query || '').toLowerCase().replace(/[^а-яёіїєґa-z0-9]+/g, ' ').trim()} `;
  for (const [slug, aliases] of COUNTY_NL_ALIASES) {
    for (const al of aliases) {
      // Long, distinctive names (last word ≥6 chars) match left-bounded but
      // suffix-open so Russian/Ukrainian case endings resolve ("риверсайде",
      // "плейсере", "лос анджелесе"). Short names stay whole-token to avoid
      // false positives ("напе"≠"напа", "оранжевый"≠"оранж").
      const lastWord = al.slice(al.lastIndexOf(' ') + 1);
      const hit = lastWord.length >= 6 ? q.includes(` ${al}`) : q.includes(` ${al} `);
      if (hit) return countyBySlug(slug);
    }
  }
  return null;
}

function countyFromQuery(query) {
  const normalized = ` ${normalizeText(query).replace(/[^a-z0-9]+/g, ' ')} `;
  for (const county of [...LOCAL_COUNTIES].sort((a, b) => b.name.length - a.name.length)) {
    const name = county.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    if (normalized.includes(` ${name} county `) || normalized.includes(` ${name} `)) return county;
  }
  const aliasMatch = normalized.match(/\b(?:la|l a|sf|s f|oc|o c)\s+county\b/);
  if (aliasMatch) return resolveCounty(aliasMatch[0]);
  return countyFromCyrillic(query);
}

function findLocalByCode(originalQuery) {
  // Candidate tokens look like a form code: a letter-led run that contains at
  // least one digit, length >= 4 after normalising. Avoids matching words.
  const tokens = String(originalQuery || '').toUpperCase().match(/[A-Z][A-Z0-9-]{3,}/g) || [];
  for (const token of tokens) {
    const key = token.replace(/[^A-Z0-9]/g, '');
    if (key.length < 4 || !/[0-9]/.test(key)) continue;
    const hit = NORMALIZED_LOCAL_CODES.get(key);
    if (hit) return hit;
  }
  return null;
}

function routeFromLocalForm(hit, lang, requestedCounty) {
  const entries = hit.entries || [];
  const counties = [...new Set(entries.map((e) => e.county))];
  const county = resolveCounty(requestedCounty);
  const matching = county ? entries.filter((entry) => entry.countySlug === county.slug) : [];
  const preferred = (matching.length ? matching : entries).find((entry) => entry.role === 'prepare') || matching[0] || entries[0];
  const countyMismatch = Boolean(county && !matching.length);
  return {
    service: 'civil',
    catalog: 'ca-local-court',
    scope: 'local',
    county: county ? county.name : '',
    countySlug: county ? county.slug : '',
    counties,
    countyMismatch,
    needsCounty: !county || countyMismatch,
    jurisdiction: county ? `Superior Court of California, County of ${county.name}` : 'California Superior Court — county required',
    formCode: hit.code,
    formTitle: preferred.title,
    localFormId: countyMismatch || !county ? '' : preferred.id,
    officialEndpoint: '',
    flowEndpoint: '/api/court-flow',
    flowStatus: countyMismatch ? 'county-mismatch' : (!county ? 'awaiting-county' : (preferred.role === 'prepare' ? 'schema-ready' : 'reference-only')),
    packageForms: [hit.code],
    confidence: 0.95,
    reason: countyMismatch
      ? `${hit.code} is not listed by ${county.name} County. It is listed by: ${counties.join(', ')}.`
      : (county
        ? `Local ${county.name} County Superior Court form.`
        : `A filing county is required before selecting the local ${hit.code} form.`)
  };
}

const PROBATE_WORD = /\bprobate\b|пробейт|пробат/i;
const ESTATE_CONTEXT = /estate|decedent|inherit|inheritance|heir|will\b|testament|someone\s+(died|passed away)|death|final\s+(distribution|discharge)|executor|administrator\s+of\s+estate|наслед|наследств|завещан|умер|помер|спадщин|заповіт|herencia|sucesi[oó]n|testamento/i;
const GUARDIANSHIP_CONTEXT = /guardianship|conservatorship|guardian\s+of|conservator\s+of|опек\w*\s+над|попечительств|опіка\s+над|tutela|curadur[ií]a|conservadur[ií]a/i;
const INTENT_OPTIONS = {
  en: [
    { id: 'estate', label: 'Estate after someone died', description: 'Opening, administering, or closing a decedent estate.' },
    { id: 'guardianship', label: 'Guardianship or conservatorship', description: 'A minor, an adult, or management of their estate.' },
    { id: 'probation-motion', label: 'Criminal probation or DUI motion', description: 'Modify or terminate probation, jail credits, program referral, or another post-sentence request.' },
    { id: 'record-cleanup', label: 'Dismissal or record cleanup', description: 'Expungement, petition for dismissal, or related post-conviction relief.' }
  ],
  ru: [
    { id: 'estate', label: 'Наследственное дело после смерти', description: 'Открытие, ведение или закрытие estate.' },
    { id: 'guardianship', label: 'Guardianship или conservatorship', description: 'Опека над несовершеннолетним или взрослым.' },
    { id: 'probation-motion', label: 'Criminal probation или DUI motion', description: 'Изменить или досрочно прекратить probation, jail credits или другая просьба после приговора.' },
    { id: 'record-cleanup', label: 'Dismissal или очистка записи', description: 'Expungement, petition for dismissal и другое post-conviction relief.' }
  ],
  uk: [
    { id: 'estate', label: 'Спадкова справа після смерті', description: 'Відкриття, ведення або закриття estate.' },
    { id: 'guardianship', label: 'Guardianship або conservatorship', description: 'Опіка над неповнолітнім або дорослим.' },
    { id: 'probation-motion', label: 'Criminal probation або DUI motion', description: 'Змінити чи достроково припинити probation або інше прохання після вироку.' },
    { id: 'record-cleanup', label: 'Dismissal або очищення запису', description: 'Expungement, petition for dismissal та інше post-conviction relief.' }
  ],
  es: [
    { id: 'estate', label: 'Patrimonio después de un fallecimiento', description: 'Abrir, administrar o cerrar una sucesión.' },
    { id: 'guardianship', label: 'Tutela o curatela', description: 'Tutela de un menor, adulto o su patrimonio.' },
    { id: 'probation-motion', label: 'Probation penal o moción por DUI', description: 'Modificar o terminar probation u otra solicitud posterior a la sentencia.' },
    { id: 'record-cleanup', label: 'Dismissal o limpieza de antecedentes', description: 'Expungement, petition for dismissal u otro alivio posterior a la condena.' }
  ]
};

function intentPrompt(originalQuery, lang) {
  return {
    ok: true,
    query: originalQuery,
    language: lang,
    needsIntent: true,
    intentType: 'probate-or-probation',
    intentOptions: INTENT_OPTIONS[lang] || INTENT_OPTIONS.en,
    route: {
      service: '', catalog: '', jurisdiction: '', formCode: '', formTitle: '',
      officialEndpoint: '', flowEndpoint: '', flowStatus: 'awaiting-intent',
      packageForms: [], confidence: 0, reason: '“Probate” may mean an estate matter or may be shorthand/mistyping for criminal probation. The user must choose the matter type first.'
    }
  };
}

function routeCriminalRelief(originalQuery, lang, reliefType, requestedCounty) {
  const county = resolveCounty(requestedCounty) || countyFromQuery(originalQuery);
  if (!county) {
    return {
      ok: true, query: originalQuery, language: lang, needsCounty: true,
      county: null, counties: LOCAL_COUNTIES,
      route: {
        service: 'criminal', catalog: 'ca-criminal-relief', jurisdiction: 'California Superior Court — county required',
        county: '', countySlug: '', needsCounty: true, reliefType, formCode: '', formTitle: '', localFormId: '',
        officialEndpoint: '', flowEndpoint: '/api/court-flow', flowStatus: 'awaiting-county', packageForms: [], confidence: 0.9,
        reason: 'Criminal post-judgment and probation forms vary by county.'
      }
    };
  }

  const countyEntry = CRIMINAL_RELIEF_BY_COUNTY.get(county.slug) || { forms: [] };
  const matches = (countyEntry.forms || []).filter((form) => form.reliefType === reliefType);
  const preferred = matches.find((form) => form.role === 'prepare') || matches[0] || null;
  if (preferred) {
    return {
      ok: true, query: originalQuery, language: lang, needsCounty: false, county, counties: LOCAL_COUNTIES,
      localForms: matches,
      route: {
        service: 'criminal', catalog: 'ca-local-court', scope: 'local', county: county.name, countySlug: county.slug,
        jurisdiction: `Superior Court of California, County of ${county.name}`, reliefType,
        formCode: preferred.code, formTitle: preferred.title, localFormId: preferred.id,
        officialEndpoint: '', flowEndpoint: '/api/court-flow',
        flowStatus: preferred.role === 'prepare' ? 'schema-ready' : 'reference-only',
        packageForms: matches.map((form) => form.code), confidence: 0.94,
        reason: `Local ${county.name} County criminal ${reliefType} form.`
      }
    };
  }

  // No county-specific form indexed → for the record-clearing services we
  // actually offer (expungement/dismissal, early termination of probation,
  // felony reduction / Prop 64 resentencing), fall back to the statewide
  // CR-180 / CR-181 intake so they never dead-end on a scary "no form listed"
  // message. Other relief (e.g. warrant recall) we don't prepare — keep the
  // honest no-local-form result.
  const RECORD_CLEARING_RELIEF = new Set(['record-cleanup', 'probation-motion', 'resentencing']);
  if (RECORD_CLEARING_RELIEF.has(reliefType)) {
    const row = findByCode('CR-180');
    const reasonTxt = reliefType === 'record-cleanup'
      ? `No matching local record-cleanup form was indexed for ${county.name}; showing the statewide CR-180 option.`
      : `No county-specific ${reliefType} form is indexed for ${county.name}; we prepare this as a statewide record-clearing petition at your direction.`;
    return finalizeCountyRoute({
      ok: true, query: originalQuery, language: lang,
      route: routeFromForm(row, lang, reliefType === 'record-cleanup' ? 0.82 : 0.78, reasonTxt, ['CR-180', 'CR-181'])
    }, originalQuery, county.slug);
  }

  return {
    ok: true, query: originalQuery, language: lang, needsCounty: false, county, counties: LOCAL_COUNTIES,
    localForms: [],
    route: {
      service: 'criminal', catalog: 'ca-criminal-relief', county: county.name, countySlug: county.slug,
      jurisdiction: `Superior Court of California, County of ${county.name}`, reliefType,
      formCode: '', formTitle: '', localFormId: '', officialEndpoint: '', flowEndpoint: '',
      flowStatus: 'county-known-no-local-form', packageForms: [], confidence: 0.65,
      reason: `No matching local ${reliefType} form is published in the current ${county.name} County catalog. Continue intake without selecting a form.`
    }
  };
}

const CALIFORNIA_COURT_SERVICES = new Set(['family', 'civil', 'ud', 'restraining', 'probate', 'criminal']);
const CALIFORNIA_COURT_QUERY = /\b(?:california|court|small claims?|divorc|custody|support|probate|probation|criminal|dui|estate|evict|unlawful detainer|restraining|expung|dismissal|record clean|суд|иск|развод|опек|алим|наслед|выселен|ордер|судимост|пробаци|позов|розлуч|спадщин|виселен|tribunal|reclamos menores|divorcio|custodia|desalojo|sucesi[oó]n)\b/i;

function requiresCaliforniaCourtCounty(route) {
  return Boolean(route && (route.catalog === 'ca-local-court' || CALIFORNIA_COURT_SERVICES.has(route.service)));
}

function finalizeCountyRoute(result, originalQuery, requestedCounty) {
  if (!result || !result.ok || !result.route) return result;
  if (!requiresCaliforniaCourtCounty(result.route)) return { ...result, needsCounty: false };

  if (result.route.catalog === 'ca-local-court') {
    const county = resolveCounty(requestedCounty) || countyFromQuery(originalQuery);
    const hit = findLocalByCode(originalQuery);
    const route = hit ? routeFromLocalForm(hit, result.language, county && county.slug) : result.route;
    return {
      ...result,
      needsCounty: Boolean(route.needsCounty),
      county: county || null,
      counties: LOCAL_COUNTIES,
      availableCounties: route.counties || [],
      countyMismatch: Boolean(route.countyMismatch),
      route
    };
  }

  const county = resolveCounty(requestedCounty) || countyFromQuery(originalQuery);
  if (!county) {
    return {
      ...result,
      needsCounty: true,
      county: null,
      counties: LOCAL_COUNTIES,
      route: { ...result.route, needsCounty: true }
    };
  }

  return {
    ...result,
    needsCounty: false,
    county,
    counties: LOCAL_COUNTIES,
    route: {
      ...result.route,
      needsCounty: false,
      county: county.name,
      countySlug: county.slug,
      jurisdiction: `Superior Court of California, County of ${county.name}`
    }
  };
}

// Build a route object for a rule whose formCode is intentionally NOT in
// any catalog JSON — business filings (LLC-1, FBN, EIN, …), EOIR motions
// and landing-page targets (DEMAND-LETTER, OPERATING-AGREEMENT). Keeps
// the wizard response shape stable.
const SERVICE_JURISDICTION_FALLBACK = {
  business: 'California Secretary of State / IRS / County',
  immigration: 'USCIS / EOIR',
  family: 'California Superior Court',
  civil: 'California Superior Court',
  ud: 'California Superior Court',
  restraining: 'California Superior Court',
  probate: 'California Superior Court'
};
function synthesizeRouteFromRule(rule, lang) {
  const code = String(rule.formCode || '').toUpperCase();
  return {
    service: rule.service || '',
    catalog: '',
    jurisdiction: SERVICE_JURISDICTION_FALLBACK[rule.service] || 'Unknown',
    formCode: code,
    formTitle: code, // The UI shows the code; landing-page link carries the human label
    officialEndpoint: '',
    flowEndpoint: '',
    flowStatus: 'package-only',
    packageForms: rule.packageForms || [code],
    confidence: rule.confidence,
    reason: rule.reason
  };
}

function scoreCatalogMatch(row, query, lang) {
  const form = row.form;
  const haystack = [
    row.code,
    formTitle(form, lang),
    formTitle(form, 'en'),
    form.description,
    form.subcategory,
    ...(form.keywords || [])
  ].map(normalizeText).join(' ');

  let score = 0;
  const normalizedCode = normalizeText(row.code);
  if (query.includes(normalizedCode)) score += 100;

  const tokens = query.split(/[^a-z0-9а-яёіїєґñáéíóúü-]+/i).filter((token) => token.length >= 3);
  for (const token of tokens) {
    if (haystack.includes(token)) score += token.length > 5 ? 8 : 4;
  }

  for (const keyword of form.keywords || []) {
    const key = normalizeText(keyword);
    if (key && query.includes(key)) score += 34;
  }

  return score;
}

function routeQuery(queryValue, options = {}) {
  const originalQuery = String(queryValue || '').trim();
  const query = normalizeText(originalQuery);
  const lang = detectLanguage(originalQuery);
  const forms = allForms();

  const codeMatch = originalQuery.match(/\b(?:AR|I|N|G|EOIR|FL|DV|CH|EA|GV|WV|SC|UD|FW|POS|CIV|CM|SUM|PLD|DE|GC|CR|NC|EJ|WG|JV|APP|MC|ADM|MIL)-[A-Z0-9]+(?:\s+Supplement(?:\s+[A-Z])?)?(?:\([A-Z0-9]+\))?\b/i);
  if (codeMatch) {
    const row = findByCode(normalizeCode(codeMatch[0]));
    if (row) {
      return finalizeCountyRoute({
        ok: true,
        query: originalQuery,
        language: lang,
        route: routeFromForm(row, lang, 0.99, 'Direct form code match.')
      }, originalQuery, options.county);
    }
  }

  // An explicit county-local code must beat generic keyword scoring. Without
  // this priority, words such as "request copies" can incorrectly route a
  // local LASC form to an unrelated USCIS records form.
  const explicitLocalHit = findLocalByCode(originalQuery);
  if (explicitLocalHit) {
    const county = resolveCounty(options.county) || countyFromQuery(originalQuery);
    return finalizeCountyRoute({
      ok: true,
      query: originalQuery,
      language: lang,
      route: routeFromLocalForm(explicitLocalHit, lang, county && county.slug)
    }, originalQuery, options.county);
  }

  // “Probate” is frequently used by clients when they mean “probation,”
  // especially after a DUI. Never guess between a decedent estate and a
  // criminal post-judgment matter. Explicit context can route directly;
  // otherwise the public finder must ask what the client means first.
  if (options.intent === 'estate') {
    return routeQuery(`${originalQuery} estate after death petition for probate`, { ...options, intent: '' });
  }
  if (options.intent === 'guardianship') {
    return routeQuery(`${originalQuery} guardianship conservatorship`, { ...options, intent: '' });
  }
  if (['probation-motion', 'record-cleanup', 'resentencing', 'warrant'].includes(options.intent)) {
    return routeCriminalRelief(originalQuery, lang, options.intent, options.county);
  }
  if (PROBATE_WORD.test(originalQuery) && !ESTATE_CONTEXT.test(originalQuery) && !GUARDIANSHIP_CONTEXT.test(originalQuery)) {
    return intentPrompt(originalQuery, lang);
  }

  const explicitProbationMotion = /(?:modify|modification|terminate|termination|end|shorten|reduce|early)[\s\S]{0,35}probation|probation[\s\S]{0,35}(?:modify|modification|terminate|termination|end|shorten|reduce|early)|dui[\s\S]{0,35}probation|пробаци|пробаці|испытательн[\wа-яё]*\s+срок|умовн[\wа-яії]*\s+(?:строк|термін)|досрочн[\wа-яё]*\s+прекращ|дострокове\s+припинен|libertad\s+condicional/i.test(originalQuery);
  if (explicitProbationMotion) {
    return routeCriminalRelief(originalQuery, lang, 'probation-motion', options.county);
  }

  const explicitRecordCleanup = /expung|record\s+(?:clean|clear)|clean\s+(?:my\s+)?record|petition\s+for\s+dismissal|dismiss\w*\s+(?:a\s+)?conviction|1203\.4|set\s+aside\s+(?:a\s+)?conviction|снят\w*\s+судимост|очист\w*\s+(?:запис|судимост)/i.test(originalQuery);
  if (explicitRecordCleanup) {
    return routeCriminalRelief(originalQuery, lang, 'record-cleanup', options.county);
  }

  const explicitResentencing = /resentenc|reclassif|redesignat|reduce\w*\s+(?:a\s+)?felony\s+to\s+(?:a\s+)?misdemeanor|prop(?:osition)?\s*47|1170\.18|cannabis\s+conviction/i.test(originalQuery);
  if (explicitResentencing) {
    return routeCriminalRelief(originalQuery, lang, 'resentencing', options.county);
  }

  const explicitWarrantRelief = /(?:recall|quash|clear|surrender)[\s\S]{0,25}(?:bench\s+)?warrant|(?:bench\s+)?warrant[\s\S]{0,25}(?:recall|quash|clear|surrender)/i.test(originalQuery);
  if (explicitWarrantRelief) {
    return routeCriminalRelief(originalQuery, lang, 'warrant', options.county);
  }

  // Criminal post-judgment context WITHOUT an explicit verb still belongs in
  // the criminal-relief flow — never the generic keyword scorer (which was
  // returning CR-100 "Fingerprint Form" for "criminal probation" and the
  // small-claims SC-135 for "criminal defendant's motion"). These are exactly
  // the wrong-form-to-court misroutes. A criminal defendant's motion is the
  // Placer PL-CR003 target; route the whole family through criminal-relief.
  const criminalReliefSignal =
    /\bcriminal\b[\s\S]{0,30}\b(?:probation|defendant'?s?\s+motion|post[- ]?(?:judgment|sentence)|dui)\b/i.test(originalQuery)
    || /\bdefendant'?s?\s+motion\b[\s\S]{0,25}\b(?:placer|county|criminal|probation)\b/i.test(originalQuery)
    || /\bprobation\b[\s\S]{0,25}\b(?:motion|petition|hearing|county|placer|jail\s+credit|program)\b/i.test(originalQuery)
    || /\b(?:placer|county)\b[\s\S]{0,25}\bprobation\b/i.test(originalQuery);
  if (criminalReliefSignal) {
    return routeCriminalRelief(originalQuery, lang, 'probation-motion', options.county);
  }

  for (const rule of PACKAGE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(originalQuery) || pattern.test(query))) {
      const row = findByCode(rule.formCode);
      if (row) {
        return finalizeCountyRoute({
          ok: true,
          query: originalQuery,
          language: lang,
          route: routeFromForm(row, lang, rule.confidence, rule.reason, rule.packageForms),
          packageRule: rule.id
        }, originalQuery, options.county);
      }
      // Catalog miss — synthesize a route from the rule itself so business
      // filings (LLC-1, FBN, EIN), EOIR motions and landing-page targets
      // (demand-letter, operating-agreement) don't silently fall through
      // to a low-confidence catalog match.
      return finalizeCountyRoute({
        ok: true,
        query: originalQuery,
        language: lang,
        route: synthesizeRouteFromRule(rule, lang),
        packageRule: rule.id
      }, originalQuery, options.county);
    }
  }

  const scored = forms
    .map((row) => ({ row, score: scoreCatalogMatch(row, query, lang) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored[0]) {
    const confidence = Math.min(0.88, Math.max(0.45, scored[0].score / 120));
    return finalizeCountyRoute({
      ok: true,
      query: originalQuery,
      language: lang,
      route: routeFromForm(scored[0].row, lang, Number(confidence.toFixed(2)), 'Best catalog keyword match.'),
      alternatives: scored.slice(1, 4).map((item) => routeFromForm(item.row, lang, Number(Math.min(0.7, item.score / 140).toFixed(2)), 'Alternative catalog match.'))
    }, originalQuery, options.county);
  }

  // Fallback: an explicit LOCAL county form code that no statewide rule or
  // catalog matched. Fires only here, so statewide/USCIS routing is untouched.
  const localHit = findLocalByCode(originalQuery);
  if (localHit) {
    const county = resolveCounty(options.county) || countyFromQuery(originalQuery);
    return finalizeCountyRoute({
      ok: true,
      query: originalQuery,
      language: lang,
      route: routeFromLocalForm(localHit, lang, county && county.slug)
    }, originalQuery, options.county);
  }

  if (CALIFORNIA_COURT_QUERY.test(originalQuery)) {
    const county = resolveCounty(options.county) || countyFromQuery(originalQuery);
    return {
      ok: true,
      query: originalQuery,
      language: lang,
      needsCounty: !county,
      county: county || null,
      counties: LOCAL_COUNTIES,
      route: {
        service: 'civil',
        catalog: '',
        jurisdiction: county ? `Superior Court of California, County of ${county.name}` : 'California Superior Court — county required',
        county: county ? county.name : '',
        countySlug: county ? county.slug : '',
        needsCounty: !county,
        formCode: '',
        formTitle: '',
        officialEndpoint: '',
        flowEndpoint: '',
        flowStatus: county ? 'county-known' : 'awaiting-county',
        packageForms: [],
        confidence: 0,
        reason: county ? 'County captured for a California court-form search.' : 'County is required to check local Superior Court forms.'
      }
    };
  }

  return {
    ok: false,
    query: originalQuery,
    language: lang,
    error: 'No confident route found',
    route: {
      service: '',
      catalog: '',
      jurisdiction: '',
      formCode: '',
      formTitle: '',
      officialEndpoint: '',
      flowEndpoint: '',
      flowStatus: 'unknown',
      packageForms: [],
      confidence: 0,
      reason: 'The router did not find a reliable catalog or package match.'
    }
  };
}

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok: false, error: 'Method not allowed' });

  let query = event.queryStringParameters?.q || event.queryStringParameters?.query || '';
  let county = event.queryStringParameters?.county || '';
  let intent = event.queryStringParameters?.intent || '';
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      query = body.q || body.query || body.text || query;
      county = body.county || county;
      intent = body.intent || intent;
    } catch {
      return json(400, { ok: false, error: 'Invalid JSON' });
    }
  }

  if (!String(query || '').trim()) return json(400, { ok: false, error: 'Missing query' });

  const result = routeQuery(query, { county, intent });
  return json(result.ok ? 200 : 404, result, { 'Cache-Control': 'public, max-age=300' });
}

module.exports = {
  handler,
  routeQuery,
  normalizeCode,
  detectLanguage
};
