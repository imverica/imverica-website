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
  if(/^m|male/.test(s))return{"Part3_Item8_Sex[0]":true,"Part3_Item8_Sex[1]":false};
  if(/^f|female/.test(s))return{"Part3_Item8_Sex[0]":false,"Part3_Item8_Sex[1]":true};
  return {};}

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"Part3_Item10_MaritalStatus[0]":false,"Part3_Item10_MaritalStatus[1]":false,"Part3_Item10_MaritalStatus[2]":false,"Part3_Item10_MaritalStatus[3]":false,"Part3_Item10_MaritalStatus[4]":false,"Part3_Item10_MaritalStatus[5]":false};
  if(/married|spouse|брак/.test(s))return{...all,"Part3_Item10_MaritalStatus[1]":true};
  if(/single|never|холост/.test(s))return{...all,"Part3_Item10_MaritalStatus[0]":true};
  if(/divorc|развед/.test(s))return{...all,"Part3_Item10_MaritalStatus[2]":true};
  if(/widow|вдов/.test(s))return{...all,"Part3_Item10_MaritalStatus[3]":true};
  if(/annul/.test(s))return{...all,"Part3_Item10_MaritalStatus[5]":true};
  if(/separat/.test(s))return{...all,"Part3_Item10_MaritalStatus[4]":true};
  return {};}

function n_600kFieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["Part9_Item2_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Line1_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  { const an = digits(a.alien_number || a.a_number, 9); if(an) {
    v["Line1_AlienNumber[1]"] = an;
    v["Line1_AlienNumber[0]"] = an;
  }}
  v["Part3_Item4_USCISOnlinAcctNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["Part7_Item3_CountryOfBirth[0]"]  = clean(a.country_of_birth, 60);
  v["Part5_Item9_LostCitizenship[0]"]  = clean(a.country_of_citizenship, 60);
  v["Part12_Item5_Email[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["Part12_Item6_DateofSignature[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  Object.assign(v, maritalFields(a.marital_status || ''));
  v["Part11_Item1_InterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["Part11_Item_InterpreterGivenName[0]"]  = clean(a.interpreter_given_name, 60);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { n_600kFieldValues };