// In-memory ban list (resets on cold start, good enough for basic protection)
const banned = new Set();
const requestCounts = new Map();

function isGibberish(text) {
  if (!text || text.trim().length < 2) return true;
  const clean = text.trim();
  // Check for repeated characters
  if (/(.)\1{5,}/.test(clean)) return true;
  // Check for keyboard mashing (too many consonants in a row)
  if (/[qwrtpsdfghjklzxcvbnm]{8,}/i.test(clean)) return true;
  // Check ratio of non-letter chars
  const letters = clean.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '').length;
  if (letters < clean.length * 0.3 && clean.length > 10) return true;
  return false;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const origin = event.headers.origin || '';
  const allowed = ['https://imverica.com', 'https://www.imverica.com'];
  if (!allowed.includes(origin)) {
    return { statusCode: 403, body: '' };
  }

  // Get client IP
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  // Check if banned
  if (banned.has(ip)) {
    return { statusCode: 403, body: '' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: '' };
  }

  const { messages, type, appointment } = body;

  // Handle appointment booking
  if (type === 'appointment' && appointment) {
    const { name, phone, email, time, service } = appointment;
    if (!name || !phone) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Name and phone required' }) };
    }

    const emailBody = `New appointment request:\n\nName: ${name}\nPhone: ${phone}\nEmail: ${email || 'not provided'}\nPreferred time: ${time || 'not specified'}\nService: ${service || 'not specified'}`;

    // Submit to Netlify Forms
    try {
      const formData = new URLSearchParams({
        'form-name': 'appointment',
        'name': name,
        'phone': phone,
        'email': email || '',
        'time': time || '',
        'service': service || ''
      });
      await fetch('https://imverica.com/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
    } catch(e) {
      console.error('Netlify form error:', e);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin },
      body: JSON.stringify({ ok: true })
    };
  }

  if (!Array.isArray(messages) || messages.length > 20) {
    banned.add(ip);
    return { statusCode: 403, body: '' };
  }

  for (const m of messages) {
    if (!m.role || !m.content || typeof m.content !== 'string' || m.content.length > 2000) {
      banned.add(ip);
      return { statusCode: 403, body: '' };
    }
    if (!['user', 'assistant'].includes(m.role)) {
      banned.add(ip);
      return { statusCode: 403, body: '' };
    }
  }

  // Check last user message for gibberish
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  if (lastUserMsg && isGibberish(lastUserMsg.content)) {
    // Count gibberish attempts
    const count = (requestCounts.get(ip) || 0) + 1;
    requestCounts.set(ip, count);
    if (count >= 2) {
      banned.add(ip);
    }
    return { statusCode: 403, body: '' };
  } else {
    requestCounts.delete(ip);
  }

  // Rate limiting: max 30 requests per IP per cold start
  const reqCount = (requestCounts.get(ip + '_total') || 0) + 1;
  requestCounts.set(ip + '_total', reqCount);
  if (reqCount > 30) {
    banned.add(ip);
    return { statusCode: 403, body: '' };
  }

  // Check business hours (Pacific Time)
  const now = new Date();
  const ptOffset = -7; // PDT (adjust to -8 for PST in winter)
  const ptHour = (now.getUTCHours() + ptOffset + 24) % 24;
  const ptDay = now.getUTCDay(); // 0=Sun, 6=Sat
  const isBusinessHours = ptDay >= 1 && ptDay <= 5 && ptHour >= 10 && ptHour < 16;

  const systemPrompt = `You are a scheduling and info assistant for Imverica Legal Solutions, a California-licensed Legal Document Assistant (LDA) serving clients worldwide remotely.

Business hours: Monday–Friday 10:00 AM – 4:00 PM Pacific Time. Current status: ${isBusinessHours ? 'OPEN' : 'CLOSED'}.
Phone: (916) 399-3992 | Telegram: @imverica | Email: imverica@gmail.com

Services we prepare documents for:
USCIS: U4U (Uniting for Ukraine), TPS/I-821, Asylum/I-589, I-485, I-765, N-400, N-600, I-130, I-131 (travel document), I-131 (advance parole — separate), I-539, I-601/I-601A, I-751, I-864, I-918 (U visa), VAWA, EB-1/EB-2/EB-3/I-140, I-526, B1/B2/F-1/K-1/J-1 visas, FOIA requests to USCIS.
EOIR: EOIR-33 (change of address), EOIR-28, Motion to Continue, Motion to Change Venue, Master Hearing documents, Bond Hearing documents. Note: appeals, Motion to Reopen, Individual Hearing often require an attorney.
Family Law (California): Dissolution, Summary Dissolution, Legal Separation, Child Custody, Child Support, DVRO forms.
Small Claims (California): document preparation for claims. Current limit $12,500 for individuals.
Civil: Superior Court civil complaints and responses.
Unlawful Detainer: landlord and tenant UD documents.
Translations: coming soon.
Business: LLC formation, DBA, EIN/SS-4, Operating Agreement. Power of Attorney/Notary/Apostille coming soon.

STRICT RULES:
- Respond in the SAME language the user writes in
- NEVER translate form names or court names: I-130, I-485, I-918, USCIS, EOIR, Unlawful Detainer, dissolution, pro se, adjustment of status — always keep in original English even when responding in Russian or other languages
- NOT an attorney. Cannot give legal advice. Never say what client should do legally
- Never quote prices. Say pricing depends on scope, contact us for a quote
- No markdown: no **, no ##, no bullet dashes. Plain text only
- Maximum 2-3 short sentences. Never more
- We work with clients worldwide remotely by phone, email, Telegram
- If user wants to book appointment: tell them you will collect their info. Ask for name, phone (required), preferred day/time, and service needed. Email optional
- If outside business hours: acknowledge and offer to take their info for a callback next business day
- If asked about services marked "coming soon" (translations, notary, apostille, power of attorney): say we are expanding this service and to contact us to discuss
- For EOIR matters that require attorney: say we recommend consulting a licensed attorney for this proceeding and we can provide a referral from our professional network
- Never give legal strategy or predict outcomes`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: systemPrompt,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: 502, body: '' };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
      },
      body: JSON.stringify({ reply: data.content?.[0]?.text || '' })
    };

  } catch (err) {
    return { statusCode: 500, body: '' };
  }
};
