const { i485PublicChargeSteps } = require('./i485-review-steps');
const part9Logic = require('../../../form-logic/i-485.part9.json');

// Keys are the item numbers in the PDF field names (edition 01/20/25 numbering);
// labels follow the wording of edition 09/18/26.
const ITEM_LABELS = {
  '1': 'Have you EVER been a member of, involved in, or associated with any organization, association, fund, foundation, party, club, society, or similar group?',
  '10': 'Have you EVER been denied admission to the United States?',
  '11': 'Have you EVER been denied a visa to the United States?',
  '12': 'Have you EVER worked in the United States without authorization?',
  '13': 'Have you EVER violated the terms or conditions of your nonimmigrant status?',
  '14': 'Are you presently or have you EVER been in removal, exclusion, rescission, or deportation proceedings?',
  '15': 'Have you EVER been issued a final order of exclusion, deportation, or removal?',
  '16': 'Have you EVER had a prior final order of exclusion, deportation, or removal reinstated?',
  '17': 'Have you EVER been granted voluntary departure but failed to depart within the allotted time?',
  '18': 'Have you EVER applied for any kind of relief or protection from removal, exclusion, or deportation?',
  '19': 'Have you EVER been a J nonimmigrant exchange visitor subject to the two-year foreign residence requirement?',
  '20': 'If yes to Item 19, have you complied with the foreign residence requirement?',
  '21': 'If yes to Item 19 and no to Item 20, have you been granted a waiver or favorable waiver recommendation?',
  '22': 'Have you EVER been arrested, cited, charged, detained, or permitted to participate in a diversion program?',
  '23': 'Have you EVER committed a crime of any kind, even if not arrested, charged, tried, or convicted?',
  '24': 'Have you EVER pled guilty to or been convicted of a crime or offense?',
  '25': 'Have you EVER been ordered punished by a judge or had conditions imposed that restrained your liberty?',
  '26': 'Have you EVER violated any controlled substance law or regulation?',
  '27': 'Have you EVER trafficked in, benefited from, or assisted illegal trafficking of controlled substances?',
  '28': 'Are you the spouse, son, or daughter of someone involved in illicit controlled substance trafficking and received benefits within the last 5 years?',
  '29': 'If yes to Item 28, did you know or should you reasonably have known the benefit resulted from that activity?',
  '30': 'Have you EVER engaged in prostitution or are you coming to the United States to engage in prostitution?',
  '31': 'Have you EVER directly or indirectly procured, attempted to procure, or imported prostitutes or persons for prostitution?',
  '32': 'Have you EVER received proceeds or money from prostitution?',
  '33': 'Do you intend to engage in illegal gambling or other commercialized vice while in the United States?',
  '34': 'Have you EVER exercised immunity to avoid being prosecuted for a criminal offense in the United States?',
  '35.a': 'Have you EVER served as a foreign government official?',
  '35.b': 'If yes to Item 35.a, have you EVER been responsible for, enforced, or carried out violations of religious freedoms?',
  '36': 'Have you EVER induced, forced, fraudulently caused, or been involved in trafficking another person for commercial sex acts?',
  '37': 'Have you EVER trafficked a person into involuntary servitude, peonage, debt bondage, or slavery?',
  '38': 'Have you EVER knowingly aided, abetted, assisted, conspired, or colluded in trafficking in persons?',
  '39': 'Are you the spouse, son, or daughter of someone who engaged in trafficking in persons and received benefits within the last 5 years?',
  '40': 'If yes to Item 39, did you know or should you reasonably have known the benefit resulted from trafficking activity?',
  '41': 'Have you EVER engaged in money laundering or knowingly assisted money laundering?',
  '42.a': 'Do you intend to engage in espionage or sabotage in the United States?',
  '42.b': 'Do you intend to violate or evade U.S. export control laws?',
  '42.c': 'Do you intend to oppose, control, or overthrow the U.S. Government by force, violence, or other unlawful means?',
  '42.d': 'Do you intend to engage in any other unlawful activity?',
  '43.a': 'Have you EVER received weapons training, paramilitary training, or military-type training?',
  '43.b': 'Have you EVER committed kidnapping, assassination, hijacking, or sabotage?',
  '43.c': 'Have you EVER used a weapon, explosive, or dangerous device to harm another person or property?',
  '43.d': 'Have you EVER threatened, attempted, conspired, prepared, or planned activities described in Items 43.b-43.c?',
  '43.e': 'Have you EVER incited activities described in Items 43.b-43.c?',
  '43.f': 'Have you EVER participated in or been a member of a group or organization that did activities described in Items 43.b-43.e?',
  '43.g': 'Have you EVER recruited members or asked for money or value for a group that did activities described in Items 43.b-43.e?',
  '43.h': 'Have you EVER provided money, services, labor, assistance, or support for activities described in Items 43.b-43.e?',
  '43.i': 'Have you EVER supported an individual, group, or organization that did activities described in Items 43.b-43.e?',
  '44': 'Do you intend to engage in any activities listed in Items 43.b-43.e?',
  '45': 'Do you intend to engage in activity that could endanger the welfare, safety, or security of the United States?',
  '46': 'Are you the spouse or child of an individual who EVER engaged in activities listed in Items 43.b-43.i?',
  '47': 'Have you EVER sold, provided, transported weapons, or assisted someone with weapons to be used against another person?',
  '48': 'Have you EVER worked, volunteered, served, directed, or participated in a prison, jail, detention facility, labor camp, or similar place?',
  '49': 'Have you EVER been a member of, assisted, or participated in a group or organization that used weapons or threatened to use weapons?',
  '50': 'Have you EVER served in, been a member of, assisted, or participated in any military or police unit?',
  '51': 'Have you EVER served in, been a member of, assisted, or participated in any armed group?',
  '52': 'Have you EVER been a member of or affiliated with the Communist Party or any totalitarian party?',
  '53.a': 'Have you EVER ordered, incited, committed, assisted, helped with, or participated in torture?',
  '53.b': 'Have you EVER ordered, incited, committed, assisted, helped with, or participated in genocide?',
  '53.c': 'Have you EVER killed or tried to kill any person?',
  '53.d': 'Have you EVER intentionally and severely injured or tried to injure any person?',
  '54': 'Have you EVER recruited, enlisted, conscripted, or used a person under 15 years old to participate in hostilities or serve in an armed force or group?',
  '55': 'Have you EVER used a person under 15 years old to take part in hostilities or support combat?',
  '63': 'Have you EVER received any means-tested public benefit? Answer Yes only if you have received means-tested public benefits, in the past or now.',
  '67': 'Have you EVER failed or refused to attend or to remain in attendance at any removal proceeding filed against you on or after April 1, 1997?',
  '68': 'Have you EVER submitted altered, fraudulent, or counterfeit documentation to any U.S. Government official to obtain or attempt to obtain any immigration benefit, including a visa or entry into the United States?',
  '69': 'Have you EVER lied about, concealed, or misrepresented any information on an application or petition to obtain a visa, other documentation required for entry into the United States, admission to the United States, or any other kind of immigration benefit?',
  '70': 'Have you EVER falsely claimed to be a U.S. citizen (in writing or any other way)?',
  '71': 'Have you EVER been a stowaway on a vessel or aircraft arriving in the United States?',
  '72': 'Have you EVER knowingly encouraged, induced, assisted, abetted, or aided any alien to enter or to try to enter the United States illegally (alien smuggling)?',
  '73': 'Are you under a final order of civil penalty for violating INA section 274C for use of fraudulent documents?',
  '74': 'Have you EVER been excluded, deported, or removed from the United States, or have you ever departed the United States on your own after having been ordered excluded, deported, or removed?',
  '75': 'Have you EVER entered the United States without being inspected and admitted or paroled?',
  '76': 'Since April 1, 1997, have you been unlawfully present in the United States?',
  '77': 'If you answered Yes to Item 74, was a severe form of trafficking in persons at least one central reason for your unlawful presence in the United States?',
  '78.a': 'Since April 1, 1997, have you EVER reentered or attempted to reenter the United States without being inspected and admitted or paroled after having been unlawfully present in the United States for more than one year in the aggregate on or after April 1, 1997?',
  '78.b': 'Since April 1, 1997, have you EVER reentered or attempted to reenter the United States without being inspected and admitted or paroled after having been deported, excluded, or removed from the United States?',
  '79': 'Do you plan to practice polygamy in the United States?',
  '80': 'Are you accompanying an alien who is inadmissible and who has been certified by a medical officer as helpless from sickness, mental or physical disability, or infancy, and who requires your protection or guardianship (INA section 232(c))?',
  '81': 'Have you EVER assisted in detaining, retaining, or withholding custody of a U.S. citizen child outside the United States from a person who has been granted custody of the child?',
  '82': 'Have you EVER voted in violation of any Federal, state, or local constitutional provision, statute, ordinance, or regulation in the United States?',
  '83': 'Have you EVER renounced U.S. citizenship to avoid being taxed by the United States?',
  '84.a': 'Have you EVER applied for exemption or discharge from training or service in the U.S. armed forces or in the U.S. National Security Training Corps on the ground that you are an alien?',
  '84.b': 'Have you EVER been relieved or discharged from such training or service on the ground that you are an alien?',
  '84.c': 'Have you EVER been convicted of desertion from the U.S. armed forces?',
  '85': 'Have you EVER left or remained outside the United States to avoid or evade training or service in the U.S. armed forces in time of war or a period declared by the President to be a national emergency?',
  '86': 'If you answered Yes to Item 83, what was your nationality or immigration status immediately before you left (for example, U.S. citizen or national, lawful permanent resident, nonimmigrant, parolee, present without admission or parole, or any other status)?'
};

