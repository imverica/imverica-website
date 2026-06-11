'use strict';
/**
 * QA — case-status lifecycle (lib/case-status.js).
 * Run: node scripts/qa-case-status.js (exit 0 = pass)
 */
const { STATUSES, normalizeStatus, applyStatus, TRACK_POSITION, CLIENT_DECISIONS } = require('../netlify/functions/lib/case-status');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { console.log('  ✓', m); pass++; } else { console.error('  ✗', m); fail++; } };

console.log('\n=== case-status QA ===\n');

ok(STATUSES.length === 12, '12 canonical statuses');
ok(STATUSES.every((s) => /^[a-z_]+$/.test(s)), 'machine keys are snake_case');
ok(STATUSES.every((s) => s in TRACK_POSITION), 'every status has a track position');

// Legacy aliases
ok(normalizeStatus('new') === 'new_request', 'legacy new → new_request');
ok(normalizeStatus('in_review') === 'in_preparation', 'legacy in_review → in_preparation');
ok(normalizeStatus('ready') === 'ready_for_client_review', 'legacy ready → ready_for_client_review');
ok(normalizeStatus('IN_PREPARATION') === 'in_preparation', 'case-insensitive');
ok(normalizeStatus('bogus') === null, 'unknown status rejected');

// applyStatus + history
const rec = { id: 'IMV-TEST', status: 'new' };
applyStatus(rec, 'quote_sent', { by: 'admin@imverica.com', role: 'admin', note: 'Sent $499 quote' });
ok(rec.status === 'quote_sent', 'status applied');
ok(rec.statusHistory.length === 1 && rec.statusHistory[0].note === 'Sent $499 quote', 'history entry with note');
applyStatus(rec, 'ready_for_client_review', { by: 'admin@imverica.com', role: 'admin' });
applyStatus(rec, CLIENT_DECISIONS.approve, { by: 'client@x.com', role: 'client' });
ok(rec.status === 'approved_by_client', 'client approve decision lands');
ok(rec.statusHistory.length === 3 && rec.statusHistory[2].role === 'client', 'client role recorded in history');
ok(!('note' in rec.statusHistory[1]), 'empty note omitted');

// Client decisions map
ok(CLIENT_DECISIONS.request_corrections === 'revision_requested', 'request_corrections → revision_requested');

// History cap
const big = { id: 'X', status: 'new' };
for (let i = 0; i < 60; i++) applyStatus(big, i % 2 ? 'paid' : 'in_preparation', { by: 'a' });
ok(big.statusHistory.length === 50, 'history capped at 50');

// Unknown status throws
let threw = false; try { applyStatus({}, 'nope'); } catch { threw = true; }
ok(threw, 'applyStatus throws on unknown status');

console.log(`\n=== Passed: ${pass}  Failed: ${fail} ===\n`);
process.exit(fail ? 1 : 0);
