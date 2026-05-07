const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT = `You are the AI assistant for Imverica Legal Solutions, a registered Legal Document Assistant (LDA) in Sacramento, California. Respond in the user's language (English, Russian, Ukrainian, or Spanish).

WHO WE ARE: Imverica Legal Solutions — California Licensed LDA. Phone: (916) 399-3992. Telegram: t.me/imverica. We prepare documents — we do NOT give legal advice.

WHAT WE PREPARE: Any California state documents (DMV forms, contractor licensing, business filings, professional licenses, etc.), any USCIS immigration forms, any EOIR immigration court documents, family law forms, small claims, civil court, unlawful detainer, translations, notary.

CRITICAL — UPL COMPLIANCE: Never give legal advice. Never recommend which form to file. Never say whether someone qualifies. Never predict outcomes. Never explain legal strategy. If asked for advice, say: "We prepare documents at your direction — for legal advice, you'll need an attorney." We are not a law firm and do not provide legal advice.

STYLE: Max 3 short sentences. No markdown, no asterisks, no bold, no bullets. Plain text only. Use | instead of /. Match user's language exactly.`;


function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9а-яіїєґ\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COMMUNITY_TERM_ALIASES = [
  { pattern: /смол+\s+кле[ий]м\w*/i, expansion: 'small claims small claim SC-100 SC-104 SC-120' },
  { pattern: /мал\w*\s+иск\w*/i, expansion: 'small claims small claim SC-100 SC-104 SC-120' },
  { pattern: /ворк\s+п[еэ]рмит\w*/i, expansion: 'work permit employment authorization EAD I-765' },
  { pattern: /разрешен[а-яіїєґёa-z0-9-]*\s+на\s+работ[а-яіїєґёa-z0-9-]*/i, expansion: 'work permit employment authorization EAD I-765' },
  { pattern: /грин\s+карт[а-яіїєґёa-z0-9-]*/i, expansion: 'green card permanent resident card I-90 I-485' },
  { pattern: /грин\s+кард[а-яіїєґёa-z0-9-]*/i, expansion: 'green card permanent resident card I-90 I-485' },
  { pattern: /аджаст[а-яіїєґёa-z0-9-]*\s+(статус[а-яіїєґёa-z0-9-]*|оф\s+статус)/i, expansion: 'adjustment of status adjust status I-485 I-130 I-864 I-765 I-131' },
  { pattern: /[эе]джаст[а-яіїєґёa-z0-9-]*\s+(статус[а-яіїєґёa-z0-9-]*|оф\s+статус)/i, expansion: 'adjustment of status adjust status I-485 I-130 I-864 I-765 I-131' },
  { pattern: /ф[иі]\s*в[еэ]йв[еэ]р[а-яіїєґёa-z0-9-]*/i, expansion: 'fee waiver filing fee waiver FW-001 FW-003' },
  { pattern: /ф[иі]\s*вайв[еэ]р[а-яіїєґёa-z0-9-]*/i, expansion: 'fee waiver filing fee waiver FW-001 FW-003' },
  { pattern: /освобожд[а-яіїєґёa-z0-9-]*\s+от\s+пошлин[а-яіїєґёa-z0-9-]*/i, expansion: 'fee waiver filing fee waiver FW-001 FW-003' },
  { pattern: /uscis\s+ф[иі]\s*в[еэ]йв[еэ]р[а-яіїєґёa-z0-9-]*/i, expansion: 'USCIS fee waiver I-912' },
  { pattern: /иммиграц[а-яіїєґёa-z0-9-]*\s+ф[иі]\s*в[еэ]йв[еэ]р[а-яіїєґёa-z0-9-]*/i, expansion: 'immigration fee waiver I-912' },
  { pattern: /рестре[ий]нинг\s+орд[еэ]р\w*/i, expansion: 'restraining order civil harassment CH-100 CH-110' },
  { pattern: /ристре[ий]нинг\s+орд[еэ]р\w*/i, expansion: 'restraining order civil harassment CH-100 CH-110' },
  { pattern: /защитн\w*\s+ордер\w*/i, expansion: 'restraining order protective order CH-100 DV-100 EA-100 GV-100 WV-100' },
  { pattern: /[эе]викш\w*/i, expansion: 'eviction unlawful detainer tenant landlord UD-100 UD-105 UD-110' },
  { pattern: /анлофул\s+дет[еэ]йн\w*/i, expansion: 'unlawful detainer eviction UD-100 UD-105 UD-110' },
  { pattern: /выселен\w*/i, expansion: 'eviction unlawful detainer tenant landlord UD-100 UD-105 UD-110' },
  { pattern: /диворс\w*/i, expansion: 'divorce dissolution FL-100 FL-110 FL-120 FL-180' },
  { pattern: /кастоди\w*/i, expansion: 'child custody visitation parenting time FL-300 FL-311 FL-341' },
  { pattern: /костоди\w*/i, expansion: 'child custody visitation parenting time FL-300 FL-311 FL-341' },
  { pattern: /саппорт\w*/i, expansion: 'child support spousal support FL-150 FL-342 FL-343' },
  { pattern: /тревел\s+документ\w*/i, expansion: 'travel document advance parole reentry permit I-131' },
  { pattern: /адванс\s+парол\w*/i, expansion: 'advance parole travel document I-131' },
  { pattern: /ситизеншип\w*/i, expansion: 'citizenship naturalization N-400 N-600' },
  { pattern: /натурал[иі]зац\w*/i, expansion: 'citizenship naturalization N-400' },
  { pattern: /[аэе]сайл\w*/i, expansion: 'asylum I-589 I-765' },
  { pattern: /убежищ\w*/i, expansion: 'asylum I-589 I-765' },
  { pattern: /т[иі]\s*п[иі]\s*[эе]с/i, expansion: 'TPS temporary protected status I-821 I-765' },
  { pattern: /дака/i, expansion: 'DACA deferred action childhood arrivals I-821D I-765' },
  { pattern: /ю\s*виз\w*/i, expansion: 'U visa I-918 I-765' },
  { pattern: /вава/i, expansion: 'VAWA I-360 I-485 I-765' },
  { pattern: /пруф\s+оф\s+с[еэ]рвис\w*/i, expansion: 'proof of service service papers POS-010 POS-020 SC-104' },
  { pattern: /сам+онс\w*/i, expansion: 'summons SUM-100 SUM-110 SC-100' },
  { pattern: /компле[ий]нт\w*/i, expansion: 'complaint civil complaint small claims SC-100 PLD-C-001 PLD-PI-001' },
  { pattern: /компла[ий]нт\w*/i, expansion: 'complaint civil complaint small claims SC-100 PLD-C-001 PLD-PI-001' },
  { pattern: /пробе[ий]т\w*/i, expansion: 'probate estate deceased DE-111 DE-120 DE-150' },
  { pattern: /консерваторшип\w*/i, expansion: 'conservatorship GC-310 GC-312 GC-340' },
  { pattern: /гардианшип\w*/i, expansion: 'guardianship minor child guardian GC-210 GC-211 GC-240' }
];

