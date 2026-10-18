// Runs after `astro build` (npm "postbuild"). iCloud and Finder leave
// conflict copies such as "index 2.html", "logo 3.png" or "page copy.astro"
// next to the real files. They are git-ignored, but a local build would
// still copy them from public/ (or route them from src/pages/) into dist.
// This removes any such copy from dist and lists copies found in the
// sources so they can be deleted by hand.
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const COPY = /^.+ (?:\d{1,2}|copy(?: \d{1,2})?)(?:\.[^.\s]+)?$/;

function walk(dir, hit) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = path.join(dir, name);
    if (COPY.test(name)) { hit(p); continue; }
    if (fs.statSync(p).isDirectory()) walk(p, hit);
  }
}

const removed = [];
walk(path.join(root, 'dist'), (p) => { fs.rmSync(p, { recursive: true, force: true }); removed.push(path.relative(root, p)); });
const inSources = [];
for (const dir of ['src', 'public']) walk(path.join(root, dir), (p) => inSources.push(path.relative(root, p)));

if (removed.length) console.log(`[strip-duplicates] removed ${removed.length} copy file(s) from dist:\n  ` + removed.join('\n  '));
if (inSources.length) console.warn(`[strip-duplicates] copy files in the sources (delete them):\n  ` + inSources.join('\n  '));
if (!removed.length && !inSources.length) console.log('[strip-duplicates] no iCloud/Finder copies found');
