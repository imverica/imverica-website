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
function addressLine2(v){return clean(v,12).replace(/^(?:apt|ste|fl|unit|#)\s*\.?\s*/i,'').slice(0,10);}
function firstListValue(v){return Array.isArray(v)?clean(v[0],80):clean(v,80).split(/[,;]/)[0];}

function maritalFields(v){const s=clean(v,80).toLowerCase();
  const all={"P2_7_MaritalStatus[0]":false,"P2_7_MaritalStatus[1]":false,"P2_7_MaritalStatus[2]":false,"P2_7_MaritalStatus[3]":false,"P2_7_MaritalStatus[4]":false,"P2_7_MaritalStatus[5]":false,"P2_7_MaritalStatus[6]":false};
  if(/married|spouse|брак/.test(s))return{...all,"P2_7_MaritalStatus[1]":true};
  if(/single|never|холост/.test(s))return{...all,"P2_7_MaritalStatus[0]":true};
  if(/divorc|развед/.test(s))return{...all,"P2_7_MaritalStatus[2]":true};
  if(/widow|вдов/.test(s))return{...all,"P2_7_MaritalStatus[3]":true};
  if(/annul/.test(s))return{...all,"P2_7_MaritalStatus[0]":true};
  if(/separat/.test(s))return{...all,"P2_7_MaritalStatus[0]":true};
  return {};}

function i_912FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};
  v["P2_L2_FamilyName[0]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["P2_L2_GivenName[0]"] = clean(a.applicant_given_name || a.given_name || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["P2_L2_MiddleName[0]"] = clean(a.applicant_middle_name || a.middle_name, 60);
  // Item 3 "Other Names Used (if any)" — aliases / maiden name ONLY. The legal
  // name belongs in Item 2 (P2_L2_*); echoing it here wrongly registers the
  // legal name as an alias, so fill these only from explicit other-name input.
  v["P2_3_FamilyName[0]"] = clean(a.other_family_name || a.maiden_name || a.other_last_name, 60);
  v["P2_3_GivenName[0]"]  = clean(a.other_given_name || a.other_first_name, 60);
  v["P2_3_MiddleName[0]"] = clean(a.other_middle_name, 60);
  v["P2_5_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["P3_Line1_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["P2_Line3_AlienNumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["P2_Line3_AlienNumber[1]"] = digits(a.alien_number || a.a_number, 9);
  v["P2_Line4_AcctIdentifier[0]"] = digits(a.uscis_online_account_number, 12);
  v["P2_Line6_SSN[0]"] = digits(a.ssn || a.social_security_number, 9);
  v["Part3_Line1_TotalForms[0]"] = digits(a.fee_waiver_applicant_count, 2) || '1';
  v["Part3_Line1_FormsFiled1[0]"] = firstListValue(a.fee_waiver_forms) || clean(a.form_code_confirmed, 20);
  v["Part3_Line1_Name1[0]"] = clean(`${a.applicant_given_name || ''} ${a.applicant_family_name || ''}`.trim() || c.name, 80);
  v["Part3_Line1_DateofBirth1[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["Part4_Line1_FullName1[0]"] = clean(`${a.applicant_given_name || ''} ${a.applicant_family_name || ''}`.trim() || c.name, 80);
  v["Part4_Line2a_RelationshipToYou1[0]"] = 'Self';
  v["Part5_Line3_TotalHouseSize[0]"] = digits(a.household_size_fee_waiver || a.household_size, 2);
  v["Part5_Line4_TotalHousehold[0]"] = digits(a.household_size_fee_waiver || a.household_size, 2);
  v["Part5_Line5_NameHousehold[0]"] = clean(`${a.applicant_given_name || ''} ${a.applicant_family_name || ''}`.trim() || c.name, 80);
  v["MonthlyIncome[0]"] = clean(a.household_income || a.current_annual_income, 40);
  v["AvgHousehold[0]"] = clean(a.i912_monthly_expenses_total || a.household_income, 40);
  v["Part5_Line9_Explanation[0]"] = clean(a.hardship_explanation || a.i912_additional_hardship_notes, 900);
  v["P7_L1B_Name[0]"] = clean(a.applicant_given_name || a.given_name, 60);
  v["P7_L2_Name[0]"] = clean(a.applicant_family_name || a.family_name, 60);
  v["P7_L3_DaytimeTelePhoneNumber1[0]"] = usPhone(a.daytime_phone || a.phone || c.phone);
  v["P7_L4_MobileTelePhoneNumber1[0]"] = usPhone(a.mobile_phone || a.daytime_phone || c.phone);
  v["P7_L5_EmailAddress[0]"] = clean(a.email_address || a.email || c.email, 120);
  v["P7_L6_Date[0]"] = dateMdY(a.applicant_signature_date);
  v["P9_L1A_FamilyName[0]"] = clean(a.interpreter_family_name, 60);
  v["P9_L1B_GivenName[0]"] = clean(a.interpreter_given_name, 60);
  v["P9_L2_BusOrgName[0]"] = clean(a.interpreter_org_name || a.interpreter_business_name, 80);
  v["P9_L3A_StreetNumberName[0]"] = clean(a.interpreter_address_line1 || a.mailing_address_line1, 80);
  v["P9_L3B_AptSteFlrNumber[0]"] = addressLine2(a.interpreter_address_line2 || a.mailing_address_line2);
  Object.assign(v, unitRadio("P9_LB_Unit", a.interpreter_address_line2 || a.mailing_address_line2));
  v["P9_L3c_City[0]"] = clean(a.interpreter_city || a.mailing_city, 60);
  v["P9_L3d_State[0]"] = stateCode(a.interpreter_state || a.mailing_state || '');
  v["P9_L3e_ZipCode[0]"] = digits(a.interpreter_zip || a.mailing_zip, 10);
  v["P9_L3h_Country[0]"] = clean(a.interpreter_country || a.mailing_country, 60);
  v["P9_L4_DaytimeTelePhoneNumber1[0]"] = usPhone(a.interpreter_phone || a.daytime_phone || c.phone);
  v["P9_L5_EmailAddress[0]"] = clean(a.interpreter_email || a.email_address || c.email, 120);
  v["P9_L6b_Date[0]"] = dateMdY(a.applicant_signature_date);
  v["P9_Language[0]"] = clean(a.interpreter_language || a.applicant_statement_language, 40);
  v["P10_L1A_FamilyName[0]"] = clean(a.preparer_family_name, 60);
  v["P10_L1b_GivenName[0]"] = clean(a.preparer_given_name, 60);
  v["P10_L2_BusOrgName[0]"] = clean(a.preparer_business_name, 80);
  v["P10_L3a_StreetNumberName[0]"] = clean(a.preparer_address_line1 || a.mailing_address_line1, 80);
  v["P10_L3b_AptSteFlrNumber[0]"] = addressLine2(a.preparer_address_line2 || a.mailing_address_line2);
  Object.assign(v, unitRadio("P10_L3b_Unit", a.preparer_address_line2 || a.mailing_address_line2));
  v["P10_L3c_City[0]"] = clean(a.preparer_city || a.mailing_city, 60);
  v["P10_L3d_State[0]"] = stateCode(a.preparer_state || a.mailing_state || '');
  v["P10_L3e_ZipCode[0]"] = digits(a.preparer_zip || a.mailing_zip, 10);
  v["P10_L3h_Country[0]"] = clean(a.preparer_country || a.mailing_country, 60);
  v["P10_L4_DaytimeTelePhoneNumber1[0]"] = usPhone(a.preparer_phone || a.daytime_phone || c.phone);
  v["P10_L6_EmailAddress[0]"]  = clean(a.preparer_email || a.email_address || a.email || c.email, 120);
  v["P10_L8B_Date[0]"] = dateMdY(a.applicant_signature_date);
  Object.assign(v, maritalFields(a.marital_status || ''));

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_912FieldValues };