function expandCommunityTerms(value) {
  const text = String(value || '');
  const expansions = [];
  for (const alias of COMMUNITY_TERM_ALIASES) {
    if (alias.pattern.test(text)) expansions.push(alias.expansion);
  }
  return expansions.length ? `${text} ${expansions.join(' ')}` : text;
}

function loadFormsCatalog() {
  const formsDir = path.join(__dirname, 'forms');
  const index = [];

  try {
    const catalog = fs.readdirSync(formsDir)
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => {
        const data = JSON.parse(fs.readFileSync(path.join(formsDir, file), 'utf8'));
        const forms = Array.isArray(data.forms) ? data.forms : Array.isArray(data) ? data : [];
        const pane = data.subcategory_pane || path.basename(file, '.json');
        const category = data.category || '';

        const rows = forms.map((form) => {
          const names = form.names || {};
          const keywordsArray = Array.isArray(form.keywords) ? form.keywords : [];
          const localizedNames = ['en', 'ru', 'uk', 'es']
            .filter((lang) => names[lang])
            .map((lang) => `${lang}: ${names[lang]}`)
            .join('; ');
          const keywords = keywordsArray.join(', ');
          const englishName = names.en || Object.values(names)[0] || '';

          index.push({
            code: form.code || '',
            name: englishName,
            subcategory: form.subcategory || pane,
            category,
            pane,
            description: form.description || '',
            keywords: keywordsArray,
            searchText: normalizeText([
              form.code,
              form.subcategory,
              category,
              pane,
              form.description,
              ...Object.values(names),
              ...keywordsArray
            ].join(' '))
          });

          return `${form.code} | ${form.subcategory || pane} | ${localizedNames} | keywords: ${keywords} | ${form.description || ''}`;
        }).join('\n');

        return `PANE: ${pane} | CATEGORY: ${category}\n${rows}`;
      })
      .join('\n\n');

    return { catalog, index };
  } catch (err) {
    console.error('Failed to load forms catalog:', err);
    return { catalog: '', index };
  }
}

