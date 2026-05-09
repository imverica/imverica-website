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
  if(/^m|male/.test(s))return{"p1Line13Gender[1]":true,"p1Line13Gender[0]":false};
  if(/^f|female/.test(s))return{"p1Line13Gender[1]":false,"p1Line13Gender[0]":true};
  return {};}

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"p6Line1MaritalStatus[0]":false,"p6Line1MaritalStatus[1]":false,"p6Line1MaritalStatus[2]":false,"p6Line1MaritalStatus[3]":false,"p6Line1MaritalStatus[4]":false,"p6Line1MaritalStatus[5]":false,"p6Line1MaritalStatus[6]":false};
  if(/married|spouse|брак/.test(s))return{...all,"p6Line1MaritalStatus[6]":true};
  if(/single|never|холост/.test(s))return{...all,"p6Line1MaritalStatus[0]":true};
  if(/divorc|развед/.test(s))return{...all,"p6Line1MaritalStatus[1]":true};
  if(/widow|вдов/.test(s))return{...all,"p6Line1MaritalStatus[2]":true};
  if(/annul/.test(s))return{...all,"p6Line1MaritalStatus[4]":true};
  if(/separat/.test(s))return{...all,"p6Line1MaritalStatus[3]":true};
  return {};}

function i_212FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["p5Line3DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["p1Line1AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["p1Line11SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["USCISELISAcctNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["p5Line5CountryofBirth[0]"]  = clean(a.country_of_birth, 60);
  v["p5Line7CountryCitizenship[0]"]  = clean(a.country_of_citizenship, 60);
  v["p7Line5Email[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["p9Line8bDateofSignature[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  Object.assign(v, maritalFields(a.marital_status || ''));
  v["p8InterpreterLanguage[0]"]   = clean(a.interpreter_language, 40);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_212FieldValues };