'use strict';
/**
 * Canonical case-status lifecycle for intake orders (imverica-intakes store).
 *
 * Single source of truth shared by admin-order.js (admin updates), account.js
 * (client view + review decisions) and the admin console. Records keep:
 *   record.status         — canonical key below
 *   record.statusHistory  — [{ status, at, by, role, note }]
 *
 * Legacy records used new | in_review | ready — normalizeStatus() maps them so
 * old orders keep working without migration.
 */

const STATUSES = [
  'new_request',
  'waiting_for_documents',
  'quote_sent',
  'payment_pending',
  'paid',
  'in_preparation',
  'ready_for_client_review',
  'revision_requested',
  'approved_by_client',
  'completed',
  'closed',
  'lost'
];

const LEGACY_ALIASES = {
  new: 'new_request',
  in_review: 'in_preparation',
  ready: 'ready_for_client_review'
};

// Where each status sits on the client portal's 4-segment track
// (Received → In work → Prepared → Done).
const TRACK_POSITION = {
  new_request: 0,
  waiting_for_documents: 1,
  quote_sent: 1,
  payment_pending: 1,
  paid: 1,
  in_preparation: 1,
  revision_requested: 1,
  ready_for_client_review: 2,
  approved_by_client: 3,
  completed: 3,
  closed: 3,
  lost: 0
};

// Sane transition hints for UI (admin endpoint allows any known status so the
// operator can always correct mistakes; the CLIENT path is strictly limited to
// the review decision from ready_for_client_review).
const CLIENT_DECISIONS = {
  approve: 'approved_by_client',
  request_corrections: 'revision_requested'
};

function normalizeStatus(value) {
  const key = String(value || '').trim().toLowerCase();
  if (STATUSES.includes(key)) return key;
  if (LEGACY_ALIASES[key]) return LEGACY_ALIASES[key];
  return null;
}

/**
 * Apply a status change to a record (mutates + returns it). Appends to
 * statusHistory; never throws on missing history (legacy records).
 */
function applyStatus(record, status, meta) {
  const key = normalizeStatus(status);
  if (!key) throw new Error('Unknown status: ' + status);
  meta = meta || {};
  const entry = {
    status: key,
    at: new Date().toISOString(),
    by: String(meta.by || '').slice(0, 160),
    role: meta.role === 'client' ? 'client' : 'admin',
    note: String(meta.note || '').slice(0, 500)
  };
  if (!entry.note) delete entry.note;
  record.status = key;
  record.updatedAt = entry.at;
  if (!Array.isArray(record.statusHistory)) record.statusHistory = [];
  record.statusHistory.push(entry);
  // Cap history so a record can't grow unbounded.
  if (record.statusHistory.length > 50) record.statusHistory = record.statusHistory.slice(-50);
  return record;
}

module.exports = { STATUSES, LEGACY_ALIASES, TRACK_POSITION, CLIENT_DECISIONS, normalizeStatus, applyStatus };
