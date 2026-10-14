/* ==========================================================================
   FUNERARIA JUAN PABLO II · Comportamiento y animaciones
   --------------------------------------------------------------------------
   Dependencias (CDN, con degradación elegante si alguna falla):
     - GSAP + ScrollTrigger : galería fijada, parallax, línea de tiempo, progreso
     - Lenis                : desplazamiento suave
   Todo lo demás es JavaScript nativo (IntersectionObserver, canvas, rAF).

   Reglas de movimiento:
     - Sin listeners de "scroll": se usa ScrollTrigger / IntersectionObserver.
     - Solo se animan transform y opacity.
     - prefers-reduced-motion desactiva Lenis, GSAP, partículas y parallax.
   ========================================================================== */
(() => {
  'use strict';

  // El script inline del <head> programó un "failsafe"; si llegamos aquí, ya no hace falta.
  if (window.__fs) clearTimeout(window.__fs);

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = Boolean(window.gsap && window.ScrollTrigger);
  const state = { lenis: null, chapel: null, menuOpen: false, autoScroll: false };

  const safe = (fn) => {
    try { fn(); } catch (err) { console.error('[Funeraria JP II]', err); }
  };
  const headerH = () => (($('.site-header') || {}).offsetHeight || 64);

  /* ----------------------------------------------------------------------
     DESPLAZAMIENTO SUAVE (Lenis) + ANCLAS
     ---------------------------------------------------------------------- */
  function initSmoothScroll() {
    if (reduce || !window.Lenis) return;
    const lenis = new window.Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });
    state.lenis = lenis;
    lenis.stop(); // detenido mientras corre el preloader
    if (hasGSAP) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add((t) => lenis.raf(t * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  let autoTimer;
  function scrollToY(y, duration = 1.6) {
    // Durante un desplazamiento por ancla el header no se oculta: así el menú sigue a la mano al llegar.
    state.autoScroll = true;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { state.autoScroll = false; }, duration * 1000 + 400);
    if (state.lenis) {
      state.lenis.scrollTo(y, { duration, easing: (t) => 1 - Math.pow(1 - t, 4) });
    } else {
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  function scrollToHash(hash) {
    if (hash === '#top' || hash === '#inicio') return scrollToY(0);
    const target = $(hash);
    if (!target) return;
    // La capilla está fijada: su inicio real lo da ScrollTrigger, no su posición actual.
    if (hash === '#capilla' && state.chapel) return scrollToY(state.chapel.start);
    const y = target.getBoundingClientRect().top + window.scrollY - headerH();
    scrollToY(y);
  }

  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const hash = a.getAttribute('href');
      if (!hash || hash.length < 2 || !$(hash)) return;
      e.preventDefault();
      closeMenu();
      history.replaceState(null, '', hash);
      scrollToHash(hash);
    });
  }

  /* ----------------------------------------------------------------------
     HEADER: fondo al hacer scroll, ocultar al bajar, enlace activo
     ---------------------------------------------------------------------- */
  function initHeader() {
    const header = $('.site-header');
    if (!header) return;

    // Centinela: cuando sale de la vista, el header toma fondo sólido.
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:80px;pointer-events:none;visibility:hidden';
    document.body.prepend(sentinel);
    new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-scrolled', !entry.isIntersecting);
    }).observe(sentinel);

    if (hasGSAP && !reduce) {
      window.ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate(self) {
          if (state.menuOpen || state.autoScroll) return;
          const hide = self.scroll() > 520 && self.direction === 1;
          const show = self.direction === -1 || self.scroll() <= 520;
          if (hide) header.classList.add('is-hidden');
          else if (show) header.classList.remove('is-hidden');
        }
      });
    }

    // Enlace de navegación activo según la sección visible
    const links = $$('.nav__list a');
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => l.classList.remove('is-active'));
        const link = byId.get(en.target.id);
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['inicio', ...byId.keys()].forEach((id) => {
      const section = document.getElementById(id);
      if (section) io.observe(section);
    });
  }

  /* ----------------------------------------------------------------------
     MENÚ MÓVIL
     ---------------------------------------------------------------------- */
  let menuTimer;
  function closeMenu() {
    const btn = $('#menu-toggle');
    const menu = $('#mobile-menu');
    if (!btn || !menu || !state.menuOpen) return;
    state.menuOpen = false;
    menu.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Abrir menú');
    root.classList.remove('menu-open');
    if (state.lenis) state.lenis.start(); else document.body.style.overflow = '';
    menuTimer = setTimeout(() => { menu.hidden = true; }, 850);
  }

  function initMenu() {
    const btn = $('#menu-toggle');
    const menu = $('#mobile-menu');
    if (!btn || !menu) return;
    $$('.mobile-menu__nav li', menu).forEach((li, i) => li.style.setProperty('--i', i));

    const open = () => {
      clearTimeout(menuTimer);
      menu.hidden = false;
      void menu.offsetWidth; // fuerza el reflow para que la transición arranque
      menu.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Cerrar menú');
      root.classList.add('menu-open');
      state.menuOpen = true;
      if (state.lenis) state.lenis.stop(); else document.body.style.overflow = 'hidden';
    };

    btn.addEventListener('click', () => (state.menuOpen ? closeMenu() : open()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.menuOpen) { closeMenu(); btn.focus(); }
    });
    window.matchMedia('(min-width: 1180px)').addEventListener('change', (mq) => {
      if (mq.matches) closeMenu();
    });
  }

  /* ----------------------------------------------------------------------
     PRELOADER: progreso real (fuentes + carga de página) con mínimo de 2.2 s
     ---------------------------------------------------------------------- */
  function runLoader(onDone) {
    const loader = $('#loader');
    if (!loader) { onDone(); return; }

    const pctEl = $('#loader-pct');
    const arc = $('.loader__arc');
    const MIN_MS = reduce ? 350 : 2200;
    const t0 = performance.now();
    let assetsReady = false;
    let shown = 0;
    root.classList.add('is-loading');

    const pageLoaded = document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((res) => window.addEventListener('load', res, { once: true }));
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.all([pageLoaded, fontsReady]).then(() => { assetsReady = true; });
    setTimeout(() => { assetsReady = true; }, 6000); // tope por si algún recurso tarda

    const paint = (p) => {
      if (pctEl) pctEl.textContent = String(Math.round(p));
      if (arc) arc.style.strokeDashoffset = String(100 - p);
    };

    const tick = (now) => {
      const t = Math.min(1, (now - t0) / MIN_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const target = assetsReady ? eased * 100 : Math.min(eased * 100, 88);
      shown += (target - shown) * 0.14;
      if (assetsReady && t >= 1 && shown > 99.2) shown = 100;
      paint(shown);
      if (shown < 100) { requestAnimationFrame(tick); return; }

      loader.classList.add('is-done');
      root.classList.remove('is-loading');
      setTimeout(() => {
        root.classList.add('is-ready');
        if (state.lenis) state.lenis.start();
        onDone();
      }, 650);
      setTimeout(() => loader.remove(), 1900);
    };
    requestAnimationFrame(tick);
  }

  /* ----------------------------------------------------------------------
     REVELADOS AL ENTRAR EN PANTALLA (IntersectionObserver, sin GSAP)
     ---------------------------------------------------------------------- */
  function initReveals() {
    $$('[data-reveal-group] > *').forEach((el) => el.setAttribute('data-reveal', ''));

    // Escalonado entre hermanos
    const counts = new Map();
    $$('[data-reveal]').forEach((el) => {
      const parent = el.parentElement;
      const n = counts.get(parent) || 0;
      counts.set(parent, n + 1);
      el.style.setProperty('--rd', Math.min(n * 0.09, 0.45).toFixed(2) + 's');
    });

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('is-in');
        obs.unobserve(el);
        if (el.hasAttribute('data-reveal')) {
          // Al terminar, se retira el estado de revelado para no estorbar a los hover.
          const release = () => { el.removeAttribute('data-reveal'); el.classList.remove('is-in'); el.style.removeProperty('--rd'); };
          const onEnd = (ev) => { if (ev.propertyName === 'opacity') { el.removeEventListener('transitionend', onEnd); release(); } };
          el.addEventListener('transitionend', onEnd);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    $$('[data-reveal], [data-clip]').forEach((el) => io.observe(el));
  }

  /* ----------------------------------------------------------------------
     CONTADORES de la franja de cifras
     ---------------------------------------------------------------------- */
  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length || reduce) return;
    const fmt = new Intl.NumberFormat('es-MX');

    const run = (el) => {
      const to = Number(el.dataset.count);
      const duration = 1900;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        el.textContent = fmt.format(Math.round(to * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        obs.unobserve(en.target);
        run(en.target);
      });
    }, { threshold: 0.6 });
    els.forEach((el) => { el.textContent = '0'; io.observe(el); });
  }

  /* ----------------------------------------------------------------------
     PARTÍCULAS DEL HERO: motas doradas que suben como chispas de vela
     ---------------------------------------------------------------------- */
  function initParticles() {
    const canvas = $('#particles');
    if (!canvas || reduce) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sprite pre-renderizado: dibujarlo es mucho más barato que usar shadowBlur
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const sctx = sprite.getContext('2d');
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,243,208,1)');
    grad.addColorStop(0.22, 'rgba(239,217,160,0.6)');
    grad.addColorStop(1, 'rgba(224,189,107,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);

    let w = 0; let h = 0; let parts = []; let running = false; let raf = 0; let last = 0;
    const rand = (a, b) => a + Math.random() * (b - a);
    const make = (anywhere) => ({
      x: rand(0, w), y: anywhere ? rand(0, h) : h + rand(10, 60),
      r: rand(2.5, 9), vy: rand(0.12, 0.5), vx: rand(-0.05, 0.05),
      ph: rand(0, Math.PI * 2), tw: rand(0.6, 1.6), a: rand(0.3, 0.9)
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.min(90, Math.max(26, (w * h) / 21000)));
      while (parts.length < target) parts.push(make(true));
      parts.length = target;
    };

    const frame = (t) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(40, t - last) / 16.67;
      last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        p.y -= p.vy * dt;
        p.x += (p.vx + Math.sin(t * 0.0004 * p.tw + p.ph) * 0.13) * dt;
        if (p.y < -20 || p.x < -30 || p.x > w + 30) Object.assign(p, make(false));
        const twinkle = 0.55 + 0.45 * Math.sin(t * 0.0015 * p.tw + p.ph);
        const edge = Math.min(1, Math.max(0, p.y / (h * 0.22))) * Math.min(1, Math.max(0, (h + 40 - p.y) / 90));
        ctx.globalAlpha = p.a * twinkle * edge;
        ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      ctx.globalAlpha = 1;
    };

    const start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    new ResizeObserver(resize).observe(canvas);
    resize();

    // Solo corre mientras el hero está en pantalla y la pestaña visible
    let inView = true;
    new IntersectionObserver(([en]) => { inView = en.isIntersecting; (inView && !document.hidden) ? start() : stop(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => { (inView && !document.hidden) ? start() : stop(); });
  }

  /* ----------------------------------------------------------------------
     HERO: foco de luz que sigue al cursor + paralaje del emblema
     ---------------------------------------------------------------------- */
  function initHeroPointer() {
    if (!fine || reduce) return;
    const hero = $('.hero');
    const bg = $('.hero__bg');
    const glow = $('#hero-glow');
    const emblem = $('.hero__emblem');
    if (!hero || !bg || !glow || !emblem) return;

    let tx = 0; let ty = 0; let x = 0; let y = 0; let raf = 0; let inside = false;

    const loop = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      glow.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      const cx = x / hero.clientWidth - 0.5;
      const cy = y / hero.clientHeight - 0.5;
      emblem.style.setProperty('--px', (-cx * 30).toFixed(1) + 'px');
      emblem.style.setProperty('--py', (-cy * 22).toFixed(1) + 'px');
      raf = (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) ? requestAnimationFrame(loop) : 0;
    };

    hero.addEventListener('pointermove', (e) => {
      const r = bg.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      if (!inside) { inside = true; x = tx; y = ty; glow.classList.add('is-on'); }
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    hero.addEventListener('pointerleave', () => {
      inside = false;
      glow.classList.remove('is-on');
      emblem.style.setProperty('--px', '0px');
      emblem.style.setProperty('--py', '0px');
    });
  }

  /* ----------------------------------------------------------------------
     TARJETAS CON FOCO DE LUZ y BOTONES MAGNÉTICOS (solo puntero fino)
     ---------------------------------------------------------------------- */
  function initPointerFx() {
    if (!fine) return;
    $$('.spot').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sx', (e.clientX - r.left).toFixed(0) + 'px');
        el.style.setProperty('--sy', (e.clientY - r.top).toFixed(0) + 'px');
      }, { passive: true });
    });
    if (reduce) return;
    $$('.btn--magnetic').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.2;
        const y = (e.clientY - r.top - r.height / 2) * 0.32;
        btn.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      }, { passive: true });
      btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
    });
  }

  /* ----------------------------------------------------------------------
     ANIMACIONES LIGADAS AL SCROLL (GSAP + ScrollTrigger)
     ---------------------------------------------------------------------- */
  function initScrollFx() {
    if (!hasGSAP || reduce) return;
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);

    // Barra de progreso de lectura
    gsap.to('#progress-bar', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });

    // Hero: la foto desciende más lento que el contenido y el texto se desvanece al salir
    gsap.to('.hero__bg', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__grid', { yPercent: -6, opacity: 0.12, ease: 'none', scrollTrigger: { trigger: '.hero', start: '18% top', end: 'bottom top', scrub: true } });

    // Parallax interno de todas las imágenes con data-parallax
    $$('.media img[data-parallax]').forEach((img) => {
      gsap.fromTo(img, { yPercent: -7 }, {
        yPercent: 7, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    // Frase de promesa: las palabras se iluminan al ritmo de la lectura
    const statement = $('#statement');
    if (statement) {
      const text = statement.textContent.trim();
      statement.setAttribute('aria-label', text);
      statement.textContent = '';
      const words = text.split(/\s+/).map((word, i, arr) => {
        const span = document.createElement('span');
        span.className = 'w';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = word;
        statement.appendChild(span);
        if (i < arr.length - 1) statement.appendChild(document.createTextNode(' '));
        return span;
      });
      gsap.fromTo(words, { opacity: 0.16 }, {
        opacity: 1, ease: 'none', stagger: 0.12,
        scrollTrigger: { trigger: statement, start: 'top 82%', end: 'bottom 52%', scrub: true }
      });
    }

    // Capilla: el scroll vertical se convierte en recorrido horizontal
    const chapel = $('.chapel');
    const track = $('#chapel-track');
    const meter = $('#chapel-meter');
    if (chapel && track) {
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      chapel.classList.add('is-pinned');
      state.chapel = ScrollTrigger.create({
        trigger: chapel,
        start: 'top top',
        end: () => '+=' + distance(),
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        animation: gsap.to(track, { x: () => -distance(), ease: 'none' }),
        onUpdate: (self) => { if (meter) meter.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')'; }
      });
    }

    // Proceso: la línea dorada se llena y cada paso se enciende al llegar
    const timeline = $('#timeline');
    const fill = $('#timeline-fill');
    if (timeline && fill) {
      gsap.to(fill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: timeline, start: 'top 65%', end: 'bottom 70%', scrub: true } });
      $$('.timeline__step', timeline).forEach((step) => {
        ScrollTrigger.create({
          trigger: step, start: 'top 68%',
          onEnter: () => step.classList.add('is-active'),
          onLeaveBack: () => step.classList.remove('is-active')
        });
      });
    }
  }

  // Sin GSAP o con movimiento reducido: la línea de tiempo se muestra completa
  function timelineFallback() {
    if (hasGSAP && !reduce) return;
    const fill = $('#timeline-fill');
    if (fill) fill.style.transform = 'scaleY(1)';
    $$('.timeline__step').forEach((s) => s.classList.add('is-active'));
    const bar = $('.progress');
    if (bar) bar.hidden = true;
  }

  /* ----------------------------------------------------------------------
     SUCURSALES: el botón "Ver en el mapa" cambia el mapa embebido
     ---------------------------------------------------------------------- */
  function initBranches() {
    const frame = $('#map-frame');
    if (!frame) return;
    const cards = $$('.branch');
    const queries = {
      ra: 'Calle Juventud 19, Real de Asientos, Aguascalientes, Mexico',
      cg: 'Olivares Santana 17, Cienega Grande, Aguascalientes, Mexico'
    };
    $$('[data-show-map]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.showMap;
        frame.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(queries[key]) + '&z=16&output=embed';
        cards.forEach((c) => c.classList.toggle('is-active', c.dataset.branch === key));
        if (window.innerWidth < 960) {
          const map = $('.map');
          if (map) scrollToY(map.getBoundingClientRect().top + window.scrollY - headerH() - 12, 1.1);
        }
      });
    });
  }

  /* ----------------------------------------------------------------------
     FORMULARIO: validación accesible + envío a WhatsApp
     ---------------------------------------------------------------------- */
  function initForm() {
    const form = $('#contact-form');
    if (!form) return;
    const status = $('#form-status');
    const button = $('#form-submit');
    const number = form.dataset.waNumber;

    const rules = {
      name: (v) => v.trim().length >= 2 || 'Escribe tu nombre para saber cómo llamarte.',
      phone: (v) => v.replace(/\D/g, '').length >= 10 || 'Escribe un teléfono de 10 dígitos, con lada.'
    };

    const setError = (input, message) => {
      const wrap = input.closest('.field');
      wrap.classList.toggle('is-invalid', Boolean(message));
      $('.field__err', wrap).textContent = message || '';
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    };
    const check = (input) => {
      const rule = rules[input.name];
      if (!rule) return true;
      const result = rule(input.value);
      setError(input, result === true ? '' : result);
      return result === true;
    };

    ['name', 'phone'].forEach((name) => {
      const input = form.elements[name];
      input.addEventListener('blur', () => check(input));
      input.addEventListener('input', () => {
        if (input.closest('.field').classList.contains('is-invalid')) check(input);
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const okName = check(form.elements.name);
      const okPhone = check(form.elements.phone);
      if (!okName || !okPhone) {
        status.className = 'form__status';
        status.textContent = 'Revisa los campos marcados para poder ayudarte.';
        (okName ? form.elements.phone : form.elements.name).focus();
        return;
      }

      const data = new FormData(form);
      const lines = [
        'Hola, soy ' + String(data.get('name')).trim() + '.',
        String(data.get('topic')) + '.',
        'Sucursal más cercana: ' + String(data.get('branch')) + '.',
        'Mi teléfono: ' + String(data.get('phone')).trim() + '.'
      ];
      const extra = String(data.get('message') || '').trim();
      if (extra) lines.push('Mensaje: ' + extra);
      const url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(lines.join('\n'));

      form.classList.add('is-loading');
      button.disabled = true;
      status.className = 'form__status';
      status.textContent = 'Abriendo WhatsApp con tu mensaje...';

      setTimeout(() => {
        const win = window.open(url, '_blank', 'noopener');
        if (!win) window.location.href = url; // ventana bloqueada: se abre en la misma pestaña
        form.classList.remove('is-loading');
        button.disabled = false;
        status.className = 'form__status is-ok';
        status.textContent = 'Listo. Un asesor te responderá por WhatsApp en cuanto lea tu mensaje.';
        form.reset();
      }, 800);
    });
  }

  /* ----------------------------------------------------------------------
     ARRANQUE
     ---------------------------------------------------------------------- */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  safe(initSmoothScroll);
  safe(initAnchors);
  safe(initHeader);
  safe(initMenu);
  safe(initBranches);
  safe(initForm);
  safe(initPointerFx);
  safe(initParticles);
  safe(initHeroPointer);
  safe(initScrollFx);
  safe(timelineFallback);

  runLoader(() => {
    safe(initReveals);
    safe(initCounters);
    if (hasGSAP) window.ScrollTrigger.refresh();
  });

  // Recalcula posiciones cuando termina de cargar todo
  window.addEventListener('load', () => { if (hasGSAP) window.ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (hasGSAP) window.ScrollTrigger.refresh(); });
  }
})();
