const USCIS_BASE = 'https://www.uscis.gov';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const FORM_PAGE_PATHS = {
  'I-130A': ['i-130'],
  'I-485 SUPPLEMENT A': ['i-485supa', 'i-485'],
  'I-485 SUPPLEMENT J': ['i-485supj', 'i-485'],
  'I-539A': ['i-539'],
  'I-590': ['i-590']
};

const FORM_PDF_ALIASES = {
  'G-845 SUPPLEMENT': ['g-845supplement', 'g-845-supplement'],
  'I-485 SUPPLEMENT A': ['i-485supa'],
  'I-485 SUPPLEMENT J': ['i-485supj']
};

const DIRECT_PDF_FALLBACKS = {
  'G-639': ['g-639'],
  'I-134A': ['i-134a'],
  'I-590': ['i-590'],
  'I-942': ['i-942']
};

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

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function codeToPath(code) {
  return code.toLowerCase().replace(/\s+/g, '-');
}

function getPagePaths(code) {
  return FORM_PAGE_PATHS[code] || [codeToPath(code)];
}

function getPdfAliases(code) {
  const compact = code.toLowerCase().replace(/\s+/g, '');
  return [...new Set([compact, ...(FORM_PDF_ALIASES[code] || [])])];
}

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutize(href) {
  try {
    return new URL(href, USCIS_BASE).href;
  } catch {
    return '';
  }
}

function findPdfLink(html, code, instruction = false) {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: absolutize(match[1]),
      text: stripTags(match[2])
    }))
    .filter((link) => link.href && link.href.includes('/sites/default/files/document/forms/'));

  const aliases = getPdfAliases(code);

  const scored = links.map((link) => {
    const lowerHref = link.href.toLowerCase();
    const lowerText = link.text.toLowerCase();
    let score = 0;

    if (instruction) {
      if (aliases.some((alias) => lowerHref.includes(`${alias}instr.pdf`))) score += 80;
      if (lowerText.includes('instruction')) score += 30;
      if (lowerHref.includes('instr')) score += 25;
    } else {
      if (aliases.some((alias) => lowerHref.includes(`${alias}.pdf`))) score += 80;
      if (lowerText.includes(`form ${code.toLowerCase()}`)) score += 30;
      if (!lowerHref.includes('instr')) score += 15;
    }

    return { ...link, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].href : '';
}

async function fetchUscisPage(paths) {
  let lastUrl = '';

  for (const formPath of paths) {
    const pageUrl = `${USCIS_BASE}/${formPath}`;
    lastUrl = pageUrl;

    const pageRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Imverica document preparation form checker (+https://imverica.com)'
      }
    });

    if (pageRes.ok) {
      return {
        html: await pageRes.text(),
        pageUrl: pageRes.url || pageUrl
      };
    }
  }

  return { html: '', pageUrl: lastUrl };
}

async function directPdfUrl(code, instruction = false) {
  const aliases = [...getPdfAliases(code), ...(DIRECT_PDF_FALLBACKS[code] || [])];

  for (const alias of [...new Set(aliases)]) {
    const url = `${USCIS_BASE}/sites/default/files/document/forms/${alias}${instruction ? 'instr' : ''}.pdf`;
    const res = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Imverica document preparation form checker (+https://imverica.com)'
      }
    });

    if (res.ok && String(res.headers.get('content-type') || '').toLowerCase().includes('pdf')) {
      return url;
    }
  }

  return '';
}

function extractEditionDate(html) {
  const text = stripTags(html);
  const match = text.match(/Edition Date\s+([0-9]{2}\/[0-9]{2}\/[0-9]{2,4})/i);
  return match ? match[1] : '';
}

function extractTitle(html, code) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripTags(h1[1]);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return stripTags(title[1]).replace(/\s*\|\s*USCIS\s*$/i, '');

  return code;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const code = normalizeCode(event.queryStringParameters?.code);
  if (!/^[A-Z]{1,4}-[0-9A-Z]+(?: SUPPLEMENT(?: [A-Z])?)?$/.test(code)) {
    return json(400, { error: 'Missing or invalid USCIS form code' });
  }

  const requestedPageUrl = `${USCIS_BASE}/${getPagePaths(code)[0]}`;

  try {
    const page = await fetchUscisPage(getPagePaths(code));
    const html = page.html;
    const pageUrl = page.pageUrl || requestedPageUrl;

    if (!html) {
      const pdfUrl = await directPdfUrl(code, false);
      const instructionsUrl = await directPdfUrl(code, true);

      if (pdfUrl) {
        return json(200, {
          code,
          title: code,
          uscisPageUrl: pageUrl,
          pdfUrl,
          instructionsUrl,
          editionDate: '',
          source: 'USCIS official website',
          checkedAt: new Date().toISOString(),
          status: 'direct-pdf',
          note: 'No public USCIS landing page was found; using the official USCIS direct PDF URL.',
          disclaimer: 'Document preparation only. Imverica is not a law firm or attorney and does not provide legal advice.'
        }, {
          'Cache-Control': 'public, max-age=3600'
        });
      }

      return json(502, { error: 'Could not load USCIS form page or direct PDF', code, pageUrl });
    }

    const pdfUrl = findPdfLink(html, code, false) || await directPdfUrl(code, false);
    const instructionsUrl = findPdfLink(html, code, true) || await directPdfUrl(code, true);

    return json(200, {
      code,
      title: extractTitle(html, code),
      uscisPageUrl: pageUrl,
      pdfUrl,
      instructionsUrl,
      editionDate: extractEditionDate(html),
      source: 'USCIS official website',
      checkedAt: new Date().toISOString(),
      status: pdfUrl ? 'current-pdf-found' : 'page-found-no-pdf-link',
      disclaimer: 'Document preparation only. Imverica is not a law firm or attorney and does not provide legal advice.'
    }, {
      'Cache-Control': 'public, max-age=3600'
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'USCIS lookup failed', code, pageUrl: requestedPageUrl });
  }
};
