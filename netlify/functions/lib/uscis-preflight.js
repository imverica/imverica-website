'use strict';
/**
 * "Before you mail to USCIS" sheet for a paper filing: signatures, the form
 * itself, payment, what goes in the envelope and mailing.
 *
 * Every item restates the form, its official instructions or USCIS filing
 * guidance (see SOURCES). It is general information, never advice on what to
 * file. Fees and mailing addresses are linked, not copied: they change.
 *
 * Part, item and page numbers were read from the cached form of the edition
 * in `verifiedEdition`. When the cached form moves to another edition the
 * sheet stops quoting them (they may have shifted) until they are re-checked
 * here: run `npm run qa:preflight` after a form update.
 */

// The form cache manifest that ships with the functions; the monthly form
// update (scripts/update-uscis-forms.js) keeps it current.
const manifest = require('../form-cache-manifest.json');

const CHECKED_ON = '2026-11-10';

const SOURCES = {
  tips: 'https://www.uscis.gov/forms/filing-guidance/tips-for-filing-forms-by-mail',
  fees: 'https://www.uscis.gov/forms/filing-fees',
  schedule: 'https://www.uscis.gov/g-1055',
  calculator: 'https://www.uscis.gov/feecalculator'
};

const FORMS = {
  'I-485': {
    verifiedEdition: '09/18/26',
    pages: 24,
    applicant: { part: 10, item: '4', page: 22 },
    interpreter: { part: 11, item: '6', page: 22 },
    preparer: { part: 12, item: '6', page: 23 },
    interview: { parts: [13], page: 23 },
    envelope: ['photos', 'medical', 'evidence', 'translation', 'notice'],
    page: 'https://www.uscis.gov/i-485',
    checklist: 'https://www.uscis.gov/forms/filing-guidance/checklist-of-required-initial-evidence-for-form-i-485-for-informational-purposes-only',
    addresses: 'https://www.uscis.gov/forms/all-forms/direct-filing-addresses-for-form-i-485-application-to-register-permanent-residence-or-adjust-status'
  },
  'I-765': {
    verifiedEdition: '08/21/25',
    pages: 7,
    applicant: { part: 3, item: '7.a', page: 4 },
    interpreter: { part: 4, item: '7.a', page: 5 },
    preparer: { part: 5, item: '8.a', page: 6 },
    interview: null,
    envelope: ['photos', 'evidence', 'translation', 'notice'],
    page: 'https://www.uscis.gov/i-765',
    checklist: 'https://www.uscis.gov/forms/filing-guidance/checklist-of-required-initial-evidence-for-form-i-765-for-informational-purposes-only',
    addresses: 'https://www.uscis.gov/i-765-addresses'
  },
  'N-400': {
    verifiedEdition: '01/20/25',
    pages: 14,
    applicant: { part: 11, item: '4', page: 11 },
    interpreter: { part: 12, item: '6', page: 12 },
    preparer: { part: 13, item: '6', page: 12 },
    interview: { parts: [15, 16], page: 14 },
    envelope: ['greenCard', 'photosAbroad', 'evidence', 'translation', 'notice'],
    page: 'https://www.uscis.gov/n-400',
    checklist: 'https://www.uscis.gov/sites/default/files/document/guides/M-477.pdf',
    addresses: 'https://www.uscis.gov/forms/all-forms/direct-filing-addresses-for-form-n-400-application-for-naturalization'
  }
};

const PREFLIGHT_FORMS = Object.keys(FORMS);

