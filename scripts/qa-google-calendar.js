'use strict';
/**
 * QA — owner-calendar event for appointment intakes (lib/google-calendar.js).
 *
 * Stubs fetch (OAuth + Calendar API) and a fake service-account key to
 * assert: correct calendar URL, PT dateTime start/end, two popup reminders
 * (1 day + 1 hour), Zoom in description/location for video, no-op when the
 * key env is absent, and the 12-hour → 24-hour time conversion table.
 *
 * Run: node scripts/qa-google-calendar.js
 */

const crypto = require('crypto');

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; } else { fail++; console.error(`FAIL ${label}${extra ? ' — ' + extra : ''}`); }
}

(async () => {
  const { to24h, addMinutes } = require('../netlify/functions/lib/google-calendar');

  // --- time conversion table ---
  const table = [['9:00 AM', '09:00'], ['10:30 AM', '10:30'], ['12:00 PM', '12:00'], ['12:30 AM', '00:30'], ['1:00 PM', '13:00'], ['4:00 PM', '16:00'], ['11:59 PM', '23:59'], ['bad', null], ['', null]];
  for (const [inp, want] of table) check(`to24h(${inp || 'empty'})`, to24h(inp) === want, `got ${to24h(inp)}`);
  check('addMinutes 14:00+30', addMinutes('14:00', 30) === '14:30');
  check('addMinutes 09:45+30', addMinutes('09:45', 30) === '10:15');

  const record = {
    id: 'IMVERICA-20260717-25',
    contact: { name: 'Farruh K', email: 'client@example.com', phone: '+1 916 555 0000' },
    situation: 'APPOINTMENT REQUEST\nMeeting: Video meeting · 30 minutes',
    appointment: { type: 'video', typeLabel: 'Video meeting · 30 minutes', date: '2026-07-21', time: '2:00 PM', durationMin: 30 }
  };
  const zoom = { url: 'https://us05web.zoom.us/j/7315124254?pwd=x', id: '731 512 4254', passcode: 'zW7m6n' };

  // --- disabled path: no SA env → clean no-op ---
  delete process.env.GOOGLE_DRIVE_SA_KEY_BASE64;
  delete process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
  {
    // fresh module instance so the token cache is empty
    delete require.cache[require.resolve('../netlify/functions/lib/google-calendar')];
    const { createAppointmentEvent } = require('../netlify/functions/lib/google-calendar');
    const r = await createAppointmentEvent(record, zoom);
    check('no env → disabled no-op', r.created === false && r.reason === 'disabled', JSON.stringify(r));
  }

  // --- happy path with stubbed fetch + fake RSA key ---
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const saKey = {
    client_email: 'qa-sa@test-project.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' })
  };
  process.env.GOOGLE_DRIVE_SA_KEY_BASE64 = Buffer.from(JSON.stringify(saKey)).toString('base64');

  let calendarUrl = null;
  let eventBody = null;
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'qa-token', expires_in: 3600 }), text: async () => '' };
    }
    if (u.includes('googleapis.com/calendar')) {
      calendarUrl = u;
      eventBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ id: 'evt123', htmlLink: 'https://calendar.google.com/evt123' }), text: async () => '' };
    }
    return realFetch(url, opts);
  };

  delete require.cache[require.resolve('../netlify/functions/lib/google-calendar')];
  const { createAppointmentEvent } = require('../netlify/functions/lib/google-calendar');
  const r = await createAppointmentEvent(record, zoom);
  global.fetch = realFetch;

  check('event created', r.created === true && r.eventId === 'evt123', JSON.stringify(r));
  check('targets imverica@gmail.com', calendarUrl && calendarUrl.includes('/calendars/imverica%40gmail.com/events'), calendarUrl);
  check('start is PT 14:00', eventBody.start.dateTime === '2026-07-21T14:00:00' && eventBody.start.timeZone === 'America/Los_Angeles', JSON.stringify(eventBody.start));
  check('end is PT 14:30', eventBody.end.dateTime === '2026-07-21T14:30:00', JSON.stringify(eventBody.end));
  check('two reminders: 1 day + 1 hour popups', !eventBody.reminders.useDefault
    && eventBody.reminders.overrides.some((o) => o.method === 'popup' && o.minutes === 1440)
    && eventBody.reminders.overrides.some((o) => o.method === 'popup' && o.minutes === 60));
  check('summary has client + order', eventBody.summary.includes('Farruh K') && eventBody.summary.includes('IMVERICA-20260717-25'));
  check('zoom in location', eventBody.location === zoom.url);
  check('zoom + contacts in description', eventBody.description.includes(zoom.url) && eventBody.description.includes('client@example.com'));

  // Phone meeting → no zoom in the event.
  let phoneBody = null;
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('oauth2')) return { ok: true, status: 200, json: async () => ({ access_token: 'qa', expires_in: 3600 }), text: async () => '' };
    phoneBody = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ id: 'evt124' }), text: async () => '' };
  };
  await createAppointmentEvent({ ...record, appointment: { ...record.appointment, type: 'phone', typeLabel: 'Phone call · 20 minutes', durationMin: 20 } }, zoom);
  global.fetch = realFetch;
  check('phone: no location', phoneBody.location === undefined);
  check('phone: 20-min slot', phoneBody.end.dateTime === '2026-07-21T14:20:00');

  // Bad inputs are refused before any network call.
  const bad = await createAppointmentEvent({ ...record, appointment: { ...record.appointment, time: 'noon' } }, zoom);
  check('bad time → no event', bad.created === false && bad.reason === 'bad-time');
  const noA = await createAppointmentEvent({ ...record, appointment: null }, zoom);
  check('no appointment → no event', noA.created === false && noA.reason === 'no-appointment');

  console.log(`\nqa-google-calendar: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
