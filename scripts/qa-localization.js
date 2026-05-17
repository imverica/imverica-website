const flow = require('../netlify/functions/immigration-flow');

async function callFlow(code, lang = 'ru') {
  const response = await flow.handler({
    httpMethod: 'GET',
    queryStringParameters: { code, lang },
    headers: {}
  });

  return JSON.parse(response.body || '{}');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function field(step, id) {
  return (step.fields || []).find((item) => item.id === id);
}

function step(flow, id) {
  return (flow.steps || []).find((item) => item.id === id);
}

function findField(flow, stepId, fieldId) {
  const foundStep = step(flow, stepId);
  return foundStep ? field(foundStep, fieldId) : null;
}

function optionByValue(options, value) {
  return (options || []).find((option) => {
    if (option && typeof option === 'object') return option.value === value;
    return option === value;
  });
}

function optionLabel(option) {
  if (option && typeof option === 'object') return option.label;
  return option;
}

async function main() {
  const i485 = await callFlow('I-485', 'ru');
  assert(i485.ok === true, 'I-485 ru flow should return ok');

  const adjustment = i485.steps.find((step) => step.id === 'adjustment_basis');
  assert(adjustment, 'I-485 ru flow should include adjustment step');
  assert(adjustment.title === 'Основание для изменения статуса', 'I-485 adjustment title should be localized');
  assert(!/This helps identify/i.test(adjustment.help || ''), 'I-485 adjustment help should not be English');

  const sponsor = findField(i485, 'i485_related_petition', 'petitioner_or_sponsor');
  const parole = findField(i485, 'i485_location_status', 'inspection_or_parole');
  const medical = findField(i485, 'i485_medical_exam', 'medical_exam_status');
  const basis = field(adjustment, 'adjustment_basis');

  assert(sponsor.label === 'Имя петиционера, работодателя или спонсора', 'petitioner/sponsor label should be localized');
  assert(!/petitioner, employer|sponsor name/i.test(sponsor.label), 'petitioner/sponsor label should not be mixed English');
  assert(!/inspected|admitted|paroled/i.test(parole.label), 'inspection/parole label should not use raw English phrase');
  assert(medical.label === 'Статус медосмотра I-693', 'medical exam label should be localized');
  assert(optionByValue(basis.options, 'Family petition')?.value === 'Family petition', 'localized options should preserve canonical value');
  assert(optionLabel(optionByValue(basis.options, 'Family petition')) === 'Семейная петиция', 'Family petition option should show Russian label');
  assert(optionLabel(optionByValue(medical.options, 'Already completed')) === 'Уже пройден', 'medical option should show Russian label');

  const purpose = step(i485, 'purpose');
  assert(!/Describe the request/i.test(field(purpose, 'preparation_goal')?.placeholder || ''), 'purpose placeholder should be localized');

  const entryDetails = step(i485, 'i485_last_entry_type');
  assert(entryDetails?.title === 'I-485: тип последнего въезда', 'I-485 entry details title should be localized');
  assert(!/Answer only/i.test(entryDetails.help || ''), 'I-485 entry details help should not be English');
  assert(field(entryDetails, 'admission_basis')?.label === 'Основание при последнем въезде', 'admission basis label should be localized');
  assert(optionLabel(optionByValue(field(entryDetails, 'admission_basis').options, 'Paroled')) === 'Paroled', 'Paroled canonical option should render as localized legal term');
  assert(!/Example: B-2/i.test(field(entryDetails, 'status_at_last_entry')?.placeholder || ''), 'I-485 entry placeholder should be localized');

  const residence = step(i485, 'i485_residence_period');
  assert(residence?.title === 'I-485: проживание по текущему адресу', 'I-485 residence title should be localized');
  assert(field(residence, 'same_address_five_years')?.label === 'Вы жили по текущему физическому адресу весь нужный период?', 'same-address field should be localized');
  assert(findField(i485, 'i485_prior_us_address', 'prior_us_addresses')?.type === 'addressHistory', 'prior U.S. address should use structured address history UI');
  assert(findField(i485, 'i485_foreign_address', 'last_foreign_address')?.type === 'addressHistory', 'foreign address should use structured address history UI');

  assert(findField(i485, 'i485_current_work_history', 'current_employment_history')?.type === 'employmentHistory', 'current employment should use structured employment UI');
  assert(findField(i485, 'i485_foreign_work_history', 'foreign_employment_history')?.type === 'employmentHistory', 'foreign employment should use structured employment UI');

  const familyHistory = step(i485, 'i485_parent1_name');
  assert(familyHistory?.title === 'I-485: родитель 1', 'I-485 family history title should be localized');
  assert(field(familyHistory, 'father_family_name')?.label === 'Родитель 1: фамилия', 'parent field should be localized');

  const priorSpouseEnd = step(i485, 'i485_prior_spouse_end_result');
  assert(priorSpouseEnd?.title === 'I-485: дата и тип окончания брака', 'I-485 prior spouse end title should be localized');
  assert(field(priorSpouseEnd, 'prior_spouse_marriage_end_type')?.label === 'Как закончился предыдущий брак', 'prior spouse end type should be localized');
  assert(optionLabel(optionByValue(field(priorSpouseEnd, 'prior_spouse_marriage_end_type').options, 'Annulled')) === 'Аннулирован', 'Annulled option should be localized');
  const bioIdentity = step(i485, 'i485_biographic_identity');
  const bioPhysical = step(i485, 'i485_biographic_colors');
  assert(optionLabel(optionByValue(field(bioIdentity, 'ethnicity').options, 'Not Hispanic or Latino')) === 'Не латиноамериканское происхождение', 'ethnicity option should be localized');
  assert(optionLabel(optionByValue(field(bioIdentity, 'race').options, 'White')) === 'Белый', 'race option should be localized');
  assert(optionLabel(optionByValue(field(bioPhysical, 'eye_color').options, 'Brown')) === 'Карий/коричневый', 'eye color option should be localized');

  const applicantNameParts = step(i485, 'applicant_name_parts');
  const applicantBirthCountry = step(i485, 'applicant_birth_country');
  const applicantCitizenship = step(i485, 'applicant_citizenship');
  assert(field(applicantNameParts, 'applicant_given_name')?.required === true, 'given name should be required');
  assert(field(applicantNameParts, 'applicant_family_name')?.required === true, 'family name should be required');
  assert(field(applicantBirthCountry, 'country_of_birth')?.type === 'select', 'country of birth should be dropdown');
  assert(field(applicantCitizenship, 'country_of_citizenship')?.type === 'select', 'citizenship country should be dropdown');
  assert(field(applicantCitizenship, 'country_of_citizenship')?.label === 'Страна гражданства или национальности', 'citizenship label should be localized');
  assert(optionLabel(optionByValue(field(applicantCitizenship, 'country_of_citizenship').options, 'United States')).includes('США'), 'country option should have localized label');

  const address = step(i485, 'address_contact');
  const mailingAddress = field(address, 'mailing_address');
  assert(mailingAddress?.type === 'addressBlock', 'mailing address should be structured block');
  assert(Array.isArray(mailingAddress.countryOptions) && mailingAddress.countryOptions.length > 100, 'mailing address country dropdown should be available');

  const n400 = await callFlow('N-400', 'ru');
  const naturalization = step(n400, 'n400_address_history');
  const history = field(naturalization, 'addresses_last_five_years');
  assert(Array.isArray(history.countryOptions) && history.countryOptions.length > 100, 'history country dropdown should be available');
  assert(optionLabel(optionByValue(history.countryOptions, 'Ukraine')).includes('Украина'), 'history country dropdown should localize common countries');

  const i765 = await callFlow('I-765', 'ru');
  const i765Reason = step(i765, 'i765_application_reason');
  const i765Statement = step(i765, 'i765_applicant_statement');
  const i765Category = step(i765, 'i765_eligibility_category');
  assert(field(i765Reason, 'i765_application_reason')?.required === true, 'I-765 application reason should be required');
  assert(optionLabel(optionByValue(field(i765Reason, 'i765_application_reason').options, 'Initial permission to accept employment')) === 'Первичное разрешение на работу', 'I-765 reason option should be localized');
  assert(field(i765Statement, 'applicant_statement')?.required === true, 'I-765 applicant statement should be required');
  assert(optionLabel(optionByValue(field(i765Statement, 'applicant_statement').options, 'I can read and understand English')) === 'Я читаю и понимаю английский', 'I-765 English statement should be localized');
  assert(field(i765Category, 'c8_arrested_or_convicted')?.label.includes('(c)(8)'), 'I-765 c8 question should be localized');
  const i765ApplicantBirth = step(i765, 'applicant_birth_place');
  const i765ApplicantIdentity = step(i765, 'applicant_sex_marital');
  assert(field(i765ApplicantBirth, 'city_of_birth')?.label === 'Город/населенный пункт рождения', 'birth city label should be localized');
  assert(field(i765ApplicantIdentity, 'sex')?.label === 'Пол', 'sex label should be localized');
  assert(optionLabel(optionByValue(field(i765ApplicantIdentity, 'sex').options, 'Male')) === 'Мужской', 'male option should be localized');
  assert(field(i765ApplicantIdentity, 'marital_status')?.label === 'Семейное положение', 'marital status label should be localized');
  assert(optionLabel(optionByValue(field(i765ApplicantIdentity, 'marital_status').options, 'Married')) === 'В браке', 'married option should be localized');
  const i765History = step(i765, 'immigration_entry_record');
  assert(field(i765History, 'place_entry')?.label === 'Место последнего въезда в США', 'last arrival place label should be localized');
  const i765Passport = step(i765, 'immigration_passport');
  assert(field(i765Passport, 'passport_country_of_issuance')?.label === 'Страна, выдавшая паспорт или travel document', 'passport country of issuance label should be localized');
  const i765Evidence = step(i765, 'documents_interpreter_choice');
  assert(field(i765Evidence, 'has_interpreter')?.label === 'Будет interpreter?', 'interpreter question should be localized');
  assert(field(i765Evidence, 'has_preparer')?.label === 'Будет preparer?', 'preparer question should be localized');

  for (const lang of ['uk', 'es']) {
    const translated = await callFlow('I-485', lang);
    assert(translated.ok === true, `I-485 ${lang} flow should return ok`);
    const translatedEntry = step(translated, 'i485_last_entry_type');
    assert(translatedEntry && !/I-485 last entry type/i.test(translatedEntry.title), `I-485 ${lang} entry title should be localized`);
    const translatedBio = step(translated, 'i485_biographic_identity');
    assert(translatedBio && !/I-485 ethnicity and race/i.test(translatedBio.title), `I-485 ${lang} bio title should be localized`);
  }

  console.log('localization QA passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
