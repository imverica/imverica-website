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
function addressLine2(v){return clean(v,12).replace(/^(?:apt|ste|fl|unit|#)\s*\.?\s*/i,'').slice(0,10);}
function firstItem(v){return Array.isArray(v)?(v[0]||{}):(v&&typeof v==='object'?v:{});}

function sexFields(v){const s=clean(v,40).toLowerCase();
  if(/^m/.test(s))return{"P1_Line10_Gender[0]":true,"P1_Line10_Gender[1]":false};
  if(/^f|female/.test(s))return{"P1_Line10_Gender[0]":false,"P1_Line10_Gender[1]":true};
  return {};}

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"P1_Line14_MaritalStatus[0]":false,"P1_Line14_MaritalStatus[1]":false,"P1_Line14_MaritalStatus[2]":false,"P1_Line14_MaritalStatus[3]":false};
  if(/married|spouse|брак/.test(s))return{...all,"P1_Line14_MaritalStatus[1]":true};
  if(/single|never|холост/.test(s))return{...all,"P1_Line14_MaritalStatus[0]":true};
  if(/divorc|развед/.test(s))return{...all,"P1_Line14_MaritalStatus[2]":true};
  if(/widow|вдов/.test(s))return{...all,"P1_Line14_MaritalStatus[3]":true};
  if(/annul/.test(s))return{...all,"P1_Line14_MaritalStatus[0]":true};
  if(/separat/.test(s))return{...all,"P1_Line14_MaritalStatus[0]":true};
  return {};}

function i_821dFieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const residence = firstItem(a.residence_history);
  const v = {};
  v["P1_Line2_Date[0]"] = dateMdY(a.prior_daca_dates);
  v["P1_Line3a_Name[0]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["P1_Line3b_Name[0]"] = clean(a.applicant_given_name || a.given_name || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["P1_Line3c_Name[0]"] = clean(a.applicant_middle_name || a.middle_name, 60);
  v["P1_Line4b_Street[0]"] = clean(a.mailing_address_line1 || a.address_line1, 80);
  v["P1_Line4c_Number[0]"] = addressLine2(a.mailing_address_line2 || a.address_unit);
  v["P1_Line4d_City[0]"] = clean(a.mailing_city || a.city, 60);
  v["P1_Line4e_State[0]"] = stateCode(a.mailing_state || a.state || '');
  v["P1_Line4f_ZipCode[0]"] = digits(a.mailing_zip || a.zip_code, 10);
  v["P1_Line7_ANumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["P1_Line7_ANumber[1]"] = digits(a.alien_number || a.a_number, 9);
  v["P1_Line9_DOB[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["P1_Line8_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["P1_Line11a_CityBirth[0]"] = clean(a.city_of_birth || a.place_of_birth_city, 60);
  v["P1_Line11b_CountryBirth[0]"]  = clean(a.country_of_birth, 60);
  v["P1_Line12_CountryRes[0]"] = clean(a.country_of_residence || a.country_of_citizenship, 60);
  v["P1_Line13_CountryCitz[0]"] = clean(a.country_of_citizenship, 60);
  v["P2_Line9b_Passport[0]"] = clean(a.passport_number, 20);
  v["P2_Line9a_Country[0]"] = clean(a.passport_country_of_issuance, 60);
  v["P2_Line9c_ExpDate[0]"] = dateMdY(a.passport_expiration);
  v["P2_Line2a_Date_From[0]"] = dateMdY(residence.from);
  v["P2_Line2b_Street[0]"] = clean(residence.line1 || a.physical_address_line1, 80);
  v["P2_Line2c_Number[0]"] = addressLine2(residence.line2 || a.physical_address_line2);
  v["P2_Line2d_City[0]"] = clean(residence.city || a.physical_city, 60);
  v["P2_Line2e_State[0]"] = stateCode(residence.state || a.physical_state || '');
  v["P2_Line2f_ZipCode[0]"] = digits(residence.zip || a.physical_zip, 10);
  v["P3_Line2_Date[0]"] = dateMdY(a.date_last_entered_us || a.last_arrival_date);
  v["P3_Line3_Place[0]"] = clean(a.place_entry, 80);
  v["P3_Line4_ImmStatus[0]"] = clean(a.current_immigration_status, 80);
  v["P3_Line5a_I94[0]"]     = clean(a.i94_number, 20);
  v["P3_Line5b_I94Number[0]"] = clean(a.i94_number, 20);
  v["P3_Line5c_I94Date[0]"] = dateMdY(a.authorized_stay_expires || a.status_expiration);
  v["P5_Line3_DayPhone[0]"] = usPhone(a.daytime_phone || a.phone || c.phone);
  v["P5_Line4_MobilePhone[0]"] = usPhone(a.mobile_phone || a.daytime_phone || c.phone);
  v["P5_Line5_Email[0]"] = clean(a.email_address || a.email || c.email, 120);
  v["P5_Line2b_Date[0]"] = dateMdY(today);
  v["P6_Line1a_Name[0]"] = clean(a.interpreter_family_name, 60);
  v["P6_Line1b_Name[0]"] = clean(a.interpreter_given_name, 60);
  v["P6_Line2_Organization[0]"] = clean(a.interpreter_org_name || a.interpreter_business_name, 80);
  v["P6_Line3a_Street[0]"] = clean(a.interpreter_address_line1 || a.mailing_address_line1, 80);
  v["P6_Line3b_Number[0]"] = addressLine2(a.interpreter_address_line2 || a.mailing_address_line2);
  v["P6_Line3c_City[0]"] = clean(a.interpreter_city || a.mailing_city, 60);
  v["P6_Line3d_State[0]"] = stateCode(a.interpreter_state || a.mailing_state || '');
  v["P6_Line3e_ZipCode[0]"] = digits(a.interpreter_zip || a.mailing_zip, 10);
  v["P6_Line3h_Country[0]"] = clean(a.interpreter_country || a.mailing_country, 60);
  v["P6_Line4_DayPhone[0]"] = usPhone(a.interpreter_phone || a.daytime_phone || c.phone);
  v["P6_Line5_Email[0]"] = clean(a.interpreter_email || a.email_address || c.email, 120);
  v["P6Line6b_Date[0]"] = dateMdY(today);
  v["P6_Language[0]"] = clean(a.interpreter_language || a.applicant_statement_language, 40);
  v["P7_Line1a_Name[0]"] = clean(a.preparer_family_name, 60);
  v["P7_Line1b_Name[0]"] = clean(a.preparer_given_name, 60);
  v["P7_Line2_Organization[0]"] = clean(a.preparer_business_name, 80);
  v["P7_Line3a_Street[0]"] = clean(a.preparer_address_line1 || a.mailing_address_line1, 80);
  v["P7_Line3b_Number[0]"] = addressLine2(a.preparer_address_line2 || a.mailing_address_line2);
  v["P7_Line3c_City[0]"] = clean(a.preparer_city || a.mailing_city, 60);
  v["P7_Line3d_State[0]"] = stateCode(a.preparer_state || a.mailing_state || '');
  v["P7_Line3e_ZipCode[0]"] = digits(a.preparer_zip || a.mailing_zip, 10);
  v["P7_Line3h_Country[0]"] = clean(a.preparer_country || a.mailing_country, 60);
  v["P7_Line4_DayPhone[0]"] = usPhone(a.preparer_phone || a.daytime_phone || c.phone);
  v["P7_Line5_MobilePhone[0]"] = usPhone(a.preparer_mobile_phone || a.mobile_phone || c.phone);
  v["P7_Line6_Email[0]"]  = clean(a.preparer_email || a.email_address || a.email || c.email, 120);
  v["P7_Line7b_Date[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  Object.assign(v, maritalFields(a.marital_status || ''));

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_821dFieldValues };
