/**
 * Apple-style global-nav flyouts (v2 design). One entry per top-level nav
 * item; the item label itself comes from NAV in i18n.ts.
 *
 * Link targets:
 *   slug — an internal page; rendered through localizedPathSafe so RU/UA/MX
 *          visitors stay in their language where the page exists.
 *   href — used verbatim (tel:, sms:, mailto:, external, /account.html).
 *          Hrefs starting with "/#" get the locale prefix (homepage intake).
 *
 * Column 0 of every section is the "big" column (large bold links), the
 * rest are small link lists — same hierarchy as apple.com's flyouts.
 * Labels are English-only for the preview; localize after sign-off.
 */
export type MegaLink = { label: string; slug?: string; href?: string };
export type MegaColumn = { heading: string; links: MegaLink[] };
export type MegaKey =
  | 'uscis' | 'family' | 'civil' | 'criminal' | 'business'
  | 'pricing' | 'forAttorneys' | 'about';
export type MegaSection = { key: MegaKey; slug: string; columns: MegaColumn[] };

export const MEGA_NAV: MegaSection[] = [
  {
    key: 'uscis',
    slug: '/immigration',
    columns: [
      {
        heading: 'Explore Immigration',
        links: [
          { label: 'All Immigration Services', slug: '/immigration' },
          { label: 'Green Card', slug: '/i-485-help' },
          { label: 'Citizenship', slug: '/n-400-citizenship-help' },
          { label: 'Family Petition', slug: '/i-130-family-petition' },
          { label: 'Work Permit', slug: '/i-765-work-permit-help' },
          { label: 'Asylum', slug: '/i-589-asylum-help' },
          { label: 'Immigration Court', slug: '/eoir-immigration-court' }
        ]
      },
      {
        heading: 'Humanitarian',
        links: [
          { label: 'Uniting for Ukraine (U4U)', slug: '/u4u' },
          { label: 'TPS', slug: '/tps' },
          { label: 'U Visa', slug: '/u-visa-help' },
          { label: 'VAWA Self-Petition', slug: '/vawa-self-petition' },
          { label: 'Change of Status · I-539', slug: '/i-539-change-of-status' }
        ]
      },
      {
        heading: 'More USCIS Forms',
        links: [
          { label: 'Green Card Renewal · I-90', slug: '/i-90-green-card-renewal' },
          { label: 'Travel Document · I-131', slug: '/i-131-travel-document' },
          { label: 'Returning Resident · I-131A', slug: '/i-131a-returning-resident' },
          { label: 'Affidavit of Support · I-864', slug: '/i-864-affidavit-of-support' },
          { label: 'Household Member · I-864A', slug: '/i-864a-household-member' },
          { label: 'Medical Exam · I-693', slug: '/i-693-medical-examination' },
          { label: 'Remove Conditions · I-751', slug: '/i-751-remove-conditions' },
          { label: 'Document Review', slug: '/uscis-document-review' }
        ]
      },
      {
        heading: 'Immigration Court',
        links: [
          { label: 'Appeal to the BIA · EOIR-29', slug: '/eoir-29-notice-of-appeal' },
          { label: 'Cancellation (LPR) · EOIR-42A', slug: '/eoir-42a-cancellation-lpr' },
          { label: 'Cancellation (non-LPR) · EOIR-42B', slug: '/eoir-42b-cancellation-non-lpr' },
          { label: 'Suspension · EOIR-40', slug: '/eoir-40-suspension-of-deportation' }
        ]
      }
    ]
  },
  {
    key: 'family',
    slug: '/fl',
    columns: [
      {
        heading: 'Explore Family Law',
        links: [
          { label: 'All Family Law', slug: '/fl' },
          { label: 'Divorce', slug: '/fl-100-divorce' },
          { label: 'Response to Divorce', slug: '/fl-120-divorce-response' },
          { label: 'Request for Order', slug: '/fl-300-request-for-order' },
          { label: 'Restraining Orders', slug: '/california-restraining-orders' }
        ]
      },
      {
        heading: 'Disclosures & Filings',
        links: [
          { label: 'Income & Expense · FL-150', slug: '/fl-150-income-expense-declaration' },
          { label: 'Property Declaration · FL-160', slug: '/fl-160-property-declaration' },
          { label: 'Custody Jurisdiction · FL-105', slug: '/fl-105-uccjea' },
          { label: 'Court Fee Waiver · FW-001', slug: '/fw-001-fee-waiver' }
        ]
      },
      {
        heading: 'Good to Know',
        links: [
          { label: 'What a Legal Document Assistant Does', slug: '/lda' },
          { label: 'Flat-Fee Pricing', slug: '/pricing' },
          { label: 'Schedule a Consultation', slug: '/schedule' }
        ]
      }
    ]
  },
  {
    key: 'civil',
    slug: '/sc',
    columns: [
      {
        heading: 'Explore Civil',
        links: [
          { label: 'All Civil & Small Claims', slug: '/sc' },
          { label: 'Small Claims', slug: '/sc-100-plaintiff-claim' },
          { label: 'Demand Letter', slug: '/demand-letter' },
          { label: 'Eviction', slug: '/california-unlawful-detainer' },
          { label: 'Name Change', slug: '/california-name-change' },
          { label: 'Probate', slug: '/california-probate' }
        ]
      },
      {
        heading: 'Small Claims Forms',
        links: [
          { label: "Defendant's Claim · SC-120", slug: '/sc-120-defendant-claim' },
          { label: 'Proof of Service · SC-104', slug: '/sc-104-proof-of-service' },
          { label: 'Memorandum of Costs · SC-133', slug: '/sc-133-memorandum-of-costs' },
          { label: 'Installment Payments · SC-140', slug: '/sc-140-installments' }
        ]
      },
      {
        heading: 'Collect a Judgment',
        links: [
          { label: 'Wage Garnishment · WG-001', slug: '/wg-001-wage-garnishment' },
          { label: 'Abstract of Judgment · EJ-001', slug: '/ej-001-abstract-of-judgment' },
          { label: 'Court Fee Waiver · FW-001', slug: '/fw-001-fee-waiver' }
        ]
      }
    ]
  },
  {
    key: 'criminal',
    slug: '/criminal',
    columns: [
      {
        heading: 'Explore Record Clearing',
        links: [
          { label: 'All Record Clearing', slug: '/criminal' },
          { label: 'Expungement', slug: '/california-expungement' },
          { label: 'Start a Record-Clearing Packet', href: '/#get-started?service=record-clearing' }
        ]
      },
      {
        heading: 'Petitions We Prepare',
        links: [
          { label: 'Misdemeanor & Felony Dismissal', slug: '/california-expungement' },
          { label: 'Felony → Misdemeanor Reduction', slug: '/criminal' },
          { label: 'Early Probation Termination', slug: '/criminal' },
          { label: 'Arrest & Juvenile Record Sealing', slug: '/criminal' },
          { label: 'Prop 64 Cannabis Relief', slug: '/criminal' }
        ]
      },
      {
        heading: 'Good to Know',
        links: [
          { label: 'Court Fee Waiver · FW-001', slug: '/fw-001-fee-waiver' },
          { label: 'What a Legal Document Assistant Does', slug: '/lda' }
        ]
      }
    ]
  },
  {
    key: 'business',
    slug: '/business',
    columns: [
      {
        heading: 'Explore Business',
        links: [
          { label: 'All Business Filings', slug: '/business' },
          { label: 'Form an LLC', slug: '/llc-1-form-an-llc' },
          { label: 'Incorporate', slug: '/arts-gs-incorporation' },
          { label: 'DBA', slug: '/fbn-dba' },
          { label: 'EIN', slug: '/ss-4-ein' }
        ]
      },
      {
        heading: 'Stay Compliant',
        links: [
          { label: 'LLC Statement · LLC-12', slug: '/llc-12-statement-of-information' },
          { label: 'Corporation Statement · SI-550', slug: '/si-550-corporation-statement' },
          { label: 'Operating Agreement', slug: '/operating-agreement' },
          { label: 'Foreign LLC · LLC-1A', slug: '/llc-1a-foreign-llc' }
        ]
      }
    ]
  },
  {
    key: 'pricing',
    slug: '/pricing',
    columns: [
      {
        heading: 'Pricing',
        links: [
          { label: 'All Flat-Fee Prices', slug: '/pricing' },
          { label: 'Start Your Case', href: '/#get-started' },
          { label: 'Schedule a Consultation', slug: '/schedule' }
        ]
      },
      {
        heading: 'Good to Know',
        links: [
          { label: 'Court Fee Waivers', slug: '/fw-001-fee-waiver' },
          { label: 'What a Legal Document Assistant Does', slug: '/lda' },
          { label: 'Client Reviews', slug: '/testimonials' }
        ]
      }
    ]
  },
  {
    key: 'forAttorneys',
    slug: '/for-attorneys',
    columns: [
      {
        heading: 'For Attorneys',
        links: [
          { label: 'Overflow Document Preparation', slug: '/for-attorneys' },
          { label: 'Send a Sample Matter', href: '/#get-started?topic=for-attorneys' },
          { label: 'Book a Partnership Call', slug: '/schedule' }
        ]
      },
      {
        heading: 'Practice Areas',
        links: [
          { label: 'USCIS & EOIR', slug: '/immigration' },
          { label: 'Family Law', slug: '/fl' },
          { label: 'Civil & Small Claims', slug: '/sc' },
          { label: 'Business Filings', slug: '/business' }
        ]
      }
    ]
  },
  {
    key: 'about',
    slug: '/about',
    columns: [
      {
        heading: 'About Imverica',
        links: [
          { label: 'About Us', slug: '/about' },
          { label: 'Client Reviews', slug: '/testimonials' },
          { label: 'What Is an LDA?', slug: '/lda' }
        ]
      },
      {
        heading: 'Contact',
        links: [
          { label: 'Call +1 (916) 399-3992', href: 'tel:+19163993992' },
          { label: 'Message Us', href: 'sms:+19163993992' },
          { label: 'Schedule a Consultation', slug: '/schedule' },
          { label: 'Telegram', href: 'https://t.me/imverica' },
          { label: 'info@imverica.com', href: 'mailto:info@imverica.com' }
        ]
      },
      {
        heading: 'Company',
        links: [
          { label: 'Company Facts & Registration', slug: '/about-imverica-legal-solutions' },
          { label: 'Client Portal', href: '/account.html' }
        ]
      }
    ]
  }
];
