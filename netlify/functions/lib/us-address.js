const US_STATES_AND_TERRITORIES = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
  ['AS', 'American Samoa'],
  ['GU', 'Guam'],
  ['MP', 'Northern Mariana Islands'],
  ['PR', 'Puerto Rico'],
  ['VI', 'U.S. Virgin Islands'],
  ['UM', 'U.S. Minor Outlying Islands'],
  ['FM', 'Federated States of Micronesia'],
  ['MH', 'Marshall Islands'],
  ['PW', 'Palau'],
  ['AA', 'Armed Forces Americas'],
  ['AE', 'Armed Forces Europe'],
  ['AP', 'Armed Forces Pacific']
].map(([code, name]) => ({ code, name }));

const STATE_BY_CODE = new Map(US_STATES_AND_TERRITORIES.map((item) => [item.code, item]));

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeState(value) {
  const text = clean(value).toUpperCase();
  if (!text) return '';
  if (STATE_BY_CODE.has(text)) return text;
  const match = US_STATES_AND_TERRITORIES.find((item) => item.name.toUpperCase() === text);
  return match ? match.code : text;
}

function parseStateZip(value) {
  const text = clean(value);
  const match = text.match(/\b([A-Z]{2})\b[\s,]*(\d{5}(?:-\d{4})?)?\s*$/i);
  if (!match) return { state: '', zip: '' };
  return {
    state: normalizeState(match[1]),
    zip: match[2] || ''
  };
}

function parseUsAddressQuery(value) {
  const query = clean(value);
  if (!query) return null;

  const parts = query.split(',').map(clean).filter(Boolean);
  let line1 = query;
  let city = '';
  let state = '';
  let zip = '';

  if (parts.length >= 3) {
    const stateZip = parseStateZip(parts[parts.length - 1]);
    state = stateZip.state;
    zip = stateZip.zip;
    city = parts[parts.length - 2] || '';
    line1 = parts.slice(0, parts.length - 2).join(', ');
  } else {
    const stateZip = parseStateZip(query);
    if (stateZip.state || stateZip.zip) {
      state = stateZip.state;
      zip = stateZip.zip;
      const withoutStateZip = query
        .replace(new RegExp(`\\b${stateZip.state}\\b[\\s,]*${stateZip.zip || ''}\\s*$`, 'i'), '')
        .replace(/,\s*$/, '')
        .trim();
      const looseParts = withoutStateZip.split(',').map(clean).filter(Boolean);
      if (looseParts.length >= 2) {
        city = looseParts[looseParts.length - 1];
        line1 = looseParts.slice(0, -1).join(', ');
      } else {
        line1 = withoutStateZip || query;
      }
    }
  }

  return normalizeAddress({
    line1,
    city,
    state,
    zip,
    country: 'United States'
  });
}

function normalizeAddress(input = {}) {
  const line1 = clean(input.line1 || input.addressLine1 || input.streetAddress || input.street || input.q || input.query);
  return {
    line1,
    line2: clean(input.line2 || input.addressLine2 || input.secondaryAddress || input.unit),
    city: clean(input.city),
    state: normalizeState(input.state),
    zip: clean(input.zip || input.zipCode || input.ZIPCode || input.postalCode),
    country: clean(input.country) || 'United States'
  };
}

function compactAddress(address = {}) {
  return [
    clean(address.line1),
    clean(address.line2),
    clean(address.city),
    [normalizeState(address.state), clean(address.zip)].filter(Boolean).join(' '),
    clean(address.country)
  ].filter(Boolean).join(', ');
}

function toUspsQuery(address = {}) {
  return {
    streetAddress: address.line1,
    secondaryAddress: address.line2,
    city: address.city,
    state: normalizeState(address.state),
    ZIPCode: address.zip
  };
}

function stateSelectOptions() {
  return US_STATES_AND_TERRITORIES.map((item) => `${item.code} - ${item.name}`);
}

module.exports = {
  US_STATES_AND_TERRITORIES,
  clean,
  compactAddress,
  normalizeAddress,
  normalizeState,
  parseUsAddressQuery,
  stateSelectOptions,
  toUspsQuery
};
