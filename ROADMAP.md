# Imverica Product Roadmap

Current planning date: May 2026.

Goal: build Imverica as a multilingual legal document preparation and automation platform, not just a static website.

Core product flow:

AI finder -> form found -> guided preparation -> progress questions -> review answers -> price/payment -> generated draft PDF

## Product Principles

- AI may help identify possible forms, explain questions, detect language, and normalize answers.
- AI must not give legal advice, decide eligibility, or hallucinate form content.
- PDF generation must be deterministic: official PDF source, form schema, field mapping, validation rules, audit trail.
- Client-facing language must stay within document-preparation boundaries.
- Every new automated form should be added through repeatable assets:
  - schema JSON
  - PDF mapping JSON
  - validation rules
  - price/package metadata

## May 2026: Foundation Before LDA

Primary goal: build the automation engine and one real end-to-end flow.

1. Stabilize current site and AI finder.
2. Keep multilingual flow for EN/RU/UK/ES.
3. Replace generic intake with DocDraft-style wizard:
   - one question per screen
   - visible progress percentage
   - previous/next navigation
   - form-specific questions
4. Build the first end-to-end form, preferably SC-100:
   - `schemas/sc-100.schema.json`
   - `mappings/sc-100.map.json`
   - `validations/sc-100.rules.json`
5. Add backend document generation:
   - load official/current PDF
   - collect structured answers
   - fill PDF draft with `pdf-lib` or coordinate mapping
6. Add Stripe test checkout.
7. Add simple admin/order view:
   - client
   - form
   - status
   - payment status
   - missing info
   - generated PDF

Target by end of May:

SC-100 demo flow from user query to draft PDF.

## June 2026: LDA Launch

Assumption: Legal Document Assistant registration/license is received in June 2026.

Primary goal: launch paid document preparation within proper LDA boundaries.

1. Update site language:
   - LDA status
   - registration/county details if applicable
   - correct legal disclaimers
2. Turn on paid workflows.
3. Launch first paid flows:
   - SC-100
   - FW-001
   - I-765
4. Add client-facing completion:
   - payment complete
   - draft PDF generated
   - download/review
   - upload documents
5. Start collecting real conversion metrics:
   - AI finder queries
   - started flows
   - completed flows
   - paid orders
   - average order value

Target by end of June:

First real paid orders through the platform.

## July 2026: Productization

Primary goal: turn the site into a repeatable product, not manual custom work.

1. Add 3-5 more high-value forms:
   - FL-300
   - FL-100
   - CH-100
   - I-90
   - I-485 or I-765 expansion
2. Add package logic:
   - possible related forms
   - client-directed package selection
   - no legal advice language
3. Build client portal light:
   - order status
   - uploaded files
   - generated PDFs
   - messages or notes
4. Build internal QA states:
   - draft started
   - missing info
   - ready for review
   - paid
   - PDF generated
   - delivered
5. Improve admin view:
   - filter by form/status
   - export answers
   - resend payment link

Target by end of July:

Repeatable schema/mapping engine with multiple forms and a usable internal workflow.

## August 2026: Startup MVP

Primary goal: make the product demo-ready for law firms, buyers, or investors.

1. Have 8-12 automated forms with schemas and mappings.
2. Stripe live checkout.
3. Admin dashboard with metrics.
4. Basic analytics:
   - visitors
   - AI finder queries
   - started flows
   - completed flows
   - paid orders
   - revenue
5. SEO pages:
   - `/forms/sc-100`
   - `/forms/i-765`
   - `/forms/fl-300`
   - `/forms/fw-001`
6. Build a buyer demo:
   - user types "смол клейм"
   - AI finds SC-100
   - wizard asks form-specific questions
   - client reviews answers
   - payment
   - draft PDF generated

Target by end of August:

A sellable MVP that can be positioned as multilingual intake + document automation for California law firms, LDAs, and immigration/court document preparation providers.

## Buyer Positioning

Imverica should be sellable as:

Multilingual client intake + document automation + lead conversion system for California immigration and court forms.

Potential buyer groups:

- California immigration law firms
- family law firms
- LDA/document preparation offices
- multilingual community-serving firms
- legal tech/document automation companies
- private buyers/search funds if revenue is stable

Law firm pitch:

"We built a multilingual intake and document automation system for California immigration and court forms. It converts community-language leads into structured legal intakes and draft document packages for attorney review."

## Valuation Milestones

Current stage: prototype to early MVP.

Potential exit ranges depend on revenue and traction:

- prototype/no revenue: low value, mostly code and concept
- working MVP + first clients: stronger small acquisition potential
- $10k MRR: possible small SaaS acquisition conversation
- $50k MRR: strategic buyers become more realistic
- $100k+ MRR: serious acquisition potential if growth and retention are strong

The main asset value is not the website. It is the repeatable engine:

- official form catalog
- multilingual AI intake
- schemas
- PDF mappings
- validation rules
- payment flow
- client/order data
- audit trail

