const catalogs = {
  immigration: require('./forms/immigration.json'),
  fl: require('./forms/fl.json'),
  civ: require('./forms/civ.json'),
  sc: require('./forms/sc.json'),
  ud: require('./forms/ud.json'),
  ro: require('./forms/ro.json'),
  fee: require('./forms/fee.json'),
  service: require('./forms/service.json'),
  probate: require('./forms/probate.json')
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
  probate: 'probate'
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
  probate: 'California Superior Court'
};

const PACKAGE_RULES = [
  {
    id: 'marriage_uscis',
    formCode: 'I-130',
    service: 'immigration',
    packageForms: ['I-130', 'I-130A', 'I-485', 'I-765', 'I-131', 'I-864'],
    confidence: 0.86,
    patterns: [/свадьб|брак|женит|замуж|spouse|marriage|муж[ау]?|жен[аеуы]|супруг|супруга/i],
    reason: 'Marriage/family immigration language usually starts with a family petition package.'
  },
  {
    id: 'work_permit',
    formCode: 'I-765',
    service: 'immigration',
    packageForms: ['I-765'],
    confidence: 0.92,
    patterns: [/ворк\s*п[еэ]рмит|work\s*permit|employment authorization|\bead\b|разрешени[ея]\s+на\s+работ/i],
    reason: 'Work permit language maps to Form I-765.'
  },
  {
    id: 'green_card',
    formCode: 'I-485',
    service: 'immigration',
    packageForms: ['I-485', 'I-765', 'I-131', 'I-864'],
    confidence: 0.84,
    patterns: [/грин\s*карт|green\s*card|adjustment\s*of\s*status|adjust\s*status|изменени[ея]\s+статус/i],
    reason: 'Green card inside the United States usually maps to adjustment preparation.'
  },
  {
    id: 'small_claims',
    formCode: 'SC-100',
    service: 'civil',
    packageForms: ['SC-100', 'SC-104', 'SC-150'],
    confidence: 0.9,
    patterns: [/смол+\s*кле[ий]м|small\s*claims?|мал(ый|ые|ого)?\s+иск|reclamos?\s+menores?/i],
    reason: 'Small claims language maps to SC-100 as the starting form.'
  },
  {
    id: 'restraining_order',
    formCode: 'CH-100',
    service: 'restraining',
    packageForms: ['CH-100', 'CH-109', 'CH-110'],
    confidence: 0.82,
    patterns: [/restraining|рестре[ий]нинг|ристре[ий]нинг|защитн\w*\s+ордер|harass|stalk|угрож/i],
    reason: 'Restraining order language maps to CH-100 unless another RO type is specified.'
  },
  {
    id: 'unlawful_detainer',
    formCode: 'UD-100',
    service: 'ud',
    packageForms: ['UD-100', 'SUM-130', 'CM-010'],
    confidence: 0.84,
    patterns: [/unlawful\s*detainer|eviction|выселен|эвикш|tenant|landlord|арендатор|арендодатель|ud-100/i],
    reason: 'Eviction/unlawful detainer language maps to UD-100.'
  },
  {
    id: 'request_for_order',
    formCode: 'FL-300',
    service: 'family',
    packageForms: ['FL-300', 'FL-311', 'FL-150'],
    confidence: 0.82,
    patterns: [/fl-300|request\s+for\s+order|custody|visitation|support|кастоди|опек|алим[еє]нт/i],
    reason: 'Family law request language maps to FL-300.'
  },
  {
    id: 'divorce',
    formCode: 'FL-100',
    service: 'family',
    packageForms: ['FL-100', 'FL-105', 'FL-110', 'FL-115'],
    confidence: 0.86,
    patterns: [/divorce|dissolution|развод|развестись|розлуч|divorcio/i],
    reason: 'Divorce language maps to FL-100 as the starting petition.'
  }
];

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

function routeFromForm(row, lang, confidence, reason, packageForms = []) {
  return {
    service: row.service,
    catalog: row.catalogKey,
    jurisdiction: row.jurisdiction,
    formCode: row.code,
    formTitle: formTitle(row.form, lang),
    officialEndpoint: officialEndpointFor(row.catalogKey),
    flowEndpoint: flowEndpointFor(row.catalogKey),
    flowStatus: row.catalogKey === 'immigration' ? 'schema-ready' : 'catalog-only',
    packageForms: packageForms.length ? packageForms : [row.code],
    confidence,
    reason
  };
}

function findByCode(code) {
  return allForms().find((row) => row.code === code);
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

function routeQuery(queryValue) {
  const originalQuery = String(queryValue || '').trim();
  const query = normalizeText(originalQuery);
  const lang = detectLanguage(originalQuery);
  const forms = allForms();

  const codeMatch = originalQuery.match(/\b(?:AR|I|N|G|EOIR|FL|DV|CH|EA|GV|WV|SC|UD|FW|POS|CIV|CM|SUM|PLD|DE|GC)-[A-Z0-9]+(?:\s+Supplement(?:\s+[A-Z])?)?(?:\([A-Z0-9]+\))?\b/i);
  if (codeMatch) {
    const row = findByCode(normalizeCode(codeMatch[0]));
    if (row) {
      return {
        ok: true,
        query: originalQuery,
        language: lang,
        route: routeFromForm(row, lang, 0.99, 'Direct form code match.')
      };
    }
  }

  for (const rule of PACKAGE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(originalQuery) || pattern.test(query))) {
      const row = findByCode(rule.formCode);
      if (row) {
        return {
          ok: true,
          query: originalQuery,
          language: lang,
          route: routeFromForm(row, lang, rule.confidence, rule.reason, rule.packageForms),
          packageRule: rule.id
        };
      }
    }
  }

  const scored = forms
    .map((row) => ({ row, score: scoreCatalogMatch(row, query, lang) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored[0]) {
    const confidence = Math.min(0.88, Math.max(0.45, scored[0].score / 120));
    return {
      ok: true,
      query: originalQuery,
      language: lang,
      route: routeFromForm(scored[0].row, lang, Number(confidence.toFixed(2)), 'Best catalog keyword match.'),
      alternatives: scored.slice(1, 4).map((item) => routeFromForm(item.row, lang, Number(Math.min(0.7, item.score / 140).toFixed(2)), 'Alternative catalog match.'))
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
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      query = body.q || body.query || body.text || query;
    } catch {
      return json(400, { ok: false, error: 'Invalid JSON' });
    }
  }

  if (!String(query || '').trim()) return json(400, { ok: false, error: 'Missing query' });

  const result = routeQuery(query);
  return json(result.ok ? 200 : 404, result, { 'Cache-Control': 'public, max-age=300' });
}

module.exports = {
  handler,
  routeQuery,
  normalizeCode,
  detectLanguage
};
