'use strict';
/**
 * QA — client acknowledgment email (lib/intake-ack.js).
 *
 *   1. detectAckLanguage: language of the SITUATION text wins; UI tag is
 *      only the fallback for short/ambiguous text. Mixed-script messages
 *      (Cyrillic narrative + Latin form codes) must still resolve right.
 *   2. ackCopy: all four languages render subject/text/html with the
 *      order id and first name; UPL disclaimer present; no HTML injection.
 *
 * Run: node scripts/qa-intake-ack.js
 */

const { detectAckLanguage, ackCopy } = require('../netlify/functions/lib/intake-ack');

let pass = 0;
let fail = 0;
function check(label, got, want) {
  const ok = got === want;
  if (ok) { pass++; } else { fail++; console.error(`FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
function assert(label, cond) {
  if (cond) { pass++; } else { fail++; console.error(`FAIL ${label}`); }
}

// --- 1. Language detection -------------------------------------------------

// Plain English (the real Anastasiia lead — UI en, wrote en).
check('en plain', detectAckLanguage(
  'I am a Ukrainian who came to the U.S. through Uniting for Ukraine (U4U). My humanitarian parole expires in February 2027, and I would like someone to prepare and file my re-parole application for me.',
  'en'
), 'en');

// Ukrainian speaker writing UKRAINIAN from the ENGLISH homepage → uk wins over UI tag.
check('uk over en UI', detectAckLanguage(
  'Доброго дня! Я приїхала за програмою U4U, мій гуманітарний пароль закінчується у лютому. Потрібна допомога з заявою на продовження.',
  'en'
), 'uk');

// Russian from the English homepage.
check('ru over en UI', detectAckLanguage(
  'Здравствуйте! Мне нужна помощь с формой I-485 и разрешением на работу. Подскажите, сколько это будет стоить?',
  'en'
), 'ru');

// Mixed: Cyrillic narrative with Latin form codes still detects Cyrillic.
check('ru mixed with form codes', detectAckLanguage(
  'Нужно заполнить I-765 work permit и I-131 advance parole, категория (c)(11).',
  'en'
), 'ru');

// English message quoting one Cyrillic name stays English.
check('en with cyrillic name', detectAckLanguage(
  'My name is Дмитрий and I need help with my green card application for my wife.',
  'en'
), 'en');

// Ukrainian vs Russian split on exclusive letters.
check('uk exclusive letters', detectAckLanguage('Мені потрібна допомога з імміграційними документами', 'ru'), 'uk');
check('ru exclusive letters', detectAckLanguage('Мне нужны документы, это очень срочно', 'uk'), 'ru');

// Ambiguous Cyrillic (no exclusive letters either way) → UI tag decides ru/uk.
check('ambiguous cyrillic + uk UI', detectAckLanguage('Допомога по справах', 'uk'), 'uk');
check('ambiguous cyrillic + ru UI', detectAckLanguage('Помогите по деламива', 'ru'), 'ru');

// Spanish from the English homepage.
check('es over en UI', detectAckLanguage(
  'Hola, necesito ayuda con mi solicitud de residencia. Mi esposo es ciudadano y queremos saber el precio, por favor. Gracias.',
  'en'
), 'es');

// Short/ambiguous text → falls back to the UI tag.
check('short text falls back es', detectAckLanguage('Ayuda', 'es'), 'es');
check('short text falls back en', detectAckLanguage('Help', 'en'), 'en');
check('empty falls back ru', detectAckLanguage('', 'ru'), 'ru');
check('bad UI tag → en', detectAckLanguage('', 'de'), 'en');
check('missing UI tag → en', detectAckLanguage('ok', undefined), 'en');

// --- 2. Copy rendering -----------------------------------------------------

const ORDER = 'IMVERICA-20260714-25';
const MUST_CONTAIN = {
  en: ['Hello Anastasiia,', 'not a law firm', 'within one business day'],
  ru: ['Здравствуйте, Anastasiia!', 'не является юридической фирмой', 'рабочего дня'],
  uk: ['Вітаємо, Anastasiia!', 'не є юридичною фірмою', 'робочого дня'],
  es: ['Hola, Anastasiia:', 'no es un bufete', 'un día hábil']
};

for (const lang of ['en', 'ru', 'uk', 'es']) {
  const { subject, text, html } = ackCopy(lang, { name: 'Anastasiia Bila', orderId: ORDER });
  assert(`${lang} subject has order id`, subject.includes(ORDER));
  assert(`${lang} text has order id`, text.includes(ORDER));
  assert(`${lang} html has order id`, html.includes(ORDER));
  assert(`${lang} text has phone`, text.includes('+1 (916) 399-3992'));
  assert(`${lang} signed by Fa Koch`, text.includes('Fa Koch') && html.includes('Fa Koch'));
  assert(`${lang} sig title UPL-safe`, text.includes('Client Care · Imverica Legal Solutions') && !/attorney|lawyer/i.test('Fa Koch Client Care'));
  for (const needle of MUST_CONTAIN[lang]) {
    assert(`${lang} contains ${JSON.stringify(needle)}`, text.includes(needle) || html.includes(needle));
  }
}

// Unknown language falls back to English copy.
assert('unknown lang → en copy', ackCopy('de', { name: 'X Y', orderId: ORDER }).text.includes('Hello X,'));

// No-name greeting stays grammatical (no dangling space).
assert('no-name greeting en', ackCopy('en', { name: '', orderId: ORDER }).text.startsWith('Hello,'));

// HTML injection in the name is escaped in the html body.
const evil = ackCopy('en', { name: '<img src=x onerror=alert(1)>', orderId: ORDER }).html;
assert('html escapes name', !evil.includes('<img') && evil.includes('&lt;img'));

// --- 3. Reply styling: "Re:" subject + the client's own request quoted ---

const SITUATION = 'I need help with my re-parole application.\nMy parole expires in February 2027.';
const reply = ackCopy('en', {
  name: 'Anastasiia Bila',
  orderId: ORDER,
  situation: SITUATION,
  createdAt: '2026-07-14T18:40:00.000Z' // 11:40 AM PT
});
assert('en subject starts with Re:', reply.subject.startsWith('Re: '));
assert('subject has short order id', reply.subject.includes(ORDER));
assert('text quotes each line with >', reply.text.includes('> I need help with my re-parole application.')
  && reply.text.includes('> My parole expires in February 2027.'));
assert('text has "you wrote" + PT date', reply.text.includes('On July 14, 2026, you wrote:'));
assert('signoff before signature', reply.text.indexOf('Best regards,') < reply.text.indexOf('Fa Koch'));
assert('html has blockquote with request', reply.html.includes('<blockquote') && reply.html.includes('re-parole application.'));

// Bad/missing date → label without date; no quote block when situation empty.
assert('no date → plain "You wrote:"', ackCopy('en', { name: 'A B', orderId: ORDER, situation: 'Help me' }).text.includes('You wrote:'));
const noSituation = ackCopy('en', { name: 'A B', orderId: ORDER, situation: '', createdAt: Date.now() });
assert('empty situation → no quote block', !noSituation.text.includes('>') && !noSituation.html.includes('<blockquote'));

// HTML in the quoted request is escaped.
const evilQuote = ackCopy('en', { name: 'A B', orderId: ORDER, situation: '<script>alert(1)</script>' }).html;
assert('html escapes quoted request', !evilQuote.includes('<script>') && evilQuote.includes('&lt;script&gt;'));

// numeric createdAt (quick-intake uses Date.now()) works too.
assert('numeric createdAt ok', ackCopy('en', { name: 'A B', orderId: ORDER, situation: 'x', createdAt: 1784054400000 }).text.includes('you wrote:'));

// --- 4. Appointment block: requested time always, Zoom only for video ---

const APPT_VIDEO = { type: 'video', typeLabel: 'Video meeting · 30 minutes', date: '2026-07-21', time: '2:00 PM', durationMin: 30 };
const vid = ackCopy('en', { name: 'Farruh K', orderId: ORDER, situation: 'testвывы', appointment: APPT_VIDEO });
assert('video: meeting line with plain date', vid.text.includes('Video meeting · 30 minutes — July 21, 2026 at 2:00 PM (Pacific Time)'));
assert('video: confirm-by-email line', vid.text.includes('We will confirm this time by email.'));
assert('video: zoom url in text', vid.text.includes('https://us05web.zoom.us/j/7315124254'));
assert('video: meeting id + passcode', vid.text.includes('731 512 4254') && vid.text.includes('zW7m6n'));
assert('video: html has zoom link', vid.html.includes('Join Zoom Meeting') && vid.html.includes('us05web.zoom.us'));

const phoneAppt = ackCopy('en', { name: 'Farruh K', orderId: ORDER, situation: 'x', appointment: { ...APPT_VIDEO, type: 'phone', typeLabel: 'Phone call · 20 minutes' } });
assert('phone: meeting line present', phoneAppt.text.includes('Phone call · 20 minutes — July 21, 2026'));
assert('phone: NO zoom', !phoneAppt.text.includes('zoom.us') && !phoneAppt.html.includes('zoom.us'));

const noAppt = ackCopy('en', { name: 'A B', orderId: ORDER, situation: 'regular intake, no meeting' });
assert('no appointment → no zoom, no meeting line', !noAppt.text.includes('zoom.us') && !noAppt.text.includes('requested meeting'));

// Date string must not drift a day (the classic UTC-midnight bug).
assert('date has no tz drift', vid.text.includes('July 21, 2026') && !vid.text.includes('July 20, 2026'));

console.log(`\nqa-intake-ack: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
