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
  const all={"Pt4Line18_MaritalStatus[0]":false,"Pt4Line18_MaritalStatus[1]":false,"Pt4Line18_MaritalStatus[2]":false,"Pt4Line18_MaritalStatus[3]":false,"Pt4Line18_MaritalStatus[4]":false,"Pt4Line18_MaritalStatus[5]":false};
  if(/married|spouse|брак/.test(s))return{...all,"Pt4Line18_MaritalStatus[4]":true};
  if(/single|never|холост/.test(s))return{...all,"Pt4Line18_MaritalStatus[2]":true};
  if(/divorc|развед/.test(s))return{...all,"Pt4Line18_MaritalStatus[5]":true};
  if(/widow|вдов/.test(s))return{...all,"Pt4Line18_MaritalStatus[0]":true};
  if(/annul/.test(s))return{...all,"Pt4Line18_MaritalStatus[1]":true};
  if(/separat/.test(s))return{...all,"Pt4Line18_MaritalStatus[0]":true};
  return {};}

function i_130FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};
  v["Pt4Line44_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Pt4Line1_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["Pt4Line3_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["USCISOnlineAcctNumber[0]"] = digits(a.uscis_online_account_number, 12);
  v["Pt4Line7_CityTownOfBirth[0]"] = clean(a.city_of_birth || a.place_of_birth_city, 60);
  v["Pt4Line45_CountryOfBirth[0]"]  = clean(a.country_of_birth, 60);
  v["Pt4Line22_PassportNumber[0]"] = clean(a.passport_number, 20);
  v["Pt2Line41_StreetNumberName[0]"] = clean(a.mailing_address_line1 || a.current_address_line1 || a.address_line1, 80);
  v["Pt2Line41_AptSteFlrNumber[0]"] = clean(a.mailing_address_line2 || a.address_unit, 10).replace(/^(?:apt|ste|fl|unit|#)\s*\.?\s*/i,'').slice(0,6);
  v["Pt2Line41_CityOrTown[0]"] = clean(a.mailing_city || a.city, 60);
  v["Pt2Line41_State[0]"] = stateCode(a.mailing_state || a.state || '');
  v["Pt2Line41_ZipCode[0]"]   = digits(a.mailing_zip || a.zip_code, 10);
  v["Pt8Line4_DaytimePhoneNumber[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["Pt8Line6_Email[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["Pt8Line8b_DateofSignature[0]"] = dateMdY(today);
  Object.assign(v, maritalFields(a.marital_status || ''));
  v["Pt7Line1a_InterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["Pt7Line1b_InterpreterGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["Pt7Line2_InterpreterBusinessorOrg[0]"]    = clean(a.interpreter_org_name || a.interpreter_business_name, 80);
  v["Pt8Line1a_PreparerFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["Pt8Line1b_PreparerGivenName[0]"]  = clean(a.preparer_given_name, 60);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_130FieldValues };