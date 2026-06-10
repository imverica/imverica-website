'use strict';
// Master candidate list of statewide California Judicial Council form codes,
// grouped by category. Codes are validated live against
// selfhelp.courts.ca.gov/jcc-form/<CODE> (server-rendered: 200 + title + PDF
// link for real forms, 404 otherwise) by scripts/fetch-all-ca-forms.js, so a
// stray candidate simply drops out — this list errs toward breadth.
//
// `name` is the human category label; `keywords` are EN/RU/UA/ES synonyms that
// the search router blends with each form's official title.

const CATEGORIES = {
  FL: {
    name: 'Family Law',
    keywords: ['divorce', 'develop', 'family law', 'custody', 'child support', 'spousal support', 'separation', 'paternity', 'parentage',
      'развод', 'расторжение брака', 'семейное право', 'опека', 'алименты', 'раздельное проживание', 'отцовство',
      'розлучення', 'сімейне право', 'опіка', 'аліменти', 'батьківство',
      'divorcio', 'derecho de familia', 'custodia', 'manutención', 'pensión alimenticia', 'paternidad'],
    numbers: [100,105,107,110,115,117,120,130,140,141,142,144,145,150,155,157,160,165,170,180,190,191,192,195,
      200,210,220,230,250,260,270,280,290,293,295,296,
      300,305,306,307,311,312,313,314,320,326,330,335,340,341,342,343,344,345,346,347,348,350,355,360,361,395,
      400,410,420,430,
      800,810,820,825,830,834,900,910,920,930,950,970]
  },
  FW: {
    name: 'Fee Waiver',
    keywords: ['fee waiver', 'cannot afford fees', 'waive court fees', 'low income',
      'освобождение от пошлины', 'не могу оплатить сбор', 'льгота по оплате',
      'звільнення від сплати', 'пільга на судовий збір',
      'exención de cuotas', 'no puedo pagar', 'exención de tarifas'],
    numbers: [1,3,5,8,10,12,15]
  },
  DV: {
    name: 'Domestic Violence Restraining Order',
    keywords: ['domestic violence', 'restraining order', 'abuse', 'protective order', 'family abuse', 'partner abuse',
      'домашнее насилие', 'охранный ордер', 'запретительный ордер', 'насилие в семье', 'защита от побоев',
      'домашнє насильство', 'охоронний ордер', 'насильство в сім’ї',
      'violencia doméstica', 'orden de restricción', 'orden de protección', 'abuso'],
    numbers: [100,105,108,109,110,112,115,116,117,120,125,130,140,145,150,160,165,170,180,190,200,250,300,305,310,400,420,430,500,505,510,520,530,540,600,610,625,630,650,700,710,720,730,800]
  },
  CH: {
    name: 'Civil Harassment Restraining Order',
    keywords: ['civil harassment', 'restraining order', 'harassment', 'stalking', 'neighbor', 'threats',
      'преследование', 'охранный ордер', 'домогательство', 'угрозы', 'сосед',
      'переслідування', 'домагання', 'погрози',
      'acoso civil', 'orden de restricción', 'hostigamiento', 'acecho'],
    numbers: [100,109,110,120,130,135,150,160,165,170,180,200,250,700,710,720,730,800]
  },
  WV: {
    name: 'Workplace Violence Restraining Order',
    keywords: ['workplace violence', 'employer restraining order', 'work', 'coworker', 'employee threat',
      'насилие на рабочем месте', 'охранный ордер работодателя', 'коллега',
      'насильство на робочому місці', 'роботодавець',
      'violencia laboral', 'orden de restricción del empleador', 'trabajo'],
    numbers: [100,109,110,120,130,150,160,170,180,200,250,700,710,720,730,800]
  },
  EA: {
    name: 'Elder/Dependent Adult Abuse Restraining Order',
    keywords: ['elder abuse', 'dependent adult abuse', 'restraining order', 'senior', 'caregiver',
      'насилие над пожилыми', 'охранный ордер', 'пожилой человек', 'опекун',
      'насильство над літніми', 'опікун',
      'abuso de ancianos', 'adulto dependiente', 'orden de restricción', 'cuidador'],
    numbers: [100,109,110,120,130,150,160,165,170,180,200,250,700,710,720,730,800]
  },
  GV: {
    name: 'Gun Violence Restraining Order',
    keywords: ['gun violence restraining order', 'firearm', 'gun', 'weapon removal',
      'оружейное насилие', 'охранный ордер', 'изъятие оружия', 'огнестрельное',
      'вилучення зброї', 'вогнепальна зброя',
      'orden de restricción por violencia con armas', 'arma de fuego', 'pistola'],
    numbers: [100,109,110,120,130,150,160,170,180,200,250,700,710,720,800]
  },
  NC: {
    name: 'Name Change & Gender Recognition',
    keywords: ['name change', 'change my name', 'change name', 'gender recognition', 'gender marker', 'new name',
      'смена имени', 'изменить имя', 'смена фамилии', 'признание пола', 'новое имя',
      'зміна імені', 'зміна прізвища', 'визнання статі',
      'cambio de nombre', 'cambiar mi nombre', 'reconocimiento de género'],
    numbers: [100,110,120,121,125,130,200,210,220,225,230,300,310,320,400,410,420,500,510,520,525,530]
  },
  SC: {
    name: 'Small Claims',
    keywords: ['small claims', 'sue', 'money owed', 'lawsuit small', 'plaintiff', 'defendant', 'judgment',
      'мелкие иски', 'подать в суд', 'долг', 'взыскать деньги', 'истец', 'ответчик',
      'дрібні позови', 'подати до суду', 'борг', 'стягнути гроші',
      'reclamos menores', 'demandar', 'dinero adeudado', 'demandante', 'demandado'],
    numbers: [100,101,103,104,105,107,108,109,112,114,115,116,117,118,120,130,132,133,134,135,140,145,150,200,220,221,223,224,290,300]
  },
  UD: {
    name: 'Unlawful Detainer / Eviction',
    keywords: ['eviction', 'unlawful detainer', 'evict tenant', 'landlord', 'tenant', 'lease', 'rent', 'remove tenant',
      'выселение', 'незаконное удержание', 'арендодатель', 'квартиросъёмщик', 'аренда', 'выселить',
      'виселення', 'орендодавець', 'орендар', 'виселити',
      'desalojo', 'detentor ilegal', 'desalojar inquilino', 'arrendador', 'inquilino', 'renta'],
    numbers: [100,101,102,104,105,110,112,115,116,120,125,130,150]
  },
  CM: {
    name: 'Civil — Case Cover & Management',
    keywords: ['civil case', 'cover sheet', 'case management', 'civil lawsuit',
      'гражданское дело', 'титульный лист', 'управление делом',
      'цивільна справа', 'супровідний лист',
      'caso civil', 'hoja de portada', 'gestión del caso'],
    numbers: [10,11,15,20,30,100,101,110,160,180,200,210]
  },
  CIV: {
    name: 'Civil',
    keywords: ['civil', 'complaint', 'summons', 'answer', 'declaration',
      'гражданский иск', 'жалоба', 'повестка', 'ответ', 'декларация',
      'цивільний позов', 'скарга', 'повістка', 'відповідь',
      'civil', 'demanda', 'citación', 'respuesta', 'declaración'],
    numbers: [10,50,100,105,110,120,150]
  },
  POS: {
    name: 'Proof of Service',
    keywords: ['proof of service', 'serve papers', 'service of process', 'how to serve',
      'подтверждение вручения', 'вручение документов', 'как вручить',
      'підтвердження вручення', 'вручення документів',
      'prueba de entrega', 'notificación', 'cómo entregar'],
    numbers: [10,15,20,30,40,50]
  },
  MC: {
    name: 'Miscellaneous',
    keywords: ['attachment', 'additional page', 'declaration', 'miscellaneous',
      'приложение', 'дополнительная страница', 'декларация',
      'додаток', 'додаткова сторінка',
      'anexo', 'página adicional', 'declaración'],
    numbers: [12,20,25,30,31,32,33,34,35,40,50,52,94,95,97,100,210,220,230,300,350,351,357,358,359,400,410,420]
  },
  EJ: {
    name: 'Enforcement of Judgment',
    keywords: ['enforce judgment', 'wage garnishment', 'levy', 'collect judgment', 'writ of execution',
      'исполнение решения', 'удержание из зарплаты', 'арест', 'взыскание по решению',
      'виконання рішення', 'утримання із зарплати',
      'ejecución de sentencia', 'embargo de salario', 'cobrar sentencia'],
    numbers: [100,125,130,150,160,165,170,195]
  },
  WG: {
    name: 'Wage Garnishment',
    keywords: ['wage garnishment', 'earnings withholding', 'garnish wages',
      'удержание из зарплаты', 'арест заработной платы',
      'утримання із зарплати',
      'embargo de salario', 'retención de ingresos'],
    numbers: [1,2,3,4,5,6,7,8,9,12,30,35]
  },
  DE: {
    name: 'Probate — Decedents Estates',
    keywords: ['probate', 'estate', 'will', 'decedent', 'inheritance', 'executor', 'administer estate',
      'наследство', 'завещание', 'наследственное дело', 'душеприказчик', 'управление имуществом',
      'спадщина', 'заповіт', 'спадкове провадження',
      'sucesión', 'testamento', 'herencia', 'albacea', 'patrimonio'],
    numbers: [111,120,121,122,131,135,140,147,150,157,160,165,166,172,174,221,226,260,270,295,305,310,315,140]
  },
  GC: {
    name: 'Guardianship & Conservatorship',
    keywords: ['guardianship', 'conservatorship', 'guardian of minor', 'conservator', 'incapacitated adult', 'care of child',
      'опекунство', 'попечительство', 'опекун несовершеннолетнего', 'недееспособный',
      'опіка', 'піклування', 'опікун дитини',
      'tutela', 'curaduría', 'tutor de menor', 'conservador'],
    numbers: [110,120,140,150,160,165,205,210,212,220,240,248,250,310,320,335,340,348,350,355,400,405,410,420]
  },
  JV: {
    name: 'Juvenile',
    keywords: ['juvenile', 'dependency', 'foster', 'minor court', 'SIJ special immigrant juvenile',
      'несовершеннолетние', 'опека над ребёнком', 'патронат',
      'неповнолітні', 'опіка над дитиною',
      'menores', 'dependencia juvenil', 'crianza temporal'],
    numbers: [100,110,130,140,180,200,210,220,250,300,320,356,357,358,359,405,410,412,415,420,430,440,450,460,470,500,505,800,810,820]
  },
  CR: {
    name: 'Criminal',
    keywords: ['criminal', 'expungement', 'clean record', 'dismiss conviction', 'reduce felony', 'sentence',
      'уголовное', 'снятие судимости', 'очистить record', 'смягчение приговора',
      'кримінальне', 'зняття судимості',
      'penal', 'eliminación de antecedentes', 'reducir delito'],
    numbers: [100,101,102,105,110,115,180,181,200,290,300,400,410]
  },
  APP: {
    name: 'Appellate',
    keywords: ['appeal', 'appellate', 'notice of appeal', 'higher court',
      'апелляция', 'обжалование', 'уведомление об апелляции',
      'апеляція', 'оскарження',
      'apelación', 'aviso de apelación'],
    numbers: [1,2,3,4,5,8,10,15,103,150,155]
  },
  ADM: {
    name: 'Administrative / General',
    keywords: ['interpreter', 'disability accommodation', 'request accommodation', 'language access',
      'переводчик', 'доступность', 'запрос на адаптацию',
      'перекладач', 'доступність',
      'intérprete', 'adaptación por discapacidad', 'acceso lingüístico'],
    numbers: [100,110]
  },
  MIL: {
    name: 'Military & Veterans',
    keywords: ['military', 'servicemember', 'veteran', 'deployment',
      'военный', 'военнослужащий', 'ветеран',
      'військовий', 'ветеран',
      'militar', 'miembro del servicio', 'veterano'],
    numbers: [10,100,110,200,210]
  }
};

// Build the flat candidate list of { code, slug, category, categoryName, keywords }.
function buildCandidates() {
  const out = [];
  for (const [prefix, def] of Object.entries(CATEGORIES)) {
    for (const n of def.numbers) {
      const num = String(n).padStart(3, '0');
      const code = `${prefix}-${num}`;
      out.push({
        code,
        slug: code.toLowerCase(),
        category: prefix,
        categoryName: def.name,
        keywords: def.keywords
      });
    }
  }
  // de-dup
  const seen = new Set();
  return out.filter((c) => (seen.has(c.code) ? false : seen.add(c.code)));
}

module.exports = { CATEGORIES, buildCandidates };
