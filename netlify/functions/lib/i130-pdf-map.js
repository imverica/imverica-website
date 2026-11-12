'use strict';
const { incrementalFillPdf: _unused } = require('./pdf-incremental-fill'); // keep dep for later
const { unitNumber, unitRadio } = require('./form-helpers');

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

// Is this a US (or blank → assume US) address? US → fill _State; else _Province.
function isUS(country){const t=clean(country,40).toLowerCase();return !t || /united states|u\.?s\.?a?\b|usa|америк|сша/.test(t);}

// Fill an address block (street/apt/city/state-or-province/zip/country) into a
// USCIS field group. `g` is the group prefix, e.g. "Pt2Line10_".
function addressGroup(v, g, addr){
  if(!addr) return;
  v[g+"StreetNumberName[0]"] = clean(addr.line1, 80);
  v[g+"AptSteFlrNumber[0]"]  = unitNumber(addr.line2);
  Object.assign(v, unitRadio(g+"Unit", addr.line2)); // Apt/Ste/Flr selector for this group
  v[g+"CityOrTown[0]"]       = clean(addr.city, 60);
  v[g+"ZipCode[0]"]          = digits(addr.zip, 10);
  if(isUS(addr.country)){ v[g+"State[0]"] = stateCode(addr.state); }
  else { v[g+"Province[0]"] = clean(addr.state, 40); v[g+"Country[0]"] = clean(addr.country, 60); }
}

// Sex checkbox pair (Male/Female export value "Y").
function sexFields(v, maleField, femaleField, value){
  const s = clean(value, 20).toLowerCase();
  if(/^m|муж|муж/.test(s)) v[maleField] = true;
  else if(/^f|female|жен/.test(s)) v[femaleField] = true;
}

/**
 * I-130 — Petition for Alien Relative.
 * Part 2 = Petitioner (the filer), Part 4 = Beneficiary (the relative).
 * Field targets verified against i-130.pdf /TU tooltips
 * (see qa-reports/i130-mapping-proposal.md). Reviewed mapping — identity
 * + address only this round; relationship + marriage to follow.
 */
