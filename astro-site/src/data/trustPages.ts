// Copy for two informational pages, per language:
//  - DOCUMENT_SECURITY: how client documents are stored and protected
//    (describes netlify/functions/upload.js, generated-documents.js,
//    lib/crypto.js, lib/virus-scan.js, chat.js and form-review.js as they
//    work today; update it when those change).
//  - FL150_CHECKLIST: what to check on Form FL-150 before filing, taken from
//    the form's own instructions (Rev. September 1, 2024). Informational only.

export type Lang = 'en' | 'ru' | 'uk' | 'es';

export interface InfoSection {
  heading: string;
  items?: string[];
  text?: string;
}

export interface InfoPage {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  sub: string;
  sections: InfoSection[];
  foot: string;
  cta: string;
}

export const DOCUMENT_SECURITY: Record<Lang, InfoPage> = {
  en: {
    title: 'How we store and protect your documents | Imverica',
    description: 'Where Imverica keeps the documents you upload, who can see them, how they are encrypted, and where AI is and is not used.',
    eyebrow: 'Your documents',
    heading: 'How we store and protect your documents',
    sub: 'What happens to the papers you send us: where they are kept, who can see them, and where AI is and is not used.',
    sections: [
      { heading: 'Where your files are kept', items: [
        'Files you upload in your client account are encrypted (AES-256-GCM) before they are stored in our cloud storage. File names are encrypted too.',
        'The encryption key is kept only in our server settings, never next to the files.',
        'Drafts we generate for you are stored in your account the same way, encrypted.',
        'A working copy of each upload goes to Imverica’s Google Drive so our team can prepare your documents.'
      ] },
      { heading: 'Who can see them', items: [
        'You, after you sign in, and only for your own requests.',
        'The Imverica team members who prepare your documents.',
        'We do not sell your documents and do not use them, or anything in them, for advertising, reviews or examples. The samples on our site are invented from scratch.'
      ] },
      { heading: 'Checks when you upload', items: [
        'Only PDF, JPG, PNG and DOCX files are accepted, and we check what the file actually contains, not just its name.',
        'Each file’s fingerprint (a SHA-256 hash) is compared with a database of known viruses. The file itself is never sent to the scanning service.',
        'Before your first upload you confirm that you may share the documents: they are yours, or you have permission from the person they belong to.'
      ] },
      { heading: 'Where AI is used, and where it is not', items: [
        'The assistant on our website answers general questions using Anthropic’s Claude. What you type into it is sent to Anthropic to write the reply, so please do not type Social Security numbers, A-Numbers, passport numbers or other ID numbers there.',
        'The documents you upload to your account are not sent to the assistant.',
        'Form checks, such as the FL-150 numbers check, run on our own server and do not store your answers.'
      ] },
      { heading: 'How long we keep them', items: [
        'You can delete the files you uploaded from your account at any time. Documents we prepared stay in your account so you can download them again.',
        'Copies in our case file are kept as long as the law and our record-keeping policy require. To ask about deleting copies, contact us.'
      ] },
      { heading: 'Your part', items: [
        'Upload only documents you may share.',
        'If a document is under a sealing or protective order, check that sharing it is allowed before you upload it.',
        'When a form’s instructions say to black out a number (for example, Social Security numbers on the pay stubs attached to FL-150), do that before uploading.'
      ] }
    ],
    foot: 'This page describes how our systems work today. It does not replace our Terms of Service.',
    cta: 'Start your case'
  },
  ru: {
    title: 'Как мы храним и защищаем ваши документы | Imverica',
    description: 'Где Imverica хранит загруженные документы, кто их видит, как они шифруются и где используется ИИ.',
    eyebrow: 'Ваши документы',
    heading: 'Как мы храним и защищаем ваши документы',
    sub: 'Что происходит с бумагами, которые вы нам присылаете: где они хранятся, кто их видит и где используется ИИ, а где нет.',
    sections: [
      { heading: 'Где хранятся файлы', items: [
        'Файлы, загруженные в личном кабинете, шифруются (AES-256-GCM) до сохранения в нашем облачном хранилище. Названия файлов тоже шифруются.',
        'Ключ шифрования хранится только в настройках нашего сервера, а не рядом с файлами.',
        'Черновики, которые мы для вас создаём, хранятся в кабинете так же — в зашифрованном виде.',
        'Рабочая копия каждого загруженного файла попадает в Google Drive Imverica, чтобы команда могла готовить ваши документы.'
      ] },
      { heading: 'Кто их видит', items: [
        'Вы — после входа в кабинет и только по своим заявкам.',
        'Сотрудники Imverica, которые готовят ваши документы.',
        'Мы не продаём ваши документы и не используем их и данные из них для рекламы, отзывов или примеров. Образцы на сайте полностью вымышлены.'
      ] },
      { heading: 'Проверки при загрузке', items: [
        'Принимаются только PDF, JPG, PNG и DOCX, и мы проверяем реальное содержимое файла, а не только его название.',
        'Отпечаток каждого файла (хеш SHA-256) сверяется с базой известных вирусов. Сам файл в сервис проверки не отправляется.',
        'Перед первой загрузкой вы подтверждаете, что вправе передать документы: они ваши или у вас есть разрешение человека, которому они принадлежат.'
      ] },
      { heading: 'Где используется ИИ, а где нет', items: [
        'Ассистент на сайте отвечает на общие вопросы с помощью Claude от Anthropic. То, что вы пишете ассистенту, отправляется в Anthropic для ответа, поэтому не пишите туда номера Social Security, A-Number, паспорта и другие номера документов.',
        'Документы, загруженные в кабинет, ассистенту не передаются.',
        'Проверки форм, например проверка цифр FL-150, работают на нашем сервере и ваши ответы не сохраняют.'
      ] },
      { heading: 'Сколько мы их храним', items: [
        'Загруженные вами файлы можно удалить из кабинета в любой момент. Подготовленные нами документы остаются в кабинете, чтобы вы могли скачать их снова.',
        'Копии в нашем деле хранятся столько, сколько требуют закон и наши правила хранения записей. Чтобы спросить об удалении копий, свяжитесь с нами.'
      ] },
      { heading: 'Что важно с вашей стороны', items: [
        'Загружайте только документы, которые вправе передать.',
        'Если документ запечатан судом или на него распространяется защитный приказ, сначала убедитесь, что передавать его можно.',
        'Если инструкция к форме требует закрасить номер (например, номер Social Security на pay stubs к FL-150), сделайте это до загрузки.'
      ] }
    ],
    foot: 'Здесь описано, как наши системы работают сегодня. Эта страница не заменяет Terms of Service (условия обслуживания).',
    cta: 'Начать'
  },
  uk: {
    title: 'Як ми зберігаємо та захищаємо ваші документи | Imverica',
    description: 'Де Imverica зберігає завантажені документи, хто їх бачить, як вони шифруються і де використовується ШІ.',
    eyebrow: 'Ваші документи',
    heading: 'Як ми зберігаємо та захищаємо ваші документи',
    sub: 'Що відбувається з паперами, які ви нам надсилаєте: де вони зберігаються, хто їх бачить і де використовується ШІ, а де ні.',
    sections: [
      { heading: 'Де зберігаються файли', items: [
        'Файли, завантажені в особистому кабінеті, шифруються (AES-256-GCM) до збереження в нашому хмарному сховищі. Назви файлів теж шифруються.',
        'Ключ шифрування зберігається лише в налаштуваннях нашого сервера, а не поруч із файлами.',
        'Чернетки, які ми для вас створюємо, зберігаються в кабінеті так само — зашифрованими.',
        'Робоча копія кожного завантаженого файла потрапляє в Google Drive Imverica, щоб команда могла готувати ваші документи.'
      ] },
      { heading: 'Хто їх бачить', items: [
        'Ви — після входу в кабінет і лише за своїми заявками.',
        'Працівники Imverica, які готують ваші документи.',
        'Ми не продаємо ваші документи й не використовуємо їх і дані з них для реклами, відгуків чи прикладів. Зразки на сайті повністю вигадані.'
      ] },
      { heading: 'Перевірки під час завантаження', items: [
        'Приймаються лише PDF, JPG, PNG і DOCX, і ми перевіряємо справжній вміст файла, а не тільки назву.',
        'Відбиток кожного файла (хеш SHA-256) звіряється з базою відомих вірусів. Сам файл до сервісу перевірки не надсилається.',
        'Перед першим завантаженням ви підтверджуєте, що маєте право передати документи: вони ваші або ви маєте дозвіл особи, якій вони належать.'
      ] },
      { heading: 'Де використовується ШІ, а де ні', items: [
        'Асистент на сайті відповідає на загальні запитання за допомогою Claude від Anthropic. Те, що ви пишете асистенту, надсилається в Anthropic для відповіді, тому не пишіть туди номери Social Security, A-Number, паспорта та інші номери документів.',
        'Документи, завантажені в кабінет, асистенту не передаються.',
        'Перевірки форм, наприклад перевірка цифр FL-150, працюють на нашому сервері й ваших відповідей не зберігають.'
      ] },
      { heading: 'Скільки ми їх зберігаємо', items: [
        'Завантажені вами файли можна видалити з кабінету будь-коли. Підготовлені нами документи залишаються в кабінеті, щоб ви могли завантажити їх знову.',
        'Копії в нашій справі зберігаються стільки, скільки вимагають закон і наші правила зберігання записів. Щоб запитати про видалення копій, зв’яжіться з нами.'
      ] },
      { heading: 'Що важливо з вашого боку', items: [
        'Завантажуйте лише документи, які маєте право передати.',
        'Якщо документ запечатаний судом або на нього поширюється захисний наказ, спершу переконайтеся, що передавати його можна.',
        'Якщо інструкція до форми вимагає замалювати номер (наприклад, номер Social Security на pay stubs до FL-150), зробіть це до завантаження.'
      ] }
    ],
    foot: 'Тут описано, як наші системи працюють сьогодні. Ця сторінка не замінює Terms of Service (умови обслуговування).',
    cta: 'Почати'
  },
  es: {
    title: 'Cómo guardamos y protegemos sus documentos | Imverica',
    description: 'Dónde guarda Imverica los documentos que usted sube, quién puede verlos, cómo se cifran y dónde se usa y no se usa la IA.',
    eyebrow: 'Sus documentos',
    heading: 'Cómo guardamos y protegemos sus documentos',
    sub: 'Qué pasa con los papeles que nos envía: dónde se guardan, quién puede verlos y dónde se usa y no se usa la IA.',
    sections: [
      { heading: 'Dónde se guardan sus archivos', items: [
        'Los archivos que sube en su cuenta de cliente se cifran (AES-256-GCM) antes de guardarse en nuestro almacenamiento en la nube. Los nombres de archivo también se cifran.',
        'La clave de cifrado está solo en la configuración de nuestro servidor, nunca junto a los archivos.',
        'Los borradores que generamos para usted se guardan en su cuenta de la misma forma, cifrados.',
        'Una copia de trabajo de cada archivo va al Google Drive de Imverica para que nuestro equipo prepare sus documentos.'
      ] },
      { heading: 'Quién puede verlos', items: [
        'Usted, después de iniciar sesión, y solo en sus propias solicitudes.',
        'Las personas del equipo de Imverica que preparan sus documentos.',
        'No vendemos sus documentos ni los usamos, ni nada de su contenido, para publicidad, reseñas o ejemplos. Los ejemplos de nuestro sitio son totalmente inventados.'
      ] },
      { heading: 'Revisiones al subir', items: [
        'Solo aceptamos archivos PDF, JPG, PNG y DOCX, y revisamos lo que el archivo contiene realmente, no solo su nombre.',
        'La huella de cada archivo (un hash SHA-256) se compara con una base de virus conocidos. El archivo nunca se envía al servicio de análisis.',
        'Antes de su primera carga, usted confirma que puede compartir los documentos: son suyos o tiene permiso de la persona a quien pertenecen.'
      ] },
      { heading: 'Dónde se usa la IA y dónde no', items: [
        'El asistente de nuestro sitio responde preguntas generales con Claude de Anthropic. Lo que usted escribe se envía a Anthropic para redactar la respuesta, así que no escriba ahí números de Seguro Social, A-Number, pasaporte u otros números de identificación.',
        'Los documentos que sube a su cuenta no se envían al asistente.',
        'Las revisiones de formularios, como la revisión de cifras del FL-150, se hacen en nuestro propio servidor y no guardan sus respuestas.'
      ] },
      { heading: 'Cuánto tiempo los guardamos', items: [
        'Puede borrar en cualquier momento los archivos que subió a su cuenta. Los documentos que preparamos quedan en su cuenta para que pueda descargarlos otra vez.',
        'Las copias en nuestro expediente se guardan el tiempo que exigen la ley y nuestra política de registros. Para preguntar sobre el borrado de copias, contáctenos.'
      ] },
      { heading: 'Lo que le toca a usted', items: [
        'Suba solo documentos que puede compartir.',
        'Si un documento está sellado o bajo una orden de protección, confirme que puede compartirlo antes de subirlo.',
        'Cuando las instrucciones de un formulario pidan tachar un número (por ejemplo, el Seguro Social en los talones de pago que se adjuntan al FL-150), hágalo antes de subirlo.'
      ] }
    ],
    foot: 'Esta página describe cómo funcionan hoy nuestros sistemas. No sustituye nuestros Terms of Service (términos del servicio).',
    cta: 'Comenzar'
  }
};

