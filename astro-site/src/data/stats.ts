/**
 * Auto-growing homepage counters, shared by StatsStrip and the v2 homepage.
 *
 * - "Forms supported": base 734 on 2026-05-25 (when the user set this rule),
 *   +1 every ~2.5 days (5 forms every 12 days keeps the arithmetic clean).
 * - "Priority forms": base 18, +1 every 60 days (~2 months).
 *
 * Evaluated at build time, so the numbers grow on their own without edits.
 */
const BASE_DATE = Date.UTC(2026, 4, 25); // May = month 4 (0-indexed)

function daysSinceBase(now: number): number {
  return Math.max(0, Math.floor((now - BASE_DATE) / (24 * 60 * 60 * 1000)));
}

export function formsSupported(now = Date.now()): number {
  return 734 + Math.floor(daysSinceBase(now) * 2 / 5);
}

export function priorityForms(now = Date.now()): number {
  return 18 + Math.floor(daysSinceBase(now) / 60);
}
