'use strict';

// Plain labels for court-form fields whose PDF tooltip alone does not say
// what to enter ("Zip", "Other", "(specify):", "at", "Yes"), keyed by the
// field name without its root segment (e.g. "Page2[0].List1[0]...").
// Item numbers follow the revisions in assets/form-cache/ca-court/.

const { FL150_LABELS } = require('./fl150-review');

const SC100 = {
  'Page2[0].List1[0].Item1[0].PlaintiffName1[0]': '1. Plaintiff name',
  'Page2[0].List1[0].Item1[0].PlaintiffZip1[0]': '1. Plaintiff street address: ZIP code',
  'Page2[0].List1[0].Item1[0].PlaintiffMailingZip1[0]': '1. Plaintiff mailing address: ZIP code',
  'Page2[0].List1[0].Item1[0].PlaintiffName2[0]': '1. Second plaintiff name',
  'Page2[0].List1[0].Item1[0].PlaintiffZip2[0]': '1. Second plaintiff street address: ZIP code',
  'Page2[0].List1[0].Item1[0].PlaintiffMailingZip2[0]': '1. Second plaintiff mailing address: ZIP code',
  'Page2[0].List2[0].item2[0].DefendantZip1[0]': '2. Defendant street address: ZIP code',
  'Page2[0].List2[0].item2[0].DefendantMailingZip1[0]': '2. Defendant mailing address: ZIP code',
  'Page2[0].List2[0].item2[0].DefendantName2[0]': '2. Agent for service of process (business or public entity defendant): name',
  'Page2[0].List2[0].item2[0].DefendantZip2[0]': '2. Agent for service of process: ZIP code',
  'Page3[0].List5[0].Lie[0].Checkbox5cb[0]': '5e. Other reason for filing at this courthouse',
  'Page3[0].List5[0].Lie[0].FillField55[0]': '5e. Other reason for filing at this courthouse (specify)',
  'Page3[0].List8[0].item8[0].Date4[0]': '8. Suing a public entity: date your written claim was filed',
  'Page4[0].Sign[0].Date1[0]': 'Date signed by the plaintiff',
  'Page4[0].Sign[0].Date2[0]': 'Date signed by the second plaintiff'
};

const SC120 = {
  'Page2[0].List1[0].plaintiffInfo[0].PlaintiffZip[0]': '1. Plaintiff (who sued first) street address: ZIP code',
  'Page2[0].List1[0].plaintiffInfo[0].PlaintiffMailZip[0]': '1. Plaintiff mailing address: ZIP code',
  'Page2[0].List1[0].NextPlaintiff[0].Plaintiff2Zip[0]': '1. Next plaintiff street address: ZIP code',
  'Page2[0].List1[0].NextPlaintiff[0].Plaintiff2MailZip[0]': '1. Next plaintiff mailing address: ZIP code',
  'Page2[0].List2[0].defInfo[0].DefZip[0]': '2. Defendant (suing now) street address: ZIP code',
  'Page2[0].List2[0].defInfo[0].DefMailZip[0]': '2. Defendant mailing address: ZIP code',
  'Page2[0].List2[0].NextDef[0].Def2Zip[0]': '2. Next defendant street address: ZIP code',
  'Page2[0].List2[0].NextDef[0].Def2MailZip[0]': '2. Next defendant mailing address: ZIP code',
  'Page3[0].List4[0].item4[0].Ch1[0]': '4. Have you asked the plaintiff to pay you before suing? Yes',
  'Page3[0].List4[0].item4[0].Ch1[1]': '4. Have you asked the plaintiff to pay you before suing? No',
  'Page3[0].List5[0].item5[0].Ch2[0]': '5. Is your claim about an attorney-client fee dispute? Yes',
  'Page3[0].List5[0].item5[0].Ch2[1]': '5. Is your claim about an attorney-client fee dispute? No',
  'Page3[0].List6[0].item6[0].Ch3[0]': '6. Are you suing a public entity? Yes',
  'Page3[0].List6[0].item6[0].Ch3[1]': '6. Are you suing a public entity? No',
  'Page3[0].List7[0].item7[0].Ch4[0]': '7. Have you filed more than 12 other small claims in California in the last 12 months? Yes',
  'Page3[0].List7[0].item7[0].Ch4[1]': '7. Have you filed more than 12 other small claims in California in the last 12 months? No'
};

