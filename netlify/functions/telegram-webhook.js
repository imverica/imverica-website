/**
 * Telegram webhook — Imverica all-in-one bot.
 *
 * Receives Telegram bot updates and drives a conversational flow that
 * mirrors what the website does (intake + status + messaging) — but
 * adapted to a chat surface that immigrant clients already keep open
 * all day.
 *
 * Feature set:
 *   - Auto-detects language on first message (Cyrillic / Ukrainian /
 *     Spanish accents → ru / uk / es; otherwise en). User can switch
 *     anytime via /lang or the language picker shown after /start.
 *   - Conversational intake: situation → name → email → phone → files
 *     → confirmation. Submits to the same /api/quick-intake backend
 *     that powers the homepage form, so admin console sees ONE unified
 *     order list whether the client came via web or Telegram.
 *   - /status — shows the user's open orders (after linking their
 *     email with /link). /orders — full list. /help — command list.
 *   - /chat — kicks the conversation into pass-through mode where every
 *     message forwards to the owner's Telegram and replies route back.
 *
 * State per chat is stored in Netlify Blobs under
 *   imverica-telegram-sessions/chat/<chat_id>.json
 * and TTL'd after 30 days of inactivity so abandoned conversations
 * don't accumulate forever.
 *
 * UPL safety: bot NEVER gives legal advice, never picks a form for the
 * user, never predicts an outcome. Every category response includes
 * "Document preparation only — not legal advice" boilerplate.
 *
 * Setup (one-time, owner):
 *   1. @BotFather → /newbot → save token in TELEGRAM_BOT_TOKEN env.
 *   2. @userinfobot → save the operator's chat id in
 *      TELEGRAM_OWNER_CHAT_ID env.
 *   3. Register webhook by calling /api/telegram-setup once (handles
 *      Telegram's setWebhook API call for you).
 */

const crypto = require('crypto');
const { ensureBlobs, originGuard } = require('./lib/abuse-guard');
const { getStore } = require('@netlify/blobs');

const TG_API = 'https://api.telegram.org/bot';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function ok(extra) {
  return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, ...(extra || {}) }) };
}

