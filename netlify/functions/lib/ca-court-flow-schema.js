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
    steps: [
      {
        title: 'Court, landlord & tenant',
        fields: [
          { id: 'court_county', label: 'County where the property is located', type: 'text', required: true },
          { id: 'court_street_address', label: 'Court street address', type: 'text' },
          { id: 'court_city_zip', label: 'Court city and ZIP', type: 'text' },
          { id: 'case_number', label: 'Case number (if assigned)', type: 'text' },
          { id: 'plaintiff_name', label: 'Plaintiff (landlord/owner) — full name or business', type: 'text', required: true },
          { id: 'plaintiff_address_line1', label: 'Plaintiff street address', type: 'text' },
          { id: 'plaintiff_city', label: 'Plaintiff city', type: 'text' },
          { id: 'plaintiff_state', label: 'Plaintiff state', type: 'text', default: 'CA' },
          { id: 'plaintiff_zip', label: 'Plaintiff ZIP', type: 'text' },
          { id: 'plaintiff_phone', label: 'Plaintiff phone', type: 'tel' },
          { id: 'defendant_name', label: 'Defendant (tenant) — full name', type: 'text', required: true },
          { id: 'premises_address', label: 'Rental property address being recovered', type: 'text', required: true }
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
