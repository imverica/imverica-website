# Astro cutover plan

When the user approves, switch the live site from the legacy
`index.html` at repo root to the Astro build at `astro-site/dist/`.

## Pre-flight checks (do these before flipping)

1. `cd astro-site && npx astro build` — build succeeds, no errors.
2. `cd astro-site && npx astro preview --port 4321` — open
   `http://localhost:4321/` and click through every landing page,
   verify wizard opens on every CTA, language pills work, contact
   form works, no console errors.
3. Run all backend QA: `node scripts/qa-uscis-pdf-maps.js && node
   scripts/qa-priority-forms.js && node scripts/qa-i485-flow-coverage.js
   && node scripts/qa-i765-flow-coverage.js && node scripts/qa-localization.js
   && node scripts/qa-i485-part9-flow.js`. All must pass.
4. Confirm `astro-site/dist/_redirects` covers every old anchor URL
   that has external backlinks.

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
- The wizard's behaviour (lifted byte-for-byte into Astro)
- ChatGPT's Track D work (address autocomplete, employment history) —
  those edits to `index.html` won't ship after cutover unless we
  also port them to the Astro wizard. Coordinate with him before
  cutting over.

## What's in scope for a future Phase 5

- Translated content for `/ru/`, `/uk/`, `/es/` route trees
- hreflang link rels in `<head>` once translations exist
- Image optimization via Astro Image component
- Code-split the wizard chunk (only load on CTA click, not eagerly)
- Replace `@ts-nocheck` in wizard.ts with proper types
- Visual regression tests via Playwright per route
