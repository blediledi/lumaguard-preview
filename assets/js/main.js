(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* header shadow + mobile nav */
  const hdr = $('[data-hdr]');
  const onScroll = () => hdr && hdr.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const burger = $('[data-burger]'), nav = $('#nav');
  burger?.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', open); nav.classList.toggle('is-open', open);
  });
  $$('#nav a').forEach(a => a.addEventListener('click', () => { burger?.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); }));

  /* reveal on scroll */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px' }) : null;
  const showAll = !io || location.search.includes('shot');
  $$('.reveal').forEach(el => showAll ? el.classList.add('is-in') : io.observe(el));

  /* 3D tilt + glare on cards and photos (mouse/trackpad only) */
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const targets = [
      ['.svc__card', 3], ['.smart__fig', 7], ['.access__scene', 5], ['.gear__in', 2.5], ['.why__item', 6],
    ];
    targets.forEach(([sel, max]) => $$(sel).forEach(el => {
      el.classList.add('tilt');
      if (el.tagName !== 'IMG') { const gl = document.createElement('span'); gl.className = 'tilt-glare'; el.appendChild(gl); }
      let base = '', raf = 0;
      el.addEventListener('pointerenter', () => {
        el.style.transform = '';
        const b = getComputedStyle(el).transform;
        base = b && b !== 'none' ? b : '';
        el.style.transition = 'transform .15s ease-out';
      });
      el.addEventListener('pointermove', e => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          el.style.transform = `perspective(1000px) ${base} rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(0)`;
          el.style.setProperty('--gx', x * 100 + '%');
          el.style.setProperty('--gy', y * 100 + '%');
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.style.transition = 'transform .6s cubic-bezier(.2,.7,.2,1)';
        el.style.transform = base ? `perspective(1000px) ${base}` : '';
      });
    }));
  }

  /* business hours: today + open now (Eastern time) */
  const hours = { Mon: [9, 17], Tue: [9, 17], Wed: [9, 17], Thu: [9, 17], Fri: [9, 17], Sat: null, Sun: null };
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
    const day = parts.find(p => p.type === 'weekday').value, hr = +parts.find(p => p.type === 'hour').value % 24;
    $$(`.hours li[data-day="${day}"]`).forEach(li => li.classList.add('is-today'));
    const h = hours[day], open = !!h && hr >= h[0] && hr < h[1];
    $$('[data-open-now]').forEach(el => { el.textContent = open ? 'Open now' : 'Closed now'; el.classList.add(open ? 'is-open' : 'is-closed'); });
  } catch (_) {}

  /* site monitor console */
  const clock = $('[data-clock]');
  const tick = () => { if (clock) clock.textContent = new Date().toLocaleTimeString('en-US', { hour12: false }); };
  tick(); setInterval(tick, 1000);

  const log = $('[data-log]'), doorsEl = $('[data-doors]');
  const doors = $$('.door');
  const events = [
    () => ({ d: 1, msg: 'DOOR-01 · badge accepted' }),
    () => ({ msg: 'CAM-02 · motion — warehouse' }),
    () => ({ d: 3, msg: 'YARD GATE · mobile key (phone)' }),
    () => ({ msg: 'FIRE · detector self-test passed' }),
    () => ({ d: 2, msg: 'DOOR-02 · smartwatch key accepted' }),
    () => ({ msg: 'PANEL · circuits nominal' }),
    () => ({ msg: 'CAM-04 · recording to NVR' }),
  ];
  let n = 0;
  const step = () => {
    const ev = events[n++ % events.length]();
    if (log) { const p = document.createElement('p'); p.textContent = '› ' + ev.msg; log.replaceChildren(p); }
    if (ev.d) {
      const door = doors.find(x => x.dataset.door == ev.d);
      dispatchEvent(new CustomEvent('lg:door', { detail: { id: ev.d } }));
      if (door) {
        door.classList.add('is-open');
        if (doorsEl) doorsEl.textContent = '1 open · 2 secured';
        setTimeout(() => { door.classList.remove('is-open'); if (doorsEl) doorsEl.textContent = '3 secured'; }, 1800);
      }
    }
  };
  if (log && !reduce) setInterval(step, 2600);

  /* ajax forms */
  $$('form[data-ajax]').forEach(form => form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('.form__msg', form), btn = $('button[type=submit]', form);
    btn.disabled = true; msg.className = 'form__msg'; msg.textContent = 'Sending…';
    try {
      const r = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'fetch', Accept: 'application/json' } });
      const j = await r.json();
      msg.textContent = j.message; msg.classList.add(j.ok ? 'ok' : 'err');
      if (j.ok) form.reset();
    } catch (_) {
      msg.textContent = 'Something went wrong — please call us instead.'; msg.classList.add('err');
    } finally { btn.disabled = false; }
  }));
})();
