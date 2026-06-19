'use strict';
/**
 * CRM-319 — San Diego Superior Court (local): "Petition to Terminate Probation
 * and Order" (Pen. Code §§ 1203a / 1203.1). The San Diego local form for early
 * termination of probation. Filer = the defendant/petitioner, In-Pro-Per (no
 * attorney). The People's Response, Order, and Clerk's Certificate sections are
 * court/DA/clerk use only — always left blank.
 *
 * Field names are generic + unlabeled on the official PDF; the mapping below was
 * established by index-probe (fill markers → render → read positions) on the
 * qpdf-decrypted blank. The checkbox group all shares one very long partial
 * name (CB), disambiguated by widget index per the probe.
 */
const { _fmt } = require('./ca-caption');
const { clean } = _fmt;

const P1 = 'topmostSubform[0].Page1[0].';
const P2 = 'topmostSubform[0].Page2[0].';
const CB1 = P1 + 'Petitioner_is_currently_serving_the_sentence_imposed_in_custody_or_on_parole_probation_mandatory_supervision_or';

function pick(a, ...k) { for (const x of k) if (a[x] != null && a[x] !== '') return a[x]; return ''; }
function lc(v) { return String(v || '').toLowerCase(); }
function truthy(v) { return /^(y|yes|true|1|да|так)/.test(lc(v)); }

// Page-1 checkbox index → meaning (from the probe).
const FELONY = CB1 + '[0]';
const MISDEMEANOR = CB1 + '[1]';
const FOURTH_WAIVER = CB1 + '[2]';
const CPO = CB1 + '[6]';
const WARRANT = CB1 + '[7]';
const TERM_ONE = CB1 + '[3]';
const TERM_TWO = CB1 + '[4]';
const TERM_THREE = CB1 + '[5]';
// Division checkboxes.
const DIV = { central: P1 + 'Education[0]', east: P1 + 'Education[1]', north: P1 + 'Education[2]', south: P1 + 'Education[3]' };

function crm_319FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const v = {};
  const name = clean(pick(a, 'petitioner_name', 'defendant_name', 'client_name'), 120);
  const addr = [clean(pick(a, 'petitioner_address_line1', 'address_line1', 'mailing_address_line1'), 80),
    [clean(pick(a, 'petitioner_city', 'city', 'mailing_city'), 60), clean(pick(a, 'petitioner_state', 'state'), 20) || 'CA', clean(pick(a, 'petitioner_zip', 'zip', 'mailing_zip'), 12)].filter(Boolean).join(', ')]
    .filter(Boolean).join(', ');

  // ── Caption (In-Pro-Per) ──
  v[P1 + 'TextField291[0]'] = [name, addr].filter(Boolean).join('\n');         // top "(Name ... address)" box
  v[P1 + 'TextField29[0]'] = clean(pick(a, 'petitioner_phone', 'phone'), 30);  // telephone
  v[P1 + 'TextField292[0]'] = clean(pick(a, 'petitioner_email', 'email'), 120); // email
  v[P1 + 'TextField292[1]'] = 'Petitioner in Pro Per';                          // "Attorney for"
  // Court division (default Central if not specified by the client).
  const div = lc(pick(a, 'court_division', 'division'));
  v[DIV[/east/.test(div) ? 'east' : /north/.test(div) ? 'north' : /south/.test(div) ? 'south' : 'central']] = true;
  v[P1 + 'defendant[0]'] = name;                                               // DEFENDANT (caption) = petitioner
  v[P1 + 'case[0]'] = clean(pick(a, 'case_number'), 30);
  v[P1 + 'TextField29[2]'] = clean(pick(a, 'da_ca_number', 'da_number'), 30);  // DA or CA NUMBER (TextField29[1] = FAX, left blank)

  // ── Petitioner information ──
  v[P1 + 'TextField29[3]'] = name;                                             // Full name
  v[P1 + 'TextField29[4]'] = clean(pick(a, 'date_of_birth', 'dob'), 30);       // Date of Birth
  v[P1 + 'TextField294[0]'] = addr;                                            // Address line

  // ── Conviction information ──
  v[P1 + 'TextField295[0]'] = clean(pick(a, 'conviction_offenses', 'offenses', 'conviction_charges'), 400);
  // felony / misdemeanor probation
  const lvl = lc(pick(a, 'conviction_level', 'offense_level'));
  if (/felony/.test(lvl)) v[FELONY] = true; else if (/misd/.test(lvl)) v[MISDEMEANOR] = true;
  v[P1 + 'TextField29[5]'] = clean(pick(a, 'sentenced_date', 'probation_start_date'), 30);  // sentenced on
  v[P1 + 'TextField29[6]'] = clean(pick(a, 'probation_years', 'probation_term_years'), 10); // for ___ years
  // terms and conditions
  if (truthy(pick(a, 'fourth_amendment_waiver', 'fourth_waiver'))) v[FOURTH_WAIVER] = true;
  if (truthy(pick(a, 'criminal_protective_order', 'cpo'))) v[CPO] = true;
  if (truthy(pick(a, 'outstanding_warrant', 'warrant'))) v[WARRANT] = true;
  // statutory maximum term reached (AB 1950): one / two / three years
  const maxT = lc(pick(a, 'max_probation_term', 'statutory_max_term'));
  if (/3|three/.test(maxT)) v[TERM_THREE] = true;
  else if (/2|two/.test(maxT)) v[TERM_TWO] = true;
  else if (/1|one/.test(maxT)) v[TERM_ONE] = true;

  // ── Declaration: print name (TextField29[7] = Date, left for the client to
  //    date + sign). ──
  v[P1 + 'TextField29[8]'] = name;   // Type or print name

  // ── Page-2 running caption (rest of page 2 is court/DA/clerk — left blank). ──
  v[P2 + 'defendant[0]'] = name;
  v[P2 + 'case[0]'] = clean(pick(a, 'case_number'), 30);

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== '')));
}
module.exports = { crm_319FieldValues };
