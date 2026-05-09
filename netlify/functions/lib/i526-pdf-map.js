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
  if(/^m|male/.test(s))return{"P1_Line7_Gender[0]":true,"P1_Line7_Gender[1]":false};
  if(/^f|female/.test(s))return{"P1_Line7_Gender[0]":false,"P1_Line7_Gender[1]":true};
  return {};}

function i_526FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["P2_Line1_FamilyName[0]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["P2_Line1_GivenName[0]"]  = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["P2_Line1_MiddleName[0]"] = clean(a.applicant_middle_name || a.middle_name || '', 60);
  v["P2_Line34_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["P1_Line1_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["P1_Line16_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["USCISELISAcctNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["P1_Line8_CityTownOfBirth[0]"] = clean(a.city_of_birth || a.place_of_birth_city, 60);
  v["P2_Line17_CountryOfBirth[0]"]  = clean(a.country_of_birth, 60);
  v["Pt6_Line1b_CountryofCitizenship[0]"]  = clean(a.country_of_citizenship, 60);
  v["P1_Line23_CountryIssuedPassport[0]"] = clean(a.passport_number, 20);
  v["P10_Line4_PreparersDaytimePhoneNumber[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["P10_Line6_PreparersEmailAddress[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["P9_Line8_DateofSignature[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  v["P8_Line1_InterpretersFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["P8_Line1_InterpretersGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["P9_Line1_PreparersGivenName[0]"]  = clean(a.preparer_given_name, 60);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_526FieldValues };