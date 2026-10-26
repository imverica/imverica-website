// Form I-485 (edition 09/18/26), Part 2, Item 3: every filing category with the
// PDF checkbox it ticks and what follows from it on the rest of the form.
//   basis       the wizard's adjustment_basis option the category belongs to
//   section     3.a-3.g on the form
//   field       PDF checkbox (indexes follow the on-states, not the print order)
//   i864        Part 3: '1.c', '1.d', '1.e' (not required by statute), or 'ask'
//               when the applicant must choose 1.a, 1.b or 1.f
//   publicCharge Part 9, Item 56 checkbox index: an exempt category, 23 for
//               "I do not fall under any of the exempt categories", or null
//               when the wizard has to ask
//   ina245i     whether Part 2, Item 4 (INA 245(i)) applies to the category
const CATEGORIES = [
  // 3.a Family-based: immediate relatives of a U.S. citizen
  { value: 'Spouse of a U.S. citizen', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[0]', i864: 'ask', publicCharge: 23, ina245i: true },
  { value: 'Unmarried child under 21 of a U.S. citizen', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[1]', i864: 'ask', publicCharge: 23, ina245i: true },
  { value: 'Parent of a U.S. citizen (citizen is 21 or older)', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[2]', i864: 'ask', publicCharge: 23, ina245i: true },
  { value: 'K-1 fiance(e) or K-2 child of a U.S. citizen', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[3]', i864: 'ask', publicCharge: 23, ina245i: true },
  { value: 'Widow or widower of a U.S. citizen', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[4]', i864: '1.c', publicCharge: 23, ina245i: true },
  { value: 'Spouse, child or parent of a deceased U.S. service member (NDAA)', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[5]', i864: 'ask', publicCharge: 22, ina245i: true },
  // 3.a Family-based preference categories
  { value: 'F1: Unmarried son or daughter (21+) of a U.S. citizen', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[6]', i864: 'ask', publicCharge: 23, ina245i: true },
  { value: 'F3: Married son or daughter of a U.S. citizen', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[7]', i864: 'ask', publicCharge: 23, ina245i: true },
  { value: 'F4: Brother or sister of a U.S. citizen (citizen is 21 or older)', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[8]', i864: 'ask', publicCharge: 23, ina245i: true },
  { value: 'F2A: Spouse of a permanent resident', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[9]', i864: 'ask', publicCharge: 23, ina245i: true },
  { value: 'F2A: Unmarried child under 21 of a permanent resident', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[10]', i864: 'ask', publicCharge: 23, ina245i: true },
  { value: 'F2B: Unmarried son or daughter (21+) of a permanent resident', basis: 'Family petition', section: '3.a', field: 'Pt2Line3a_CB[11]', i864: 'ask', publicCharge: 23, ina245i: true },
  // 3.a VAWA self-petitioners
  { value: 'VAWA self-petitioning spouse', basis: 'VAWA / special immigrant', section: '3.a', field: 'Pt2Line3a_CB[12]', i864: '1.d', publicCharge: 5, ina245i: true },
  { value: 'VAWA self-petitioning child', basis: 'VAWA / special immigrant', section: '3.a', field: 'Pt2Line3a_CB[13]', i864: '1.d', publicCharge: 5, ina245i: true },
  { value: 'VAWA self-petitioning parent', basis: 'VAWA / special immigrant', section: '3.a', field: 'Pt2Line3a_CB[14]', i864: '1.d', publicCharge: 5, ina245i: true },
  // 3.b Employment-based
  { value: 'Investor (Form I-526 or I-526E)', basis: 'Employment petition', section: '3.b', field: 'Pt2Line3b_CB526[0]', i864: '1.e', publicCharge: 23, ina245i: true },
  { value: 'EB-1: Alien of extraordinary ability', basis: 'Employment petition', section: '3.b', field: 'Pt2Line3b_CB140[0]', i864: 'relative', publicCharge: 23, ina245i: true },
  { value: 'EB-1: Outstanding professor or researcher', basis: 'Employment petition', section: '3.b', field: 'Pt2Line3b_CB140[1]', i864: 'relative', publicCharge: 23, ina245i: true },
  { value: 'EB-1: Multinational executive or manager', basis: 'Employment petition', section: '3.b', field: 'Pt2Line3b_CB140[2]', i864: 'relative', publicCharge: 23, ina245i: true },
  { value: 'EB-2: Advanced degree or exceptional ability (no NIW)', basis: 'Employment petition', section: '3.b', field: 'Pt2Line3b_CB140[3]', i864: 'relative', publicCharge: 23, ina245i: true },
  { value: 'EB-3: Professional', basis: 'Employment petition', section: '3.b', field: 'Pt2Line3b_CB140[4]', i864: 'relative', publicCharge: 23, ina245i: true },
  { value: 'EB-3: Skilled worker', basis: 'Employment petition', section: '3.b', field: 'Pt2Line3b_CB140[5]', i864: 'relative', publicCharge: 23, ina245i: true },
  { value: 'EB-3: Other worker', basis: 'Employment petition', section: '3.b', field: 'Pt2Line3b_CB140[6]', i864: 'relative', publicCharge: 23, ina245i: true },
  { value: 'EB-2: National Interest Waiver', basis: 'Employment petition', section: '3.b', field: 'Pt2Line3b_CB140[7]', i864: 'relative', publicCharge: 23, ina245i: true },
  // 3.c Special immigrants
  { value: 'Special Immigrant Juvenile', basis: 'VAWA / special immigrant', section: '3.c', field: 'Pt2Line3c_CB[1]', i864: '1.e', publicCharge: 6, ina245i: true },
  { value: 'Certain Afghan or Iraqi national', basis: 'VAWA / special immigrant', section: '3.c', field: 'Pt2Line3c_CB[0]', i864: '1.e', publicCharge: 0, ina245i: true },
  { value: 'Certain international broadcaster', basis: 'VAWA / special immigrant', section: '3.c', field: 'Pt2Line3c_CB[3]', i864: '1.e', publicCharge: 23, ina245i: true },
  { value: 'Certain G-4 international organization or NATO-6 employee or family member', basis: 'VAWA / special immigrant', section: '3.c', field: 'Pt2Line3c_CB[2]', i864: '1.e', publicCharge: 23, ina245i: true },
  { value: 'Certain U.S. armed forces member (Six and Six program)', basis: 'VAWA / special immigrant', section: '3.c', field: 'Pt2Line3c_CB[5]', i864: '1.e', publicCharge: 23, ina245i: true },
  { value: 'Panama Canal Zone employee', basis: 'VAWA / special immigrant', section: '3.c', field: 'Pt2Line3c_CB[4]', i864: '1.e', publicCharge: 23, ina245i: true },
  { value: 'Certain physician', basis: 'VAWA / special immigrant', section: '3.c', field: 'Pt2Line3c_CB[6]', i864: '1.e', publicCharge: 23, ina245i: true },
  { value: 'Certain employee or former employee of the U.S. government abroad', basis: 'VAWA / special immigrant', section: '3.c', field: 'Pt2Line3c_CB[7]', i864: '1.e', publicCharge: 23, ina245i: true },
  { value: 'Religious worker: minister of religion', basis: 'VAWA / special immigrant', section: '3.c', field: 'Pt2Line3c_CB[9]', i864: '1.e', publicCharge: 23, ina245i: true },
  { value: 'Religious worker: other religious worker', basis: 'VAWA / special immigrant', section: '3.c', field: 'Pt2Line3c_CB[8]', i864: '1.e', publicCharge: 23, ina245i: true },
  // 3.d Asylee or refugee
  { value: 'Asylee (INA 208, Form I-589 or I-730)', basis: 'Asylee or refugee', section: '3.d', field: 'Pt2Line3d_AsyleeRefugeeCB[0]', i864: '1.e', publicCharge: 3, ina245i: false },
  { value: 'Refugee (INA 207, Form I-590 or I-730)', basis: 'Asylee or refugee', section: '3.d', field: 'Pt2Line3d_AsyleeRefugeeCB[1]', i864: '1.e', publicCharge: 1, ina245i: false },
  // 3.e Human trafficking or crime victim
  { value: 'T nonimmigrant (human trafficking victim)', basis: 'Other or not sure', section: '3.e', field: 'Pt2Line3e_CB[0]', i864: '1.e', publicCharge: 9, ina245i: false },
  { value: 'U nonimmigrant (victim of qualifying criminal activity)', basis: 'Other or not sure', section: '3.e', field: 'Pt2Line3e_CB[1]', i864: '1.e', publicCharge: 2, ina245i: false },
  // 3.f Special programs based on certain public laws
  { value: 'Cuban Adjustment Act', basis: 'Other or not sure', section: '3.f', field: 'Pt2Line3f_CB[0]', i864: '1.e', publicCharge: 7, ina245i: false },
  { value: 'Cuban Adjustment Act: battered spouse or child', basis: 'Other or not sure', section: '3.f', field: 'Pt2Line3f_CB[1]', i864: '1.e', publicCharge: 10, ina245i: false },
  { value: 'HRIFA: dependent status', basis: 'Other or not sure', section: '3.f', field: 'Pt2Line3f_CB[2]', i864: '1.e', publicCharge: 11, ina245i: false },
  { value: 'HRIFA: battered spouse or child', basis: 'Other or not sure', section: '3.f', field: 'Pt2Line3f_CB[3]', i864: '1.e', publicCharge: 8, ina245i: false },
  { value: 'Lautenberg parolee', basis: 'Other or not sure', section: '3.f', field: 'Pt2Line3f_CB[4]', i864: '1.e', publicCharge: 18, ina245i: false },
  { value: 'Diplomat or high-ranking official unable to return home (Section 13)', basis: 'Other or not sure', section: '3.f', field: 'Pt2Line3f_CB[5]', i864: '1.e', publicCharge: null, ina245i: false },
  { value: 'National of Vietnam, Cambodia or Laos (section 586 of Public Law 106-429)', basis: 'Other or not sure', section: '3.f', field: 'Pt2Line3f_CB[6]', i864: '1.e', publicCharge: 19, ina245i: false },
  { value: 'Amerasian Act (October 22, 1982)', basis: 'Other or not sure', section: '3.f', field: 'Pt2Line3f_CB[7]', i864: '1.e', publicCharge: null, ina245i: false },
  // 3.g Additional options
  { value: 'Diversity Visa program', basis: 'Diversity visa', section: '3.g', field: 'Pt2Line3g_CB[0]', i864: '1.e', publicCharge: 23, ina245i: true },
  { value: 'Continuous residence since before January 1, 1972 (Registry)', basis: 'Other or not sure', section: '3.g', field: 'Pt2Line3g_CB[1]', i864: '1.e', publicCharge: 13, ina245i: false },
  { value: 'Born in the United States under diplomatic status', basis: 'Other or not sure', section: '3.g', field: 'Pt2Line3g_CB[2]', i864: '1.e', publicCharge: null, ina245i: false },
  { value: 'S nonimmigrant or qualifying family member', basis: 'Other or not sure', section: '3.g', field: 'Pt2Line3g_CB[3]', i864: '1.e', publicCharge: null, ina245i: false },
  { value: 'Other eligibility', basis: 'Other or not sure', section: '3.g', field: 'Pt2Line3g_CB[4]', i864: 'ask', publicCharge: null, ina245i: false }
];

// Part 9, Item 56 options in print order: [checkbox index, wizard label].
const PUBLIC_CHARGE_OPTIONS = [
  [5, 'VAWA self-petitioner (Form I-360)'],
  [6, 'Special Immigrant Juvenile (Form I-360)'],
  [0, 'Certain Afghan or Iraqi national (Form I-360 or DS-157)'],
  [3, 'Asylee (Form I-589 or I-730)'],
  [1, 'Refugee (Form I-590 or I-730)'],
  [2, 'U nonimmigrant adjusting under INA 245(m)'],
  [4, 'Another category, but in valid U nonimmigrant status when filing'],
  [9, 'T nonimmigrant adjusting under INA 245(l)'],
  [12, 'Another category, but with a pending prima facie or approved T application'],
  [7, 'Cuban Adjustment Act'],
  [10, 'Cuban Adjustment Act: battered spouse or child'],
  [11, 'HRIFA: dependent status'],
  [8, 'HRIFA: battered spouse or child'],
  [17, 'Cuban and Haitian entrant (IRCA section 202)'],
  [18, 'Lautenberg parolee'],
  [19, 'National of Vietnam, Cambodia or Laos'],
  [13, 'Registry (continuous residence since before January 1, 1972)'],
  [15, 'Amerasian Homecoming Act'],
  [16, 'Polish or Hungarian parolee'],
  [14, 'NACARA section 203'],
  [20, 'American Indian born in Canada or Texas Band of Kickapoo Indians'],
  [21, 'Liberian Refugee Immigration Fairness (NDAA FY2020 section 7611)'],
  [24, 'Syrian national under Public Law 106-378'],
  [22, 'Spouse, child or parent of a U.S. active-duty service member (NDAA)'],
  [23, 'I do not fall under any of the exempt categories']
];
const PUBLIC_CHARGE_NOT_EXEMPT = 23;

// Part 3 (Affidavit of Support) checkbox index by answer: [0]=1.a ... [5]=1.f.
const I864_INDEX = { '1.a': 0, '1.b': 1, '1.c': 2, '1.d': 3, '1.e': 4, '1.f': 5 };
const I864_OPTIONS = [
  ['1.f', 'A sponsor will file Form I-864 or I-864EZ for me'],
  ['1.a', 'I have earned or can be credited with 40 qualifying quarters of work'],
  ['1.b', 'I am under 18, unmarried, the child of a U.S. citizen and will become a citizen automatically (INA 320)'],
  ['1.e', 'An Affidavit of Support is not required for my category']
];

const BY_VALUE = new Map(CATEGORIES.map((category) => [category.value, category]));

function categoryByValue(value) {
  return BY_VALUE.get(String(value || '').trim()) || null;
}

function categoriesForBasis(basis) {
  return CATEGORIES.filter((category) => category.basis === basis);
}

// Wizard condition helpers: category values for which a follow-up applies.
function categoryValues(predicate) {
  return CATEGORIES.filter(predicate).map((category) => category.value);
}

module.exports = {
  CATEGORIES,
  PUBLIC_CHARGE_OPTIONS,
  PUBLIC_CHARGE_NOT_EXEMPT,
  I864_INDEX,
  I864_OPTIONS,
  categoryByValue,
  categoriesForBasis,
  categoryValues
};
