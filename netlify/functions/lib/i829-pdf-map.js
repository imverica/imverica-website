'use strict';
const { incrementalFillPdf: _unused } = require('./pdf-incremental-fill'); // keep dep for later
const { unitNumber, unitRadio } = require('./form-helpers');

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
  // Part 2 Item 6 (the petitioner). p4Line32Sex is a Part 4 *relative*; the
  // applicant's box is p2Line6Sex, whose states are [0]=Male, [1]=Female
  // (verified). The leading-anchor /^m/ avoids "female" matching as male.
  if(/^m/.test(s))return{"p2Line6Sex[0]":true,"p2Line6Sex[1]":false};
  if(/^f|female/.test(s))return{"p2Line6Sex[0]":false,"p2Line6Sex[1]":true};
  return {};}

function i_829FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  // Part 2 — petitioner identity (field names are meaningful here: p2LineN =
  // Part 2 Item N, render-verified). The old map had NO name fields and sent the
  // A-Number/DOB to p4Line33 / p4Line35 — a *relative's* block in Part 4.
  v["p2Line1afamilyName[0]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);                  // 1.a Family Name
  v["p2Line1bGivenName[0]"]  = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60); // 1.b Given Name
  v["p2Line1cMiddleName[0]"] = clean(a.applicant_middle_name || a.middle_name, 60);                                                            // 1.c Middle Name
  v["p2Line2AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);                  // 2 A-Number (was p4Line33)
  v["p2Line3USCISNum[0]"]    = digits(a.uscis_online_account_number, 12);                // 3 USCIS Online Account
  v["p2Line4SSN[0]"] = digits(a.ssn || a.social_security_number, 9);                     // 4 SSN
  v["p2Line5DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');                  // 5 Date of Birth (was p4Line35)
  v["p2Line7CountryofBirth[0]"]  = clean(a.country_of_birth, 60);                        // 7 Country of Birth
  v["p2Line8CountryCizNatl[0]"]  = clean(a.country_of_citizenship || a.country_of_birth, 60); // 8 Country of Citizenship
  // Item 14 — mailing address.
  v["p2Line14InCareofName[0]"]     = clean(a.mailing_in_care_of || a.in_care_of, 60);
  v["p2Line14StreetNumberName[0]"] = clean(a.mailing_address_line1 || a.address_line1, 80);
  v["p2Line14AptSteFlrNumber[0]"]  = unitNumber(a.mailing_address_line2 || a.address_unit);
  Object.assign(v, unitRadio("p2Line14Unit", a.mailing_address_line2 || a.address_unit)); // Apt/Ste/Flr selector
  v["p2Line14CityOrTown[0]"]       = clean(a.mailing_city || a.city, 60);
  v["p2Line14State[0]"]            = stateCode(a.mailing_state || a.state || '');
  v["p2Line14ZipCode[0]"]          = digits(a.mailing_zip || a.zip_code, 10);
  v["P9_Line1_DaytimePhoneNumber[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["p11Line5Email[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["p11Line6bDateofSignature[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  v["p10Line1aInterpretersFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["p10Line1bInterpretersGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["p11Line1bPreparersGivenName[0]"]  = clean(a.preparer_given_name, 60);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_829FieldValues };