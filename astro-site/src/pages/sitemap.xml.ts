import type { APIRoute } from 'astro';

/**
 * Hand-rolled sitemap. List one entry per public URL; Astro will write
 * the result to dist/sitemap.xml at build time.
 *
 * Add new pages here when they ship. Lastmod is the build date so
 * Google sees fresh dates without us tracking per-page changes.
 */
const SITE = 'https://imverica.com';

const URLS = [
  { loc: '/', priority: 1.0, changefreq: 'weekly' },
  { loc: '/i-485-help', priority: 0.9, changefreq: 'monthly' },
  { loc: '/i-589-asylum-help', priority: 0.9, changefreq: 'monthly' },
  { loc: '/n-400-citizenship-help', priority: 0.9, changefreq: 'monthly' },
  { loc: '/i-130-family-petition', priority: 0.9, changefreq: 'monthly' },
  { loc: '/i-765-work-permit-help', priority: 0.85, changefreq: 'monthly' },
  { loc: '/california-unlawful-detainer', priority: 0.85, changefreq: 'monthly' },
  { loc: '/california-small-claims', priority: 0.8, changefreq: 'monthly' },
  { loc: '/california-restraining-orders', priority: 0.8, changefreq: 'monthly' },
  { loc: '/california-family-law', priority: 0.85, changefreq: 'monthly' },
  { loc: '/california-probate', priority: 0.75, changefreq: 'monthly' },
  { loc: '/california-legal-document-assistant', priority: 0.7, changefreq: 'monthly' }
];

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${URLS.map(
    (u) => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`
  ).join('\n')}
</urlset>
`;
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};
