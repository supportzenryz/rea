// Routes: #/ (slideshow), #/work/<project>/<n>, #/thumbnails,
// #/index and #/info (slideshow with the panel open on that tab).
//
// Smoothness rules this file follows:
// - A photograph is decoded off-screen before it appears, and the next one is
//   prepared ahead, so a change never waits on the network or the decoder.
// - A new photograph fades in on top while the old one fades out more slowly
//   beneath it; once the new one is fully in, everything beneath is removed.
//   Nothing can be left behind, and there is no grey dip mid-change.
// - Only opacity and transform ever animate (both run on the GPU); nothing
//   animates size or position through layout.

(() => {
  const LANDING = window.LANDING;
  const PROJECTS = window.PROJECTS;
  const byId = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
  const html = document.documentElement;
  const body = document.body;
  const stageEl = document.getElementById("stage");
  const zonesEl = stageEl.querySelector(".zones");
  const thumbsEl = document.getElementById("thumbs");
  const panelEl = document.getElementById("panel");
  const worksEl = document.getElementById("works");
  const infoEl = document.getElementById("info");
  const touchName = document.getElementById("touch-name");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const FADE = { slide: 1600, step: 700, preview: 550 };

  const CONTACT = {
    email: "sundarrajanparamasivan@accademiaitaliana.it",
    instagram: { label: "@photosbysundar", href: "https://www.instagram.com/photosbysundar/" },
    based: "India — Europe",
  };

  const BIO = [
    "Sundar Rajan is a fashion photographer working between India and Europe. His work explores the relationship between fashion and the human experience, using clothing as a means of expressing identity, emotion and the complexities of being human.",
    "Drawn to the space between what is seen and what is felt, his images explore the tension between appearance and reality, the personal and the collective, and the worlds people inhabit and imagine. His practice approaches fashion as more than an expression of aesthetics, seeing it as a way to tell stories, question perceptions and explore the world around us.",
  ];

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const thumbOf = (src) => src.replace(/^photos\//, "thumbs/");
  const isOpen = () => body.classList.contains("panel-open");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Decode cache --------------------------------------------------------
  // Holding the decoded Image keeps it ready; a small LRU bounds memory.

  const cache = new Map();
  const prepare = (src) => {
    if (cache.has(src)) {
      const hit = cache.get(src);
      cache.delete(src);
      cache.set(src, hit);
      return hit;
    }
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    const ready = (img.decode ? img.decode() : new Promise((r) => (img.onload = img.onerror = r)))
      .catch(() => {})
      .then(() => img);
    cache.set(src, ready);
    while (cache.size > 14) cache.delete(cache.keys().next().value);
    return ready;
  };

  // Stage ---------------------------------------------------------------

  let shownSrc = null;
  let shownRatio = 1;
  let token = 0;

  const show = async (src, { alt = "", r = 0, fade = FADE.step } = {}) => {
    if (shownSrc === src) return;
    shownSrc = src;
    const mine = ++token;
    const decoded = await prepare(src);
    if (mine !== token) return; // a newer change has already been asked for

    const el = decoded.cloneNode();
    el.alt = alt;
    shownRatio = r || decoded.naturalWidth / decoded.naturalHeight || 1;
    const below = [...stageEl.querySelectorAll("img")];
    stageEl.style.setProperty("--fade", `${reduced ? 1 : fade}ms`);
    stageEl.insertBefore(el, zonesEl);
    fitStage();

    // Next frame: start both fades together.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.classList.add("is-shown");
        below.forEach((b) => b.classList.replace("is-shown", "is-leaving") || b.classList.add("is-leaving"));
      }),
    );
    // Once the new photograph is fully in, clear everything beneath it.
    setTimeout(() => below.forEach((b) => b.remove()), (reduced ? 1 : fade) + 80);
  };

  // With the panel open, the photograph glides and scales (one transform) to
  // stay centred in the space beside or above the panel.
  const fitStage = () => {
    if (!isOpen() || stageEl.hidden) {
      stageEl.style.transform = "";
      return;
    }
    const R = { l: stageEl.offsetLeft, t: stageEl.offsetTop, w: stageEl.offsetWidth, h: stageEl.offsetHeight };
    const phone = innerWidth <= 760;
    const T = phone
      ? { l: R.l, t: R.t, w: R.w, h: innerHeight - panelEl.offsetHeight - 16 - R.t }
      : { l: R.l, t: R.t, w: innerWidth - panelEl.offsetWidth - innerWidth * 0.06 - R.l, h: R.h };
    const fitW = (w, h) => (w / h > shownRatio ? h * shownRatio : w);
    const s = Math.min(1, fitW(T.w, T.h) / fitW(R.w, R.h));
    const dx = T.l + T.w / 2 - (R.l + R.w / 2);
    const dy = T.t + T.h / 2 - (R.t + R.h / 2);
    stageEl.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
  };
  addEventListener("resize", fitStage);

  // Panel ---------------------------------------------------------------

  worksEl.innerHTML = PROJECTS.map(
    (p) => `<li><a href="#/work/${p.id}/1" data-id="${p.id}"><span class="title">${esc(p.title)}</span></a></li>`,
  ).join("");

  infoEl.innerHTML =
    BIO.map((t) => `<p>${esc(t)}</p>`).join("") +
    `<dl>` +
    `<dt>Email</dt><dd><a href="mailto:${CONTACT.email}">${esc(CONTACT.email)}</a></dd>` +
    `<dt>Instagram</dt><dd><a href="${CONTACT.instagram.href}" target="_blank" rel="noopener">${esc(CONTACT.instagram.label)}</a></dd>` +
    `<dt>Based</dt><dd>${esc(CONTACT.based)}</dd>` +
    `</dl>`;

  // Covers are decoded ahead so hover previews are instant.
  const warmCovers = () => PROJECTS.forEach((p) => prepare(p.photos[0].src));

  const setTab = (tab) => {
    document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    document.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab));
  };
  const openPanel = (tab = "works") => {
    setTab(tab);
    body.classList.add("panel-open");
    warmCovers();
    fitStage();
    markSwitch();
  };
  const closePanel = () => {
    body.classList.remove("panel-open");
    if (!stageEl.hidden) showCurrent(); // drop any hover preview
    fitStage();
    markSwitch();
  };

  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  panelEl.querySelector(".close").addEventListener("click", closePanel);

  // Hover previews wait a beat, so skimming the list does not flicker.
  let hoverTimer = 0;
  worksEl.addEventListener("pointerover", (e) => {
    const a = e.target.closest("a[data-id]");
    if (!a || stageEl.hidden) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const ph = byId[a.dataset.id].photos[0];
      show(ph.src, { r: ph.r, fade: FADE.preview });
    }, 90);
  });
  worksEl.addEventListener("pointerleave", () => {
    clearTimeout(hoverTimer);
    if (!stageEl.hidden) hoverTimer = setTimeout(showCurrent, 90);
  });
  worksEl.addEventListener("click", () => {
    clearTimeout(hoverTimer);
    body.classList.remove("panel-open");
    markSwitch();
  });

  // Index — Thumbnails ----------------------------------------------------

  const markSwitch = () => {
    document.querySelector('[data-view="index"]').classList.toggle("is-active", isOpen());
    document.querySelector('[data-view="thumbnails"]').classList.toggle("is-active", route().name === "thumbnails");
  };

  let lastStageHash = "#/";
  document.querySelector('[data-view="index"]').addEventListener("click", (e) => {
    e.preventDefault();
    if (route().name === "thumbnails") {
      location.hash = lastStageHash;
      setTimeout(() => openPanel("works"), 120);
    } else if (isOpen()) closePanel();
    else openPanel("works");
  });

  // Slideshow -----------------------------------------------------------

  let slide = 0;
  let slideTimer = 0;
  let introPlaying = false;

  const showSlide = async (i) => {
    slide = (i + LANDING.length) % LANDING.length;
    const s = LANDING[slide];
    setLabel(null);
    await show(s.src, { r: s.r, fade: FADE.slide });
    prepare(LANDING[(slide + 1) % LANDING.length].src);
    schedule();
  };
  const schedule = () => {
    clearTimeout(slideTimer);
    if (reduced) return;
    slideTimer = setTimeout(function next() {
      if (introPlaying || isOpen() || route().name !== "landing") return (slideTimer = setTimeout(next, 1200));
      showSlide(slide + 1);
    }, 5600);
  };

  // Projects ------------------------------------------------------------

  let viewing = null;

  const projectHref = (p, n) => {
    if (n < 1) {
      const prev = PROJECTS[(PROJECTS.indexOf(p) - 1 + PROJECTS.length) % PROJECTS.length];
      return `#/work/${prev.id}/${prev.photos.length}`;
    }
    if (n > p.photos.length) return `#/work/${PROJECTS[(PROJECTS.indexOf(p) + 1) % PROJECTS.length].id}/1`;
    return `#/work/${p.id}/${n}`;
  };

  const showProject = (p, n) => {
    const total = p.photos.length;
    n = Math.min(Math.max(n, 1), total);
    viewing = { p, n, total };
    const ph = p.photos[n - 1];
    setLabel(p.title);
    show(ph.src, { alt: p.title, r: ph.r, fade: FADE.step });
    // Prepare both neighbours so stepping either way is instant.
    const next = p.photos[n] || PROJECTS[(PROJECTS.indexOf(p) + 1) % PROJECTS.length].photos[0];
    prepare(next.src);
    if (p.photos[n - 2]) prepare(p.photos[n - 2].src);
    worksEl.querySelectorAll("a").forEach((a) => a.classList.toggle("is-current", a.dataset.id === p.id));
    document.title = `${p.title} — Sundar Rajan`;
  };

  const showCurrent = () => {
    if (viewing) {
      const ph = viewing.p.photos[viewing.n - 1];
      show(ph.src, { alt: viewing.p.title, r: ph.r, fade: FADE.preview });
    } else {
      const s = LANDING[slide];
      show(s.src, { r: s.r, fade: FADE.preview });
    }
  };

  // Names only: the cursor shows the project name (just the dot on the
  // slideshow), and touch screens show the name under the photograph.
  const [zonePrev, zoneNext] = zonesEl.querySelectorAll("a");
  function setLabel(name) {
    if (name) {
      zonePrev.dataset.cursor = name;
      zoneNext.dataset.cursor = name;
    } else {
      delete zonePrev.dataset.cursor;
      delete zoneNext.dataset.cursor;
    }
    touchName.textContent = name || "";
    refreshCursor();
  }
  zonePrev.setAttribute("aria-label", "Previous photograph");
  zoneNext.setAttribute("aria-label", "Next photograph");

  const step = (d) => {
    if (viewing) location.hash = projectHref(viewing.p, viewing.n + d);
    else showSlide(slide + d);
  };
  // With the panel open, a click on the photograph only closes the panel.
  const onZone = (d) => (e) => {
    e.preventDefault();
    if (isOpen()) closePanel();
    else step(d);
  };
  zonePrev.addEventListener("click", onZone(-1));
  zoneNext.addEventListener("click", onZone(1));

  // Any other click outside the panel closes it too.
  document.addEventListener("click", (e) => {
    if (!isOpen()) return;
    if (e.target.closest("#panel, [data-view='index'], .zones")) return;
    closePanel();
  });

  // Thumbnails ------------------------------------------------------------

  let thumbsBuilt = false;
  const buildThumbs = () => {
    if (thumbsBuilt) return;
    thumbsBuilt = true;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }),
      { root: thumbsEl, rootMargin: "0px 0px -4% 0px" },
    );
    thumbsEl.innerHTML = PROJECTS.flatMap((p) =>
      p.photos.map(
        (ph, i) =>
          `<a class="thumb" href="#/work/${p.id}/${i + 1}" data-cursor="${esc(p.title)}">` +
          `<img src="${thumbOf(ph.src)}" alt="${esc(p.title)}" loading="lazy" decoding="async" style="aspect-ratio:${ph.r}" /></a>`,
      ),
    ).join("");
    thumbsEl.querySelectorAll(".thumb").forEach((t) => io.observe(t));
  };

  // Crossfade between the stage and the thumbnails instead of cutting.
  let viewToken = 0;
  let thumbsScroll = 0;
  const swapView = (toThumbs) => {
    const incoming = toThumbs ? thumbsEl : stageEl;
    const outgoing = toThumbs ? stageEl : thumbsEl;
    if (!incoming.hidden && !incoming.classList.contains("view-out")) return;
    const mine = ++viewToken;
    if (outgoing === thumbsEl && !thumbsEl.hidden) thumbsScroll = thumbsEl.scrollTop;
    incoming.classList.remove("view-out");
    incoming.hidden = false;
    if (incoming === thumbsEl) thumbsEl.scrollTop = thumbsScroll;
    incoming.classList.add("view-in");
    outgoing.classList.add("view-out");
    setTimeout(() => {
      if (mine !== viewToken) return;
      outgoing.hidden = true;
      outgoing.classList.remove("view-out");
      incoming.classList.remove("view-in");
    }, reduced ? 0 : 520);
  };

  // Router --------------------------------------------------------------

  const route = () => {
    const [a, b, c] = location.hash.replace(/^#\/?/, "").split("/");
    if (a === "work" && byId[b]) return { name: "project", p: byId[b], n: parseInt(c, 10) || 1 };
    if (a === "thumbnails") return { name: "thumbnails" };
    return { name: "landing", panel: a === "info" ? "info" : a === "index" ? "works" : null };
  };

  const render = () => {
    const r = route();
    const thumbs = r.name === "thumbnails";
    body.classList.toggle("in-project", r.name === "project");
    body.classList.toggle("is-thumbs", thumbs);
    document.title = "Sundar Rajan";
    swapView(thumbs);

    if (thumbs) {
      if (isOpen()) {
        body.classList.remove("panel-open");
        fitStage();
      }
      buildThumbs();
      touchName.textContent = "";
    } else {
      lastStageHash = location.hash || "#/";
      if (r.name === "project") showProject(r.p, r.n);
      else {
        viewing = null;
        worksEl.querySelectorAll("a").forEach((a) => a.classList.remove("is-current"));
        showSlide(slide);
        if (r.panel) openPanel(r.panel);
      }
    }
    markSwitch();
    lastTarget = null;
    refreshCursor();
  };

  window.addEventListener("hashchange", render);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (isOpen()) closePanel();
      else if (route().name !== "landing") location.hash = "#/";
      return;
    }
    if (stageEl.hidden || isOpen()) return;
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });

  // Cursor --------------------------------------------------------------
  // Hidden until the pointer first moves (so it never jumps in from the
  // centre), then eased with a frame-rate independent follow.

  const cursor = document.getElementById("cursor");
  const cursorLabel = cursor.querySelector(".label");
  const pos = { x: -100, y: -100 };
  const drawn = { ...pos };
  let lastTarget = null;

  function refreshCursor() {
    if (!finePointer) return;
    const el = lastTarget && lastTarget.isConnected ? lastTarget : document.elementFromPoint(pos.x, pos.y);
    const host = el && el.closest("[data-cursor]");
    const text = host ? host.dataset.cursor : "";
    if (cursorLabel.textContent !== text) cursorLabel.textContent = text;
    cursor.classList.toggle("has-label", !!text);
  }

  if (finePointer) {
    body.classList.add("has-cursor");
    let seenPointer = false;
    document.addEventListener("pointermove", (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!seenPointer) {
        seenPointer = true;
        drawn.x = pos.x;
        drawn.y = pos.y;
        cursor.classList.add("is-live");
      }
      lastTarget = e.target;
      refreshCursor();
    });
    document.addEventListener("pointerleave", () => cursor.classList.remove("is-live", "has-label"));
    document.addEventListener("pointerenter", () => seenPointer && cursor.classList.add("is-live"));
    thumbsEl.addEventListener(
      "scroll",
      () => {
        lastTarget = null;
        refreshCursor();
      },
      { passive: true },
    );
    let prev = performance.now();
    const loop = (now) => {
      const dt = Math.min(64, now - prev);
      prev = now;
      const k = reduced ? 1 : 1 - Math.pow(1 - 0.22, dt / 16.67);
      drawn.x += (pos.x - drawn.x) * k;
      drawn.y += (pos.y - drawn.y) * k;
      cursor.style.transform = `translate3d(${drawn.x.toFixed(2)}px, ${drawn.y.toFixed(2)}px, 0) translateY(-50%)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Fonts: text stays hidden until the serif is ready (at most 1.5 s), then
  // fades in once, so it never swaps from a fallback face.

  const fontsReady = Promise.race([
    document.fonts ? document.fonts.load('400 16px "Cormorant Garamond"') : Promise.resolve(),
    wait(1500),
  ]).catch(() => {});
  fontsReady.then(() => html.classList.remove("fonts-pending"));

  // Opening: the name fades in alone, holds, then softly dissolves in place
  // while the page clears to the slideshow.
  // Once per visit; add ?intro to the URL to see it again.

  const intro = document.getElementById("intro");
  let seen = false;
  try {
    seen = sessionStorage.getItem("sr-intro") === "1";
  } catch {}
  const play = !reduced && (/[?&]intro\b/.test(location.search) || !seen) && route().name === "landing";

  thumbsEl.hidden = true;
  render();

  if (!play) {
    intro.remove();
  } else {
    introPlaying = true;
    const nameEl = document.getElementById("intro-name");
    let revealTimer = 0;

    const reveal = () => {
      if (intro.classList.contains("is-out")) return;
      clearTimeout(revealTimer);
      intro.classList.add("is-out");
      setTimeout(() => {
        intro.remove();
        introPlaying = false;
        if (route().name === "landing") schedule(); // the first slide gets its full time
      }, 1700);
      try {
        sessionStorage.setItem("sr-intro", "1");
      } catch {}
    };

    const dissolve = () => {
      nameEl.classList.add("is-dissolving");
      revealTimer = setTimeout(reveal, 1800);
    };

    fontsReady.then(() => requestAnimationFrame(() => intro.classList.add("is-in")));
    // Hold the name (and wait for the first photograph) before it dissolves.
    Promise.race([
      Promise.all([prepare(LANDING[0].src), fontsReady.then(() => wait(3400))]),
      wait(7000),
    ]).then(dissolve);
    intro.addEventListener("click", reveal);
    addEventListener("keydown", reveal, { once: true });
  }
})();
