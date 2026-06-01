/**
 * One-shot helper for wiring up the Telegram bot.
 *
 * After the owner adds TELEGRAM_BOT_TOKEN to Netlify env and deploys,
 * call this endpoint ONCE (with the admin token) to:
 *   1. Tell Telegram to push every bot update to our webhook URL.
 *   2. Set the bot's command list (so users see / autocomplete in the
 *      Telegram client when they type "/" ).
 *   3. Optionally set the bot's description / about / commands per
 *      language.
 *
 * Usage:
 *   curl -X POST https://imverica.com/.netlify/functions/telegram-setup \
 *        -H "Authorization: Bearer $INTAKE_ADMIN_TOKEN" \
 *        -H "X-Admin-TOTP: 123456"
 *
 * Returns JSON with each Telegram API call's response so the operator
 * can see whether setWebhook succeeded.
 */

const { isAdmin } = require('./lib/admin-auth');

const TG_API = 'https://api.telegram.org/bot';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-TOTP'
};

const COMMANDS_BY_LANG = {
  en: [
    { command: 'start',   description: 'Open the main menu' },
    { command: 'status',  description: 'Check my orders' },
    { command: 'orders',  description: 'List my orders' },
    { command: 'chat',    description: 'Message Imverica staff' },
    { command: 'endchat', description: 'Close the staff chat' },
    { command: 'link',    description: 'Link my email to see orders' },
    { command: 'lang',    description: 'Change language' },
    { command: 'cancel',  description: 'Cancel current request' },
    { command: 'help',    description: 'Show all commands' }
  ],
  ru: [
    { command: 'start',   description: 'Главное меню' },
    { command: 'status',  description: 'Проверить мои заказы' },
    { command: 'orders',  description: 'Список моих заказов' },
    { command: 'chat',    description: 'Написать сотруднику Imverica' },
    { command: 'endchat', description: 'Закрыть чат с сотрудником' },
    { command: 'link',    description: 'Привязать email чтобы видеть заказы' },
    { command: 'lang',    description: 'Сменить язык' },
    { command: 'cancel',  description: 'Отменить текущую заявку' },
    { command: 'help',    description: 'Список команд' }
  ],
  uk: [
    { command: 'start',   description: 'Головне меню' },
    { command: 'status',  description: 'Перевірити мої замовлення' },
    { command: 'orders',  description: 'Список моїх замовлень' },
    { command: 'chat',    description: 'Написати співробітнику' },
    { command: 'endchat', description: 'Закрити чат' },
    { command: 'link',    description: "Прив'язати email" },
    { command: 'lang',    description: 'Змінити мову' },
    { command: 'cancel',  description: 'Скасувати заявку' },
    { command: 'help',    description: 'Список команд' }
  ],
  es: [
    { command: 'start',   description: 'Menú principal' },
    { command: 'status',  description: 'Revisar mis pedidos' },
    { command: 'orders',  description: 'Lista de pedidos' },
    { command: 'chat',    description: 'Escribir al equipo' },
    { command: 'endchat', description: 'Cerrar el chat' },
    { command: 'link',    description: 'Vincular email' },
    { command: 'lang',    description: 'Cambiar idioma' },
    { command: 'cancel',  description: 'Cancelar solicitud' },
    { command: 'help',    description: 'Mostrar comandos' }
  ]
};

async function tg(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const r = await fetch(TG_API + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: false, raw: text }; }
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' };
  if (!isAdmin(event)) return { statusCode: 401, headers: CORS, body: 'Not admin' };
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { statusCode: 503, headers: CORS, body: 'TELEGRAM_BOT_TOKEN env var not set' };
  }

  const webhookUrl = (process.env.URL || 'https://imverica.com') + '/.netlify/functions/telegram-webhook';
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

  const results = {};

  results.setWebhook = await tg('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
    ...(secret ? { secret_token: secret } : {})
  });

  // Set per-language commands so the / button shows the right names.
  for (const lang of Object.keys(COMMANDS_BY_LANG)) {
    results['setMyCommands:' + lang] = await tg('setMyCommands', {
      commands: COMMANDS_BY_LANG[lang],
      language_code: lang === 'en' ? undefined : lang
    });
  }

  results.getMe = await tg('getMe');
  results.getWebhookInfo = await tg('getWebhookInfo');

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, webhookUrl, results }, null, 2)
  };
};
