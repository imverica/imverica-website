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

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"Pt3_Line8_MaritalStatus[0]":false,"Pt3_Line8_MaritalStatus[1]":false,"Pt3_Line8_MaritalStatus[2]":false,"Pt3_Line8_MaritalStatus[3]":false,"Pt3_Line8_MaritalStatus[4]":false,"Pt3_Line8_MaritalStatus[5]":false,"Pt3_Line8_MaritalStatus[6]":false};
  if(/married|spouse|брак/.test(s))return{...all,"Pt3_Line8_MaritalStatus[1]":true};
  if(/single|never|холост/.test(s))return{...all,"Pt3_Line8_MaritalStatus[0]":true};
  if(/divorc|развед/.test(s))return{...all,"Pt3_Line8_MaritalStatus[2]":true};
  if(/widow|вдов/.test(s))return{...all,"Pt3_Line8_MaritalStatus[3]":true};
  if(/annul/.test(s))return{...all,"Pt3_Line8_MaritalStatus[5]":true};
  if(/separat/.test(s))return{...all,"Pt3_Line8_MaritalStatus[4]":true};
  return {};}

function i_134FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["Pt1Line1_FamilyName[0]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["Pt1Line1_GivenName[0]"]  = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["Pt1Line1_MiddleName[0]"] = clean(a.applicant_middle_name || a.middle_name || '', 60);
  v["P2_Line8_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Pt3Line5_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["Pt2Line10_State[0]"] = stateCode(a.mailing_state || a.state || '');
  v["Pt2Line10_ZipCode[0]"]   = digits(a.mailing_zip || a.zip_code, 10);
  v["P3_Line4_DaytimeTelePhoneNumber[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["Pt7Line3_MobileTelephoneNum[0]"] = usPhone(a.mobile_phone || a.daytime_phone || c.phone);
  v["Pt7Line6_Email[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["Pt7Line8_DateofSignature[0]"] = dateMdY(today);
  Object.assign(v, maritalFields(a.marital_status || ''));
  v["P4_Line1_InterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["P4_Line1_InterpreterGivenName[0]"]  = clean(a.interpreter_given_name, 60);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_134FieldValues };