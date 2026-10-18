import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES, localizedPath } from '~/data/i18n';

/**
 * Hand-rolled sitemap with hreflang alternates per URL.
 * Add new pages to URLS; the sitemap automatically lists each one in every
 * language we have a real page for.
 */
const SITE = 'https://imverica.com';

interface SitemapEntry {
  slug: string;
  priority: number;
  changefreq: string;
  /** Kept for reference only: the languages listed in the sitemap are the
   *  ones whose page file actually exists (see pageExists below), so this
   *  list can no longer drift from the site. */
  translatedLocales: ('ru' | 'uk' | 'es')[];
  /** false for pages that exist only in translation (e.g. /ru/sacramento). */
  en?: boolean;
}

const URLS: SitemapEntry[] = [
  { slug: '/', priority: 1.0, changefreq: 'weekly', translatedLocales: ['ru', 'uk', 'es'] },
  // High-intent pages that were MISSING from the sitemap entirely (found
  // 2026-07-14 during the AI-search audit — /u4u and /tps are the exact
  // pages RU/UA leads land on, and they were invisible to crawlers).
  { slug: '/u4u', priority: 0.95, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/tps', priority: 0.9, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/about-imverica-legal-solutions', priority: 0.9, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/uscis-document-review', priority: 0.9, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/immigration', priority: 0.9, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/pricing', priority: 0.85, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/about', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/testimonials', priority: 0.7, changefreq: 'weekly', translatedLocales: [] },
  { slug: '/business', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/criminal', priority: 0.75, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/california-name-change', priority: 0.7, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/for-attorneys', priority: 0.6, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/schedule', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-485-help', priority: 0.9, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-589-asylum-help', priority: 0.9, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/n-400-citizenship-help', priority: 0.9, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/california-unlawful-detainer', priority: 0.85, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-130-family-petition', priority: 0.9, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/i-765-work-permit-help', priority: 0.85, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/sc', priority: 0.8, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/california-restraining-orders', priority: 0.8, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/fl', priority: 0.85, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/california-probate', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/california-expungement', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/lda', priority: 0.7, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/u-visa-help', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-539-change-of-status', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-90-green-card-renewal', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/vawa-self-petition', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/eoir-immigration-court', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/fl-100-divorce', priority: 0.85, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/fl-120-divorce-response', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/fl-150-income-expense-declaration', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/fl-160-property-declaration', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/fl-300-request-for-order', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/fl-105-uccjea', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/fw-001-fee-waiver', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/demand-letter', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/sc-100-plaintiff-claim', priority: 0.85, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/sc-120-defendant-claim', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/sc-104-proof-of-service', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/sc-133-memorandum-of-costs', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/wg-001-wage-garnishment', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/ej-001-abstract-of-judgment', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/sc-140-installments', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/llc-1-form-an-llc', priority: 0.85, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/llc-12-statement-of-information', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/arts-gs-incorporation', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/fbn-dba', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/ss-4-ein', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/operating-agreement', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/llc-1a-foreign-llc', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/si-550-corporation-statement', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  // USCIS form-level pages (each chip on /immigration links here)
  { slug: '/i-131-travel-document', priority: 0.85, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-131a-returning-resident', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-864-affidavit-of-support', priority: 0.85, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-864a-household-member', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-693-medical-examination', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-751-remove-conditions', priority: 0.85, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-824-action-on-approved-application', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  // EOIR form-level pages
  { slug: '/eoir-29-notice-of-appeal', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/eoir-42a-cancellation-lpr', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/eoir-42b-cancellation-non-lpr', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/eoir-40-suspension-of-deportation', priority: 0.7, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  // Russian / Ukrainian community page with no English version
  { slug: '/sacramento', priority: 0.6, changefreq: 'monthly', translatedLocales: ['ru', 'uk'], en: false },
  { slug: '/terms.html', priority: 0.3, changefreq: 'yearly', translatedLocales: [] }
];

type Loc = 'en' | 'ru' | 'uk' | 'es';
const PAGES_DIR = path.join(process.cwd(), 'src/pages');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
function pageExists(href: string): boolean {
  if (!fs.existsSync(PAGES_DIR)) return true;
  if (/\.html$/.test(href)) return fs.existsSync(path.join(PUBLIC_DIR, href));
  const p = href.replace(/\/$/, '') || '/index';
  return fs.existsSync(path.join(PAGES_DIR, p + '.astro')) || fs.existsSync(path.join(PAGES_DIR, p, 'index.astro'));
}
function localesFor(entry: SitemapEntry): Loc[] {
  const all: Loc[] = entry.en === false ? ['ru', 'uk', 'es'] : ['en', 'ru', 'uk', 'es'];
  return all.filter((l) => pageExists(localizedPath(l, entry.slug)));
}

function urlBlock(entry: SitemapEntry, lastmod: string, locale: Loc, locales: Loc[]): string {
  const loc = SITE + localizedPath(locale, entry.slug);
  // hreflang alternates: every language this page really exists in
  const alternates = locales
    .map((alt) => `    <xhtml:link rel="alternate" hreflang="${LOCALES[alt].htmlLang}" href="${SITE + localizedPath(alt, entry.slug)}"/>`)
    .join('\n');
  const xDefault = SITE + localizedPath(locales.includes('en') ? 'en' : locales[0], entry.slug);
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}"/>
  </url>`;
}

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const blocks: string[] = [];
  for (const entry of URLS) {
    // One <url> per language the page exists in, each listing the others
    const locales = localesFor(entry);
    for (const locale of locales) blocks.push(urlBlock(entry, lastmod, locale, locales));
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${blocks.join('\n')}
</urlset>
`;
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};
