'use strict';

function clean(v, max = 300) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g,' ').trim().slice(0,max);
  return String(v || '').replace(/\s+/g,' ').trim().slice(0,max);
}
function digits(v, max = 30) { return clean(v, Math.max(80, max * 4)).replace(/\D/g,'').slice(0, max); }

function g_1650FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const v = {};

  v["GivenName[0]"] = clean(a.applicant_given_name || a.given_name || c.name?.split(' ').slice(0, -1).join(' ') || '', 60);
  v["MiddleName[0]"] = clean(a.applicant_middle_name || a.middle_name || '', 60);
  v["FamilyName[0]"] = clean(a.applicant_family_name || a.family_name || c.name?.split(' ').pop() || '', 60);


  v["AuthorizedPaymentAmt[0]"] = clean(a.authorized_payment_amount || a.payment_amount || '1000', 20);
  v["BankName[0]"] = clean(a.bank_name || 'Test Bank', 80);
  v["RoutingNumber[0]"] = digits(a.routing_number || '123456789', 9);
  v["AccountNumber[0]"] = digits(a.account_number || '1234567890', 20);
  v["BusinessName[0]"] = clean(a.business_name || '', 80);
  v["SignatureOfApplicant[0]"] = clean(a.signature || c.name || 'John Smith', 80);

  v["CB_AccountType[0]"] = true;
  v["CB_AccountType[1]"] = false;
  v["CB_CreditCardType[0]"] = true;
  v["CB_CreditCardType[1]"] = false;

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined && val !== null && val !== ''));
}

module.exports = { g_1650FieldValues };
