#!/usr/bin/env node
'use strict';

/**
 * Remove county templates that can be safely loaded from their official URL at
 * generation time. The updater intentionally caches every fillable PDF so QA
 * can run offline; this post-QA step keeps only malformed/encrypted exceptions.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_FILE = path.join(ROOT, 'assets/form-cache/ca-local-court-manifest.json');
const CACHE_DIR = path.join(ROOT, 'assets/form-cache/ca-local-court');
const PUBLIC_DIR = path.join(ROOT, 'astro-site/public/ca-local-templates');

async function remove(file) {
  try { await fsp.rm(file, { force: true }); } catch {}
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  let removed = 0;
  let retained = 0;
  for (const form of manifest.forms || []) {
    if (form.role !== 'prepare') continue;
    const relative = path.join(form.countySlug, `${form.slug}.pdf`);
    if (form.sourceRuntimeCompatible) {
      await Promise.all([remove(path.join(CACHE_DIR, relative)), remove(path.join(PUBLIC_DIR, relative))]);
      form.cachedTemplate = null;
      removed += 1;
    } else {
      form.cachedTemplate = `ca-local-templates/${form.countySlug}/${form.slug}.pdf`;
      retained += 1;
    }
  }
  manifest.cachedExceptionCount = retained;
  manifest.runtimeSourceCount = removed;
  await fsp.writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Local court cache optimized: ${removed} official-source forms, ${retained} cached exceptions`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
