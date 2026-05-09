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
  if(/^m|male/.test(s))return{"Part1_Item10_Sex[1]":true,"Part1_Item10_Sex[0]":false};
  if(/^f|female/.test(s))return{"Part1_Item10_Sex[1]":false,"Part1_Item10_Sex[0]":true};
  return {};}

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"Part3_Item1_MaritalStatus[0]":false,"Part3_Item1_MaritalStatus[1]":false,"Part3_Item1_MaritalStatus[2]":false,"Part3_Item1_MaritalStatus[3]":false,"Part3_Item1_MaritalStatus[4]":false};
  if(/married|spouse|брак/.test(s))return{...all,"Part3_Item1_MaritalStatus[1]":true};
  if(/single|never|холост/.test(s))return{...all,"Part3_Item1_MaritalStatus[0]":true};
  if(/divorc|развед/.test(s))return{...all,"Part3_Item1_MaritalStatus[2]":true};
  if(/widow|вдов/.test(s))return{...all,"Part3_Item1_MaritalStatus[3]":true};
  if(/annul/.test(s))return{...all,"Part3_Item1_MaritalStatus[0]":true};
  if(/separat/.test(s))return{...all,"Part3_Item1_MaritalStatus[0]":true};
  return {};}

function i_765vFieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["Part1_Item17_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Part2_Item5_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["Part1_Item4_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["USCISOnlineAccountNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["Part1_Item21_CityTownOfBirth[0]"] = clean(a.city_of_birth || a.place_of_birth_city, 60);
  v["Part2_Item3_CountryOfBirth[0]"]  = clean(a.country_of_birth, 60);
  v["Part2_Item7_Passport[0]"] = clean(a.passport_number, 20);
  v["Part1_Item19_I94[0]"]     = clean(a.i94_number, 20);
  v["Part6_Item4_DaytimePhoneNumber[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["Line4_Email[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["Part6_Item8_DateofSignature[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  Object.assign(v, maritalFields(a.marital_status || ''));
  v["Part5_Item1_InterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["Part5_Item1_InterpreterGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["Part5_Item2_InterpreterOrgName[0]"]    = clean(a.interpreter_org_name || a.interpreter_business_name, 80);
  v["Part6_Item1_PreparerFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["Part6_Item1_PreparerGivenName[0]"]  = clean(a.preparer_given_name, 60);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_765vFieldValues };