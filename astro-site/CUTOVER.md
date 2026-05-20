# Astro cutover plan

When the user approves, switch the live site from the legacy
`index.html` at repo root to the Astro build at `astro-site/dist/`.

Do not cut over from a dirty branch unless the only dirty files are
known generated QA artifacts in `answers/`, `payloads/`, or
`.netlify-deploy-archive/`. Do not include those generated artifacts in
the cutover commit.

## Pre-flight checks (do these before flipping)

1. `npm run qa:astro` from the repo root. This runs:
   - public-content parity guardrails
   - `astro check`
   - Astro production build
   - generated-route / sitemap / hreflang / asset checks
2. `cd astro-site && npm run preview -- --port 4321` — open
   `http://localhost:4321/` and click through every landing page,
   verify wizard opens on every CTA, language pills work, contact
   form works, no console errors.
3. Run critical backend / PDF / intake QA from the repo root:
   `npm run qa:uscis-pdf-maps && npm run qa:immigration-flow &&
   npm run qa:i485-flow-coverage && npm run qa:i765-flow-coverage &&
   npm run qa:localization && npm run qa:i485-part9-flow &&
   npm run qa:intake-ui`. All must pass.
4. Confirm `astro-site/public/_redirects` covers every old anchor URL
   that has external backlinks. Rebuild after redirect edits, then run
   `npm run qa:astro` again.
5. Manually verify mobile at 393px width:
   - homepage hero centered
   - language buttons visible
   - wizard opens, persists after accidental outside click / reload
   - address suggestion fills street, city, state, ZIP, country
   - phone shows `+1 (916) 399-3992`
   - no sample client PII in public pages

## Cutover steps (under 5 minutes once approved)

### Step 1 — branch from main

```
git checkout -b astro-cutover
```

### Step 2 — point Netlify at the Astro dist

Edit `netlify.toml` at repo root:

```toml
[build]
  command = "npm --prefix astro-site ci && npm --prefix astro-site run build"
  publish = "astro-site/dist"
  functions = "netlify/functions"
```

The Netlify build will now (a) install Astro deps and (b) build the
Astro project. `netlify/functions/` stays where it is. All
`[[redirects]]` entries in `netlify.toml` continue to work because
they point to `/.netlify/functions/*` which is unchanged.

### Step 3 — confirm functions are still reachable

After the first Netlify deploy, hit `https://imverica.com/api/route?q=test`
and `https://imverica.com/api/immigration-flow?code=I-485` from a
browser or curl. They must respond as before.

### Step 4 — push to main + monitor

```
git checkout main
git merge astro-cutover
git push origin main
```

Watch the Netlify build log. First Astro build on Netlify takes
~30-60 seconds.

### Step 5 — request Google reindex

In Google Search Console:
- URL Inspection on `https://imverica.com/` → Request Indexing
- URL Inspection on each of the 10 landing pages → Request Indexing
- Submit `https://imverica.com/sitemap.xml` under "Sitemaps"

### Step 6 — keep legacy index.html for 2 weeks

Move legacy `index.html` to `legacy/index.html` after the cutover
ships. Keep it untouched for 14 days in case we need a fast rollback
(swap `publish = "astro-site/dist"` back to `publish = "."` and
deploy).

## Rollback (if anything blows up)

```
git revert <cutover-commit-sha>
git push origin main
```

Netlify rebuilds with `publish = "."`, legacy index.html ships
again. Wizard, PDF generation, intake — everything keeps working
because none of those changed.

## What stays untouched across cutover

- `netlify/functions/*.js` — all backend endpoints
- `overlay-maps/`, `questionnaires/`, `payload-schemas/` — all USCIS
  form data
- `scripts/*` — dev / QA tooling
- PDF renderer alignment, font offsets, checkbox offsets, normalized
  maps, and scenario builders
- Current wizard behaviours already ported to Astro must remain:
  address suggestion fill, incremental history rows, structured trips,
  criminal detail follow-up, email validation, phone formatting, modal
  persistence, and interpreter/preparer gating

## What's in scope for a future phase

- Translate the remaining English-only landing pages under `/ru/`,
  `/uk/`, and `/es/`
- Image optimization via Astro Image component
- Code-split the wizard chunk (only load on CTA click, not eagerly)
- Replace `@ts-nocheck` in wizard.ts with proper types
- Visual regression tests via Playwright per route
