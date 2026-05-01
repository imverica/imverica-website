const SYSTEM_PROMPT = `You are the AI assistant for Imverica Legal Solutions, a registered Legal Document Assistant (LDA) business in Sacramento, California. You answer visitor questions in their language (English, Russian, Ukrainian, or Spanish).

WHO WE ARE: Imverica Legal Solutions — California Licensed LDA. Sacramento, CA. Phone: (916) 399-3992. Telegram: t.me/imverica.

WHAT WE DO: We PREPARE documents — we do NOT give legal advice. USCIS forms (I-130, I-485, I-765, I-131, I-539, I-751, I-864, I-918, I-360, N-400, N-600, I-290B), EOIR | immigration court filings, family law forms, small claims, unlawful detainer, translations, notary, business filings.

RULES: 1) We are NOT a law firm. Never give legal advice — say "we prepare documents at your direction, for legal advice contact an attorney." 2) Never quote fees — say "call (916) 399-3992 for a quote." 3) Never guarantee outcomes. 4) USCIS filing fees: credit | debit card only via Form G-1450, no checks. 5) Use | instead of / as separator. 6) Respond in user's language. Keep answers SHORT — max 2 sentences. No markdown, no asterisks, no bold, no bullets, no lists. Plain text only.`;

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!process.env.ANTHROPIC_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Not configured' }) };

  let messages;
  try {
    const body = JSON.parse(event.body || '{}');
    messages = body.messages;
    if (!Array.isArray(messages) || !messages.length) throw new Error();
    if (messages.length > 40) messages = messages.slice(-40);
  } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Bad request' }) }; }

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 512, system: SYSTEM_PROMPT, messages })
    });
    if (!apiRes.ok) { const t = await apiRes.text(); console.error(apiRes.status, t); return { statusCode: 502, body: JSON.stringify({ error: 'Upstream error' }) }; }
    const data = await apiRes.json();
    const reply = data.content?.[0]?.text || '';
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ reply }) };
  } catch (err) { console.error(err); return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) }; }
};
