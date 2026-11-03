// The toys. Everything on the page can be read without this file; it only adds
// the clock, the shutter (dark mode), the cover's drag / stamp / tidy / bell,
// the visiting card and the scroll reveals. One listener per job, no library.
(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  /* Clock: Hyderabad time, updated on the minute (not every second). */
  const clock = $('[data-clock]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
    const tick = () => {
      const now = new Date();
      clock.textContent = fmt.format(now);
      clock.dateTime = now.toISOString();
      setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
    };
    tick();
  }

  /* Shutter: the dark-mode switch. Pulling it down covers the screen,
   * swaps the theme behind it, and rolls back up. */
  const toggle = $('[data-theme-toggle]');
  const shutter = $('.shutter');
  const isDark = () => root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const label = () => {
    if (!toggle) return;
    const dark = isDark();
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.title = dark ? 'Lights on' : 'Lights off';
  };
  label();
  toggle?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    const apply = () => { root.dataset.theme = next; store.set('np-theme', next); label(); };
    if (reduce() || !shutter) { apply(); return; }
    shutter.classList.remove('is-up');
    shutter.classList.add('is-down');
    shutter.addEventListener('animationend', function down() {
      shutter.removeEventListener('animationend', down);
      apply();
      shutter.classList.remove('is-down');
      shutter.classList.add('is-up');
      shutter.addEventListener('animationend', () => shutter.classList.remove('is-up'), { once: true });
    });
  });

  /* Reveal sections as they arrive (once). */
  const reveal = $$('.sec .sec__head, .note-paper, .cards > li, .notebook, .register, .tape, .shelf__items, .share');
  if ('IntersectionObserver' in window && !reduce()) {
    reveal.forEach((el) => el.setAttribute('data-reveal', ''));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    reveal.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------ the cover */
  const cover = $('[data-cover]');
  if (!cover) return;
  const collage = $('[data-collage]', cover);
  const status = $('[data-tools-status]', cover);
  const say = (msg) => { if (status) status.textContent = msg; };

  // Drag: pointer events cover mouse, pen and touch. Offsets ride on the
  // `translate` property, so the CSS layout (rotation, position) is untouched.
  const pieces = $$('[data-drag]', collage);
  let z = 10;
  for (const el of pieces) {
    el.dataset.x = '0'; el.dataset.y = '0';
    el.addEventListener('pointerdown', (ev) => {
      if (cover.classList.contains('is-stamping') || ev.button > 0) return;
      ev.preventDefault();
      el.setPointerCapture(ev.pointerId);
      el.classList.remove('is-tidying');
      el.classList.add('is-dragging');
      el.style.zIndex = String(++z);
      const sx = ev.clientX - Number(el.dataset.x);
      const sy = ev.clientY - Number(el.dataset.y);
      const box = collage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      // Keep at least 40px of the piece inside the collage.
      const minX = box.left - r.right + 40 + Number(el.dataset.x), maxX = box.right - r.left - 40 + Number(el.dataset.x);
      const minY = box.top - r.bottom + 40 + Number(el.dataset.y), maxY = box.bottom - r.top - 40 + Number(el.dataset.y);
      const move = (e) => {
        const x = Math.min(maxX, Math.max(minX, e.clientX - sx));
        const y = Math.min(maxY, Math.max(minY, e.clientY - sy));
        el.dataset.x = String(x); el.dataset.y = String(y);
        el.style.translate = `${x}px ${y}px`;
      };
      const up = () => {
        el.classList.remove('is-dragging');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }

  // Stamp tool: arm it, then tap the cover. Enter on the armed button stamps a
  // random spot, so a keyboard can play too. Escape puts the stamp down.
  const WORDS = [['Hyd', ''], ['DIY', ''], ['Shipped', 'blue'], ['OK', ''], ['Parked', 'blue'], ['Self-taught', ''], ['Now', ''], ['Copy', 'blue']];
  const stampBtn = $('[data-stamp-tool]', cover);
  const stamps = $('[data-stamps]', cover);
  let wordIndex = 0;
  const armed = () => cover.classList.contains('is-stamping');
  const arm = (on) => {
    cover.classList.toggle('is-stamping', on);
    stampBtn.setAttribute('aria-pressed', String(on));
    say(on ? 'Stamp ready. Tap the cover, or press Enter again to stamp.' : 'Stamp put down.');
  };
  const stampAt = (x, y) => {
    if (stamps.children.length >= 24) stamps.firstElementChild.remove();
    const [word, tone] = WORDS[wordIndex++ % WORDS.length];
    const s = document.createElement('span');
    s.className = 'stamp-mark' + (tone ? ' stamp-mark--' + tone : '');
    s.textContent = word;
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.rotate = (Math.random() * 30 - 15).toFixed(1) + 'deg';
    stamps.append(s);
    say(`Stamped “${word}”.`);
  };
  stampBtn?.addEventListener('click', (ev) => {
    // A keyboard click (detail 0) on an armed stamp stamps somewhere random.
    if (armed() && ev.detail === 0) {
      const b = collage.getBoundingClientRect();
      stampAt(b.width * (.15 + Math.random() * .7), b.height * (.15 + Math.random() * .7));
      return;
    }
    arm(!armed());
  });
  collage.addEventListener('click', (ev) => {
    if (!armed()) return;
    ev.preventDefault();
    const b = collage.getBoundingClientRect();
    stampAt(ev.clientX - b.left, ev.clientY - b.top);
  }, true);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && armed()) arm(false); });

  // Tidy: everything back where it was printed, stamps washed off.
  $('[data-tidy]', cover)?.addEventListener('click', () => {
    for (const el of pieces) {
      el.classList.add('is-tidying');
      el.dataset.x = '0'; el.dataset.y = '0';
      el.style.translate = '';
      el.style.zIndex = '';
    }
    stamps.replaceChildren();
    if (armed()) arm(false);
    say('Tidied. Everything is back in place.');
  });

  // Bell: the exact two notes the store's order dashboard plays for a new
  // order (B5 and E6). Sound only ever starts from this button.
  let audio;
  const bell = $('[data-bell]', cover);
  bell?.addEventListener('click', () => {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime + 0.02;
      const out = audio.createDynamicsCompressor();
      const vol = audio.createGain();
      vol.gain.value = 0.5;
      out.connect(vol).connect(audio.destination);
      [[0, 988], [0.2, 1319], [0.5, 988], [0.7, 1319]].forEach(([at, f]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + at);
        g.gain.linearRampToValueAtTime(0.6, t0 + at + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + at + 0.19);
        o.connect(g).connect(out); o.start(t0 + at); o.stop(t0 + at + 0.2);
      });
    } catch { /* no Web Audio: the bell still shakes */ }
    bell.classList.remove('is-ringing');
    void bell.offsetWidth;
    bell.classList.add('is-ringing');
    say('Ding-dong. That is the sound of a new order on my phone.');
  });
})();

/* --------------------------------------------------------- visiting card */
(() => {
  const share = document.querySelector('[data-share]');
  if (!share) return;
  const status = share.querySelector('[data-share-status]');
  const card = share.querySelector('[data-vcard]');
  share.querySelector('[data-share-decline]')?.addEventListener('click', () => {
    status.textContent = 'Fair enough. The links are on the card anyway.';
  });
  share.querySelector('[data-share-accept]')?.addEventListener('click', () => {
    // The link itself downloads the .vcf; this only says so and nudges the card.
    status.textContent = 'Saved. Open the file to add me to your contacts.';
    card?.classList.remove('is-taken');
    void card?.offsetWidth;
    card?.classList.add('is-taken');
  });
})();

/* --------------------------------------------------------- bio copy buttons */
(() => {
  if (!navigator.clipboard) return;
  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      const text = btn.closest('.bio').querySelector('[data-bio]').textContent;
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; } catch { btn.textContent = 'Select and copy'; }
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  }
})();
