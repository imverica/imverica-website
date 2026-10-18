/** Imverica contact details and a helper that makes them clickable. */
export const PHONE_DISPLAY = '+1 (916) 399-3992';
export const PHONE_TEL = 'tel:+19163993992';
export const EMAIL = 'info@imverica.com';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

/** HTML-escapes `text` and turns the phone number and email into tel: / mailto: links. */
export function linkifyContacts(text: string): string {
  return escapeHtml(text)
    .replace(/(?:\+?1[\s.-]?)?\(?916\)?[\s.-]?399[\s.-]?3992/g, (m) => `<a href="${PHONE_TEL}">${m}</a>`)
    .replace(/info@imverica\.com/gi, (m) => `<a href="mailto:${EMAIL}">${m}</a>`);
}
