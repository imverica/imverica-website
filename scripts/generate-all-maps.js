#!/usr/bin/env node
'use strict';
/**
 * Generates a pdf-map.js for every immigration form in the catalog.
 * Reads field names from /tmp/pdf-fields-compact.json (produced by extract-pdf-fields.js).
 * Outputs one file per form into netlify/functions/lib/.
 */

const fs = require('fs');
const path = require('path');

const LIB_DIR = path.resolve(__dirname, '../netlify/functions/lib');
const FIELDS_JSON = '/tmp/pdf-fields-all.json';

const allForms = require(FIELDS_JSON);

// ─── Pattern helpers ───────────────────────────────────────────────────────────

function isBtn(f) { return f.type === 'Btn'; }
function isTx(f) { return f.type === 'Tx'; }
function isCh(f) { return f.type === 'Ch'; }

/** True if field name matches any pattern */
function m(name, ...pats) {
  return pats.some(p => typeof p === 'string' ? name.includes(p) : p.test(name));
}

function matchesNameOnly(name, ...pats) {
  const lower = name.toLowerCase();
  return pats.some(p => typeof p === 'string' ? lower.includes(p.toLowerCase()) : p.test(lower));
}

/** Return first field matching patterns, or null */
function find(fields, ...pats) {
  return fields.find(f => pats.some(p => typeof p === 'string' ? f.name.includes(p) : p.test(f.name))) || null;
}

/** Return all fields matching patterns */
function findAll(fields, ...pats) {
  return fields.filter(f => pats.some(p => typeof p === 'string' ? f.name.includes(p) : p.test(f.name)));
}

// Determine the "root" family/given/middle name fields (applicant's own name)
// We want [0] only; skip the repeating header instances
function nameFields(fields) {
  const family = find(fields, /^Pt1Line1_FamilyName/, /^P2_Line1_FamilyName/, /^Line1a_FamilyName/, /^Pt1_Line1_FamilyName/, /^Part1Line1_FamilyName/, /^S1_FamilyName/, 'Pt1Line1a_FamilyName');
  const given  = find(fields, /^Pt1Line1_GivenName/,  /^P2_Line1_GivenName/,  /^Line1b_GivenName/,  /^Pt1_Line1_GivenName/,  /^Part1Line1_GivenName/,  /^S1_GivenName/,  'Pt1Line1b_GivenName');
  const middle = find(fields, /^Pt1Line1_MiddleName/, /^P2_Line1_MiddleName/, /^Line1c_MiddleName/, /^Pt1_Line1_MiddleName/, /^Part1Line1_MiddleName/, /^S1_MiddleName/, 'Pt1Line1c_MiddleName');
  return { family, given, middle };
}