function i_130FieldValues(payload={}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};

  // ── Petitioner (Part 2) — "Information About You" ──
  v["Pt2Line4a_FamilyName[0]"] = clean(a.petitioner_family_name, 60);
  v["Pt2Line4b_GivenName[0]"]  = clean(a.petitioner_given_name, 60);
  v["Pt2Line4c_MiddleName[0]"] = clean(a.petitioner_middle_name, 60);
  v["Pt2Line1_AlienNumber[0]"] = digits(a.petitioner_alien_number, 9);
  v["Pt2Line2_USCISOnlineActNumber[0]"] = digits(a.petitioner_uscis_online_account_number, 12);
  v["Pt2Line11_SSN[0]"] = digits(a.petitioner_ssn, 9);
  v["Pt2Line6_CityTownOfBirth[0]"] = clean(a.petitioner_city_of_birth, 60);
  v["Pt2Line7_CountryofBirth[0]"]  = clean(a.petitioner_country_of_birth, 60);
  v["Pt2Line8_DateofBirth[0]"]     = dateMdY(a.petitioner_date_of_birth);
  sexFields(v, "Pt2Line9_Male[0]", "Pt2Line9_Female[0]", a.petitioner_sex);
  const petMailing = {
    line1: a.petitioner_mailing_address_line1, line2: a.petitioner_mailing_address_line2,
    city: a.petitioner_mailing_city, state: a.petitioner_mailing_state,
    zip: a.petitioner_mailing_zip, country: a.petitioner_mailing_country
  };
  addressGroup(v, "Pt2Line10_", petMailing);

  // Petitioner address history — Physical Address 1 (current) + 2 (prior).
  // If physical = mailing, reuse mailing; else use the physical block.
  const sameAsMailing = /^y|yes|да|так/i.test(clean(a.petitioner_physical_same_as_mailing, 10));
  const petPhysical = sameAsMailing ? petMailing : {
    line1: a.petitioner_physical_address_line1, line2: a.petitioner_physical_address_line2,
    city: a.petitioner_physical_city, state: a.petitioner_physical_state,
    zip: a.petitioner_physical_zip, country: a.petitioner_physical_country
  };
  addressGroup(v, "Pt2Line12_", petPhysical);                 // Physical Address 1
  v["Pt2Line13a_DateFrom[0]"] = dateMdY(a.petitioner_current_address_from);
  const priorAddr = Array.isArray(a.petitioner_prior_address) ? a.petitioner_prior_address : [];
  if(priorAddr[0]){
    addressGroup(v, "Pt2Line14_", priorAddr[0]);             // Physical Address 2
    v["Pt2Line15a_DateFrom[0]"] = dateMdY(priorAddr[0].from);
    v["Pt2Line15b_DateTo[0]"]   = dateMdY(priorAddr[0].to);
  }

  // Petitioner employment — Employer 1 (current) + Employer 2 (prior).
  const curEmp = Array.isArray(a.petitioner_current_employment) ? a.petitioner_current_employment : [];
  const priEmp = Array.isArray(a.petitioner_prior_employment) ? a.petitioner_prior_employment : [];
  if(curEmp[0]){
    v["Pt2Line40_EmployerOrCompName[0]"] = clean(curEmp[0].name, 80);
    addressGroup(v, "Pt2Line41_", curEmp[0]);
    v["Pt2Line42_Occupation[0]"] = clean(curEmp[0].occupation || curEmp[0].activity, 60);
    v["Pt2Line43a_DateFrom[0]"]  = dateMdY(curEmp[0].from);
    v["Pt2Line43b_DateTo[0]"]    = dateMdY(curEmp[0].to);
  }
  const emp2 = priEmp[0] || curEmp[1];
  if(emp2){
    v["Pt2Line44_EmployerOrOrgName[0]"] = clean(emp2.name, 80);
    addressGroup(v, "Pt2Line45_", emp2);
    v["Pt2Line46_Occupation[0]"] = clean(emp2.occupation || emp2.activity, 60);
    v["Pt2Line47a_DateFrom[0]"]  = dateMdY(emp2.from);
    v["Pt2Line47b_DateTo[0]"]    = dateMdY(emp2.to);
  }

  // ── Beneficiary (Part 4) — "Information About Beneficiary" ──
  v["Pt4Line4a_FamilyName[0]"] = clean(a.beneficiary_family_name, 60);
  v["Pt4Line4b_GivenName[0]"]  = clean(a.beneficiary_given_name, 60);
  v["Pt4Line4c_MiddleName[0]"] = clean(a.beneficiary_middle_name, 60);
  v["Pt4Line1_AlienNumber[0]"] = digits(a.beneficiary_alien_number, 9);
  v["Pt4Line3_SSN[0]"] = digits(a.beneficiary_ssn, 9);
  v["Pt4Line7_CityTownOfBirth[0]"] = clean(a.beneficiary_city_of_birth, 60);
  v["Pt4Line8_CountryOfBirth[0]"]  = clean(a.beneficiary_country_of_birth, 60);
  v["Pt4Line9_DateOfBirth[0]"]     = dateMdY(a.beneficiary_date_of_birth);
  sexFields(v, "Pt4Line9_Male[0]", "Pt4Line9_Female[0]", a.beneficiary_sex);
  addressGroup(v, "Pt4Line11_", {
    line1: a.beneficiary_current_address_line1, line2: a.beneficiary_current_address_line2,
    city: a.beneficiary_current_city, state: a.beneficiary_current_state,
    zip: a.beneficiary_current_zip, country: a.beneficiary_current_country
  });

  // Beneficiary employment (current employer address + start date).
  const benEmp = Array.isArray(a.beneficiary_current_employment) ? a.beneficiary_current_employment : [];
  if(benEmp[0]){
    addressGroup(v, "Pt4Line26_", benEmp[0]);
    v["Pt4Line27_DateEmploymentBegan[0]"] = dateMdY(benEmp[0].from);
  }

  // ── Part 1 — Relationship (who the petition is for) ──
  const rel = clean(a.relationship_to_beneficiary, 40).toLowerCase();
  if(/spouse|husband|wife|супруг|муж|жена/.test(rel)) v["Pt1Line1_Spouse[0]"]=true;
  else if(/parent|mother|father|родител|мать|отец/.test(rel)) v["Pt1Line1_Parent[0]"]=true;
  else if(/brother|sister|sibling|брат|сестр/.test(rel)) v["Pt1Line1_Siblings[0]"]=true;
  else if(/child|son|daughter|реб[её]нок|дет|сын|доч/.test(rel)) v["Pt1Line1_Child[0]"]=true;
  const cbasis = clean(a.child_relationship_basis, 60).toLowerCase();
  if(/were married|in wedlock|в браке/.test(cbasis)) v["Pt1Line2_InWedlock[0]"]=true;
  else if(/step/.test(cbasis)) v["Pt1Line2_Stepchild[0]"]=true;
  else if(/adopt/.test(cbasis)) v["Pt1Line2_AdoptedChild[0]"]=true;
  else if(/out of wedlock|вне брака/.test(cbasis)) v["Pt1Line2_OutOfWedlock[0]"]=true;
  // NOTE: Part 1 items 3 & 4 are ADOPTION questions ("are you related by
  // adoption?" / "did you gain status through adoption?") — the wizard does
  // NOT ask these, so we leave them blank rather than answer a federal-form
  // question we have no answer for. (The "filed before" flow questions are
  // not these fields.)

  // ── Petitioner marital information (Part 2, items 16-19) ──
  v["Pt2Line16_NumberofMarriages[0]"] = digits(a.petitioner_number_of_marriages, 2);
  const pms = clean(a.petitioner_marital_status, 30).toLowerCase();
  for(const [re,name] of [[/single|never|холост|не жен|не замуж/,"Single"],[/marri|жен|замуж|брак/,"Married"],[/divor|развед/,"Divorced"],[/widow|вдов/,"Widowed"],[/separat|раздел/,"Separated"],[/annul|аннул/,"Annulled"]]){
    if(re.test(pms)){ v["Pt2Line17_"+name+"[0]"]=true; break; }
  }
  v["Pt2Line18_DateOfMarriage[0]"] = dateMdY(a.petitioner_current_marriage_date);
  v["Pt2Line19a_CityTown[0]"]      = clean(a.petitioner_current_marriage_place, 60);

  // ── Petitioner citizenship status (Part 2, items 36-40) ──
  const pstat = clean(a.petitioner_status, 40).toLowerCase();
  if(/citizen|national|гражд/.test(pstat)) v["Pt2Line36_USCitizen[0]"]=true;
  else if(/permanent resident|lpr|пмж|постоян/.test(pstat)) v["Pt2Line36_LPR[0]"]=true;
  v["Pt2Line40a_ClassOfAdmission[0]"]  = clean(a.petitioner_lpr_class_of_admission, 12);
  v["Pt2Line37a_CertificateNumber[0]"] = clean(a.petitioner_certificate_number, 20);
  v["Pt2Line37b_PlaceOfIssuance[0]"]   = clean(a.petitioner_certificate_issuance, 40);

  // ── Petitioner parents (Part 2) — full name into the Family Name box ──
  v["Pt2Line24_FamilyName[0]"]  = clean(a.petitioner_parent1_full_name, 70);
  v["Pt2Line30a_FamilyName[0]"] = clean(a.petitioner_parent2_full_name, 70);

  // ── Petitioner biographic (Part 3) ──
  const eth = clean(a.petitioner_ethnicity, 40).toLowerCase();
  // Check "not hispanic" FIRST — otherwise "not hispanic or latino" matches
  // the latino branch and wrongly flags Hispanic.
  if(/not hispanic|не латино|не испан/.test(eth)) v["Pt3Line1_Ethnicity[0]"]=true;   // Not Hispanic or Latino
  else if(/hispanic|latino|латино|испан/.test(eth)) v["Pt3Line1_Ethnicity[1]"]=true; // Hispanic or Latino
  const races = Array.isArray(a.petitioner_race) ? a.petitioner_race : (a.petitioner_race?[a.petitioner_race]:[]);
  races.forEach((r)=>{const s=clean(r,40).toLowerCase();
    if(/white|бел/.test(s)) v["Pt3Line2_Race_White[0]"]=true;
    else if(/asian|азиат/.test(s)) v["Pt3Line2_Race_Asian[0]"]=true;
    else if(/black|african|чёрн|черн|афро/.test(s)) v["Pt3Line2_Race_Black[0]"]=true;
    else if(/american indian|alaska|индеец/.test(s)) v["Pt3Line2_Race_AmericanIndianAlaskaNative[0]"]=true;
    else if(/hawaiian|pacific|тихоокеан/.test(s)) v["Pt3Line2_Race_NativeHawaiianOtherPacificIslander[0]"]=true;
  });
  const wt = digits(a.petitioner_weight_lbs, 3); // 3 right-aligned digit boxes
  if(wt){ const p=wt.padStart(3,' '); v["Pt3Line4_Pound1[0]"]=p[0].trim(); v["Pt3Line4_Pound2[0]"]=p[1].trim(); v["Pt3Line4_Pound3[0]"]=p[2].trim(); }

  // ── Petitioner contact (Part 6, statement/signature) ──
  v["Pt6Line3_DaytimePhoneNumber[0]"] = usPhone(a.petitioner_daytime_phone);
  v["Pt6Line5_Email[0]"]              = clean(a.petitioner_email_address, 120);

  // ── Beneficiary marital + contact + passport (Part 4) ──
  v["Pt4Line17_NumberofMarriages[0]"] = digits(a.beneficiary_number_of_marriages, 2);
  const bms = clean(a.beneficiary_marital_status, 30).toLowerCase();
  const benMs = [[/single|never|холост|не жен|не замуж/,3],[/marri|жен|замуж|брак/,4],[/divor|развед/,5],[/widow|вдов/,0],[/separat|раздел/,2],[/annul|аннул/,1]];
  for(const [re,idx] of benMs){ if(re.test(bms)){ v["Pt4Line18_MaritalStatus["+idx+"]"]=true; break; } }
  v["Pt4Line14_DaytimePhoneNumber[0]"] = usPhone(a.beneficiary_daytime_phone);
  v["Pt4Line16_EmailAddress[0]"]       = clean(a.beneficiary_email_address, 120);
  v["Pt4Line22_PassportNumber[0]"]     = clean(a.beneficiary_passport_or_travel_document, 20);
  v["Pt4Line24_CountryOfIssuance[0]"]  = clean(a.beneficiary_passport_country, 60);
  v["Pt4Line21d_DateExpired[0]"]       = dateMdY(a.beneficiary_passport_expiration);

  // ---- Answers the wizard collects that had no place in this map. Field
  // meanings were read from the form's tooltips.
  const low = (x) => clean(x, 80).toLowerCase();
  const yes = (x) => low(x) === 'yes';
  const no = (x) => low(x) === 'no';
  // Part 2. Petitioner: in care of, same address, height, eye and hair color
  v["Pt2Line10_InCareofName[0]"] = clean(a.petitioner_in_care_of_name, 34);
  if (yes(a.petitioner_physical_same_as_mailing)) v["Pt2Line11_Yes[0]"] = true;
  if (no(a.petitioner_physical_same_as_mailing)) v["Pt2Line11_No[0]"] = true;
  v["Pt3Line3_HeightFeet[0]"] = digits(a.petitioner_height_feet, 1);
  v["Pt3Line3_HeightInches[0]"] = digits(a.petitioner_height_inches, 2);
  const eye = { blue: 0, brown: 1, hazel: 2, pink: 3, maroon: 4, green: 5, gray: 6, black: 7, unknown: 8 }[low(a.petitioner_eye_color)];
  if (eye !== undefined) v[`Pt3Line5_EyeColor[${eye}]`] = true;
  const hair = { bald: 0, black: 1, blond: 2, brown: 3, gray: 4, red: 5, sandy: 6, white: 7, unknown: 8 }[low(a.petitioner_hair_color)];
  if (hair !== undefined) v[`Pt3Line6_HairColor[${hair}]`] = true;
  // Part 4. Beneficiary: current marriage, I-94, earlier petitions and proceedings
  v["Pt4Line19_DateOfMarriage[0]"] = dateMdY(a.beneficiary_current_marriage_date);
  v["Pt4Line20a_CityTown[0]"] = clean(a.beneficiary_current_marriage_place, 20);
  v["Pt4Line21b_ArrivalDeparture[0]"] = clean(a.beneficiary_i94_number, 11);
  // Item 10 asks the wizard's question word for word.
  if (yes(a.prior_petition_filed_for_beneficiary)) v["Pt4Line10_Yes[0]"] = true;
  if (no(a.prior_petition_filed_for_beneficiary)) v["Pt4Line10_No[0]"] = true;
  // Items 45 and 53 ask "EVER". Being in the United States now, or in
  // proceedings now, answers "Yes"; a "No" about today does not answer "ever".
  if (yes(a.beneficiary_in_us_now)) v["Pt4Line20_Yes[0]"] = true;
  if (yes(a.beneficiary_in_removal_proceedings)) v["Pt4Line28_Yes[0]"] = true;
  // Part 5, item 1: ever filed for this beneficiary or any other alien.
  if (yes(a.filed_for_same_beneficiary_before) || yes(a.filed_for_other_relatives_before)) v["Part4Line1_Yes[0]"] = true;
  else if (no(a.filed_for_same_beneficiary_before) && no(a.filed_for_other_relatives_before)) v["Part4Line1_No[0]"] = true;
  // Part 6. Petitioner's statement and contact information
  const statement = low(a.petitioner_statement);
  if (/read and understand english/.test(statement)) v["Pt6Line1Checkbox[0]"] = true;
  if (/interpreter/.test(statement)) {
    v["Pt6Line1Checkbox[1]"] = true;
    v["Pt6Line1b_Language[0]"] = clean(a.petitioner_statement_language, 40);
  }
  const preparerName = [clean(a.preparer_given_name, 60), clean(a.preparer_family_name, 60)].filter(Boolean).join(' ');
  if (yes(a.has_preparer) && preparerName) {
    v["Pt6Line2_Checkbox[0]"] = true;
    v["Pt6Line2_RepresentativeName[0]"] = preparerName;
  }
  v["Pt6Line4_MobileNumber[0]"] = usPhone(a.petitioner_mobile_phone);
  // Part 7 (interpreter) and Part 8 (preparer)
  if (!no(a.has_interpreter)) {
    v["Pt7Line1a_InterpreterFamilyName[0]"] = clean(a.interpreter_family_name, 60);
    v["Pt7Line1b_InterpreterGivenName[0]"] = clean(a.interpreter_given_name, 60);
    v["Pt7Line2_InterpreterBusinessorOrg[0]"] = clean(a.interpreter_business_name, 38);
    if (clean(a.interpreter_family_name)) v["Pt7_NameofLanguage[0]"] = clean(a.interpreter_language || a.petitioner_statement_language, 40);
  }
  if (!no(a.has_preparer)) {
    v["Pt8Line1a_PreparerFamilyName[0]"] = clean(a.preparer_family_name, 60);
    v["Pt8Line1b_PreparerGivenName[0]"] = clean(a.preparer_given_name, 60);
    v["Pt8Line2_BusinessName[0]"] = clean(a.preparer_business_name, 34);
  }

  return Object.fromEntries(Object.entries(v).filter(([,val])=>val===true||(val!==undefined&&val!==null&&val!=='')));
}

module.exports = { i_130FieldValues };