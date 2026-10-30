// Forms the client portal can prepare with its own question-by-question
// wizard and PDF draft, built at deploy time from the same rules the portal
// uses (USCIS: netlify/functions/uscis-flow-catalog.js; California courts:
// lib/ca-all-court-catalog.js). The public "Continue" / "Start my ..."
// buttons send these forms straight to the wizard (scripts/portal-wizard.ts).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { APIRoute } from 'astro';

function portalForms(): { uscis: string[]; court: string[] } {
  const root = [process.cwd(), path.resolve(process.cwd(), '..')]
    .find((dir) => fs.existsSync(path.join(dir, 'netlify/functions/uscis-flow-catalog.js')));
  if (!root) return { uscis: [], court: [] };
  const load = createRequire(path.join(root, 'package.json'));
  const uscis: string[] = load('./netlify/functions/uscis-flow-catalog.js').preparableCodes();
  const court: string[] = load('./netlify/functions/lib/ca-all-court-catalog.js')
    .listPreparableAllCourtForms()
    .map((form: { code: string }) => String(form.code).toUpperCase());
  return { uscis, court: [...new Set(court)] };
}

export const GET: APIRoute = () =>
  new Response(JSON.stringify(portalForms()), { headers: { 'Content-Type': 'application/json' } });
