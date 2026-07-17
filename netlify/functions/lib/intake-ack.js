'use strict';
/**
 * Client acknowledgment email — "we received your request, we'll be in
 * touch shortly" — sent to the CLIENT right after an intake submission
 * (quick-intake and the guided wizard). The owner-notification emails
 * live in the endpoints themselves; this module only talks to the client.
 *
 * Owner decision 2026-07-14: the ack is ALWAYS sent in ENGLISH — official
 * correspondence of a California business — regardless of the language the
 * client wrote in. The email is styled like a human reply: subject starts
 * with "Re:" and the client's own message is quoted at the bottom the way
 * mail clients quote the original. The ru/uk/es copy and the language
 * detector below are kept intact so flipping back to localized acks is a
 * one-line change in sendClientAck.
 *
 * Fire-and-forget contract: never throws, never blocks a submission.
 * Skips cleanly when RESEND_API_KEY is unset (dev) or the email is bad.
 */

const FROM_EMAIL = process.env.OTP_FROM_EMAIL || 'Imverica Legal Solutions <info@imverica.com>';
const REPLY_TO = 'info@imverica.com';
const PHONE = '+1 (916) 399-3992';
const SITE = 'https://imverica.com';

// Owner's permanent Zoom room (2026-07-17) — included in the ack for VIDEO
// appointment requests and in the owner's calendar event. Env-overridable
// so rotating the room/passcode is a Netlify env change, not a deploy.
const ZOOM_MEETING = {
  url: process.env.ZOOM_MEETING_URL || 'https://us05web.zoom.us/j/7315124254?pwd=6hwjCnwC0JNgObFvaNvI0bgmtwSZmK.1',
  id: process.env.ZOOM_MEETING_ID || '731 512 4254',
  passcode: process.env.ZOOM_PASSCODE || 'zW7m6n'
};

// Personal signature (owner request 2026-07-14): the ack reads like a reply
// from a real person, not a robot. Title deliberately UPL-safe — never
// "attorney"/"lawyer"/"legal advisor"; Imverica is a registered LDA.
const SIGN_NAME = 'Fa Koch';
const SIGN_TITLE = 'Client Care · Imverica Legal Solutions';
const SIGN_EMAIL = 'info@imverica.com';

const SUPPORTED = ['en', 'ru', 'uk', 'es'];

// Spanish vs English separation for Latin-script text. Only distinctive
// stopwords — shared/ambiguous ones ("a", "no", "me") are useless signals.
const ES_WORDS = /\b(que|para|por|favor|gracias|hola|usted|ustedes|tengo|necesito|ayuda|soy|estoy|quiero|trabajo|permiso|formulario|migración|inmigración|abogado|señor|señora|años|buenos|días|una|los|las|del|con|como|más|esposo|esposa|hijo|hija|solicitud|residencia|ciudadanía|corte|caso|papeles|cita|donde|cuando|cuanto|puedo|hacer|miércoles)\b/gi;
const EN_WORDS = /\b(the|and|is|are|was|were|have|has|need|help|with|for|please|would|like|can|you|my|our|from|about|application|form|case|court|work|permit|green|card|status|apply|file|documents|appointment|thank|thanks|hello|husband|wife|son|daughter)\b/gi;

/**
 * Detect the language the client wrote in. `fallback` is the UI language
 * tag captured by the form ('en'|'ru'|'uk'|'es', anything else → 'en').
 */
function detectAckLanguage(text, fallback) {
  const fb = SUPPORTED.includes(String(fallback || '').toLowerCase())
    ? String(fallback).toLowerCase()
    : 'en';
  const s = String(text || '');
  if (!s.trim()) return fb;

  const cyr = (s.match(/[Ѐ-ӿ]/g) || []).length;
  const lat = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;

  // Cyrillic narrative → Russian or Ukrainian, split on exclusive letters.
  // Mixed messages ("нужно заполнить I-765 work permit") can carry MORE
  // Latin than Cyrillic once form codes pile up, so substantial Cyrillic
  // (≥15 letters and ≥40% of the Latin count) wins even when outnumbered —
  // while an English message quoting one Cyrillic name stays English.
  if (cyr > 0 && (cyr >= lat || (cyr >= 15 && cyr >= lat * 0.4))) {
    const uk = (s.match(/[ІіЇїЄєҐґ]/g) || []).length; // І і Ї ї Є є Ґ ґ
    const ru = (s.match(/[ЫыЭэЁёЪъ]/g) || []).length; // Ы ы Э э Ё ё Ъ ъ
    if (uk > ru) return 'uk';
    if (ru > uk) return 'ru';
    return fb === 'uk' ? 'uk' : 'ru';
  }

  // Latin script → Spanish vs English by distinctive stopwords; ñ/¿/¡ are
  // near-certain Spanish so they weigh extra.
  const esStrong = (s.match(/[ñÑ¿¡]/g) || []).length * 2;
  const esScore = (s.match(ES_WORDS) || []).length + esStrong;
  const enScore = (s.match(EN_WORDS) || []).length;
  if (esScore >= 3 && esScore > enScore) return 'es';
  if (enScore >= 3 && enScore > esScore) return 'en';
  return fb;
}