const PAGE_GROUPS = [
  {
    id: 'i485_part9_entries',
    title: 'Part 9 eligibility: organizations, entries, and prior immigration issues',
    help: 'Answer the official I-485 Part 9 questions. Follow-up fields appear only when needed.',
    items: ['1', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21']
  },
  {
    id: 'i485_part9_criminal',
    title: 'Part 9 eligibility: criminal acts and trafficking questions',
    help: 'If any answer is Yes, the flow will require a Part 14 explanation before PDF generation.',
    items: ['22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35.a', '35.b', '36', '37', '38', '39', '40', '41']
  },
  {
    id: 'i485_part9_security',
    title: 'Part 9 eligibility: security and related questions',
    help: 'Security-related Yes answers require a detailed Part 14 explanation with dates and location.',
    items: ['42.a', '42.b', '42.c', '42.d', '43.a', '43.b', '43.c', '43.d', '43.e', '43.f', '43.g', '43.h', '43.i', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53.a', '53.b', '53.c', '53.d', '54', '55']
  },
  {
    id: 'i485_part9_other',
    title: 'Part 9 eligibility: public charge and other admissibility questions',
    help: 'These remaining Part 9 questions help identify additional explanations or documents.',
    items: ['63', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78.a', '78.b', '79', '80', '81', '82', '83', '84.a', '84.b', '84.c', '85', '86']
  }
];

function itemMap() {
  return new Map(part9Logic.items.map((item) => [item.item, item]));
}

function conditionToField(condition, itemsByNumber) {
  const item = itemsByNumber.get(condition.item);
  if (!item) return null;
  return {
    id: item.key,
    equals: condition.equals === 'yes' ? 'Yes' : condition.equals === 'no' ? 'No' : condition.equals
  };
}

function dependencyShowWhen(itemNumber, itemsByNumber) {
  const dependency = part9Logic.dependencies.find((item) => item.requireItem === itemNumber);
  if (!dependency) return null;
  return dependency.when.map((condition) => conditionToField(condition, itemsByNumber)).filter(Boolean);
}

function part14ShowWhenAny(trigger, itemsByNumber) {
  return trigger.items
    .map((itemNumber) => {
      const item = itemsByNumber.get(itemNumber);
      return item ? { id: item.key, equals: 'Yes' } : null;
    })
    .filter(Boolean);
}

// The number printed on the current form (Part 9 was renumbered from Item 64 on).
function printedNumber(itemNumber, itemsByNumber) {
  return itemsByNumber.get(itemNumber)?.printed || itemNumber;
}

function yesNoField(field, item, itemsByNumber, showWhenAny, extraShowWhen = []) {
  const dependency = dependencyShowWhen(item.item, itemsByNumber);
  const showWhen = dependency || extraShowWhen.length ? [...(dependency || []), ...extraShowWhen] : null;
  return field(item.key, `${printedNumber(item.item, itemsByNumber)}. ${ITEM_LABELS[item.item] || item.topic || item.item}`, 'radio', {
    required: true,
    options: ['Yes', 'No'],
    part: 9,
    itemNumber: item.item,
    pdfKey: item.key,
    ...(showWhen ? { showWhen } : {}),
    ...(showWhenAny ? { showWhenAny } : {})
  });
}

function item86Field(field, itemsByNumber) {
  return field('Pt9Line86_Nationality', `${printedNumber('86', itemsByNumber)}. ${ITEM_LABELS['86']}`, 'textarea', {
    required: true,
    part: 9,
    itemNumber: '86',
    pdfKey: 'Pt9Line86_Nationality',
    showWhen: [conditionToField({ item: '85', equals: 'yes' }, itemsByNumber)]
  });
}

function organizationDetailFields(field, itemsByNumber) {
  const showWhen = [conditionToField({ item: '1', equals: 'yes' }, itemsByNumber)];
  const second = [...showWhen, { id: 'pt9_second_org', equals: 'Yes' }];
  return [
    field('Pt9Line2_Organization1', 'Organization name', 'text', { required: true, showWhen }),
    field('Pt9Line3_CityTownOfBirth', 'Organization city or town', 'text', { showWhen }),
    field('Pt9Line3_State', 'Organization state or province', 'text', { showWhen }),
    field('Pt9Line3_Country', 'Organization country', 'text', { showWhen }),
    field('Pt9Line4_FamilyName', 'Nature of organization and its purpose or activities', 'textarea', { required: true, showWhen }),
    field('Pt9Line4_Involvement', 'Nature of your involvement and role or positions held', 'textarea', { required: true, showWhen }),
    field('Pt9Line5_DateFrom', 'Dates of membership or involvement: from', 'date', { showWhen }),
    field('Pt9Line5_DateTo', 'Dates of membership or involvement: to', 'date', { showWhen }),
    // Items 6-9: a second organization; any more go to Part 14.
    field('pt9_second_org', 'Were you a member of, or involved with, another organization?', 'radio', { required: true, options: ['Yes', 'No'], showWhen }),
    field('Pt9Line6_Organization2', 'Organization 2 name', 'text', { required: true, showWhen: second }),
    field('Pt9Line7_CityTownOfBirth', 'Organization 2 city or town', 'text', { showWhen: second }),
    field('Pt9Line7_State', 'Organization 2 state or province', 'text', { showWhen: second }),
    field('Pt9Line7_Country', 'Organization 2 country', 'text', { showWhen: second }),
    field('Pt9Line8_FamilyName', 'Organization 2: nature of the organization and its purpose or activities', 'textarea', { required: true, showWhen: second }),
    field('Pt9Line8_Involvement', 'Organization 2: nature of your involvement and role or positions held', 'textarea', { required: true, showWhen: second }),
    field('Pt9Line9_DateFrom', 'Organization 2 dates: from', 'date', { showWhen: second }),
    field('Pt9Line9_DateTo', 'Organization 2 dates: to', 'date', { showWhen: second }),
    field('pt9_more_organizations', 'Any other organizations: name, city and country, nature, your role and dates (one per line)', 'textarea', { showWhen: second })
  ];
}

function organizationDetailSteps(field, step, group, itemsByNumber) {
  const fields = organizationDetailFields(field, itemsByNumber);
  const chunks = [
    ['Pt9Line2_Organization1'],
    ['Pt9Line3_CityTownOfBirth', 'Pt9Line3_State', 'Pt9Line3_Country'],
    ['Pt9Line4_FamilyName', 'Pt9Line4_Involvement'],
    ['Pt9Line5_DateFrom', 'Pt9Line5_DateTo', 'pt9_second_org'],
    ['Pt9Line6_Organization2', 'Pt9Line7_CityTownOfBirth', 'Pt9Line7_State', 'Pt9Line7_Country'],
    ['Pt9Line8_FamilyName', 'Pt9Line8_Involvement'],
    ['Pt9Line9_DateFrom', 'Pt9Line9_DateTo', 'pt9_more_organizations']
  ];

  return chunks.map((ids, index) => step(
    `${group.id}_organization_${String(index + 1).padStart(2, '0')}`,
    `${group.title}: organization details`,
    group.help,
    ids.map((id) => fields.find((item) => item.id === id)).filter(Boolean)
  ));
}

function explanationFields(field, groupIds, itemsByNumber) {
  return part9Logic.part14Triggers
    .filter((trigger) => trigger.items.some((item) => groupIds.includes(item)))
    .map((trigger) => field(`part9_explanation_${trigger.id}`, trigger.requiresExplanation, 'textarea', {
      required: true,
      part: 14,
      relatedPart: 9,
      trigger: trigger.id,
      showWhenAny: part14ShowWhenAny(trigger, itemsByNumber)
    }));
}

function buildI485Part9Steps(field, step) {
  const itemsByNumber = itemMap();
  const chunkSize = 2;
  const steps = [];
  // Items 56-64 (public charge): Item 63 is asked only when the category is
  // not exempt; Items 56-62 come before it and the Item 64 table after it.
  const publicCharge = i485PublicChargeSteps({ field, step });

  for (const group of PAGE_GROUPS) {
    for (let index = 0; index < group.items.length; index += chunkSize) {
      const items = group.items.slice(index, index + chunkSize);
      const fields = [];
      for (const itemNumber of items) {
        const item = itemsByNumber.get(itemNumber);
        if (!item) continue;
        const showWhenAny = itemNumber === '63' ? publicCharge.applies : null;
        const extraShowWhen = itemNumber === '63' ? publicCharge.notUtExempt : [];
        fields.push(item.type === 'yesNo' ? yesNoField(field, item, itemsByNumber, showWhenAny, extraShowWhen) : item86Field(field, itemsByNumber));
      }
      fields.push(...explanationFields(field, items, itemsByNumber));

      const first = printedNumber(items[0], itemsByNumber);
      const itemRange = items.length > 1 ? `${first}-${printedNumber(items[items.length - 1], itemsByNumber)}` : first;
      if (items.includes('63')) steps.push(...publicCharge.before);
      steps.push(step(`${group.id}_${String((index / chunkSize) + 1).padStart(2, '0')}`, `${group.title}: ${itemRange}`, group.help, fields));
      if (items.includes('63')) steps.push(...publicCharge.after);
      if (items.includes('1')) steps.push(...organizationDetailSteps(field, step, group, itemsByNumber));
    }
  }

  return steps;
}

module.exports = {
  buildI485Part9Steps
};
