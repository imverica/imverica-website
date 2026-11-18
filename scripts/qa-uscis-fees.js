// USCIS fee reader (netlify/functions/lib/uscis-fees.js) and /api/uscis-fees:
// parse the G-1055 table, fall back to the snapshot when uscis.gov does not
// answer, never invent a fee, and show the snapshot amounts on the built
// pricing pages. Runs offline (fetch is stubbed).
const fs = require('fs');
const path = require('path');
const lib = require('../netlify/functions/lib/uscis-fees');

function assert(cond, msg) { if (!cond) { console.error('uscis fees QA failed: ' + msg); process.exit(1); } }

const page = (title, rows, extra = '') => `<select><option value="97286" data-marker="i-485">I-485</option></select>
<h2 class="form-fee-title">${title} </h2><div class="form-fee-body"><table class="table"><thead><tr><th>Filing Category</th><th>Paper Filing Fee</th><th>Online Filing Fee</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div>${extra}`;

(async () => {
  // 1. Parsing
  const i485 = lib.mainFee(lib.parseFeeTable(page('I-485, Application to Register Permanent Residence or Adjust Status', [['General Filing', '$1,440', '$1,390'], ['If under 14 years of age', '$950', '$900']])));
  assert(i485 && i485.paper === 1440 && i485.online === 1390 && i485.category === 'General Filing', `I-485 parsed as ${JSON.stringify(i485)}`);
  assert(lib.parseTopicIds(page('x', [['a', '$1', '$1']]))['i-485'] === '97286', 'topic id of I-485 not read from the drop-down');
  const flagged = lib.mainFee(lib.parseFeeTable(page('I-589', [['General Filing', '$0', '$0']], '<p>Fees required under Pub. L. 119-21</p>')));
  assert(flagged.paper === 0 && flagged.extraFees === true, 'Pub. L. 119-21 note not detected');
  assert(lib.parseFeeTable('<html>no table</html>') === null, 'a page without a fee table must give no fee');

  // 2. Live read with a stubbed uscis.gov
  const ok = async (url) => ({ ok: true, status: 200, text: async () => (url.includes('topic_id=') ? page('Form', [['General Filing', '$520', '$470']]) : page('list', [['a', '$1', '$1']])) });
  const live = await lib.fetchUscisFees({ fetchImpl: ok, timeoutMs: 1000 });
  assert(live.fees['I-485'] && live.fees['I-485'].paper === 520, 'live read did not return I-485');

  // 3. uscis.gov down: the function answers from the snapshot, nothing invented
  const snapshot = require('../netlify/functions/data/uscis-fees.json');
  const realFetch = global.fetch;
  global.fetch = async () => { throw new Error('network down'); };
  delete require.cache[require.resolve('../netlify/functions/uscis-fees')];
  const res = await require('../netlify/functions/uscis-fees').handler({});
  global.fetch = realFetch;
  const body = JSON.parse(res.body);
  assert(res.statusCode === 200 && body.live === 0, 'function should still answer when USCIS is down');
  assert(Object.keys(body.fees).length === Object.keys(snapshot.fees).length, 'fallback should return exactly the snapshot fees');
  for (const [code, fee] of Object.entries(body.fees)) {
    assert(fee.from === 'snapshot' && fee.paper === snapshot.fees[code].paper, `${code}: fallback changed the snapshot fee`);
  }

  // 4. Built pricing pages show the snapshot amounts
  const dist = path.join(__dirname, '..', 'astro-site', 'dist');
  let shown = 0;
  for (const rel of ['pricing/index.html', 'ru/pricing/index.html', 'ua/pricing/index.html', 'mx/pricing/index.html']) {
    const file = path.join(dist, rel);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/data-uscis-fee="([^"]+)"[^>]*>([^<]*)</g)) {
      const fee = snapshot.fees[m[1]];
      if (!fee) continue;
      assert(m[2].trim() === `$${fee.paper.toLocaleString('en-US')} ↗`, `${rel}: ${m[1]} shows "${m[2].trim()}", snapshot has $${fee.paper}`);
      shown++;
    }
  }
  console.log(`uscis fees QA passed: parser, live read, snapshot fallback${shown ? `, ${shown} amounts on the built pricing pages` : ' (site not built: page check skipped)'}`);
})();
