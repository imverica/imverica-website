const fs = require('fs');
const path = require('path');

const COURTS_BASE = 'https://www.courts.ca.gov';
const SELF_HELP_BASE = 'https://selfhelp.courts.ca.gov';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

let catalogByCode;

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

function codeToPdfName(code) {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutize(href, base = COURTS_BASE) {
  try {
    return new URL(href, base).href;
  } catch {
    return '';
  }
}

function loadCatalog() {
  if (catalogByCode) return catalogByCode;

  catalogByCode = new Map();
  const formsDir = path.join(__dirname, 'forms');

  try {
    for (const file of fs.readdirSync(formsDir).filter((item) => item.endsWith('.json'))) {
      if (file === 'immigration.json') continue;

      const data = JSON.parse(fs.readFileSync(path.join(formsDir, file), 'utf8'));
      const forms = Array.isArray(data.forms) ? data.forms : Array.isArray(data) ? data : [];

      for (const form of forms) {
        const code = normalizeCode(form.code);
        if (!code || catalogByCode.has(code)) continue;

        catalogByCode.set(code, {
          code,
          title: form.names?.en || Object.values(form.names || {})[0] || code,
          category: data.category || '',
          pane: data.subcategory_pane || path.basename(file, '.json'),
          subcategory: form.subcategory || ''
        });
      }
    }
  } catch (err) {
    console.error('Failed to load California forms catalog:', err);
  }

  return catalogByCode;
}

function extractTitle(html, code) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const codePattern = escapeRegExp(code);
  if (h1) return stripTags(h1[1]).replace(new RegExp(`\\s*\\(${codePattern}\\)\\s*$`, 'i'), '').trim();

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) {
    return stripTags(title[1])
      .replace(/\s*\|\s*California Courts\s*\|\s*Self Help Guide\s*$/i, '')
      .replace(new RegExp(`\\s*\\(${codePattern}\\)\\s*$`, 'i'), '')
      .trim();
  }

  return '';
}

function extractEffectiveDate(html) {
  const text = stripTags(html);
  const match = text.match(/\bEffective:\s*([A-Z][a-z]+ \d{1,2}, \d{4})/i);
  return match ? match[1] : '';
}

function findPdfLink(html, code) {
  const pdfName = `${codeToPdfName(code)}.pdf`;
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: absolutize(match[1], SELF_HELP_BASE),
      text: stripTags(match[2])
    }))
    .filter((link) => link.href);

  const scored = links.map((link) => {
    const lowerHref = link.href.toLowerCase();
    const lowerText = link.text.toLowerCase();
    let score = 0;

    if (lowerHref.endsWith(`/documents/${pdfName}`) || lowerHref.includes(`/documents/${pdfName}?`)) score += 100;
    if (lowerHref.includes(pdfName)) score += 80;
    if (lowerText.includes(`form ${code.toLowerCase()}`)) score += 25;
    if (lowerText.includes(`get form ${code.toLowerCase()}`)) score += 35;

    return { ...link, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].href : '';
}

async function fetchText(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Imverica document preparation form checker (+https://imverica.com)'
      }
    });
  } catch (err) {
    console.error(`Could not fetch California form page ${url}:`, err);
    return { html: '', url };
  }

  if (!res.ok) return { html: '', url };
  return {
    html: await res.text(),
    url: res.url || url
  };
}

async function isPdfAvailable(url) {
  const headers = {
    'User-Agent': 'Imverica document preparation form checker (+https://imverica.com)'
  };

  try {
    const head = await fetch(url, { method: 'HEAD', headers });
    const headType = String(head.headers.get('content-type') || '').toLowerCase();
    if (head.ok && (headType.includes('pdf') || url.toLowerCase().endsWith('.pdf'))) return true;

    const res = await fetch(url, { headers: { ...headers, Range: 'bytes=0-512' } });
    const type = String(res.headers.get('content-type') || '').toLowerCase();
    return res.ok && (type.includes('pdf') || url.toLowerCase().endsWith('.pdf'));
  } catch (err) {
    console.error(`Could not verify California form PDF ${url}:`, err);
    return false;
  }
}

async function directPdfUrl(code) {
  const url = `${COURTS_BASE}/documents/${codeToPdfName(code)}.pdf`;
  return await isPdfAvailable(url) ? url : '';
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const code = normalizeCode(event.queryStringParameters?.code);
  if (!/^[A-Z]{1,5}(?:-[A-Z0-9]{1,5}){1,3}(?:\([A-Z0-9]{1,4}\))?$/.test(code)) {
    return json(400, { error: 'Missing or invalid California Judicial Council form code' });
  }

  const catalogEntry = loadCatalog().get(code);
  const selfHelpPageUrl = `${SELF_HELP_BASE}/jcc-form/${encodeURIComponent(code)}`;

  try {
    const page = await fetchText(selfHelpPageUrl);
    const html = page.html;
    const pagePdfUrl = html ? findPdfLink(html, code) : '';
    const pdfUrl = pagePdfUrl || await directPdfUrl(code);
    const officialPageUrl = html ? page.url : `${COURTS_BASE}/rules-forms/court-forms`;

    if (!html && !pdfUrl) {
      return json(404, {
        error: 'Could not locate an official California Judicial Council form page or PDF',
        code,
        officialPageUrl,
        source: 'Judicial Branch of California official websites',
        checkedAt: new Date().toISOString(),
        status: catalogEntry ? 'catalog-only-no-official-pdf-found' : 'not-found',
        note: 'Some notices or local court templates may not be statewide Judicial Council forms. Check the county Superior Court for local forms.',
        disclaimer: 'Document preparation only. Imverica is not a law firm or attorney and does not provide legal advice.'
      });
    }

    return json(200, {
      code,
      title: extractTitle(html, code) || catalogEntry?.title || code,
      category: catalogEntry?.category || '',
      pane: catalogEntry?.pane || '',
      subcategory: catalogEntry?.subcategory || '',
      officialPageUrl,
      selfHelpPageUrl: html ? page.url : '',
      pdfUrl,
      effectiveDate: extractEffectiveDate(html),
      source: 'Judicial Branch of California official websites',
      checkedAt: new Date().toISOString(),
      status: pdfUrl ? 'current-pdf-found' : 'page-found-no-pdf-link',
      note: 'Statewide Judicial Council form lookup. County Superior Courts may also require local forms.',
      disclaimer: 'Document preparation only. Imverica is not a law firm or attorney and does not provide legal advice.'
    }, {
      'Cache-Control': 'public, max-age=3600'
    });
  } catch (err) {
    console.error(err);
    return json(500, {
      error: 'California Judicial Council form lookup failed',
      code,
      officialPageUrl: selfHelpPageUrl
    });
  }
};