const W = 'Page2[0].List4[0].Li1[0].List[0].Li1[0].';
const FL311 = {
  'Page1[0].TitleSub[0].Other_group[0].Other_cb[0]': 'Attachment to: Other',
  'Page1[0].TitleSub[0].Other_group[0].Specify_ft[0]': 'Attachment to: Other (specify the document)',
  'Page1[0].List1[0].Li1[0].tblMinorChildren[0].child1[0].Child1Age[0]': '1. Child 1: age',
  'Page1[0].List1[0].Li1[0].tblMinorChildren[0].child2[0].Child2Age[0]': '1. Child 2: age',
  'Page1[0].List1[0].Li1[0].tblMinorChildren[0].child3[0].Child3Age[0]': '1. Child 3: age',
  'Page1[0].List1[0].Li1[0].tblMinorChildren[0].child4[0].Child4Age[0]': '1. Child 4: age',
  [`${W}FirstWeekEnd_cb[0]`]: '4a(1). 1st weekend of the month',
  [`${W}TimeVisitsStart_ft[0]`]: '4a(1). 1st weekend: start time',
  [`${W}DayOfWeekVisitsEnd1_ft[0]`]: '4a(1). 1st weekend: ends on (day)',
  [`${W}TimeVisitsEnd1_ft[0]`]: '4a(1). 1st weekend: end time',
  [`${W}SecondWeekend_cb[0]`]: '4a(1). 2nd weekend of the month',
  [`${W}TimeVisitsStart2_ft[0]`]: '4a(1). 2nd weekend: start time',
  [`${W}DayOfWeekVisitsEnd3_ft[0]`]: '4a(1). 2nd weekend: ends on (day)',
  [`${W}TimeVisitsEnd3_ft[0]`]: '4a(1). 2nd weekend: end time',
  [`${W}ThirdWeekend_cb[0]`]: '4a(1). 3rd weekend of the month',
  [`${W}TimeVisitsStart4_ft[0]`]: '4a(1). 3rd weekend: start time',
  [`${W}DayOfWeekVisitsEnd5_ft[0]`]: '4a(1). 3rd weekend: ends on (day)',
  [`${W}TimeVisitsEnd5_ft[0]`]: '4a(1). 3rd weekend: end time',
  [`${W}FourthWeekend_cb[0]`]: '4a(1). 4th weekend of the month',
  [`${W}TimeVisitsStart6_ft[0]`]: '4a(1). 4th weekend: start time',
  [`${W}DayOfWeekVisitsEnd7_ft[0]`]: '4a(1). 4th weekend: ends on (day)',
  [`${W}TimeVisitsEnd7_ft[0]`]: '4a(1). 4th weekend: end time',
  [`${W}FifthWeekend_cb[0]`]: '4a(1). 5th weekend of the month',
  [`${W}TimeVisitsStart8_ft[0]`]: '4a(1). 5th weekend: start time',
  [`${W}DayOfWeekVisitsEnd9_ft[0]`]: '4a(1). 5th weekend: ends on (day)',
  [`${W}TimeVisitsEnd9_ft[0]`]: '4a(1). 5th weekend: end time',
  [`${W}List[0].Li2[0].CheckBox1b[0]`]: '4a(1)(b). The party who has the fifth weekend in odd or even months',
  [`${W}List[0].Li2[0].WeekendsOdd_cb[0]`]: '4a(1)(b). Fifth weekend in odd-numbered months',
  'Page2[0].List4[0].Li1[0].List[0].Li2[0].TimeVisitsStart10_ft[0]': '4a(2). Alternate weekends: start time',
  'Page2[0].List4[0].Li1[0].List[0].Li2[0].DayOfWeekAlternateWeekendVisitsEnd_ft[0]': '4a(2). Alternate weekends: ends on (day)',
  'Page2[0].List4[0].Li1[0].List[0].Li2[0].TimeVisitsEnd11_ft[0]': '4a(2). Alternate weekends: end time',
  'Page2[0].List4[0].Li1[0].List[0].Li3[0].TimeVisitsStart12_ft[0]': '4a(3). Weekdays: start time',
  'Page2[0].List4[0].Li1[0].List[0].Li3[0].DayOfWeekDayVisitsEnd_ft[0]': '4a(3). Weekdays: ends on (day)',
  'Page2[0].List4[0].Li1[0].List[0].Li3[0].TimeVisitsEnd13_ft[0]': '4a(3). Weekdays: end time',
  'Page2[0].List4[0].Li3[0].LocationOfMediationOrCCRC_tf[0]': '4c. Other ways visitation (parenting time) can happen in the best interests of the child (specify)',
  'Page3[0].List5[0].Li2[0].List[0].Li2[0].Other_cb[0]': '5b(2). Reasons are written in another place (Other)',
  'Page3[0].List5[0].Li2[0].List[0].Li2[0].Pick_Up_Address_ft[0]': '5b(2). Where the reasons are written (specify)',
  'Page3[0].List5[0].Li2[0].List[0].Li2[0].SpecifyReasonsforOrders_ft[0]': '5b(2). Reasons custody orders in item 4 are in the child’s best interest despite the allegations (write below)',
  'Page3[0].List5[0].Li3[0].List[0].Li2[0].List[0].Li2[0].CheckBox61[0]': '5c(2)(B). Reasons are written in another place (Other)',
  'Page3[0].List5[0].Li3[0].List[0].Li2[0].List[0].Li2[0].Pick_Up_Address_ft[0]': '5c(2)(B). Where the reasons are written (specify)',
  'Page3[0].List5[0].Li3[0].List[0].Li2[0].List[0].Li2[0].SpecifyReasonsforOrders_ft[0]': '5c(2)(B). Reasons unsupervised visitation is in the child’s best interest despite the allegations (write below)',
  'Page3[0].List5[0].Li3[0].List[0].Li3[0].SpecifyReasonsforOrders_ft[0]': '5c(3). Other visitation request (specify)',
  'Page4[0].List6[0].Li2[0].CheckBox61[0]': '6b. Reasons for supervised visitation are written in another place (Other)',
  'Page4[0].List6[0].Li2[0].Pick_Up_Address_ft[0]': '6b. Where the reasons are written (specify)',
  'Page4[0].List6[0].Li2[0].SpecifyReasonsforOrders_ft[0]': '6b. Reasons unsupervised visitation would not be in the child’s best interest (specify)',
  'Page4[0].List6[0].Li4[0].List[0].Li3[0].Respondent_cb[0]': '6d(3). Location of supervised visitation: Other',
  'Page4[0].List6[0].Li4[0].List[0].Li3[0].Pick_Up_Address_ft[0]': '6d(3). Location of supervised visitation: Other (describe)',
  'Page4[0].List6[0].Li5[0].List[0].Li4[0].Respondent_cb[0]': '6e(4). Schedule for supervised visitation: Other',
  'Page4[0].List7[0].Li7[0].CheckBox61[0]': '7g. Transportation and exchange: Other orders',
  'Page4[0].List7[0].Li7[0].OtherTransportationIssues_ft[0]': '7g. Transportation and exchange: Other (specify)',
  'Page5[0].List8[0].Li2[0].TransportToVisitsProvidedBy_Name_ft[0]': '8b. Written permission or a court order is needed to take the children to these counties (specify)',
  'Page5[0].List8[0].Li3[0].TransportFormVisitsProvidedBy_Name_ft[0]': '8c. Written permission or a court order is needed to take the children to these other places (specify)'
};

