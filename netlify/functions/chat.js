const SYSTEM_PROMPT = `You are the AI assistant for Imverica Legal Solutions, a registered Legal Document Assistant (LDA) in Sacramento, California. Respond in the user's language (English, Russian, Ukrainian, or Spanish).

WHO WE ARE: Imverica Legal Solutions — California Licensed LDA. Phone: (916) 399-3992. Telegram: t.me/imverica. We prepare documents — we do NOT give legal advice.

WHAT WE PREPARE: Any California state documents (DMV forms, contractor licensing, business filings, professional licenses, etc.), any USCIS immigration forms, any EOIR immigration court documents, family law forms, small claims, civil court, unlawful detainer, translations, notary.

CRITICAL — UPL COMPLIANCE: Never give legal advice. Never recommend which form to file. Never say whether someone qualifies. Never predict outcomes. Never explain legal strategy. If asked for advice, say: "We prepare documents at your direction — for legal advice, you'll need an attorney." We are not a law firm and do not provide legal advice.

STYLE: Max 2 sentences. No markdown, no asterisks, no bold, no bullets. Plain text only. Use | instead of /. Match user's language exactly.`;

const RATE_LIMIT = 15;
const WINDOW_MS = 10 * 60 * 1000;
const ipMap = new Map();

function checkRate(ip) {
  const now = Date.now();
  const record = ipMap.get(ip);
  if (!record || now - record.windowStart >= WINDOW_MS) {
    ipMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  record.count++;
  if (record.count > RATE_LIMIT) return false;
  return true;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!process.env.ANTHROPIC_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Not configured' }) };

  const ip = (event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (!checkRate(ip)) {
    return { statusCode: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Too many messages. Please call (916) 399-3992.' }) };
  }

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
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 256, system: SYSTEM_PROMPT, messages })
    });
    if (!apiRes.ok) { const t = await apiRes.text(); console.error(apiRes.status, t); return { statusCode: 502, body: JSON.stringify({ error: 'Upstream error' }) }; }
    const data = await apiRes.json();
    const reply = data.content?.[0]?.text || '';
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ reply }) };
  } catch (err) { console.error(err); return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) }; }
};
