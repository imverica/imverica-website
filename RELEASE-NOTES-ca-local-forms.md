# Release — California court forms: all 58 counties

_Shipped 2026-06-13_

Imverica now covers court forms for **every California county**, with a clear
line between statewide and local forms and built-in protection against handing
a client the wrong form.

## What's new for users

- **All 58 California counties covered.** Search or browse local Superior Court
  forms for any county — 5,962 local forms indexed alongside the statewide
  Judicial Council catalog.

- **Statewide vs. local, always labeled.** Every form shows whether it's a
  **Statewide Judicial Council form** or a **Local county Superior Court form**
  (with the county named), so there's never confusion about which court a form
  belongs to.

- **Fillable forms generate where supported.** When a form has client-fillable
  fields, Imverica prepares a draft you can review. Where a form is reference
  only, the site links straight to the **official court source** instead of
  guessing.

- **Right form, right county.** Criminal post-judgment requests were verified
  across all 58 counties for four matter types — **probation motion, record
  cleanup, resentencing, and warrant** — with **0 wrong forms** returned. When a
  county has no specific local form, the site says so plainly and continues the
  intake rather than substituting an unrelated form.

## What stays the same

- Document preparation at the client's direction — not legal advice, and not a
  determination of which form a particular case requires.
- USCIS / EOIR immigration flows and the existing statewide California forms are
  unchanged.

## Under the hood (for the record)

- Local templates are hosted in Netlify Blobs (not in the repository); the
  runtime loads them server-side, with an official-source + checksum fallback.
- Metadata was normalized (form codes, titles, categories) so search results
  read cleanly.
- Routing is guarded by an automated 58-county sweep across all four relief
  types in the test suite.
