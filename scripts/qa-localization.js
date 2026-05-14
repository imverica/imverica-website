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

  const sponsor = field(adjustment, 'petitioner_or_sponsor');
  const parole = field(adjustment, 'inspection_or_parole');
  const medical = field(adjustment, 'medical_exam_status');
  const basis = field(adjustment, 'adjustment_basis');

  assert(sponsor.label === 'Имя петиционера, работодателя или спонсора', 'petitioner/sponsor label should be localized');
  assert(!/petitioner, employer|sponsor name/i.test(sponsor.label), 'petitioner/sponsor label should not be mixed English');
  assert(!/inspected|admitted|paroled/i.test(parole.label), 'inspection/parole label should not use raw English phrase');
  assert(medical.label === 'Статус медосмотра I-693', 'medical exam label should be localized');
  assert(optionByValue(basis.options, 'Family petition')?.value === 'Family petition', 'localized options should preserve canonical value');
  assert(optionLabel(optionByValue(basis.options, 'Family petition')) === 'Семейная петиция', 'Family petition option should show Russian label');
  assert(optionLabel(optionByValue(medical.options, 'Already completed')) === 'Уже пройден', 'medical option should show Russian label');

  const purpose = i485.steps.find((step) => step.id === 'purpose');
  assert(!/Describe the request/i.test(field(purpose, 'preparation_goal')?.placeholder || ''), 'purpose placeholder should be localized');

  const entryDetails = i485.steps.find((step) => step.id === 'i485_entry_details');
  assert(entryDetails?.title === 'I-485: въезд и текущий статус', 'I-485 entry details title should be localized');
  assert(!/These fields map/i.test(entryDetails.help || ''), 'I-485 entry details help should not be English');
  assert(field(entryDetails, 'admission_basis')?.label === 'Основание при последнем въезде', 'admission basis label should be localized');
  assert(optionLabel(optionByValue(field(entryDetails, 'admission_basis').options, 'Paroled')) === 'Paroled', 'Paroled canonical option should render as localized legal term');
  assert(!/Example: B-2/i.test(field(entryDetails, 'status_at_last_entry')?.placeholder || ''), 'I-485 entry placeholder should be localized');

  const priorAddress = i485.steps.find((step) => step.id === 'i485_prior_addresses_ssn');
  assert(priorAddress?.title === 'I-485: адреса и Social Security', 'I-485 prior address title should be localized');
  assert(field(priorAddress, 'same_address_five_years')?.label === 'Вы жили по текущему физическому адресу весь нужный период?', 'same-address field should be localized');
  assert(field(priorAddress, 'prior_us_addresses')?.type === 'addressHistory', 'prior U.S. address should use structured address history UI');
  assert(field(priorAddress, 'last_foreign_address')?.type === 'addressHistory', 'foreign address should use structured address history UI');

  const processing = i485.steps.find((step) => step.id === 'i485_processing_employment');
  assert(processing?.title === 'I-485: петиция и работа', 'I-485 processing/employment title should be localized');
  assert(field(processing, 'current_employment_history')?.type === 'employmentHistory', 'current employment should use structured employment UI');
  assert(field(processing, 'foreign_employment_history')?.type === 'employmentHistory', 'foreign employment should use structured employment UI');

  const familyHistory = i485.steps.find((step) => step.id === 'i485_family_history');
  assert(familyHistory?.title === 'I-485: родители и супруг', 'I-485 family history title should be localized');
  assert(field(familyHistory, 'father_family_name')?.label === 'Родитель 1: фамилия', 'parent field should be localized');

  const bio = i485.steps.find((step) => step.id === 'i485_prior_spouse_children_bio');
  assert(bio?.title === 'I-485: предыдущий супруг, дети и биография', 'I-485 bio title should be localized');
  assert(field(bio, 'prior_spouse_marriage_end_type')?.label === 'Как закончился предыдущий брак', 'prior spouse end type should be localized');
  assert(optionLabel(optionByValue(field(bio, 'prior_spouse_marriage_end_type').options, 'Annulled')) === 'Аннулирован', 'Annulled option should be localized');
  assert(optionLabel(optionByValue(field(bio, 'ethnicity').options, 'Not Hispanic or Latino')) === 'Не латиноамериканское происхождение', 'ethnicity option should be localized');
  assert(optionLabel(optionByValue(field(bio, 'race').options, 'White')) === 'Белый', 'race option should be localized');
  assert(optionLabel(optionByValue(field(bio, 'eye_color').options, 'Brown')) === 'Карий/коричневый', 'eye color option should be localized');

  const applicant = i485.steps.find((step) => step.id === 'applicant');
  assert(field(applicant, 'applicant_given_name')?.required === true, 'given name should be required');
  assert(field(applicant, 'applicant_family_name')?.required === true, 'family name should be required');
  assert(field(applicant, 'country_of_birth')?.type === 'select', 'country of birth should be dropdown');
  assert(field(applicant, 'country_of_citizenship')?.type === 'select', 'citizenship country should be dropdown');
  assert(field(applicant, 'country_of_citizenship')?.label === 'Страна гражданства или национальности', 'citizenship label should be localized');
  assert(optionLabel(optionByValue(field(applicant, 'country_of_citizenship').options, 'United States')).includes('США'), 'country option should have localized label');

  const address = i485.steps.find((step) => step.id === 'address_contact');
  assert(field(address, 'mailing_country')?.type === 'select', 'mailing country should be dropdown');

  const n400 = await callFlow('N-400', 'ru');
  const naturalization = n400.steps.find((step) => step.id === 'naturalization');
  const history = field(naturalization, 'addresses_last_five_years');
  assert(Array.isArray(history.countryOptions) && history.countryOptions.length > 100, 'history country dropdown should be available');
  assert(optionLabel(optionByValue(history.countryOptions, 'Ukraine')).includes('Украина'), 'history country dropdown should localize common countries');

  const i765 = await callFlow('I-765', 'ru');
  const workAuthorization = i765.steps.find((step) => step.id === 'work_authorization');
  assert(field(workAuthorization, 'i765_application_reason')?.required === true, 'I-765 application reason should be required');
  assert(optionLabel(optionByValue(field(workAuthorization, 'i765_application_reason').options, 'Initial permission to accept employment')) === 'Первичное разрешение на работу', 'I-765 reason option should be localized');
  assert(field(workAuthorization, 'applicant_statement')?.required === true, 'I-765 applicant statement should be required');
  assert(optionLabel(optionByValue(field(workAuthorization, 'applicant_statement').options, 'I can read and understand English')) === 'Я читаю и понимаю английский', 'I-765 English statement should be localized');
  assert(field(workAuthorization, 'c8_arrested_or_convicted')?.label.includes('(c)(8)'), 'I-765 c8 question should be localized');
  const i765Applicant = i765.steps.find((step) => step.id === 'applicant');
  assert(field(i765Applicant, 'city_of_birth')?.label === 'Город/населенный пункт рождения', 'birth city label should be localized');
  assert(field(i765Applicant, 'sex')?.label === 'Пол', 'sex label should be localized');
  assert(optionLabel(optionByValue(field(i765Applicant, 'sex').options, 'Male')) === 'Мужской', 'male option should be localized');
  assert(field(i765Applicant, 'marital_status')?.label === 'Семейное положение', 'marital status label should be localized');
  assert(optionLabel(optionByValue(field(i765Applicant, 'marital_status').options, 'Married')) === 'В браке', 'married option should be localized');
  const i765History = i765.steps.find((step) => step.id === 'immigration_history');
  assert(field(i765History, 'place_entry')?.label === 'Место последнего въезда в США', 'last arrival place label should be localized');
  assert(field(i765History, 'passport_country_of_issuance')?.label === 'Страна, выдавшая паспорт или travel document', 'passport country of issuance label should be localized');
  const i765Evidence = i765.steps.find((step) => step.id === 'documents_review');
  assert(field(i765Evidence, 'has_interpreter')?.label === 'Будет interpreter?', 'interpreter question should be localized');
  assert(field(i765Evidence, 'has_preparer')?.label === 'Будет preparer?', 'preparer question should be localized');

  for (const lang of ['uk', 'es']) {
    const translated = await callFlow('I-485', lang);
    assert(translated.ok === true, `I-485 ${lang} flow should return ok`);
    const translatedEntry = translated.steps.find((step) => step.id === 'i485_entry_details');
    assert(translatedEntry && !/I-485 entry and status details/i.test(translatedEntry.title), `I-485 ${lang} entry title should be localized`);
    const translatedBio = translated.steps.find((step) => step.id === 'i485_prior_spouse_children_bio');
    assert(translatedBio && !/Prior spouse, children, and biographic details/i.test(translatedBio.title), `I-485 ${lang} bio title should be localized`);
  }

  console.log('localization QA passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
