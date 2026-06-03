/**
 * Cloudflare Email Worker — Gmail reply → Imverica portal bridge.
 *
 * Triggered by Cloudflare Email Routing on `reply.imverica.com` (any
 * address — uses catch-all). Parses the inbound message and POSTs it
 * to /api/messages-inbound on imverica.com with a shared-secret header
 * for auth.
 *
 * Setup (one-time, in Cloudflare dashboard):
 *   1. imverica.com → Email → Email Routing → "Get started"
 *   2. Cloudflare auto-adds the MX record(s) — accept them.
 *   3. Email Routing → "Routing rules" → "Catch-all address" →
 *      Action: "Send to a Worker" → select this worker.
 *      Then "Custom addresses" → ALSO add `reply@reply.imverica.com`
 *      and any other addresses you want routed.
 *   4. Bind a secret variable in Workers → Settings → Variables:
 *        IMVERICA_INBOUND_SECRET = <random 32-char string>
 *   5. Set the SAME value on Netlify env vars (so the webhook accepts):
 *        MESSAGES_INBOUND_SECRET = <same random string>
 *
 * Reference:
 *   https://developers.cloudflare.com/email-routing/email-workers/
 */

export default {
  async email(message, env, ctx) {
    try {
      // 1. Slurp the raw mail (RFC 822) and parse just enough to extract
      //    Subject, From, To, Reply-To, headers, and the text body.
      const raw = await new Response(message.raw).text();

      // Cloudflare's `message` already exposes from/to/headers via
      // EmailMessage — prefer those when available.
      const from = message.from || '';
      const to = message.to || '';   // The reply+TOKEN@reply.imverica.com address
      const subject = message.headers.get('subject') || '';
      const inReplyTo = message.headers.get('in-reply-to') || '';
      const messageId = message.headers.get('message-id') || '';

      // 2. Decode the body — Cloudflare gives us the raw MIME. Pull the
      //    first text/plain part if multipart, else the whole body.
      const body = extractPlainTextBody(raw);

      // 3. POST to our webhook on imverica.com.
      const payload = {
        from,
        to: [to],                       // /api/messages-inbound looks at to[]
        subject,
        text: body,
        headers: {
          'In-Reply-To': inReplyTo,
          'Message-Id': messageId,
          'X-Imverica-Forwarded-By': 'cloudflare-email-worker'
        }
      };

      const resp = await fetch('https://imverica.com/api/messages-inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Imverica-Inbound-Secret': env.IMVERICA_INBOUND_SECRET
        },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        // Reject the email so the sender (gmail user / owner) sees a
        // bounce. They can retry or escalate.
        const text = await resp.text().catch(() => '');
        console.error('Webhook rejected:', resp.status, text);
        message.setReject('Imverica portal could not process this reply (' + resp.status + ').');
        return;
      }
      // Success — silently consume the email (no forward, no bounce).
    } catch (err) {
      console.error('Email worker error:', err && err.message);
      message.setReject('Imverica portal temporarily unavailable.');
    }
  }
};

// ─── Helpers ──────────────────────────────────────────────────────
// Pull the first text/plain part from a raw MIME message. If the
// message is single-part text, return its body. Falls back to the
// raw body minus the headers if nothing else is found.
function extractPlainTextBody(rawMime) {
  // Split header / body by the first blank line.
  const splitIdx = rawMime.indexOf('\r\n\r\n');
  if (splitIdx < 0) return rawMime;
  const headers = rawMime.slice(0, splitIdx);
  const body = rawMime.slice(splitIdx + 4);

  // If multipart, find the text/plain part.
  const contentType = /content-type:\s*(.+?)(?:\r?\n[A-Za-z]|$)/i.exec(headers);
  const ct = contentType ? contentType[1].toLowerCase() : '';

  if (ct.startsWith('multipart/')) {
    const boundaryMatch = /boundary="?([^";\r\n]+)"?/i.exec(ct);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = body.split('--' + boundary);
      for (const part of parts) {
        const cthdr = /content-type:\s*text\/plain/i.exec(part);
        if (cthdr) {
          const partSplit = part.indexOf('\r\n\r\n');
          if (partSplit >= 0) {
            const partBody = part.slice(partSplit + 4);
            const cleaned = decodePartBody(partBody, part);
            if (cleaned.trim()) return cleaned;
          }
        }
      }
    }
  }

  // Single-part: just return the body
  return decodePartBody(body, headers);
}

// Decode quoted-printable or base64 based on Content-Transfer-Encoding.
function decodePartBody(body, headers) {
  const cte = /content-transfer-encoding:\s*([^\r\n;]+)/i.exec(headers);
  const enc = cte ? cte[1].trim().toLowerCase() : '7bit';
  let txt = body;
  if (enc === 'quoted-printable') {
    txt = txt
      .replace(/=\r?\n/g, '')
      .replace(/=([A-Fa-f0-9]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  } else if (enc === 'base64') {
    try { txt = atob(body.replace(/\s/g, '')); } catch {}
  }
  // Strip up to the closing MIME boundary if it leaked in
  const closeIdx = txt.indexOf('\r\n--');
  if (closeIdx > 0) txt = txt.slice(0, closeIdx);
  return txt;
}
