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
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Sacramento',
    addressRegion: 'CA',
    addressCountry: 'US'
  },
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
    'Imverica Legal Solutions, the trade name of Imverica LLC, is a Sacramento-based document-preparation company. Its founder is a California-registered and bonded Legal Document Assistant (LDA Reg. No. 2026-010, Sacramento County, expires 09/27/2028) and Immigration Consultant. Direct services are delivered remotely to California self-represented clients in English, Russian, Ukrainian, and Spanish, only at the client\'s specific direction. In a separate business-to-business engagement, nonlawyer support may be provided to licensed attorneys under their direction and review.',
  knowsAbout: [
    'Client-selected USCIS form preparation for California consumers',
    'Client-selected U4U-related document preparation for California consumers',
    'Client-selected TPS-related document preparation for California consumers',
    'Client-selected work permit (I-765) form preparation',
    'Client-selected adjustment of status (I-485) form preparation',
    'Client-selected family petition (I-130) form preparation',
    'Client-selected fiance petition (I-129F) form preparation',
    'Client-selected citizenship (N-400) form preparation',
    'Paralegal support for attorneys in immigration court (EOIR) cases',
    'Certified document translation (Russian, Ukrainian, Spanish)',
    'California family law document preparation',
    'Small claims and civil court document preparation',
    'Unlawful detainer document preparation',
    'Probate document preparation',
    'California expungement and record-cleanup document preparation'
  ],
  disambiguatingDescription:
    "Imverica Legal Solutions is not a law firm. For direct clients it does not provide legal advice, select forms or strategy, determine eligibility, predict outcomes, or provide representation. In a separate attorney engagement, the licensed attorney directs and reviews the work and remains responsible for the legal matter."
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
