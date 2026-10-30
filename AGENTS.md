# Rules for coding agents (Codex and others)

The owner set these rules. Do not change any item below unless the owner
explicitly asks for that exact change in the current task. "Accuracy",
"SEO" or "AI citation" cleanups are not such a request.

## Homepage stats strip

- Leave `astro-site/src/components/StatsStrip.astro` and the `STATS`
  labels in `astro-site/src/data/i18n.ts` as they are: the numbers, the
  growth formula (forms from 734 on 05/25/2026, priority flows from 18),
  the labels in all 4 languages and the odometer animation.

## Founder block

- Keep `astro-site/src/components/FounderBlock.astro` on the four About
  pages (`about.astro`, `ru/about.astro`, `ua/about.astro`,
  `mx/about.astro`), with `public/img/about/founder.webp` and
  `public/img/about/founder-name.png`.
- The founder's name appears on the site only as an image. Never write it
  as text: not in pages, alt text, schema, file names or the chat bot.

## Registration and bond

- The LDA registration (No. 2026-010, Sacramento County, expires
  09/27/2028) and the Immigration Consultant bond (No. 67347671, Western
  Surety Company) are held by the founder personally, not by Imverica LLC.
  Write "Imverica's founder is registered and bonded", never "Imverica LLC
  is registered" or "Imverica LLC is bonded".
- Keep the registrant picture in the footer's LDA note
  (`public/img/legal/registrant.png`, the `registrant` field in
  `astro-site/src/data/footerV2.ts`). The registrant's name and business
  address must never appear as text in the code or on the site.
- The name and address used on court forms come only from the Netlify
  environment variables `LDA_ASSISTANT_NAME` and `LDA_ADDRESS`. Do not add
  defaults for them in code.

## Intake wizard and PDF generation

- Do not remove or reroute the question-by-question wizards and PDF
  generation: `astro-site/src/scripts/wizard.ts`, `IntakeWizard.astro`,
  the USCIS and court wizards in `astro-site/public/account.html`, and the
  `generate-*-pdf` functions.
- "Continue" in the homepage finder and every "Start my ..." / "Start
  your case" button open this question-by-question wizard on the site
  (`window.openIntakeModal` from `wizard.ts`). Do not point them at the
  short request form (`QuickIntakeModal`, reached only from the wizard's
  "Have us call you" button) or at the client portal.

## Deploys

- `.github/workflows/deploy.yml` runs only by hand (`workflow_dispatch`).
  Do not add push or schedule triggers: every deploy costs money.
