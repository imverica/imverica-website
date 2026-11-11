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


// "Apt 5" -> the Apt. box and "5"; a bare "5" is taken as an apartment.
function unitFields(value, aptField, steField, flrField, numberField, max = 6) {
  const text = clean(value, 40);
  if (!text) return {};
  const lower = text.toLowerCase();
  const box = /^(ste|suite)\b/.test(lower) ? steField : (/^(fl|flr|floor)\b/.test(lower) ? flrField : aptField);
  return { [box]: true, [numberField]: text.replace(/^(?:apt|apartment|ste|suite|flr|fl|floor|unit|#)\s*\.?\s*#?\s*/i, '').slice(0, max) };
}

function i_539FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};
  // Part 1. Information About You (field meanings read from the form's tooltips)
  v["P1Line1a_FamilyName[0]"] = clean(a.applicant_family_name, 60);
  v["P1_Line1b_GivenName[0]"] = clean(a.applicant_given_name, 60);
  v["P1_Line1c_MiddleName[0]"] = clean(a.applicant_middle_name, 60);
  v["Part2_Item11_StreetName[0]"] = clean(a.mailing_address_line1, 34);
  v["Part2_Item11_City[0]"] = clean(a.mailing_city, 28);
  v["Part2_Item11_State[0]"] = stateCode(a.mailing_state);
  v["Part2_Item11_ZipCode[0]"] = digits(a.mailing_zip, 5);
  Object.assign(v, unitFields(a.mailing_address_line2, "Part1_Item4_Unit[0]", "Part1_Item4_Unit[1]", "Part1_Item4_Unit[2]", "Part1_Item4_Number[0]"));
  const sameAddress = yesNo(a.physical_same_as_mailing);
  if (sameAddress === true) v["P1_checkbox5[1]"] = true;
  if (sameAddress === false) {
    v["P1_checkbox5[0]"] = true;
    v["Part1_Item6_StreetName[0]"] = clean(a.physical_address_line1, 34);
    v["Part1_Item6_City[0]"] = clean(a.physical_city, 28);
    v["Part1_Item6_State[0]"] = stateCode(a.physical_state);
    v["Part1_Item6_ZipCode[0]"] = digits(a.physical_zip, 5);
    Object.assign(v, unitFields(a.physical_address_line2, "Part1_Item6_Unit[0]", "Part1_Item6_Unit[1]", "Part1_Item6_Unit[2]", "Part1_Item6_Number[0]"));
  }
  // Part 5. Applicant's contact information
  v["P5_Line3_DaytimePhoneNumber[0]"] = usPhone(a.daytime_phone || a.phone || c.phone);
  v["P5_Line4_MobilePhoneNumber[0]"] = usPhone(a.mobile_phone);
  v["P5_Line5_EmailAddress[0]"] = clean(a.email_address || a.email || c.email, 38);
  v["P1_Line8_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Pt1Line2_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["P1_Line9_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["Pt1Line2_USCISOnlineAcctNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["P1_Line6_CountryOfBirth[0]"]  = clean(a.country_of_birth, 60);
  v["P1_Line7_CountryOfCitizenship[0]"]  = clean(a.country_of_citizenship, 60);
  v["SupA_Line1k_Passport[0]"] = clean(a.passport_number, 20);
  v["P7_Line1a_PreparerFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["P7_Line1b_PreparerGivenName[0]"]  = clean(a.preparer_given_name, 60);
  v["P7_Line2_PreparerNameofBusinessorOrgName[0]"]    = clean(a.preparer_business_name, 80);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_539FieldValues };