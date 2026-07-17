'use strict';
/**
 * QA — appointment .ics generator (lib/ics.js).
 *
 * Checks: valid VCALENDAR envelope, correct Pacific-time DTSTART/DTEND with
 * duration, 12h→24h conversion, a 1-hour VALARM, Zoom details for video
 * meetings (and none for phone), RFC5545 escaping, and graceful null on
 * bad input.
 *
 * Run: node scripts/qa-ics.js
 */

const { buildAppointmentIcs, timeToHms, addMinutesHms } = require('../netlify/functions/lib/ics');

let pass = 0;
let fail = 0;
function assert(label, cond, extra) {
  if (cond) { pass++; } else { fail++; console.error(`FAIL ${label}${extra ? ' — ' + extra : ''}`); }
}

// --- time helpers ---
assert('9:00 AM → 090000', timeToHms('9:00 AM') === '090000', timeToHms('9:00 AM'));
assert('12:00 PM → 120000', timeToHms('12:00 PM') === '120000', timeToHms('12:00 PM'));
assert('12:00 AM → 000000', timeToHms('12:00 AM') === '000000', timeToHms('12:00 AM'));
assert('2:00 PM → 140000', timeToHms('2:00 PM') === '140000', timeToHms('2:00 PM'));
assert('bad time → null', timeToHms('not a time') === null);
assert('+30 min from 140000', addMinutesHms('140000', 30) === '143000', addMinutesHms('140000', 30));
assert('+90 min crosses hour', addMinutesHms('140000', 90) === '153000', addMinutesHms('140000', 90));

const ZOOM = { url: 'https://us05web.zoom.us/j/7315124254?pwd=abc.1', id: '731 512 4254', passcode: 'zW7m6n' };

// --- video appointment ---
const videoRec = {
  id: 'IMVERICA-20260721-25',
  contact: { name: 'Farruh Test', email: 'fko@example.com', phone: '9165988219' },
  situation: 'APPOINTMENT REQUEST\nMeeting: Video meeting · 30 minutes',
  appointment: { type: 'video', typeLabel: 'Video meeting · 30 minutes', date: '2026-07-21', time: '2:00 PM', durationMin: 30 }
};
const vics = buildAppointmentIcs(videoRec, ZOOM);
assert('video: is a string', typeof vics === 'string');
assert('video: BEGIN/END VCALENDAR', vics.startsWith('BEGIN:VCALENDAR') && vics.trim().endsWith('END:VCALENDAR'));
assert('video: METHOD REQUEST', vics.includes('METHOD:REQUEST'));
assert('video: DTSTART Pacific 2pm', vics.includes('DTSTART;TZID=America/Los_Angeles:20260721T140000'), 'no DTSTART');
assert('video: DTEND +30min', vics.includes('DTEND;TZID=America/Los_Angeles:20260721T143000'), 'no DTEND');
assert('video: 1-hour VALARM', vics.includes('BEGIN:VALARM') && vics.includes('TRIGGER:-PT1H'));
assert('video: has VTIMEZONE', vics.includes('BEGIN:VTIMEZONE') && vics.includes('TZID:America/Los_Angeles'));
assert('video: Zoom in description', vics.includes('us05web.zoom.us') && vics.includes('zW7m6n'));
assert('video: order id in summary', vics.includes('IMVERICA-20260721-25'));
assert('video: attendee = imverica gmail', vics.includes('mailto:imverica@gmail.com'));
assert('video: CRLF line endings', vics.includes('\r\n'));

// --- phone appointment: no Zoom ---
const phoneRec = {
  id: 'IMVERICA-20260721-26',
  contact: { name: 'Anna', email: 'anna@example.com', phone: '' },
  situation: 'APPOINTMENT REQUEST',
  appointment: { type: 'phone', typeLabel: 'Phone call · 20 minutes', date: '2026-07-21', time: '9:00 AM', durationMin: 20 }
};
const pics = buildAppointmentIcs(phoneRec, ZOOM);
assert('phone: DTSTART 9am', pics.includes('DTSTART;TZID=America/Los_Angeles:20260721T090000'));
assert('phone: DTEND +20min', pics.includes('DTEND;TZID=America/Los_Angeles:20260721T092000'));
assert('phone: NO zoom url', !pics.includes('us05web.zoom.us'));
assert('phone: LOCATION is phone', pics.includes('LOCATION:Phone'));

// --- escaping: commas/semicolons in the situation must be escaped ---
const escRec = {
  id: 'IMVERICA-20260721-27',
  contact: { name: 'Bob; Jr, Sr', email: 'b@example.com' },
  situation: 'Need help; with I-485, I-765 forms',
  appointment: { type: 'phone', typeLabel: 'Phone call · 20 minutes', date: '2026-07-22', time: '10:00 AM', durationMin: 20 }
};
const eics = buildAppointmentIcs(escRec, ZOOM);
assert('escaping: semicolon escaped', eics.includes('help\\;') || eics.includes('Bob\\;'));
assert('escaping: comma escaped', eics.includes('I-485\\,'));

// --- bad input → null ---
assert('no appointment → null', buildAppointmentIcs({ id: 'x', contact: {} }, ZOOM) === null);
assert('bad date → null', buildAppointmentIcs({ id: 'x', contact: {}, appointment: { date: 'nope', time: '2:00 PM' } }, ZOOM) === null);
assert('bad time → null', buildAppointmentIcs({ id: 'x', contact: {}, appointment: { date: '2026-07-21', time: 'noon' } }, ZOOM) === null);

console.log(`\nqa-ics: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
