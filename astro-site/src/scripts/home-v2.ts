/**
 * Motion and the Ask card for the v2 homepage (components/HomeV2.astro).
 *
 * Runs on every page that bundles HomeV2 but does nothing unless the v2 body
 * was swapped in (index.astro does that only under html.v2). Scroll-linked
 * effects need html.hv2-motion, which the swap script sets only when
 * IntersectionObserver exists and reduced motion is off.
 *
 * The Ask card plays a scripted example first; anything the visitor types
 * goes to the same catalog router the hero finder uses (/route), and the
 * answer keeps the finder's informational framing: forms "commonly used",
 * the client decides what to file.
 */

type Lang = 'en' | 'ru' | 'uk' | 'es';
type ExampleKey = 'en' | 'ru' | 'ua' | 'es';

const EXAMPLES: Record<ExampleKey, { lang: Lang; q: string; a: string; title: string }> = {
  en: {
    lang: 'en',
    q: 'I need to renew my green card. It expires in March.',
    a: 'Documents commonly used for situations like this include I-90 — Green Card Renewal / Replacement. You decide which form to file; Imverica prepares it at your direction.',
    title: 'Green Card Renewal / Replacement'
  },
  ru: {
    lang: 'ru',
    q: 'Мне нужно продлить грин-карту, срок истекает в марте.',
    a: 'Для подобных ситуаций часто используют форму I-90 — Обновление green card. Какую форму подавать — решаете вы; Imverica готовит её по вашему поручению.',
    title: 'Обновление green card'
  },
  ua: {
    lang: 'uk',
    q: 'Мені потрібно продовжити грін-карту, термін спливає в березні.',
    a: 'Для подібних ситуацій часто використовують форму I-90 — Поновлення green card. Яку форму подавати — вирішуєте ви; Imverica готує її за вашим дорученням.',
    title: 'Поновлення green card'
  },
  es: {
    lang: 'es',
    q: 'Necesito renovar mi green card. Vence en marzo.',
    a: 'Para situaciones como esta se suele usar el formulario I-90 — Renovación de Green Card. Usted decide qué formulario presentar; Imverica lo prepara bajo su dirección.',
    title: 'Renovación de Green Card'
  }
};

const ANSWER: Record<Lang, string> = {
  en: 'Documents commonly used for situations like this include {form} — {name}. You decide which form to file; Imverica prepares it at your direction.',
  ru: 'Для подобных ситуаций часто используют форму {form} — {name}. Какую форму подавать — решаете вы; Imverica готовит её по вашему поручению.',
  uk: 'Для подібних ситуацій часто використовують форму {form} — {name}. Яку форму подавати — вирішуєте ви; Imverica готує її за вашим дорученням.',
  es: 'Para situaciones como esta se suele usar el formulario {form} — {name}. Usted decide qué formulario presentar; Imverica lo prepara bajo su dirección.'
};
const LOW_CONFIDENCE: Record<Lang, string> = {
  en: 'Based on what you wrote, a related form may be {form} ({name}). You decide what to file; tap Continue to refine, or contact us.',
  ru: 'Судя по описанию, к теме может относиться форма {form} ({name}). Что подавать — решаете вы. Нажмите «Продолжить» или свяжитесь с нами.',
  uk: 'Судячи з опису, до теми може стосуватися форма {form} ({name}). Що подавати — вирішуєте ви. Натисніть «Продовжити» або зв’яжіться з нами.',
  es: 'Según lo que escribió, un formulario relacionado puede ser {form} ({name}). Usted decide qué presentar; pulse Continuar o contáctenos.'
};
const NEEDS_DETAILS: Record<Lang, string> = {
  en: 'Thanks. A few details will help confirm which forms fit, including the filing court where it matters.',
  ru: 'Спасибо. Несколько уточнений помогут подобрать формы, включая суд подачи, если он важен.',
  uk: 'Дякуємо. Кілька уточнень допоможуть підібрати форми, зокрема суд подання, якщо він важливий.',
  es: 'Gracias. Algunos detalles ayudarán a confirmar qué formularios corresponden, incluido el tribunal cuando importe.'
};
const ERROR: Record<Lang, string> = {
  en: 'Sorry, please try again or call us at +1 (916) 399-3992.',
  ru: 'Попробуйте ещё раз или позвоните нам: +1 (916) 399-3992.',
  uk: 'Спробуйте ще раз або зателефонуйте нам: +1 (916) 399-3992.',
  es: 'Inténtelo de nuevo o llámenos al +1 (916) 399-3992.'
};
const START: Record<Lang, string> = { en: 'Start', ru: 'Начать', uk: 'Почати', es: 'Empezar' };
const CONTINUE: Record<Lang, string> = { en: 'Continue', ru: 'Продолжить', uk: 'Продовжити', es: 'Continuar' };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function detectLang(value: string): Lang {
  const text = String(value || '').toLowerCase();
  if (/[іїєґ]/i.test(text)) return 'uk';
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[ñáéíóúü¿¡]/i.test(text)) return 'es';
  return 'en';
}