const UD100 = {
  'Page1[0].P1Caption[0].TitlePartyName[0].FillText140[0]': 'Defendants: DOES 1 to (number)',
  'Page1[0].List2[0].Item2[0].Lia[0].SubLista[0].Lii3[0].TwoA[0]': '2a(3). Plaintiff is: Other',
  'Page1[0].List2[0].Item2[0].Lia[0].SubLista[0].Lii3[0].FillText3[0]': '2a(3). Plaintiff is: Other (specify)',
  'Page1[0].List2[0].Item2[0].Lib[0].FillText4[0]': '2b. Fictitious business name plaintiff does business under (specify)',
  'Page1[0].List4[0].Four1[1]': '4. Plaintiff’s interest in the premises: Other',
  'Page1[0].List4[0].FillText120[0]': '4. Plaintiff’s interest in the premises: Other (specify)',
  'Page2[0].List6[0].SubList6[0].Lia[0].SubLista[0].Li1[0].FillText116[0]': '6a(1). Other tenancy (specify)',
  'Page2[0].List6[0].SubList6[0].Lia[0].SubLista[0].Li2[0].SixA2[1]': '6a(2). Rent payable: Other frequency',
  'Page2[0].List6[0].SubList6[0].Lia[0].SubLista[0].Li3[0].FillText114[0]': '6a(3). Rent is due on another day (specify)',
  'Page2[0].List6[0].SubList6[0].Lib[0].SubListb[0].Li4[0].SixB14[0]': '6b(4). Agreement was made with: Other',
  'Page2[0].List6[0].SubList6[0].Lib[0].SubListb[0].Li4[0].FillText113[0]': '6b(4). Agreement was made with: Other (specify)',
  'Page2[0].List6[0].SubList6[0].Lic[0].SubListc[0].Li3[0].SixC13[0]': '6c(3). The defendants not named in item 6a are: Other',
  'Page2[0].List6[0].SubList6[0].Lic[0].SubListc[0].Li3[0].FillText113[0]': '6c(3). The defendants not named in item 6a are: Other (specify)',
  'Page2[0].List6[0].SubList6[0].Lid[0].fl1001\\.29[0]': '6d. The agreement was later changed as follows (specify)',
  'Page2[0].List7[0].Item7[0].Lia[0].FillText206[0]': '7a. Not subject to the Tenant Protection Act: the specific subpart supporting why the tenancy is exempt',
  'Page3[0].List11[0].Item11[0].Lic[0].Correspond2[0]': '11c. Plaintiff has pending rental-assistance applications for the amount demanded in the notice',
  'Page3[0].List11[0].Item11[0].Lid[0].After2[0]': '11d. Plaintiff has pending rental-assistance applications for rent accruing after the notice date',
  'Page4[0].List20[0].Item20[0].Lii[0].Seventeenh[0]': '20i. Plaintiff requests: Other',
  'Page4[0].List20[0].Item20[0].Lii[0].text124[0]': '20i. Plaintiff requests: Other (specify)',
  'Page4[0].List22[0].Nineteendid[1]': '22. An unlawful detainer assistant did give advice or assistance for compensation with this form'
};

