// Guard: in a JavaScript regex (without the u flag and \p{L}), \w and \b
// know only Latin letters, so /семейн\w+/ never matches "семейная" and
// /\bвиза/ never matches after a space. Every regex literal that contains
// Cyrillic must spell word letters as [\wа-яёіїєґА-ЯЁІЇЄҐ] and must not put
// \b next to a Cyrillic letter.
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, '..', 'astro-site', 'node_modules', 'typescript'));

const ROOT = path.join(__dirname, '..');
const DIRS = ['netlify/functions', 'astro-site/src'];
const CYR = /[а-яёіїєґА-ЯЁІЇЄҐ]/;
const LETTERS = 'а-яёіїєґА-ЯЁІЇЄҐ';

function files(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(full));
    else if (/\.(js|ts|mjs|cjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const problems = [];
let checked = 0;
for (const file of DIRS.flatMap((d) => files(path.join(ROOT, d)))) {
  const src = fs.readFileSync(file, 'utf8');
  if (!CYR.test(src)) continue;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  (function walk(node) {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      const text = node.getText(sf);
      const body = text.slice(1, text.lastIndexOf('/'));
      if (CYR.test(body)) {
        checked++;
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        const where = `${path.relative(ROOT, file)}:${line}`;
        for (let i = 0; i < body.length; i++) {
          if (body[i] !== '\\') continue;
          const d = body[i + 1];
          if (d === 'w' && !body.startsWith(LETTERS, i + 2)) problems.push(`${where}: bare \\w in a Cyrillic regex`);
          if (d === 'b' && (CYR.test(body[i + 2] || '') || CYR.test(body[i - 1] || ''))) problems.push(`${where}: \\b next to a Cyrillic letter`);
          i++;
        }
      }
    }
    ts.forEachChild(node, walk);
  })(sf);
}

// The patterns must still match real Cyrillic phrases.
const { navigationFor } = require(path.join(ROOT, 'netlify/functions/lib/official-topics.js'));
for (const [q, topic] of [['Семейная петиция', 'family'], ['Малый иск', 'small-claims'], ['разрешение на работу', 'work-permit'], ['Зняття судимості', 'record-clearing']]) {
  if (!navigationFor(q, 'ru').topics.some((t) => t.id === topic)) problems.push(`official-topics: "${q}" should open ${topic}`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`cyrillic regex QA failed: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`cyrillic regex QA passed: ${checked} Cyrillic regex literals checked`);
