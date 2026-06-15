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
  if(/^m/.test(s))return{"P2_Line4_Gender[0]":true,"P2_Line4_Gender[1]":false};
  if(/^f|female/.test(s))return{"P2_Line4_Gender[0]":false,"P2_Line4_Gender[1]":true};
  return {};}

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"P2_Line9_MaritalStatus[6]":false,"P2_Line9_MaritalStatus[5]":false,"P2_Line9_MaritalStatus[4]":false,"P2_Line9_MaritalStatus[3]":false,"P2_Line9_MaritalStatus[2]":false,"P2_Line9_MaritalStatus[1]":false,"P2_Line9_MaritalStatus[0]":false,"P3_Line14_MaritalStatus[3]":false,"P3_Line14_MaritalStatus[2]":false,"P3_Line14_MaritalStatus[1]":false,"P3_Line14_MaritalStatus[0]":false};
  if(/married|spouse|брак/.test(s))return{...all,"P2_Line9_MaritalStatus[1]":true};
  if(/single|never|холост/.test(s))return{...all,"P2_Line9_MaritalStatus[0]":true};
  if(/divorc|развед/.test(s))return{...all,"P3_Line14_MaritalStatus[3]":true};
  if(/widow|вдов/.test(s))return{...all,"P3_Line14_MaritalStatus[0]":true};
  if(/annul/.test(s))return{...all,"P3_Line14_MaritalStatus[2]":true};
  if(/separat/.test(s))return{...all,"P3_Line14_MaritalStatus[1]":true};
  return {};}

function i_134aFieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};
  v["P2_Line1_FamilyName[0]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["P2_Line1_GivenName[0]"]  = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["P2_Line1_MiddleName[0]"] = clean(a.applicant_middle_name || a.middle_name || '', 60);
  v["P2_Line3_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["P2_Line5_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["P_Line12_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["P2_Line8_PassportNumber[0]"] = clean(a.passport_number, 20);
  v["P3_Line14_I94[0]"]     = clean(a.i94_number, 20);
  v["P2_Line14_MobilePhoneNumber[0]"]  = usPhone(a.daytime_phone || a.phone || c.phone);
  v["P7_Line3_MobileTelephoneNum[0]"] = usPhone(a.mobile_phone || a.daytime_phone || c.phone);
  v["P2_Line15_EmailAddress[0]"]  = clean(a.email_address || a.email || c.email, 120);
  v["P5_Line6_DateOfSignature[0]"] = dateMdY(a.applicant_signature_date);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  Object.assign(v, maritalFields(a.marital_status || ''));
  v["P6_Line1_InterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["P6_Line1_InterpreterGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["P7_Line1_PreparerFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["P7_Line1_PreparerGivenName[0]"]  = clean(a.preparer_given_name, 60);
  v["P7_Line2_PreparerNameofBusinessorOrgName[0]"]    = clean(a.preparer_business_name, 80);

  // ----- Beneficiary: place of birth, citizenship, passport, address, phone -----
  // (Part 2 of I-134A. Field LINE numbers differ from the printed item numbers;
  //  mapped by the /TU tooltip semantics, verified against the real PDF.)
  v["P2_Line6_CityOrTown[0]"]       = clean(a.city_of_birth || a.place_of_birth_city, 60);
  v["P2_Line6_StateOrProvince[0]"]  = clean(a.state_of_birth || a.place_of_birth_state, 60);
  v["P2_Line6_Country[0]"]          = clean(a.country_of_birth || a.place_of_birth_country, 60);
  v["P2_Line7_CountryOfCitizen[0]"] = clean(a.country_of_citizenship || a.country_of_birth, 60);
  v["P2_Line8_CountryPassportIssue[0]"] = clean(a.passport_country_of_issuance || a.country_of_citizenship || a.country_of_birth, 60);
  v["P2_Line8_ExpirationDate[0]"]   = dateMdY(a.passport_expiration || '');
  v["P2_Line13_DaytimePhoneNumber[0]"] = usPhone(a.daytime_phone || a.phone || c.phone);

  // Beneficiary's mailing address (Part 2, internal Line10).
  const _mStreet = clean(a.mailing_address_line1 || a.address_line1, 80);
  v["P2_Line10_StreetName[0]"] = _mStreet;
  v["P2_Line10_City[0]"]       = clean(a.mailing_city || a.city, 60);
  v["P2_Line10_State[0]"]      = stateCode(a.mailing_state || a.state || '');
  v["P2_Line10_ZipCode[0]"]    = digits(a.mailing_zip || a.zip_code, 10);
  const _mUnitRaw = clean(a.mailing_address_line2 || a.address_unit || '', 16);
  if (_mUnitRaw) {
    v["P2_Line10_Number[0]"] = _mUnitRaw.replace(/^(?:apt|ste|fl(?:oor)?|unit|#)\.?\s*/i,'').trim().slice(0,10);
    if (/\bste/i.test(_mUnitRaw)) v["P2_Line10_Unit[1]"] = true;        // STE
    else if (/\bfl/i.test(_mUnitRaw)) v["P2_Line10_Unit[2]"] = true;    // FLR
    else v["P2_Line10_Unit[0]"] = true;                                 // APT (default)
  }

  // Item: "Is the mailing address the same as the physical address?" (Line_11 Y/N).
  const _pStreet = clean(a.physical_address_line1 || '', 80);
  const _same = !_pStreet || _pStreet === _mStreet;
  v["P2_Line_11[0]"] = _same;     // Yes
  v["P2_Line_11[1]"] = !_same;    // No
  if (!_same) {
    v["P2_Line12_PhysicalStreetName[0]"] = _pStreet;
    v["P2_Line12_City[0]"]    = clean(a.physical_city || a.city, 60);
    v["P2_Line12_State[0]"]   = stateCode(a.physical_state || a.state || '');
    v["P2_Line12_ZipCode[0]"] = digits(a.physical_zip || a.zip_code, 10);
  }

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_134aFieldValues };