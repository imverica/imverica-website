/*
 * calculateWizardProgress — accurate, requirement-based wizard progress.
 *
 * Progress is NOT page-count based. It is:
 *      completed required items ÷ total required items
 * where an item counts only when it is required AND currently visible
 * (conditional fields whose showWhen/showWhenAny conditions are not met are
 * excluded entirely — they neither inflate the denominator nor the numerator).
 *
 * Works against the cabinet wizard schema shape:
 *   schema.steps[] = { title, help, fields: [{ id, label, type, required,
 *                      showWhen: [cond], showWhenAny: [cond], ... }] }
 *   cond = { id, equals } | { id, in: [...] } | { id, gte }
 *
 * Value-filled semantics mirror the wizard's collectors:
 *   string  → non-empty after trim
 *   array   → at least one entry (checkboxes, history rows)
 *   object  → at least one non-empty own value (phone, address blocks)
 *   number  → finite
 *
 * Loaded by account.html as a plain script (window.calculateWizardProgress)
 * and unit-tested in Node via module.exports.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.calculateWizardProgress = factory();
})(typeof globalThis !== 'undefined' ? globalThis : self, function () {
  'use strict';

  function conditionMet(condition, values) {
    if (!condition || !condition.id) return true;
    var value = values[condition.id];
    if (Object.prototype.hasOwnProperty.call(condition, 'equals')) {
      return String(value == null ? '' : value) === String(condition.equals == null ? '' : condition.equals);
    }
    if (Array.isArray(condition.in)) {
      return condition.in.map(String).indexOf(String(value == null ? '' : value)) !== -1;
    }
    if (Object.prototype.hasOwnProperty.call(condition, 'gte')) {
      return Number(value || 0) >= Number(condition.gte);
    }
    return true;
  }

  function fieldVisible(field, values) {
    if (Array.isArray(field.showWhen) && !field.showWhen.every(function (c) { return conditionMet(c, values); })) return false;
    if (Array.isArray(field.showWhenAny) && !field.showWhenAny.some(function (c) { return conditionMet(c, values); })) return false;
    return true;
  }

  function isFilled(value) {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return isFinite(value);
    if (typeof value === 'boolean') return value === true; // acknowledgements
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') {
      for (var k in value) {
        if (Object.prototype.hasOwnProperty.call(value, k) && isFilled(value[k])) return true;
      }
      return false;
    }
    return false;
  }

  /**
   * @param {object} schema  { steps: [...] }
   * @param {object} values  current answers keyed by field id
   * @param {object} [opts]  { pageIndex } — the wizard's current raw step index
   */
  function calculateWizardProgress(schema, values, opts) {
    values = values || {};
    opts = opts || {};
    var steps = (schema && Array.isArray(schema.steps)) ? schema.steps : [];

    var totalRequiredItems = 0;
    var completedRequiredItems = 0;
    var missingItems = [];
    var totalVisibleSteps = 0;
    var currentStep = 0;

    for (var i = 0; i < steps.length; i++) {
      var step = steps[i] || {};
      var fields = Array.isArray(step.fields) ? step.fields : [];
      var visible = [];
      for (var j = 0; j < fields.length; j++) {
        if (fieldVisible(fields[j], values)) visible.push(fields[j]);
      }
      if (visible.length === 0) continue; // fully hidden step — not visible
      totalVisibleSteps++;
      if (typeof opts.pageIndex === 'number' && i <= opts.pageIndex) currentStep = totalVisibleSteps;

      for (var f = 0; f < visible.length; f++) {
        var field = visible[f];
        if (!field.required) continue; // optional fields never count
        totalRequiredItems++;
        if (isFilled(values[field.id])) {
          completedRequiredItems++;
        } else {
          missingItems.push({
            id: field.id,
            label: field.label || field.id,
            stepIndex: i,
            stepTitle: step.title || ''
          });
        }
      }
    }

    var percent = totalRequiredItems === 0
      ? 0
      : Math.round((completedRequiredItems / totalRequiredItems) * 100);
    // 100% means 100%: every required visible item complete — never round up.
    if (percent === 100 && completedRequiredItems < totalRequiredItems) percent = 99;

    return {
      totalRequiredItems: totalRequiredItems,
      completedRequiredItems: completedRequiredItems,
      percent: percent,
      missingItems: missingItems,
      currentStep: currentStep,
      totalVisibleSteps: totalVisibleSteps
    };
  }

  return calculateWizardProgress;
});
