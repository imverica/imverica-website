const fs = require('fs');

const LOGIC_PATH = 'form-logic/i-485.part9.json';
const QUESTIONNAIRE_PATH = 'questionnaires/i-485.questionnaire.json';
const OVERLAY_PATH = 'overlay-maps/normalized/i-485.json';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function normalizeValue(value) {
  return String(value ?? '').trim();
}

function hasValue(value) {
  const normalized = normalizeValue(value).toLowerCase();
  return normalized !== '' && normalized !== 'n/a' && normalized !== 'not applicable';
}

function loadAnswers(path) {
  const data = readJson(path);
  if (data && typeof data === 'object' && data.fields && typeof data.fields === 'object') {
    return { ...data.flags, ...data.fields };
  }
  return data;
}

function collectQuestionnaireKeys(questionnaire) {
  const keys = new Set();
  for (const page of questionnaire.pages || []) {
    for (const field of page.fields || []) {
      keys.add(field.key);
    }
  }
  return keys;
}

function itemByNumber(logic) {
  const map = new Map();
  for (const item of logic.items || []) {
    map.set(item.item, item);
  }
  return map;
}

function getVisualYesNoValues(field) {
  if (!field || !Array.isArray(field.options) || field.options.length < 2) {
    return null;
  }
  const sorted = [...field.options].sort((a, b) => a.x - b.x);
  return { yes: sorted[0].value, no: sorted[sorted.length - 1].value };
}

function yesNoState(field, value) {
  const values = getVisualYesNoValues(field);
  if (!values || value === undefined || value === null || value === '') {
    return null;
  }
  if (String(value) === String(values.yes)) return 'yes';
  if (String(value) === String(values.no)) return 'no';
  return `unknown:${value}`;
}

function conditionMatches(condition, itemMap, fieldMap, answers) {
  const item = itemMap.get(condition.item);
  if (!item) return false;
  if (item.type === 'yesNo') {
    return yesNoState(fieldMap.get(item.key), answers[item.key]) === condition.equals;
  }
  const wanted = String(condition.equals ?? '').toLowerCase();
  return normalizeValue(answers[item.key]).toLowerCase() === wanted;
}

function allConditionsMatch(conditions, itemMap, fieldMap, answers) {
  return (conditions || []).every(condition => conditionMatches(condition, itemMap, fieldMap, answers));
}

function hasPart14ExplanationForItem(itemNumber, logic, answers) {
  const target = String(itemNumber).toLowerCase().replace(/\s+/g, '');
  for (const slot of logic.part14Slots || []) {
    const part = normalizeValue(answers[slot.partKey]).toLowerCase();
    const item = normalizeValue(answers[slot.itemKey]).toLowerCase().replace(/\s+/g, '');
    const hasText = (slot.textKeys || []).some(key => hasValue(answers[key]));
    if (part === '9' && item === target && hasText) return true;
  }
  return false;
}

function main() {
  const answersPath = process.argv[2] || 'answers/i-485-curated-asylee.answers.json';
  const logic = readJson(LOGIC_PATH);
  const questionnaire = readJson(QUESTIONNAIRE_PATH);
  const overlay = readJson(OVERLAY_PATH);
  const answers = loadAnswers(answersPath);

  const questionKeys = collectQuestionnaireKeys(questionnaire);
  const fieldMap = new Map((overlay.fields || []).map(field => [field.key, field]));
  const items = itemByNumber(logic);
  const issues = [];
  const warnings = [];

  function issue(message) {
    issues.push(message);
  }

  function warn(message) {
    warnings.push(message);
  }

  for (const item of logic.items || []) {
    if (!questionKeys.has(item.key)) {
      issue(`Item ${item.item}: missing questionnaire key ${item.key}`);
    }
    if (!fieldMap.has(item.key)) {
      issue(`Item ${item.item}: missing overlay field ${item.key}`);
    }
    if (item.type === 'yesNo' && !getVisualYesNoValues(fieldMap.get(item.key))) {
      issue(`Item ${item.item}: overlay field ${item.key} is not a two-option Yes/No field`);
    }
  }

  for (const group of logic.detailGroups || []) {
    for (const key of [...(group.requiredAny || []), ...(group.optionalRepeatKeys || [])]) {
      if (!questionKeys.has(key)) issue(`Detail group ${group.id}: missing questionnaire key ${key}`);
      if (!fieldMap.has(key)) issue(`Detail group ${group.id}: missing overlay field ${key}`);
    }
    if (allConditionsMatch(group.when, items, fieldMap, answers)) {
      const hasAnyRequiredDetail = (group.requiredAny || []).some(key => hasValue(answers[key]));
      if (!hasAnyRequiredDetail) {
        issue(`Detail group ${group.id}: Item 1 is Yes but no organization detail fields are filled`);
      }
    }
  }

  for (const dependency of logic.dependencies || []) {
    if (!allConditionsMatch(dependency.when, items, fieldMap, answers)) continue;
    const required = items.get(dependency.requireItem);
    if (!required) {
      issue(`Dependency ${dependency.id}: missing required item ${dependency.requireItem}`);
      continue;
    }
    if (!hasValue(answers[required.key])) {
      issue(`Dependency ${dependency.id}: Item ${dependency.requireItem} is required but blank`);
    }
  }

  for (const trigger of logic.part14Triggers || []) {
    for (const itemNumber of trigger.items || []) {
      const item = items.get(itemNumber);
      if (!item) {
        issue(`Part 14 trigger ${trigger.id}: missing item ${itemNumber}`);
        continue;
      }
      const state = yesNoState(fieldMap.get(item.key), answers[item.key]);
      if (state === 'yes' && !hasPart14ExplanationForItem(itemNumber, logic, answers)) {
        issue(`Part 14 trigger ${trigger.id}: Item ${itemNumber} is Yes but no Part 14 explanation slot references Part 9 Item ${itemNumber}`);
      }
      if (state && state.startsWith('unknown:')) {
        warn(`Item ${itemNumber}: ${item.key} has unrecognized Yes/No value ${answers[item.key]}`);
      }
    }
  }

  const unansweredYesNo = (logic.items || [])
    .filter(item => item.type === 'yesNo')
    .filter(item => answers[item.key] === undefined || answers[item.key] === null || answers[item.key] === '')
    .map(item => `${item.item}:${item.key}`);

  console.log('');
  console.log('I-485 PART 9 CONDITIONAL LOGIC AUDIT');
  console.log('Answers:', answersPath);
  console.log('Logic:', LOGIC_PATH);
  console.log('');
  console.log(`Mapped items: ${(logic.items || []).length}`);
  console.log(`Unanswered Yes/No items in this answer set: ${unansweredYesNo.length}`);

  if (unansweredYesNo.length) {
    console.log('Unanswered:', unansweredYesNo.join(', '));
  }

  for (const warning of warnings) {
    console.log('WARNING:', warning);
  }

  if (!issues.length) {
    console.log('PASS: Part 9 dependencies and Part 14 explanation triggers are consistent.');
  } else {
    for (const message of issues) {
      console.log('ISSUE:', message);
    }
    process.exitCode = 1;
  }
}

main();
