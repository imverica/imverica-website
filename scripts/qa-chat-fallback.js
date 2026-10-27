// Chat model fallbacks, against a mocked Anthropic API (no real calls):
// Opus 5.5 is asked with server-side `fallbacks: "default"` and its beta
// header; an error, timeout or empty reply is retried on Sonnet 5.5; a 400
// that rejects the beta field is retried on Opus 5.5 without it.
// Run: node scripts/qa-chat-fallback.js
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test';
const chat = require('../netlify/functions/chat');

let failures = 0;
function check(ok, label) {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}

const reply = (text, extra = {}) => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', ...extra }), text: async () => '' });
const failure = (status, body) => ({ ok: false, status, json: async () => ({}), text: async () => body });

async function ask(responses) {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ headers: init.headers, body: JSON.parse(init.body) });
    const next = responses[calls.length - 1];
    if (!next) throw new Error('unexpected call');
    return next;
  };
  const res = await chat.handler({
    httpMethod: 'POST',
    headers: { origin: 'https://imverica.com' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'What is Form I-765?' }] })
  });
  return { calls, body: JSON.parse(res.body) };
}

(async () => {
  const ok = await ask([reply('Form I-765 is the application for a work permit.')]);
  check(ok.calls.length === 1 && ok.calls[0].body.model === 'claude-opus-5-5', 'one call to Opus 5.5');
  check(ok.calls[0].body.fallbacks === 'default' && ok.calls[0].headers['anthropic-beta'] === 'server-side-fallback-2026-07-01', 'server-side fallback requested with its beta header');
  check(!('temperature' in ok.calls[0].body) && ok.calls[0].body.output_config.effort === 'low', 'no sampling parameters; effort low');
  check(/I-765/.test(ok.body.reply), `reply returned: ${ok.body.reply}`);

  const outage = await ask([failure(529, '{"type":"error","error":{"type":"overloaded_error"}}'), reply('Sonnet answer about I-765.')]);
  check(outage.calls.length === 2 && outage.calls[1].body.model === 'claude-sonnet-5-5', 'overloaded Opus 5.5 retries on Sonnet 5.5');
  check(!('fallbacks' in outage.calls[1].body) && !outage.calls[1].headers['anthropic-beta'], 'the Sonnet retry carries no beta field');
  check(/Sonnet answer/.test(outage.body.reply), 'Sonnet reply returned');

  const refused = await ask([reply('', { content: [], stop_reason: 'refusal' }), reply('Answer after refusal.')]);
  check(refused.calls.length === 2 && /Answer after refusal/.test(refused.body.reply), 'a refusal that reaches us still gets an answer');

  const betaRejected = await ask([failure(400, '{"type":"error","error":{"type":"invalid_request_error","message":"fallbacks: unknown field"}}'), reply('Plain Opus answer.')]);
  check(betaRejected.calls.length === 2 && betaRejected.calls[1].body.model === 'claude-opus-5-5' && !('fallbacks' in betaRejected.calls[1].body) && !betaRejected.calls[1].headers['anthropic-beta'], 'rejected beta: Opus 5.5 again without it');
  check(/Plain Opus answer/.test(betaRejected.body.reply), 'reply after the beta was dropped');

  const down = await ask([failure(500, 'down'), failure(500, 'down')]);
  check(down.calls.length === 2 && down.body.reply === '' && down.body.upstreamStatus === 500, 'both down: safe empty reply');

  if (failures) {
    console.log(`chat fallback QA: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log('chat fallback QA: OK');
})();
