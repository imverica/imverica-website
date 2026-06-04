'use strict';

const TASKS = [
  { id: 'start', title: 'Start a claim', description: 'Plaintiff claim, attachments, and business-name forms.' },
  { id: 'serve', title: 'Serve court papers', description: 'Proof of service and proof of mailing forms.' },
  { id: 'before-hearing', title: 'Before the hearing', description: 'Counterclaims, subpoenas, appearances, amendments, and postponements.' },
  { id: 'judgment-review', title: 'Challenge or review a judgment', description: 'Corrections, motions to vacate, appeals, and writ proceedings.' },
  { id: 'judgment-money', title: 'Payment and enforcement', description: 'Assets, payment plans, defaults, satisfaction, and collection.' },
  { id: 'information', title: 'Official information sheets', description: 'Court instructions and reference documents that are not filled out.' }
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

// Current Judicial Council Small Claims forms. "prepare" forms have a
// client/server section that may be completed at the user's direction.
// Court orders, clerk certificates, and information sheets remain visible
// in the library but are never offered as client-generated documents.
const FORMS = [
  form('SC-100', "Plaintiff's Claim and ORDER to Go to Small Claims Court", 'start', 'prepare', 'Starts a small claims case.'),
  form('SC-100A', "Other Plaintiffs or Defendants (Attachment to Plaintiff's Claim)", 'start', 'prepare', 'Adds more plaintiffs or defendants to SC-100.'),
  form('SC-100-INFO', 'Information for the Plaintiff (Small Claims)', 'information', 'info', 'Official instructions for a small claims plaintiff.'),
  form('SC-101', "Attorney Fee Dispute (After Arbitration) (Attachment to Plaintiff's Claim)", 'start', 'prepare', 'Attachment for an attorney-fee dispute after arbitration.'),
  form('SC-103', 'Fictitious Business Name (Small Claims)', 'start', 'prepare', 'Identifies a party doing business under a fictitious name.'),
  form('SC-104', 'Proof of Service (Small Claims)', 'serve', 'prepare', 'Completed by the person who served the papers, not by a party.'),
  form('SC-104A', 'Proof of Mailing (Substituted Service) (Small Claims)', 'serve', 'prepare', 'Completed by the person who mailed papers after substituted service.'),
  form('SC-104B', 'What Is "Proof of Service?" (Small Claims)', 'information', 'info', 'Official proof-of-service instructions.'),
  form('SC-104C', 'How to Serve a Business or Public Entity (Small Claims)', 'information', 'info', 'Official service instructions for businesses and public entities.'),
  form('SC-105', 'Request for Court Order and Answer', 'before-hearing', 'prepare', 'Requests an order or answers another party’s request.'),
  form('SC-105A', 'Order on Request for Court Order', 'before-hearing', 'court', 'This order is completed by the court.'),
  form('SC-107', 'Small Claims Subpoena and Declaration', 'before-hearing', 'prepare', 'Requests appearance and production of documents.'),
  form('SC-108', 'Request to Correct or Cancel Judgment and Answer', 'judgment-review', 'prepare', 'Requests correction or cancellation of a judgment, or answers that request.'),
  form('SC-108A', 'Order on Request to Correct or Cancel Judgment', 'judgment-review', 'court', 'This order is completed by the court.'),
  form('SC-109', 'Authorization to Appear (Small Claims)', 'before-hearing', 'prepare', 'Authorizes a qualified representative to appear.'),
  form('SC-112A', 'Proof of Service by Mail (Small Claims)', 'serve', 'prepare', 'Completed by the person who mailed the papers.'),
  form('SC-113A', "Clerk's Certificate of Mailing", 'serve', 'court', 'This certificate is completed by the court clerk.'),
  form('SC-114', 'Request to Amend Party Name Before Hearing', 'before-hearing', 'prepare', 'Requests correction of a party name before the hearing.'),
  form('SC-120', "Defendant's Claim and ORDER to Go to Small Claims Court", 'before-hearing', 'prepare', 'Files a defendant’s claim against another party.'),
  form('SC-120A', "Other Plaintiffs or Defendants (Attachment to Defendant's Claim)", 'before-hearing', 'prepare', 'Adds parties to SC-120.'),
  form('SC-130', 'Notice of Entry of Judgment (Small Claims)', 'judgment-review', 'court', 'This notice is issued by the court.'),
  form('SC-132', 'Attorney-Client Fee Dispute (Attachment to Notice of Entry of Judgment)', 'judgment-money', 'prepare', 'Attachment used in an attorney-client fee dispute.'),
  form('SC-133', "Judgment Debtor's Statement of Assets", 'judgment-money', 'prepare', 'Lists a judgment debtor’s income and assets.'),
  form('SC-134', 'Application and Order to Produce Statement of Assets and Appear for Examination', 'judgment-money', 'prepare', 'Application to require a debtor to provide assets information and appear.'),
  form('SC-135', 'Notice of Motion to Vacate Judgment and Declaration', 'judgment-review', 'prepare', 'Asks the court to vacate a small claims judgment.'),
  form('SC-136', 'Application and Order to Produce Financial Statement or Appear for Examination—Consumer Debt', 'judgment-money', 'prepare', 'Consumer-debt financial statement or examination application.'),
  form('SC-140', 'Notice of Appeal', 'judgment-review', 'prepare', 'Files a small claims appeal where permitted.'),
  form('SC-145', 'Request to Pay Judgment to Court', 'judgment-money', 'prepare', 'Requests permission to pay the judgment to the court.'),
  form('SC-150', 'Request to Postpone Trial (Small Claims)', 'before-hearing', 'prepare', 'Requests a new trial date.'),
  form('SC-152', 'Order on Request to Postpone Trial (Small Claims)', 'before-hearing', 'court', 'This order is completed by the court.'),
  form('SC-200', 'Notice of Entry of Judgment (Small Claims)', 'judgment-review', 'court', 'This notice is issued by the court.'),
  form('SC-200-INFO', 'What to Do After the Court Decides Your Small Claims Case', 'information', 'info', 'Official post-judgment instructions.'),
  form('SC-202A', 'Decision on Attorney-Client Fee Dispute (Small Claims)', 'judgment-review', 'court', 'This decision is completed by the court.'),
  form('SC-220', 'Request to Make Payments (Small Claims)', 'judgment-money', 'prepare', 'Requests permission to pay a judgment over time.'),
  form('SC-221', 'Response to Request to Make Payments (Small Claims)', 'judgment-money', 'prepare', 'Responds to a requested payment plan.'),
  form('SC-222', 'Order on Request to Make Payments (Small Claims)', 'judgment-money', 'court', 'This order is completed by the court.'),
  form('SC-223', 'Declaration of Default in Payment of Judgment', 'judgment-money', 'prepare', 'Reports default under a judgment payment plan.'),
  form('SC-224', 'Response to Declaration of Default in Payment of Judgment', 'judgment-money', 'prepare', 'Responds to a declaration of payment default.'),
  form('SC-225', 'Order on Declaration of Default in Payments', 'judgment-money', 'court', 'This order is completed by the court.'),
  form('SC-225A', 'Attachment to Order on Declaration of Default in Payments', 'judgment-money', 'court', 'This attachment is completed with the court order.'),
  form('SC-290', 'Acknowledgment of Satisfaction of Judgment', 'judgment-money', 'prepare', 'Confirms that a judgment has been satisfied.'),
  form('SC-300', 'Petition for Writ (Small Claims)', 'judgment-review', 'prepare', 'Petitions the appellate division for a writ.'),
  form('SC-300-INFO', 'Information on Writ Proceedings in Small Claims Cases', 'information', 'info', 'Official information about small claims writ proceedings.')
];

function normalizeSmallClaimsCode(value) {
  return String(value || '').trim().toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^SC-?/, 'SC-');
}

function getSmallClaimsForm(code) {
  const normalized = normalizeSmallClaimsCode(code);
  return FORMS.find((entry) => entry.code === normalized) || null;
}

function listPreparableSmallClaimsSlugs() {
  return FORMS.filter((entry) => entry.role === 'prepare')
    .map((entry) => entry.code.toLowerCase());
}

function getSmallClaimsCatalog() {
  return {
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
  getSmallClaimsCatalog,
  getSmallClaimsForm,
  listPreparableSmallClaimsSlugs,
  normalizeSmallClaimsCode
};
