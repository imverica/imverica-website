'use strict';
// Shared helpers for USCIS PDF maps — currently the Apt/Ste/Flr unit-type radio.
//
// Every modern USCIS address block has a unit-type selector (Apt./Ste./Flr.)
// next to the unit-number text box. It is a radio whose three widgets each carry
// one appearance state (" APT " / " STE " / " FLR "), but the WIDGET INDEX ORDER
// VARIES per form (i-751 is APT,STE,FLR; i-912 is FLR,STE,APT; i-918 is
// STE,FLR,APT; …). So we never address it by index — instead we set every widget
// of the radio to the desired TYPE string and let the fill engine check only the
// widget whose own appearance state matches (see updateButtonFieldBody /
// normalizeBtnState in pdf-incremental-fill.js).

function clean(v, max = 60) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Classify a raw unit string ("Apt 5B", "Ste. 200", "Floor 3", "#12", "5B")
// into the USCIS radio state: "APT" | "STE" | "FLR" | "".
function unitType(v) {
  const s = clean(v, 30).toUpperCase();
  if (!s) return '';
  if (/\bSTE\b|SUITE/.test(s)) return 'STE';
  if (/\bFLR\b|\bFL\b|FLOOR/.test(s)) return 'FLR';
  if (/\bAPT\b|APARTMENT|\bUNIT\b|\bRM\b|ROOM|#|^\d|\d$/.test(s)) return 'APT';
  return 'APT'; // a non-empty unit with no keyword defaults to Apartment
}

// Strip the unit keyword so only the number/identifier goes in the number box.
function unitNumber(v, max = 10) {
  return clean(v, 24)
    .replace(/^\s*(?:apartment|apt|suite|ste|floor|flr|fl|unit|room|rm|no|number|#)\s*\.?\s*/i, '')
    .trim()
    .slice(0, max);
}

// Build the radio assignment for a unit field whose widgets are named
// `${base}[0]`, `${base}[1]`, `${base}[2]`. Setting all three to the type lets
// the engine pick the matching widget regardless of index order. Returns {} when
// there is no unit, so nothing is checked for addresses without an apt/ste/flr.
function unitRadio(base, rawUnit) {
  const t = unitType(rawUnit);
  if (!t) return {};
  return { [`${base}[0]`]: t, [`${base}[1]`]: t, [`${base}[2]`]: t };
}

module.exports = { unitType, unitNumber, unitRadio };