// ============================================================
// Translations — keep every customer-facing string in here.
// ============================================================
const T = {
  en: {
    welcome:
      "👋 Welcome to *Imverica Legal Solutions* — California Licensed LDA & Immigration Consultant.\n\n" +
      "We prepare documents at your direction. We do not give legal advice.\n\n" +
      "Pick a language to continue:",
    pickedLang: "Got it — English it is. ✅",
    menu:
      "How can I help?\n\n" +
      "• Tap *Start request* to send a new intake (you can attach up to 5 files).\n" +
      "• /status — check your orders\n" +
      "• /chat — message the Imverica team\n" +
      "• /lang — change language\n" +
      "• /help — show all commands",
    startRequest: "📄 Start request",
    chatStaff: "💬 Message staff",
    myOrders: "📋 My orders",
    changeLang: "🌐 Language",
    askSituation:
      "Tell me what you need. A sentence or two is enough — e.g. \"I need to prepare my I-485 adjustment-of-status package\" or \"My landlord didn't return my security deposit.\"",
    askName: "What is your full name?",
    askEmail: "Your email address (we'll send confirmations and the case-tracking link here):",
    askPhone: "Phone number (optional — tap /skip to skip):",
    askFiles:
      "📎 Attach up to 5 documents now (PDF / JPG / PNG / DOCX, each ≤4 MB).\n\n" +
      "When you're done — tap *Send request* below.",
    sendRequest: "✅ Send request",
    cancel: "Cancel",
    skip: "Skip",
    fileAdded: "Attached: {name} ({size}). Send another or tap *Send request*.",
    fileTooBig: "That file is too large. Max 4 MB per file.",
    fileWrongType: "We only accept PDF, JPG, PNG and DOCX. Please try another file.",
    fileLimit: "Maximum 5 files reached. Tap *Send request* to submit.",
    confirmHeader: "Here's what I have. Confirm to send:",
    submitting: "Submitting…",
    submitOk:
      "✅ Got it!\n\nOrder *{id}*\n\nWe'll reply at {email} within one business day. " +
      "You can also track this case at https://imverica.com/account",
    submitFail:
      "Something went wrong submitting your request. Please try again, or call +1 (916) 399-3992.",
    cancelled: "Cancelled. /start anytime to begin again.",
    invalidEmail: "That email doesn't look valid. Please send a valid email like name@example.com.",
    needLink:
      "To see your orders here, link your email first: send /link followed by your email " +
      "address (e.g. `/link client@example.com`). We'll send a one-time code to verify.",
    sentLinkCode: "I sent a one-time code to {email}. Reply here with the 6-digit code.",
    invalidLinkCode: "That code doesn't match (or it expired). Try /link again.",
    linked: "✅ Linked! Your Telegram is now connected to {email}.",
    noOrders: "No orders yet. Tap *Start request* below to file your first one.",
    orderLine: "*{id}* · {status} · {when}",
    chatHeader:
      "💬 You're now talking to Imverica staff. Send any message and we'll reply here.\n\n" +
      "Tap /endchat to close the conversation. /start returns to the menu.",
    chatEnded: "Conversation ended. /start to begin again.",
    chatFwdToOwner: "📨 (forwarded to staff)",
    helpAll:
      "*Commands*\n\n" +
      "/start — open the main menu\n" +
      "/lang — change language\n" +
      "/status or /orders — list my orders\n" +
      "/link `<email>` — link my account so I can see orders\n" +
      "/chat — message the Imverica team\n" +
      "/endchat — close the staff chat\n" +
      "/cancel — cancel current request\n" +
      "/help — show this list",
    uplFooter:
      "_Imverica prepares documents at your direction. We are not a law firm and do not give legal advice._",
    unknown: "I didn't catch that. /help shows what I can do."
  },
  ru: {
    welcome:
      "👋 Добро пожаловать в *Imverica Legal Solutions* — California Licensed LDA и Immigration Consultant.\n\n" +
      "Мы готовим документы по вашему поручению. Юридических консультаций не даём.\n\n" +
      "Выберите язык:",
    pickedLang: "Понял — продолжаем на русском. ✅",
    menu:
      "Чем помочь?\n\n" +
      "• Жмите *Новая заявка* чтобы оставить запрос (можно прикрепить до 5 файлов).\n" +
      "• /status — проверить мои заказы\n" +
      "• /chat — написать сотрудникам Imverica\n" +
      "• /lang — поменять язык\n" +
      "• /help — все команды",
    startRequest: "📄 Новая заявка",
    chatStaff: "💬 Написать сотруднику",
    myOrders: "📋 Мои заказы",
    changeLang: "🌐 Язык",
    askSituation:
      "Расскажите что нужно. Хватит одной-двух фраз — например «Нужно собрать пакет I-485 на грин-карту» или «Арендодатель не вернул депозит».",
    askName: "Как вас зовут (имя и фамилия)?",
    askEmail: "Ваш email (туда будет ссылка для отслеживания заказа):",
    askPhone: "Телефон (необязательно — /skip чтобы пропустить):",
    askFiles:
      "📎 Прикрепите до 5 документов (PDF / JPG / PNG / DOCX, каждый ≤4 МБ).\n\n" +
      "Когда закончите — жмите *Отправить заявку* внизу.",
    sendRequest: "✅ Отправить заявку",
    cancel: "Отмена",
    skip: "Пропустить",
    fileAdded: "Прикреплено: {name} ({size}). Можно ещё или жмите *Отправить заявку*.",
    fileTooBig: "Файл слишком большой. Максимум 4 МБ.",
    fileWrongType: "Принимаем только PDF, JPG, PNG, DOCX. Попробуйте другой файл.",
    fileLimit: "Достигнут лимит в 5 файлов. Жмите *Отправить заявку*.",
    confirmHeader: "Проверьте данные и подтвердите отправку:",
    submitting: "Отправляем…",
    submitOk:
      "✅ Принято!\n\nЗаказ *{id}*\n\nОтветим на {email} в течение одного рабочего дня. " +
      "Также можно отслеживать заказ: https://imverica.com/ru/account",
    submitFail:
      "Что-то пошло не так. Попробуйте ещё раз или позвоните +1 (916) 399-3992.",
    cancelled: "Отменено. /start когда захотите начать заново.",
    invalidEmail: "Email не похож на правильный. Пришлите в формате name@example.com.",
    needLink:
      "Чтобы видеть свои заказы — сначала привяжите email: отправьте /link и адрес " +
      "(например `/link client@example.com`). Мы пришлём код подтверждения на почту.",
    sentLinkCode: "Код подтверждения отправлен на {email}. Пришлите сюда 6-значный код.",
    invalidLinkCode: "Код не совпадает (или истёк). Попробуйте /link ещё раз.",
    linked: "✅ Готово! Ваш Telegram привязан к {email}.",
    noOrders: "Заказов ещё нет. Жмите *Новая заявка* чтобы оставить первый.",
    orderLine: "*{id}* · {status} · {when}",
    chatHeader:
      "💬 Вы говорите с сотрудниками Imverica. Пишите сообщения — мы ответим прямо здесь.\n\n" +
      "/endchat — закрыть разговор. /start — вернуться в меню.",
    chatEnded: "Разговор закрыт. /start чтобы начать заново.",
    chatFwdToOwner: "📨 (передано сотруднику)",
    helpAll:
      "*Команды*\n\n" +
      "/start — главное меню\n" +
      "/lang — сменить язык\n" +
      "/status или /orders — мои заказы\n" +
      "/link `<email>` — привязать аккаунт чтобы видеть заказы\n" +
      "/chat — написать сотруднику\n" +
      "/endchat — закрыть чат с сотрудником\n" +
      "/cancel — отменить текущую заявку\n" +
      "/help — показать этот список",
    uplFooter:
      "_Imverica готовит документы по вашему поручению. Мы не юридическая фирма и не даём юридических консультаций._",
    unknown: "Не понял. /help покажет что я умею."
  },
  uk: {
    welcome:
      "👋 Ласкаво просимо до *Imverica Legal Solutions* — California Licensed LDA та Immigration Consultant.\n\n" +
      "Готуємо документи за вашим дорученням. Юридичних консультацій не надаємо.\n\n" +
      "Оберіть мову:",
    pickedLang: "Зрозуміло — продовжуємо українською. ✅",
    menu:
      "Чим допомогти?\n\n" +
      "• Натисніть *Нова заявка* щоб залишити запит (до 5 файлів).\n" +
      "• /status — перевірити мої замовлення\n" +
      "• /chat — написати співробітникам Imverica\n" +
      "• /lang — змінити мову\n" +
      "• /help — усі команди",
    startRequest: "📄 Нова заявка",
    chatStaff: "💬 Написати співробітнику",
    myOrders: "📋 Мої замовлення",
    changeLang: "🌐 Мова",
    askSituation:
      "Розкажіть що потрібно. Достатньо однієї-двох фраз — наприклад «Треба зібрати пакет I-485 на грін-карту» або «Орендодавець не повернув депозит».",
    askName: "Як вас звати (ім'я та прізвище)?",
    askEmail: "Ваш email (туди надішлемо посилання для відстеження замовлення):",
    askPhone: "Телефон (необов'язково — /skip щоб пропустити):",
    askFiles:
      "📎 Прикріпіть до 5 документів (PDF / JPG / PNG / DOCX, кожен ≤4 МБ).\n\n" +
      "Коли закінчите — натисніть *Надіслати заявку*.",
    sendRequest: "✅ Надіслати заявку",
    cancel: "Скасувати",
    skip: "Пропустити",
    fileAdded: "Прикріплено: {name} ({size}). Можна ще або натискайте *Надіслати заявку*.",
    fileTooBig: "Файл завеликий. Максимум 4 МБ.",
    fileWrongType: "Приймаємо лише PDF, JPG, PNG, DOCX. Спробуйте інший файл.",
    fileLimit: "Досягнуто ліміт у 5 файлів. Натискайте *Надіслати заявку*.",
    confirmHeader: "Перевірте дані та підтвердіть надсилання:",
    submitting: "Надсилаємо…",
    submitOk:
      "✅ Прийнято!\n\nЗамовлення *{id}*\n\nВідповімо на {email} протягом одного робочого дня. " +
      "Також можна стежити: https://imverica.com/ua/account",
    submitFail:
      "Щось пішло не так. Спробуйте ще раз або зателефонуйте +1 (916) 399-3992.",
    cancelled: "Скасовано. /start коли захочете почати знову.",
    invalidEmail: "Email виглядає неправильно. Надішліть у форматі name@example.com.",
    needLink:
      "Щоб бачити свої замовлення — спочатку прив'яжіть email: надішліть /link і адресу " +
      "(наприклад `/link client@example.com`). Ми надішлемо код підтвердження на пошту.",
    sentLinkCode: "Код підтвердження надіслано на {email}. Надішліть сюди 6-значний код.",
    invalidLinkCode: "Код не збігається (або застарів). Спробуйте /link ще раз.",
    linked: "✅ Готово! Ваш Telegram прив'язано до {email}.",
    noOrders: "Замовлень ще немає. Натисніть *Нова заявка* щоб залишити перше.",
    orderLine: "*{id}* · {status} · {when}",
    chatHeader:
      "💬 Ви говорите зі співробітниками Imverica. Пишіть повідомлення — ми відповімо тут.\n\n" +
      "/endchat — закрити розмову. /start — повернутися в меню.",
    chatEnded: "Розмову закрито. /start щоб почати знову.",
    chatFwdToOwner: "📨 (передано співробітнику)",
    helpAll:
      "*Команди*\n\n" +
      "/start — головне меню\n" +
      "/lang — змінити мову\n" +
      "/status або /orders — мої замовлення\n" +
      "/link `<email>` — прив'язати акаунт\n" +
      "/chat — написати співробітнику\n" +
      "/endchat — закрити чат\n" +
      "/cancel — скасувати поточну заявку\n" +
      "/help — показати цей список",
    uplFooter:
      "_Imverica готує документи за вашим дорученням. Ми не юридична фірма і не надаємо юридичних консультацій._",
    unknown: "Не зрозумів. /help покаже що я вмію."
  },
  es: {
    welcome:
      "👋 Bienvenido a *Imverica Legal Solutions* — California Licensed LDA e Immigration Consultant.\n\n" +
      "Preparamos documentos bajo su dirección. No damos asesoría legal.\n\n" +
      "Elija un idioma:",
    pickedLang: "Listo — seguimos en español. ✅",
    menu:
      "¿En qué puedo ayudar?\n\n" +
      "• Toque *Nueva solicitud* para enviar un trámite (puede adjuntar hasta 5 archivos).\n" +
      "• /status — revisar mis pedidos\n" +
      "• /chat — escribir al equipo de Imverica\n" +
      "• /lang — cambiar idioma\n" +
      "• /help — todos los comandos",
    startRequest: "📄 Nueva solicitud",
    chatStaff: "💬 Escribir al equipo",
    myOrders: "📋 Mis pedidos",
    changeLang: "🌐 Idioma",
    askSituation:
      "Cuénteme qué necesita. Una o dos frases bastan — por ejemplo \"Necesito preparar mi paquete I-485 de ajuste de estatus\" o \"Mi arrendador no devolvió el depósito\".",
    askName: "¿Cuál es su nombre completo?",
    askEmail: "Su correo electrónico (enviaremos confirmaciones y el enlace de seguimiento aquí):",
    askPhone: "Teléfono (opcional — /skip para omitir):",
    askFiles:
      "📎 Adjunte hasta 5 documentos (PDF / JPG / PNG / DOCX, cada uno ≤4 MB).\n\n" +
      "Cuando termine — toque *Enviar solicitud*.",
    sendRequest: "✅ Enviar solicitud",
    cancel: "Cancelar",
    skip: "Omitir",
    fileAdded: "Adjuntado: {name} ({size}). Puede enviar más o tocar *Enviar solicitud*.",
    fileTooBig: "El archivo es demasiado grande. Máximo 4 MB.",
    fileWrongType: "Solo aceptamos PDF, JPG, PNG, DOCX. Intente otro archivo.",
    fileLimit: "Límite de 5 archivos alcanzado. Toque *Enviar solicitud*.",
    confirmHeader: "Confirme los datos para enviar:",
    submitting: "Enviando…",
    submitOk:
      "✅ ¡Recibido!\n\nPedido *{id}*\n\nResponderemos a {email} en un día laborable. " +
      "También puede seguirlo en https://imverica.com/mx/account",
    submitFail:
      "Algo salió mal. Inténtelo de nuevo o llame al +1 (916) 399-3992.",
    cancelled: "Cancelado. /start para comenzar de nuevo.",
    invalidEmail: "Ese correo no parece válido. Envíe en formato name@example.com.",
    needLink:
      "Para ver sus pedidos aquí — vincule su email primero: envíe /link y su correo " +
      "(por ejemplo `/link client@example.com`). Le enviaremos un código.",
    sentLinkCode: "Envié un código a {email}. Responda aquí con el código de 6 dígitos.",
    invalidLinkCode: "Ese código no coincide (o expiró). Intente /link de nuevo.",
    linked: "✅ ¡Listo! Su Telegram está vinculado a {email}.",
    noOrders: "Sin pedidos todavía. Toque *Nueva solicitud* para empezar.",
    orderLine: "*{id}* · {status} · {when}",
    chatHeader:
      "💬 Está hablando con el equipo de Imverica. Escriba cualquier mensaje y responderemos aquí.\n\n" +
      "/endchat — cerrar la conversación. /start — volver al menú.",
    chatEnded: "Conversación cerrada. /start para empezar de nuevo.",
    chatFwdToOwner: "📨 (enviado al equipo)",
    helpAll:
      "*Comandos*\n\n" +
      "/start — menú principal\n" +
      "/lang — cambiar idioma\n" +
      "/status o /orders — mis pedidos\n" +
      "/link `<email>` — vincular cuenta\n" +
      "/chat — escribir al equipo\n" +
      "/endchat — cerrar el chat\n" +
      "/cancel — cancelar solicitud actual\n" +
      "/help — mostrar esta lista",
    uplFooter:
      "_Imverica prepara documentos bajo su dirección. No somos un bufete y no damos asesoría legal._",
    unknown: "No entendí. /help muestra lo que puedo hacer."
  }
};

