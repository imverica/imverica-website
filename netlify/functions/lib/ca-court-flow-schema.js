'use strict';
/**
 * Static intake schema for California court forms.
 *
 * Declarative question list per registered form. Each field `id` is exactly
 * the answer key the form's *-map.js reads (so wizard/component answers feed
 * straight into generate-court-pdf). Labels are plain-language versions of
 * the form's own /TU tooltips — no invented legal labels.
 *
 * Shape mirrors the immigration flow schema the wizard already understands:
 *   { code, title, steps: [ { title, fields: [ { id, label, type, ... } ] } ] }
 *
 * Field types: 'text' | 'date' | 'select' | 'tel' | 'email' | 'money' |
 *              'children' (repeatable name/dob/age group)
 *
 * Pure data — no side effects. Consumed by the court-intake component and
 * validated by scripts/qa-ca-court-flow-schema.js.
 */

// Reused building blocks ------------------------------------------------
const CASE_TYPE_OPTIONS = [
  { value: 'dissolution', label: 'Dissolution (Divorce)' },
  { value: 'legal_separation', label: 'Legal Separation' },
  { value: 'nullity', label: 'Nullity (Annulment)' }
];
const RELATIONSHIP_OPTIONS = [
  { value: 'marriage', label: 'Marriage' },
  { value: 'domestic_partnership', label: 'Domestic Partnership' }
];

// The caption block is shared by the petition-style forms.
function captionStep(party1Label, party2Label) {
  return {
    title: 'Court & parties',
    fields: [
      { id: 'court_county', label: 'California county where you are filing', type: 'text', required: true },
      { id: 'court_street_address', label: 'Court street address', type: 'text' },
      { id: 'court_city_zip', label: 'Court city and ZIP', type: 'text' },
      { id: 'court_branch_name', label: 'Court branch name', type: 'text' },
      { id: 'case_number', label: 'Case number (leave blank if not yet assigned)', type: 'text' },
      { id: 'petitioner_first_name', label: party1Label + ' — first name', type: 'text', required: true },
      { id: 'petitioner_middle_name', label: party1Label + ' — middle name', type: 'text' },
      { id: 'petitioner_last_name', label: party1Label + ' — last name', type: 'text', required: true },
      { id: 'respondent_first_name', label: party2Label + ' — first name', type: 'text', required: true },
      { id: 'respondent_middle_name', label: party2Label + ' — middle name', type: 'text' },
      { id: 'respondent_last_name', label: party2Label + ' — last name', type: 'text', required: true }
    ]
  };
}

function filerContactStep() {
  return {
    title: 'Your contact information',
    fields: [
      { id: 'petitioner_address_line1', label: 'Your street address', type: 'text' },
      { id: 'petitioner_city', label: 'City', type: 'text' },
      { id: 'petitioner_state', label: 'State', type: 'text', default: 'CA' },
      { id: 'petitioner_zip', label: 'ZIP code', type: 'text' },
      { id: 'petitioner_phone', label: 'Phone', type: 'tel' },
      { id: 'petitioner_email', label: 'Email', type: 'email' }
    ]
  };
}

const dissolutionFactsStep = {
  title: 'Marriage / partnership facts',
  fields: [
    { id: 'case_type', label: 'What are you requesting?', type: 'select', options: CASE_TYPE_OPTIONS, required: true, default: 'dissolution' },
    { id: 'relationship_type', label: 'Relationship type', type: 'select', options: RELATIONSHIP_OPTIONS, required: true, default: 'marriage' },
    { id: 'date_of_marriage', label: 'Date of marriage / registration', type: 'date' },
    { id: 'date_of_separation', label: 'Date of separation', type: 'date' },
    { id: 'petitioner_meets_residency', label: 'Have you lived in California 6+ months and this county 3+ months?', type: 'select',
      options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] }
  ]
};

const childrenStep = {
  title: 'Minor children',
  fields: [
    { id: 'minor_children', label: 'Minor children of this relationship (under 18)', type: 'children' }
  ]
};

