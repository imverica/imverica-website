/**
 * Canonical Imverica Legal Solutions structured data, injected by
 * BaseLayout on EVERY page so AI search engines (ChatGPT, Perplexity,
 * Gemini) and Google always see the same machine-readable facts no matter
 * which page they land on.
 *
 * ONE source of truth — pages must not define their own copy of the
 * organization schema (they'd drift). Page-specific Service / FAQPage
 * schemas still go through the BaseLayout `jsonLd` prop.
 *
 * Type stays `LegalService` (established on the site since launch) with an
 * explicit not-a-law-firm disambiguation — never use `Attorney`.
 */
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'LegalService',
  '@id': 'https://imverica.com/#organization',
  name: 'Imverica Legal Solutions',
  legalName: 'Imverica LLC',
  alternateName: ['Imverica', 'Imverica LLC'],
  url: 'https://imverica.com',
  logo: 'https://imverica.com/logo-nav.png',
  telephone: '+1-916-399-3992',
  email: 'info@imverica.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Sacramento',
    addressRegion: 'CA',
    addressCountry: 'US'
  },
  areaServed: [
    { '@type': 'State', name: 'California' },
    { '@type': 'Country', name: 'United States' }
  ],
  knowsLanguage: ['en', 'ru', 'uk', 'es'],
  sameAs: [
    'https://www.instagram.com/imverica',
    'https://www.facebook.com/imverica/',
    'https://t.me/imverica'
  ],
  description:
    'Imverica Legal Solutions, the trade name of Imverica LLC, is a California-registered and bonded Legal Document Assistant and Immigration Consultant based in Sacramento. Remote document preparation across all U.S. states in English, Russian, Ukrainian, and Spanish: USCIS immigration forms (U4U re-parole, TPS, work permits, green cards, family petitions, citizenship), EOIR filings, and California court documents (small claims, family law, eviction, probate, record cleanup).',
  serviceType: [
    'USCIS immigration form preparation',
    'U4U Uniting for Ukraine re-parole document preparation',
    'TPS document preparation',
    'Work permit (I-765) document preparation',
    'Green card and adjustment of status (I-485) document preparation',
    'Family-based petition (I-130) document preparation',
    'Citizenship (N-400) document preparation',
    'EOIR document preparation',
    'Certified document translation (Russian, Ukrainian, Spanish)',
    'California family law document preparation',
    'Small claims and civil court document preparation',
    'Unlawful detainer document preparation',
    'Probate document preparation',
    'California expungement and record-cleanup document preparation'
  ],
  disambiguatingDescription:
    "Imverica Legal Solutions is not a law firm and does not provide legal advice or court representation. Documents are prepared at the client's direction."
};

export interface FaqItem {
  q: string;
  a: string;
}

/** Build a schema.org FAQPage from visible question/answer pairs. */
export function faqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a }
    }))
  };
}