const SUPPORTED = ['en', 'ru', 'uk', 'es'];
function t(lang, key, vars) {
  const dict = T[lang] || T.en;
  let s = dict[key] || T.en[key] || key;
  if (vars) for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
  return s;
}

// Auto-detect language from a Telegram message.
function detectLang(text, tgLangCode) {
  const s = String(text || '');
  if (/[іїєґІЇЄҐ]/.test(s)) return 'uk';
  if (/[а-яА-ЯёЁ]/.test(s)) return 'ru';
  if (/[ñáéíóúü¿¡]/i.test(s)) return 'es';
  if (tgLangCode && tgLangCode.startsWith('ru')) return 'ru';
  if (tgLangCode && tgLangCode.startsWith('uk')) return 'uk';
  if (tgLangCode && tgLangCode.startsWith('es')) return 'es';
  return 'en';
}

// ============================================================
// Telegram Bot API helpers
// ============================================================
function tgUrl(method) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  return TG_API + token + '/' + method;
}

async function tgCall(method, payload) {
  try {
    const r = await fetch(tgUrl(method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.warn('[tg]', method, r.status, txt.slice(0, 200));
    }
    return await r.json().catch(() => null);
  } catch (err) {
    console.error('[tg]', method, err.message || err);
    return null;
  }
}

function sendMessage(chatId, text, opts) {
  return tgCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    ...(opts || {})
  });
}

