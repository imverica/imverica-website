/**
 * Scroll motion for the v2 homepage opening (components/HeroV2.astro): the
 * hero pins under the nav while the real form pages rise, scale and fan out
 * (the copy fades, the caption fades in), then the statement lights up word
 * by word.
 *
 * Does nothing unless the v2 hero was swapped in (index.astro, html.v2), and
 * only animates with html.hv2-motion (no reduced motion).
 */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function initHeroV2(): void {
  const hero = document.querySelector<HTMLElement>('.hv2-hero');
  if (!hero) return;
  const motion = document.documentElement.classList.contains('hv2-motion');
  const pin = hero.querySelector<HTMLElement>('.hv2-pin')!;
  const copy = hero.querySelector<HTMLElement>('.hv2-copy')!;
  const move = hero.querySelector<HTMLElement>('.hv2-stack-move')!;
  const stack = hero.querySelector<HTMLElement>('.hv2-stack')!;
  const dim = hero.querySelector<HTMLElement>('.hv2-dim')!;
  const cap = hero.querySelector<HTMLElement>('.hv2-cap')!;
  const hint = hero.querySelector<HTMLElement>('.hv2-hint')!;
  const bar = document.querySelector<HTMLElement>('.gn-bar');
  const pinMQ = window.matchMedia('(min-width: 734px)');

  function reset() {
    copy.style.transform = '';
    copy.style.opacity = '';
    move.style.transform = '';
    dim.style.opacity = '';
    cap.style.opacity = '';
    cap.style.transform = '';
    stack.style.removeProperty('--fan');
    stack.style.removeProperty('--rot');
  }

  function update() {
    ticking = false;
    updReveal();
    if (!motion || !pinMQ.matches || hero!.classList.contains('is-static')) { reset(); return; }
    const total = hero!.offsetHeight - pin.offsetHeight;
    const top = bar ? bar.offsetHeight : 48;
    const p = total > 0 ? clamp((top - hero!.getBoundingClientRect().top) / total, 0, 1) : 0;
    const e = ease(p);
    copy.style.transform = `translateY(${(-p * 160).toFixed(1)}px) scale(${(1 - p * 0.08).toFixed(4)})`;
    copy.style.opacity = clamp(1 - p * 2.2, 0, 1).toFixed(3);
    move.style.transform = `translateY(${(-e * copy.offsetHeight * 0.8).toFixed(1)}px) scale(${(1 + e * 0.12).toFixed(4)})`;
    stack.style.setProperty('--fan', (150 + e * 160).toFixed(1));
    stack.style.setProperty('--rot', (3 + e * 8).toFixed(2));
    dim.style.opacity = (p * 0.85).toFixed(3);
    hint.style.opacity = clamp(1 - p * 10, 0, 1).toFixed(3);
    const c = clamp((p - 0.55) / 0.3, 0, 1);
    cap.style.opacity = c.toFixed(3);
    cap.style.transform = `translateY(${((1 - c) * 30).toFixed(1)}px)`;
  }

  // Statement: each word goes from dim to full white as it scrolls through.
  const reveal = document.querySelector<HTMLElement>('[data-hv2-reveal]');
  let words: HTMLElement[] = [];
  if (motion && reveal) {
    const parts = (reveal.textContent || '').trim().split(/\s+/);
    reveal.textContent = '';
    words = parts.map((word, i) => {
      const span = document.createElement('span');
      span.textContent = word;
      reveal.append(span);
      if (i < parts.length - 1) reveal.append(' ');
      return span;
    });
  }
  function updReveal() {
    if (!reveal || !words.length) return;
    const r = reveal.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.25), 0, 1);
    const n = words.length;
    words.forEach((w, i) => { w.style.opacity = (0.18 + 0.82 * clamp(p * (n + 2) - i, 0, 1)).toFixed(3); });
  }

  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // Once the Ask Imverica finder shows a result the hero stops pinning, so
  // the answer (county picker, Continue, AI note) is never clipped.
  const result = document.getElementById('aiFinderResult');
  if (result) {
    new MutationObserver(() => {
      if (result.classList.contains('open')) { hero.classList.add('is-static'); update(); }
    }).observe(result, { attributes: true, attributeFilter: ['class'] });
  }

  update();
  if (motion) revealSections();
}

// Section intros under the hero rise in as they enter the viewport (the
// cards inside them already use the site-wide reveal from BaseLayout).
function revealSections(): void {
  const targets = document.querySelectorAll<HTMLElement>(
    '.stats-strip .stat-item, .ourserv-kicker, .ourserv-section h2, .ourserv-sub, ' +
    '.news-copy, .news-panel, .visa-inner, .testimonials-heading, .about-head'
  );
  const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  targets.forEach((el, i) => {
    el.classList.add('hv2-rise');
    if (el.classList.contains('stat-item')) el.style.transitionDelay = `${(i % 4) * 80}ms`;
    io.observe(el);
  });
}
