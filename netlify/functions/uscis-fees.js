/**
 * GET /api/uscis-fees — current USCIS filing fees for the forms on the
 * pricing pages, read live from the official Fee Schedule (G-1055).
 *
 * The CDN keeps the answer for 6 hours, so uscis.gov is asked at most a few
 * times a day whatever the traffic. If USCIS does not answer, the last
 * snapshot (data/uscis-fees.json, refreshed by scripts/update-uscis-fees.js)
 * is returned instead; a fee is never invented.
 */
const { fetchUscisFees } = require('./lib/uscis-fees');
const snapshot = require('./data/uscis-fees.json');

exports.handler = async () => {
  let live = { fees: {}, errors: ['not fetched'] };
  try {
    live = await fetchUscisFees({ timeoutMs: 7000 });
  } catch (err) {
    live = { fees: {}, errors: [err.message] };
  }
  const fees = {};
  for (const [code, fee] of Object.entries(snapshot.fees || {})) fees[code] = { ...fee, from: 'snapshot', checked: snapshot.checked };
  for (const [code, fee] of Object.entries(live.fees || {})) fees[code] = { ...fee, from: 'live', checked: live.checked };
  const liveCount = Object.keys(live.fees || {}).length;
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // A full live answer is cached longer than a partial one.
      'Cache-Control': liveCount ? 'public, max-age=1800, s-maxage=21600, stale-while-revalidate=86400' : 'public, max-age=300, s-maxage=900'
    },
    body: JSON.stringify({ source: 'https://www.uscis.gov/g-1055', live: liveCount, fees })
  };
};
