const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', 'overlay-maps', 'raw');
const OUT = path.join(__dirname, '..', 'qa-reports', 'semantic-collisions.json');

function originalKeyIndex(originalKey) {
  if (!originalKey) return null;
  const m = originalKey.match(/\[(\d+)\]$/);
  return m ? Number(m[1]) : null;
}

function classify(entry) {
  const { pages, count, indices, kindSet, sameRegion } = entry;
  const pageCount = pages.length;
  const indexCount = indices.length;

  // Benign: header field repeated on every page (1 entry per page, indices 0..N-1, pages contiguous 1..N)
  if (pageCount === count && indexCount === pageCount &&
      Math.max(...pages) - Math.min(...pages) === pageCount - 1) {
    return { category: 'BENIGN_HEADER_REPEAT', priority: 0 };
  }

  // Benign: checkbox/radio group collapsed into options
  if (kindSet.has('checkbox') || kindSet.has('radio')) {
    return { category: 'BENIGN_CHECKBOX_GROUP', priority: 0 };
  }

  // High priority: many positions on a single page (table rows or sibling slots)
  if (pageCount <= 2 && count >= 6) {
    return { category: 'SEMANTIC_TABLE_OR_LIST', priority: 3 };
  }

  // Medium priority: multiple positions across a few pages with distinct indices
  if (count >= 3 && indexCount >= 2 && count > pageCount) {
    return { category: 'SEMANTIC_MULTI_ENTITY', priority: 2 };
  }

  // Low priority: small number of repeats spanning a few pages
  if (count >= 2 && indexCount >= 2) {
    return { category: 'SEMANTIC_MAYBE', priority: 1 };
  }

  return { category: 'OTHER', priority: 0 };
}

function audit(form) {
  const rawPath = path.join(RAW_DIR, form + '.raw.json');
  if (!fs.existsSync(rawPath)) return null;
  const m = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const byKey = {};
  for (const f of m.fields || []) {
    if (!f.key) continue;
    const oidx = originalKeyIndex(f.originalKey);
    (byKey[f.key] = byKey[f.key] || []).push({
      page: f.page,
      oidx,
      kind: f.kind,
      x: f.x,
      y: f.y
    });
  }
  const results = [];
  Object.entries(byKey).forEach(([k, entries]) => {
    if (entries.length < 2) return;
    const indices = [...new Set(entries.map(e => e.oidx).filter(i => i !== null))];
    if (indices.length < 2) return;
    const pages = [...new Set(entries.map(e => e.page))].sort((a, b) => a - b);
    const kindSet = new Set(entries.map(e => e.kind));
    const summary = {
      form,
      key: k,
      count: entries.length,
      pages,
      indices,
      kindSet
    };
    const { category, priority } = classify(summary);
    if (priority === 0) return;
    delete summary.kindSet;
    summary.category = category;
    summary.priority = priority;
    results.push(summary);
  });
  return results;
}

function main() {
  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.raw.json') && !f.includes(' 2'));
  const all = [];
  for (const f of files) {
    const form = f.replace('.raw.json', '');
    if (['i-800', 'i-800a'].includes(form)) continue; // already fixed
    const issues = audit(form) || [];
    all.push(...issues);
  }
  all.sort((a, b) => b.priority - a.priority || b.count - a.count);

  // Per-form summary
  const byForm = {};
  for (const i of all) {
    if (!byForm[i.form]) byForm[i.form] = { high: 0, med: 0, low: 0, total: 0, examples: [] };
    byForm[i.form].total++;
    if (i.priority === 3) byForm[i.form].high++;
    else if (i.priority === 2) byForm[i.form].med++;
    else byForm[i.form].low++;
    if (byForm[i.form].examples.length < 3) byForm[i.form].examples.push(`${i.key}×${i.count}`);
  }
  const ranked = Object.entries(byForm)
    .map(([form, s]) => ({ form, ...s }))
    .sort((a, b) => b.high - a.high || b.med - a.med);

  console.log('Forms with real semantic collisions (excluding header repeats and checkbox groups):');
  console.log('Form'.padEnd(12), 'High', 'Med', 'Low', 'Examples');
  console.log('-'.repeat(80));
  ranked.slice(0, 25).forEach(r => {
    console.log(r.form.padEnd(12), String(r.high).padStart(4), String(r.med).padStart(4), String(r.low).padStart(4), r.examples.join(', '));
  });
  console.log();
  console.log('Total flagged collisions:', all.length, 'across', ranked.length, 'forms');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), issues: all, byForm: ranked }, null, 2));
  console.log('Report:', OUT);
}

main();