// Legal footers reuse the site-footer wording (astro-site/src/data/i18n.ts)
// trimmed to the three load-bearing sentences — never claim attorney
// involvement, never promise legal advice.
const COPY = {
  en: {
    subject: (id) => `Re: Your request to Imverica (${id})`,
    greeting: (n) => (n ? `Hello ${n},` : 'Hello,'),
    received: 'Thank you for contacting Imverica Legal Solutions. Your request has been received, and our team will get back to you shortly — usually within one business day.',
    orderLabel: 'Your request number',
    addMore: `Want to add details or documents? Simply reply to this email or call ${PHONE}.`,
    signoff: 'Best regards,',
    youWrote: (date) => (date ? `On ${date}, you wrote:` : 'You wrote:'),
    disclaimer: 'Imverica is not a law firm and is not a substitute for an attorney. We do not provide legal advice. Documents are prepared solely at the client’s direction.'
  },
  ru: {
    subject: (id) => `Imverica — мы получили ваш запрос (${id})`,
    greeting: (n) => (n ? `Здравствуйте, ${n}!` : 'Здравствуйте!'),
    received: 'Спасибо, что обратились в Imverica Legal Solutions. Ваш запрос получен — мы свяжемся с вами в ближайшее время, обычно в течение одного рабочего дня.',
    orderLabel: 'Номер вашего запроса',
    addMore: `Хотите что-то добавить или приложить документы? Просто ответьте на это письмо или позвоните ${PHONE}.`,
    signoff: 'С уважением,',
    youWrote: (date) => (date ? `${date} вы написали:` : 'Вы написали:'),
    disclaimer: 'Imverica не является юридической фирмой и не заменяет адвоката. Мы не предоставляем юридических консультаций. Документы готовятся исключительно по поручению клиента.'
  },
  uk: {
    subject: (id) => `Imverica — ми отримали ваш запит (${id})`,
    greeting: (n) => (n ? `Вітаємо, ${n}!` : 'Вітаємо!'),
    received: 'Дякуємо, що звернулися до Imverica Legal Solutions. Ваш запит отримано — ми зв’яжемося з вами найближчим часом, зазвичай протягом одного робочого дня.',
    orderLabel: 'Номер вашого запиту',
    addMore: `Хочете щось додати чи прикласти документи? Просто дайте відповідь на цей лист або зателефонуйте ${PHONE}.`,
    signoff: 'З повагою,',
    youWrote: (date) => (date ? `${date} ви написали:` : 'Ви написали:'),
    disclaimer: 'Imverica не є юридичною фірмою і не замінює адвоката. Ми не надаємо юридичних консультацій. Документи готуються виключно за дорученням клієнта.'
  },
  es: {
    subject: (id) => `Imverica — recibimos su solicitud (${id})`,
    greeting: (n) => (n ? `Hola, ${n}:` : 'Hola:'),
    received: 'Gracias por contactar a Imverica Legal Solutions. Hemos recibido su solicitud y nuestro equipo se pondrá en contacto con usted en breve, normalmente dentro de un día hábil.',
    orderLabel: 'Número de su solicitud',
    addMore: `¿Desea agregar algo o adjuntar documentos? Simplemente responda a este correo o llame al ${PHONE}.`,
    signoff: 'Atentamente,',
    youWrote: (date) => (date ? `El ${date}, usted escribió:` : 'Usted escribió:'),
    disclaimer: 'Imverica no es un bufete de abogados ni un sustituto de un abogado. No brindamos asesoría legal. Los documentos se preparan únicamente bajo la dirección del cliente.'
  }
};

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** "July 14, 2026" in Pacific time; empty string when the date is bad. */
function ptLongDate(createdAt) {
  const d = new Date(createdAt || NaN);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'long', day: 'numeric' });
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "2026-07-21" → "July 21, 2026" — pure string math, no timezone drift. */
function plainDate(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(ymd || '');
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/**
 * Meeting-details lines for an appointment ack (English — the ack language).
 * Video meetings get the Zoom room; the time stays "requested" until the
 * owner's confirmation email, and the copy says so.
 */
function appointmentLines(a) {
  if (!a || !a.date || !a.time) return [];
  const lines = [
    `Your requested meeting: ${a.typeLabel || 'appointment'} — ${plainDate(a.date)} at ${a.time} (Pacific Time).`,
    'We will confirm this time by email.'
  ];
  if (String(a.type || '').toLowerCase() === 'video') {
    lines.push(
      '',
      `Join Zoom Meeting: ${ZOOM_MEETING.url}`,
      `Meeting ID: ${ZOOM_MEETING.id} · Passcode: ${ZOOM_MEETING.passcode}`
    );
  }
  return lines;
}

/** Build { subject, text, html } for one language. Exported for QA. */
function ackCopy(lang, { name, orderId, situation, createdAt, appointment }) {
  const t = COPY[lang] || COPY.en;
  const firstName = String(name || '').trim().split(/\s+/)[0] || '';
  const subject = t.subject(orderId);
  const quoted = String(situation || '').trim();
  const wroteLine = quoted ? t.youWrote(ptLongDate(createdAt)) : '';
  const apptLines = appointmentLines(appointment);

  const text = [
    t.greeting(firstName),
    '',
    t.received,
    '',
    `${t.orderLabel}: ${orderId}`,
    '',
    ...(apptLines.length ? [...apptLines, ''] : []),
    t.addMore,
    '',
    t.signoff,
    '',
    SIGN_NAME,
    SIGN_TITLE,
    `${PHONE} · ${SIGN_EMAIL}`,
    SITE,
    '',
    t.disclaimer,
    ...(quoted ? [
      '',
      wroteLine,
      ...quoted.split('\n').map((line) => `> ${line}`)
    ] : [])
  ].join('\n');

  const quoteHtml = quoted ? `
    <p style="margin:20px 0 6px;font-size:13px;color:#6b7280;">${escHtml(wroteLine)}</p>
    <blockquote style="margin:0;padding:8px 14px;border-left:3px solid #d6d9df;color:#4b5563;font-size:13px;white-space:pre-wrap;">${escHtml(quoted)}</blockquote>` : '';

  const a = appointment;
  const isVideo = a && String(a.type || '').toLowerCase() === 'video';
  const apptHtml = apptLines.length ? `
    <div style="margin:0 0 14px;background:#f5f7fa;border-radius:6px;padding:12px 14px;">
      <p style="margin:0 0 4px;"><strong>${escHtml(a.typeLabel || 'Appointment')}</strong> — ${escHtml(plainDate(a.date))} at ${escHtml(a.time)} (Pacific Time)</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">We will confirm this time by email.</p>${isVideo ? `
      <p style="margin:10px 0 0;"><a href="${ZOOM_MEETING.url}" style="color:#0f1c2f;font-weight:600;">Join Zoom Meeting</a><br/>
      <span style="font-size:13px;color:#4b5563;">Meeting ID: ${escHtml(ZOOM_MEETING.id)} · Passcode: ${escHtml(ZOOM_MEETING.passcode)}</span></p>` : ''}
    </div>` : '';

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#1c2c40;max-width:560px;">
    <p style="margin:0 0 12px;">${escHtml(t.greeting(firstName))}</p>
    <p style="margin:0 0 12px;">${escHtml(t.received)}</p>
    <p style="margin:0 0 12px;background:#f5f7fa;border-radius:6px;padding:10px 14px;"><strong>${escHtml(t.orderLabel)}:</strong> ${escHtml(orderId)}</p>${apptHtml}
    <p style="margin:0 0 16px;">${escHtml(t.addMore)}</p>
    <p style="margin:0 0 14px;">${escHtml(t.signoff)}</p>
    <div style="border-left:3px solid #c9a227;padding-left:14px;margin:0 0 18px;">
      <p style="margin:0;font-size:15px;font-weight:600;color:#0f1c2f;">${escHtml(SIGN_NAME)}</p>
      <p style="margin:2px 0 6px;font-size:13px;color:#6b7280;">${escHtml(SIGN_TITLE)}</p>
      <p style="margin:0;font-size:13px;">${escHtml(PHONE)} · <a href="mailto:${SIGN_EMAIL}" style="color:#0f1c2f;">${SIGN_EMAIL}</a> · <a href="${SITE}" style="color:#0f1c2f;">imverica.com</a></p>
    </div>
    <p style="margin:0;font-size:12px;color:#6b7280;">${escHtml(t.disclaimer)}</p>${quoteHtml}
  </div>`;

  return { subject, text, html };
}

/**
 * Send the acknowledgment to the client. Best-effort: resolves to a status
 * object, never throws. `record` needs contact.{name,email}, id, situation,
 * language — both intake endpoints already build exactly that shape.
 */
async function sendClientAck(record) {
  const key = process.env.RESEND_API_KEY;
  const c = (record && record.contact) || {};
  if (!key) {
    console.log('[intake-ack] no RESEND_API_KEY — skipping client ack', record && record.id);
    return { sent: false, dev: true };
  }
  if (!c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
    return { sent: false, error: 'no-email' };
  }
  // Always English (owner decision 2026-07-14). To go back to localized
  // acks: const lang = detectAckLanguage(record.situation, record.language);
  const lang = 'en';
  const { subject, text, html } = ackCopy(lang, {
    name: c.name,
    orderId: record.id,
    situation: record.situation,
    createdAt: record.createdAt,
    appointment: record.appointment || null
  });
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [c.email], reply_to: REPLY_TO, subject, html, text })
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      console.error('[intake-ack] Resend failed', res.status, detail);
      return { sent: false, error: `Resend ${res.status}` };
    }
    console.log('[intake-ack] client ack sent', record.id, lang);
    return { sent: true, lang };
  } catch (e) {
    console.error('[intake-ack] error', e && e.message);
    return { sent: false, error: String((e && e.message) || e) };
  }
}

module.exports = { sendClientAck, detectAckLanguage, ackCopy, ZOOM_MEETING };
