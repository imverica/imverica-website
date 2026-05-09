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
  if(/^m|male/.test(s))return{"Pt1Line3_Gender[0]":true,"Pt1Line3_Gender[1]":false};
  if(/^f|female/.test(s))return{"Pt1Line3_Gender[0]":false,"Pt1Line3_Gender[1]":true};
  return {};}

function i_693FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["Pt1Line1a_FamilyName[11]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["Pt1Line1b_GivenName[11]"]  = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["Pt1Line1c_MiddleName[12]"] = clean(a.applicant_middle_name || a.middle_name || '', 60);
  v["Pt1Line3_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Pt1Line3e_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["Pt1Line3f_USCISOnlineAcctNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["Pt1Line3_CountryofBirth[0]"]  = clean(a.country_of_birth, 60);
  v["Pt1Line2_StreetNumberName[0]"] = clean(a.mailing_address_line1 || a.current_address_line1 || a.address_line1, 80);
  v["Pt7Line7_EmailAddress[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["Pt9Line3_DateSigned[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  v["Pt3Line1_InterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["Pt3Line1_InterpreterGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["Pt3Line_NameOfLanguage[0]"]   = clean(a.interpreter_language, 40);
  v["Pt4Line1_PreparerFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["Pt4Line1_PreparerGivenName[0]"]  = clean(a.preparer_given_name, 60);
  v["Pt4Line2_PreparerNameofBusinessorOrgName[0]"]    = clean(a.preparer_business_name, 80);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_693FieldValues };