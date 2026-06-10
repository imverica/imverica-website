'use strict';
const { incrementalFillPdf: _unused } = require('./pdf-incremental-fill'); // keep dep for later

function clean(v, max = 300) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g,' ').trim().slice(0,max);
  return String(v||'').replace(/\s+/g,' ').trim().slice(0,max);
}
function digits(v,max=30){return clean(v,Math.max(80,max*4)).replace(/\D/g,'').slice(0,max);}
function dateMdY(v){const t=clean(v,40);const m=t.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[2]}/${m[3]}/${m[1]}`:t;}
function stateCode(v){const t=clean(v,80);const m=t.match(/^([A-Z]{2})\b/);return m?m[1]:t;}
function usPhone(v){if(v&&typeof v==='object'&&!Array.isArray(v)){return digits(`${v.areaCode||''}${v.number||''}`,10);}const r=digits(v,20);if(r.length===11&&r.startsWith('1'))return r.slice(1);return r.length>10?r.slice(-10):r;}
function yesNo(v){const t=clean(v,40).toLowerCase();if(['yes','true','да','так'].includes(t))return true;if(['no','false','нет','ні'].includes(t))return false;return null;}
function cb(v,y,n){if(v===true)return{[y]:true,[n]:false};if(v===false)return{[y]:false,[n]:true};return {};}
function addressLine2(v){return clean(v,12).replace(/^(?:apt|ste|fl|unit|#)\s*\.?\s*/i,'').slice(0,10);}

function sexFields(v){const s=clean(v,40).toLowerCase();
  if(/^m/.test(s))return{"Part2_Item12_Sex[0]":true,"Part2_Item12_Sex[1]":false};
  if(/^f|female/.test(s))return{"Part2_Item12_Sex[0]":false,"Part2_Item12_Sex[1]":true};
  return {};}

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"Part2_Item17_MaritalStatus[0]":false,"Part2_Item17_MaritalStatus[1]":false,"Part2_Item17_MaritalStatus[2]":false,"Part2_Item17_MaritalStatus[3]":false,"Part2_Item17_MaritalStatus[4]":false,"Part2_Item17_MaritalStatus[5]":false,"Part2_Item17_MaritalStatus[6]":false};
  if(/married|spouse|брак/.test(s))return{...all,"Part2_Item17_MaritalStatus[1]":true};
  if(/single|never|холост/.test(s))return{...all,"Part2_Item17_MaritalStatus[0]":true};
  if(/divorc|развед/.test(s))return{...all,"Part2_Item17_MaritalStatus[2]":true};
  if(/widow|вдов/.test(s))return{...all,"Part2_Item17_MaritalStatus[3]":true};
  if(/annul/.test(s))return{...all,"Part2_Item17_MaritalStatus[5]":true};
  if(/separat/.test(s))return{...all,"Part2_Item17_MaritalStatus[4]":true};
  return {};}

function i_821FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};

  // ===== Part 1 — Type of Application (render-verified, fillable AcroForm) =====
  // 1.a Initial (first-time) / 1.b Re-registration.
  const appType = clean(a.tps_application_type || a.application_type || a.tps_type, 30).toLowerCase();
  if (/re-?reg|повтор|перереєстр/.test(appType)) v["Part1_Item1_ApplicationType[1]"] = true; // 1.b
  else v["Part1_Item1_ApplicationType[0]"] = true;                                            // 1.a Initial (default)
  // Item 3 — are you also filing Form I-765 (EAD)? Default Yes (filed together).
  const ead = yesNo(a.tps_also_filing_ead);
  if (ead === false) v["Part1_Item3_EADApp[1]"] = true;  // 3.b No
  else v["Part1_Item3_EADApp[0]"] = true;                // 3.a Yes (default)
  // Item 4 — designated TPS country (e.g. Ukraine = country of citizenship).
  v["Part1_TPScountry[0]"] = clean(a.tps_country || a.country_of_citizenship || a.country_of_birth, 60);

  v["Part2_Item1_FamilyName[0]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["Part2_Item1_GivenName[0]"] = clean(a.applicant_given_name || a.given_name || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["Part2_Item1_MiddleName[0]"] = clean(a.applicant_middle_name || a.middle_name, 60);
  v["Part6_Item4_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Part2_Item10_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Part2_Item7_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["Part2_Item8_AcctIdentifier[0]"] = digits(a.uscis_online_account_number, 12);
  v["Part2_Item9_SocialSecurityNumber[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["Part2_Item13_CityOrTown[0]"] = clean(a.city_of_birth || a.place_of_birth_city, 60);
  v["Part2_Item14_CountryofBirth[0]"]  = clean(a.country_of_birth, 60);
  v["Part2_Item19_ImmigrationStatus[0]"] = clean(a.current_immigration_status, 80);
  v["Part2_Item20_CityOrTown[0]"] = clean(a.place_entry, 60);
  v["Part2_Item20_PortofEntry[0]"] = clean(a.place_entry, 60);
  v["Part2_Item21_AuthorizedPdofStay[0]"] = dateMdY(a.authorized_stay_expires || a.status_expiration);
  v["Part2_Item22_Passport[0]"] = clean(a.passport_number, 20);
  v["Part2_Item24_CountryofIssuance[0]"] = clean(a.passport_country_of_issuance, 60);
  v["Part2_Item24_PassportExpiration[0]"] = dateMdY(a.passport_expiration || '');
  v["Part2_Item22_I94[0]"]     = clean(a.i94_number, 20);
  v["Part2_Item4_StreetNumberName[0]"] = clean(a.mailing_address_line1 || a.address_line1, 80);
  v["Part2_Item4_AptSteFlrNumber[0]"] = addressLine2(a.mailing_address_line2 || a.address_unit);
  v["Part2_Item4_CityOrTown[0]"] = clean(a.mailing_city || a.city, 60);
  v["Part2_Item4_State[0]"] = stateCode(a.mailing_state || a.state || '');
  v["Part2_Item4_ZipCode[0]"] = digits(a.mailing_zip || a.zip_code, 10);
  v["Part2_Item6_StreetNumberName[0]"] = clean(a.physical_address_line1 || a.mailing_address_line1 || a.address_line1, 80);
  v["Part2_Item6_AptSteFlrNumber[0]"] = addressLine2(a.physical_address_line2 || a.mailing_address_line2 || a.address_unit);
  v["Part2_Item6_CityOrTown[0]"] = clean(a.physical_city || a.mailing_city || a.city, 60);
  v["Part2_Item6_State[0]"] = stateCode(a.physical_state || a.mailing_state || a.state || '');
  v["Part2_Item6_ZipCode[0]"] = digits(a.physical_zip || a.mailing_zip || a.zip_code, 10);
  v["Part9_Item1_FamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["Part9_Item1_GivenName[1]"] = clean(a.interpreter_given_name, 60);
  v["Part9_Item2_OrgName[0]"] = clean(a.interpreter_org_name || a.interpreter_business_name, 80);
  v["Part9_Item3_StreetNumberName[0]"] = clean(a.interpreter_address_line1 || a.mailing_address_line1, 80);
  v["Part9_Item3_AptSteFlrNumber[0]"] = addressLine2(a.interpreter_address_line2 || a.mailing_address_line2);
  v["Part9_Item3_CityOrTown[0]"] = clean(a.interpreter_city || a.mailing_city, 60);
  v["Part9_Item3_State[0]"] = stateCode(a.interpreter_state || a.mailing_state || '');
  v["Part9_Item3_ZipCode[0]"] = digits(a.interpreter_zip || a.mailing_zip, 10);
  v["Part9_Item3_Country[0]"] = clean(a.interpreter_country || a.mailing_country, 60);
  v["Part9_Item4_DaytimePhone[0]"] = usPhone(a.interpreter_phone || a.daytime_phone || c.phone);
  v["Part9_Item5_Email[0]"] = clean(a.interpreter_email || a.email_address || c.email, 120);
  v["Part9_Item6_DateofSignature[0]"] = dateMdY(today);
  v["Part10_Item1_FamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["Part10_Item1_GivenName[0]"] = clean(a.preparer_given_name, 60);
  v["Part10_Item2_OrgName[0]"] = clean(a.preparer_business_name, 80);
  v["Part10_Item3_StreetNumberName[0]"] = clean(a.preparer_address_line1 || a.mailing_address_line1, 80);
  v["Part10_Item3_AptSteFlrNumber[0]"] = addressLine2(a.preparer_address_line2 || a.mailing_address_line2);
  v["Part10_Item3_CityOrTown[0]"] = clean(a.preparer_city || a.mailing_city, 60);
  v["Part10_Item3_State[0]"] = stateCode(a.preparer_state || a.mailing_state || '');
  v["Part10_Item3_ZipCode[0]"] = digits(a.preparer_zip || a.mailing_zip, 10);
  v["Part10_Item3_Country[0]"] = clean(a.preparer_country || a.mailing_country, 60);
  v["Part10_Item4_DaytimePhone[0]"] = usPhone(a.preparer_phone || a.daytime_phone || c.phone);
  v["Part10_Item5_MobilePhone[0]"] = usPhone(a.preparer_mobile_phone || a.mobile_phone || c.phone);
  v["Part10_Item6_Email[0]"] = clean(a.preparer_email || a.email_address || c.email, 120);
  v["Part10_Item8b_DateofSignature[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  Object.assign(v, maritalFields(a.marital_status || ''));

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

// Text overlays for boxes that fill at the AcroForm level but are NOT rendered
// by viewers (XFA-only display on this template). Verified by rendering: setting
// the fields still leaves these boxes blank. Coordinates are PDF points on page
// 2, visually calibrated (the AcroForm Rects are mis-placed by the XFA layer).
//   - Item 10 "Date of Birth" — single plain box at ~(506, 589) [render-verified].
//   - Items 7/8/9 (A-Number, USCIS account, SSN) — comb boxes, stamped per cell.
// Stamp a digit string across a comb box, one character per cell. boxLeft is the
// PDF-x of the box's left edge, cellW the per-cell width, n the cell count, y the
// text baseline (≈ box vertical centre). Each glyph is nudged to sit centred in
// its cell. Returns one overlay object per character (extra chars are dropped).
function combOverlay(page, boxLeft, cellW, n, y, value, size = 10) {
  const s = String(value || '').slice(0, n);
  const glyph = size * 0.5; // approx digit width at this size
  const out = [];
  for (let i = 0; i < s.length; i++) {
    out.push({ page, x: boxLeft + cellW * i + (cellW - glyph) / 2, y, text: s[i], size });
  }
  return out;
}

function i_821TextOverlays(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const overlays = [];
  const dob = dateMdY(a.date_of_birth || a.dob || '');
  if (dob) overlays.push({ page: 2, x: 506, y: 589, text: dob, size: 10 });
  // Only Item 7 (A-Number) is genuinely XFA-blank — its AcroForm widget is
  // mis-placed so the value never renders at the visible box. Items 8 (USCIS
  // account) and 9 (SSN) are also comb boxes but their widgets ARE at the
  // visible position and fill correctly from the AcroForm pass (render-verified),
  // so overlaying them would double-print. Geometry: 9 cells, right edge shared
  // with Item 9 (~576pt), stacked one row above the DOB anchor → y≈695.
  const aNum = digits(a.alien_number || a.a_number, 9);
  if (aNum) overlays.push(...combOverlay(2, 451, 13.9, 9, 695, aNum)); // 7 A-Number
  return overlays;
}

module.exports = { i_821FieldValues, i_821TextOverlays };
