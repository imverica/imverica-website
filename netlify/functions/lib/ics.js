'use strict';
/**
 * Build an .ics (iCalendar) invite for an appointment intake.
 *
 * Why this exists: the owner wants the meeting to land on the
 * imverica@gmail.com calendar WITH a 1-hour reminder. The fully-automatic
 * path (google-calendar.js) needs a service-account key that isn't
 * configured, so the zero-setup fallback is to attach this .ics to the
 * owner-notification email. Gmail renders it as an "Add to calendar" card;
 * one tap drops the event — including the VALARM 1-hour reminder — onto the
 * owner's calendar. Video meetings carry the Zoom room in the description
 * and location.
 *
 * All times are America/Los_Angeles (the business's zone). We emit an
 * explicit VTIMEZONE for Pacific so the event shows at the right wall-clock
 * time in any client, DST-correct for the dates this business books.
 */

const TZID = 'America/Los_Angeles';

// A self-contained Pacific VTIMEZONE block (standard US rules). Included so
// the DTSTART;TZID reference resolves in every calendar client, not just
// Google's.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'X-LIC-LOCATION:America/Los_Angeles',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0800',
  'TZOFFSETTO:-0700',
  'TZNAME:PDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0700',
  'TZOFFSETTO:-0800',
  'TZNAME:PST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE'
];

/** RFC5545 text escaping: backslash, comma, semicolon, newline. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** '9:00 AM' → '090000', '2:00 PM' → '140000'. Null if unparsable. */
function timeToHms(time) {
  const m = String(time || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2];
  const pm = m[3].toUpperCase() === 'PM';
  if (h === 12) h = pm ? 12 : 0;
  else if (pm) h += 12;
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}${min}00`;
}

/** local 'HHMMSS' + minutes → 'HHMMSS' same day (slots are 9–16h). */
function addMinutesHms(hms, minutes) {
  const h = Number(hms.slice(0, 2));
  const mm = Number(hms.slice(2, 4));
  const total = h * 60 + mm + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}${String(nm).padStart(2, '0')}00`;
}

/** RFC5545 line folding: no line may exceed 75 octets. */
function fold(line) {
  if (line.length <= 74) return line;
  const parts = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 73) { parts.push(' ' + rest.slice(0, 73)); rest = rest.slice(73); }
  if (rest.length) parts.push(' ' + rest);
  return parts.join('\r\n');
}

/**
 * Build the .ics string. Returns null when the appointment lacks a usable
 * date/time (caller then simply skips the attachment).
 *
 *   record:   { id, contact:{name,email,phone}, situation, appointment:
 *               {type, typeLabel, date:'YYYY-MM-DD', time:'2:00 PM',
 *                durationMin} }
 *   zoom:     { url, id, passcode }  (used only for video meetings)
 *   organizer:'info@imverica.com'   (defaults)
 *   attendee: 'imverica@gmail.com'  (the calendar owner; METHOD:REQUEST so
 *             Gmail shows an actionable card)
 */
function buildAppointmentIcs(record, zoom, opts = {}) {
  const a = record && record.appointment;
  const c = (record && record.contact) || {};
  if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(a.date || '')) return null;
  const startHms = timeToHms(a.time);
  if (!startHms) return null;

  const duration = Number(a.durationMin) >= 5 && Number(a.durationMin) <= 240 ? Number(a.durationMin) : 30;
  const dateCompact = a.date.replace(/-/g, '');
  const dtStart = `${dateCompact}T${startHms}`;
  const dtEnd = `${dateCompact}T${addMinutesHms(startHms, duration)}`;
  const isVideo = String(a.type || '').toLowerCase() === 'video';
  const organizer = opts.organizer || 'info@imverica.com';
  const attendee = opts.attendee || 'imverica@gmail.com';

  const descLines = [
    `Order: ${record.id}`,
    `Client: ${c.name || '—'}`,
    `Email: ${c.email || '—'}`,
    c.phone ? `Phone: ${c.phone}` : '',
    ''
  ];
  if (isVideo && zoom) {
    descLines.push(`Zoom: ${zoom.url}`, `Meeting ID: ${zoom.id} · Passcode: ${zoom.passcode}`, '');
  }
  descLines.push('Request:', String(record.situation || '').slice(0, 1200));

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const uid = `${record.id || 'appt'}-${Date.now()}@imverica.com`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Imverica Legal Solutions//Appointments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    ...VTIMEZONE,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART;TZID=${TZID}:${dtStart}`,
    `DTEND;TZID=${TZID}:${dtEnd}`,
    `SUMMARY:${esc(`${a.typeLabel || 'Appointment'} — ${c.name || 'client'} (${record.id})`)}`,
    `DESCRIPTION:${esc(descLines.filter((l) => l !== undefined).join('\n'))}`,
    isVideo && zoom ? `LOCATION:${esc(zoom.url)}` : `LOCATION:${esc('Phone / +1 (916) 399-3992')}`,
    `ORGANIZER;CN=Imverica Legal Solutions:mailto:${organizer}`,
    `ATTENDEE;CN=Imverica;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    // Two alerts (owner ask 2026-07-17): 1 day before + 1 hour before.
    // ACTION:DISPLAY = an on-screen alert in iOS/macOS Calendar and a popup
    // in Google Calendar; both honor multiple VALARMs.
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder — 1 day',
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder — 1 hour',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  return lines.map(fold).join('\r\n') + '\r\n';
}

module.exports = { buildAppointmentIcs, timeToHms, addMinutesHms };
