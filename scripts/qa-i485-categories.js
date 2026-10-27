// I-485 (edition 09/18/26): Part 2 categories and what follows from them
// (Part 3, Part 9 Item 56, INA 245(i)), the Part 1 and Part 6 questions added
// after the test fill, the organization-name guard and Part 14 continuation
// sheets. All answers here are invented.
// Run: node scripts/qa-i485-categories.js
const fs = require('fs');
const path = require('path');
const { i485FieldValues, i485TextOverlays } = require('../netlify/functions/lib/i485-pdf-map');
const { incrementalFillPdf, parsePdf, extractFieldObjects } = require('../netlify/functions/lib/pdf-incremental-fill');
const { CATEGORIES, I864_INDEX, I864_OPTIONS, PUBLIC_CHARGE_NOT_EXEMPT } = require('../netlify/functions/lib/i485-categories');
const { CATEGORY_KEY_BY_BASIS, UT_STATUS_OPTIONS } = require('../netlify/functions/lib/i485-review-steps');

const pdf = fs.readFileSync(path.join(__dirname, '..', 'assets/form-cache/pdfs/i-485.pdf'));
const pdfFields = extractFieldObjects(parsePdf(pdf));

let failures = 0;
function check(ok, label) {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}

function categoryAnswers(category, extra = {}) {
  const key = CATEGORY_KEY_BY_BASIS[category.basis];
  return { adjustment_basis: category.basis, ...(key ? { [key]: category.value } : {}), ...extra };
}

const selected = (values, prefix) => Object.entries(values)
  .filter(([name, on]) => name.startsWith(`${prefix}[`) && on === true)
  .map(([name]) => Number(name.match(/\[(\d+)\]$/)[1]));

for (const category of CATEGORIES) {
  check(pdfFields.has(category.field), `${category.value}: PDF field ${category.field} exists`);
  const answers = categoryAnswers(category, {
    ina_245i_adjustment: 'No',
    eb_relative_petitioner: 'No',
    affidavit_support_exemption: I864_OPTIONS[0][1],
    public_charge_exemption: 'I do not fall under any of the exempt categories'
  });
  const values = i485FieldValues({ formAnswers: answers });
  check(values[category.field] === true, `${category.value}: ticks ${category.field}`);
  const otherCategoryBoxes = CATEGORIES.filter((other) => other.field !== category.field && values[other.field] === true);
  check(otherCategoryBoxes.length === 0, `${category.value}: no other category box`);

  const expected864 = category.i864 === 'relative' ? '1.e' : category.i864 === 'ask' ? '1.f' : category.i864;
  check(JSON.stringify(selected(values, 'Pt3Line1_CB')) === JSON.stringify([I864_INDEX[expected864]]), `${category.value}: Part 3 = ${expected864}`);

  const expectedPc = Number.isInteger(category.publicCharge) ? category.publicCharge : PUBLIC_CHARGE_NOT_EXEMPT;
  check(JSON.stringify(selected(values, 'Pt9Line56_CB')) === JSON.stringify([expectedPc]), `${category.value}: Item 56 = ${expectedPc}`);

  const has245i = values['Pt2Line4_CB[0]'] === true;
  check(has245i === Boolean(category.ina245i), `${category.value}: INA 245(i) ${category.ina245i ? 'answered' : 'blank'}`);
}

for (const name of ['Pt3Line1_CB[0]', 'Pt3Line1_CB[5]', 'Pt9Line56_CB[0]', 'Pt9Line56_CB[24]', 'Pt9Line57_HouseholdSize[0]', 'Pt9Line53_CB[4]',
  'Pt9Line59_CB[4]', 'Pt9Line60_CB[4]', 'Pt9Line61_CB[7]', 'Pt9Line61_diploma[0]', 'TextField8[0]', 'Pt8Line68c_Column5Row4[0]',
  'Pt2Line3d_Asylum[0]', 'Pt2Line3d_Refugee[0]', 'Pt2Line1g_DV[0]', 'Pt2Line1g_OtherEligibility[0]', 'Pt2Line3b_CB140Assoc[2]',
  'Pt1Line3A_OtherDOB[0]', 'P1Line12_FamilyName[0]', 'P1Line13_GivenName[0]', 'Pt4Line2_CityTown[0]', 'Pt4Line4_Date[0]',
  'Pt5Line2_YNNA[2]', 'Part6Line8_StreetName[0]', 'P6Line8_Country[0]', 'Pt6Line11_YN[1]', 'P3_Line4_DaytimeTelePhoneNumber[0]',
  'P3_Line6_Email[0]', 'Pt12Line4_PreparerMobileNumber[0]', 'Pt1Line1_FamilyName[1]', 'Pt2Line2_AlienNumber[0]', 'Pt1Line2_DOB[0]']) {
  check(pdfFields.has(name), `PDF field ${name} exists`);
}

