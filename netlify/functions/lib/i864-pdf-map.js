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

function i_864FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["P3_Line10_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["P3_Line11_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["P4_Line10_SocialSecurityNumber[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["Pt2_Line6_USCISOnlineAcctNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["P2_Line3_CountryCitizenship[0]"]  = clean(a.country_of_citizenship, 60);
  v["P9_Line4_InterpretersDaytimePhoneNumber[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["P8_Line4_MobileTelephoneNumber[0]"] = usPhone(a.mobile_phone || a.daytime_phone || c.phone);
  v["P9_Line5_InterpretersEmailAddress[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["P9_Line6b_DateofSignature[0]"] = dateMdY(today);
  v["P9_Line1a_InterpretersFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["P9_Line1b_InterpretersGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["P8Line2_InterpretersBusinessName[0]"]    = clean(a.interpreter_org_name || a.interpreter_business_name, 80);
  v["P10_Line1a_PreparersFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["P10_Line1b_PreparersGivenName[0]"]  = clean(a.preparer_given_name, 60);
  v["P10_Line2_PreparersBusinessName[0]"]    = clean(a.preparer_business_name, 80);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_864FieldValues };