const CHILD_AGES = (prefix) => ({
  [`${prefix}Child1Age_tf[0]`]: 'Child 1: age',
  [`${prefix}Child2Age_tf[0]`]: 'Child 2: age',
  [`${prefix}Child3Age_tf[0]`]: 'Child 3: age',
  [`${prefix}Child4Age_tf[0]`]: 'Child 4: age'
});

const FL100 = {
  'Page1[0].CheckBox61[0]': '3a(1). Date of marriage',
  'Page1[0].CheckBox61[1]': '3b(1). Registration date of domestic partnership',
  'Page1[0].DateTimeField1[0]': '3b(1). Registration date of domestic partnership (date)',
  ...Object.fromEntries(Object.entries(CHILD_AGES('Page1[0].MinorChildren_sf[0].')).map(([key, label]) => [key, `4. ${label}`])),
  'Page2[0].ToOther_cb[0]': '6a. Legal custody of children to: Other',
  'Page2[0].ToOther_cb[1]': '6b. Physical custody of children to: Other',
  'Page2[0].ForOther_cb[0]': '6c. Child visitation (parenting time) granted to: Other',
  'Page3[0].SpecifyFormerName_tf[0]': 'Petitioner’s former name to be restored (specify)'
};

const FL120 = {
  ...Object.fromEntries(Object.entries(CHILD_AGES('Page1[0].MinorChildren_sf[0].')).map(([key, label]) => [key, `4. ${label}`])),
  'Page2[0].ToOther_cb[0]': '6a. Legal custody of children to: Other',
  'Page2[0].ToOther_cb[1]': '6b. Physical custody of children to: Other',
  'Page2[0].ForOther_cb[0]': '6c. Child visitation (parenting time) granted to: Other',
  'Page3[0].SpecifyFormerName_tf[0]': 'Respondent’s former name to be restored (specify)'
};

const FL300 = {
  'Page1[0].List2[0].Li1[0].other_cb[0]': '2b. Address of court: Other',
  'Page1[0].List2[0].Li1[0].Otherspecify_ft[0]': '2b. Address of court: Other (specify)',
  'Page2[0].List1[0].Li1[0].CriminalProtectiveOrders_CountyState_ft[0]': '1a. Criminal protective order: county and state',
  'Page2[0].List1[0].Li2[0].FamilyCourtRestrainingOrders_CountyState_ft[0]': '1b. Family restraining order: county and state',
  'Page2[0].List1[0].Li3[0].JuvenileCourtRestrainingOrders_CountyState_ft[0]': '1c. Juvenile restraining order: county and state',
  'Page2[0].List1[0].Li4[0].OtherCourtRestrainingOrders_CountyState_ft[0]': '1d. Other restraining order: county and state',
  'Page2[0].List2[0].Li2[0].List[0].Li1[0].CheckBoxother[0]': '2b(1). Custody and visitation as requested in: Other',
  'Page2[0].List2[0].Li2[0].List[0].Li1[0].Otherspecify_tf[0]': '2b(1). Custody and visitation as requested in: Other (specify)',
  'Page4[0].List5[0].Li1[0].ListPropertyforExclusiveUseandControl_ft[0]': '5a. Property for temporary exclusive use and control (specify)'
};

