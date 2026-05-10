'use strict';

function clean(v, max = 300) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(Boolean).join(' ').replace(/\s+/g,' ').trim().slice(0,max);
  return String(v || '').replace(/\s+/g,' ').trim().slice(0,max);
}
function dateMdY(v) {
  const t = clean(v, 40);
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : t;
}

function i_9FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const c = payload.contact || {};
  const today = new Date().toISOString().slice(0, 10);
  const v = {};

  v["Last Name Family Name from Section 1"] = clean(a.applicant_family_name || a.family_name || c.name?.split(' ').pop() || '', 80);
  v["First Name Given Name from Section 1"] = clean(a.applicant_given_name || a.given_name || c.name?.split(' ').slice(0, -1).join(' ') || '', 80);
  v["Middle initial if any from Section 1"] = clean(a.applicant_middle_name || a.middle_name || '', 1);

  v["First Name Given Name"] = clean(a.applicant_given_name || a.given_name || '', 80);
  v["Employee Middle Initial (if any)"] = clean(a.applicant_middle_name || a.middle_name || '', 1);
  v["Employee Other Last Names Used (if any)"] = clean(a.other_names_used || 'N/A', 80);
  v["Today's Date mmddyyy"] = dateMdY(a.signature_date || today);
  v["Signature of Employee"] = clean(a.signature || c.name || 'John Smith', 80);

  v["State"] = clean(a.mailing_state || a.state || 'CA', 2);
  v["ZIP Code"] = clean(a.mailing_zip || a.zip_code || '95815', 10);

  v["3 A lawful permanent resident Enter USCIS or ANumber"] = clean(a.alien_number || a.a_number || '123456789', 20);

  v["List A.  Document 2"] = clean(a.list_a_document_2 || '', 80);
  v["List A. Document 3"] = clean(a.list_a_document_3 || '', 80);
  v["List B Document 1 Title"] = clean(a.list_b_document_title || 'Driver License', 80);
  v["Additional Information"] = clean(a.additional_information || 'Test QA entry', 120);

  v["CB_1"] = true;
  v["CB_2"] = false;
  v["CB_3"] = false;
  v["CB_4"] = false;

  return Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined && val !== null && val !== ''));
}

module.exports = { i_9FieldValues };
