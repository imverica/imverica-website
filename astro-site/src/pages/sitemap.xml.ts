import type { APIRoute } from 'astro';
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
  /** Locales that actually have a translated page. English (en) is implicit. */
  translatedLocales: ('ru' | 'uk' | 'es')[];
}

const URLS: SitemapEntry[] = [
  { slug: '/', priority: 1.0, changefreq: 'weekly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-485-help', priority: 0.9, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-589-asylum-help', priority: 0.9, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/n-400-citizenship-help', priority: 0.9, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/california-unlawful-detainer', priority: 0.85, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-130-family-petition', priority: 0.9, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/i-765-work-permit-help', priority: 0.85, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/sc', priority: 0.8, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/california-restraining-orders', priority: 0.8, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/fl', priority: 0.85, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/california-probate', priority: 0.75, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/lda', priority: 0.7, changefreq: 'monthly', translatedLocales: [] },
  { slug: '/u-visa-help', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-539-change-of-status', priority: 0.75, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/i-90-green-card-renewal', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/vawa-self-petition', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] },
  { slug: '/eoir-immigration-court', priority: 0.8, changefreq: 'monthly', translatedLocales: ['ru', 'uk', 'es'] }
];

function urlBlock(entry: SitemapEntry, lastmod: string, locale: 'en' | 'ru' | 'uk' | 'es'): string {
  const loc = SITE + localizedPath(locale, entry.slug);
  // hreflang alternates: include every available language variant for this entry
  const availableLocales: ('en' | 'ru' | 'uk' | 'es')[] = ['en', ...entry.translatedLocales];
  const alternates = availableLocales
    .map((alt) => `    <xhtml:link rel="alternate" hreflang="${LOCALES[alt].htmlLang}" href="${SITE + localizedPath(alt, entry.slug)}"/>`)
    .join('\n');
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE + entry.slug}"/>
  </url>`;
}

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const blocks: string[] = [];
  for (const entry of URLS) {
    // English root URL always listed
    blocks.push(urlBlock(entry, lastmod, 'en'));
    // Each translated locale variant listed separately
    for (const locale of entry.translatedLocales) {
      blocks.push(urlBlock(entry, lastmod, locale));
    }
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
