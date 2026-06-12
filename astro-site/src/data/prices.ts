/**
 * Published flat fees — extracted VERBATIM from the pricing page
 * (src/pages/pricing.astro). This module exists so tiles/cards can show
 * "From $X" without duplicating numbers by hand. If a price is not listed
 * here, the tile simply shows no price — never invent one.
 *
 * Government filing fees are always separate (stated on the pricing page).
 */

export interface PublishedPrice {
  amount: number;
  from?: boolean; // "from $X" on the pricing page
}

export const PRICES: Record<string, PublishedPrice> = {
  // USCIS / immigration
  'I-90': { amount: 199 },
  'I-765': { amount: 199 },
  'I-131': { amount: 179 },
  'I-864': { amount: 149 },
  'I-693': { amount: 99 },
  'G-639': { amount: 129 },
  'AR-11': { amount: 49 },
  'I-130': { amount: 499 },
  'I-485': { amount: 999 },
  'I-751': { amount: 899 },
  'N-400': { amount: 599 },
  'I-824': { amount: 249 },
  'I-589': { amount: 1599, from: true },
  // EOIR
  'EOIR-29': { amount: 799, from: true },
  'EOIR': { amount: 699, from: true }, // cheapest EOIR line: Motion to Reopen "from $699"
  // California courts
  'FL-100': { amount: 799, from: true },
  'FL-300': { amount: 349 },
  'FL-150': { amount: 149 },
  'FL-160': { amount: 149 },
  'SC-100': { amount: 249 },
  'WG-001': { amount: 199 },
  'EJ-001': { amount: 199 },
  'DE-111': { amount: 799, from: true },
  'CR-180': { amount: 349, from: true },
  'CR-181': { amount: 349, from: true },
  'DEMAND': { amount: 99 },
  // Business
  'LLC-1': { amount: 199 },
  'LLC-12': { amount: 99 },
  'SS-4': { amount: 79 },
  'FBN': { amount: 129 },
  'DBA': { amount: 129 },
  'ARTS': { amount: 549 } // corporation package (ARTS-GS + SI-550 + EIN + bylaws)
};

const TITLE_ALIASES: Record<string, string> = {
  'FBN / DBA': 'FBN',
  'Demand Letter': 'DEMAND',
  'EOIR — Immigration Court': 'EOIR'
};

/** Price label for a tile title like "I-485 — Adjustment of Status". */
export function priceForTitle(title: string): string | null {
  const t = String(title || '').trim();
  const aliased = TITLE_ALIASES[t];
  const code = aliased || (t.split('—')[0] || '').trim().toUpperCase();
  const hit = PRICES[code];
  if (!hit) return null;
  return `${hit.from ? 'from ' : ''}$${hit.amount.toLocaleString('en-US')}`;
}
