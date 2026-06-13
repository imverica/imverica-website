'use strict';
/**
 * Authoritative California Unlawful Detainer (eviction) packet specification.
 *
 * WHY THIS EXISTS: taking the wrong — or an incomplete — set of forms to the
 * clerk gets a UD filing rejected or a case dismissed. This file is the single
 * source of truth for which Judicial Council forms belong in a UD matter, in
 * what order, at which stage, who fills each one, and which are mandatory vs
 * situational. The generator, the cabinet flow and QA all read it, so the
 * system assembles the same correct packet every time.
 *
 * SOURCES (verified June 2026):
 *   - California Courts self-help, "Eviction" (selfhelp.courts.ca.gov)
 *   - Judicial Council form list (courts.ca.gov, UD-* and related)
 *   - county UD plaintiff packets (e.g. Sonoma, Trinity, Tulare)
 * Form titles below are taken verbatim from the Judicial Council catalog we
 * already cache — nothing is invented.
 *
 * UPL / LDA SAFETY: this is the *standard set of forms the courts list* for an
 * unlawful detainer. It does not advise anyone to evict, does not pick legal
 * grounds, and does not decide which optional forms a given case needs — the
 * client provides the facts and chooses. "required"/"conditional" below restate
 * the courts' own filing rules, not Imverica's legal judgment.
 *
 * NOTE: the pre-filing termination notices (3-day pay-or-quit, 30/60/90-day,
 * etc.) are NOT Judicial Council forms; they are drafted from the client's
 * facts and attached to UD-100 as exhibits. They are listed as `notice`
 * artifacts, not JC form codes.
 */

const STAGES = [
  {
    id: 'file',
    label: 'Open the case (landlord files)',
    forms: [
      { code: 'CM-010', who: 'landlord', requirement: 'required',
        note: 'Civil Case Cover Sheet. Required to open the civil case in most courts.' },
      { code: 'SUM-130', who: 'clerk-issued', requirement: 'required',
        note: 'Summons—Eviction (Unlawful Detainer). Issued by the clerk, then served on every named defendant with the complaint.' },
      { code: 'UD-100', who: 'landlord', requirement: 'required',
        note: 'Complaint—Unlawful Detainer. The core pleading. The terminated lease and the served notice are attached as exhibits.' },
      { code: 'UD-101', who: 'landlord', requirement: 'required',
        note: 'Plaintiff’s Mandatory Cover Sheet and Supplemental Allegations—Unlawful Detainer. Mandatory for residential UD; filed with UD-100.' },
      { code: 'CP10.5', who: 'landlord', requirement: 'conditional',
        condition: 'There may be adult occupants who are not named defendants.',
        note: 'Prejudgment Claim of Right to Possession. Served with the summons/complaint so unnamed occupants can assert a possession claim; closes a common post-judgment loophole.' }
    ]
  },
  {
    id: 'serve',
    label: 'Serve and prove service',
    forms: [
      { code: 'POS-010', who: 'server', requirement: 'required',
        note: 'Proof of Service of Summons. Filed after each defendant is served; the 5-day response clock runs from service.' }
    ]
  },
  {
    id: 'respond',
    label: 'Tenant responds (defendant side)',
    forms: [
      { code: 'UD-105', who: 'tenant', requirement: 'conditional',
        condition: 'The tenant chooses to contest the eviction.',
        note: 'Answer—Unlawful Detainer. The tenant’s response; due within 5 days of service. (This is the defendant’s form, not the landlord’s.)' }
    ]
  },
  {
    id: 'default',
    label: 'Default (tenant did not respond in time)',
    forms: [
      { code: 'CIV-100', who: 'landlord', requirement: 'required-if-default',
        condition: 'No timely Answer was filed.',
        note: 'Request for Entry of Default. Asks the clerk to enter the defendant’s default.' },
      { code: 'UD-116', who: 'landlord', requirement: 'conditional',
        condition: 'Seeking default judgment by written declaration rather than a hearing.',
        note: 'Declaration for Default Judgment by Court (Unlawful Detainer).' },
      { code: 'UD-110', who: 'landlord', requirement: 'required-if-default',
        note: 'Judgment—Unlawful Detainer. The judgment for possession (and any money owed).' }
    ]
  },
  {
    id: 'trial',
    label: 'Contested case (tenant answered)',
    forms: [
      { code: 'UD-150', who: 'either', requirement: 'required-if-contested',
        condition: 'An Answer (UD-105) was filed.',
        note: 'Request/Counter-Request to Set Case for Trial—Unlawful Detainer. Either side may request the trial setting.' },
      { code: 'UD-115', who: 'both', requirement: 'conditional',
        condition: 'The parties settle.',
        note: 'Stipulation for Entry of Judgment. Used when landlord and tenant agree to terms instead of trial.' },
      { code: 'UD-110', who: 'court', requirement: 'required-if-contested',
        note: 'Judgment—Unlawful Detainer entered after trial or stipulation.' }
    ]
  },
  {
    id: 'enforce',
    label: 'Enforce the judgment (physical eviction)',
    forms: [
      { code: 'EJ-130', who: 'landlord', requirement: 'required-to-evict',
        condition: 'A judgment for possession was entered and any stay has expired.',
        note: 'Writ of Execution — used as the Writ of Possession of Real Property. The sheriff posts a Notice to Vacate and performs the lockout. (The Notice to Vacate is posted by the sheriff, not a form the landlord prepares.)' }
    ]
  }
];

