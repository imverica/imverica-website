const fs = require('fs');
const path = require('path');

// I-800a (Application for Determination of Suitability to Adopt a Child
// from a Convention Country). Layout:
//   Page 1 [0]   = Applicant (Part 2. Information About You)
//   Page 4 [1]   = Spouse (Part 3. Information About Your Spouse)
//   Page 8 Row1-5 of Table4 = Children currently in the household
const RENAMES = [
  // Applicant (page 1, originalKey index [0])
  { match: { page: 1, key: 'FamilyNameLastName', oidx: 0 }, newKey: 'Applicant_FamilyName',   label: 'Applicant Family Name (Last Name)' },
  { match: { page: 1, key: 'GivenNameFirstName', oidx: 0 }, newKey: 'Applicant_GivenName',    label: 'Applicant Given Name (First Name)' },
  { match: { page: 1, key: 'MiddleName',         oidx: 0 }, newKey: 'Applicant_MiddleName',   label: 'Applicant Middle Name' },
  { match: { page: 1, key: 'OtherNamesUsed',     oidx: 0 }, newKey: 'Applicant_OtherNames1',  label: 'Applicant Other Names Used (1)' },
  { match: { page: 1, key: 'OtherNamesUsed',     oidx: 1 }, newKey: 'Applicant_OtherNames2',  label: 'Applicant Other Names Used (2)' },
  { match: { page: 1, key: 'DateofBirth',        oidx: 0 }, newKey: 'Applicant_DateOfBirth',  label: 'Applicant Date of Birth' },
  { match: { page: 1, key: 'PlaceofBirth',       oidx: 0 }, newKey: 'Applicant_PlaceOfBirth', label: 'Applicant Place of Birth' },

  // Spouse (page 4, originalKey index [1] for the named fields, [2-4] for OtherNamesUsed)
  { match: { page: 4, key: 'FamilyNameLastName', oidx: 1 }, newKey: 'Spouse_FamilyName',      label: 'Spouse Family Name (Last Name)' },
  { match: { page: 4, key: 'GivenNameFirstName', oidx: 1 }, newKey: 'Spouse_GivenName',       label: 'Spouse Given Name (First Name)' },
  { match: { page: 4, key: 'MiddleName',         oidx: 1 }, newKey: 'Spouse_MiddleName',      label: 'Spouse Middle Name' },
  { match: { page: 4, key: 'OtherNamesUsed',     oidx: 2 }, newKey: 'Spouse_OtherNames1',     label: 'Spouse Other Names Used (1)' },
  { match: { page: 4, key: 'OtherNamesUsed',     oidx: 3 }, newKey: 'Spouse_OtherNames2',     label: 'Spouse Other Names Used (2)' },
  { match: { page: 4, key: 'OtherNamesUsed',     oidx: 4 }, newKey: 'Spouse_OtherNames3',     label: 'Spouse Other Names Used (3)' },
  { match: { page: 4, key: 'DateofBirth',        oidx: 1 }, newKey: 'Spouse_DateOfBirth',     label: 'Spouse Date of Birth' },
  { match: { page: 4, key: 'PlaceofBirth',       oidx: 1 }, newKey: 'Spouse_PlaceOfBirth',    label: 'Spouse Place of Birth' },
];

// Child rows on page 8 — originalKey contains "Table4[0].RowN[0]" so we
// need to match on that path component rather than the [N] suffix index.
function childRowFromOriginal(originalKey) {
  if (!originalKey) return null;
  const m = originalKey.match(/Table4\[0\]\.Row(\d+)\[0\]/);
  return m ? Number(m[1]) : null;
}

const CHILD_ROW_RENAMES = [
  { key: 'DateofBirth', newKeyTemplate: 'Child_Row__Row__DateOfBirth', label: 'Child (Row __) Date of Birth' },
];

function originalKeyIndex(originalKey) {
  if (!originalKey) return null;
  const m = originalKey.match(/\[(\d+)\]$/);
  return m ? Number(m[1]) : null;
}

function applyToMap(mapPath) {
  if (!fs.existsSync(mapPath)) return 0;
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  let renamed = 0;
  for (const f of map.fields || []) {
    const oidx = originalKeyIndex(f.originalKey);
    const childRow = childRowFromOriginal(f.originalKey);

    // Handle child-row table fields on page 8
    if (childRow != null && f.key === 'DateofBirth') {
      f.key = `Child_Row${childRow}_DateOfBirth`;
      renamed++;
      continue;
    }

    const rule = RENAMES.find(r =>
      r.match.page === f.page &&
      r.match.key === f.key &&
      r.match.oidx === oidx
    );
    if (rule) {
      f.key = rule.newKey;
      renamed++;
    }
  }
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
  return renamed;
}

