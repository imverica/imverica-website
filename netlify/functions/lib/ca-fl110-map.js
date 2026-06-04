'use strict';
/**
 * FL-110 — Summons (Family Law).
 *
 * Simple form: respondent name (NOTICE TO RESPONDENT), petitioner name,
 * the petitioner's own name+address+phone block, and the case number.
 * The clerk fills the date/clerk fields at filing, so we leave those blank.
 *
 * FL-110 uses generic AcroForm field names (T33, TextField2[0/1], T89) —
 * the mapping below is keyed off each field's verbatim /TU tooltip
 * (extract-ca-fields.js fl-110) so we fill the right boxes.
 */

const { _fmt } = require('./ca-caption');
const { clean, partyName, usPhone, stateCode, digits } = _fmt;

function fl_110FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const B = 'topmostSubform[0].Page1[0].';

  const petitioner = partyName(a, 'petitioner');
  const respondent = partyName(a, 'respondent');

  // Petitioner's contact block (name / address / phone) printed in T89.
  const addrLine = [
    clean(a.petitioner_address_line1 || a.mailing_address_line1, 80),
    [clean(a.petitioner_city || a.mailing_city, 40),
     stateCode(a.petitioner_state || a.mailing_state),
     digits(a.petitioner_zip || a.mailing_zip, 10)].filter(Boolean).join(', ')
  ].filter(Boolean).join(', ');
  const phone = usPhone(a.petitioner_phone || a.phone);
  const petitionerBlock = [petitioner, addrLine, phone].filter(Boolean).join('\n');

  const v = {
    [B + 'TextField2[0]']: respondent,        // NOTICE TO RESPONDENT (Name):
    [B + 'TextField2[1]']: petitioner,        // Petitioner's name is:
    [B + 'T89[0]']: petitionerBlock,          // petitioner's (or attorney's) name/address/phone
    [B + 'T33[0]']: clean(a.case_number, 30), // CASE NUMBER:
    // Spanish-layer duplicates of the two party names.
    [B + '#field[7]']: respondent,            // AVISO AL DEMANDADO (Nombre):
    [B + '#field[8]']: petitioner             // Nombre del demandante:
  };

  return Object.fromEntries(
    Object.entries(v).filter(([, val]) => typeof val === 'string' && val !== '')
  );
}

module.exports = { fl_110FieldValues };