function languagePicker() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🇺🇸 English', callback_data: 'lang:en' }, { text: '🇷🇺 Русский', callback_data: 'lang:ru' }],
        [{ text: '🇺🇦 Українська', callback_data: 'lang:uk' }, { text: '🇲🇽 Español', callback_data: 'lang:es' }]
      ]
    }
  };
}

function mainMenu(lang) {
  return {
    reply_markup: {
      keyboard: [
        [{ text: t(lang, 'startRequest') }],
        [{ text: t(lang, 'myOrders') }, { text: t(lang, 'chatStaff') }],
        [{ text: t(lang, 'changeLang') }]
      ],
      resize_keyboard: true
    }
  };
}

function filesReplyMarkup(lang) {
  return {
    reply_markup: {
      keyboard: [[{ text: t(lang, 'sendRequest') }, { text: t(lang, 'cancel') }]],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

// Download a file by its Telegram file_id, return Buffer + filename.
async function downloadTelegramFile(fileId) {
  const fInfo = await tgCall('getFile', { file_id: fileId });
  if (!fInfo || !fInfo.ok || !fInfo.result || !fInfo.result.file_path) return null;
  const path = fInfo.result.file_path;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = 'https://api.telegram.org/file/bot' + token + '/' + path;
  const r = await fetch(url);
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const name = path.split('/').pop() || 'attachment';
  return { buffer: buf, filename: name, size: buf.length };
}

// ============================================================
// Session store
// ============================================================
function sessionsStore() { return getStore('imverica-telegram-sessions'); }
async function getSession(chatId) {
  try {
    const rec = await sessionsStore().get('chat/' + chatId + '.json', { type: 'json' });
    return rec || null;
  } catch (e) { return null; }
}
async function saveSession(chatId, session) {
  session.updatedAt = Date.now();
  try { await sessionsStore().setJSON('chat/' + chatId + '.json', session); } catch (e) {}
}
async function clearSession(chatId) {
  try { await sessionsStore().delete('chat/' + chatId + '.json'); } catch (e) {}
}

// ============================================================
// Owner notifications
// ============================================================
function ownerChatId() { return process.env.TELEGRAM_OWNER_CHAT_ID || ''; }
async function notifyOwner(text) {
  const id = ownerChatId();
  if (!id) return;
  await sendMessage(id, text);
}

// ============================================================
// Step handlers
// ============================================================
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function isAllowedFile(name, mime, size) {
  if (size > MAX_FILE_BYTES) return false;
  if (mime && ALLOWED_MIMES.has(String(mime).toLowerCase())) return true;
  const ext = String(name || '').toLowerCase().split('.').pop();
  return ALLOWED_EXT.includes(ext);
}

function isValidEmail(addr) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(addr || ''));
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

async function startIntake(chatId, session, lang) {
  session.step = 'situation';
  session.intake = { name: '', email: '', phone: '', situation: '', files: [] };
  await saveSession(chatId, session);
  await sendMessage(chatId, t(lang, 'askSituation'));
}

async function submitIntake(chatId, session, lang) {
  await sendMessage(chatId, t(lang, 'submitting'));
  const intake = session.intake || {};
  const body = {
    name: intake.name || 'Telegram user',
    email: intake.email,
    phone: intake.phone || '',
    situation: intake.situation || '',
    formCode: '',
    language: lang,
    files: intake.files || []
  };

  let res;
  try {
    const url = (process.env.URL || 'https://imverica.com') + '/.netlify/functions/quick-intake';
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Origin: lets quick-intake's originGuard pass.
        'Origin': process.env.URL || 'https://imverica.com',
        'Referer': (process.env.URL || 'https://imverica.com') + '/'
      },
      body: JSON.stringify(body)
    });
    res = await r.json().catch(() => ({}));
  } catch (err) {
    console.error('[tg-intake]', err);
    await sendMessage(chatId, t(lang, 'submitFail'), mainMenu(lang));
    return;
  }

  if (res && res.ok && res.orderId) {
    session.step = 'idle';
    session.lastOrderId = res.orderId;
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'submitOk', { id: res.orderId, email: intake.email }), mainMenu(lang));
    await notifyOwner(
      `🆕 Intake from Telegram\nOrder: ${res.orderId}\nName: ${intake.name}\nEmail: ${intake.email}\n` +
      `Phone: ${intake.phone || '-'}\nLang: ${lang}\nFiles: ${(intake.files || []).length}\n\n${(intake.situation || '').slice(0, 500)}`
    );
  } else {
    await sendMessage(chatId, t(lang, 'submitFail'), mainMenu(lang));
  }
}

