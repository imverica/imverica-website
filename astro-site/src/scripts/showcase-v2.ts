/**
 * Slider in components/HomeSliderV2.astro: wide slides that move right to
 * left every 5 s with the neighbours peeking in, in an endless loop (two
 * clones at each end). Dots, arrows, a pause button, swipe and arrow keys.
 * Autoplay stops while the slider has keyboard focus, is off screen or the
 * tab is hidden. It runs with "reduce motion" too (the site owner wants it
 * moving on every phone); the pause button stops it for anyone.
 * The pause button also stops the row of form cards underneath.
 */
const INTERVAL = 5000;
const CLONES = 2;

function setup(root: HTMLElement): void {
  const viewport = root.querySelector<HTMLElement>('.hs-viewport');
  const track = root.querySelector<HTMLElement>('[data-hs-track]');
  if (!viewport || !track) return;
  const originals = Array.from(track.querySelectorAll<HTMLElement>('[data-hs-slide]'));
  const n = originals.length;
  if (n < 2) return;

  const cloneOf = (el: HTMLElement) => {
    const c = el.cloneNode(true) as HTMLElement;
    c.setAttribute('aria-hidden', 'true');
    c.removeAttribute('aria-label');
    c.removeAttribute('role');
    c.removeAttribute('aria-roledescription');
    c.querySelectorAll('a, button').forEach((a) => a.setAttribute('tabindex', '-1'));
    c.dataset.hsClone = '';
    return c;
  };
  for (let k = 0; k < CLONES; k++) {
    track.insertBefore(cloneOf(originals[n - 1 - k]), track.firstChild);
    track.appendChild(cloneOf(originals[k]));
  }
  const all = Array.from(track.children) as HTMLElement[];
  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-hs-dot]'));
  const play = root.querySelector<HTMLButtonElement>('[data-hs-play]');

  let pos = CLONES; // index in `all`
  let userPaused = false;
  let hold = 0; // focus, drag, off screen, hidden tab
  let timer = 0;
  let drag: { x: number; y: number; dx: number; id: number; lock: '' | 'x' | 'y' } | null = null;

  const real = () => ((pos - CLONES) % n + n) % n;
  const step = () => {
    const w = all[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0;
    return { w, gap };
  };
  const offset = (i: number, extra = 0) => {
    const { w, gap } = step();
    return (viewport.clientWidth - w) / 2 - i * (w + gap) + extra;
  };
  function paint(animate: boolean, extra = 0) {
    track!.classList.toggle('is-anim', animate);
    track!.style.transform = `translate3d(${offset(pos, extra)}px, 0, 0)`;
  }
  function mark() {
    const r = real();
    all.forEach((el, i) => el.classList.toggle('is-current', i === pos));
    originals.forEach((el, i) => {
      const on = i === r;
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
      el.querySelectorAll('a').forEach((a) => (on ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
    });
    dots.forEach((d, i) => (i === r ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
  }
  function go(to: number, animate = true) {
    pos = to;
    paint(animate);
    mark();
    if (!animate) settle();
  }
  // After sliding onto a clone, jump to the real slide without animation.
  function settle() {
    if (pos >= CLONES + n || pos < CLONES) {
      pos = CLONES + real();
      paint(false);
      mark();
    }
  }
  track.addEventListener('transitionend', (e) => { if (e.target === track) settle(); });

  const next = () => go(pos + 1);
  const prev = () => go(pos - 1);

  function schedule() {
    window.clearInterval(timer);
    timer = 0;
    if (!userPaused && hold === 0) timer = window.setInterval(next, INTERVAL);
  }
  function setPaused(p: boolean) {
    userPaused = p;
    root.classList.toggle('is-paused', p);
    if (play) {
      play.classList.toggle('is-paused', p);
      play.setAttribute('aria-label', (p ? play.dataset.labelPlay : play.dataset.labelPause) || '');
    }
    schedule();
  }
  const holdOn = () => { hold++; schedule(); };
  const holdOff = () => { hold = Math.max(0, hold - 1); schedule(); };

  root.querySelector('[data-hs-next]')?.addEventListener('click', () => { next(); schedule(); });
  root.querySelector('[data-hs-prev]')?.addEventListener('click', () => { prev(); schedule(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { go(CLONES + i); schedule(); }));
  play?.addEventListener('click', () => setPaused(!userPaused));

  // A tap on a peeking slide brings it to the centre instead of following its link.
  all.forEach((el, i) => el.addEventListener('click', (e) => {
    if (i === pos) return;
    e.preventDefault();
    e.stopPropagation();
    go(i);
    schedule();
  }, true));

  let focused = false;
  root.addEventListener('focusin', () => { if (!focused) { focused = true; holdOn(); } });
  root.addEventListener('focusout', (e) => {
    if (focused && !root.contains(e.relatedTarget as Node)) { focused = false; holdOff(); }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { next(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { prev(); e.preventDefault(); }
  });

  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId, lock: '' };
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.lock && Math.abs(dx) + Math.abs(dy) > 8) {
      drag.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.lock === 'x') { viewport.setPointerCapture(e.pointerId); holdOn(); }
    }
    if (drag.lock !== 'x') return;
    drag.dx = dx;
    paint(false, dx);
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dx, lock } = drag;
    drag = null;
    if (lock !== 'x') return;
    holdOff();
    if (dx < -50) next();
    else if (dx > 50) prev();
    else paint(true);
    // swallow the click that ends a swipe
    if (Math.abs(dx) > 8) viewport.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  let offscreen = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      const out = !entry.isIntersecting;
      if (out !== offscreen) { offscreen = out; out ? holdOn() : holdOff(); }
    }, { threshold: 0.25 }).observe(root);
  }
  let hidden = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden !== hidden) { hidden = document.hidden; hidden ? holdOn() : holdOff(); }
  });
  window.addEventListener('resize', () => paint(false));

  go(CLONES, false);
  setPaused(userPaused);
}

export function initShowcase(): void {
  document.querySelectorAll<HTMLElement>('[data-hs-slider]').forEach((root) => {
    if (root.dataset.hsReady) return;
    root.dataset.hsReady = '1';
    setup(root);
  });
}