// Repeating AlienNumber headers
function alienFields(fields) {
  return fields.filter(f => /^AlienNumber\[/.test(f.name) || /^Line1_AlienNumber\[/.test(f.name));
}

// Address — mailing
function mailingAddr(fields) {
  return {
    street: find(fields, /Pt1Line\d+_StreetNumberName\[0\]/, /P4_Line1_StreetName/, /S2A_StreetNumberName/, /Pt2Line\d+_StreetNumberName\[0\]/, /Line4b_StreetNumberName/),
    apt: find(fields, /Pt1Line\d+US_AptSteFlrNumber\[0\]/, /P4_Line1_Number\[0\]/, /S2A_AptSteFlrNumber/, /Pt2Line\d+_AptSteFlrNumber\[0\]/, /Pt2Line5_AptSteFlrNumber/),
    city: find(fields, /Pt1Line\d+_CityOrTown\[0\]/, /P4_Line1_City\[0\]/, /S2A_CityOrTown/, /Pt2Line\d+_CityOrTown\[0\]/, /Pt2Line5_CityOrTown/),
    state: find(fields, /Pt1Line\d+_State\[0\]/, /P4_Line1_State\[0\]/, /S2A_State\[0\]/, /Pt2Line\d+_State\[0\]/, /Pt2Line5_State\[0\]/),
    zip: find(fields, /Pt1Line\d+_ZipCode\[0\]/, /P4_Line1_ZipCode\[0\]/, /S2A_ZipCode\[0\]/, /Pt2Line\d+_ZipCode\[0\]/, /Pt2Line5_ZipCode\[0\]/),
  };
}

function phoneField(fields) {
  return find(fields,
    /DaytimePhoneNumber1\[0\]/, /Pt3Line3_DaytimePhoneNumber/, /P12_Line3_Telephone\[0\]/,
    /P14_Line4_Telephone/, /PhoneNumber\[0\]/, /Telephone\[0\]/, /Line10_DaytimeTelephone/
  );
}

function mobileField(fields) {
  return find(fields, /MobileNumber1\[0\]/, /Pt3Line4_Mobile/, /P12_Line3_Mobile/, /P14_Line5_Mobile/, /CellPhone/, /MobileTelephone/);
}

function emailField(fields) {
  return find(fields, /Email\[0\]/, /Pt3Line5_Email/, /P12_Line5_Email/, /P14_Line5_Email/, /P15_Line6_Email/, /EmailAddress/);
}

function signatureDateField(fields) {
  return find(fields,
    /DateofSignature\[0\]/, /DateOfSignature\[0\]/, /DateofSignature\[1\]/,
    /Part15DateofSignature/, /Pt3Line7b_DateofSignature/, /P13_DateofSignature/,
    /SignatureDate\[0\]/, /S3_DateofSignature/, /DateSigned/
  );
}

function dobField(fields) {
  return find(fields,
    /Pt1Line3_DOB\[0\]/, /Line19_DOB\[0\]/, /P2_Line8_DateOfBirth\[0\]/,
    /DateOfBirth\[0\]/, /DateofBirth\[0\]/, /DOB\[0\]/, /S1_DateOfBirth/
  );
}

function alienNumberPrimaryField(fields) {
  return find(fields,
    /^Line7_AlienNumber\[0\]/, /^Pt1Line4_AlienNumber/, /^P1_AlienNumber\[0\]/,
    /^Pt1Line7_AlienNumber\[0\]/, /^AlienNumber\[0\]/, /^Line1_AlienNumber\[0\]/,
    /AlienNumber\[0\]/
  );
}

function ssnField(fields) {
  return find(fields, /SSN\[0\]/, /SocialSecurityNumber\[0\]/, /Line12b_SSN/, /Pt1Line19_SSN/, /P9_Line22c_SSNumber/);
}

function countryOfBirthField(fields) {
  return find(fields, /CountryOfBirth\[0\]/, /CountryofBirth\[0\]/, /Country.*Birth\[0\]/i, /P2_Line10_CountryOfBirth/);
}

function cityOfBirthField(fields) {
  return find(fields, /CityTownOfBirth\[0\]/, /CityOfBirth\[0\]/, /P1Line7_CityTownOfBirth/, /PlaceOfBirth/);
}

function countryOfCitizenshipField(fields) {
  return find(fields, /CountryOfCitizenship\[0\]/, /Citizenship\[0\]/, /NationalityCountry/, /CountryofCitizenshipNationality/);
}

function uscisAccountField(fields) {
  return find(fields, /USCISOnlineAcctNumber/, /USCIS.*Account/, /ElisAccountNumber/, /USCIS.*Acct/);
}

function passportNumField(fields) {
  return find(fields, /PassportNum\[0\]/, /PassportNumber\[0\]/, /Passport\[0\]/, /Line20b_Passport/);
}

function passportExpField(fields) {
  return find(fields, /PassportExpDate/, /PassportExp\[0\]/, /Passport.*Exp/, /Line20e_ExpDate/);
}

function i94Field(fields) {
  return find(fields, /I94\[0\]/, /I94Number\[0\]/, /I-94/, /I94Num/, /Line20a_I94/);
}

function interpreterFamilyField(fields) {
  return find(fields, /Interpreter.*FamilyName/, /InterpreterFamilyName/, /nterpreterFamilyName/, /P14_Line1_nterpreterFamilyName/);
}

function interpreterGivenField(fields) {
  return find(fields, /Interpreter.*GivenName/, /InterpreterGivenName/, /nterpreterGivenName/, /P14_Line1_nterpreterGivenName/);
}

function interpreterOrgField(fields) {
  return find(fields, /Interpreter.*Business/, /Interpreter.*Org/, /P14_Line2_Name/, /InterpreterBusiness/);
}

function interpreterLangField(fields) {
  return find(fields, /NameOfLanguage/, /Interpreter.*Language/, /LanguageOf/);
}

function preparerFamilyField(fields) {
  return find(fields, /Preparer.*FamilyName/, /PreparerFamilyName/, /P15_Line1_PreparerFamilyName/, /Pt5Line1a_Preparer/);
}

function preparerGivenField(fields) {
  return find(fields, /Preparer.*GivenName/, /PreparerGivenName/, /P15_Line1_PreparerGivenName/, /Pt5Line1b_Preparer/);
}

function preparerOrgField(fields) {
  return find(fields, /Preparer.*Business/, /Preparer.*Org/, /P15_Line2_Name/, /Pt5Line2_Business/);
}

// Sex/Gender checkboxes — return [maleField, femaleField]
function sexButtons(fields) {
  const sexBtns = fields.filter(f => isBtn(f) && (
    m(f.name, /Sex\[/, /Gender\[/, /Line9_Checkbox/, /Pt1Line6_CB_Sex/)
  ));
  // Typically [0]=Male or Female depending on form
  return sexBtns;
}

// Marital status buttons
function maritalButtons(fields) {
  return fields.filter(f => isBtn(f) && m(f.name, /MaritalStatus\[/, /Marital.*Status\[/i));
}

// ─── Code generator ────────────────────────────────────────────────────────────

function q(v) {
  if (v === undefined || v === null) return 'undefined';
  return JSON.stringify(v);
}

function fieldRef(f) {
  if (!f) return null;
  return f.name;
}

/**
 * Generate a JS map file for a given form.
 * Returns the file content as a string.
 */
function generateMapFile(formCode, fields) {
  const slug = formCode.toLowerCase().replace(/\s+/g, '-');
  const fnName = slug.replace(/[-\s]/g, '_').replace(/[^a-z0-9_]/g, '') + 'FieldValues';
  const exportName = formCode.replace(/[^a-zA-Z0-9]/g, '').charAt(0).toLowerCase() +
    formCode.replace(/[^a-zA-Z0-9]/g, '').slice(1) + 'FieldValues';

  const { family, given, middle } = nameFields(fields);
  const aliens = alienFields(fields);
  const mAddr = mailingAddr(fields);
  const phone = phoneField(fields);
  const mobile = mobileField(fields);
  const email = emailField(fields);
  const sigDate = signatureDateField(fields);
  const dob = dobField(fields);
  const alienPrimary = alienNumberPrimaryField(fields);
  const ssn = ssnField(fields);
  const cob = countryOfBirthField(fields);
  const city = cityOfBirthField(fields);
  const coc = countryOfCitizenshipField(fields);
  const uscisAcct = uscisAccountField(fields);
  const passNum = passportNumField(fields);
  const passExp = passportExpField(fields);
  const i94 = i94Field(fields);
  const interpFamily = interpreterFamilyField(fields);
  const interpGiven = interpreterGivenField(fields);
  const interpOrg = interpreterOrgField(fields);
  const interpLang = interpreterLangField(fields);
  const prepFamily = preparerFamilyField(fields);
  const prepGiven = preparerGivenField(fields);
  const prepOrg = preparerOrgField(fields);
  const sexBtns = sexButtons(fields);
  const maritalBtns = maritalButtons(fields);

  const lines = [];

  lines.push(`'use strict';`);
  lines.push(`const { incrementalFillPdf: _unused } = require('./pdf-incremental-fill'); // keep dep for later`);
  lines.push(``);
  lines.push(`function clean(v, max = 300) {`);
  lines.push(`  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(Boolean).join(' ').replace(/\\s+/g,' ').trim().slice(0,max);`);
  lines.push(`  return String(v||'').replace(/\\s+/g,' ').trim().slice(0,max);`);
  lines.push(`}`);
  lines.push(`function digits(v,max=30){return clean(v,Math.max(80,max*4)).replace(/\\D/g,'').slice(0,max);}`);
  lines.push(`function dateMdY(v){const t=clean(v,40);const m=t.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);return m?\`\${m[2]}/\${m[3]}/\${m[1]}\`:t;}`);
  lines.push(`function stateCode(v){const t=clean(v,80);const m=t.match(/^([A-Z]{2})\\b/);return m?m[1]:t;}`);
  lines.push(`function usPhone(v){if(v&&typeof v==='object'&&!Array.isArray(v)){return digits(\`\${v.areaCode||''}\${v.number||''}\`,10);}const r=digits(v,20);if(r.length===11&&r.startsWith('1'))return r.slice(1);return r.length>10?r.slice(-10):r;}`);
  lines.push(`function yesNo(v){const t=clean(v,40).toLowerCase();if(['yes','true','да','так'].includes(t))return true;if(['no','false','нет','ні'].includes(t))return false;return null;}`);
  lines.push(`function cb(v,y,n){if(v===true)return{[y]:true,[n]:false};if(v===false)return{[y]:false,[n]:true};return {};}`);
  lines.push(``);

  // Sex helper if we have sex buttons
  if (sexBtns.length >= 2) {
    const maleName = sexBtns[0].name;
    const femaleName = sexBtns.length > 1 ? sexBtns[1].name : sexBtns[0].name;
    // Determine which is male vs female from appearance states or index
    // Default: [0]=Male, [1]=Female unless states say otherwise
    const s0 = (sexBtns[0].states || [])[0] || '';
    const s1 = (sexBtns.length > 1 ? sexBtns[1].states : [])[0] || '';
    const maleFirst = !( /^F/i.test(s0) || /female/i.test(s0) );
    const mField = maleFirst ? sexBtns[0].name : (sexBtns[1] || sexBtns[0]).name;
    const fField = maleFirst ? (sexBtns[1] || sexBtns[0]).name : sexBtns[0].name;
    lines.push(`function sexFields(v){const s=clean(v,40).toLowerCase();`);
    lines.push(`  if(/^m|male/.test(s))return{${q(mField)}:true,${q(fField)}:false};`);
    lines.push(`  if(/^f|female/.test(s))return{${q(mField)}:false,${q(fField)}:true};`);
    lines.push(`  return {};}`);
    lines.push(``);
  }

  // Marital status helper if we have marital buttons
  if (maritalBtns.length >= 2) {
    // Determine index order from appearance states: D=divorced, S=single, W=widowed, M=married, A=annulled, E=separated
    // Map states to indices
    const stateMap = {};
    maritalBtns.forEach((f, i) => {
      const st = (f.states || [])[0] || '';
      stateMap[st.toUpperCase()] = f.name;
    });
    // Build field resolution: single(S), married(M), divorced(D), widowed(W), annulled(A), separated(E)
    const S = stateMap['S'] || (maritalBtns[0] || {}).name;
    const M = stateMap['M'] || (maritalBtns[1] || {}).name;
    const D = stateMap['D'] || (maritalBtns[2] || {}).name;
    const W = stateMap['W'] || (maritalBtns[3] || {}).name;
    const A = stateMap['A'] || maritalBtns[0]?.name;
    const E = stateMap['E'] || maritalBtns[0]?.name;
    const allNames = [...new Set(maritalBtns.map(f => f.name))];
    lines.push(`function maritalFields(v){const s=clean(v,80).toLowerCase();`);
    lines.push(`  const all={${allNames.map(n => `${q(n)}:false`).join(',')}};`);
    if (M) lines.push(`  if(/married|spouse|брак/.test(s))return{...all,${q(M)}:true};`);
    if (S) lines.push(`  if(/single|never|холост/.test(s))return{...all,${q(S)}:true};`);
    if (D) lines.push(`  if(/divorc|развед/.test(s))return{...all,${q(D)}:true};`);
    if (W) lines.push(`  if(/widow|вдов/.test(s))return{...all,${q(W)}:true};`);
    if (A) lines.push(`  if(/annul/.test(s))return{...all,${q(A)}:true};`);
    if (E) lines.push(`  if(/separat/.test(s))return{...all,${q(E)}:true};`);
    lines.push(`  return {};}`);
    lines.push(``);
  }

  // The main function
  lines.push(`function ${fnName}(payload={}) {`);
  lines.push(`  const a = payload.formAnswers || payload.answers || {};`);
  lines.push(`  const c = payload.contact || {};`);
  lines.push(`  const today = new Date().toISOString().slice(0,10);`);
  lines.push(`  const v = {};`);

  // Family / Given / Middle name
  if (family) lines.push(`  v[${q(family.name)}] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);`);
  if (given)  lines.push(`  v[${q(given.name)}]  = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);`);
  if (middle) lines.push(`  v[${q(middle.name)}] = clean(a.applicant_middle_name || a.middle_name || '', 60);`);

  // DOB
  if (dob) lines.push(`  v[${q(dob.name)}] = dateMdY(a.date_of_birth || a.dob || '');`);

  // Alien number — primary field
  if (alienPrimary) lines.push(`  v[${q(alienPrimary.name)}] = digits(a.alien_number || a.a_number, 9);`);

  // Repeating alien number headers
  if (aliens.length > 1) {
    lines.push(`  { const an = digits(a.alien_number || a.a_number, 9); if(an) {`);
    aliens.forEach(f => {
      lines.push(`    v[${q(f.name)}] = an;`);
    });
    lines.push(`  }}`);
  }

  // SSN
  if (ssn) lines.push(`  v[${q(ssn.name)}] = digits(a.ssn || a.social_security_number, 9);`);

  // USCIS account
  if (uscisAcct) lines.push(`  v[${q(uscisAcct.name)}] = digits(a.uscis_online_account_number, 12);`);

  // Birth info
  if (city) lines.push(`  v[${q(city.name)}] = clean(a.city_of_birth || a.place_of_birth_city, 60);`);
  if (cob)  lines.push(`  v[${q(cob.name)}]  = clean(a.country_of_birth, 60);`);
  if (coc)  lines.push(`  v[${q(coc.name)}]  = clean(a.country_of_citizenship, 60);`);

  // Passport / travel
  if (passNum) lines.push(`  v[${q(passNum.name)}] = clean(a.passport_number, 20);`);
  if (passExp) lines.push(`  v[${q(passExp.name)}] = dateMdY(a.passport_expiration || '');`);
  if (i94)     lines.push(`  v[${q(i94.name)}]     = clean(a.i94_number, 20);`);

  // Address
  if (mAddr.street) lines.push(`  v[${q(mAddr.street.name)}] = clean(a.mailing_address_line1 || a.current_address_line1 || a.address_line1, 80);`);
  if (mAddr.apt)    lines.push(`  v[${q(mAddr.apt.name)}] = clean(a.mailing_address_line2 || a.address_unit, 10).replace(/^(?:apt|ste|fl|unit|#)\\s*\\.?\\s*/i,'').slice(0,6);`);
  if (mAddr.city)   lines.push(`  v[${q(mAddr.city.name)}] = clean(a.mailing_city || a.city, 60);`);
  if (mAddr.state)  lines.push(`  v[${q(mAddr.state.name)}] = stateCode(a.mailing_state || a.state || '');`);
  if (mAddr.zip)    lines.push(`  v[${q(mAddr.zip.name)}]   = digits(a.mailing_zip || a.zip_code, 10);`);

  // Phone / email
  if (phone)  lines.push(`  v[${q(phone.name)}]  = usPhone(a.daytime_phone || a.phone || c.phone);`);
  if (mobile) lines.push(`  v[${q(mobile.name)}] = usPhone(a.mobile_phone || a.daytime_phone || c.phone);`);
  if (email)  lines.push(`  v[${q(email.name)}]  = clean(a.email_address || a.email || c.email, 120);`);

  // Signature date
  if (sigDate) lines.push(`  v[${q(sigDate.name)}] = dateMdY(today);`);

  // Sex
  if (sexBtns.length >= 2) {
    lines.push(`  Object.assign(v, sexFields(a.sex || a.gender || ''));`);
  }

  // Marital status
  if (maritalBtns.length >= 2) {
    lines.push(`  Object.assign(v, maritalFields(a.marital_status || ''));`);
  }

  // Interpreter
  if (interpFamily) lines.push(`  v[${q(interpFamily.name)}] = clean(a.interpreter_family_name, 60);`);
  if (interpGiven)  lines.push(`  v[${q(interpGiven.name)}]  = clean(a.interpreter_given_name, 60);`);
  if (interpOrg)    lines.push(`  v[${q(interpOrg.name)}]    = clean(a.interpreter_org_name || a.interpreter_business_name, 80);`);
  if (interpLang)   lines.push(`  v[${q(interpLang.name)}]   = clean(a.interpreter_language, 40);`);

  // Preparer
  if (prepFamily) lines.push(`  v[${q(prepFamily.name)}] = clean(a.preparer_family_name, 60);`);
  if (prepGiven)  lines.push(`  v[${q(prepGiven.name)}]  = clean(a.preparer_given_name, 60);`);
  if (prepOrg)    lines.push(`  v[${q(prepOrg.name)}]    = clean(a.preparer_business_name, 80);`);

  lines.push(``);
  lines.push(`  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`module.exports = { ${fnName} };`);

  return lines.join('\n');
}

// ─── Form → filename mapping ───────────────────────────────────────────────────

const FORM_FILE_MAP = {
  'AR-11': 'ar11-pdf-map.js',
  'G-28': 'g28-pdf-map.js',
  'G-28I': 'g28i-pdf-map.js',
  'G-325A': 'g325a-pdf-map.js',
  'G-639': 'g639-pdf-map.js',
  'G-845': 'g845-pdf-map.js',
  'G-845 Supplement': 'g845s-pdf-map.js',
  'G-884': 'g884-pdf-map.js',
  'G-1041': 'g1041-pdf-map.js',
  'G-1041A': 'g1041a-pdf-map.js',
  'G-1055': 'g1055-pdf-map.js',
  'G-1145': 'g1145-pdf-map.js',
  'G-1256': 'g1256-pdf-map.js',
  'G-1450': 'g1450-pdf-map.js',
  'G-1566': 'g1566-pdf-map.js',
  'G-1650': 'g1650-pdf-map.js',
  'I-9': 'i9-pdf-map.js',
  'I-90': 'i90-pdf-map.js',
  'I-102': 'i102-pdf-map.js',
  'I-129': 'i129-pdf-map.js',
  'I-129CWR': 'i129cwr-pdf-map.js',
  'I-129F': 'i129f-pdf-map.js',
  'I-129S': 'i129s-pdf-map.js',
  'I-130': 'i130-pdf-map.js',
  'I-130A': 'i130a-pdf-map.js',
  'I-131': 'i131-pdf-map.js',
  'I-131A': 'i131a-pdf-map.js',
  'I-134': 'i134-pdf-map.js',
  'I-134A': 'i134a-pdf-map.js',
  'I-140': 'i140-pdf-map.js',
  'I-191': 'i191-pdf-map.js',
  'I-192': 'i192-pdf-map.js',
  'I-193': 'i193-pdf-map.js',
  'I-212': 'i212-pdf-map.js',
  'I-290B': 'i290b-pdf-map.js',
  'I-360': 'i360-pdf-map.js',
  'I-361': 'i361-pdf-map.js',
  'I-363': 'i363-pdf-map.js',
  'I-407': 'i407-pdf-map.js',
  'I-485 Supplement A': 'i485a-pdf-map.js',
  'I-485 Supplement J': 'i485j-pdf-map.js',
  'I-508': 'i508-pdf-map.js',
  'I-526': 'i526-pdf-map.js',
  'I-526E': 'i526e-pdf-map.js',
  'I-539': 'i539-pdf-map.js',
  'I-539A': 'i539a-pdf-map.js',
  'I-589': 'i589-pdf-map.js',
  'I-590': 'i590-pdf-map.js',
  'I-600': 'i600-pdf-map.js',
  'I-600A': 'i600a-pdf-map.js',
  'I-601': 'i601-pdf-map.js',
  'I-601A': 'i601a-pdf-map.js',
  'I-602': 'i602-pdf-map.js',
  'I-612': 'i612-pdf-map.js',
  'I-687': 'i687-pdf-map.js',
  'I-690': 'i690-pdf-map.js',
  'I-693': 'i693-pdf-map.js',
  'I-694': 'i694-pdf-map.js',
  'I-698': 'i698-pdf-map.js',
  'I-730': 'i730-pdf-map.js',
  'I-751': 'i751-pdf-map.js',
  'I-765V': 'i765v-pdf-map.js',
  'I-800': 'i800-pdf-map.js',
  'I-800A': 'i800a-pdf-map.js',
  'I-817': 'i817-pdf-map.js',
  'I-821': 'i821-pdf-map.js',
  'I-821D': 'i821d-pdf-map.js',
  'I-824': 'i824-pdf-map.js',
  'I-829': 'i829-pdf-map.js',
  'I-864': 'i864-pdf-map.js',
  'I-864A': 'i864a-pdf-map.js',
  'I-864EZ': 'i864ez-pdf-map.js',
  'I-864W': 'i864w-pdf-map.js',
  'I-865': 'i865-pdf-map.js',
  'I-881': 'i881-pdf-map.js',
  'I-907': 'i907-pdf-map.js',
  'I-912': 'i912-pdf-map.js',
  'I-914': 'i914-pdf-map.js',
  'I-918': 'i918-pdf-map.js',
  'I-929': 'i929-pdf-map.js',
  'I-941': 'i941-pdf-map.js',
  'I-942': 'i942-pdf-map.js',
  'I-956': 'i956-pdf-map.js',
  'I-956F': 'i956f-pdf-map.js',
  'I-956G': 'i956g-pdf-map.js',
  'I-956H': 'i956h-pdf-map.js',
  'I-956K': 'i956k-pdf-map.js',
  'N-300': 'n300-pdf-map.js',
  'N-336': 'n336-pdf-map.js',
  'N-400': 'n400-pdf-map.js',
  'N-470': 'n470-pdf-map.js',
  'N-565': 'n565-pdf-map.js',
  'N-600': 'n600-pdf-map.js',
  'N-600K': 'n600k-pdf-map.js',
  'N-648': 'n648-pdf-map.js',
};

// Skip I-765 and I-485 — already hand-crafted
const SKIP = new Set(['I-765', 'I-485']);

let generated = 0;
let skipped = 0;

for (const [code, filename] of Object.entries(FORM_FILE_MAP)) {
  if (SKIP.has(code)) { skipped++; continue; }

  const data = allForms[code];
  if (!data || data.error || !data.fields || data.fields.length === 0) {
    console.log(`SKIP ${code}: ${data?.error || 'no fields'}`);
    skipped++;
    continue;
  }

  const content = generateMapFile(code, data.fields);
  const outPath = path.join(LIB_DIR, filename);
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Generated ${code} → ${filename} (${data.fields.length} fields)`);
  generated++;
}

console.log(`\nDone: ${generated} generated, ${skipped} skipped`);
