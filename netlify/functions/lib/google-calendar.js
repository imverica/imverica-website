'use strict';
/**
 * Google Calendar — auto-create an event on the owner's calendar when an
 * APPOINTMENT intake arrives (owner ask 2026-07-17: "как только получаю
 * интейк — в календаре imverica@gmail.com создалась встреча с напоминанием
 * за час").
 *
 * Auth: the SAME service-account key the Drive mirror uses
 * (GOOGLE_DRIVE_SA_KEY_BASE64 / GDRIVE_SERVICE_ACCOUNT_JSON), JWT signed
 * with Node crypto — no new deps, no new secrets.
 *
 * ONE-TIME OWNER SETUP (otherwise this module no-ops with a log line):
 *   1. In Google Cloud Console (same project as the Drive SA) enable the
 *      Google Calendar API.
 *   2. In Google Calendar (imverica@gmail.com) → Settings → share the
 *      calendar with the service-account email, permission
 *      "Make changes to events".
 *   Optional: GOOGLE_CALENDAR_ID env overrides the target calendar
 *   (defaults to imverica@gmail.com).
 *
 * No attendees are added on purpose: plain service accounts cannot invite
 * attendees without domain-wide delegation; the client gets the details in
 * their acknowledgment email instead. Reminders: popup + email 60 min
 * before (fires for the calendar owner).
 */

const crypto = require('crypto');

const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TIMEZONE = 'America/Los_Angeles';

class CalendarDisabled extends Error {
  constructor(msg) { super(msg); this.name = 'CalendarDisabled'; }
}

function calendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'imverica@gmail.com';
}

function readSaKey() {
  const b64 = process.env.GOOGLE_DRIVE_SA_KEY_BASE64;
  const rawJson = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
  let json;
  if (b64 && b64.length >= 100) {
    try { json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')); }
    catch (err) { throw new CalendarDisabled('GOOGLE_DRIVE_SA_KEY_BASE64 not valid base64-JSON: ' + err.message); }
  } else if (rawJson && rawJson.length >= 100) {
    try { json = JSON.parse(rawJson); }
    catch (err) { throw new CalendarDisabled('GDRIVE_SERVICE_ACCOUNT_JSON not valid JSON: ' + err.message); }
  } else {
    throw new CalendarDisabled('No Google service-account key env is set');
  }
  if (!json.client_email || !json.private_key) {
    throw new CalendarDisabled('SA key JSON missing client_email or private_key');
  }
  return json;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cachedToken = null;
let cachedTokenExp = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExp - 5 * 60 * 1000) return cachedToken;
  const sa = readSaKey();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: OAUTH_TOKEN, iat: now, exp: now + 3600 }));
  const signing = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signing);
  const jwt = `${signing}.${base64url(signer.sign(sa.private_key))}`;
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString()
  });
  if (!res.ok) throw new Error(`Calendar OAuth ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const data = await res.json();
  if (!data.access_token) throw new Error('OAuth response missing access_token');
  cachedToken = data.access_token;
  cachedTokenExp = Date.now() + (Number(data.expires_in || 3600) * 1000);
  return cachedToken;
}

/** '9:00 AM' / '12:00 PM' / '2:00 PM' → '09:00' / '12:00' / '14:00'. Null if unparsable. */
function to24h(time) {
  const m = String(time || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2];
  const pm = m[3].toUpperCase() === 'PM';
  if (h === 12) h = pm ? 12 : 0;
  else if (pm) h += 12;
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/** End time hh:mm + minutes, same day (slots are 9AM–4PM; can't cross midnight). */
function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Create the calendar event for an APPOINTMENT intake. Best-effort: returns
 * a status object, never throws. `record` needs id, contact.{name,email,
 * phone}, situation, appointment.{type,typeLabel,date,time,durationMin};
 * `zoom` (optional) = { url, id, passcode } for video meetings.
 */
async function createAppointmentEvent(record, zoom) {
  const a = record && record.appointment;
  const c = (record && record.contact) || {};
  if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(a.date || '')) return { created: false, reason: 'no-appointment' };
  const start = to24h(a.time);
  if (!start) return { created: false, reason: 'bad-time' };
  const duration = Number(a.durationMin) >= 5 && Number(a.durationMin) <= 240 ? Number(a.durationMin) : 30;
  const isVideo = String(a.type || '').toLowerCase() === 'video';

  const descLines = [
    `Order: ${record.id}`,
    `Client: ${c.name || '—'}`,
    `Email: ${c.email || '—'}`,
    c.phone ? `Phone: ${c.phone}` : '',
    '',
    isVideo && zoom ? `Zoom: ${zoom.url}\nMeeting ID: ${zoom.id} · Passcode: ${zoom.passcode}\n` : '',
    'Request:',
    String(record.situation || '').slice(0, 1500)
  ].filter((l) => l !== '');

  const event = {
    summary: `${a.typeLabel || 'Appointment'} — ${c.name || 'client'} (${record.id})`,
    description: descLines.join('\n'),
    start: { dateTime: `${a.date}T${start}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${a.date}T${addMinutes(start, duration)}:00`, timeZone: TIMEZONE },
    location: isVideo && zoom ? zoom.url : undefined,
    // Owner asked for a 1-hour heads-up. Popup + email so it lands on the
    // phone AND in the inbox.
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'email', minutes: 60 }] }
  };

  try {
    const token = await getAccessToken();
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      console.error('[calendar] event insert failed', res.status, detail);
      return { created: false, reason: `http-${res.status}` };
    }
    const data = await res.json();
    console.log('[calendar] event created', record.id, data.id, data.htmlLink || '');
    return { created: true, eventId: data.id, link: data.htmlLink };
  } catch (e) {
    if (e instanceof CalendarDisabled) {
      console.log('[calendar] disabled —', e.message);
      return { created: false, reason: 'disabled' };
    }
    console.error('[calendar] error', e && e.message);
    return { created: false, reason: String((e && e.message) || e) };
  }
}

module.exports = { createAppointmentEvent, to24h, addMinutes, CalendarDisabled };