// {code} {part} {parts} {item} {page} {pages} {edition} are filled in below.
const TEXT = {
  en: {
    title: 'Before you mail Form {code} to USCIS',
    intro: 'Go through this list on the day you mail the final version of your form, the one you reviewed and approved. It restates the official form instructions and USCIS filing guidance. It is general information, not legal advice.',
    and: ' and ',
    sign: 'Signatures',
    form: 'The form',
    pay: 'Payment',
    envelope: 'In the envelope',
    mail: 'Mailing',
    applicant: 'Sign by hand and write the date in Part {part}, Item {item} (page {page}). USCIS does not accept a typed or stamped name and rejects a form with no signature.',
    applicantGeneric: 'Sign by hand and write the date in the applicant\'s signature section (Applicant\'s Signature). USCIS does not accept a typed or stamped name and rejects a form with no signature.',
    interpreterYes: 'Your interpreter signs and dates Part {part}, Item {item} (page {page}).',
    interpreterIf: 'If an interpreter read the form to you, the interpreter signs and dates Part {part}, Item {item} (page {page}).',
    interpreterGeneric: 'If an interpreter read the form to you, the interpreter signs and dates the Interpreter\'s Signature section.',
    preparerYes: 'The person who prepared the form signs and dates Part {part}, Item {item} (page {page}).',
    preparerIf: 'If someone else prepared the form for you, that person signs and dates Part {part}, Item {item} (page {page}).',
    preparerGeneric: 'If someone else prepared the form for you, that person signs and dates the Preparer\'s Signature section.',
    interviewOne: 'Leave Part {parts} (page {page}) empty. You sign it at the interview, when the USCIS officer tells you to.',
    interviewMany: 'Leave Parts {parts} (page {page}) empty. You sign them at the interview, when the USCIS officer tells you to.',
    interviewGeneric: 'Leave the parts marked for the interview empty. You sign them when the USCIS officer tells you to.',
    edition: 'Every page shows "Edition {edition}" at the bottom, and all {pages} pages are there. USCIS may reject a form with missing pages or pages from different editions.',
    editionGeneric: 'Every page shows the same edition date at the bottom, it matches the current edition on the official form page, and no page is missing. USCIS may reject a form with missing pages or pages from different editions.',
    print: 'Printed on one side only, on letter-size paper (8.5 x 11 inches).',
    same: 'Your name, date of birth and A-Number are written the same way on every page and match your documents.',
    ink: 'Anything written by hand is in black ink. No correction fluid or tape.',
    fee: 'Check the fee on the day you mail: the USCIS Fee Schedule (Form G-1055) or the Fee Calculator. USCIS rejects a form sent with the wrong fee.',
    method: 'Pay by card with Form G-1450 or from a U.S. bank account with Form G-1650. USCIS no longer takes checks or money orders with mailed forms, except together with Form G-1651 (exemption request).',
    separate: 'One payment form for each application, placed on top of it. For several applications in one package, use the same type for all of them: only G-1450 or only G-1650.',
    photos: 'Two identical 2 x 2 inch color passport-style photos, taken recently. Print your name and A-Number (if any) lightly on the back with a pencil or felt pen.',
    photosAbroad: 'Photos are needed only if you live outside the United States: two passport-style photos.',
    greenCard: 'A copy of both sides of your Permanent Resident Card (green card).',
    medical: 'If the medical exam (Form I-693) is required for you, it goes in with Form I-485, in the sealed envelope from the civil surgeon. Do not open that envelope.',
    evidence: 'Copies of the documents on the official checklist for your category. Send copies, not originals, unless the instructions ask for an original.',
    translation: 'Every document in another language comes with a full English translation and the translator\'s signed certification.',
    notice: 'Optional: Form G-1145 at the front of the package, if you want a text or email when USCIS accepts it.',
    address: 'Take the address from the official page for your category. The address for U.S. Postal Service mail is different from the one for FedEx, UPS and DHL.',
    assembly: 'No binders, no folders that are hard to take apart, no heavy-duty staples.',
    copy: 'Keep a complete copy of everything you send. Use a delivery service with tracking and keep the receipt.',
    linkPage: 'Form {code}: official page and instructions',
    linkChecklist: 'Official checklist of documents',
    linkAddresses: 'Where to mail Form {code}',
    linkTips: 'USCIS tips for filing by mail',
    linkFees: 'How to pay USCIS fees',
    linkSchedule: 'Fee Schedule (Form G-1055)',
    linkCalculator: 'Fee Calculator',
    sources: 'Official pages',
    printLabel: 'Print or save as PDF',
    footer: 'Checked against USCIS sources on {date}. Fees, addresses and rules change: confirm on the official pages before you mail. Imverica prepares documents at your direction. It is not a law firm and does not give legal advice.'
  },
  ru: {
    title: 'Перед отправкой формы {code} в USCIS',
    intro: 'Пройдите по этому списку в день, когда отправляете окончательную версию формы, ту, которую вы проверили и утвердили. Здесь пересказаны официальные инструкции к форме и правила USCIS по подаче. Это общая информация, не юридическая консультация.',
    and: ' и ',
    sign: 'Подписи',
    form: 'Сама форма',
    pay: 'Оплата',
    envelope: 'Что положить в конверт',
    mail: 'Отправка',
    applicant: 'Подпишите от руки и поставьте дату в Part {part}, Item {item} (страница {page}). Напечатанное имя или штамп USCIS не принимает, а форму без подписи возвращает.',
    applicantGeneric: 'Подпишите от руки и поставьте дату в разделе подписи заявителя (Applicant’s Signature). Напечатанное имя или штамп USCIS не принимает, а форму без подписи возвращает.',
    interpreterYes: 'Ваш переводчик подписывает и ставит дату в Part {part}, Item {item} (страница {page}).',
    interpreterIf: 'Если форму вам читал переводчик, он подписывает и ставит дату в Part {part}, Item {item} (страница {page}).',
    interpreterGeneric: 'Если форму вам читал переводчик, он подписывает и ставит дату в разделе Interpreter’s Signature.',
    preparerYes: 'Тот, кто подготовил форму, подписывает и ставит дату в Part {part}, Item {item} (страница {page}).',
    preparerIf: 'Если форму за вас готовил другой человек, он подписывает и ставит дату в Part {part}, Item {item} (страница {page}).',
    preparerGeneric: 'Если форму за вас готовил другой человек, он подписывает и ставит дату в разделе Preparer’s Signature.',
    interviewOne: 'Part {parts} (страница {page}) оставьте пустой. Её подписывают на интервью, когда скажет офицер USCIS.',
    interviewMany: 'Parts {parts} (страница {page}) оставьте пустыми. Их подписывают на интервью, когда скажет офицер USCIS.',
    interviewGeneric: 'Разделы, отмеченные для интервью, оставьте пустыми. Их подписывают, когда скажет офицер USCIS.',
    edition: 'Внизу каждой страницы стоит «Edition {edition}», и все {pages} страниц на месте. Форму без какой-то страницы или со страницами разных редакций USCIS может вернуть.',
    editionGeneric: 'Внизу каждой страницы стоит одна и та же дата редакции, она совпадает с текущей на официальной странице формы, и все страницы на месте. Форму без какой-то страницы или со страницами разных редакций USCIS может вернуть.',
    print: 'Напечатано только на одной стороне листа, формат Letter (8,5 x 11 дюймов).',
    same: 'Имя, дата рождения и A-Number написаны одинаково на всех страницах и совпадают с вашими документами.',
    ink: 'Всё, что вписано от руки, написано чёрной ручкой. Без корректора и замазки.',
    fee: 'Проверьте пошлину в день отправки: USCIS Fee Schedule (форма G-1055) или Fee Calculator. Форму с неверной суммой USCIS возвращает.',
    method: 'Оплата картой через форму G-1450 или со счёта в банке США через форму G-1650. Чеки и money order с бумажными формами USCIS больше не принимает, кроме случая с формой G-1651 (запрос об исключении).',
    separate: 'На каждое заявление отдельная платёжная форма, она кладётся сверху. Если в пакете несколько заявлений, платёжные формы одного вида: только G-1450 или только G-1650.',
    photos: 'Две одинаковые цветные фотографии паспортного типа 2 x 2 дюйма, сделанные недавно. На обороте слегка напишите карандашом или фломастером имя и A-Number (если есть).',
    photosAbroad: 'Фотографии нужны только тем, кто живёт за пределами США: две фотографии паспортного типа.',
    greenCard: 'Копия обеих сторон вашей Permanent Resident Card (грин-карты).',
    medical: 'Если вам нужен медосмотр (форма I-693), он подаётся вместе с формой I-485, в запечатанном конверте от врача (civil surgeon). Этот конверт не вскрывайте.',
    evidence: 'Копии документов из официального списка для вашей категории. Отправляйте копии, а не оригиналы, если инструкция прямо не просит оригинал.',
    translation: 'К каждому документу на другом языке приложен полный перевод на английский и подписанное заверение переводчика.',
    notice: 'По желанию: форма G-1145 сверху пакета, если хотите получить SMS или письмо, когда USCIS примет пакет.',
    address: 'Адрес возьмите на официальной странице для вашей категории. Адрес для почты USPS отличается от адреса для FedEx, UPS и DHL.',
    assembly: 'Без папок-скоросшивателей, без папок, которые трудно разобрать, без толстых скоб.',
    copy: 'Оставьте себе полную копию всего, что отправляете. Отправляйте с трек-номером и сохраните квитанцию.',
    linkPage: 'Форма {code}: официальная страница и инструкции',
    linkChecklist: 'Официальный список документов',
    linkAddresses: 'Куда отправлять форму {code}',
    linkTips: 'Советы USCIS по отправке почтой',
    linkFees: 'Как платить пошлины USCIS',
    linkSchedule: 'Fee Schedule (форма G-1055)',
    linkCalculator: 'Fee Calculator',
    sources: 'Официальные страницы',
    printLabel: 'Распечатать или сохранить в PDF',
    footer: 'Сверено с источниками USCIS {date}. Пошлины, адреса и правила меняются: перед отправкой проверьте на официальных страницах. Imverica готовит документы по вашему поручению. Это не юридическая фирма, юридических консультаций она не даёт.'
  },
  uk: {
    title: 'Перед відправленням форми {code} до USCIS',
    intro: 'Пройдіть цей список у день, коли відправляєте остаточну версію форми, ту, яку ви перевірили й затвердили. Тут переказано офіційні інструкції до форми та правила USCIS щодо подання. Це загальна інформація, не юридична консультація.',
    and: ' і ',
    sign: 'Підписи',
    form: 'Сама форма',
    pay: 'Оплата',
    envelope: 'Що покласти в конверт',
    mail: 'Відправлення',
    applicant: 'Підпишіть від руки й поставте дату в Part {part}, Item {item} (сторінка {page}). Надруковане ім’я чи штамп USCIS не приймає, а форму без підпису повертає.',
    applicantGeneric: 'Підпишіть від руки й поставте дату у розділі підпису заявника (Applicant’s Signature). Надруковане ім’я чи штамп USCIS не приймає, а форму без підпису повертає.',
    interpreterYes: 'Ваш перекладач підписує й ставить дату в Part {part}, Item {item} (сторінка {page}).',
    interpreterIf: 'Якщо форму вам читав перекладач, він підписує й ставить дату в Part {part}, Item {item} (сторінка {page}).',
    interpreterGeneric: 'Якщо форму вам читав перекладач, він підписує й ставить дату у розділі Interpreter’s Signature.',
    preparerYes: 'Той, хто підготував форму, підписує й ставить дату в Part {part}, Item {item} (сторінка {page}).',
    preparerIf: 'Якщо форму за вас готувала інша людина, вона підписує й ставить дату в Part {part}, Item {item} (сторінка {page}).',
    preparerGeneric: 'Якщо форму за вас готувала інша людина, вона підписує й ставить дату у розділі Preparer’s Signature.',
    interviewOne: 'Part {parts} (сторінка {page}) залиште порожньою. Її підписують на співбесіді, коли скаже офіцер USCIS.',
    interviewMany: 'Parts {parts} (сторінка {page}) залиште порожніми. Їх підписують на співбесіді, коли скаже офіцер USCIS.',
    interviewGeneric: 'Розділи, позначені для співбесіди, залиште порожніми. Їх підписують, коли скаже офіцер USCIS.',
    edition: 'Унизу кожної сторінки стоїть «Edition {edition}», і всі {pages} сторінок на місці. Форму без якоїсь сторінки або зі сторінками різних редакцій USCIS може повернути.',
    editionGeneric: 'Унизу кожної сторінки стоїть та сама дата редакції, вона збігається з чинною на офіційній сторінці форми, і всі сторінки на місці. Форму без якоїсь сторінки або зі сторінками різних редакцій USCIS може повернути.',
    print: 'Надруковано лише з одного боку аркуша, формат Letter (8,5 x 11 дюймів).',
    same: 'Ім’я, дата народження й A-Number написані однаково на всіх сторінках і збігаються з вашими документами.',
    ink: 'Усе, що вписано від руки, написано чорною ручкою. Без коректора.',
    fee: 'Перевірте збір у день відправлення: USCIS Fee Schedule (форма G-1055) або Fee Calculator. Форму з неправильною сумою USCIS повертає.',
    method: 'Оплата карткою через форму G-1450 або з рахунку в банку США через форму G-1650. Чеки й money order з паперовими формами USCIS більше не приймає, крім випадку з формою G-1651 (запит про виняток).',
    separate: 'На кожну заяву окрема платіжна форма, вона кладеться зверху. Якщо в пакеті кілька заяв, платіжні форми одного виду: лише G-1450 або лише G-1650.',
    photos: 'Дві однакові кольорові фотографії паспортного типу 2 x 2 дюйми, зроблені нещодавно. На звороті злегка напишіть олівцем або фломастером ім’я та A-Number (якщо є).',
    photosAbroad: 'Фотографії потрібні лише тим, хто живе за межами США: дві фотографії паспортного типу.',
    greenCard: 'Копія обох сторін вашої Permanent Resident Card (грін-карти).',
    medical: 'Якщо вам потрібен медогляд (форма I-693), він подається разом із формою I-485, у запечатаному конверті від лікаря (civil surgeon). Цей конверт не відкривайте.',
    evidence: 'Копії документів з офіційного списку для вашої категорії. Надсилайте копії, а не оригінали, якщо інструкція прямо не просить оригінал.',
    translation: 'До кожного документа іншою мовою додано повний переклад англійською та підписане засвідчення перекладача.',
    notice: 'За бажанням: форма G-1145 зверху пакета, якщо хочете отримати SMS або лист, коли USCIS прийме пакет.',
    address: 'Адресу візьміть на офіційній сторінці для вашої категорії. Адреса для пошти USPS відрізняється від адреси для FedEx, UPS і DHL.',
    assembly: 'Без тек-швидкозшивачів, без тек, які важко розібрати, без товстих скоб.',
    copy: 'Залиште собі повну копію всього, що надсилаєте. Надсилайте з трек-номером і збережіть квитанцію.',
    linkPage: 'Форма {code}: офіційна сторінка та інструкції',
    linkChecklist: 'Офіційний список документів',
    linkAddresses: 'Куди надсилати форму {code}',
    linkTips: 'Поради USCIS щодо подання поштою',
    linkFees: 'Як сплачувати збори USCIS',
    linkSchedule: 'Fee Schedule (форма G-1055)',
    linkCalculator: 'Fee Calculator',
    sources: 'Офіційні сторінки',
    printLabel: 'Роздрукувати або зберегти в PDF',
    footer: 'Звірено з джерелами USCIS {date}. Збори, адреси й правила змінюються: перед відправленням перевірте на офіційних сторінках. Imverica готує документи за вашим дорученням. Це не юридична фірма, юридичних консультацій вона не надає.'
  },
  es: {
    title: 'Antes de enviar el Formulario {code} a USCIS',
    intro: 'Repase esta lista el día que envíe la versión final de su formulario, la que usted revisó y aprobó. Resume las instrucciones oficiales del formulario y la guía de USCIS para presentar por correo. Es información general, no asesoría legal.',
    and: ' y ',
    sign: 'Firmas',
    form: 'El formulario',
    pay: 'Pago',
    envelope: 'En el sobre',
    mail: 'Envío',
    applicant: 'Firme a mano y escriba la fecha en la Part {part}, Item {item} (página {page}). USCIS no acepta un nombre escrito a máquina ni un sello, y rechaza un formulario sin firma.',
    applicantGeneric: 'Firme a mano y escriba la fecha en la sección de firma del solicitante (Applicant’s Signature). USCIS no acepta un nombre escrito a máquina ni un sello, y rechaza un formulario sin firma.',
    interpreterYes: 'Su intérprete firma y fecha la Part {part}, Item {item} (página {page}).',
    interpreterIf: 'Si un intérprete le leyó el formulario, el intérprete firma y fecha la Part {part}, Item {item} (página {page}).',
    interpreterGeneric: 'Si un intérprete le leyó el formulario, el intérprete firma y fecha la sección Interpreter’s Signature.',
    preparerYes: 'La persona que preparó el formulario firma y fecha la Part {part}, Item {item} (página {page}).',
    preparerIf: 'Si otra persona preparó el formulario por usted, esa persona firma y fecha la Part {part}, Item {item} (página {page}).',
    preparerGeneric: 'Si otra persona preparó el formulario por usted, esa persona firma y fecha la sección Preparer’s Signature.',
    interviewOne: 'Deje vacía la Part {parts} (página {page}). Se firma en la entrevista, cuando el oficial de USCIS se lo indique.',
    interviewMany: 'Deje vacías las Parts {parts} (página {page}). Se firman en la entrevista, cuando el oficial de USCIS se lo indique.',
    interviewGeneric: 'Deje vacías las partes reservadas para la entrevista. Se firman cuando el oficial de USCIS se lo indique.',
    edition: 'Cada página muestra «Edition {edition}» al pie, y están las {pages} páginas. USCIS puede rechazar un formulario al que le falten páginas o que tenga páginas de ediciones distintas.',
    editionGeneric: 'Cada página muestra la misma fecha de edición al pie, coincide con la edición vigente en la página oficial del formulario y no falta ninguna página. USCIS puede rechazar un formulario al que le falten páginas o que tenga páginas de ediciones distintas.',
    print: 'Impreso por una sola cara, en papel tamaño carta (8.5 x 11 pulgadas).',
    same: 'Su nombre, fecha de nacimiento y A-Number están escritos igual en todas las páginas y coinciden con sus documentos.',
    ink: 'Todo lo escrito a mano está en tinta negra. Sin corrector líquido ni cinta correctora.',
    fee: 'Verifique la tarifa el día del envío: la Tabla de Tarifas de USCIS (Formulario G-1055) o la Calculadora de Tarifas. USCIS rechaza un formulario enviado con la tarifa incorrecta.',
    method: 'Pague con tarjeta mediante el Formulario G-1450 o desde una cuenta bancaria de EE. UU. mediante el Formulario G-1650. USCIS ya no acepta cheques ni giros postales con formularios enviados por correo, salvo junto con el Formulario G-1651 (solicitud de exención).',
    separate: 'Un formulario de pago por cada solicitud, colocado encima de ella. Si envía varias solicitudes en un paquete, use el mismo tipo para todas: solo G-1450 o solo G-1650.',
    photos: 'Dos fotografías idénticas a color tipo pasaporte de 2 x 2 pulgadas, tomadas recientemente. Escriba suavemente su nombre y A-Number (si tiene) al dorso con lápiz o marcador.',
    photosAbroad: 'Las fotografías solo se necesitan si usted vive fuera de Estados Unidos: dos fotografías tipo pasaporte.',
    greenCard: 'Una copia de ambos lados de su Permanent Resident Card (tarjeta verde).',
    medical: 'Si a usted se le exige el examen médico (Formulario I-693), va junto con el Formulario I-485, en el sobre sellado del médico (civil surgeon). No abra ese sobre.',
    evidence: 'Copias de los documentos de la lista oficial para su categoría. Envíe copias, no originales, salvo que las instrucciones pidan un original.',
    translation: 'Cada documento en otro idioma lleva una traducción completa al inglés y la certificación firmada del traductor.',
    notice: 'Opcional: el Formulario G-1145 encima del paquete, si desea un mensaje de texto o correo electrónico cuando USCIS lo acepte.',
    address: 'Tome la dirección de la página oficial para su categoría. La dirección para el correo de USPS es distinta de la de FedEx, UPS y DHL.',
    assembly: 'Sin carpetas de argollas, sin carpetas difíciles de desarmar, sin grapas gruesas.',
    copy: 'Guarde una copia completa de todo lo que envía. Use un servicio con número de rastreo y conserve el recibo.',
    linkPage: 'Formulario {code}: página oficial e instrucciones',
    linkChecklist: 'Lista oficial de documentos',
    linkAddresses: 'Adónde enviar el Formulario {code}',
    linkTips: 'Consejos de USCIS para presentar por correo',
    linkFees: 'Cómo pagar las tarifas de USCIS',
    linkSchedule: 'Tabla de Tarifas (Formulario G-1055)',
    linkCalculator: 'Calculadora de Tarifas',
    sources: 'Páginas oficiales',
    printLabel: 'Imprimir o guardar como PDF',
    footer: 'Verificado con fuentes de USCIS el {date}. Las tarifas, direcciones y reglas cambian: confirme en las páginas oficiales antes de enviar. Imverica prepara documentos según sus indicaciones. No es un bufete de abogados y no brinda asesoría legal.'
  }
};

