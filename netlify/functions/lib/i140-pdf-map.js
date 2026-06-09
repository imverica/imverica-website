'use strict';
// I-140, Immigrant Petition for Alien Worker (EB-1/EB-2/EB-3).
//
// WARNING: this PDF's internal field names are SCRAMBLED — they do NOT match
// the visible box labels (e.g. the "Family Name" box is backed by a field
// named *_GivenName, the beneficiary "A-Number" box is a field named
// Line12_SSN, the "City" box is Line2h_Province). Every mapping below was
// established empirically: we filled each field with a unique index marker,
// rendered the PDF, and read which box each index landed in. Do NOT "correct"
// a mapping to match a field name — map by the rendered BOX, and re-verify by
// rendering (scripts/qa-i140 render) after any change.

function clean(v, max = 300) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g,' ').trim().slice(0,max);
  return String(v||'').replace(/\s+/g,' ').trim().slice(0,max);
}
function digits(v,max=30){return clean(v,Math.max(80,max*4)).replace(/\D/g,'').slice(0,max);}
function dateMdY(v){const t=clean(v,40);const m=t.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[2]}/${m[3]}/${m[1]}`:t;}
function stateCode(v){const t=clean(v,80);const m=t.match(/^([A-Z]{2})\b/);return m?m[1]:t;}
function unitNumber(v){return clean(v,16).replace(/^(?:apt|ste|fl(?:oor)?|unit|#)\.?\s*/i,'').trim().slice(0,10);}

function i_140FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};

  const family = clean(a.applicant_family_name || a.family_name || (c.name ? c.name.split(' ').pop() : ''), 60);
  const given  = clean(a.applicant_given_name  || a.given_name  || (c.name ? c.name.split(' ').slice(0,-1).join(' ') : ''), 60);
  const middle = clean(a.applicant_middle_name || a.middle_name || '', 60);

  // ===== Part 3 — Information About the Person for Whom You Are Filing =====
  // (the BENEFICIARY / worker — this is the applicant Imverica has data for).
  v["Pt3Line1a_FamilyName[0]"]      = family;                                   // 1.a Family Name
  v["Pt3Line1b_GivenName[0]"]       = given;                                    // 1.b Given Name
  v["Pt3Line1c_MiddleName[0]"]      = middle;                                   // 1.c Middle Name
  // Mailing address (box label → scrambled field name in comment).
  v["Line2b_StreetNumberName[0]"]   = clean(a.mailing_address_line1 || a.address_line1, 80);   // 2.b Street
  v["Line2d_CityOrTown[0]"]         = unitNumber(a.mailing_address_line2 || a.address_unit);   // 2.c Apt/Ste/Flr Number  (field: CityOrTown)
  v["Line2h_Province[0]"]           = clean(a.mailing_city || a.city, 40);      // 2.d City or Town        (field: Province)
  v["Line2e_State[0]"]              = stateCode(a.mailing_state || a.state || '');             // 2.e State
  v["Line2f_ZipCode[0]"]            = digits(a.mailing_zip || a.zip_code, 10);  // 2.e ZIP Code
  v["Line2i_Country[0]"]            = clean(a.mailing_country || 'United States', 40);         // 2.h Country
  // Other information.
  v["Line5_DateOfBirth[0]"]         = dateMdY(a.date_of_birth || a.dob || '');  // 3 Date of Birth
  v["Line6_CityTownOfBirth[0]"]     = clean(a.city_of_birth || a.place_of_birth_city, 40);     // 4 City/Town/Village of Birth
  v["Line7_StateProvinceOfBirth[0]"]= clean(a.state_of_birth || a.place_of_birth_state, 40);   // 5 State/Province of Birth
  v["Line8_Country[0]"]             = clean(a.country_of_birth || a.place_of_birth_country, 40);// 6 Country of Birth
  v["Line9_Country[0]"]             = clean(a.country_of_citizenship || a.country_of_birth, 40);// 7 Country of Citizenship
  v["Line12_SSN[0]"]                = digits(a.alien_number || a.a_number, 9);  // 8 Alien Registration Number (A-Number)  (field: SSN)
  v["Line13_DateOArrival[0]"]       = dateMdY(a.date_of_last_arrival || a.last_arrival_date || ''); // 10 Date of Last Arrival
  v["Line14a_ArrivalDeparture[0]"]  = digits(a.i94_number, 11);                 // 11.a Form I-94 Number
  v["Line14b_Passport[0]"]          = clean(a.passport_number, 20);             // 13 Passport Number
  v["Line14c_TravelDoc[0]"]         = clean(a.passport_country_of_issuance, 40);// 15 Country of Issuance  (field: TravelDoc)
  v["Line14e_ExpDate[0]"]           = dateMdY(a.passport_expiration || '');     // 16 Passport Expiration Date

  // ===== Part 1 — Information About the Person/Organization Filing =====
  // Employer petition → company name + FEIN. Self-petition (EB-1A / EB-2 NIW)
  // → the individual is the petitioner, so fall back to the applicant's name.
  // NOTE the scrambled name fields: the "Family Name" box is Pt1Line1b_GivenName.
  const orgName = clean(a.petitioner_org_name || a.employer_name || a.company_name, 80);
  v["Line2_CompanyName[0]"]         = orgName;                                  // 2 Company/Org Name
  v["Pt1Line3_TaxNumber[0]"]        = digits(a.petitioner_fein || a.employer_ein || a.fein, 9); // 4 IRS EIN (FEIN)
  const petFamily = clean(a.petitioner_family_name, 60) || (orgName ? '' : family);
  const petGiven  = clean(a.petitioner_given_name, 60)  || (orgName ? '' : given);
  v["Pt1Line1b_GivenName[0]"]       = petFamily;                               // 1.a Family Name  (field: GivenName)
  v["Pt1Line1c_MiddleName[0]"]      = petGiven;                                // 1.b Given Name   (field: MiddleName)
  // Petitioner mailing address.
  v["Line6b_StreetNumberName[0]"]   = clean(a.petitioner_address_line1 || a.employer_address_line1, 80); // 3.b Street
  v["Line6d_CityOrTown[0]"]         = clean(a.petitioner_city || a.employer_city, 40);          // 3.d City
  v["Line6h_Province[0]"]           = stateCode(a.petitioner_state || a.employer_state || '');  // 3.e State (field: Province)
  v["Line6f_ZipCode[0]"]            = digits(a.petitioner_zip || a.employer_zip, 10);           // 3.e ZIP
  v["Line6i_Country[0]"]            = clean(a.petitioner_country || (orgName ? 'United States' : ''), 40); // 3.h Country

  return Object.fromEntries(Object.entries(v).filter(([,val]) => val !== undefined && val !== null && val !== ''));
}

module.exports = { i_140FieldValues };
