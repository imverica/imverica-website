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

function sexFields(v){const s=clean(v,40).toLowerCase();
  if(/^m|male/.test(s))return{"P2_Line7_Gender[0]":true,"P2_Line7_Gender[1]":false};
  if(/^f|female/.test(s))return{"P2_Line7_Gender[0]":false,"P2_Line7_Gender[1]":true};
  return {};}

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"P10_Line1_MaritalStatus[0]":false,"P10_Line1_MaritalStatus[1]":false,"P10_Line1_MaritalStatus[2]":false,"P10_Line1_MaritalStatus[3]":false,"P10_Line1_MaritalStatus[4]":false,"P10_Line1_MaritalStatus[5]":false};
  if(/married|spouse|брак/.test(s))return{...all,"P10_Line1_MaritalStatus[3]":true};
  if(/single|never|холост/.test(s))return{...all,"P10_Line1_MaritalStatus[1]":true};
  if(/divorc|развед/.test(s))return{...all,"P10_Line1_MaritalStatus[0]":true};
  if(/widow|вдов/.test(s))return{...all,"P10_Line1_MaritalStatus[2]":true};
  if(/annul/.test(s))return{...all,"P10_Line1_MaritalStatus[4]":true};
  if(/separat/.test(s))return{...all,"P10_Line1_MaritalStatus[5]":true};
  return {};}

function n_400FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["P2_Line1_FamilyName[1]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["P2_Line1_GivenName[1]"]  = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["P2_Line1_MiddleName[1]"] = clean(a.applicant_middle_name || a.middle_name || '', 60);
  v["P10_Line4d_DateofBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Line1_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  { const an = digits(a.alien_number || a.a_number, 9); if(an) {
    v["Line1_AlienNumber[12]"] = an;
    v["Line1_AlienNumber[11]"] = an;
    v["Line1_AlienNumber[10]"] = an;
    v["Line1_AlienNumber[9]"] = an;
    v["Line1_AlienNumber[8]"] = an;
    v["Line1_AlienNumber[7]"] = an;
    v["Line1_AlienNumber[6]"] = an;
    v["Line1_AlienNumber[5]"] = an;
    v["Line1_AlienNumber[4]"] = an;
    v["Line1_AlienNumber[3]"] = an;
    v["Line1_AlienNumber[2]"] = an;
    v["Line1_AlienNumber[1]"] = an;
    v["Line1_AlienNumber[0]"] = an;
    v["Line1_AlienNumber[13]"] = an;
  }}
  v["P9_Line22c_SSNumber[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["P2_Line6_USCISELISAcctNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["P2_Line10_CountryOfBirth[0]"]  = clean(a.country_of_birth, 60);
  v["P4_Line1_StreetName[0]"] = clean(a.mailing_address_line1 || a.current_address_line1 || a.address_line1, 80);
  v["P4_Line1_Number[0]"] = clean(a.mailing_address_line2 || a.address_unit, 10).replace(/^(?:apt|ste|fl|unit|#)\s*\.?\s*/i,'').slice(0,6);
  v["P4_Line1_City[0]"] = clean(a.mailing_city || a.city, 60);
  v["P4_Line1_State[0]"] = stateCode(a.mailing_state || a.state || '');
  v["P4_Line1_ZipCode[0]"]   = digits(a.mailing_zip || a.zip_code, 10);
  v["P14_Line4_Telephone[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["P14_Line5_Mobile[0]"] = usPhone(a.mobile_phone || a.daytime_phone || c.phone);
  v["P14_Line5_EmailAddress[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["Part15DateofSignature[1]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  Object.assign(v, maritalFields(a.marital_status || ''));
  v["P14_Line1_nterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["P14_Line1_nterpreterGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["P14_Line2_NameofBusinessorOrgName[0]"]    = clean(a.interpreter_org_name || a.interpreter_business_name, 80);
  v["P14_NameOfLanguage[0]"]   = clean(a.interpreter_language, 40);
  v["P15_Line1_PreparerFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["P15_Line1_PreparerGivenName[0]"]  = clean(a.preparer_given_name, 60);
  v["P15_Line2_NameofBusinessorOrgName[0]"]    = clean(a.preparer_business_name, 80);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { n_400FieldValues };