const fs = require('fs');
const path = require('path');

// I-800 semantic key mapping. The PDF has 5 distinct FamilyNameLastName /
// GivenNameFirstName / MiddleName field groups, all collapsed onto a single
// key by the normalizer because the originalKey array index [N] was stripped.
// Each represents a different person/identity:
//   Page 2 [0] = Petitioner (You)
//   Page 3 [1] = Spouse (4.a. Provide information about your spouse)
//   Page 5 [2] = Child's current name (Part 4, Q1)
//   Page 5 [3] = Child's birth name (Part 4, Q2 — name at time of birth)
//   Page 5 [4] = Child's other / alias name (Part 4, Q3)
const RENAMES = [
  // Petitioner (page 2)
  { match: { page: 2, key: 'FamilyNameLastName', oidx: 0 },     newKey: 'Petitioner_FamilyName',   label: 'Petitioner Family Name (Last Name)' },
  { match: { page: 2, key: 'GivenNameFirstName', oidx: 0 },     newKey: 'Petitioner_GivenName',    label: 'Petitioner Given Name (First Name)' },
  { match: { page: 2, key: 'MiddleName',         oidx: 0 },     newKey: 'Petitioner_MiddleName',   label: 'Petitioner Middle Name' },
  { match: { page: 2, key: 'OtherNamesUsed',     oidx: 0 },     newKey: 'Petitioner_OtherNames',   label: 'Petitioner Other Names Used (incl. maiden)' },
  { match: { page: 2, key: 'DateofBirth',        oidx: 0 },     newKey: 'Petitioner_DateOfBirth',  label: 'Petitioner Date of Birth' },
  { match: { page: 2, key: 'PlaceofBirth',       oidx: 0 },     newKey: 'Petitioner_PlaceOfBirth', label: 'Petitioner Place of Birth' },

  // Spouse (page 3)
  { match: { page: 3, key: 'FamilyNameLastName', oidx: 1 },     newKey: 'Spouse_FamilyName',       label: 'Spouse Family Name (Last Name)' },
  { match: { page: 3, key: 'GivenNameFirstName', oidx: 1 },     newKey: 'Spouse_GivenName',        label: 'Spouse Given Name (First Name)' },
  { match: { page: 3, key: 'MiddleName',         oidx: 1 },     newKey: 'Spouse_MiddleName',       label: 'Spouse Middle Name' },
  { match: { page: 3, key: 'DateofBirth',        oidx: 1 },     newKey: 'Spouse_DateOfBirth',      label: 'Spouse Date of Birth' },
  { match: { page: 3, key: 'PlaceofBirth',       oidx: 1 },     newKey: 'Spouse_PlaceOfBirth',     label: 'Spouse Place of Birth' },

  // Child — current name (page 5, Q1)
  { match: { page: 5, key: 'FamilyNameLastName', oidx: 2 },     newKey: 'Child_Current_FamilyName', label: "Child's Current Family Name" },
  { match: { page: 5, key: 'GivenNameFirstName', oidx: 2 },     newKey: 'Child_Current_GivenName',  label: "Child's Current Given Name" },
  { match: { page: 5, key: 'MiddleName',         oidx: 2 },     newKey: 'Child_Current_MiddleName', label: "Child's Current Middle Name" },

  // Child — birth name (page 5, Q2)
  { match: { page: 5, key: 'FamilyNameLastName', oidx: 3 },     newKey: 'Child_Birth_FamilyName',   label: "Child's Family Name at Birth" },
  { match: { page: 5, key: 'GivenNameFirstName', oidx: 3 },     newKey: 'Child_Birth_GivenName',    label: "Child's Given Name at Birth" },
  { match: { page: 5, key: 'MiddleName',         oidx: 3 },     newKey: 'Child_Birth_MiddleName',   label: "Child's Middle Name at Birth" },

  // Child — other / alias name (page 5, Q3)
  { match: { page: 5, key: 'FamilyNameLastName', oidx: 4 },     newKey: 'Child_Other_FamilyName',   label: "Other Family Name Child is/was Known By" },
  { match: { page: 5, key: 'GivenNameFirstName', oidx: 4 },     newKey: 'Child_Other_GivenName',    label: "Other Given Name Child is/was Known By" },
  { match: { page: 5, key: 'MiddleName',         oidx: 4 },     newKey: 'Child_Other_MiddleName',   label: "Other Middle Name Child is/was Known By" },

  // Child — DOB / POB (page 5, Q4)
  { match: { page: 5, key: 'DateofBirth',        oidx: 2 },     newKey: 'Child_DateOfBirth',       label: "Child's Date of Birth" },
  { match: { page: 5, key: 'PlaceofBirth',       oidx: 2 },     newKey: 'Child_PlaceOfBirth',      label: "Child's Place of Birth" },
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
  // Build set of existing keys
  const existing = new Set();
  q.pages.forEach(p => (p.fields || []).forEach(f => existing.add(f.key)));

  // Remove the old collapsed keys that became ambiguous
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

  // Insert new per-person fields on the corresponding pages
  function ensure(pageNumber, key, label) {
    if (existing.has(key)) return false;
    const page = q.pages.find(p => p.page === pageNumber);
    if (!page) return false;
    if (!page.fields) page.fields = [];
    page.fields.push({
      key,
      label,
      mode: 'text',
      type: 'text',
      defaultValue: ''
    });
    existing.add(key);
    return true;
  }

  let added = 0;
  for (const r of RENAMES) {
    if (ensure(r.match.page, r.newKey, r.label)) added++;
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
  let removed = 0;
  let added = 0;
  for (const pageNum of Object.keys(s.pages || {})) {
    const before = s.pages[pageNum].length;
    s.pages[pageNum] = s.pages[pageNum].filter(f => !removedOldKeys.has(f.key));
    removed += before - s.pages[pageNum].length;
  }
  for (const r of RENAMES) {
    const pageStr = String(r.match.page);
    if (!s.pages[pageStr]) s.pages[pageStr] = [];
    if (!s.pages[pageStr].some(f => f.key === r.newKey)) {
      s.pages[pageStr].push({
        key: r.newKey,
        mode: 'text',
        kind: 'text',
        defaultValue: ''
      });
      added++;
    }
  }
  fs.writeFileSync(schemaPath, JSON.stringify(s, null, 2));
  return { removed, added };
}

function main() {
  const root = path.join(__dirname, '..');
  const normMap = path.join(root, 'overlay-maps', 'normalized', 'i-800.json');
  const rawMap = path.join(root, 'overlay-maps', 'raw', 'i-800.raw.json');
  const qPath = path.join(root, 'questionnaires', 'i-800.questionnaire.json');
  const schemaPath = path.join(root, 'payload-schemas', 'i-800.schema.json');

  const norm = applyToMap(normMap);
  const raw = applyToMap(rawMap);
  const qRes = rebuildQuestionnaire(qPath);
  const sRes = rebuildSchema(schemaPath);

  console.log('i-800 semantic key fix:');
  console.log('  normalized map: ' + norm + ' renames');
  console.log('  raw map: ' + raw + ' renames');
  console.log('  questionnaire: removed ' + qRes.removed + ', added ' + qRes.added);
  console.log('  schema: removed ' + sRes.removed + ', added ' + sRes.added);
}

main();