// Forms sometimes added depending on the facts (not stage-ordered).
const SITUATIONAL = [
  { code: 'UD-120', who: 'landlord', requirement: 'conditional',
    condition: 'Government rental assistance was applied for or received.',
    note: 'Verification by Landlord Regarding Rental Assistance.' },
  { code: 'FW-001', who: 'either', requirement: 'conditional',
    condition: 'The filer cannot afford court fees.',
    note: 'Request to Waive Court Fees (fee waiver). Either party may file.' }
];

// Pre-filing notices drafted from client facts (NOT Judicial Council forms).
const NOTICES = [
  { id: '3-day-pay-or-quit', label: '3-Day Notice to Pay Rent or Quit', basis: 'nonpayment of rent' },
  { id: '3-day-perform-or-quit', label: '3-Day Notice to Perform Covenants or Quit', basis: 'lease violation (curable)' },
  { id: '3-day-quit', label: '3-Day Notice to Quit', basis: 'nuisance / illegal activity (incurable)' },
  { id: '30-day-notice', label: '30-Day Notice to Terminate Tenancy', basis: 'tenancy under 1 year (no-fault, where allowed)' },
  { id: '60-day-notice', label: '60-Day Notice to Terminate Tenancy', basis: 'tenancy of 1 year or more (no-fault, where allowed)' },
  { id: '90-day-notice', label: '90-Day Notice', basis: 'subsidized / special tenancies' }
];

function allSpecCodes() {
  const codes = new Set();
  for (const stage of STAGES) for (const f of stage.forms) codes.add(f.code);
  for (const f of SITUATIONAL) codes.add(f.code);
  return [...codes];
}

/**
 * Annotate the spec with live availability from the statewide catalog so the
 * system never silently promises a form it cannot actually generate.
 * @param {(code:string)=>object|null} getForm  e.g. getAllCourtForm
 */
function buildUdPacket(getForm) {
  const annotate = (f) => {
    const cat = getForm ? getForm(f.code) : null;
    return {
      ...f,
      title: cat ? cat.title : null,
      available: Boolean(cat),
      generatable: Boolean(cat && cat.role === 'prepare'),
      scope: 'statewide'
    };
  };
  return {
    matter: 'Unlawful Detainer (eviction)',
    jurisdiction: 'California Superior Court',
    stages: STAGES.map((s) => ({ ...s, forms: s.forms.map(annotate) })),
    situational: SITUATIONAL.map(annotate),
    notices: NOTICES,
    disclaimer: 'Standard set of California court forms for an unlawful detainer. Document preparation at the client’s direction — not legal advice, and not a determination of which forms a particular case requires.'
  };
}

module.exports = { STAGES, SITUATIONAL, NOTICES, allSpecCodes, buildUdPacket };
