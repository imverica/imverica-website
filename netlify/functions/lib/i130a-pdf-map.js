'use strict';
const { incrementalFillPdf: _unused } = require('./pdf-incremental-fill'); // keep dep for later
const { unitRadio } = require("./form-helpers");

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
function firstItem(v){return Array.isArray(v)?(v[0]||{}):(v&&typeof v==='object'?v:{});}
function addressLine2(v){return clean(v,12).replace(/^(?:apt|ste|fl|unit|#)\s*\.?\s*/i,'').slice(0,10);}
function sexFields(v,maleField,femaleField){const s=clean(v,40).toLowerCase();if(/^m/.test(s))return{[maleField]:true,[femaleField]:false};if(/^f|female/.test(s))return{[maleField]:false,[femaleField]:true};return{};}

function i_130aFieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const currentEmployment = firstItem(a.spouse_current_employment);
  const priorEmployment = firstItem(a.spouse_employment_history);
  const lastForeignEmployment = firstItem(a.spouse_last_foreign_employment);
  const v = {};
  v["Pt1Line11_DateofBirth[0]"] = dateMdY(a.spouse_date_of_birth || a.date_of_birth || a.dob || '');
  v["Pt1Line1_AlienNumber[0]"] = digits(a.spouse_alien_number || a.alien_number || a.a_number, 9);
  v["USCISOnlineAcctNumber[0]"] = digits(a.spouse_uscis_online_account_number || a.uscis_online_account_number, 12);
  v["Pt1Line3a_FamilyName[0]"] = clean(a.spouse_family_name || a.applicant_family_name || a.family_name, 60);
  v["Pt1Line3b_GivenName[0]"] = clean(a.spouse_given_name || a.applicant_given_name || a.given_name, 60);
  v["Pt1Line3c_MiddleName[0]"] = clean(a.spouse_middle_name || a.applicant_middle_name || a.middle_name, 60);
  v["Pt1Line12CityTownOfBirth[0]"] = clean(a.spouse_city_of_birth || a.city_of_birth || a.place_of_birth_city, 60);
  v["Pt1Line14_CountryofBirth[0]"]  = clean(a.spouse_country_of_birth || a.country_of_birth, 60);
  v["Pt1Line15_CountryofResidence[0]"] = clean(a.spouse_country_of_residence, 60);
  Object.assign(v, sexFields(a.spouse_sex || a.sex || a.gender, "Pt1Line12_Male[0]", "Pt1Line12_Female[0]"));

  v["Pt1Line4a_StreetNumberName[0]"] = clean(a.spouse_current_address_line1 || a.mailing_address_line1 || a.current_address_line1 || a.address_line1, 80);
  v["Pt1Line4b_AptSteFlrNumber[0]"] = addressLine2(a.spouse_current_address_line2 || a.mailing_address_line2 || a.address_unit);
  Object.assign(v, unitRadio("Pt1Line4b_Unit", a.spouse_current_address_line2 || a.mailing_address_line2 || a.address_unit));
  v["Pt1Line4c_CityOrTown[0]"] = clean(a.spouse_current_city || a.mailing_city || a.city, 60);
  v["Pt1Line4d_State[0]"] = stateCode(a.spouse_current_state || a.mailing_state || a.state || '');
  v["Pt1Line4e_ZipCode[0]"] = digits(a.spouse_current_zip || a.mailing_zip || a.zip_code, 10);
  v["Pt1Line4h_Country[0]"] = clean(a.spouse_current_country || a.mailing_country || 'United States', 60);
  v["Pt1Line5a_DateFrom[0]"] = dateMdY(a.spouse_current_address_from);

  v["Pt2Line1_EmployerOrCompName[0]"] = clean(currentEmployment.name || currentEmployment.company, 80);
  v["Pt2Line2a_StreetNumberName[0]"] = clean(currentEmployment.line1, 80);
  v["Pt2Line2c_CityOrTown[0]"] = clean(currentEmployment.city, 60);
  v["Pt2Line2d_State[0]"] = stateCode(currentEmployment.state || '');
  v["Pt2Line2e_ZipCode[0]"] = digits(currentEmployment.zip, 10);
  v["Pt2Line2h_Country[0]"] = clean(currentEmployment.country, 60);
  v["Pt2Line3_Occupation[0]"] = clean(currentEmployment.occupation || currentEmployment.activity, 60);
  v["Pt2Line4a_DateFrom[0]"] = dateMdY(currentEmployment.from);
  v["Pt2Line4b_DateTo[0]"] = dateMdY(currentEmployment.to);

  v["Pt2Line5_EmployerOrCompName[0]"] = clean(priorEmployment.name || priorEmployment.company, 80);
  v["Pt2Line6_StreetNumberName[0]"] = clean(priorEmployment.line1 || a.spouse_last_foreign_address_line1 || a.mailing_address_line1 || a.current_address_line1 || a.address_line1, 80);
  v["Pt2Line6_AptSteFlrNumber[0]"] = addressLine2(priorEmployment.line2 || a.spouse_last_foreign_address_line2 || a.mailing_address_line2 || a.address_unit);
  Object.assign(v, unitRadio("Pt2Line6_Unit", priorEmployment.line2 || a.spouse_last_foreign_address_line2 || a.mailing_address_line2 || a.address_unit));
  v["Pt2Line6_CityOrTown[0]"] = clean(priorEmployment.city || a.spouse_last_foreign_city || a.mailing_city || a.city, 60);
  v["Pt2Line6_State[0]"] = stateCode(priorEmployment.state || a.mailing_state || a.state || '');
  v["Pt2Line6_ZipCode[0]"] = digits(priorEmployment.zip || a.mailing_zip || a.zip_code, 10);
  v["Pt2Line6_Country[0]"] = clean(priorEmployment.country || a.spouse_last_foreign_country || a.mailing_country, 60);
  v["Pt2Line7_Occupation[0]"] = clean(priorEmployment.occupation || priorEmployment.activity, 60);
  v["Pt2Line8a_DateFrom[0]"] = dateMdY(priorEmployment.from);
  v["Pt2Line8b_DateTo[0]"] = dateMdY(priorEmployment.to);

  v["Pt3Line1_EmployerOrCompName[0]"] = clean(lastForeignEmployment.name || lastForeignEmployment.company, 80);
  v["Pt3Line2a_StreetNumberName[0]"] = clean(lastForeignEmployment.line1, 80);
  v["Pt3Line2c_CityOrTown[0]"] = clean(lastForeignEmployment.city, 60);
  v["Pt3Line2d_State[0]"] = stateCode(lastForeignEmployment.state || '');
  v["Pt3Line2e_ZipCode[0]"] = digits(lastForeignEmployment.zip, 10);
  v["Pt3Line2h_Country[0]"] = clean(lastForeignEmployment.country, 60);
  v["Pt3Line3_Occupation[0]"] = clean(lastForeignEmployment.occupation || lastForeignEmployment.activity, 60);
  v["Pt3Line4a_DateFrom[0]"] = dateMdY(lastForeignEmployment.from);
  v["Pt3Line4b_DateTo[0]"] = dateMdY(lastForeignEmployment.to);

  v["Pt4Line3_DaytimePhoneNumber1[0]"] = usPhone(a.spouse_daytime_phone || a.daytime_phone || a.phone || c.phone);
  v["Pt4Line4_MobileNumber1[0]"] = usPhone(a.spouse_mobile_phone || a.mobile_phone || a.daytime_phone || c.phone);
  v["Pt4Line5_Email[0]"] = clean(a.spouse_email_address || a.email_address || a.email || c.email, 120);
  v["Pt6Line4_DaytimePhoneNumber[0]"]  = usPhone(a.preparer_phone || a.daytime_phone || a.phone || c.phone);
  v["Pt6Line6_Email[0]"]  = clean(a.preparer_email || a.email_address || a.email || c.email, 120);
  v["Pt6Line8b_DateofSignature[0]"] = dateMdY(today);
  v["Pt5Line1a_InterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["Pt5Line1b_InterpreterGivenName[0]"]  = clean(a.interpreter_given_name, 60);
  v["Pt5Line2_InterpreterBusinessorOrg[0]"]    = clean(a.interpreter_org_name || a.interpreter_business_name, 80);
  v["Pt5_NameofLanguage[0]"] = clean(a.interpreter_language || a.spouse_statement_language, 40);
  v["Pt6Line1a_PreparerFamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["Pt6Line1b_PreparerGivenName[0]"]  = clean(a.preparer_given_name, 60);
  v["Pt6Line2_BusinessName[0]"] = clean(a.preparer_business_name, 80);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_130aFieldValues };
