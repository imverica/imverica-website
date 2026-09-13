#!/usr/bin/env node
/**
 * QA: Telegram staff-chat relay.
 *
 * Guards what an operator needs from a forwarded lead: knowing who wrote,
 * getting the documents they sent, and being able to answer — with a file
 * of their own — without leaving Telegram.
 */
const assert = require('assert');
const Module = require('module');

// ---- Stub @netlify/blobs (not installed in this checkout) ----
const store = new Map();
const blobsStub = {
  getStore: () => ({
    async get(key, opts) {
      const raw = store.get(key);
      if (raw === undefined) return null;
      return opts && opts.type === 'json' ? JSON.parse(raw) : raw;
    },
    async setJSON(key, value) { store.set(key, JSON.stringify(value)); },
    async delete(key) { store.delete(key); }
  })
};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === '@netlify/blobs') return '@netlify/blobs';
  return origResolve.call(this, request, ...rest);
};
require.cache['@netlify/blobs'] = {
  id: '@netlify/blobs', filename: '@netlify/blobs', loaded: true, exports: blobsStub
};

// ---- Stub the Telegram API ----
const calls = [];
let nextMessageId = 1000;
global.fetch = async (url, init) => {
  const method = String(url).split('/').pop();
  calls.push({ method, payload: JSON.parse(init.body) });
  return {
    ok: true,
    async json() { return { ok: true, result: { message_id: ++nextMessageId } }; },
    async text() { return ''; }
  };
};

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_OWNER_CHAT_ID = '999';

const bot = require('../netlify/functions/telegram-webhook.js');

const OWNER = '999';
const CLIENT = 5387562716;
const to = (kind, chatId) => calls.filter((c) => c.method === kind && String(c.payload.chat_id) === String(chatId));
const sent = (chatId) => to('sendMessage', chatId);
const copied = (chatId) => to('copyMessage', chatId);
const routes = () => [...store.keys()].filter((k) => k.startsWith('owner-reply/'));
const routeIds = () => routes().map((k) => Number(k.slice('owner-reply/'.length, -'.json'.length)));

const fromClient = { id: CLIENT, first_name: 'Иван', last_name: 'Петров', username: 'ivan_p', language_code: 'ru' };
const ownerMsg = (extra) => ({ message: { message_id: 90, chat: { id: Number(OWNER) }, from: { id: Number(OWNER) }, ...extra } });

