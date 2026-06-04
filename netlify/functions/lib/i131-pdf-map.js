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

function isUS(country){const t=clean(country,40).toLowerCase();return !t || /united states|u\.?s\.?a?\b|usa|америк|сша/.test(t);}

// Fill an I-131 address group (P2_Line24_ mailing / P2_Line25_ physical).
function i131Address(v, g, addr){
  if(!addr) return;
  v[g+"StreetNumberName[0]"] = clean(addr.line1, 80);
  v[g+"CityTown[0]"]         = clean(addr.city, 60);
  v[g+"ZipCode[0]"]          = digits(addr.zip, 10);
  if(isUS(addr.country)){ v[g+"State[0]"] = stateCode(addr.state); }
  else { v[g+"Province[0]"] = clean(addr.state, 40); v[g+"Country[0]"] = clean(addr.country, 60); }
}

/**
 * I-131 — Application for Travel Document. Applicant info is Part 2.
 * Field targets verified against i-131.pdf /TU tooltips. Reads the wizard's
 * i131_-prefixed keys (the I-131 flow uses its own prefix). Identity +
 * address this round; trip/document-type sections need their own pass.
 */
function i_131FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};

  // Applicant identity (Part 2). Item 1 "Your Full Name" = Part2_Line1_*
  // (NOT P2_Line16, which is a later/secondary name field).
  v["Part2_Line1_FamilyName[0]"] = clean(a.i131_family_name || a.applicant_family_name, 60);
  v["Part2_Line1_GivenName[0]"]  = clean(a.i131_given_name || a.applicant_given_name, 60);
  v["Part2_Line1_MiddleName[0]"] = clean(a.i131_middle_name || a.applicant_middle_name, 60);
  // The APPLICANT'S OWN block uses Part2_LineN_ (the P2_LineN_ block is a
  // different "their" person — verified by render). Items: 5=A#, 6=country
  // of birth, 7=citizenship, 8=sex, 9=DOB, 10=SSN, 3=mailing, 4=physical.
  v["Part2_Line5_AlienNumber[0]"] = digits(a.i131_alien_number || a.alien_number || a.a_number, 9);
  v["Part2_Line10_SSN[0]"]        = digits(a.i131_ssn || a.ssn || a.social_security_number, 9);
  v["Part2_Line9_DateOfBirth[0]"] = dateMdY(a.i131_date_of_birth || a.date_of_birth || a.dob);
  v["Part2_Line6_CountryOfBirth[0]"]                 = clean(a.i131_country_of_birth || a.country_of_birth, 60);
  v["Part2_Line7_CountryOfCitizenshiporNationality[0]"] = clean(a.i131_country_of_citizenship || a.country_of_citizenship, 60);
  // Sex checkbox: [1] = Male, [0] = Female.
  const sx = clean(a.i131_sex || a.sex || a.gender, 20).toLowerCase();
  if(/^m|male|муж/.test(sx)) v["Part2_Line8_Gender[1]"]=true;
  else if(/^f|female|жен/.test(sx)) v["Part2_Line8_Gender[0]"]=true;

  // Mailing address (Part 2, item 3)
  const mailing = {
    line1: a.i131_mailing_address_line1, line2: a.i131_mailing_address_line2,
    city: a.i131_mailing_city, state: a.i131_mailing_state,
    zip: a.i131_mailing_zip, country: a.i131_mailing_country
  };
  i131Address(v, "Part2_Line3_", mailing);

  // Physical address (item 4) — reuse mailing if same.
  const same = /^y|yes|да|так/i.test(clean(a.i131_physical_same_as_mailing, 10));
  i131Address(v, "Part2_Line4_", same ? mailing : {
    line1: a.i131_physical_address_line1, line2: a.i131_physical_address_line2,
    city: a.i131_physical_city, state: a.i131_physical_state,
    zip: a.i131_physical_zip, country: a.i131_physical_country
  });

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val===true||(val!==undefined&&val!==null&&val!=='')));
}

module.exports = { i_131FieldValues };