const FL105 = {
  'Page1[0].List3[0].Li1[0].Table3a[0].Row2[0].To2[0]': '3a. Residence 2: lived there to (date)',
  'Page1[0].List3[0].Li1[0].Table3a[0].Row3[0].To3[0]': '3a. Residence 3: lived there to (date)',
  'Page1[0].List3[0].Li1[0].Table3a[0].Row4[0].To4[0]': '3a. Residence 4: lived there to (date)',
  'Page1[0].List3[0].Li1[0].Table3a[0].Row5[0].To5[0]': '3a. Residence 5: lived there to (date)',
  'Page2[0].Item4subformset[0].List4[0].Li1[0].OtherCaseYN[0]': '4. Do you know of, or have you taken part in, another custody or visitation case about this child? Yes',
  'Page2[0].Item5subformset[0].List5[0].Li1[0].Table5[0].Row5d[0].ROCell5d[0].OtherRO_CB5d[0]': '5d. Other restraining or protective order'
};

const FW001 = {
  'Page1[0].List1[0].item1[0].PetitionerName1[0]': '1. Your name (person asking the court to waive fees)',
  'Page1[0].List3[0].Lia[0].PetLawyerAdvanceFeesY[0]': '3a. Has your lawyer agreed to advance all or part of your fees or costs? Yes',
  'Page1[0].List3[0].Lia[0].PetLawyerAdvanceFeesY[1]': '3a. Has your lawyer agreed to advance all or part of your fees or costs? No',
  'Page1[0].List5[0].Lia[0].PublicBenefitSSP[0]': '5a. Public benefits I receive: SSP',
  'Page1[0].List5[0].Lia[0].PublicBenefitCAPI12[0]': '5a. Public benefits I receive: WIC',
  'Page1[0].Sign[0].SigDate[0]': 'Date signed'
};

const FL141 = {
  '#subform[0].PreOther_gp[0].PreOtherSpecify_cb[0]': 'Preliminary declaration served by: Other',
  '#subform[0].PreOtherSpecify_ft[0]': 'Preliminary declaration served by: Other (specify)',
  '#subform[0].FinOther_gp[0].FinOther_cb[0]': 'Final declaration served by: Other',
  '#subform[0].FinSpecify_ft[0]': 'Final declaration served by: Other (specify)'
};

const FL170 = {
  'Page2[0].RB2Choices[4]': '6a. The UCCJEA declaration (FL-105) has changed since it was last filed',
  'Page2[0].RB2Choices[12]': '7b(2). To the best of my knowledge, the other party is receiving public assistance',
  'Page2[0].RB2Choices[27]': '8f. Support: Other',
  'Page2[0].FillText109[0]': '8f. Support: Other (specify)'
};

const FL342 = {
  'Page1[0].AttachmentTo[0].AttachmentToCheckbox5[0]': 'Attachment to: Other',
  'Page2[0].List6[0].LI1[0].Item6a[0].Item6aCheckbox3[0]': '6a. Child support payable: Other schedule'
};

const FL142 = {
  'Page4[0].SignSub[0].SigDate[0]': 'Date signed'
};

const COURT_FIELD_LABELS = {
  'fl-150': FL150_LABELS,
  'sc-100': SC100,
  'sc-120': SC120,
  'fl-311': FL311,
  'ud-100': UD100,
  'fl-100': FL100,
  'fl-120': FL120,
  'fl-300': FL300,
  'fl-105': FL105,
  'fw-001': FW001,
  'fl-141': FL141,
  'fl-170': FL170,
  'fl-342': FL342,
  'fl-142': FL142
};

// Field name without the form's root segment ("FL-311[0].").
function fieldKey(name) {
  return String(name).replace(/^[^.]*\[0\]\./, '');
}

function courtFieldLabel(slug, name) {
  const labels = COURT_FIELD_LABELS[slug];
  return labels ? labels[fieldKey(name)] || '' : '';
}

module.exports = { COURT_FIELD_LABELS, courtFieldLabel, fieldKey };