// ============================================================
// Webhook dispatcher
// ============================================================
async function handleUpdate(update) {
  // Inline keyboard callback (language picker).
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    if (!chatId) return;
    const data = String(cb.data || '');
    await tgCall('answerCallbackQuery', { callback_query_id: cb.id });
    if (data.startsWith('lang:')) {
      const lang = data.slice(5);
      if (!SUPPORTED.includes(lang)) return;
      let session = (await getSession(chatId)) || { step: 'idle' };
      session.lang = lang;
      await saveSession(chatId, session);
      await sendMessage(chatId, t(lang, 'pickedLang'));
      await sendMessage(chatId, t(lang, 'menu'), mainMenu(lang));
    }
    return;
  }

  const msg = update.message;
  if (!msg || !msg.chat) return;
  const chatId = msg.chat.id;
  const fromLang = msg.from?.language_code || '';
  let session = (await getSession(chatId)) || { step: 'idle' };
  let lang = session.lang || detectLang(msg.text || msg.caption || '', fromLang);
  if (!session.lang) { session.lang = lang; await saveSession(chatId, session); }
  const dict = T[lang] || T.en;

  const text = (msg.text || '').trim();

  // ----- COMMANDS -----
  if (text.startsWith('/start')) {
    session.step = 'idle';
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'welcome'), languagePicker());
    return;
  }
  if (text.startsWith('/lang')) {
    await sendMessage(chatId, t(lang, 'welcome'), languagePicker());
    return;
  }
  if (text === '/help') {
    await sendMessage(chatId, t(lang, 'helpAll'));
    return;
  }
  if (text === '/cancel') {
    session.step = 'idle';
    session.intake = null;
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'cancelled'), mainMenu(lang));
    return;
  }
  if (text === '/status' || text === '/orders') {
    if (!session.linkedEmail) {
      await sendMessage(chatId, t(lang, 'needLink'));
      return;
    }
    // Orders list is rendered via /api/account?orders=1 with a special
    // bot-token header — that wiring lives in a follow-up commit. For
    // now, just point the user at the cabinet:
    await sendMessage(chatId, `https://imverica.com/${lang === 'ru' ? 'ru/' : lang === 'uk' ? 'ua/' : lang === 'es' ? 'mx/' : ''}account`);
    return;
  }
  if (text === '/chat') {
    session.step = 'chat';
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'chatHeader'));
    return;
  }
  if (text === '/endchat') {
    session.step = 'idle';
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'chatEnded'), mainMenu(lang));
    return;
  }
  if (text === '/skip' && session.step === 'phone') {
    session.intake.phone = '';
    session.step = 'files';
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'askFiles'), filesReplyMarkup(lang));
    return;
  }

  // ----- Reply-keyboard buttons (text-matching, locale-aware) -----
  if (text === t(lang, 'startRequest')) { await startIntake(chatId, session, lang); return; }
  if (text === t(lang, 'changeLang')) { await sendMessage(chatId, t(lang, 'welcome'), languagePicker()); return; }
  if (text === t(lang, 'myOrders')) {
    // Same as /status
    if (!session.linkedEmail) { await sendMessage(chatId, t(lang, 'needLink')); return; }
    await sendMessage(chatId, `https://imverica.com/${lang === 'ru' ? 'ru/' : lang === 'uk' ? 'ua/' : lang === 'es' ? 'mx/' : ''}account`);
    return;
  }
  if (text === t(lang, 'chatStaff')) {
    session.step = 'chat'; await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'chatHeader'));
    return;
  }
  if (text === t(lang, 'sendRequest')) {
    if (!session.intake || !session.intake.email) {
      await sendMessage(chatId, t(lang, 'unknown'));
      return;
    }
    await submitIntake(chatId, session, lang);
    return;
  }
  if (text === t(lang, 'cancel')) {
    session.step = 'idle'; session.intake = null;
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'cancelled'), mainMenu(lang));
    return;
  }

  // ----- Step-driven state machine -----
  if (session.step === 'situation' && text) {
    session.intake.situation = text.slice(0, 4000);
    session.step = 'name';
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'askName'));
    return;
  }
  if (session.step === 'name' && text) {
    session.intake.name = text.slice(0, 120);
    session.step = 'email';
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'askEmail'));
    return;
  }
  if (session.step === 'email' && text) {
    if (!isValidEmail(text)) {
      await sendMessage(chatId, t(lang, 'invalidEmail'));
      return;
    }
    session.intake.email = text.toLowerCase().slice(0, 180);
    session.step = 'phone';
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'askPhone'));
    return;
  }
  if (session.step === 'phone' && text) {
    session.intake.phone = text.slice(0, 40);
    session.step = 'files';
    await saveSession(chatId, session);
    await sendMessage(chatId, t(lang, 'askFiles'), filesReplyMarkup(lang));
    return;
  }
  if (session.step === 'files') {
    // Handle attachments — Telegram sends `document` or `photo` fields.
    const doc = msg.document;
    const photos = msg.photo;
    let file = null;
    if (doc) {
      file = { file_id: doc.file_id, name: doc.file_name || 'document.pdf', mime: doc.mime_type, size: doc.file_size || 0 };
    } else if (photos && photos.length) {
      const biggest = photos[photos.length - 1];
      file = { file_id: biggest.file_id, name: 'photo.jpg', mime: 'image/jpeg', size: biggest.file_size || 0 };
    }
    if (file) {
      if (session.intake.files.length >= 5) { await sendMessage(chatId, t(lang, 'fileLimit')); return; }
      if (!isAllowedFile(file.name, file.mime, file.size)) {
        await sendMessage(chatId, file.size > MAX_FILE_BYTES ? t(lang, 'fileTooBig') : t(lang, 'fileWrongType'));
        return;
      }
      const dl = await downloadTelegramFile(file.file_id);
      if (!dl) { await sendMessage(chatId, t(lang, 'fileWrongType')); return; }
      if (dl.size > MAX_FILE_BYTES) { await sendMessage(chatId, t(lang, 'fileTooBig')); return; }
      session.intake.files.push({
        name: file.name || dl.filename,
        type: file.mime || 'application/pdf',
        dataBase64: dl.buffer.toString('base64')
      });
      await saveSession(chatId, session);
      await sendMessage(chatId, t(lang, 'fileAdded', { name: file.name, size: fmtSize(dl.size) }), filesReplyMarkup(lang));
      return;
    }
    // Any non-attachment text while in 'files' step → treat as request to submit.
    if (text) {
      await sendMessage(chatId, t(lang, 'askFiles'), filesReplyMarkup(lang));
      return;
    }
  }

  // Chat-with-staff pass-through.
  if (session.step === 'chat' && text) {
    await notifyOwner(`💬 From client (chat ${chatId}, ${lang}):\n${text}`);
    await sendMessage(chatId, t(lang, 'chatFwdToOwner'));
    return;
  }

  // Default / unknown.
  await sendMessage(chatId, t(lang, 'unknown'));
}

// ============================================================
// HTTP handler
// ============================================================
exports.handler = async function (event) {
  ensureBlobs(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { statusCode: 503, body: 'Bot not configured (TELEGRAM_BOT_TOKEN missing)' };
  }

  // Optional secret-token verification — Telegram echoes X-Telegram-Bot-
  // Api-Secret-Token when you set one during setWebhook. We DON'T have an
  // originGuard here because the request comes from Telegram, not the
  // browser. Instead, the secret token verifies it really is Telegram.
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  if (expectedSecret) {
    const headerSecret =
      event.headers['x-telegram-bot-api-secret-token'] ||
      event.headers['X-Telegram-Bot-Api-Secret-Token'] || '';
    if (headerSecret !== expectedSecret) return { statusCode: 401, body: 'Bad secret' };
  }

  let update;
  try { update = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Bad JSON' }; }

  // Must AWAIT — Netlify Lambda freezes the container immediately after the
  // handler returns, killing any in-flight promises. Telegram tolerates up
  // to 60s of webhook latency, and our sendMessage calls finish in <1s, so
  // awaiting here is safe.
  try {
    await handleUpdate(update);
  } catch (err) {
    console.error('[tg-update]', err && (err.stack || err.message || err));
  }

  return ok();
};