// Part 1, Items 13, 15, 16, 17 by the on-states (Pt1Line17_YN[1] is Yes).
const asylee = CATEGORIES.find((category) => category.field === 'Pt2Line3d_AsyleeRefugeeCB[0]');
const part1 = i485FieldValues({ formAnswers: categoryAnswers(asylee, { first_time_in_us: 'No', crewman_visa_issued: 'Yes', arrived_as_crewman: 'Yes' }) });
check(part1['Pt1Line13_YN[1]'] === true, 'Item 13 No');
check(part1['Pt1Line16_YN[0]'] === true, 'Item 16 Yes');
check(part1['Pt1Line17_YN[1]'] === true && part1['Pt1Line17_YN[0]'] === false, 'Item 17 Yes');
check(part1['Pt1Line15_Date[0]'] === 'N/A', 'Item 15: asylee status does not expire');
const ds = i485FieldValues({ formAnswers: { current_status_expiration_kind: 'D/S (duration of status)' } });
check(ds['Pt1Line15_Date[0]'] === 'D/S', 'Item 15: D/S');

// Item 3.b relative question: investors blank, self-petition N/A, relative details.
const investor = i485FieldValues({ formAnswers: categoryAnswers(CATEGORIES.find((c) => c.field === 'Pt2Line3b_CB526[0]')) });
check(selected(investor, 'Pt2Line3b_CB140Assoc').length === 0, 'investor: I-140 relative question blank');
const niw = CATEGORIES.find((c) => c.field === 'Pt2Line3b_CB140[7]');
const selfPetition = i485FieldValues({ formAnswers: categoryAnswers(niw, { eb_relative_petitioner: 'I filed my own I-140 (self-petition)' }) });
check(selfPetition['Pt2Line3b_CB140Assoc[0]'] === true && selfPetition['Pt3Line1_CB[4]'] === true, 'NIW self-petition: N/A and Part 3 1.e');
const byRelative = i485FieldValues({ formAnswers: categoryAnswers(niw, { eb_relative_petitioner: 'Yes', eb_relative_relationship: 'Brother', eb_relative_status: 'U.S. citizen' }) });
check(byRelative['Pt2Line3b_CB140Assoc[2]'] === true && byRelative['Pt2Relative_CB[5]'] === true && byRelative['Pt2RelativeType_CB[0]'] === true && byRelative['Pt3Line1_CB[5]'] === true, 'I-140 by a relative: brother, U.S. citizen, Part 3 1.f');

// Part 1, Item 11: the text sits next to the ticked box; refugees are admitted as refugees.
const refugee = CATEGORIES.find((category) => category.field === 'Pt2Line3d_AsyleeRefugeeCB[1]');
const refugeeEntry = i485FieldValues({ formAnswers: categoryAnswers(refugee, { admission_basis: 'Other' }) });
check(refugeeEntry['Pt2Line11_CB[0]'] === true && refugeeEntry['Pt1Line11_Admitted[0]'] === 'REFUGEE', 'Item 11: refugee admitted as REFUGEE');
const otherEntry = i485FieldValues({ formAnswers: { admission_basis: 'Other', status_at_last_entry: 'TPS' } });
check(otherEntry['Pt2Line11_CB[3]'] === true && otherEntry['Pt1Line11_Other[0]'] === 'TPS' && !otherEntry['Pt1Line11_Admitted[0]'], 'Item 11: Other text in the Other box');