// Per-form schemas -----------------------------------------------------
const SCHEMAS = {
  'fl-100': {
    code: 'FL-100',
    title: 'Petition — Marriage/Domestic Partnership',
    steps: [captionStep('Petitioner (you)', 'Respondent (other party)'), filerContactStep(), dissolutionFactsStep, childrenStep]
  },
  'fl-120': {
    code: 'FL-120',
    title: 'Response — Marriage/Domestic Partnership',
    steps: [captionStep('Petitioner (other party)', 'Respondent (you)'), filerContactStep(), dissolutionFactsStep, childrenStep]
  },
  'fl-110': {
    code: 'FL-110',
    title: 'Summons (Family Law)',
    steps: [
      {
        title: 'Parties & case',
        fields: [
          { id: 'petitioner_first_name', label: 'Petitioner — first name', type: 'text', required: true },
          { id: 'petitioner_last_name', label: 'Petitioner — last name', type: 'text', required: true },
          { id: 'respondent_first_name', label: 'Respondent — first name', type: 'text', required: true },
          { id: 'respondent_last_name', label: 'Respondent — last name', type: 'text', required: true },
          { id: 'case_number', label: 'Case number (if assigned)', type: 'text' }
        ]
      },
      filerContactStep()
    ]
  },
  'ud-100': {
    code: 'UD-100',
    title: 'Complaint — Unlawful Detainer (Eviction)',
    // Comprehensive landlord eviction intake. One flow collects every answer the
    // start-of-case packet needs (UD-100 + SUM-130 + UD-101 + CM-010); the maps
    // read these keys. County-agnostic; In-Pro-Per (you are the plaintiff).
    steps: [
      {
        title: 'Court, landlord & tenants',
        fields: [
          { id: 'court_county', label: 'County where the rental property is located', type: 'text', required: true },
          { id: 'court_street_address', label: 'Courthouse street address (auto-filled from county; confirm)', type: 'text' },
          { id: 'court_city_zip', label: 'Courthouse city and ZIP', type: 'text' },
          { id: 'court_branch_name', label: 'Courthouse / branch name', type: 'text' },
          { id: 'case_number', label: 'Case number (leave blank — not assigned until you file)', type: 'text' },
          { id: 'plaintiff_name', label: 'You, the landlord/owner — full name or business name', type: 'text', required: true },
          { id: 'plaintiff_type', label: 'You are a/an…', type: 'select', default: 'individual',
            options: [{ value: 'individual', label: 'Individual (over 18)' }, { value: 'partnership', label: 'Partnership' }, { value: 'corporation', label: 'Corporation' }, { value: 'public agency', label: 'Public agency' }] },
          { id: 'plaintiff_address_line1', label: 'Your street address', type: 'text' },
          { id: 'plaintiff_city', label: 'City', type: 'text' },
          { id: 'plaintiff_state', label: 'State', type: 'text', default: 'CA' },
          { id: 'plaintiff_zip', label: 'ZIP', type: 'text' },
          { id: 'plaintiff_phone', label: 'Phone', type: 'tel' },
          { id: 'plaintiff_email', label: 'Email', type: 'email' },
          { id: 'defendant_name', label: 'Tenant #1 — full name (the main tenant on the lease)', type: 'text', required: true },
          { id: 'additional_defendants', label: 'Every OTHER tenant and occupant — one name per line (list everyone, even if not on the lease — leaving someone out can stop the eviction)', type: 'textarea' },
          { id: 'doe_defendants', label: 'Include "DOES 1 to 10" for unknown occupants?', type: 'select', default: 'yes', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
          { id: 'doe_count', label: 'How many DOES? (defaults to 10)', type: 'text', default: '10', showWhen: { doe_defendants: 'yes' } },
          { id: 'premises_address', label: 'Rental property street address you are recovering', type: 'text', required: true },
          { id: 'premises_city', label: 'Rental property city', type: 'text' }
        ]
      },
      {
        title: 'The rental agreement',
        fields: [
          { id: 'tenancy_type', label: 'Type of tenancy', type: 'select', default: 'month-to-month',
            options: [{ value: 'month-to-month', label: 'Month-to-month' }, { value: 'fixed term', label: 'Fixed-term lease (e.g., 1 year)' }] },
          { id: 'tenancy_type_specify', label: 'Describe the term (e.g., "one year")', type: 'text', showWhen: [{ id: 'tenancy_type', equals: 'fixed term' }] },
          { id: 'tenancy_start_date', label: 'Date the tenant agreed to rent (on or about)', type: 'date' },
          { id: 'rent_amount', label: 'Rent amount', type: 'money' },
          { id: 'rent_frequency', label: 'Rent is paid', type: 'select', default: 'monthly', options: [{ value: 'monthly', label: 'Monthly' }, { value: 'other', label: 'Other frequency' }] },
          { id: 'rent_due_day', label: 'Rent is due on the', type: 'select', default: 'first', options: [{ value: 'first', label: 'First of the month' }, { value: 'other', label: 'Another day' }] },
          { id: 'agreement_type', label: 'The agreement is', type: 'select', default: 'written', options: [{ value: 'written', label: 'Written' }, { value: 'oral', label: 'Oral' }] },
          { id: 'agreement_made_with', label: 'The agreement was made with', type: 'select', default: 'plaintiff', options: [{ value: 'plaintiff', label: 'You (the plaintiff)' }, { value: 'agent', label: "Your agent" }, { value: 'predecessor', label: 'A predecessor in interest' }, { value: 'other', label: 'Other' }] },
          { id: 'agreement_attached', label: 'Will you attach a copy of the written agreement (Exhibit 1)?', type: 'select', showWhen: [{ id: 'agreement_type', equals: 'written' }], options: [{ value: 'yes', label: 'Yes, attach it' }, { value: 'no', label: 'No (e.g., nonpayment case)' }] },
          { id: 'other_occupants', label: 'Other occupants NOT named above (e.g., "unknown occupants") — leave blank if none', type: 'text' }
        ]
      },
      {
        title: 'Tenant protections (Tenant Protection Act)',
        fields: [
          { id: 'subject_to_tpa', label: 'Is the tenancy subject to the Tenant Protection Act of 2019?', type: 'select', default: 'yes', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No (exempt)' }] },
          { id: 'tpa_exempt_subpart', label: 'If exempt, which Civil Code § 1946.2 subpart applies?', type: 'text', showWhen: [{ id: 'subject_to_tpa', equals: 'no' }] },
          { id: 'just_cause', label: 'Reason for ending the tenancy (just cause)', type: 'select', showWhen: [{ id: 'subject_to_tpa', equals: 'yes' }], options: [{ value: 'at-fault', label: 'At-fault (e.g., nonpayment, breach)' }, { value: 'no-fault', label: 'No-fault' }] }
        ]
      },
      {
        title: 'The notice you served',
        fields: [
          { id: 'notice_type', label: 'Which notice did you serve the tenant?', type: 'select', required: true,
            options: [
              { value: '3-day notice to pay rent or quit', label: '3-day notice to pay rent or quit' },
              { value: '3-day notice to perform covenants or quit', label: '3-day notice to perform covenants or quit' },
              { value: '3-day notice to quit', label: '3-day notice to quit' },
              { value: '30-day notice to quit', label: '30-day notice to quit' },
              { value: '60-day notice to quit', label: '60-day notice to quit' },
              { value: '30-day notice under the federal CARES Act', label: '30-day notice (CARES Act)' },
              { value: '3-day notice under Civil Code 1946.2(c)', label: '3-day notice under Civil Code § 1946.2(c)' }
            ] },
          { id: 'notice_served_date', label: 'Date the notice was served', type: 'date' },
          { id: 'notice_expired_date', label: 'Date the notice period expired', type: 'date' },
          { id: 'notice_election_forfeiture', label: 'Did the notice declare a forfeiture of the lease/rental agreement?', type: 'select', default: 'yes', options: [{ value: 'yes', label: 'Yes — the notice elected forfeiture' }, { value: 'no', label: 'No' }] },
          { id: 'notice_attached', label: 'Attach a copy of the notice to the complaint as an exhibit?', type: 'select', default: 'yes', options: [{ value: 'yes', label: 'Yes (required for residential)' }, { value: 'no', label: 'No' }] },
          { id: 'service_method', label: 'How was the notice delivered?', type: 'select',
            options: [{ value: 'personal', label: 'Personal (handed to the tenant)' }, { value: 'substituted', label: 'Substituted (left with someone + mailed)' }, { value: 'posting', label: 'Posted on the premises + mailed' }, { value: 'mail', label: 'Certified/registered mail' }] },
          { id: 'notices_differ_per_defendant', label: 'Were DIFFERENT notices (or dates/manner) served on different tenants?', type: 'select', default: 'no', options: [{ value: 'no', label: 'No — same for all' }, { value: 'yes', label: 'Yes (an attachment will be added)' }] }
        ]
      },
      {
        title: 'Money owed',
        fields: [
          { id: 'rent_due_amount', label: 'Total rent due when the notice was served', type: 'money' },
          { id: 'daily_rental_value', label: 'Daily fair rental value of the property', type: 'money' }
        ]
      }
    ]
  },
  'ud-105': {
    code: 'UD-105',
    title: 'Answer — Unlawful Detainer (tenant response)',
    // The TENANT's response. You are the defendant, In-Pro-Per.
    steps: [
      {
        title: 'Court & parties (you are the tenant)',
        fields: [
          { id: 'court_county', label: 'County (from the papers you were served)', type: 'text', required: true },
          { id: 'court_street_address', label: 'Courthouse street address', type: 'text' },
          { id: 'court_city_zip', label: 'Courthouse city and ZIP', type: 'text' },
          { id: 'court_branch_name', label: 'Courthouse / branch name', type: 'text' },
          { id: 'case_number', label: 'Case number (on the Summons/Complaint)', type: 'text', required: true },
          { id: 'plaintiff_name', label: "Landlord's name (the plaintiff, exactly as on the complaint)", type: 'text', required: true },
          { id: 'tenant_name', label: 'Your full name (the defendant answering)', type: 'text', required: true },
          { id: 'tenant_address_line1', label: 'Your street address', type: 'text' },
          { id: 'tenant_city', label: 'City', type: 'text' },
          { id: 'tenant_state', label: 'State', type: 'text', default: 'CA' },
          { id: 'tenant_zip', label: 'ZIP', type: 'text' },
          { id: 'tenant_phone', label: 'Phone', type: 'tel' },
          { id: 'tenant_email', label: 'Email', type: 'email' }
        ]
      },
      {
        title: 'The complaint against you',
        fields: [
          { id: 'complaint_demand', label: 'How much does the complaint say you owe? (a General Denial is only allowed if this is $1,000 or less)', type: 'money' }
        ]
      },
      {
        title: 'Your defenses',
        fields: [
          { id: 'defenses', label: 'Check every defense that applies to your situation', type: 'checkboxes',
            options: [
              { value: 'rent-control', label: 'The eviction violates a local rent-control / eviction-control ordinance' },
              { value: 'tpa-noncompliance', label: 'The eviction does not comply with the Tenant Protection Act of 2019' },
              { value: 'rent-over-1-year', label: '(Nonpayment) The demand is for rent due more than one year ago' },
              { value: 'nonpayment-rental-assistance', label: '(Nonpayment) Involves a pending/received rental-assistance application' }
            ] }
        ]
      }
    ]
  },
  'sc-100': {
    code: 'SC-100',
    title: "Plaintiff's Claim — Small Claims",
    steps: [
      {
        title: 'Court & plaintiff (you)',
        fields: [
          { id: 'court_county', label: 'County where you are filing', type: 'text', required: true },
          { id: 'court_street_address', label: 'Court street address', type: 'text' },
          { id: 'court_city_zip', label: 'Court city and ZIP', type: 'text' },
          { id: 'court_branch_name', label: 'Court branch name', type: 'text' },
          { id: 'case_number', label: 'Case number (if assigned)', type: 'text' },
          { id: 'plaintiff_name', label: 'Your full name or business name', type: 'text', required: true },
          { id: 'plaintiff_phone', label: 'Your phone', type: 'tel' },
          { id: 'plaintiff_address_line1', label: 'Your street address', type: 'text' },
          { id: 'plaintiff_city', label: 'City', type: 'text' },
          { id: 'plaintiff_state', label: 'State', type: 'text', default: 'CA' },
          { id: 'plaintiff_zip', label: 'ZIP', type: 'text' }
        ]
      },
      {
        title: 'Defendant & claim',
        fields: [
          { id: 'defendant_name', label: 'Defendant — full name or business', type: 'text', required: true },
          { id: 'defendant_phone', label: 'Defendant phone', type: 'tel' },
          { id: 'defendant_address_line1', label: 'Defendant street address', type: 'text' },
          { id: 'defendant_city', label: 'Defendant city', type: 'text' },
          { id: 'defendant_state', label: 'Defendant state', type: 'text', default: 'CA' },
          { id: 'defendant_zip', label: 'Defendant ZIP', type: 'text' },
          { id: 'claim_amount', label: 'Amount you are claiming (USD)', type: 'money', required: true },
          { id: 'claim_reason', label: 'Why does the defendant owe you this money?', type: 'textarea', required: true }
        ]
      }
    ]
  }
};

function getCourtSchema(formCode) {
  const slug = String(formCode || '').trim().toLowerCase().replace(/\s+/g, '');
  // accept "FL100" / "fl-100" / "fl 100"
  const norm = slug.replace(/^([a-z]+)-?(\d.*)$/, '$1-$2');
  return SCHEMAS[norm] || null;
}

function listCourtSchemas() { return Object.keys(SCHEMAS); }

module.exports = { getCourtSchema, listCourtSchemas, SCHEMAS };
