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

function i_918FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["Pt1Line1a_FamilyName[0]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["Pt1Line1b_GivenName[0]"]  = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["Pt1Line1c_MiddleName[0]"] = clean(a.applicant_middle_name || a.middle_name || '', 60);
  // Part 1 identity (render-verified). The old map pointed DOB/country-of-birth
  // at P4_Line2/P4_Line3 (Part 4 = a *relative's* block) and the USCIS account
  // at USCISELISAcctNumber (the *attorney's* box at the top of page 1). Correct
  // Part 1 fields: Item 5 A-Number, 6 SSN, 7 USCIS account, 10 DOB, 11 country
  // of birth, 12 citizenship.
  v["P1_Line5_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["P1_Line6_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["P1_Line7_USCISELISAcctNumber[0]"] = digits(a.uscis_online_account_number, 12); // 7 USCIS Online Account
  v["P1_Line10_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');           // 10 Date of Birth
  v["P1_Line11_CountryOfBirth[0]"]  = clean(a.country_of_birth, 60);                 // 11 Country of Birth
  v["P1_Line12_CountryOfCitizenship[0]"]  = clean(a.country_of_citizenship, 60);     // 12 Country of Citizenship
  v["P1_Line14_PassportNumber[0]"] = clean(a.passport_number, 20);
  // Item 4 — Safe Mailing Address (in care of / street / unit / city / state / zip).
  v["P1_Line4a_InCareofName[0]"]     = clean(a.safe_mailing_in_care_of || a.in_care_of, 60);
  v["P1_Line4b_StreetNumberName[0]"] = clean(a.mailing_address_line1 || a.current_address_line1 || a.address_line1, 80);
  v["P1_Line4c_AptSteFlrNumber[0]"]  = clean(a.mailing_address_line2 || a.address_unit, 12).replace(/^(?:apt|ste|fl|unit|#)\s*\.?\s*/i,'').slice(0,10);
  v["P1_Line4d_CityTown[0]"]         = clean(a.mailing_city || a.city, 60);
  v["P1_Line4e_State[0]"]            = stateCode(a.mailing_state || a.state || '');
  v["P1_Line4f_ZipCode[0]"]          = digits(a.mailing_zip || a.zip_code, 10);
  v["P6_Line5_EmailAddress[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["P6_Line1a_InterpretersFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["P6_Line1b_InterpretersGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["P7_Line1a_PreparersFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["P7_Line1b_PreparersGivenName[0]"]  = clean(a.preparer_given_name, 60);
  v["P7_Line2_PreparersBusinessName[0]"]    = clean(a.preparer_business_name, 80);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_918FieldValues };