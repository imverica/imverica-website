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
  if(/^m|male/.test(s))return{"P6_L1_Sex[0]":true,"P6_L1_Sex[1]":false};
  if(/^f|female/.test(s))return{"P6_L1_Sex[0]":false,"P6_L1_Sex[1]":true};
  return {};}

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"P6_MaritalStatus[0]":false,"P6_MaritalStatus[1]":false,"P6_MaritalStatus[2]":false,"P6_MaritalStatus[3]":false,"P6_MaritalStatus[4]":false,"P6_MaritalStatus[5]":false};
  if(/married|spouse|брак/.test(s))return{...all,"P6_MaritalStatus[1]":true};
  if(/single|never|холост/.test(s))return{...all,"P6_MaritalStatus[0]":true};
  if(/divorc|развед/.test(s))return{...all,"P6_MaritalStatus[2]":true};
  if(/widow|вдов/.test(s))return{...all,"P6_MaritalStatus[3]":true};
  if(/annul/.test(s))return{...all,"P6_MaritalStatus[0]":true};
  if(/separat/.test(s))return{...all,"P6_MaritalStatus[0]":true};
  return {};}

function i_590FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["P7_L3_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Linef_CurrentSpouseSSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["P7_L3_PlaceOfBirth[0]"] = clean(a.city_of_birth || a.place_of_birth_city, 60);
  v["P11_LE_TelePhoneNumber[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["P11_LF_EmailAddress[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["P12__DateofSignature[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  Object.assign(v, maritalFields(a.marital_status || ''));

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_590FieldValues };