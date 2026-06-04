'use strict';
/**
 * FL-120 — Response (Marriage/Domestic Partnership).
 *
 * The respondent's answer to an FL-100 petition. Shares FL-100's caption
 * + form-title structure (under Caption_sf instead of CaptionP1_sf) and the
 * same legal-relationship / residency / dates / minor-children blocks.
 *
 * Field names + labels are verbatim from the form (extract-ca-fields.js).
 * Caption is built by the shared ca-caption registry. Substantive relief
 * positions are left for attorney review.
 */

const { buildCaption, dissolutionTitleFields, _fmt } = require('./ca-caption');
const { clean, partyName } = _fmt;

function dateMdY(v) {
  const t = clean(v, 40);
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : t;
}
function truthy(v) {
  const t = clean(v, 20).toLowerCase();
  return v === true || ['yes', 'true', 'да', 'так', 'sí', 'si', '1'].includes(t);
}

function fl_120FieldValues(payload = {}) {
  const a = payload.formAnswers || payload.answers || {};
  const P1 = 'FL-120[0].Page1[0].';
  const CAP = P1 + 'Caption_sf[0].';

  // Caption (note: on a Response, the petitioner is still party1 in the
  // caption — the courts keep the original case caption).
  const v = buildCaption('fl-120', a);

  // Form title — what the original petition was for.
  Object.assign(v, dissolutionTitleFields(CAP + 'FormTitle[0].', a));

  // Legal relationship + dates (respondent confirms / states).
  const rel = clean(a.relationship_type, 40).toLowerCase();
  if (!/domestic|partner|партн/.test(rel)) v[P1 + 'WeAreMarried_cb[0]'] = true;
  v[P1 + 'DateOfMarriage_dt[0]'] = dateMdY(a.date_of_marriage);
  v[P1 + 'DateOfSeparation_dt[0]'] = dateMdY(a.date_of_separation);

  // Minor children mirror FL-100 (none / list up to 4).
  const children = Array.isArray(a.minor_children) ? a.minor_children.slice(0, 4) : [];
  if (truthy(a.no_minor_children) || (a.minor_children !== undefined && children.length === 0)) {
    v[P1 + 'ThereAreNoMinorChildren_cb[0]'] = true;
  } else if (children.length) {
    v[P1 + 'MinorChildren_sf[0].MinorChildrenList_cb[0]'] = true;
    const slots = [
      { n: 'Child1Name_tf[0]', d: 'Child1Birthdate_dt[0]', g: 'Child1Age_tf[0]' },
      { n: 'Child2Name_tf[0]', d: 'Child2Birthdate_dt[0]', g: 'Child2Age_tf[0]' },
      { n: 'Child3Name_tf[0]', d: 'Child3Date_dt[0]', g: 'Child3Age_tf[0]' },
      { n: 'Child4Name_tf[0]', d: 'Child4Birthdate_dt[0]', g: 'Child4Age_tf[0]' }
    ];
    children.forEach((ch, i) => {
      const s = slots[i]; if (!s) return;
      v[P1 + 'MinorChildren_sf[0].' + s.n] = clean(ch.name || ch.child_name, 60);
      v[P1 + 'MinorChildren_sf[0].' + s.d] = dateMdY(ch.birthdate || ch.dob);
      v[P1 + 'MinorChildren_sf[0].' + s.g] = clean(ch.age, 3);
    });
  }

  return Object.fromEntries(
    Object.entries(v).filter(([, val]) => val === true || (typeof val === 'string' && val !== ''))
  );
}

module.exports = { fl_120FieldValues };
