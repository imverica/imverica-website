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
  if(/^m/.test(s))return{"P1_Line8_Sex[0]":true,"P1_Line8_Sex[1]":false};
  if(/^f|female/.test(s))return{"P1_Line8_Sex[0]":false,"P1_Line8_Sex[1]":true};
  return {};}

function i_526eFieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};
  // Part 2 — petitioner identity. The template's field NAMES are scrambled, so
  // these are mapped by rendered box (index-probe verified): "P1_Line7" is Item
  // 7 DOB, "P1_Line23CountryofBirth" is Item 11 Country of Birth, etc. The old
  // map had NO name fields, sent DOB to P3_Line33 (a Part 3 box), country of
  // birth to Pt6Line1b (Part 6), and the account to USCISELISAcctNumber (the
  // attorney's box at the top of page 1).
  v["P2_Line4_FamilyName[0]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);                  // 4 Family Name
  v["P2_Line4_GivenName[0]"]  = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60); // 4 Given Name
  v["P2_Line4_MiddleName[0]"] = clean(a.applicant_middle_name || a.middle_name, 60);                                                            // 4 Middle Name
  v["P2_Line1_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);                  // 1 A-Number
  v["P2_Line2_AcctIdentifier[0]"] = digits(a.uscis_online_account_number, 12);             // 2 USCIS Online Account (was attorney box)
  v["P2_Line3_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);                     // 3 SSN
  v["P1_Line7_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');                  // 7 Date of Birth (was P3_Line33)
  v["P1_Line21_CityTownOfBirth[0]"] = clean(a.city_of_birth || a.place_of_birth_city, 60); // 9 City/Town of Birth
  v["P1_Line22_CountryofBirth[0]"]  = clean(a.state_of_birth || a.province_of_birth, 60);  // 10 State/Province of Birth
  v["P1_Line23CountryofBirth[0]"]   = clean(a.country_of_birth, 60);                       // 11 Country of Birth (was Pt6Line1b)
  v["P1_Line24_CountryofBirth[0]"]  = clean(a.country_of_citizenship || a.country_of_birth, 60); // 12 Citizenship/Nationality
  v["Line29_Passport[0]"] = clean(a.passport_number, 20);
  v["P9_Line4_DaytimePhoneNumber[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["P9_Line6_EmailAddress[2]"]  = clean(a.email_address || a.email || c.email, 120);
  v["P12_Line8_DateofSignature[0]"] = dateMdY(a.applicant_signature_date);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  v["P9_Line1a_InterpretersFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["P9_Line1b_InterpretersGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["P10_Line1b_PreparersGivenName[0]"]  = clean(a.preparer_given_name, 60);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_526eFieldValues };