const { catalog: FORMS_CATALOG, index: FORMS_INDEX } = loadFormsCatalog();

const SYSTEM_WITH_FORMS = `${SYSTEM_PROMPT}

FORM ROUTING CATALOG:
Use this catalog to identify likely document-preparation categories and possible form codes by user facts, language, keywords, and form names. Covers immigration/USCIS, civil, family law, small claims, unlawful detainer, restraining orders, probate, fee waiver, interpreter, accessibility, and proof of service forms. Strict routing format: if LIKELY CATALOG MATCHES is provided, the first sentence must name 2 to 5 concrete form codes and plain names using 'may include'. The second sentence must say Imverica can prepare documents at the client's direction and is not a law firm or attorney. The final sentence may ask one short clarifying question. Do not tell the user which form they legally should file; do not say the user qualifies; do not answer only with a question when possible matches exist.

${FORMS_CATALOG}`;


const ROUTER_STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','by','can','do','document','documents','for','form','forms','from','get','have','help','i','in','is','it','me','my','need','paperwork','please','prepare','prepared','the','to','want','with','you',
  'мне','нужно','надо','документы','форма','формы','подготовить','для','что','как','по','на','и','в','я','у','меня',
  'мені','потрібно','треба','документи','форми','підготувати','для','що','як','та','з',
  'necesito','quiero','para','con','de','la','el','los','las','una','un','documentos','formulario','formularios'
]);

function tokenizeQuery(text) {
  return normalizeText(expandCommunityTerms(text))
    .split(' ')
    .filter((token) => token.length >= 3 && !ROUTER_STOP_WORDS.has(token));
}

function scoreForm(form, queryText, tokens) {
  const query = normalizeText(expandCommunityTerms(queryText));
  const text = form.searchText;
  const code = normalizeText(form.code);
  let score = 0;

  if (!query || !text) return 0;
  if (code && query.includes(code)) score += 120;

  const name = normalizeText(form.name);
  if (name && query.includes(name)) score += 60;

  for (const keyword of form.keywords || []) {
    const kw = normalizeText(keyword);
    if (!kw || kw.length < 3) continue;
    if (query.includes(kw)) score += Math.min(35, 10 + kw.length / 2);
    else {
      const kwTokens = kw.split(' ').filter((token) => token.length >= 3);
      if (kwTokens.length && kwTokens.every((token) => tokens.includes(token))) score += 12;
    }
  }

  for (const token of tokens) {
    if (text.includes(token)) score += token.length >= 6 ? 4 : 2;
  }

  if (tokens.length >= 2 && tokens.every((token) => text.includes(token))) score += 18;
  return score;
}

function queryHasAny(query, phrases) {
  const expandedQuery = normalizeText(expandCommunityTerms(query));
  return phrases.some((phrase) => expandedQuery.includes(normalizeText(phrase)));
}

function codeIn(code, codes) {
  return codes.includes(String(code || '').toUpperCase());
}

