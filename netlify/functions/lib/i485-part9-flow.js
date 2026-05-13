const part9Logic = require('../../../form-logic/i-485.part9.json');

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
  '63': 'Can you read and understand English?',
  '64': 'Is a credit report available if needed for this application?',
  '67': 'Have you EVER been deported from the United States based on public charge grounds?',
  '68': 'Have you EVER committed fraud or misrepresented a material fact to obtain an immigration benefit?',
  '69': 'Have you EVER falsely claimed to be a U.S. citizen?',
  '70': 'Have you EVER voted in violation of law?',
  '71': 'Have you EVER applied for or received a waiver of inadmissibility?',
  '72': 'Have you EVER been excluded, deported, or removed after April 1, 1997?',
  '73': 'Have you EVER been unlawfully present in the United States for more than 180 days and then departed?',
  '74': 'Have you EVER been unlawfully present after a prior immigration violation?',
  '75': 'Have you EVER triggered any other unlawful presence or reentry ground?',
  '76': 'Are you a foreign medical graduate seeking adjustment without required medical licensing or service?',
  '77': 'Have you EVER left or remained outside the United States to avoid military service?',
  '78.a': 'Have you EVER left the United States to avoid being drafted into the U.S. Armed Forces?',
  '78.b': 'Have you EVER applied for exemption from U.S. military service as a nonresident alien?',
  '79': 'Have you EVER received relief under INA section 245A?',
  '80': 'Have you EVER been a lawful permanent resident before?',
  '81': 'Have you EVER renounced U.S. citizenship to avoid taxation?',
  '82': 'Have you EVER been a J exchange visitor subject to a foreign residence requirement?',
  '83': 'Are you now in A, E, G, or similar diplomatic or treaty status?',
  '84.a': 'If in A status, do you claim diplomatic rights, privileges, exemptions, or immunities?',
  '84.b': 'If in E status, do you claim treaty rights, privileges, exemptions, or immunities?',
  '84.c': 'If in G status, do you claim diplomatic or organization rights, privileges, exemptions, or immunities?',
  '85': 'Have you submitted a waiver of rights, privileges, exemptions, and immunities?',
  '86': 'If yes to Item 85, provide your nationality, occupational status, and position title.'
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
    items: ['63', '64', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78.a', '78.b', '79', '80', '81', '82', '83', '84.a', '84.b', '84.c', '85', '86']
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

function yesNoField(field, item, itemsByNumber) {
  const showWhen = dependencyShowWhen(item.item, itemsByNumber);
  return field(item.key, `${item.item}. ${ITEM_LABELS[item.item] || item.topic || item.item}`, 'radio', {
    required: true,
    options: ['Yes', 'No'],
    part: 9,
    itemNumber: item.item,
    pdfKey: item.key,
    ...(showWhen ? { showWhen } : {})
  });
}

function item86Field(field, itemsByNumber) {
  return field('Pt9Line86_Nationality', `86. ${ITEM_LABELS['86']}`, 'textarea', {
    required: true,
    part: 9,
    itemNumber: '86',
    pdfKey: 'Pt9Line86_Nationality',
    showWhen: [conditionToField({ item: '85', equals: 'yes' }, itemsByNumber)]
  });
}

function organizationDetailFields(field, itemsByNumber) {
  const showWhen = [conditionToField({ item: '1', equals: 'yes' }, itemsByNumber)];
  return [
    field('Pt9Line2_Organization1', 'Organization name', 'text', { required: true, showWhen }),
    field('Pt9Line3_CityTownOfBirth', 'Organization city or town', 'text', { showWhen }),
    field('Pt9Line3_State', 'Organization state or province', 'text', { showWhen }),
    field('Pt9Line3_Country', 'Organization country', 'text', { showWhen }),
    field('Pt9Line4_FamilyName', 'Nature of organization and its purpose or activities', 'textarea', { required: true, showWhen }),
    field('Pt9Line4_Involvement', 'Nature of your involvement and role or positions held', 'textarea', { required: true, showWhen }),
    field('Pt9Line5_DateFrom', 'Dates of membership or involvement: from', 'date', { showWhen }),
    field('Pt9Line5_DateTo', 'Dates of membership or involvement: to', 'date', { showWhen })
  ];
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

  return PAGE_GROUPS.map((group) => {
    const fields = [];
    for (const itemNumber of group.items) {
      const item = itemsByNumber.get(itemNumber);
      if (!item) continue;
      fields.push(item.type === 'yesNo' ? yesNoField(field, item, itemsByNumber) : item86Field(field, itemsByNumber));
      if (itemNumber === '1') fields.push(...organizationDetailFields(field, itemsByNumber));
    }
    fields.push(...explanationFields(field, group.items, itemsByNumber));
    return step(group.id, group.title, group.help, fields);
  });
}

module.exports = {
  buildI485Part9Steps
};
