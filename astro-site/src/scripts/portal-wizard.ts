/**
 * Sends a recognized form straight to its wizard in the client portal:
 * sign-in by email code, then the form's questions and the PDF draft.
 * USCIS forms open with /account.html?open=uscis&form=CODE; California court
 * forms open from the saved court route with ?open=california-court.
 * Anything else (or a failed lookup) returns '' and the caller keeps the
 * short request form.
 */

interface PortalForms { uscis: string[]; court: string[] }

let formsPromise: Promise<PortalForms | null> | null = null;

function loadPortalForms(): Promise<PortalForms | null> {
  if (!formsPromise) {
    formsPromise = fetch('/portal-forms.json')
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return formsPromise;
}

function langParam(): string {
  const lang = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
  return ['ru', 'uk', 'es'].includes(lang) ? `&lang=${lang}` : '';
}

export function courtRouteUrl(): string {
  return `/account.html?open=california-court${langParam()}`;
}

export async function portalWizardUrl(rawCode: string): Promise<string> {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return '';
  const forms = await loadPortalForms();
  if (!forms) return '';
  if (forms.uscis.includes(code)) return `/account.html?open=uscis&form=${encodeURIComponent(code)}${langParam()}`;
  if (!forms.court.includes(code)) return '';
  try {
    // The portal opens the court form saved here (the finder may already
    // have saved it with the filing county; keep that one).
    const saved = JSON.parse(localStorage.getItem('imverica_court_route') || 'null');
    if (!saved || String(saved.formCode || '').toUpperCase() !== code) {
      localStorage.setItem('imverica_court_route', JSON.stringify({
        county: '',
        countySlug: localStorage.getItem('imverica_court_county') || '',
        formCode: code,
        localFormId: ''
      }));
    }
  } catch {
    return '';
  }
  return courtRouteUrl();
}
