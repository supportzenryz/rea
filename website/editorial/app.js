// Routes: #/ (index), #/serie/<id>/<n>, #/grille, #/studio, #/contact.

(() => {
  const S = window.SERIES;
  const STUDIO = window.STUDIO;
  const byId = Object.fromEntries(S.map((s) => [s.id, s]));
  const body = document.body;
  const view = document.getElementById("view");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Language ------------------------------------------------------------

  const STR = {
    fr: {
      "nav.work": "Travaux", "nav.studio": "Studio", "nav.contact": "Contact",
      "view.index": "Index", "view.grid": "Grille", "clock.city": "Paris",
      view: "Voir la série", close: "Fermer", photo: "Photo : Pexels",
      "cat.all": "Tout", "cat.editorial": "Éditorial", "cat.campaign": "Campagne", "cat.portrait": "Portrait",
      client: "Client", photography: "Photographie", styling: "Stylisme", hair: "Coiffure",
      makeup: "Maquillage", casting: "Casting", place: "Lieu", year: "Année",
      manifesto: "Nous photographions la mode comme on écrit une lettre : lentement, à la lumière du jour, avec le goût du détail.",
      "b.studio": "Le studio",
      "b.studio.1": "Fondée à Paris, Maison Vérane réunit photographes, stylistes et producteurs autour d'une même idée : des images calmes, précises et durables.",
      "b.studio.2": "Notre studio du 11e arrondissement offre 180 m² de lumière naturelle, des fonds peints à la main et un espace de production complet.",
      "b.services": "Services",
      services: ["Éditorial", "Campagne", "Lookbook", "Portrait", "Direction artistique", "Production"],
      "b.approach": "Approche",
      "b.approach.1": "Chaque projet commence par un repérage et une planche d'intentions partagée. Nous travaillons en argentique comme en numérique, en studio comme en extérieur, en France et à l'étranger.",
      "b.clients": "Clients",
      "studio.caption": "Le studio, Paris 11e",
      "c.write": "Écrire au studio", "c.studio": "Studio", "c.agent": "Agent",
      fine: "Noms, clients et coordonnées fictifs, à remplacer. Photographies issues de",
      title: "Maison Vérane — Studio de photographie, Paris",
    },
    en: {
      "nav.work": "Work", "nav.studio": "Studio", "nav.contact": "Contact",
      "view.index": "Index", "view.grid": "Grid", "clock.city": "Paris",
      view: "View series", close: "Close", photo: "Photo: Pexels",
      "cat.all": "All", "cat.editorial": "Editorial", "cat.campaign": "Campaign", "cat.portrait": "Portrait",
      client: "Client", photography: "Photography", styling: "Styling", hair: "Hair",
      makeup: "Make-up", casting: "Casting", place: "Location", year: "Year",
      manifesto: "We photograph fashion the way one writes a letter: slowly, in daylight, with a taste for detail.",
      "b.studio": "The studio",
      "b.studio.1": "Founded in Paris, Maison Vérane brings photographers, stylists and producers together around one idea: calm, precise, lasting images.",
      "b.studio.2": "Our studio in the 11th arrondissement offers 180 m² of daylight, hand-painted backdrops and a full production space.",
      "b.services": "Services",
      services: ["Editorial", "Campaign", "Lookbook", "Portrait", "Art direction", "Production"],
      "b.approach": "Approach",
      "b.approach.1": "Every project begins with a location scout and a shared mood board. We shoot on film and digital, in the studio and on location, in France and abroad.",
      "b.clients": "Clients",
      "studio.caption": "The studio, Paris 11th",
      "c.write": "Write to the studio", "c.studio": "Studio", "c.agent": "Agent",
      fine: "Names, clients and contact details are placeholders. Photographs from",
      title: "Maison Vérane — Photography studio, Paris",
    },
  };

  let lang = "fr";
  try {
    const saved = localStorage.getItem("mv-lang");
    if (saved === "fr" || saved === "en") lang = saved;
  } catch {}

  const t = (k) => STR[lang][k] ?? k;
  const L = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v[lang] : v);
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pad2 = (n) => String(n).padStart(2, "0");

  const applyLang = () => {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("is-active", b.dataset.lang === lang));
  };

  document.querySelectorAll("[data-lang]").forEach((b) =>
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      try {
        localStorage.setItem("mv-lang", lang);
      } catch {}
      applyLang();
      render(true);
    }),
  );

  // Paris clock ---------------------------------------------------------

  const clock = document.getElementById("clock");
  const fmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  const tick = () => (clock.textContent = fmt.format(new Date()));
  tick();
  setInterval(tick, 15000);

  // Index ---------------------------------------------------------------

  let cycle = null;
  let currentId = S[0].id;
  let introActive = false; // holds the index cover still while the intro plays

  const renderIndex = () => {
    view.innerHTML =
      `<section class="view index">` +
      `<ol class="series-list">` +
      S.map(
        (s, i) =>
          `<li style="--i:${i}"><a href="#/serie/${s.id}/1" data-id="${s.id}">` +
          `<span class="num meta">${pad2(i + 1)}</span>` +
          `<span class="title">${esc(s.title)}</span>` +
          `<span class="info meta">${esc(t("cat." + s.cat))} — ${s.year}</span></a></li>`,
      ).join("") +
      `</ol>` +
      `<div class="feature">` +
      `<a class="feature-frame" href="#/serie/${currentId}/1">` +
      S.map((s) => `<img src="${s.photos[0].src}" alt="${esc(s.photos[0].alt)}" data-id="${s.id}" />`).join("") +
      `</a>` +
      `<div class="feature-caption meta"><span class="cap-title"></span><span class="cap-count muted"></span></div>` +
      `</div></section>`;

    const frame = view.querySelector(".feature-frame");
    const list = view.querySelector(".series-list");

    const show = (id) => {
      currentId = id;
      const s = byId[id];
      frame.href = `#/serie/${id}/1`;
      frame.dataset.cursor = `${s.title} — ${t("view")}`;
      frame.querySelectorAll("img").forEach((img) => img.classList.toggle("is-shown", img.dataset.id === id));
      list.querySelectorAll("a").forEach((a) => a.classList.toggle("is-current", a.dataset.id === id));
      view.querySelector(".cap-title").textContent = `${L(s.client)} — ${L(s.place)}`;
      view.querySelector(".cap-count").textContent = `${pad2(S.indexOf(s) + 1)} / ${pad2(S.length)}`;
      refreshCursor();
    };

    let hovering = false;
    list.addEventListener("pointerover", (e) => {
      const a = e.target.closest("a[data-id]");
      if (!a) return;
      hovering = true;
      if (a.dataset.id !== currentId) show(a.dataset.id);
    });
    list.addEventListener("pointerleave", () => (hovering = false));
    list.addEventListener("focusin", (e) => {
      const a = e.target.closest("a[data-id]");
      if (a) show(a.dataset.id);
    });

    show(currentId);
    if (!reduced)
      cycle = setInterval(() => {
        if (hovering || introActive) return;
        const i = S.findIndex((s) => s.id === currentId);
        show(S[(i + 1) % S.length].id);
      }, 4800);
  };

  // Series viewer -------------------------------------------------------

  let viewing = null;

  const renderSeries = (s, n) => {
    const total = s.photos.length;
    n = ((n - 1 + total) % total) + 1;
    viewing = { s, n, total };
    const p = s.photos[n - 1];
    const prev = n === 1 ? total : n - 1;
    const next = n === total ? 1 : n + 1;
    const crew = [
      ["client", L(s.client)],
      ["photography", STUDIO.name],
      ["styling", s.crew.styling],
      ["hair", s.crew.hair],
      ["makeup", s.crew.makeup],
      ["casting", s.crew.casting],
      ["place", L(s.place)],
      ["year", s.year],
    ];
    view.innerHTML =
      `<section class="view series">` +
      `<div class="series-info">` +
      `<p class="meta muted">${esc(t("cat." + s.cat))} — ${pad2(n)} / ${pad2(total)}</p>` +
      `<h1>${esc(s.title)}</h1>` +
      `<p class="lede">${esc(L(s.text))}</p>` +
      `<dl class="credits">${crew.map(([k, v]) => `<dt>${esc(t(k))}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` +
      `<p class="meta muted" style="margin-top:22px"><a href="${p.credit}" target="_blank" rel="noopener">${esc(t("photo"))}</a></p>` +
      `</div>` +
      `<div class="series-stage">` +
      `<img src="${p.src}" alt="${esc(p.alt)}" />` +
      `<div class="zones">` +
      `<a href="#/serie/${s.id}/${prev}" aria-label="Précédente" data-cursor="‹ ${esc(s.title)} — ${n}/${total}"></a>` +
      `<a href="#/serie/${s.id}/${next}" aria-label="Suivante" data-cursor="${esc(s.title)} — ${n}/${total} ›"></a>` +
      `</div></div>` +
      `<nav class="rail" aria-label="Images">` +
      s.photos
        .map(
          (q, i) =>
            `<a href="#/serie/${s.id}/${i + 1}" class="${i + 1 === n ? "is-current" : ""}" data-cursor="${i + 1}/${total}"><img src="${q.src}" alt="" loading="lazy" /></a>`,
        )
        .join("") +
      `</nav>` +
      `</section>` +
      `<a class="series-close meta" href="#/" data-cursor="${esc(t("close"))}">${esc(t("close"))} ×</a>`;
    document.title = `${s.title} — ${STUDIO.name}`;
    // Warm the next photograph so stepping feels instant.
    new Image().src = s.photos[next - 1].src;
  };

  // Grid ----------------------------------------------------------------

  let filter = "all";

  const renderGrid = () => {
    const cats = ["all", "editorial", "campaign", "portrait"];
    view.innerHTML =
      `<section class="view grid-view">` +
      `<nav class="filters">${cats
        .map((c) => `<button type="button" data-cat="${c}" class="${c === filter ? "is-active" : ""}">${esc(t("cat." + c))}</button>`)
        .join("")}</nav>` +
      `<div class="masonry">` +
      S.flatMap((s) =>
        s.photos.map(
          (p, i) =>
            `<a class="tile" href="#/serie/${s.id}/${i + 1}" data-cat="${s.cat}" data-cursor="${esc(s.title)} — ${i + 1}/${s.photos.length}">` +
            `<div class="ph" style="aspect-ratio:${p.r}"><img src="${p.src}" alt="${esc(p.alt)}" loading="lazy" decoding="async" /></div>` +
            `<div class="meta"><span>${esc(s.title)}</span><span>${pad2(i + 1)}</span></div></a>`,
        ),
      ).join("") +
      `</div></section>`;

    const tiles = [...view.querySelectorAll(".tile")];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -5% 0px" },
    );
    const applyFilter = () => {
      tiles.forEach((el) => (el.hidden = filter !== "all" && el.dataset.cat !== filter));
      view.querySelectorAll("[data-cat]").forEach((b) => b.tagName === "BUTTON" && b.classList.toggle("is-active", b.dataset.cat === filter));
    };
    view.querySelector(".filters").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-cat]");
      if (!b) return;
      filter = b.dataset.cat;
      applyFilter();
    });
    tiles.forEach((el) => io.observe(el));
    applyFilter();
  };

  // Studio --------------------------------------------------------------

  const renderStudio = () => {
    const p = byId["atelier"].photos[0];
    view.innerHTML =
      `<section class="view studio">` +
      `<figure class="studio-photo" style="margin:0"><img src="${p.src}" alt="${esc(p.alt)}" />` +
      `<figcaption class="meta muted">${esc(t("studio.caption"))}</figcaption></figure>` +
      `<div>` +
      `<p class="manifesto">${esc(t("manifesto"))}</p>` +
      `<div class="block"><h2>${esc(t("b.studio"))}</h2><div><p>${esc(t("b.studio.1"))}</p><p>${esc(t("b.studio.2"))}</p></div></div>` +
      `<div class="block"><h2>${esc(t("b.services"))}</h2><ul>${t("services").map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` +
      `<div class="block"><h2>${esc(t("b.approach"))}</h2><div><p>${esc(t("b.approach.1"))}</p></div></div>` +
      `<div class="block"><h2>${esc(t("b.clients"))}</h2><ul>${STUDIO.clients.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` +
      `</div></section>`;
  };

  // Contact -------------------------------------------------------------

  const tel = (n) => `tel:${n.replace(/[^+\d]/g, "")}`;

  const renderContact = () => {
    view.innerHTML =
      `<section class="view contact">` +
      `<div class="contact-hero"><span class="label-sans">${esc(t("c.write"))}</span>` +
      `<a href="mailto:${STUDIO.email}" data-cursor="${esc(t("c.write"))}">${esc(STUDIO.email)}</a></div>` +
      `<div class="contact-grid">` +
      `<div><h2>${esc(t("c.studio"))}</h2><p>${STUDIO.address.map(esc).join("<br />")}</p>` +
      `<p style="margin-top:12px"><a href="${tel(STUDIO.phone)}">${esc(STUDIO.phone)}</a><br />${esc(STUDIO.instagram)}</p></div>` +
      STUDIO.agents
        .map(
          (a) =>
            `<div><h2>${esc(t("c.agent"))} — ${esc(L(a.city))}</h2><p>${esc(a.name)}<br />` +
            `<a href="mailto:${a.email}">${esc(a.email)}</a><br /><a href="${tel(a.phone)}">${esc(a.phone)}</a></p></div>`,
        )
        .join("") +
      `</div>` +
      `<p class="fine">${esc(t("fine"))} <a href="https://www.pexels.com/" target="_blank" rel="noopener">Pexels</a>.</p>` +
      `</section>`;
  };

  // Router --------------------------------------------------------------

  const route = () => {
    const [a, b, c] = location.hash.replace(/^#\/?/, "").split("/");
    if (a === "serie" && byId[b]) return { name: "series", s: byId[b], n: parseInt(c, 10) || 1 };
    if (a === "grille") return { name: "grid" };
    if (a === "studio") return { name: "studio" };
    if (a === "contact") return { name: "contact" };
    return { name: "index" };
  };

  let lastName = null;

  const render = (keepScroll = false) => {
    const r = route();
    clearInterval(cycle);
    viewing = null;
    body.classList.toggle("scroll", ["grid", "studio", "contact"].includes(r.name));
    body.classList.toggle("in-series", r.name === "series");
    document.querySelectorAll("[data-route]").forEach((a) =>
      a.classList.toggle(
        "is-active",
        a.dataset.route === r.name || (a.dataset.route === "index" && r.name === "series" && a.closest(".menu")),
      ),
    );
    document.title = t("title");
    if (r.name === "index") renderIndex();
    else if (r.name === "series") renderSeries(r.s, r.n);
    else if (r.name === "grid") renderGrid();
    else if (r.name === "studio") renderStudio();
    else renderContact();
    if (!keepScroll && r.name !== lastName) window.scrollTo(0, 0);
    lastName = r.name;
    lastTarget = null;
    refreshCursor();
  };

  window.addEventListener("hashchange", () => render());

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && route().name !== "index") location.hash = "#/";
    if (!viewing) return;
    const { s, n, total } = viewing;
    if (e.key === "ArrowRight") location.hash = `#/serie/${s.id}/${n === total ? 1 : n + 1}`;
    if (e.key === "ArrowLeft") location.hash = `#/serie/${s.id}/${n === 1 ? total : n - 1}`;
  });

  // Cursor --------------------------------------------------------------
  // White text in difference blend mode: light over dark photographs, dark
  // over the paper background, with no chip behind it.

  const cursor = document.getElementById("cursor");
  const label = cursor.querySelector(".label");
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const drawn = { ...pos };
  let lastTarget = null;

  function refreshCursor() {
    if (!finePointer) return;
    const el = lastTarget && lastTarget.isConnected ? lastTarget : document.elementFromPoint(pos.x, pos.y);
    const host = el && el.closest("[data-cursor]");
    const text = host ? host.dataset.cursor : "";
    if (label.textContent !== text) label.textContent = text;
    cursor.classList.toggle("has-label", !!text);
  }

  if (finePointer) {
    body.classList.add("has-cursor");
    document.addEventListener("pointermove", (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      lastTarget = e.target;
      refreshCursor();
    });
    document.addEventListener("pointerleave", () => cursor.classList.remove("has-label"));
    addEventListener(
      "scroll",
      () => {
        lastTarget = null;
        refreshCursor();
      },
      { passive: true },
    );
    const loop = () => {
      const k = reduced ? 1 : 0.24;
      drawn.x += (pos.x - drawn.x) * k;
      drawn.y += (pos.y - drawn.y) * k;
      cursor.style.transform = `translate(${drawn.x}px, ${drawn.y}px) translateY(-50%)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  // Intro ---------------------------------------------------------------

  // Four beats: a loader that follows the real downloads; hard cuts that speed
  // up then brake; a slow liquid smudge on the last frame while the name rises;
  // and the last frame gliding into its place on the index as the interface
  // cascades in. Plays once per visit (add ?intro to the URL to replay it).

  applyLang();
  const intro = document.getElementById("intro");
  let seen = false;
  try {
    seen = sessionStorage.getItem("mv-intro") === "1";
  } catch {}
  const playIntro = !reduced && (/[?&]intro\b/.test(location.search) || !seen) && route().name === "index";
  if (playIntro) {
    introActive = true;
    currentId = S[0].id;
    body.classList.add("pre-enter");
  }
  render();
  if (playIntro) runIntro();
  else intro.remove();

  function runIntro() {
    const stage = document.getElementById("intro-stage");
    const nameEl = document.getElementById("intro-name");
    const countEl = document.getElementById("intro-count");
    const bar = document.getElementById("intro-bar");
    const label = intro.querySelector(".intro-label");
    const map = document.getElementById("smudge-map");
    const hero = S[0].photos[0];
    const CUTS = [38748656, 5120186, 5792043, 14814802, 9213843, 37233404, 38934854, 7935409, 31305929, 5119521, 20900467, 31755145];
    // How long each cut holds (ms): quick, quicker, then braking into the last frame.
    const RHYTHM = [230, 180, 140, 115, 95, 82, 76, 76, 82, 98, 125, 165];
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const ease = { inOut: "cubic-bezier(.76,0,.24,1)", out: "cubic-bezier(.16,1,.3,1)", in: "cubic-bezier(.7,0,.84,0)" };
    let raf = 0;
    let done = false;
    let heroEl = null;

    nameEl.innerHTML = [...nameEl.textContent]
      .map((c) => (c === " " ? `<span class="ch">&nbsp;</span>` : `<span class="ch"><span>${esc(c)}</span></span>`))
      .join("");

    // 1. Preload, with an honest counter (never faster than MIN, never stuck past MAX).
    const sources = CUTS.map((id) => `assets/intro/${id}.jpg`).concat(hero.src);
    let loaded = 0;
    const imgs = sources.map((src) => {
      const im = new Image();
      im.alt = "";
      im.src = src;
      (im.decode ? im.decode() : new Promise((r) => (im.onload = im.onerror = r))).catch(() => {}).then(() => loaded++);
      return im;
    });
    heroEl = imgs[imgs.length - 1];

    const t0 = performance.now();
    const MIN = 1100;
    const MAX = 7000;
    let shown = 0;
    const tickLoad = (now) => {
      if (done) return;
      const target = Math.min(loaded / sources.length, (now - t0) / MIN);
      shown += (target - shown) * 0.14;
      if (target >= 1 && shown > 0.996) shown = 1;
      countEl.textContent = String(Math.round(shown * 100)).padStart(3, "0");
      bar.style.transform = `scaleX(${shown})`;
      if (shown >= 1 || now - t0 > MAX) return startCuts();
      raf = requestAnimationFrame(tickLoad);
    };
    raf = requestAnimationFrame(tickLoad);

    const ready = (im) => im.complete && im.naturalWidth > 0;
    const place = (im) => {
      im.className = "intro-shot";
      stage.replaceChildren(im);
    };

    // 2. Hard cuts: each frame lands with a small scale settle and an exposure kick.
    function startCuts() {
      countEl.textContent = "100";
      [countEl.parentElement, label].forEach((el) =>
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: "forwards" }),
      );
      bar.style.transformOrigin = "right";
      bar.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: 700, easing: ease.inOut, fill: "forwards" });

      let at = 260;
      imgs.slice(0, -1).filter(ready).forEach((im, k) => {
        later(() => {
          place(im);
          im.animate(
            [
              { transform: "translate(-50%,-50%) scale(1.045)", filter: "brightness(1.22) contrast(1.06)" },
              { transform: "translate(-50%,-50%) scale(1)", filter: "brightness(1) contrast(1)" },
            ],
            { duration: 170, easing: "cubic-bezier(.2,.8,.2,1)" },
          );
        }, at);
        at += RHYTHM[k] ?? 90;
      });
      later(smudge, at);
    }

    // 3. The last frame arrives smeared and settles slowly into focus.
    function smudge() {
      if (!ready(heroEl)) return enter();
      place(heroEl);
      const D = 1900;
      const start = performance.now();
      const cubic = (t) => 1 - Math.pow(1 - t, 3);
      const quint = (t) => 1 - Math.pow(1 - t, 5);
      const frame = (now) => {
        if (done) return;
        const t = Math.min(1, (now - start) / D);
        const e = cubic(t);
        const disp = 150 * (1 - e);
        map.setAttribute("scale", disp.toFixed(1));
        heroEl.style.filter =
          disp > 0.4
            ? `url(#smudge) blur(${(16 * (1 - quint(t))).toFixed(2)}px) brightness(${(1 + 0.18 * (1 - e)).toFixed(3)})`
            : "none";
        heroEl.style.transform = `translate(-50%,-50%) scale(${(1 + 0.1 * (1 - e)).toFixed(4)}, ${(1 - 0.02 * (1 - e)).toFixed(4)})`;
        heroEl.style.opacity = Math.min(1, t * 4).toFixed(3);
        if (t < 1) raf = requestAnimationFrame(frame);
        else later(enter, 420);
      };
      raf = requestAnimationFrame(frame);
      nameEl.querySelectorAll(".ch > span").forEach((s, k) =>
        s.animate([{ transform: "translateY(110%)" }, { transform: "translateY(0)" }], {
          duration: 1100,
          delay: 280 + k * 48,
          easing: ease.out,
          fill: "forwards",
        }),
      );
    }

    // 4. Into the site: the last frame glides to the index cover's exact spot.
    function enter(fast = false) {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      intro.classList.add("is-leaving");
      const dur = fast ? 700 : 1250;

      nameEl.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-26px)" }], {
        duration: fast ? 300 : 600,
        easing: ease.in,
        fill: "forwards",
      });
      [countEl.parentElement, label, bar].forEach((el) => el.animate([{ opacity: 0 }], { duration: 250, fill: "forwards" }));

      const cascade = () => {
        body.classList.add("entering");
        body.classList.remove("pre-enter");
        setTimeout(() => body.classList.remove("entering"), 2200);
      };
      const finish = () => {
        intro.remove();
        introActive = false;
        try {
          sessionStorage.setItem("mv-intro", "1");
        } catch {}
      };

      const target = view.querySelector(`.feature-frame img[data-id="${S[0].id}"]`);
      if (!ready(heroEl) || !target) {
        intro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: "forwards" }).finished.then(finish);
        cascade();
        return;
      }

      if (heroEl.parentNode !== stage) place(heroEl);
      heroEl.getAnimations().forEach((a) => a.cancel());
      Object.assign(heroEl.style, { filter: "none", opacity: "1", transform: "translate(-50%,-50%)" });

      const from = heroEl.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      const r = heroEl.naturalWidth / heroEl.naturalHeight;
      let w = box.width;
      let h = w / r;
      if (h > box.height) {
        h = box.height;
        w = h * r;
      }
      const to = { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w };

      Object.assign(heroEl.style, {
        position: "fixed",
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        maxWidth: "none",
        maxHeight: "none",
        transform: "none",
        transformOrigin: "0 0",
      });
      const move = heroEl.animate(
        [
          { transform: "translate(0px, 0px) scale(1)" },
          { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})` },
        ],
        { duration: dur, easing: ease.inOut, fill: "forwards" },
      );
      intro.querySelector(".intro-bg").animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: dur * 0.75,
        delay: dur * 0.3,
        easing: "ease",
        fill: "forwards",
      });
      setTimeout(cascade, dur * 0.45);
      move.finished.then(finish);
    }

    const skip = () => enter(true);
    intro.addEventListener("click", skip);
    addEventListener("keydown", skip, { once: true });
    addEventListener("wheel", skip, { once: true, passive: true });
    addEventListener("touchmove", skip, { once: true, passive: true });
  }
})();
