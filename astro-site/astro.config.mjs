import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://imverica.com',
  // i18n routing wired up in Phase 4; sitemap integration enabled there too
  // once we know the final URL tree.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru', 'uk', 'es'],
    routing: { prefixDefaultLocale: false }
  },
  integrations: [],
  // Output to dist/. Netlify will publish this directory once the cutover
  // happens in Phase 4. Until then the legacy index.html at repo root keeps
  // shipping.
  build: {
    assets: 'assets'
  },
  // Compress HTML output and prefetch on hover for snappy navigation.
  prefetch: true,
  compressHTML: true
});