function rebuildQuestionnaire(qPath) {
  const q = JSON.parse(fs.readFileSync(qPath, 'utf8'));
  const existing = new Set();
  q.pages.forEach(p => (p.fields || []).forEach(f => existing.add(f.key)));

  const removedOldKeys = new Set([
    'FamilyNameLastName', 'GivenNameFirstName', 'MiddleName',
    'OtherNamesUsed', 'DateofBirth', 'PlaceofBirth'
  ]);
  let removed = 0;
  q.pages.forEach(page => {
    const before = page.fields.length;
    page.fields = page.fields.filter(f => !removedOldKeys.has(f.key));
    removed += before - page.fields.length;
  });

  function ensure(pageNumber, key, label) {
    if (existing.has(key)) return false;
    const page = q.pages.find(p => p.page === pageNumber);
    if (!page) return false;
    if (!page.fields) page.fields = [];
    page.fields.push({ key, label, mode: 'text', type: 'text', defaultValue: '' });
    existing.add(key);
    return true;
  }

  let added = 0;
  for (const r of RENAMES) {
    if (ensure(r.match.page, r.newKey, r.label)) added++;
  }
  // Child rows 1..5 on page 8
  for (let i = 1; i <= 5; i++) {
    if (ensure(8, `Child_Row${i}_DateOfBirth`, `Child #${i} Date of Birth`)) added++;
  }
  fs.writeFileSync(qPath, JSON.stringify(q, null, 2));
  return { removed, added };
}

function rebuildSchema(schemaPath) {
  if (!fs.existsSync(schemaPath)) return { removed: 0, added: 0 };
  const s = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const removedOldKeys = new Set([
    'FamilyNameLastName', 'GivenNameFirstName', 'MiddleName',
    'OtherNamesUsed', 'DateofBirth', 'PlaceofBirth'
  ]);
  let removed = 0, added = 0;
  for (const pageNum of Object.keys(s.pages || {})) {
    const before = s.pages[pageNum].length;
    s.pages[pageNum] = s.pages[pageNum].filter(f => !removedOldKeys.has(f.key));
    removed += before - s.pages[pageNum].length;
  }
  function addField(pageStr, key) {
    if (!s.pages[pageStr]) s.pages[pageStr] = [];
    if (!s.pages[pageStr].some(f => f.key === key)) {
      s.pages[pageStr].push({ key, mode: 'text', kind: 'text', defaultValue: '' });
      added++;
    }
  }
  for (const r of RENAMES) addField(String(r.match.page), r.newKey);
  for (let i = 1; i <= 5; i++) addField('8', `Child_Row${i}_DateOfBirth`);
  fs.writeFileSync(schemaPath, JSON.stringify(s, null, 2));
  return { removed, added };
}

function main() {
  const root = path.join(__dirname, '..');
  const normMap = path.join(root, 'overlay-maps', 'normalized', 'i-800a.json');
  const rawMap = path.join(root, 'overlay-maps', 'raw', 'i-800a.raw.json');
  const qPath = path.join(root, 'questionnaires', 'i-800a.questionnaire.json');
  const schemaPath = path.join(root, 'payload-schemas', 'i-800a.schema.json');

  const norm = applyToMap(normMap);
  const raw = applyToMap(rawMap);
  // Re-normalize from raw so newly-distinct keys aren't dropped by the grouper
  const { spawnSync } = require('child_process');
  spawnSync('node', ['scripts/normalize-overlay-map.js', 'overlay-maps/raw/i-800a.raw.json', 'overlay-maps/normalized/i-800a.json'], { cwd: root, stdio: 'pipe' });
  const qRes = rebuildQuestionnaire(qPath);
  const sRes = rebuildSchema(schemaPath);

  console.log('i-800a semantic key fix:');
  console.log('  normalized map (pre-renorm): ' + norm + ' renames');
  console.log('  raw map: ' + raw + ' renames');
  console.log('  questionnaire: removed ' + qRes.removed + ', added ' + qRes.added);
  console.log('  schema: removed ' + sRes.removed + ', added ' + sRes.added);
}

main();
