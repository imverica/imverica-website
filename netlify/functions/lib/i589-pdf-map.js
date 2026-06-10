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
function phoneParts(v){const r=usPhone(v);return{area:r.slice(0,3),number:r.slice(3)};}
function addressLine2(v){return clean(v,12).replace(/^(?:apt|ste|fl|unit|#)\s*\.?\s*/i,'').slice(0,10);}
function yesNoFields(value, yesField, noField){const yn=yesNo(value);if(yn===true)return{[yesField]:true,[noField]:false};if(yn===false)return{[yesField]:false,[noField]:true};return{};}

// Part A.I Item 10 Sex. The applicant's box is PartALine9Sex ([0]=Male,
// [1]=Female, render-verified); CheckBox12_Sex (used before) is a different
// page's field and left Item 10 blank.
function sexFields(v){const s=clean(v,40).toLowerCase();
  if(/^m/.test(s))return{"PartALine9Sex[0]":true,"PartALine9Sex[1]":false};
  if(/^f|female|жен|жiн/.test(s))return{"PartALine9Sex[0]":false,"PartALine9Sex[1]":true};
  return {};}
function maritalFields(v){const s=clean(v,80).toLowerCase();const all={"Marital[0]":false,"Marital[1]":false,"Marital[2]":false,"Marital[3]":false};if(/single|never|холост/.test(s))return{...all,"Marital[0]":true};if(/married|spouse|брак/.test(s))return{...all,"Marital[1]":true};if(/divorc|развед/.test(s))return{...all,"Marital[2]":true};if(/widow|вдов/.test(s))return{...all,"Marital[3]":true};return{};}

function i_589FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const residentialPhone = phoneParts(a.daytime_phone || a.phone || c.phone);
  const mailingPhone = phoneParts(a.daytime_phone || a.phone || c.phone);
  const v = {};
  v["PtAILine1_ANumber[0]"] = digits(a.alien_number || a.a_number, 9);
  v["PtAILine1_ANumber[1]"] = digits(a.alien_number || a.a_number, 9);
  // Items 2 & 3 — the descriptive USCISOnlineAcctNumber field does not render in
  // the visible Part A.I boxes; those boxes are the generic TextField1 group
  // (render-verified by index probe): [0]=2 SSN, [8]=3 USCIS Online Account.
  v["TextField1[0]"] = digits(a.ssn || a.social_security_number, 9);            // 2 U.S. Social Security Number (if any)
  v["TextField1[8]"] = digits(a.uscis_online_account_number, 12);              // 3 USCIS Online Account Number (if any)
  v["PtAILine4_LastName[0]"] = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["PtAILine5_FirstName[0]"] = clean(a.applicant_given_name || a.given_name || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["PtAILine6_MiddleName[0]"] = clean(a.applicant_middle_name || a.middle_name, 60);
  // Items 13/14/15 — birthplace & nationality (render-verified TextField1 group).
  v["TextField1[4]"] = [clean(a.city_of_birth || a.place_of_birth_city, 60), clean(a.country_of_birth, 60)].filter(Boolean).join(', '); // 13 City and Country of Birth
  v["TextField1[3]"] = clean(a.country_of_citizenship || a.country_of_birth, 60);  // 14 Present Nationality (Citizenship)
  v["TextField1[5]"] = clean(a.nationality_at_birth || a.country_of_citizenship || a.country_of_birth, 60); // 15 Nationality at Birth
  v["DateTimeField1[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["PtAILine8_StreetNumandName[0]"] = clean(a.i589_residential_address_line1 || a.mailing_address_line1 || a.address_line1, 80);
  v["PtAILine8_AptNumber[0]"] = addressLine2(a.i589_residential_address_line2 || a.mailing_address_line2 || a.address_unit);
  v["TextField1[2]"] = clean(a.i589_residential_city || a.mailing_city || a.city, 60); // 8 Residence City (render-verified)
  v["PtAILine8_State[0]"] = stateCode(a.i589_residential_state || a.mailing_state || a.state || '');
  v["PtAILine8_Zipcode[0]"] = digits(a.i589_residential_zip || a.mailing_zip || a.zip_code, 10);
  v["PtAILine8_AreaCode[0]"] = residentialPhone.area;
  v["PtAILine8_TelephoneNumber[0]"] = residentialPhone.number;
  v["PtAILine9_StreetNumandName[0]"] = clean(a.mailing_address_line1 || a.address_line1, 80);
  v["PtAILine9_AptNumber[0]"] = addressLine2(a.mailing_address_line2 || a.address_unit);
  v["PtAILine9_City[0]"] = clean(a.mailing_city || a.city, 60);
  v["PtAILine9_State[0]"] = stateCode(a.mailing_state || a.state || '');
  v["PtAILine9_ZipCode[0]"] = digits(a.mailing_zip || a.zip_code, 10);
  v["PtAILine9_AreaCode[0]"] = mailingPhone.area;
  v["PtAILine9_TelephoneNumbe[0]"] = mailingPhone.number;
  v["DateTimeField2[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["DateTimeField6[0]"] = dateMdY(a.passport_expiration);
  v["PtAIILine14_PlaceofLastEntry[0]"] = clean(a.place_entry, 80);
  v["PtAIILine16_I94Number[0]"] = clean(a.i94_number, 20);
  v["PtAIILine17_DateofLastEntry[0]"] = dateMdY(a.date_last_entered_us || a.last_arrival_date);
  v["PtAIILine17_StatusofLastAdmission[0]"] = clean(a.current_immigration_status, 80);
  v["PtAIILine21_ExpDateofAuthorizedStay[0]"] = dateMdY(a.authorized_stay_expires || a.status_expiration);
  v["PtAIILine5_LastName[0]"] = clean(a.spouse_family_name, 60);
  v["PtAIILine6_FirstName[0]"] = clean(a.spouse_given_name, 60);
  v["PtAIILine7_MiddleName[0]"] = clean(a.spouse_middle_name, 60);
  v["DateTimeField8[0]"] = dateMdY(a.spouse_date_of_birth);
  v["PtAIILine16_I94Number2[0]"] = clean(a.spouse_i94_number || a.i94_number, 20);
  v["PtAIILine20_SpouseCurrentStatus[0]"] = clean(a.spouse_current_status || a.current_immigration_status, 80);
  v["ChildLast1[0]"] = clean(a.child1_family_name, 60);
  v["ChildFirst1[0]"] = clean(a.child1_given_name, 60);
  v["ChildMiddle1[0]"] = clean(a.child1_middle_name, 60);
  v["ChildDOB1[0]"] = dateMdY(a.child1_dob);
  v["ChildCity1[0]"] = clean(a.child1_city_of_birth || a.city_of_birth, 60);
  v["ChildAlien1[0]"] = digits(a.child1_alien_number, 9);
  v["ChildPassport1[0]"] = clean(a.child1_passport_number, 20);
  v["ApplicantName[0]"] = clean(`${a.applicant_given_name || ''} ${a.applicant_family_name || ''}`.trim() || c.name, 100);
  v["PtD_ChildName1[0]"] = clean(`${a.child1_given_name || ''} ${a.child1_family_name || ''}`.trim(), 100);
  v["PtD_RelationshipOfChild1[0]"] = clean(a.child1_relationship || 'Child', 40);
  Object.assign(v, yesNoFields(a.i589_spouse_included, "PtAIILine22_Yes[0]", "PtAIILine22_No[0]"));
  Object.assign(v, yesNoFields(a.i589_has_spouse, "CheckBox17[0]", "CheckBox17[1]"));
  Object.assign(v, yesNoFields(a.total_children && Number(a.total_children) > 0 ? 'Yes' : '', "ChildrenCheckbox[0]", "ChildrenCheckbox[1]"));
  v["PtE_PreparerName[0]"] = clean(`${a.preparer_given_name || ''} ${a.preparer_family_name || ''}`.trim(), 100);
  v["PtE_StreetNumAndName[0]"] = clean(a.preparer_address_line1 || a.mailing_address_line1, 80);
  v["PtE_AptNumber[0]"] = addressLine2(a.preparer_address_line2 || a.mailing_address_line2);
  v["PtE_City[0]"] = clean(a.preparer_city || a.mailing_city, 60);
  v["PtE_State[0]"] = stateCode(a.preparer_state || a.mailing_state || '');
  v["PtE_ZipCode[0]"] = digits(a.preparer_zip || a.mailing_zip, 10);
  v["DateTimeField57[0]"] = dateMdY(today);
  Object.assign(v, sexFields(a.sex || a.gender || ''));
  Object.assign(v, maritalFields(a.marital_status || ''));

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { i_589FieldValues };
