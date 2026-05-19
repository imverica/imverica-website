/**
 * Bridges CTA links across the Astro site to the legacy intake wizard.
 *
 * Every "Get Started" / "Start my X package" button uses
 *   href="/#get-started?form=I-485"
 * to identify itself as a wizard-launch CTA. This module intercepts those
 * clicks site-wide, prevents the navigation, and calls the wizard's global
 * window.openIntakeModal(formCode) which is installed by wizard.ts.
 *
 * Also handles the case where a user lands directly on a URL containing
 * #get-started (e.g. they bookmarked the CTA) — in that case we trigger
 * the modal after the wizard has finished initializing.
 */

function getFormParam(href: string): string {
  // Accepts /#get-started?form=I-485, #get-started?form=I-485, etc.
  const hash = href.split('#').pop() || '';
  const qs = hash.split('?')[1];
  if (!qs) return '';
  const params = new URLSearchParams(qs);
  return params.get('form') || '';
}

function tryOpenWithRetry(formCode: string, attempts = 8): void {
  // The wizard JS is deferred. If the user clicks while it's still loading,
  // retry a few times before giving up.
  const w = window as any;
  if (typeof w.openIntakeModal === 'function') {
    w.openIntakeModal(formCode || undefined);
    return;
  }
  if (attempts <= 0) {
    // Final fallback: surface the failure to user (they'll see no modal,
    // but the page didn't navigate either, so they know something is up).
    console.warn('Intake wizard not initialized; CTA click ignored.');
    return;
  }
  setTimeout(() => tryOpenWithRetry(formCode, attempts - 1), 150);
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
    const formCode = getFormParam(anchor.getAttribute('href') || '');
    tryOpenWithRetry(formCode);
  });

  // If the page loaded with #get-started already in the URL, open the
  // modal once the wizard is ready.
  if (window.location.hash.startsWith('#get-started')) {
    const formCode = getFormParam(window.location.hash);
    tryOpenWithRetry(formCode);
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