function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => (values[key] === undefined ? match : String(values[key])));
}

const LOCALES = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA', es: 'es-MX' };

function formatDate(iso, lang) {
  // "10 ноября 2026 г." ends in a period of its own; the sentence adds one.
  return new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)).replace(/\.$/, '');
}

function cachedEdition(code) {
  const entry = (manifest.forms || []).find((form) => form.code === code);
  return entry ? String(entry.editionDate || '') : '';
}

function yesNo(value) {
  const answer = String(value || '').trim().toLowerCase();
  if (answer === 'yes') return 'yes';
  if (answer === 'no') return 'no';
  return '';
}

/**
 * @param {string} formCode  'I-485' | 'I-765' | 'N-400'
 * @param {{lang?: string, interpreter?: string, preparer?: string, currentEdition?: string}} [options]
 *   interpreter / preparer: 'Yes' | 'No' | '' (the client's answer, if known).
 *   currentEdition overrides the cached form's edition (tests).
 * @returns {object|null} null for a form without a sheet
 */
function buildPreflight(formCode, options) {
  const code = String(formCode || '').trim().toUpperCase();
  const def = FORMS[code];
  if (!def) return null;
  const opts = options || {};
  const lang = TEXT[opts.lang] ? opts.lang : 'en';
  const t = TEXT[lang];

  const currentEdition = opts.currentEdition || cachedEdition(code);
  // No known edition, or one we have not read: quote no part or page numbers.
  const verified = currentEdition === def.verifiedEdition;
  const base = { code, edition: def.verifiedEdition, pages: def.pages };
  const item = (id, text, link) => (link ? { id, text, link } : { id, text });

  const sign = [item('applicant', verified ? fill(t.applicant, def.applicant) : t.applicantGeneric)];
  const interpreter = yesNo(opts.interpreter);
  if (interpreter !== 'no') {
    const key = !verified ? 'interpreterGeneric' : (interpreter === 'yes' ? 'interpreterYes' : 'interpreterIf');
    sign.push(item('interpreter', fill(t[key], def.interpreter)));
  }
  const preparer = yesNo(opts.preparer);
  if (preparer !== 'no') {
    const key = !verified ? 'preparerGeneric' : (preparer === 'yes' ? 'preparerYes' : 'preparerIf');
    sign.push(item('preparer', fill(t[key], def.preparer)));
  }
  if (def.interview) {
    const key = !verified ? 'interviewGeneric' : (def.interview.parts.length > 1 ? 'interviewMany' : 'interviewOne');
    sign.push(item('interview', fill(t[key], { parts: def.interview.parts.join(t.and), page: def.interview.page })));
  }

  const links = {
    page: { label: fill(t.linkPage, base), url: def.page },
    checklist: { label: t.linkChecklist, url: def.checklist },
    addresses: { label: fill(t.linkAddresses, base), url: def.addresses },
    tips: { label: t.linkTips, url: SOURCES.tips },
    fees: { label: t.linkFees, url: SOURCES.fees },
    schedule: { label: t.linkSchedule, url: SOURCES.schedule },
    calculator: { label: t.linkCalculator, url: SOURCES.calculator }
  };
  const envelopeLink = { evidence: links.checklist };

  const sections = [
    { id: 'sign', title: t.sign, items: sign },
    {
      id: 'form',
      title: t.form,
      items: [
        item('edition', verified ? fill(t.edition, base) : t.editionGeneric, links.page),
        item('print', t.print),
        item('same', t.same),
        item('ink', t.ink)
      ]
    },
    {
      id: 'pay',
      title: t.pay,
      items: [item('fee', t.fee, links.schedule), item('method', t.method, links.fees), item('separate', t.separate)]
    },
    { id: 'envelope', title: t.envelope, items: def.envelope.map((id) => item(id, t[id], envelopeLink[id])) },
    {
      id: 'mail',
      title: t.mail,
      items: [item('address', t.address, links.addresses), item('assembly', t.assembly), item('copy', t.copy)]
    }
  ];

  return {
    formCode: code,
    lang,
    edition: currentEdition,
    editionVerified: verified,
    checkedOn: CHECKED_ON,
    title: fill(t.title, base),
    intro: t.intro,
    sections,
    sourcesTitle: t.sources,
    sources: [links.page, links.checklist, links.addresses, links.tips, links.fees, links.schedule, links.calculator]
      .filter((link, index, all) => all.findIndex((other) => other.url === link.url) === index),
    printLabel: t.printLabel,
    footer: fill(t.footer, { date: formatDate(CHECKED_ON, lang) })
  };
}

module.exports = { buildPreflight, PREFLIGHT_FORMS, FORMS, TEXT };
