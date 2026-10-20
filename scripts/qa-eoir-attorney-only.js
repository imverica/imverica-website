// Immigration court (EOIR) is attorney-only: the finder, the chat and the
// built site must never offer to prepare an EOIR filing for an individual.
// Run: node scripts/qa-eoir-attorney-only.js  (after `npm run build` in astro-site
// for the site checks).
const fs = require('fs');
const path = require('path');
const Module = require('module');

// chat.js pulls in @netlify/blobs through the abuse guard; stub it.
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === '@netlify/blobs') return { getStore: () => ({ get: async () => null, set: async () => {}, setJSON: async () => {}, getWithMetadata: async () => null }) };
  return load.call(this, request, ...rest);
};

let failures = 0;
function check(ok, label) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failures++;
}

async function main() {
  const route = require('../netlify/functions/route');
  const call = async (q) => JSON.parse((await route.handler({ httpMethod: 'GET', queryStringParameters: { q }, headers: {} })).body);

  const attorneyOnly = [
    'EOIR-42B', 'EOIR-29 appeal', 'cancellation of removal', 'I have a hearing in immigration court', 'I got an NTA notice to appear',
    'deportation case', 'BIA appeal', 'motion to reopen in immigration court', 'bond hearing ICE detention',
    'у мужа суд по депортации', 'иммиграционный суд', 'імміграційний суд', 'депортація',
    'tengo corte de inmigración', 'cancelación de remoción', 'audiencia de deportación'
  ];
  for (const q of attorneyOnly) {
    const b = await call(q);
    check(b.attorneyOnly === true && !b.route.formCode && /attorney|адвокат|abogado/i.test(b.message), `route attorney-only: ${q}`);
  }
  const lang = await call('у мужа суд по депортации');
  check(/иммиграционном суде/.test(lang.message), 'route answers in Russian');

  const uscis = [['I-485 green card', 'I-485'], ['work permit', 'I-765'], ['asylum', 'I-589'], ['remove conditions on green card', 'I-751'], ['green card renewal I-90', 'I-90'], ['FL-300 custody', 'FL-300']];
  for (const [q, code] of uscis) {
    const b = await call(q);
    check(!b.attorneyOnly && b.route.formCode === code, `route still routes: ${q} -> ${code} (got ${b.route.formCode})`);
  }

  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test';
  let modelCalls = 0;
  global.fetch = async () => { modelCalls++; throw new Error('offline'); };
  const chat = require('../netlify/functions/chat');
  for (const [q, re] of [['у меня суд по депортации', /иммиграционном суде/], ['I got an NTA', /Immigration court/], ['tengo corte de inmigración', /corte de inmigración/], ['у мене імміграційний суд', /імміграційному суді/]]) {
    const res = await chat.handler({ httpMethod: 'POST', headers: { origin: 'https://imverica.com', 'x-forwarded-for': '10.0.0.1' }, body: JSON.stringify({ messages: [{ role: 'user', content: q }] }) });
    const body = JSON.parse(res.body);
    check(res.statusCode === 200 && re.test(body.reply || ''), `chat attorney-only: ${q}`);
  }
  check(modelCalls === 0, 'chat never calls the model for EOIR questions');

  const dist = path.join(__dirname, '..', 'astro-site', 'dist');
  if (fs.existsSync(dist)) {
    const bad = [];
    (function walk(dir) {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (f.endsWith('.html')) {
          const html = fs.readFileSync(p, 'utf8');
          if (/get-started\?(?:form|topic)=EOIR|data-formcode="EOIR|EOIR document prep|Start my EOIR|EOIR-\d+[A-Z]?<\/strong>[^<]*<\/td>/i.test(html)) bad.push(path.relative(dist, p));
        }
      }
    })(dist);
    check(bad.length === 0, `built pages without consumer EOIR offers${bad.length ? ': ' + bad.slice(0, 10).join(', ') : ''}`);
  } else {
    console.log('skip site checks: astro-site/dist not built');
  }

  console.log(failures ? `${failures} failed` : 'all passed');
  process.exit(failures ? 1 : 0);
}
main().catch((err) => { console.error(err); process.exit(1); });
