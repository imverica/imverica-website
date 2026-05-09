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
  if(/^m|male/.test(s))return{"Part4_Line9_Checkboxes[0]":true,"Part4_Line9_Checkboxes[1]":false};
  if(/^f|female/.test(s))return{"Part4_Line9_Checkboxes[0]":false,"Part4_Line9_Checkboxes[1]":true};
  return {};}

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"Part1_Line8_MaritalStatus[0]":false,"Part1_Line8_MaritalStatus[1]":false,"Part1_Line8_MaritalStatus[2]":false,"Part1_Line8_MaritalStatus[3]":false,"Part1_Line8_MaritalStatus[4]":false,"Part1_Line8_MaritalStatus[5]":false,"Part1_Line8_MaritalStatus[6]":false};
  if(/married|spouse|брак/.test(s))return{...all,"Part1_Line8_MaritalStatus[1]":true};
  if(/single|never|холост/.test(s))return{...all,"Part1_Line8_MaritalStatus[3]":true};
  if(/divorc|развед/.test(s))return{...all,"Part1_Line8_MaritalStatus[5]":true};
  if(/widow|вдов/.test(s))return{...all,"Part1_Line8_MaritalStatus[4]":true};
  if(/annul/.test(s))return{...all,"Part1_Line8_MaritalStatus[0]":true};
  if(/separat/.test(s))return{...all,"Part1_Line8_MaritalStatus[0]":true};
  return {};}

function i_612FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["P4_L23_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["P4_L32_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["Line13_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["P4_L19_CountryOfBirth[0]"]  = clean(a.country_of_birth, 60);
  v["Part8_Line5_MobileTelephoneNumber[0]"] = usPhone(a.mobile_phone || a.daytime_phone || c.phone);
  v["P10_Line6_EmailAddress[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["Part9_Line6b_DateofSignature[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  Object.assign(v, maritalFields(a.marital_status || ''));
  v["Part9_Line1a_InterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["Part9_Line1b_InterpreterGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["Part10_Line1a_PreparerFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["Part10_Line1b_PreparerGivenName[0]"]  = clean(a.preparer_given_name, 60);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_612FieldValues };