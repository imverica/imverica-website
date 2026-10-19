/**
 * Motion for the v2 homepage opening (components/HeroV2.astro): the two
 * headline variants take turns, the hero pins under the nav while the real
 * form pages rise, scale and fan out (the copy fades, the caption fades in),
 * then the statement lights up word by word.
 *
 * Does nothing unless the v2 hero was swapped in (index.astro, html.v2), and
 * only animates with html.hv2-motion. The pinned scroll runs on screens
 * from 734 px and not with "reduce motion" (html.hv2-calm). Phones get
 * their own opening instead: the three pages wait as one stack and open
 * like a bouquet once a third of it is on screen (again each time it comes
 * back into view), and the
 * first screen is laid out so the finder sits in the middle of the screen
 * with the phone number still above the fold.
 */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

export function initHeroV2(): void {
  const hero = document.querySelector<HTMLElement>('.hv2-hero');
  if (!hero) return;
  const motion = document.documentElement.classList.contains('hv2-motion');
  const calm = document.documentElement.classList.contains('hv2-calm');
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
    if (!pinMQ.matches) return; // phones: bouquet() and placePhone()
    if (!motion || calm || !pinMQ.matches || hero!.classList.contains('is-static')) { reset(); return; }
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

  // Phones: the pages arrive stacked, then the side pages swing out and
  // tilt while the stack settles to full size.
  let bouquetRun = 0;
  function closed() {
    stack.style.setProperty('--fan', '0');
    stack.style.setProperty('--rot', '0');
    move.style.transform = 'scale(0.9)';
  }
  function bouquet(delay: number) {
    const run = ++bouquetRun;
    closed();
    window.setTimeout(() => {
      const t0 = performance.now();
      const frame = (now: number) => {
        if (run !== bouquetRun || pinMQ.matches) return;
        const t = clamp((now - t0) / 1500, 0, 1);
        const e = easeBack(t);
        stack.style.setProperty('--fan', (e * 250).toFixed(1));
        stack.style.setProperty('--rot', (e * 11).toFixed(2));
        move.style.transform = `scale(${(0.9 + 0.1 * ease(t)).toFixed(4)})`;
        if (t < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }, delay);
  }

  // Phones: top padding chosen so the finder's field is centred in the
  // visible screen; moved up again if the phone number would fall below it.
  const field = hero.querySelector<HTMLElement>('.ai-finder-form');
  const contact = hero.querySelector<HTMLElement>('.ai-hero-contact');
  const pageTop = (el: HTMLElement) => { let y = 0; for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop; return y; };
  let placedFor = 0;
  function placePhone(force = false) {
    if (pinMQ.matches) { hero!.style.removeProperty('--hv2-top'); placedFor = 0; return; }
    if (!field || (!force && placedFor === window.innerWidth)) return;
    placedFor = window.innerWidth;
    const now = parseFloat(getComputedStyle(pin).paddingTop) || 0;
    const vh = window.innerHeight;
    let shift = vh / 2 - (pageTop(field) + field.offsetHeight / 2);
    if (contact) {
      const over = pageTop(contact) + contact.offsetHeight + shift - (vh - 12);
      if (over > 0) shift -= over;
    }
    // Long copy (UA, small phones): tighten the type once, then place again.
    if (now + shift < 6 && !hero!.classList.contains('hv2-tight')) {
      hero!.classList.add('hv2-tight');
      placedFor = 0;
      placePhone(true);
      return;
    }
    hero!.style.setProperty('--hv2-top', `${clamp(now + shift, 6, 160).toFixed(0)}px`);
  }

  // Statement: each word goes from dim to full white as it scrolls through.
  // The dim state stays at 40% so even unlit words keep 3:1 (large text, AA).
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
    words.forEach((w, i) => { w.style.opacity = (0.4 + 0.6 * clamp(p * (n + 2) - i, 0, 1)).toFixed(3); });
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
  placePhone(true);
  window.addEventListener('resize', () => placePhone());
  if (motion) revealSections();
  if (motion && !pinMQ.matches) {
    // Opens once a third of the stack is on screen, and again every time
    // it comes back after leaving the screen.
    closed();
    let armed = true;
    new IntersectionObserver(([entry]) => {
      if (pinMQ.matches) return;
      if (!entry.isIntersecting) { armed = true; bouquetRun++; closed(); return; }
      if (armed && entry.intersectionRatio >= 0.33) { armed = false; bouquet(120); }
    }, { threshold: [0, 0.33] }).observe(move);
  }

  // Headline: the current homepage copy and the alternate line take turns.
  // Held still while someone types in the finder or reads its answer.
  const variants = Array.from(hero.querySelectorAll<HTMLElement>('[data-hv2-swap] .hv2-variant'));
  if (motion && variants.length > 1) {
    let on = 0;
    window.setInterval(() => {
      const typing = document.activeElement?.id === 'aiFinderInput';
      if (document.hidden || typing || hero.classList.contains('is-static')) return;
      variants[on].classList.remove('is-on');
      on = (on + 1) % variants.length;
      variants[on].classList.add('is-on');
    }, 6500);
  }
}

// Section intros under the hero rise in as they enter the viewport (the
// cards inside them already use the site-wide reveal from BaseLayout).
function revealSections(): void {
  const targets = document.querySelectorAll<HTMLElement>(
    '.stats-strip .stat-item, .ourserv-kicker, .ourserv-section h2, .ourserv-sub, ' +
    '.news-copy, .news-panel, .visa-inner, .testimonials-heading, .about-head, ' +
    '.hf2-kicker, .hf2-h2, .hf2-lead, .hf2-tile'
  );
  const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  targets.forEach((el, i) => {
    el.classList.add('hv2-rise');
    if (el.classList.contains('stat-item')) el.style.transitionDelay = `${(i % 4) * 80}ms`;
    if (el.classList.contains('hf2-tile')) el.style.transitionDelay = `${(i % 3) * 80}ms`;
    io.observe(el);
  });
}
