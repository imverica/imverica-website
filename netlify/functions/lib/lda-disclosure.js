'use strict';

// California forms that ask whether a legal document assistant or unlawful
// detainer assistant helped for pay (Bus. & Prof. Code §§ 6400-6415). When
// Imverica prepares one of them, the answer is "did" and the block lists the
// registration. Registration facts default to what the site footer states;
// the business address is never stored in the code: it comes only from the
// LDA_ADDRESS environment variable (Netlify settings). LDA_DISCLOSURE=off
// turns the whole thing off.

const BLOCKS = {
  'ud-100': {
    did: 'UD-100[0].Page4[0].List22[0].Nineteendid[1]',
    didNot: 'UD-100[0].Page4[0].List22[0].Nineteendid[0]',
    name: 'UD-100[0].Page4[0].List22[0].Item22[0].Lia[0].TextField40[0]',
    address: 'UD-100[0].Page4[0].List22[0].Item22[0].Lib[0].TextField41[0]',
    phone: 'UD-100[0].Page4[0].List22[0].Item22[0].Lic[0].Phone_ft[0]',
    county: 'UD-100[0].Page4[0].List22[0].Item22[0].Lid[0].TextField42[0]',
    regNo: 'UD-100[0].Page4[0].List22[0].Item22[0].Lie[0].TextField43[0]',
    expires: 'UD-100[0].Page4[0].List22[0].Item22[0].Lif[0].DateField26[0]'
  },
  'ud-105': {
    did: 'UD-105[0].Page4[0].List7[0].Check561[1]',
    didNot: 'UD-105[0].Page4[0].List7[0].Check561[0]',
    name: 'UD-105[0].Page4[0].List7[0].Lia[0].AsstName[0]',
    address: 'UD-105[0].Page4[0].List7[0].Lic[0].Address[0]',
    phone: 'UD-105[0].Page4[0].List7[0].Lib[0].PhoneNum[0]',
    county: 'UD-105[0].Page4[0].List7[0].Lid[0].RegCounty[0]',
    regNo: 'UD-105[0].Page4[0].List7[0].Lie[0].RegNo[0]',
    expires: 'UD-105[0].Page4[0].List7[0].Lif[0].RegExp[0]'
  },
  'ud-150': {
    did: 'UD-150[0].Page1[0].List6[0].Yes1[1]',
    didNot: 'UD-150[0].Page1[0].List6[0].Yes1[0]',
    name: 'UD-150[0].Page1[0].List6[0].Lia[0].TextField6[0]',
    address: 'UD-150[0].Page1[0].List6[0].Lib[0].FillText8[0]',
    phone: 'UD-150[0].Page1[0].List6[0].Lic[0].Field1[0]',
    county: 'UD-150[0].Page1[0].List6[0].Lid[0].Field2[0]',
    regNo: 'UD-150[0].Page1[0].List6[0].Lie[0].Field3[0]',
    expires: 'UD-150[0].Page1[0].List6[0].Lif[0].Field4[0]'
  },
  'sum-130': {
    did: 'SUM-130[0].Page2[0].List3[0].item3[0].CBChoice1_cb[1]',
    didNot: 'SUM-130[0].Page2[0].List3[0].item3[0].CBChoice1_cb[0]',
    name: 'SUM-130[0].Page2[0].List4[0].Lia[0].FillText15[0]',
    address: 'SUM-130[0].Page2[0].List4[0].Lic[0].FillText17[0]',
    phone: 'SUM-130[0].Page2[0].List4[0].Lib[0].FillText16[0]',
    county: 'SUM-130[0].Page2[0].List4[0].Lid[0].FillText18[0]',
    regNo: 'SUM-130[0].Page2[0].List4[0].Lie[0].FillText19[0]',
    expires: 'SUM-130[0].Page2[0].List4[0].Lif[0].FillText20[0]'
  },
  'civ-100': {
    did: 'CIV-100[0].Page2[0].List4[0].UDAsst[0]',
    didNot: 'CIV-100[0].Page2[0].List4[0].UDAsst[1]',
    name: 'CIV-100[0].Page2[0].List4[0].P2Lia[0].FillText119[0]',
    address: 'CIV-100[0].Page2[0].List4[0].P2Lib[0].FillText120[0]',
    phone: 'CIV-100[0].Page2[0].List4[0].P2Lic[0].FillText123[0]',
    county: 'CIV-100[0].Page2[0].List4[0].P2Lid[0].FillText124[0]',
    regNo: 'CIV-100[0].Page2[0].List4[0].P2Lie[0].FillText125[0]',
    expires: 'CIV-100[0].Page2[0].List4[0].P2Lif[0].FillText126[0]'
  },
  'civ-105': {
    did: 'CIV-105[0].Page2[0].List6[0].Instructions[0].CheckBox26[0]',
    didNot: 'CIV-105[0].Page2[0].List6[0].Instructions[0].CheckBox26[1]',
    name: 'CIV-105[0].Page2[0].List6[0].Li6a[0].FillText119[0]',
    address: 'CIV-105[0].Page2[0].List6[0].Li6b[0].FillText120[0]',
    phone: 'CIV-105[0].Page2[0].List6[0].Li6c[0].FillText123[0]',
    county: 'CIV-105[0].Page2[0].List6[0].Li6d[0].FillText124[0]',
    regNo: 'CIV-105[0].Page2[0].List6[0].Li6e[0].FillText125[0]',
    expires: 'CIV-105[0].Page2[0].List6[0].Li6f[0].DateField1[0]'
  }
};

function ldaDetails(env = process.env) {
  return {
    name: env.LDA_ASSISTANT_NAME || 'Imverica LLC',
    address: env.LDA_ADDRESS || '',
    phone: env.LDA_PHONE || '(916) 399-3992',
    county: env.LDA_COUNTY || 'Sacramento',
    regNo: env.LDA_REG_NO || '2026-010',
    expires: env.LDA_REG_EXPIRES || '09/27/2028'
  };
}

// Returns the field values with the assistant block filled, plus the list of
// details still missing (only the address can be, when LDA_ADDRESS is unset).
function applyLdaDisclosure(slug, fieldValues = {}, env = process.env) {
  const block = BLOCKS[String(slug || '').toLowerCase()];
  if (!block || String(env.LDA_DISCLOSURE || '').toLowerCase() === 'off') return { values: fieldValues, missing: [] };
  const details = ldaDetails(env);
  const values = { ...fieldValues, [block.did]: true, [block.didNot]: false };
  const missing = [];
  for (const key of ['name', 'address', 'phone', 'county', 'regNo', 'expires']) {
    if (details[key]) values[block[key]] = details[key];
    else missing.push(key);
  }
  return { values, missing };
}

module.exports = { applyLdaDisclosure, ldaDetails, LDA_FORMS: Object.keys(BLOCKS), BLOCKS };