// Exempt categories skip Item 63 and Items 57-64.
const exempt = i485FieldValues({ formAnswers: categoryAnswers(asylee, { Pt9Line63_YesNo: 'Yes', pc_household: '2', pc_benefit1_name: 'X' }) });
check(exempt['Pt9Line63_YesNo[0]'] === undefined && exempt['Pt9Line57_HouseholdSize[0]'] === undefined && exempt['Pt8Line68c_Column1Row1[0]'] === undefined, 'asylee: Items 57-64 skipped');

// Part 6: N/A unless married; spouse at the applicant's address.
check(i485FieldValues({ formAnswers: { marital_status: 'Single' } })['Pt5Line2_YNNA[2]'] === true, 'Part 6 Item 2: N/A when not married');
const spouse = i485FieldValues({ formAnswers: { marital_status: 'Married', spouse_in_armed_forces: 'Yes', spouse_same_address: 'Yes', spouse_applying_with_you: 'No', mailing_address_line1: '10 Test St', mailing_city: 'Sacramento', mailing_state: 'CA - California', mailing_zip: '95814' } });
check(spouse['Pt5Line2_YNNA[1]'] === true && spouse['Part6Line8_StreetName[0]'] === '10 Test St' && spouse['Pt6Line11_YN[0]'] === true, 'Part 6 Items 2, 8, 10');

// The applicant's business is never printed as an organization name.
const orgs = i485FieldValues({ formAnswers: { interpreter_business_name: 'Imverica', preparer_business_name: 'IMVERICA LLC' } });
check(!orgs['Pt11Line2_OrgName[0]'] && !orgs['Pt12Line2_BusinessName[0]'], 'organization names never print Imverica');

// Item 56 for a category that is not exempt: valid U status [4], pending or approved T [12].
const f1 = CATEGORIES.find((category) => category.publicCharge === PUBLIC_CHARGE_NOT_EXEMPT);
const withUt = (status) => i485FieldValues({ formAnswers: categoryAnswers(f1, { pc_ut_status: status, pc_household: '3', Pt9Line63_YesNo: 'No' }) });
const uStatus = withUt(UT_STATUS_OPTIONS[1]);
check(JSON.stringify(selected(uStatus, 'Pt9Line56_CB')) === '[4]' && uStatus['Pt9Line57_HouseholdSize[0]'] === undefined && uStatus['Pt9Line63_YesNo[0]'] === undefined, 'U status: Item 56 [4], Items 57-64 skipped');
check(JSON.stringify(selected(withUt(UT_STATUS_OPTIONS[2]), 'Pt9Line56_CB')) === '[12]', 'T application: Item 56 [12]');
const noUt = withUt(UT_STATUS_OPTIONS[0]);
check(JSON.stringify(selected(noUt, 'Pt9Line56_CB')) === '[23]' && noUt['Pt9Line57_HouseholdSize[0]'] === '3', 'no U/T: not exempt, Items 57-64 kept');

// Part 9, Items 1-9: two organizations, dates as mm/dd/yyyy, the rest in Part 14.
const organizations = {
  Pt8Line1_YesNo: 'Yes', Pt9Line2_Organization1: 'FIRST TEST CLUB', Pt9Line5_DateFrom: '2012-03-01', Pt9Line5_DateTo: '2014-06-30',
  pt9_second_org: 'Yes', Pt9Line6_Organization2: 'SECOND TEST UNION', Pt9Line7_Country: 'Testland', Pt9Line9_DateFrom: '2015-09-01', Pt9Line9_DateTo: '2016-01-31',
  pt9_more_organizations: 'THIRD TEST SOCIETY, Testville, Testland; sports club; member; 2017-2018\nFOURTH TEST GROUP, Testville, Testland; charity; volunteer; 2019'
};
const orgValues = i485FieldValues({ formAnswers: organizations });
check(orgValues['Pt9Line2_Organization1[0]'] === 'FIRST TEST CLUB' && orgValues['Pt9Line5_DateFrom[0]'] === '03/01/2012', 'organization 1 with mm/dd/yyyy dates');
check(orgValues['Pt9Line6_Organization2[0]'] === 'SECOND TEST UNION' && orgValues['Pt9Line7_Country[0]'] === 'Testland' && orgValues['Pt9Line9_DateTo[0]'] === '01/31/2016', 'organization 2 in Items 6-9');
const orgSlot = [1, 2, 3, 4].find((n) => /ORGANIZATION 3: THIRD TEST SOCIETY/.test(orgValues[`P14_Line${n + 1}_AdditionalInfo[0]`] || ''));
check(orgSlot && /ORGANIZATION 4/.test(orgValues[`P14_Line${orgSlot + 1}_AdditionalInfo[0]`]), 'organizations 3+ in Part 14');
const noSecond = i485FieldValues({ formAnswers: { ...organizations, pt9_second_org: 'No' } });
check(noSecond['Pt9Line6_Organization2[0]'] === undefined && noSecond['Pt9Line2_Organization1[0]'] === 'FIRST TEST CLUB', 'no second organization: Items 6-9 blank');
const noOrg = i485FieldValues({ formAnswers: { ...organizations, Pt8Line1_YesNo: 'No' } });
check(noOrg['Pt9Line2_Organization1[0]'] === undefined && noOrg['Pt9Line6_Organization2[0]'] === undefined, 'Item 1 No: Items 2-9 blank');

