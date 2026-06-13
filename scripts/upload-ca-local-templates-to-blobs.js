#!/usr/bin/env node
'use strict';

/**
 * Upload the decrypted local county court templates to a Netlify Blobs store so
 * they live on Netlify (server-side), NOT in git and NOT on anyone's laptop.
 *
 * Store:  ca-local-templates
 * Key:    <countySlug>/<slug>      (matches loadLocalCourtTemplate lookup)
 *
 * The deployed function reads this store with implicit Netlify context (no
 * token needed at runtime). This script writes from a workstation using the
 * Netlify CLI's stored token (or NETLIFY_AUTH_TOKEN) + the site id.
 *
 * Resumable: skips keys already present. Run again to fill gaps.
 *
 *   node scripts/upload-ca-local-templates-to-blobs.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const SITE_ID = process.env.NETLIFY_SITE_ID || '491d3de4-1b2d-4412-bc6e-84032ea06967';
const SRC = path.resolve(__dirname, '..', 'astro-site/public/ca-local-templates');
const CONCURRENCY = 12;

function cliToken() {
  if (process.env.NETLIFY_AUTH_TOKEN) return process.env.NETLIFY_AUTH_TOKEN;
  for (const c of [
    path.join(os.homedir(), 'Library/Preferences/netlify/config.json'),
    path.join(os.homedir(), '.config/netlify/config.json')
  ]) {
    try {
      const j = JSON.parse(fs.readFileSync(c, 'utf8'));
      const u = Object.values(j.users || {})[0] || {};
      const t = (u.auth && u.auth.token) || j.token;
      if (t) return t;
    } catch { /* next */ }
  }
  return '';
}

function listTemplates() {
  const out = [];
  for (const county of fs.readdirSync(SRC)) {
    const dir = path.join(SRC, county);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.pdf')) out.push({ key: `${county}/${file.replace(/\.pdf$/, '')}`, file: path.join(dir, file) });
    }
  }
  return out;
}

async function mapLimit(items, limit, fn) {
  const results = []; let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx], idx); }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const token = cliToken();
  if (!token) throw new Error('No Netlify token (set NETLIFY_AUTH_TOKEN or log in with `netlify login`).');
  const { getStore } = require('@netlify/blobs');
  const store = getStore({ name: 'ca-local-templates', siteID: SITE_ID, token });

  const all = listTemplates();
  console.log(`templates on disk: ${all.length}`);

  // Resume: which keys already exist?
  let existing = new Set();
  try {
    const { blobs } = await store.list();
    existing = new Set((blobs || []).map((b) => b.key));
  } catch { /* first run / list unsupported — upload all */ }
  const todo = all.filter((t) => !existing.has(t.key));
  console.log(`already in Blobs: ${existing.size} · to upload: ${todo.length}`);

  let done = 0, failed = 0;
  await mapLimit(todo, CONCURRENCY, async (t) => {
    try {
      await store.set(t.key, fs.readFileSync(t.file));
      if (++done % 200 === 0) console.log(`  uploaded ${done}/${todo.length}`);
    } catch (e) { failed++; if (failed <= 10) console.error('  FAIL', t.key, e.message); }
  });
  console.log(`\nuploaded: ${done} · failed: ${failed} · total now: ${existing.size + done}/${all.length}`);
  if (failed) process.exit(1);
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
