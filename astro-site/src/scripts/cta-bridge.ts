/**
 * Bridges CTA links across the Astro site to the legacy intake wizard.
 *
 * Every "Get Started" / "Start my X package" button uses a hash CTA like
 *   href="/#get-started?form=I-485"        (a specific form number)
 *   href="/#get-started?topic=EOIR"        (a program / court matter)
 *   href="/#get-started?service=business"  (a service category)
 * This module intercepts those clicks site-wide, prevents the navigation,
 * and calls window.openIntakeModal(prefill, mode) installed by wizard.ts.
 *
 * Also handles the case where a user lands directly on a URL containing
 * #get-started (e.g. they bookmarked the CTA) — in that case we trigger
 * the modal after the wizard has finished initializing.
 */

function getParam(href: string, key: string): string {
  // Reads a query param from the hash portion: /#get-started?form=I-485
  const hash = href.split('#').pop() || '';
  const qs = hash.split('?')[1];
  if (!qs) return '';
  return new URLSearchParams(qs).get(key) || '';
}

type CtaMode = 'form' | 'topic' | 'service' | '';

// Resolve a #get-started CTA href into a prefill string + how to treat it.
// form > service > topic precedence: a specific form is the most concrete.
function resolveCta(href: string): { prefill: string; mode: CtaMode } {
  const form = getParam(href, 'form');
  if (form) return { prefill: form, mode: 'form' };
  const service = getParam(href, 'service');
  if (service) return { prefill: service, mode: 'service' };
  const topic = getParam(href, 'topic');
  if (topic) return { prefill: topic, mode: 'topic' };
  return { prefill: '', mode: '' };
}

function tryOpenWithRetry(prefill: string, mode: CtaMode = '', attempts = 8): void {
  // The wizard JS is deferred. If the user clicks while it's still loading,
  // retry a few times before giving up.
  const w = window as any;
  if (typeof w.openIntakeModal === 'function') {
    w.openIntakeModal(prefill || undefined, mode || undefined);
    return;
  }
  if (attempts <= 0) {
    // Final fallback: surface the failure to user (they'll see no modal,
    // but the page didn't navigate either, so they know something is up).
    console.warn('Intake wizard not initialized; CTA click ignored.');
    return;
  }
  setTimeout(() => tryOpenWithRetry(prefill, mode, attempts - 1), 150);
}

export function installCtaBridge(): void {
  if ((window as any).__imvCtaBridge) return;
  (window as any).__imvCtaBridge = true;

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const anchor = target.closest('a[href*="#get-started"]') as HTMLAnchorElement | null;
    if (!anchor) return;
    // Only intercept same-origin / no-modifier clicks.
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (anchor.target && anchor.target !== '_self') return;

    event.preventDefault();
    const { prefill, mode } = resolveCta(anchor.getAttribute('href') || '');
    tryOpenWithRetry(prefill, mode);
  });

  // If the page loaded with #get-started already in the URL, open the
  // modal once the wizard is ready.
  if (window.location.hash.startsWith('#get-started')) {
    const { prefill, mode } = resolveCta(window.location.hash);
    tryOpenWithRetry(prefill, mode);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installCtaBridge());
  } else {
    installCtaBridge();
  }
}

export {};