// Part 10, Item 2 and Part 1, Item 18 In Care Of.
const daytime = { countryCode: '+1', areaCode: '916', number: '5550100' };
const mobileFor = (extra) => i485FieldValues({ formAnswers: { daytime_phone: daytime, ...extra } })['Pt3Line4_MobileNumber1[0]'] || '';
check(mobileFor({}) === '(916) 555-0100', 'mobile defaults to the daytime number');
check(mobileFor({ daytime_is_mobile: 'No', mobile_phone: { countryCode: '+1', areaCode: '916', number: '5550111' } }) === '(916) 555-0111', 'separate mobile number');
check(mobileFor({ daytime_is_mobile: 'No' }) === '', 'no mobile: blank');
check(i485FieldValues({ formAnswers: { in_care_of_name: 'TEST FRIEND', mailing_address_line1: '1 Test Way', physical_same_as_mailing: 'Yes' } })['Part1_Item18_InCareOfName[0]'] === 'TEST FRIEND', 'In Care Of name');

// Part 14: five-year addresses beyond the form continue on extra sheets.
const addresses = Array.from({ length: 12 }, (_, index) => ({
  line1: `${100 + index} Test Avenue`, line2: `Apt ${index + 1}`, city: 'Sacramento', state: 'CA - California', zip: '95814', country: 'United States',
  from: `20${10 + index}-01-01`, to: `20${10 + index}-12-31`
}));
const overflowAnswers = { applicant_family_name: 'TESTER', applicant_given_name: 'QA', alien_number: '000000001', same_address_five_years: 'No', prior_us_addresses: addresses };
const overflowValues = i485FieldValues({ formAnswers: overflowAnswers });
const overflowOverlays = i485TextOverlays({ formAnswers: overflowAnswers });
check(overflowValues['Pt9Line3c_ItemNumber[3]'] === '18' && /PRIOR ADDRESS/.test(overflowValues['P14_Line5_AdditionalInfo[0]'] || ''), 'Part 14 slots on page 24 filled');
check(overflowOverlays.some((overlay) => overlay.newPage === 1 && overlay.field === 'Pt1Line4_AlienNumber[24]'), 'continuation sheet repeats the A-Number');
check(overflowOverlays.some((overlay) => overlay.newPage === 1 && /PRIOR ADDRESS 12/.test(overlay.text)) || overflowOverlays.some((overlay) => overlay.newPage === 2 && /PRIOR ADDRESS 12/.test(overlay.text)), 'last address reaches a continuation sheet');
const filled = incrementalFillPdf(pdf, overflowValues, overflowOverlays);
check(filled.addedPages >= 1 && filled.skippedFields.length === 0, `continuation sheets appended (${filled.addedPages})`);
const pageCount = (buffer) => {
  const parsed = parsePdf(buffer);
  const root = parsed.byObjectNumber.get(parsed.trailer.root.objectNumber);
  const pages = parsed.byObjectNumber.get(Number(root.body.match(/\/Pages\s+(\d+)/)[1]));
  return Number(pages.body.match(/\/Count\s+(\d+)/)[1]);
};
check(pageCount(filled.buffer) === 24 + filled.addedPages, 'page tree counts the extra sheets');

console.log(failures ? `${failures} failed` : `I-485 categories QA passed (${CATEGORIES.length} categories)`);
process.exit(failures ? 1 : 0);