function routeEndpoint(query: string): string {
  const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
  return (isLocal ? 'https://imverica.com' : '') + '/.netlify/functions/route?q=' + encodeURIComponent(query);
}

function logSearch(query: string, formCode: string, confidence: number) {
  try {
    const payload = JSON.stringify({ type: 'search', query: query.slice(0, 200), lang: detectLang(query), formCode, confidence, source: 'home-v2-ask' });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/analytics', new Blob([payload], { type: 'application/json' }));
  } catch { /* analytics must never break the page */ }
}

function openIntake(query: string, formCode = '') {
  const opener = (window as Window & { openIntakeModal?: (q?: string, hints?: { formCode?: string }) => void }).openIntakeModal;
  if (typeof opener === 'function') opener(query, formCode ? { formCode } : undefined);
  else window.location.hash = 'get-started';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function initHomeV2(): void {
  const hero = document.querySelector<HTMLElement>('.hv2-hero');
  if (!hero) return;
  const root = document.documentElement;
  const motion = root.classList.contains('hv2-motion');

  /* ---------- Hero: pinned; the form stack rises and fans out ---------- */
  const pin = hero.querySelector<HTMLElement>('.hv2-pin')!;
  const copy = hero.querySelector<HTMLElement>('.hv2-copy')!;
  const move = hero.querySelector<HTMLElement>('.hv2-stack-move')!;
  const stack = hero.querySelector<HTMLElement>('.hv2-stack')!;
  const dim = hero.querySelector<HTMLElement>('.hv2-dim')!;
  const cap = hero.querySelector<HTMLElement>('.hv2-cap')!;
  const hint = hero.querySelector<HTMLElement>('.hv2-hint')!;
  const bar = document.querySelector<HTMLElement>('.gn-bar');
  const pinMQ = window.matchMedia('(min-width: 734px)');

  // Once the Ask Imverica finder shows a result the hero stops pinning, so
  // the answer (county picker, Continue, AI note) is never clipped.
  const finderResult = document.getElementById('aiFinderResult');
  if (finderResult) {
    new MutationObserver(() => {
      if (finderResult.classList.contains('open')) { hero!.classList.add('is-static'); frame(); }
    }).observe(finderResult, { attributes: true, attributeFilter: ['class'] });
  }

  function resetHero() {
    copy.style.transform = ''; copy.style.opacity = '';
    move.style.transform = ''; dim.style.opacity = ''; cap.style.opacity = ''; cap.style.transform = '';
    stack.style.removeProperty('--fan'); stack.style.removeProperty('--rot');
  }
  function updHero() {
    if (!motion || !pinMQ.matches || hero!.classList.contains('is-static')) { resetHero(); return; }
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

  /* ---------- Statement: words light up with scroll ---------- */
  const reveal = document.querySelector<HTMLElement>('[data-hv2-reveal]');
  let words: HTMLElement[] = [];
  if (motion && reveal) {
    const parts = (reveal.textContent || '').trim().split(/\s+/);
    reveal.textContent = '';
    words = parts.map((word, i) => {
      const span = el('span', '', word);
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

  /* ---------- Parallax ---------- */
  const parallax = Array.from(document.querySelectorAll<HTMLElement>('[data-hv2-parallax]'));
  function updParallax() {
    if (!motion) return;
    const vh = window.innerHeight;
    parallax.forEach((node) => {
      const box = node.parentElement!.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;
      const q = (vh - box.top) / (vh + box.height);
      node.style.transform = `translateX(${((0.5 - q) * Number(node.dataset.hv2Parallax || 0)).toFixed(1)}px)`;
    });
  }

  let ticking = false;
  function frame() { ticking = false; updHero(); updReveal(); updParallax(); }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();

  initAsk(motion);
  if (!motion) return;

  /* ---------- Marquee: drifts on its own, speeds up with scroll ---------- */
  const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-hv2-mq]'));
  const mq = rows[0]?.parentElement;
  if (mq && rows.length) {
    let running = false, last = 0, drift = 0;
    const loop = (t: number) => {
      if (!running) return;
      const dt = last ? Math.min(t - last, 50) : 16;
      last = t;
      drift += dt * 0.045;
      const base = drift + window.scrollY * 0.4;
      rows.forEach((row, i) => {
        const half = row.scrollWidth / 2;
        const off = ((base % half) + half) % half;
        row.style.transform = `translateX(${(i % 2 ? off - half : -off).toFixed(1)}px)`;
      });
      requestAnimationFrame(loop);
    };
    new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting;
      if (running) { last = 0; requestAnimationFrame(loop); }
    }).observe(mq);
  }

  /* ---------- Rise on enter ---------- */
  const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.hv2-rise').forEach((node) => io.observe(node));

  /* ---------- Count up ---------- */
  const nums = Array.from(document.querySelectorAll<HTMLElement>('[data-hv2-count]'));
  const countUp = (node: HTMLElement) => {
    const to = Number(node.dataset.hv2Count || 0), suffix = node.dataset.suffix || '', t0 = performance.now();
    const step = (t: number) => {
      const k = clamp((t - t0) / 1500, 0, 1);
      node.textContent = Math.round(to * ease(k)) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  nums.forEach((node) => { node.textContent = '0' + (node.dataset.suffix || ''); });
  const cio = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { cio.unobserve(entry.target); countUp(entry.target as HTMLElement); }
  }), { threshold: 0.6 });
  nums.forEach((node) => cio.observe(node));
}

/* ---------- Ask card ---------- */
function initAsk(motion: boolean) {
  const chat = document.querySelector<HTMLElement>('[data-hv2-chat]');
  if (!chat) return;
  const thread = chat.querySelector<HTMLElement>('[data-hv2-thread]')!;
  const tag = chat.querySelector<HTMLElement>('[data-hv2-chat-tag]');
  const seg = chat.querySelector<HTMLElement>('.hv2-seg');
  const form = chat.querySelector<HTMLFormElement>('[data-hv2-chat-form]')!;
  const input = form.querySelector<HTMLInputElement>('input')!;
  const send = form.querySelector<HTMLButtonElement>('button')!;
  const langButtons = Array.from(chat.querySelectorAll<HTMLButtonElement>('[data-hv2-lang]'));
  const ex = (key: string) => chat.querySelector<HTMLElement>(`[data-hv2-ex="${key}"]`);
  let prices: Record<string, string> = {};
  try { prices = JSON.parse(chat.dataset.prices || '{}'); } catch { /* keep empty */ }

  let timers: number[] = [];
  let live = false;

  function playExample(key: ExampleKey) {
    if (live) return;
    const d = EXAMPLES[key];
    timers.forEach(clearTimeout);
    timers = [];
    const q = ex('q'), a = ex('a-text'), title = ex('card-title'), start = ex('card-start');
    if (q) { q.textContent = d.q; q.lang = d.lang; }
    if (a) { a.textContent = d.a; a.lang = d.lang; }
    if (title) title.textContent = d.title;
    if (start) start.textContent = START[d.lang];
    langButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hv2Lang === key)));
    if (!motion) return;
    chat!.classList.remove('s1', 's2', 's3', 's4');
    void chat!.offsetWidth;
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    at(150, () => chat!.classList.add('s1'));
    at(800, () => chat!.classList.add('s2'));
    at(2000, () => { chat!.classList.remove('s2'); chat!.classList.add('s3'); });
    at(2550, () => chat!.classList.add('s4'));
  }
  langButtons.forEach((b) => b.addEventListener('click', () => playExample(b.dataset.hv2Lang as ExampleKey)));
  if (motion) {
    const once = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { once.disconnect(); playExample('ru'); }
    }, { threshold: 0.4 });
    once.observe(chat);
  }

  function bubble(node: HTMLElement) {
    node.classList.add('hv2-in');
    thread.append(node);
    thread.scrollTop = thread.scrollHeight;
    return node;
  }

  function answer(query: string, lang: Lang, data: any) {
    const reply = el('div', 'hv2-m-a');
    reply.lang = lang;
    const route = data?.route || {};
    const formCode = String(route.formCode || '').toUpperCase();
    const confidence = Number(route.confidence || 0);
    if (!data) {
      reply.append(el('p', '', ERROR[lang]));
    } else if (!data.needsIntent && !data.needsCounty && formCode) {
      const name = String(route.formTitle || formCode).trim();
      const tmpl = confidence >= 0.7 ? ANSWER[lang] : LOW_CONFIDENCE[lang];
      reply.append(el('p', '', tmpl.replace('{form}', formCode).replace('{name}', name)));
      const card = el('a', 'hv2-m-card');
      card.href = '/#get-started?form=' + encodeURIComponent(formCode);
      const left = el('span');
      left.append(el('small', '', formCode), el('strong', '', name));
      const right = el('span', 'hv2-m-card-r');
      if (prices[formCode]) right.append(el('b', '', prices[formCode]));
      right.append(el('span', '', START[lang]));
      card.append(left, right);
      reply.append(card);
      logSearch(query, formCode, confidence);
      if (confidence >= 0.7) return bubble(reply);
    } else {
      reply.append(el('p', '', NEEDS_DETAILS[lang]));
      logSearch(query, '', confidence);
    }
    const more = el('button', 'hv2-m-btn', CONTINUE[lang]);
    more.type = 'button';
    more.addEventListener('click', () => openIntake(query, formCode));
    reply.append(more);
    return bubble(reply);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query || send.disabled) return;
    if (!live) {
      live = true;
      timers.forEach(clearTimeout);
      chat.classList.add('is-live');
      chat.classList.remove('s1', 's2', 's3', 's4');
      thread.replaceChildren();
      if (tag) tag.hidden = true;
      if (seg) seg.hidden = true;
    }
    const lang = detectLang(query);
    const q = bubble(el('p', 'hv2-m-q', query));
    q.lang = lang;
    input.value = '';
    send.disabled = true;
    const typing = bubble(el('div', 'hv2-m-typing is-on'));
    typing.setAttribute('aria-hidden', 'true');
    typing.append(el('i'), el('i'), el('i'));
    let data: any = null;
    try {
      const res = await fetch(routeEndpoint(query), { headers: { Accept: 'application/json' } });
      data = res.ok ? await res.json() : null;
    } catch { data = null; }
    typing.remove();
    answer(query, lang, data);
    send.disabled = false;
  });
}
