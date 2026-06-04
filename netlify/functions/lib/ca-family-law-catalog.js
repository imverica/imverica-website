'use strict';

/**
 * California Family Law form catalog (cabinet wizard, category "family-law").
 *
 * Mirrors lib/ca-small-claims-catalog.js exactly in shape so the existing
 * cabinet wizard + direct-schema engine render and fill these with no new
 * UI logic. "prepare" forms have a party-completed section we generate at
 * the client's direction; the direct-schema engine still strips court-only
 * fields (judge/clerk/order sections) within each form. Pure court/clerk
 * documents are listed for reference but never client-generated.
 *
 * Only forms already decrypted into assets/form-cache/ca-court are listed.
 */

const TASKS = [
  { id: 'start', title: 'Start a divorce or separation', description: 'Petition, summons, and first-filing service forms.' },
  { id: 'respond', title: 'Respond to a petition', description: 'Answer a divorce, separation, or nullity petition.' },
  { id: 'disclosure', title: 'Financial disclosures', description: 'Income, expenses, property, and debts the law requires both sides to exchange.' },
  { id: 'children', title: 'Custody & child support', description: 'Custody, visitation, and child-support declarations and attachments.' },
  { id: 'orders', title: 'Request court orders', description: 'Ask for, or respond to, temporary orders during the case.' },
  { id: 'finish', title: 'Finish the case (default & judgment)', description: 'Default, uncontested judgment, and notice-of-judgment paperwork.' }
];

function form(code, title, task, role = 'prepare', description = '') {
  return {
    code,
    title,
    task,
    role,
    description,
    officialPageUrl: `https://selfhelp.courts.ca.gov/jcc-form/${code}`
  };
}

// Roles: 'prepare' = party-completed (generated at client direction);
// 'court' = the court/clerk completes it; 'info' = reference only.
const FORMS = [
  // Start
  form('FL-100', 'Petition — Marriage/Domestic Partnership', 'start', 'prepare', 'Starts a divorce, legal separation, or nullity case.'),
  form('FL-110', 'Summons (Family Law)', 'start', 'prepare', 'Served with the petition to open the case.'),
  form('FL-115', 'Proof of Service of Summons', 'start', 'prepare', 'Shows the petition and summons were served.'),
  form('FL-117', 'Notice and Acknowledgment of Receipt (Family Law)', 'start', 'prepare', 'Confirms a party received the papers by mail.'),

  // Respond
  form('FL-120', 'Response — Marriage/Domestic Partnership', 'respond', 'prepare', 'The responding party’s answer to the petition.'),

  // Financial disclosures
  form('FL-141', 'Declaration Regarding Service of Declaration of Disclosure', 'disclosure', 'prepare', 'States that the required disclosures were served.'),
  form('FL-142', 'Schedule of Assets and Debts', 'disclosure', 'prepare', 'Lists all assets and debts for disclosure.'),
  form('FL-150', 'Income and Expense Declaration', 'disclosure', 'prepare', 'Details income, deductions, and monthly expenses.'),
  form('FL-160', 'Property Declaration', 'disclosure', 'prepare', 'Lists community and separate property and debts.'),

  // Custody & child support
  form('FL-105', 'Declaration Under UCCJEA (Child Custody Jurisdiction)', 'children', 'prepare', 'Required when minor children are involved.'),
  form('FL-311', 'Child Custody and Visitation (Parenting Time) Application Attachment', 'children', 'prepare', 'Proposes a custody and visitation schedule.'),
  form('FL-342', 'Child Support Information and Order Attachment', 'children', 'prepare', 'Proposed child-support terms attached to an order.'),
  form('FL-343', 'Spousal, Partner, or Family Support Order Attachment', 'children', 'prepare', 'Proposed support terms attached to an order.'),

  // Request court orders
  form('FL-300', 'Request for Order', 'orders', 'prepare', 'Asks the court for temporary or other orders.'),
  form('FL-305', 'Temporary Emergency (Ex Parte) Orders', 'orders', 'prepare', 'Proposes emergency orders for the judge to sign.'),
  form('FL-320', 'Responsive Declaration to Request for Order', 'orders', 'prepare', 'Responds to another party’s Request for Order.'),
  form('FL-341', 'Child Custody and Visitation (Parenting Time) Order Attachment', 'orders', 'prepare', 'Proposed custody/visitation terms attached to an order.'),

  // Finish
  form('FL-165', 'Request to Enter Default', 'finish', 'prepare', 'Asks the clerk to enter the other party’s default.'),
  form('FL-170', 'Declaration for Default or Uncontested Dissolution', 'finish', 'prepare', 'Supports a default or uncontested judgment.'),
  form('FL-180', 'Judgment (Family Law)', 'finish', 'prepare', 'The proposed judgment a party prepares for the court to sign.'),
  form('FL-190', 'Notice of Entry of Judgment', 'finish', 'prepare', 'Prepared for the clerk to mail after judgment.')
];

function normalizeFamilyLawCode(value) {
  return String(value || '').trim().toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^FL-?/, 'FL-');
}

function getFamilyLawForm(code) {
  const normalized = normalizeFamilyLawCode(code);
  return FORMS.find((entry) => entry.code === normalized) || null;
}

function listPreparableFamilyLawSlugs() {
  return FORMS.filter((entry) => entry.role === 'prepare')
    .map((entry) => entry.code.toLowerCase());
}

function getFamilyLawCatalog() {
  return {
    category: 'family-law',
    tasks: TASKS.map((task) => ({
      ...task,
      formCount: FORMS.filter((entry) => entry.task === task.id).length
    })),
    forms: FORMS
  };
}

module.exports = {
  FORMS,
  TASKS,
  getFamilyLawCatalog,
  getFamilyLawForm,
  listPreparableFamilyLawSlugs,
  normalizeFamilyLawCode
};
