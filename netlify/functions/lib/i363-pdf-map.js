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

function i_363FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["P1_Line2_DateofBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["P1_Line4_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["P1_Line5_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["USCISOnlineAcctNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["P2_Line4_CountryofBirth[0]"]  = clean(a.country_of_birth, 60);
  v["Pt1Line14_State[0]"] = stateCode(a.mailing_state || a.state || '');
  v["Pt1Line14_ZipCode[0]"]   = digits(a.mailing_zip || a.zip_code, 10);
  v["Line3_DaytimePhoneNumber1[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["Line4_Email[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["Line5b_DateofSignature[0]"] = dateMdY(today);
  v["Line1a_PreparerFamilyName[1]"] = clean(a.preparer_family_name, 60);
  v["Line1b_PreparerGivenName[2]"]  = clean(a.preparer_given_name, 60);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_363FieldValues };