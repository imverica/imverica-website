'use strict';
const { unitRadio } = require('./form-helpers');

function clean(v, max = 300) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g,' ').trim().slice(0,max);
  return String(v||'').replace(/\s+/g,' ').trim().slice(0,max);
}
function digits(v,max=30){return clean(v,Math.max(80,max*4)).replace(/\D/g,'').slice(0,max);}
function dateMdY(v){const t=clean(v,40);const m=t.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[2]}/${m[3]}/${m[1]}`:t;}
function stateCode(v){const t=clean(v,80);const m=t.match(/^([A-Z]{2})\b/);return m?m[1]:t;}
// "Apt 5" -> "5" (the form's number box holds 4 characters)
function unitNumber(v){return clean(v,40).replace(/^(?:apt|apartment|ste|suite|flr|fl|floor|unit|#)\s*\.?\s*#?\s*/i,'').slice(0,4);}


function ar_11FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};

  v["S1_FamilyName[0]"]  = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  v["S1_GivenName[0]"]   = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  v["S1_MiddleName[0]"]  = clean(a.applicant_middle_name || a.middle_name || '', 60);
  v["S1_DateOfBirth[0]"] = dateMdY(a.date_of_birth || a.dob || '');
  v["AlienNumber[0]"]    = digits(a.alien_number || a.a_number || '', 9);

  v["S2A_StreetNumberName[0]"] = clean(a.previous_address_line1 || '', 80);
  v["S2A_AptSteFlrNumber[0]"]  = unitNumber(a.previous_address_line2 || a.previous_address_unit);
  v["S2A_CityOrTown[0]"]       = clean(a.previous_city || '', 60);
  v["S2A_State[0]"]            = stateCode(a.previous_state || '');
  v["S2A_ZipCode[0]"]          = digits(a.previous_zip || '', 10);
  Object.assign(v, unitRadio('S2A_Unit', a.previous_address_line2 || a.previous_address_unit || a.previous_unit_type));

  // Present physical address: the wizard's physical address, or its mailing
  // address when the client said the two are the same.
  const separateMailing = /^no$/i.test(clean(a.physical_same_as_mailing, 10));
  const present = a.present_address_line1
    ? { line1: a.present_address_line1, unit: a.present_address_line2 || a.present_address_unit, city: a.present_city, state: a.present_state, zip: a.present_zip }
    : (separateMailing
      ? { line1: a.physical_address_line1, unit: a.physical_address_line2, city: a.physical_city, state: a.physical_state, zip: a.physical_zip }
      : { line1: a.mailing_address_line1, unit: a.mailing_address_line2 || a.mailing_address_unit, city: a.mailing_city, state: a.mailing_state, zip: a.mailing_zip });
  v["S2B_StreetNumberName[0]"] = clean(present.line1 || '', 25);
  v["S2B_AptSteFlrNumber[0]"]  = unitNumber(present.unit);
  v["S2B_CityOrTown[0]"]       = clean(present.city || '', 20);
  v["S2B_State[0]"]            = stateCode(present.state || '');
  v["S2B_ZipCode[0]"]          = digits(present.zip || '', 5);
  Object.assign(v, unitRadio('S2B__Unit', present.unit || a.present_unit_type));

  // Mailing address (optional on the form): only when it differs.
  if (separateMailing) {
    const mailingUnit = a.mailing_address_line2 || a.mailing_address_unit;
    v["S2C_StreetNumberName[0]"] = clean(a.mailing_address_line1 || '', 25);
    v["S2C_AptSteFlrNumber[0]"]  = unitNumber(mailingUnit);
    v["S2C_CityOrTown[0]"]       = clean(a.mailing_city || '', 20);
    v["S2C_State[0]"]            = stateCode(a.mailing_state || '');
    v["S2C_ZipCode[0]"]          = digits(a.mailing_zip || '', 5);
    Object.assign(v, unitRadio('S2C_Unit', mailingUnit || a.mailing_unit_type));
  }

  // The signature line stays empty: the applicant signs by hand.
  v["S3_DateofSignature[0]"]   = dateMdY(a.applicant_signature_date);

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val!==undefined&&val!==null&&val!==''));
}

module.exports = { ar_11FieldValues };