function applyRoutingBoosts(form, queryText, baseScore) {
  const query = normalizeText(expandCommunityTerms(queryText));
  const code = String(form.code || '').toUpperCase();
  const pane = form.pane || '';
  const subcategory = normalizeText(form.subcategory);
  let score = baseScore;

  const mentionsCourt = queryHasAny(query, ['court', 'superior court', 'small claims', 'civil', 'family law', 'divorce', 'custody', 'restraining', 'eviction', 'probate', 'суд', 'судеб', 'позов', 'иск', 'corte', 'tribunal']);
  const mentionsImmigration = queryHasAny(query, ['uscis', 'immigration', 'green card', 'asylum', 'citizenship', 'naturalization', 'visa', 'work permit', 'travel document', 'daca', 'tps', 'vawa', 'u visa', 't visa', 'иммиграц', 'грин карт', 'убежищ', 'гражданств', 'inmigracion', 'tarjeta verde', 'asilo', 'ciudadania']);

  if (mentionsCourt && pane === 'immigration' && !mentionsImmigration) score -= 35;
  if (mentionsImmigration && pane !== 'immigration') score -= 20;

  if (queryHasAny(query, ['child custody', 'custody', 'visitation', 'parenting time', 'parenting plan', 'опека', 'custodia', 'visitas'])) {
    if (codeIn(code, ['FL-300', 'FL-311', 'FL-341', 'FL-105', 'FL-305'])) score += 80;
    if (code === 'FL-300') score += 150;
    if (codeIn(code, ['FL-311', 'FL-341'])) score += 35;
    if (codeIn(code, ['FL-150', 'FL-320'])) score += 25;
    if (code.startsWith('DV-') && !queryHasAny(query, ['domestic violence', 'abuse', 'restraining', 'violence', 'threat', 'домашн', 'насили', 'угроз', 'violencia', 'maltrato'])) score -= 65;
  }

  if (queryHasAny(query, ['divorce', 'dissolution', 'legal separation', 'respond to divorce', 'развод', 'розлучення', 'divorcio', 'separacion'])) {
    if (codeIn(code, ['FL-100', 'FL-110', 'FL-120', 'FL-141', 'FL-142', 'FL-150', 'FL-160', 'FL-180', 'FL-190'])) score += 55;
    if (code.startsWith('DV-') && !queryHasAny(query, ['domestic violence', 'restraining', 'abuse', 'насили', 'violencia'])) score -= 50;
  }

  if (queryHasAny(query, ['renew green card', 'renew my green card', 'green card renewal', 'replace green card', 'lost green card', 'expired green card', 'permanent resident card renewal', 'продлить грин карту', 'заменить грин карту', 'renovar green card', 'renovar tarjeta verde'])) {
    if (code === 'I-90') score += 120;
    if (codeIn(code, ['G-1145', 'G-1450', 'I-912'])) score += 30;
    if (codeIn(code, ['I-751', 'I-829']) && queryHasAny(query, ['conditional', 'conditions', '2 year', 'two year', 'условн'])) score += 35;
    if (!queryHasAny(query, ['adjust status', 'adjustment', 'i-485', 'new green card', 'apply for green card', 'family petition', 'marriage green card'])) {
      if (!codeIn(code, ['I-90', 'G-1145', 'G-1450', 'I-912'])) score -= 115;
    }
  }

  if (queryHasAny(query, ['adjust status', 'adjustment of status', 'apply for green card', 'marriage green card', 'green card through family', 'inside the us', 'i-485', 'смена статуса', 'ajuste de estatus'])) {
    if (codeIn(code, ['I-485', 'I-130', 'I-130A', 'I-864', 'I-765', 'I-131'])) score += 70;
    if (code === 'I-90') score -= 45;
  }

  if (queryHasAny(query, ['asylum', 'defensive asylum', 'affirmative asylum', 'withholding', 'убежищ', 'asilo'])) {
    if (codeIn(code, ['I-589', 'I-765', 'I-131', 'I-730'])) score += 70;
    if (codeIn(code, ['I-821', 'I-821D', 'I-90'])) score -= 40;
  }

  if (queryHasAny(query, ['work permit', 'employment authorization', 'ead', 'разрешение на работу', 'permiso de trabajo'])) {
    if (code === 'I-765') score += 90;
    if (code === 'I-765V') score += queryHasAny(query, ['abused spouse', 'vawa', 'насили']) ? 35 : -25;
  }

  if (queryHasAny(query, ['travel document', 'advance parole', 'reentry permit', 'refugee travel', 'travel permit', 'проездной', 'permiso de viaje'])) {
    if (codeIn(code, ['I-131', 'I-131A'])) score += 90;
  }

  if (queryHasAny(query, ['citizenship', 'naturalization', 'become citizen', 'certificate of citizenship', 'гражданство', 'натурализация', 'ciudadania', 'naturalizacion'])) {
    if (codeIn(code, ['N-400', 'N-600', 'N-565', 'N-600K', 'N-648'])) score += 75;
    if (code === 'I-90') score -= 35;
  }

  if (queryHasAny(query, ['family petition', 'petition for relative', 'spouse petition', 'parent petition', 'child petition', 'i-130', 'петиция на родственника', 'peticion familiar'])) {
    if (codeIn(code, ['I-130', 'I-130A', 'I-864', 'I-485', 'I-765', 'I-131'])) score += 75;
  }

  const feeWaiverIntent = queryHasAny(query, ['fee waiver', 'waive fees', 'filing fees', 'court filing fees', 'cannot afford filing fee', 'cannot afford court filing fees', 'cannot afford court fees', 'cant afford filing fee', 'cant afford court fees', 'low income', 'освобождение от пошлины', 'не могу оплатить пошлину', 'exencion de cuotas']);
  const immigrationFeeIntent = feeWaiverIntent && (mentionsImmigration || queryHasAny(query, ['uscis fee', 'immigration fee', 'i-912']));
  if (feeWaiverIntent) {
    if (immigrationFeeIntent) {
      if (code === 'I-912') score += 100;
      if (code.startsWith('FW-')) score -= 35;
    } else {
      if (codeIn(code, ['FW-001', 'FW-003', 'FW-002', 'FW-006'])) score += 155;
      if (!code.startsWith('FW-')) score -= 220;
      if (codeIn(code, ['I-912', 'G-1450', 'G-1055'])) score -= 80;
    }
  }
  if (feeWaiverIntent && immigrationFeeIntent && !codeIn(code, ['I-912', 'G-1450', 'G-1055'])) return 0;
  if (feeWaiverIntent && !immigrationFeeIntent && !code.startsWith('FW-')) return 0;

  if (queryHasAny(query, ['small claims', 'small claim', 'sue someone', 'under 12500', 'малые иски', 'мелкие иски', 'reclamos menores'])) {
    if (pane === 'sc') score += 80;
    if (codeIn(code, ['SC-100', 'SC-104', 'SC-104B', 'SC-120', 'SC-105'])) score += 45;
  }

  if (queryHasAny(query, ['eviction', 'unlawful detainer', 'tenant', 'landlord', 'not paying rent', 'pay rent or quit', 'выселение', 'аренда', 'desalojo', 'inquilino'])) {
    if (pane === 'ud') score += 85;
    if (codeIn(code, ['UD-100', 'UD-105', 'UD-110', 'UD-150', 'UD-N3', 'UD-N30', 'UD-N60', 'UD-N3C'])) score += 50;
  }

  const harassmentIntent = queryHasAny(query, ['neighbor', 'stalking', 'harassment', 'threatening me', 'threats', 'restraining order', 'сосед', 'сталкинг', 'преслед', 'угрож', 'acoso', 'amenaza']);
  if (harassmentIntent) {
    if (codeIn(code, ['CH-100', 'CH-109', 'CH-110', 'CH-120', 'CH-130'])) score += 85;
    if (pane !== 'ro' && !codeIn(code, ['CH-200'])) score -= 75;
  }
  if (queryHasAny(query, ['elder abuse', 'dependent adult', 'caregiver', 'elder protection', 'пожил', 'сиделк', 'adulto mayor'])) {
    if (codeIn(code, ['EA-100', 'EA-109', 'EA-110', 'EA-120', 'EA-130'])) score += 95;
    if (code.startsWith('CH-')) score -= 35;
    if (pane !== 'ro' && !codeIn(code, ['EA-200'])) score -= 75;
  }
  if (queryHasAny(query, ['gun violence', 'has guns', 'firearm', 'dangerous person has guns', 'оружие', 'пистолет', 'armas'])) {
    if (codeIn(code, ['GV-100', 'GV-109', 'GV-110', 'GV-120', 'GV-130'])) score += 100;
    if (code.startsWith('CH-')) score -= 30;
    if (pane !== 'ro' && !codeIn(code, ['GV-200'])) score -= 80;
  }
  if (queryHasAny(query, ['workplace violence', 'employee threatened', 'threatened at work', 'employer', 'coworker', 'работе угрож', 'lugar de trabajo'])) {
    if (codeIn(code, ['WV-100', 'WV-109', 'WV-110', 'WV-120', 'WV-130'])) score += 100;
    if (code.startsWith('CH-')) score -= 30;
    if (pane !== 'ro' && !codeIn(code, ['WV-200'])) score -= 80;
  }

  if (queryHasAny(query, ['probate', 'estate', 'deceased', 'executor', 'administrator', 'inheritance', 'small estate', 'наследство', 'умер', 'sucesion', 'herencia'])) {
    if (pane === 'probate') score += 90;
    if (codeIn(code, ['DE-111', 'DE-120', 'DE-121', 'DE-140', 'DE-150', 'DE-160', 'DE-310', 'DE-305'])) score += 55;
    if (pane === 'immigration' && !mentionsImmigration) score -= 70;
  }

  if (queryHasAny(query, ['conservatorship', 'conservator', 'adult cannot care', 'консерватор', 'curatela'])) {
    if (codeIn(code, ['GC-310', 'GC-312', 'GC-320', 'GC-340', 'GC-350'])) score += 90;
    if (code.startsWith('DE-')) score -= 25;
  }

  if (queryHasAny(query, ['guardianship', 'guardian for child', 'minor child guardian', 'опекун', 'tutela'])) {
    if (codeIn(code, ['GC-210', 'GC-211', 'GC-212', 'GC-240', 'GC-250'])) score += 90;
  }

  if (queryHasAny(query, ['asylum', 'defensive asylum', 'affirmative asylum', 'withholding', 'убежищ', 'asilo']) && !codeIn(code, ['I-589', 'I-765', 'I-131', 'I-730', 'G-1145', 'G-1450', 'I-912'])) {
    score -= 65;
  }

  if (queryHasAny(query, ['work permit', 'employment authorization', 'ead', 'разрешение на работу', 'permiso de trabajo']) && !codeIn(code, ['I-765', 'I-765V', 'G-1145', 'G-1450', 'I-912'])) {
    score -= 45;
  }

  if (queryHasAny(query, ['citizenship', 'naturalization', 'become citizen', 'certificate of citizenship', 'гражданство', 'натурализация', 'ciudadania', 'naturalizacion']) && pane === 'immigration' && !codeIn(code, ['N-400', 'N-600', 'N-565', 'N-600K', 'N-648', 'N-336'])) {
    score -= 55;
  }

  if (subcategory.includes('proof of service') || subcategory.includes('service')) {
    if (queryHasAny(query, ['serve papers', 'proof of service', 'served', 'service by mail', 'personal service', 'вручение', 'entrega'])) score += 55;
    else if (!queryHasAny(query, ['service', 'serve', 'served', 'вручение', 'entrega'])) score -= 18;
  }

  return score;
}

function getLatestUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i] && messages[i].role === 'user') return String(messages[i].content || '');
  }
  return '';
}

function getLikelyMatches(queryText, limit = 8) {
  const tokens = tokenizeQuery(queryText);
  if (!tokens.length && !normalizeText(queryText)) return [];

  const byCode = new Map();

  FORMS_INDEX
    .map((form) => ({ form, score: applyRoutingBoosts(form, queryText, scoreForm(form, queryText, tokens)) }))
    .filter((item) => item.score > 0)
    .forEach((item) => {
      const key = String(item.form.code || '').toUpperCase();
      const existing = byCode.get(key);
      if (!existing || item.score > existing.score) byCode.set(key, item);
    });

  return [...byCode.values()]
    .sort((a, b) => b.score - a.score || a.form.code.localeCompare(b.form.code))
    .slice(0, limit)
    .map((item) => item.form);
}

function buildRoutingContext(messages) {
  const queryText = getLatestUserText(messages);
  const matches = getLikelyMatches(queryText, 8);
  if (!matches.length) {
    return 'LIKELY CATALOG MATCHES: none found. If the user request is vague, ask one short clarifying question and mention document preparation only.';
  }

  const rows = matches.map((form) => (
    `${form.code} | ${form.name} | ${form.subcategory} | ${form.pane} | ${form.description}`
  ));

  return `LIKELY CATALOG MATCHES FOR THE LATEST USER MESSAGE:\n${rows.join('\n')}\nUse these matches first. The answer must name concrete possible form codes from this list before any clarifying question, while preserving LDA no-legal-advice language.`;
}

