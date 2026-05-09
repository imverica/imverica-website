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
  if(/^m|male/.test(s))return{"Pt2Line10_Gender[1]":true,"Pt2Line10_Gender[0]":false};
  if(/^f|female/.test(s))return{"Pt2Line10_Gender[1]":false,"Pt2Line10_Gender[0]":true};
  return {};}

function i_129sFieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["Pt2Line9_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Pt3Line1_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["Pt2Line3_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["Pt2Line2_USCISELISAcctNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["Pt2Line13_CountryofBirth[0]"]  = clean(a.country_of_birth, 60);
  v["Pt9Line3_PreparerDaytimePhoneNumber1[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["Pt8Line4_InterpreterMobileTelephone[0]"] = usPhone(a.mobile_phone || a.daytime_phone || c.phone);
  v["Pt8Line5_InterpreterEmail[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["Pt9Line6_DateofSignature[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  v["Pt8Line1_InterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["Pt8Line1_InterpreterGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["Pt8Line2_InterpreterBusinessorOrgName[0]"]    = clean(a.interpreter_org_name || a.interpreter_business_name, 80);
  v["Pt9Line1_PreparerFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["Pt9Line1_PreparerGivenName[0]"]  = clean(a.preparer_given_name, 60);
  v["Pt9Line2_PreparerBusinessOrganizationName[0]"]    = clean(a.preparer_business_name, 80);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_129sFieldValues };