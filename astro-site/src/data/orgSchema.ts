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
 * `Organization` keeps the entity unambiguous without implying that Imverica
 * is a law firm or publishing a physical address. Never use `Attorney`.
 */
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://imverica.com/#organization',
  name: 'Imverica Legal Solutions',
  legalName: 'Imverica LLC',
  alternateName: ['Imverica', 'Imverica LLC'],
  url: 'https://imverica.com',
  logo: 'https://imverica.com/logo-nav.png',
  telephone: '+1-916-399-3992',
  email: 'info@imverica.com',
  areaServed: [
    { '@type': 'State', name: 'California' }
  ],
  knowsLanguage: ['en', 'ru', 'uk', 'es'],
  // The founder's LDA Reg. No. 2026-010, Sacramento County, expires
  // 09/27/2028 (Cal. Bus. & Prof. Code §6400 et seq.), and the founder's
  // immigration consultant bond on file with the California Secretary of State.
  identifier: [
    { '@type': 'PropertyValue', propertyID: 'California Legal Document Assistant registration of the founder (Sacramento County, expires 2028-09-27)', value: '2026-010' },
    { '@type': 'PropertyValue', propertyID: 'California Immigration Consultant bond of the founder (Western Surety Company)', value: '67347671' }
  ],
  sameAs: [
    'https://www.instagram.com/imverica',
    'https://www.facebook.com/imverica/',
    'https://t.me/imverica'
  ],
  description:
    'Imverica Legal Solutions, the trade name of Imverica LLC, is a document-preparation company based in Sacramento. Its founder is a California-registered and bonded Legal Document Assistant (LDA Reg. No. 2026-010, Sacramento County, expires 09/27/2028) and Immigration Consultant. Imverica provides remote document preparation throughout California in English, Russian, Ukrainian, and Spanish. Imverica has more than 10 years of immigration-document preparation experience, including prior paralegal work under the direction of California-licensed attorneys. Documents are prepared only at the client\'s specific direction; Imverica does not provide legal advice.',
  knowsAbout: [
    'USCIS immigration form preparation',
    'U4U Uniting for Ukraine re-parole document preparation',
    'TPS document preparation',
    'Work permit (I-765) document preparation',
    'Green card and adjustment of status (I-485) document preparation',
    'Family-based petition (I-130) document preparation',
    'Citizenship (N-400) document preparation',
    'Paralegal support for attorneys in immigration court (EOIR) cases',
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

/** Stable site-name entity linked to the canonical organization. */
export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://imverica.com/#website',
  url: 'https://imverica.com/',
  name: 'Imverica Legal Solutions',
  alternateName: 'Imverica',
  publisher: { '@id': 'https://imverica.com/#organization' }
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