const RATE_LIMIT = 15;
const WINDOW_MS = 10 * 60 * 1000;
const ipMap = new Map();

function checkRate(ip) {
  const now = Date.now();
  const record = ipMap.get(ip);
  if (!record || now - record.windowStart >= WINDOW_MS) {
    ipMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  record.count++;
  if (record.count > RATE_LIMIT) return false;
  return true;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!process.env.ANTHROPIC_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Not configured' }) };

  const ip = (event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (!checkRate(ip)) {
    return { statusCode: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Too many messages. Please call (916) 399-3992.' }) };
  }

  let messages;
  try {
    const body = JSON.parse(event.body || '{}');
    messages = body.messages;
    if (!Array.isArray(messages) || !messages.length) throw new Error();
    if (messages.length > 40) messages = messages.slice(-40);
  } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Bad request' }) }; }

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 420, system: `${SYSTEM_WITH_FORMS}

${buildRoutingContext(messages)}`, messages })
    });
    if (!apiRes.ok) { const t = await apiRes.text(); console.error(apiRes.status, t); return { statusCode: 502, body: JSON.stringify({ error: 'Upstream error' }) }; }
    const data = await apiRes.json();
    const reply = data.content?.[0]?.text || '';
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ reply }) };
  } catch (err) { console.error(err); return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) }; }
};
