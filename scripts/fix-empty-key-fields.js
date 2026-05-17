const fs = require('fs');
const path = require('path');

const FORMS = ['i-730', 'i-800'];

function extractName(originalKey) {
  // originalKey looks like "form1[0].#subform[9].TelephoneNumber\.[2]"
  // The escaped \. inside the field name breaks naive splitting on dots.
  // Strategy: find the last identifier-like token that precedes the final [N] index.
  if (!originalKey) return null;
  // Drop trailing [N]
  const noIdx = originalKey.replace(/\[\d+\]$/, '');
  // Drop trailing escaped period if present
  const noEsc = noIdx.replace(/\\\.$/, '').replace(/\\\.\s*$/, '');
  // Take everything after the last unescaped dot
  const parts = noEsc.split(/(?<!\\)\./);
  const tail = parts[parts.length - 1] || '';
  const m = tail.match(/([A-Za-z][A-Za-z0-9_]*)/);
  return m ? m[1] : null;
}

function processMap(form, mapPath) {
  if (!fs.existsSync(mapPath)) return { changed: 0 };
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  let changed = 0;
  const renames = []; // {page, x, y, oldKey, newKey, originalKey}
  for (const f of map.fields || []) {
    if (f.key && f.key !== '') continue;
    const base = extractName(f.originalKey);
    if (!base) continue;
    const newKey = `P${f.page}_${base}`;
    renames.push({ page: f.page, x: f.x, y: f.y, oldKey: f.key || '', newKey, originalKey: f.originalKey });
    f.key = newKey;
    changed++;
  }
  if (changed > 0) {
    fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
  }
  return { changed, renames };
}

function processQuestionnaire(form, qPath, mapRenames) {
  const q = JSON.parse(fs.readFileSync(qPath, 'utf8'));
  let changed = 0;
  // Group renames by page
  const byPage = {};
  for (const r of mapRenames) (byPage[r.page] = byPage[r.page] || []).push(r);

  for (const page of q.pages || []) {
    const candidates = byPage[page.page] || [];
    if (!candidates.length) continue;
    let candidateIdx = 0;
    for (const f of page.fields || []) {
      if (f.key && f.key !== '') continue;
      if (candidateIdx >= candidates.length) break;
      const r = candidates[candidateIdx++];
      f.key = r.newKey;
      f.label = r.newKey.replace(/^P\d+_/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
      changed++;
    }
  }
  if (changed > 0) {
    fs.writeFileSync(qPath, JSON.stringify(q, null, 2));
  }
  return changed;
}

function main() {
  for (const form of FORMS) {
    const normPath = path.join('overlay-maps', 'normalized', form + '.json');
    const rawPath = path.join('overlay-maps', 'raw', form + '.raw.json');
    const qPath = path.join('questionnaires', form + '.questionnaire.json');

    const normRes = processMap(form, normPath);
    const rawRes = processMap(form, rawPath);
    const qChanges = processQuestionnaire(form, qPath, normRes.renames);

    console.log(`${form}: normalized=${normRes.changed} raw=${rawRes.changed} questionnaire=${qChanges}`);
    normRes.renames.forEach(r => console.log(`  page ${r.page}: "" -> ${r.newKey}`));
  }
}

main();