(async () => {
  // --- attachment descriptions ---
  assert.strictEqual(bot._describeAttachment({ text: 'hi' }), '', 'plain text has no attachment line');
  assert.ok(bot._describeAttachment({ document: { file_name: 'passport.pdf' } }).includes('passport.pdf'), 'document named');
  assert.strictEqual(bot._describeAttachment({ document: {} }), '📎 Файл', 'nameless document still described');
  assert.ok(bot._describeAttachment({ photo: [{ file_id: 'a' }] }).includes('Фото'), 'photo described');
  assert.ok(bot._describeAttachment({ voice: { duration: 12 } }).includes('Голосовое'), 'voice note described');

  // --- text still reaches the operator with an identity block (regression) ---
  store.set('chat/' + CLIENT + '.json', JSON.stringify({ step: 'chat', lang: 'ru' }));
  await bot._handleUpdate({ message: { message_id: 1, chat: { id: CLIENT }, from: fromClient, text: 'Сколько стоит мандамус' } });
  const textHeader = sent(OWNER).pop();
  assert.ok(textHeader.payload.text.includes('Иван Петров'), 'relay names the client');
  assert.ok(textHeader.payload.text.includes('@ivan_p'), 'relay carries the @username');
  assert.ok(textHeader.payload.text.includes('мандамус'), 'relay carries the message');
  assert.strictEqual(textHeader.payload.parse_mode, undefined, 'relay is plain text');

  // --- a document reaches the operator, described AND copied ---
  calls.length = 0;
  await bot._handleUpdate({
    message: {
      message_id: 10,
      chat: { id: CLIENT },
      from: fromClient,
      document: { file_id: 'doc-1', file_name: 'notice.pdf', file_size: 120000 },
      caption: 'Вот отказ из USCIS'
    }
  });
  const fileHeader = sent(OWNER).pop();
  assert.ok(fileHeader.payload.text.includes('notice.pdf'), 'operator is told which file arrived');
  assert.ok(fileHeader.payload.text.includes('Вот отказ'), 'the caption is relayed');
  assert.ok(fileHeader.payload.text.includes('@ivan_p'), 'a file still names the client');
  const fileCopy = copied(OWNER).pop();
  assert.ok(fileCopy, 'the file itself is copied to the operator');
  assert.strictEqual(String(fileCopy.payload.from_chat_id), String(CLIENT), 'copied out of the client chat');
  assert.strictEqual(fileCopy.payload.message_id, 10, 'copies the message carrying the file');
  assert.ok(sent(CLIENT).some((c) => c.payload.text.includes('передано')), 'client is told it went through');
  assert.ok(routes().length >= 2, 'both the header and the copy are answerable by Reply');

  // --- an album repeats the identity block only once ---
  calls.length = 0;
  const album = (messageId) => ({
    message: {
      message_id: messageId, chat: { id: CLIENT }, from: fromClient,
      media_group_id: '777', photo: [{ file_id: 'p' + messageId }]
    }
  });
  await bot._handleUpdate(album(20));
  await bot._handleUpdate(album(21));
  assert.strictEqual(sent(OWNER).filter((c) => c.payload.text.includes('Сообщение клиента')).length, 1,
    'one identity block per album');
  assert.strictEqual(copied(OWNER).length, 2, 'every photo of the album still reaches the operator');

  // --- operator sends a file back ---
  const route = Math.max(...routeIds());
  calls.length = 0;
  await bot._handleUpdate(ownerMsg({
    reply_to_message: { message_id: route, from: { is_bot: true } },
    document: { file_id: 'form-1', file_name: 'I-485-draft.pdf' }
  }));
  const toClient = copied(CLIENT).pop();
  assert.ok(toClient, 'operator can send a file to the client');
  assert.strictEqual(String(toClient.payload.from_chat_id), String(OWNER), 'copied out of the owner chat');
  assert.ok(sent(CLIENT).some((c) => c.payload.text.includes('прислала вам файл')),
    'an uncaptioned file is announced in the client language');
  assert.ok(sent(OWNER).some((c) => c.payload.text.includes('✅ Ответ отправлен')), 'operator gets a receipt');

  // a captioned file speaks for itself
  calls.length = 0;
  await bot._handleUpdate(ownerMsg({
    reply_to_message: { message_id: route, from: { is_bot: true } },
    document: { file_id: 'form-2', file_name: 'I-485-final.pdf' },
    caption: 'Подпишите и верните'
  }));
  assert.strictEqual(copied(CLIENT).length, 1, 'the captioned file is delivered');
  assert.ok(!sent(CLIENT).some((c) => c.payload.text.includes('прислала вам файл')),
    'no redundant announcement when the file carries a caption');

  // --- plain text replies keep working ---
  calls.length = 0;
  await bot._handleUpdate(ownerMsg({
    reply_to_message: { message_id: route, from: { is_bot: true } },
    text: 'Мандамус — от $1500.'
  }));
  const answer = sent(CLIENT).pop();
  assert.ok(answer.payload.text.includes('Ответ Imverica'), 'answer is labelled in the client language');
  assert.ok(answer.payload.text.includes('$1500'), 'answer carries the operator text');

  // --- /reply cannot carry a file, and says so ---
  calls.length = 0;
  await bot._handleUpdate(ownerMsg({
    document: { file_id: 'form-3', file_name: 'x.pdf' },
    caption: '/reply ' + CLIENT + ' смотрите вложение'
  }));
  assert.ok(sent(CLIENT).some((c) => c.payload.text.includes('смотрите вложение')), '/reply delivers the caption text');
  assert.strictEqual(copied(CLIENT).length, 0, '/reply does not copy the file (its caption is the command)');
  assert.ok(sent(OWNER).some((c) => c.payload.text.includes('Файл НЕ отправлен')), 'operator is warned about it');

  console.log('✅ qa:telegram-relay — all checks passed');
})().catch((err) => {
  console.error('❌ qa:telegram-relay —', err.message);
  process.exit(1);
});