export const FL150_CHECKLIST: Record<Lang, InfoPage> = {
  en: {
    title: 'FL-150 checklist: what to check before you file | Imverica',
    description: 'A practical checklist for California Form FL-150 (Income and Expense Declaration): totals, averages, matching items and the attachments the form asks for.',
    eyebrow: 'California Family Law · FL-150',
    heading: 'FL-150 checklist: what to check before you file',
    sub: 'The Income and Expense Declaration (FL-150) is checked line by line. These are the items that most often do not add up, taken from the form’s own instructions.',
    sections: [
      { heading: 'Income (Items 1 and 5-9)', items: [
        'Item 1h: tick exactly one box — per month, per week or per hour — and give gross pay, before taxes.',
        'Item 5: fill both columns. "Average monthly" is everything received in the last 12 months, divided by 12.',
        'Items 1h and 5a should tell the same story: hourly pay × hours a week × 52 ÷ 12 is roughly the monthly wage.',
        'Overtime goes in 5b and commissions or bonuses in 5c, not in 5a.',
        'Item 7 (self-employment) is after business expenses; fill in the business name, type, years and your role.',
        'Items 8 and 9: if you tick the box, explain; if you explain, tick the box.'
      ] },
      { heading: 'Deductions, assets and household (Items 10-12)', items: [
        'Item 10g (job expenses not reimbursed): attach an explanation labeled "Question 10g".',
        'Item 11: total value of each type of asset; for 11c, fair market value minus what you owe.',
        'Item 12: for every person who lives with you, tick Yes or No for whether they pay some household expenses.'
      ] },
      { heading: 'Expenses and debts (Items 13-14)', items: [
        'Item 13: tick whether the expenses are estimated, actual or proposed needs.',
        'Item 13r is the total of a through q, without the principal and interest lines a(1)(a) and (b).',
        'Item 13p is the total of the monthly payments you list in Item 14; the two should match.'
      ] },
      { heading: 'Children (Items 16-19)', items: [
        'Item 16b: the two percentages add up to 100, or describe the parenting schedule instead.',
        'Item 17: if health insurance for the children is available through your job, give the company and the monthly cost.',
        'Item 19: give the months for each hardship amount, explain the hardship and attach documentation.'
      ] },
      { heading: 'Attachments and signature', items: [
        'Attach pay stubs for the last two months and proof of any other income; black out your Social Security number.',
        'Item 6 (investment income): attach a schedule of gross receipts less cash expenses for each property. Item 7: attach a profit and loss statement for two years or a Schedule C.',
        'Take your latest federal tax return to the hearing.',
        'Write the number of pages attached, then print your name, date and sign page 1.',
        'Use the current revision (Rev. September 1, 2024, printed at the bottom of each page).'
      ] },
      { heading: 'How Imverica helps', text: 'When we prepare your FL-150, our form runs these checks before your draft is made and shows anything that does not add up, so you can correct it. We enter the figures you give us; we do not calculate support or advise on what to report.' }
    ],
    foot: 'Informational checklist based on the instructions printed on Form FL-150. Not legal advice. Imverica is a registered California Legal Document Assistant, not a law firm.',
    cta: 'Start my FL-150'
  },
  ru: {
    title: 'Чеклист FL-150: что проверить перед подачей | Imverica',
    description: 'Практический чеклист по калифорнийской форме FL-150 (Income and Expense Declaration — декларация о доходах и расходах): итоги, средние, совпадающие пункты и приложения.',
    eyebrow: 'Семейное право Калифорнии · FL-150',
    heading: 'Чеклист FL-150: что проверить перед подачей',
    sub: 'Income and Expense Declaration (декларацию о доходах и расходах, FL-150) проверяют построчно. Здесь — пункты, которые чаще всего не сходятся, по инструкциям самой формы.',
    sections: [
      { heading: 'Доходы (пункты 1 и 5-9)', items: [
        'Пункт 1h: отметьте ровно один вариант — в месяц, в неделю или в час — и укажите доход до налогов.',
        'Пункт 5: заполните обе колонки. «В среднем в месяц» — всё, что получено за последние 12 месяцев, делённое на 12.',
        'Пункты 1h и 5a должны совпадать по смыслу: почасовая ставка × часы в неделю × 52 ÷ 12 — это примерно месячная зарплата.',
        'Сверхурочные — в 5b, комиссионные и бонусы — в 5c, не в 5a.',
        'Пункт 7 (самозанятость) — после вычета расходов бизнеса; укажите название, вид бизнеса, сколько лет и вашу роль.',
        'Пункты 8 и 9: если отметили флажок — объясните; если объяснили — отметьте флажок.'
      ] },
      { heading: 'Вычеты, имущество и семья (пункты 10-12)', items: [
        'Пункт 10g (расходы по работе, не возмещённые работодателем): приложите пояснение с заголовком «Question 10g».',
        'Пункт 11: общая стоимость каждого вида имущества; для 11c — рыночная стоимость минус долги.',
        'Пункт 12: для каждого, кто живёт с вами, отметьте «Да» или «Нет» — оплачивает ли он часть расходов семьи.'
      ] },
      { heading: 'Расходы и долги (пункты 13-14)', items: [
        'Пункт 13: отметьте, расходы оценочные, фактические или предлагаемые потребности.',
        'Пункт 13r — сумма строк a-q без строк основного долга и процентов a(1)(a) и (b).',
        'Пункт 13p — сумма ежемесячных платежей из пункта 14; они должны совпадать.'
      ] },
      { heading: 'Дети (пункты 16-19)', items: [
        'Пункт 16b: два процента в сумме дают 100, или опишите график общения.',
        'Пункт 17: если страховка для детей доступна через работу, укажите компанию и ежемесячную стоимость.',
        'Пункт 19: для каждой суммы укажите число месяцев, объясните трудности и приложите документы.'
      ] },
      { heading: 'Приложения и подпись', items: [
        'Приложите pay stubs (расчётные листки) за последние два месяца и подтверждение других доходов; закрасьте номер Social Security.',
        'Пункт 6 (инвестиционный доход): приложите расчёт поступлений минус денежные расходы по каждому объекту. Пункт 7: отчёт о прибылях и убытках за два года или Schedule C.',
        'Возьмите на заседание последнюю федеральную налоговую декларацию.',
        'Укажите число приложенных страниц, впишите имя, дату и подпишите страницу 1.',
        'Используйте актуальную редакцию (Rev. September 1, 2024 — внизу каждой страницы).'
      ] },
      { heading: 'Чем помогает Imverica', text: 'Когда мы готовим вашу FL-150, форма проверяет эти пункты до создания черновика и показывает, что не сходится, чтобы вы могли исправить. Мы вносим цифры, которые даёте вы; мы не рассчитываем алименты и не советуем, что указывать.' }
    ],
    foot: 'Информационный чеклист по инструкциям, напечатанным на форме FL-150. Не юридическая консультация. Imverica — зарегистрированный California Legal Document Assistant, не юридическая фирма.',
    cta: 'Начать анкету FL-150'
  },
  uk: {
    title: 'Чекліст FL-150: що перевірити перед поданням | Imverica',
    description: 'Практичний чекліст до каліфорнійської форми FL-150 (Income and Expense Declaration — декларація про доходи та витрати): підсумки, середні, пункти, що мають збігатися, і додатки.',
    eyebrow: 'Сімейне право Каліфорнії · FL-150',
    heading: 'Чекліст FL-150: що перевірити перед поданням',
    sub: 'Income and Expense Declaration (декларацію про доходи та витрати, FL-150) перевіряють рядок за рядком. Тут — пункти, які найчастіше не сходяться, за інструкціями самої форми.',
    sections: [
      { heading: 'Доходи (пункти 1 і 5-9)', items: [
        'Пункт 1h: позначте рівно один варіант — на місяць, на тиждень або на годину — і вкажіть дохід до податків.',
        'Пункт 5: заповніть обидві колонки. «В середньому на місяць» — усе, що отримано за останні 12 місяців, поділене на 12.',
        'Пункти 1h і 5a мають збігатися за змістом: погодинна ставка × години на тиждень × 52 ÷ 12 — це приблизно місячна зарплата.',
        'Понаднормові — у 5b, комісійні та бонуси — у 5c, не в 5a.',
        'Пункт 7 (самозайнятість) — після вирахування витрат бізнесу; вкажіть назву, вид бізнесу, скільки років і вашу роль.',
        'Пункти 8 і 9: якщо позначили — поясніть; якщо пояснили — позначте.'
      ] },
      { heading: 'Відрахування, майно й домогосподарство (пункти 10-12)', items: [
        'Пункт 10g (витрати на роботу, не відшкодовані роботодавцем): додайте пояснення із заголовком «Question 10g».',
        'Пункт 11: загальна вартість кожного виду майна; для 11c — ринкова вартість мінус борги.',
        'Пункт 12: для кожного, хто живе з вами, позначте «Так» або «Ні» — чи сплачує він частину витрат.'
      ] },
      { heading: 'Витрати й борги (пункти 13-14)', items: [
        'Пункт 13: позначте, витрати орієнтовні, фактичні чи пропоновані потреби.',
        'Пункт 13r — сума рядків a-q без рядків основного боргу й відсотків a(1)(a) і (b).',
        'Пункт 13p — сума щомісячних платежів із пункту 14; вони мають збігатися.'
      ] },
      { heading: 'Діти (пункти 16-19)', items: [
        'Пункт 16b: два відсотки разом дають 100, або опишіть графік спілкування.',
        'Пункт 17: якщо страховка для дітей доступна через роботу, вкажіть компанію та щомісячну вартість.',
        'Пункт 19: для кожної суми вкажіть кількість місяців, поясніть труднощі й додайте документи.'
      ] },
      { heading: 'Додатки й підпис', items: [
        'Додайте pay stubs (розрахункові листи) за останні два місяці та підтвердження інших доходів; замалюйте номер Social Security.',
        'Пункт 6 (інвестиційний дохід): додайте розрахунок надходжень мінус грошові витрати по кожному об’єкту. Пункт 7: звіт про прибутки та збитки за два роки або Schedule C.',
        'Візьміть на засідання останню федеральну податкову декларацію.',
        'Вкажіть кількість доданих сторінок, впишіть ім’я, дату й підпишіть сторінку 1.',
        'Використовуйте чинну редакцію (Rev. September 1, 2024 — внизу кожної сторінки).'
      ] },
      { heading: 'Чим допомагає Imverica', text: 'Коли ми готуємо вашу FL-150, форма перевіряє ці пункти до створення чернетки й показує, що не сходиться, щоб ви могли виправити. Ми вносимо цифри, які даєте ви; ми не розраховуємо аліменти й не радимо, що вказувати.' }
    ],
    foot: 'Інформаційний чекліст за інструкціями, надрукованими на формі FL-150. Не юридична консультація. Imverica — зареєстрований California Legal Document Assistant, не юридична фірма.',
    cta: 'Почати анкету FL-150'
  },
  es: {
    title: 'Lista de revisión del FL-150: qué revisar antes de presentar | Imverica',
    description: 'Lista práctica para el formulario FL-150 de California (Income and Expense Declaration — declaración de ingresos y gastos): totales, promedios, puntos que deben coincidir y anexos.',
    eyebrow: 'Derecho familiar de California · FL-150',
    heading: 'Lista de revisión del FL-150: qué revisar antes de presentar',
    sub: 'La Income and Expense Declaration (declaración de ingresos y gastos, FL-150) se revisa línea por línea. Estos son los puntos que con más frecuencia no cuadran, según las instrucciones del propio formulario.',
    sections: [
      { heading: 'Ingresos (puntos 1 y 5-9)', items: [
        'Punto 1h: marque una sola casilla — por mes, por semana o por hora — e indique el pago bruto, antes de impuestos.',
        'Punto 5: llene las dos columnas. "Promedio mensual" es todo lo recibido en los últimos 12 meses, dividido entre 12.',
        'Los puntos 1h y 5a deben coincidir: pago por hora × horas por semana × 52 ÷ 12 es más o menos el salario mensual.',
        'Las horas extra van en 5b y las comisiones o bonos en 5c, no en 5a.',
        'El punto 7 (trabajo por cuenta propia) es después de los gastos del negocio; anote el nombre, tipo, años y su función.',
        'Puntos 8 y 9: si marca la casilla, explique; si explica, marque la casilla.'
      ] },
      { heading: 'Deducciones, bienes y hogar (puntos 10-12)', items: [
        'Punto 10g (gastos de trabajo no reembolsados): adjunte una explicación titulada "Question 10g".',
        'Punto 11: el valor total de cada tipo de bien; en 11c, el valor de mercado menos lo que debe.',
        'Punto 12: para cada persona que vive con usted, marque Sí o No sobre si paga parte de los gastos del hogar.'
      ] },
      { heading: 'Gastos y deudas (puntos 13-14)', items: [
        'Punto 13: marque si los gastos son estimados, reales o necesidades propuestas.',
        'El punto 13r es la suma de a a q, sin las líneas de capital e intereses a(1)(a) y (b).',
        'El punto 13p es la suma de los pagos mensuales del punto 14; deben coincidir.'
      ] },
      { heading: 'Hijos (puntos 16-19)', items: [
        'Punto 16b: los dos porcentajes suman 100, o describa el horario de crianza.',
        'Punto 17: si tiene seguro médico para los hijos por su trabajo, indique la compañía y el costo mensual.',
        'Punto 19: indique los meses de cada monto, explique la dificultad y adjunte documentación.'
      ] },
      { heading: 'Anexos y firma', items: [
        'Adjunte los talones de pago de los últimos dos meses y prueba de otros ingresos; tache su número de Seguro Social.',
        'Punto 6 (ingresos de inversión): adjunte un anexo con ingresos brutos menos gastos en efectivo de cada propiedad. Punto 7: estado de pérdidas y ganancias de dos años o Schedule C.',
        'Lleve su última declaración federal de impuestos a la audiencia.',
        'Escriba el número de páginas adjuntas, ponga su nombre y la fecha, y firme la página 1.',
        'Use la revisión vigente (Rev. September 1, 2024, impresa al pie de cada página).'
      ] },
      { heading: 'Cómo ayuda Imverica', text: 'Cuando preparamos su FL-150, el formulario revisa estos puntos antes de crear el borrador y le muestra lo que no cuadra para que lo corrija. Anotamos las cifras que usted nos da; no calculamos la manutención ni aconsejamos qué declarar.' }
    ],
    foot: 'Lista informativa basada en las instrucciones impresas en el formulario FL-150. No es asesoría legal. Imverica es un Legal Document Assistant registrado en California, no un bufete de abogados.',
    cta: 'Comenzar mi FL-150'
  }
};
