const fs = require('fs');
const path = require('path');

const QDIR = path.join(__dirname, '..', 'questionnaires');
const MDIR = path.join(__dirname, '..', 'overlay-maps', 'normalized');

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = process.argv.find(a => a.startsWith('--only='));
const onlyForm = ONLY ? ONLY.replace('--only=', '') : null;

function loadMapCoords(form) {
  const mapPath = path.join(MDIR, form + '.json');
  if (!fs.existsSync(mapPath)) return null;
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const byKey = {};
  for (const f of map.fields || []) {
    if (!f.key) continue;
    (byKey[f.key] = byKey[f.key] || []).push({
      page: f.page,
      x: f.x,
      y: f.y,
      mode: f.mode,
      kind: f.kind
    });
  }
  return byKey;
}

function coordsAreDistinct(entries) {
  if (!entries || entries.length < 2) return false;
  const seen = new Set();
  for (const e of entries) {
    const sig = `${e.page}|${Math.round(e.x)}|${Math.round(e.y)}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
  }
  return seen.size >= 2;
}

function processForm(file) {
  const form = file.replace('.questionnaire.json', '');
  if (onlyForm && form !== onlyForm) return null;
  const qPath = path.join(QDIR, file);
  const q = JSON.parse(fs.readFileSync(qPath, 'utf8'));
  const mapCoords = loadMapCoords(form);
  if (!mapCoords) return { form, status: 'NO_MAP' };

  const seen = new Set();
  let removed = 0;
  const report = [];
  const ambiguous = [];

  for (let pi = 0; pi < (q.pages || []).length; pi++) {
    const page = q.pages[pi];
    const newFields = [];
    for (let fi = 0; fi < (page.fields || []).length; fi++) {
      const f = page.fields[fi];
      if (!seen.has(f.key)) {
        seen.add(f.key);
        newFields.push(f);
        continue;
      }
      // duplicate. Check if map has distinct coordinates for this key
      const entries = mapCoords[f.key] || [];
      if (coordsAreDistinct(entries)) {
        // safe to remove from questionnaire — PDF will still fill all positions
        removed++;
        report.push({ key: f.key, page: page.page, mapPositions: entries.length });
      } else {
        // ambiguous: same coordinates in map, or only one entry. Keep it, flag for review.
        newFields.push(f);
        ambiguous.push({ key: f.key, page: page.page, mapEntries: entries.length });
      }
    }
    page.fields = newFields;
  }

  const result = { form, removed, report, ambiguous };

  if (removed > 0 && !DRY_RUN) {
    fs.writeFileSync(qPath, JSON.stringify(q, null, 2));
    result.status = 'WRITTEN';
  } else if (removed > 0) {
    result.status = 'DRY_RUN_WOULD_WRITE';
  } else {
    result.status = ambiguous.length ? 'AMBIGUOUS_ONLY' : 'CLEAN';
  }
  return result;
}

function main() {
  const files = fs.readdirSync(QDIR)
    .filter(f => f.endsWith('.questionnaire.json') && !f.includes(' 2'));
  const results = [];
  for (const f of files) {
    const r = processForm(f);
    if (r) results.push(r);
  }
  let totalRemoved = 0;
  results.forEach(r => {
    if (r.removed > 0 || r.ambiguous.length > 0 || r.status === 'NO_MAP') {
      console.log(`${r.form}: ${r.status} | removed=${r.removed} | ambiguous=${r.ambiguous.length}`);
      r.report.forEach(x => console.log(`  REMOVE ${x.key} (qpage ${x.page}, map has ${x.mapPositions} positions)`));
      r.ambiguous.forEach(x => console.log(`  KEEP   ${x.key} (qpage ${x.page}, ambiguous: map has ${x.mapEntries} entries, not distinct)`));
      totalRemoved += r.removed;
    }
  });
  console.log('\nTotal forms processed:', results.length);
  console.log('Total fields removed:', totalRemoved);
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'WROTE FILES');
}

main();
