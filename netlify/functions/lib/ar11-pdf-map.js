'use strict';

function clean(v, max = 300) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g,' ').trim().slice(0,max);
  return String(v||'').replace(/\s+/g,' ').trim().slice(0,max);
}
function digits(v,max=30){return clean(v,Math.max(80,max*4)).replace(/\D/g,'').slice(0,max);}
function dateMdY(v){const t=clean(v,40);const m=t.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[2]}/${m[3]}/${m[1]}`:t;}
function stateCode(v){const t=clean(v,80);const m=t.match(/^([A-Z]{2})\b/);return m?m[1]:t;}

function unitCheckboxes(prefix, unitType) {
  const keys = ['Apt','Ste','Flr'];
  const result = {};
  keys.forEach((k,i) => { result[`${prefix}[${i}]`] = (unitType === k); });
  return result;
}

function ar_11FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0,10);
  const v = {};

  v["S1_FamilyName[0]"]  = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["S1_GivenName[0]"]   = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["S1_MiddleName[0]"]  = clean(a.applicant_middle_name || a.middle_name || '', 60);
  v["S1_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["AlienNumber[0]"]    = digits(a.alien_number || a.a_number || '', 9);

  v["S2A_StreetNumberName[0]"] = clean(a.previous_address_line1 || '', 80);
  v["S2A_AptSteFlrNumber[0]"]  = clean(a.previous_address_unit || '', 6);
  v["S2A_CityOrTown[0]"]       = clean(a.previous_city || '', 60);
  v["S2A_State[0]"]            = stateCode(a.previous_state || '');
  v["S2A_ZipCode[0]"]          = digits(a.previous_zip || '', 10);
  Object.assign(v, unitCheckboxes('S2A_Unit', a.previous_unit_type || ''));

  v["S2B_StreetNumberName[0]"] = clean(a.present_address_line1 || '', 80);
  v["S2B_AptSteFlrNumber[0]"]  = clean(a.present_address_unit || '', 6);
  v["S2B_CityOrTown[0]"]       = clean(a.present_city || '', 60);
  v["S2B_State[0]"]            = stateCode(a.present_state || '');
  v["S2B_ZipCode[0]"]          = digits(a.present_zip || '', 10);
  Object.assign(v, unitCheckboxes('S2B__Unit', a.present_unit_type || ''));

  v["S2C_StreetNumberName[0]"] = clean(a.mailing_address_line1 || '', 80);
  v["S2C_AptSteFlrNumber[0]"]  = clean(a.mailing_address_unit || '', 6);
  v["S2C_CityOrTown[0]"]       = clean(a.mailing_city || '', 60);
  v["S2C_State[0]"]            = stateCode(a.mailing_state || '');
  v["S2C_ZipCode[0]"]          = digits(a.mailing_zip || '', 10);
  Object.assign(v, unitCheckboxes('S2C_Unit', a.mailing_unit_type || ''));

  v["S3_SignatureApplicant[0]"] = clean(a.signature || a.applicant_given_name || '', 80);
  v["S3_DateofSignature[0]"]   = dateMdY(today);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { ar_11FieldValues };
