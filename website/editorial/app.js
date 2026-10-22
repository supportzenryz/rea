// Routes: #/ (slideshow), #/work/<project>/<n>, #/thumbnails,
// #/index, #/info and #/contact (slideshow with the panel open on that tab).
//
// Smoothness rules this file follows:
// - Only one photograph is ever on screen. A change waits for the next
//   photograph to be decoded off-screen, fades the current one out
//   completely, then fades the new one in. Two never overlap.
// - The next photographs are prepared ahead, so a change never waits on the
//   network or the decoder.
// - Only opacity and transform animate (both run on the GPU).

(() => {
  const LANDING = window.LANDING;
  const PROJECTS = window.PROJECTS;
  const byId = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
  const html = document.documentElement;
  const body = document.body;
  const $ = (id) => document.getElementById(id);
  const stageEl = $("stage");
  const zonesEl = stageEl.querySelector(".zones");
  const thumbsEl = $("thumbs");
  const panelEl = $("panel");
  const worksEl = $("works");
  const infoEl = $("info");
  const touchName = $("touch-name");
  const backEl = $("back");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Fade timings (ms): out first, then in.
  const FADE = {
    slide: { out: 650, in: 1400 },
    step: { out: 260, in: 560 },
    preview: { out: 220, in: 460 },
  };

  const CONTACT = {
    email: "work.photosbysundar@gmail.com",
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

  // Phones and tablets get the 1200px copies (medium/); larger screens the
  // full files. index.html preloads the first slide with the same rule.
  // Browsers that show WebP (decided in boot.js before first render) get the
  // .webp beside each .jpg, about half the size; others keep the JPEG.
  let webpOK = false;
  const sized = (src) => {
    const s = innerWidth <= 1024 ? src.replace(/^photos\//, "medium/") : src;
    return webpOK ? s.replace(/\.jpg$/, ".webp") : s;
  };

  const cache = new Map();
  const prepare = (raw) => {
    const src = sized(raw);
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
    while (cache.size > 48) cache.delete(cache.keys().next().value);
    return ready;
  };

  // Stage ---------------------------------------------------------------

  let shownSrc = null;
  let shownRatio = 1;
  let token = 0;

  const show = async (raw, { alt = "", r = 0, fade = FADE.step } = {}) => {
    const src = sized(raw);
    if (shownSrc === src) {
      fitStage(); // same photograph, but the panel may have opened or closed
      return;
    }
    shownSrc = src;
    const mine = ++token;
    const decoded = await prepare(src);
    if (mine !== token) return; // a newer change was asked for meanwhile

    // 1. Fade out whatever is showing, completely.
    const current = [...stageEl.querySelectorAll("img")];
    const visible = current.some((i) => i.classList.contains("is-shown"));
    const out = reduced || !visible ? 0 : fade.out;
    stageEl.style.setProperty("--out", `${out}ms`);
    current.forEach((i) => i.classList.replace("is-shown", "is-leaving") || i.classList.add("is-leaving"));
    if (out) await wait(out);
    if (mine !== token) return; // the newer change takes over from here
    current.forEach((i) => i.remove());

    // 2. Then bring the new one in.
    const el = decoded.cloneNode();
    el.alt = alt;
    el.draggable = false;
    shownRatio = r || decoded.naturalWidth / decoded.naturalHeight || 1;
    stageEl.style.setProperty("--in", `${reduced ? 1 : fade.in}ms`);
    stageEl.insertBefore(el, zonesEl);
    fitStage();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-shown")));
  };

  // With the panel open, the photograph glides (and only if it must, scales)
  // to stay centred in the space beside or above the panel.
  const fitStage = () => {
    if (!isOpen() || stageEl.hidden) {
      stageEl.style.transform = "";
      return;
    }
    const R = { l: stageEl.offsetLeft, t: stageEl.offsetTop, w: stageEl.offsetWidth, h: stageEl.offsetHeight };
    const phone = innerWidth <= 760;
    const T = phone
      ? { l: R.l, t: R.t, w: R.w, h: innerHeight - panelEl.offsetHeight - 64 - R.t }
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
    `</dl>` +
    `<p class="to-contact"><button type="button" data-tab="contact">Get in touch →</button></p>`;

  const warmCovers = () => PROJECTS.forEach((p) => prepare(p.photos[0].src));

  const setTab = (tab) => {
    document.querySelectorAll(".tabs [data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    document.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab));
    if (tab === "contact") {
      formOpened = Date.now();
      statusEl.textContent = ""; // no leftover message from a previous attempt
    }
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

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) setTab(t.dataset.tab);
  });
  panelEl.querySelector(".close").addEventListener("click", closePanel);

  // Hover previews wait a beat, so skimming the list does not flicker.
  let hoverTimer = 0;
  let hoveringList = false;
  worksEl.addEventListener("pointerover", (e) => {
    const a = e.target.closest("a[data-id]");
    if (!a || stageEl.hidden) return;
    hoveringList = true;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const ph = byId[a.dataset.id].photos[0];
      show(ph.src, { r: ph.r, fade: FADE.preview });
    }, 110);
  });
  worksEl.addEventListener("pointerleave", () => {
    hoveringList = false;
    clearTimeout(hoverTimer);
    if (!stageEl.hidden) hoverTimer = setTimeout(showCurrent, 110);
  });
  worksEl.addEventListener("click", () => {
    clearTimeout(hoverTimer);
    cameFrom = "index";
    body.classList.remove("panel-open");
    fitStage(); // glide the photograph back to the centre with the panel
    markSwitch();
  });

  // Index — Thumbnails ----------------------------------------------------

  const markSwitch = () => {
    const indexLink = document.querySelector('[data-view="index"]');
    indexLink.classList.toggle("is-active", isOpen());
    indexLink.setAttribute("aria-expanded", String(isOpen()));
    panelEl.inert = !isOpen(); // a closed panel is off screen: keep it out of Tab order
    document.querySelector('[data-view="index"]').classList.toggle("is-active", isOpen());
    document.querySelector('[data-view="thumbnails"]').classList.toggle("is-active", route().name === "thumbnails");
  };

  let lastStageHash = "#/";
  document.querySelector('[data-view="index"]').addEventListener("click", (e) => {
    e.preventDefault();
    if (route().name === "thumbnails") {
      location.hash = lastStageHash;
      setTimeout(() => openPanel("works"), 140);
    } else if (isOpen()) closePanel();
    else openPanel("works");
  });

  // Thumbnails: inside a project, only that project's photographs; from the
  // slideshow, every project grouped under its name.
  document.querySelector('[data-view="thumbnails"]').addEventListener("click", (e) => {
    e.preventDefault();
    // In a project, or on a slideshow photo (each belongs to a project), show
    // only that project's thumbnails.
    const id = viewing ? viewing.p.id : LANDING[slide].project;
    location.hash = id && byId[id] ? `#/thumbnails/${id}` : "#/thumbnails";
  });

  // Back: return to where the project was opened from.
  let cameFrom = "home";
  let thumbsReturn = "#/thumbnails";
  backEl.addEventListener("click", (e) => {
    e.preventDefault();
    // From Thumbnails: back to the slideshow photo or project it was opened from.
    if (route().name === "thumbnails") location.hash = lastStageHash;
    else if (cameFrom === "thumbs") location.hash = thumbsReturn;
    else {
      location.hash = "#/";
      if (cameFrom === "index") setTimeout(() => openPanel("works"), 140);
    }
  });

  // Slideshow -----------------------------------------------------------

  let slide = 0;
  let slideTimer = 0;
  let introPlaying = false;

  const showSlide = async (i) => {
    slide = (i + LANDING.length) % LANDING.length;
    const s = LANDING[slide];
    setLabel(byId[s.project] ? byId[s.project].title : null); // which project this photo is from
    await show(s.src, { alt: byId[s.project] ? `${byId[s.project].title}, photograph by Sundar Rajan` : "", r: s.r, fade: FADE.slide });
    prepare(LANDING[(slide + 1) % LANDING.length].src);
    prepare(LANDING[(slide - 1 + LANDING.length) % LANDING.length].src);
    schedule();
  };
  const schedule = () => {
    clearTimeout(slideTimer);
    if (reduced) return;
    slideTimer = setTimeout(function next() {
      // Keeps running beside the open Works list; pauses only while it is hovered.
      if (introPlaying || hoveringList || route().name !== "landing") return (slideTimer = setTimeout(next, 1200));
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
    const next = p.photos[n] || PROJECTS[(PROJECTS.indexOf(p) + 1) % PROJECTS.length].photos[0];
    prepare(next.src);
    if (p.photos[n - 2]) prepare(p.photos[n - 2].src);
    worksEl.querySelectorAll("a").forEach((a) => a.classList.toggle("is-current", a.dataset.id === p.id));
    document.title = `${p.title} — Sundar Rajan, Fashion Photographer`;
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
  // slideshow); touch screens show the name under the photograph.
  const [zonePrev, zoneNext] = zonesEl.querySelectorAll("button");
  function setLabel(name) {
    for (const z of [zonePrev, zoneNext]) {
      if (name) z.dataset.cursor = name;
      else delete z.dataset.cursor;
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
  const onStep = (d) => (e) => {
    e.preventDefault();
    if (isOpen()) closePanel();
    else step(d);
  };
  zonePrev.addEventListener("click", onStep(-1));
  zoneNext.addEventListener("click", onStep(1));
  $("arrow-prev").addEventListener("click", onStep(-1));
  $("arrow-next").addEventListener("click", onStep(1));

  // Swipe on touch screens.
  let touch = null;
  stageEl.addEventListener("touchstart", (e) => (touch = e.touches[0] && { x: e.touches[0].clientX, y: e.touches[0].clientY }), {
    passive: true,
  });
  stageEl.addEventListener(
    "touchend",
    (e) => {
      if (!touch || isOpen()) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 45 && Math.abs(dy) < 70) step(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );

  // Any other click outside the panel closes it.
  document.addEventListener("click", (e) => {
    if (!isOpen()) return;
    if (e.target.closest("#panel, [data-view='index'], .zones, .arrow, [data-tab]")) return;
    closePanel();
  });

  // Thumbnails ------------------------------------------------------------

  // scope: a project id (that project only) or "" (every project, grouped).
  let thumbsScope = null;
  const thumbsIO = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        thumbsIO.unobserve(e.target);
      }),
    { root: thumbsEl, rootMargin: "0px 0px -4% 0px" },
  );
  const buildThumbs = (scope) => {
    if (thumbsScope === scope) return;
    thumbsScope = scope;
    thumbsIO.disconnect();
    const list = scope ? [byId[scope]] : PROJECTS;
    thumbsEl.innerHTML = list
      .map(
        (p) =>
          // One project: photographs only. Every project: a name between groups.
          (scope ? "" : `<h2 class="thumbs-title">${esc(p.title)}</h2>`) +
          p.photos
            .map(
              (ph, i) =>
                `<a class="thumb" href="#/work/${p.id}/${i + 1}" data-cursor="${esc(p.title)}">` +
                // WebP where supported, JPEG otherwise: the browser picks.
                `<picture><source type="image/webp" srcset="${thumbOf(ph.src).replace(/\.jpg$/, ".webp")}" />` +
                `<img src="${thumbOf(ph.src)}" alt="${esc(p.title)}" loading="lazy" decoding="async" draggable="false" /></picture></a>`,
            )
            .join(""),
      )
      .join("");
    thumbsEl.scrollTop = 0;
    thumbsScroll = 0;
    thumbsEl.querySelectorAll(".thumb").forEach((t) => thumbsIO.observe(t));
  };
  thumbsEl.addEventListener("click", (e) => {
    if (!e.target.closest(".thumb")) return;
    cameFrom = "thumbs";
    thumbsReturn = location.hash;
  });

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

  // Enquiry form --------------------------------------------------------
  // Sends to the site's /api/enquiry. If that is not available (or not set
  // up yet), it opens the visitor's email app with the enquiry filled in,
  // so an enquiry is never lost.

  const form = $("enquiry");
  const statusEl = form.querySelector(".status");
  let formOpened = Date.now();

  const mailtoFallback = (d) => {
    const subject = encodeURIComponent(`${d.type} enquiry from ${d.name}`);
    const bodyText = encodeURIComponent(`${d.message}\n\n${d.name}\n${d.email}`);
    location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${bodyText}`;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    d.name = (d.name || "").trim();
    d.email = (d.email || "").trim();
    d.message = (d.message || "").trim();
    const problems = [];
    if (!d.name) problems.push("your name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) problems.push("a valid email");
    if (d.message.length < 10) problems.push("a short message");
    if (problems.length) {
      statusEl.textContent = `Please add ${problems.join(", ")}.`;
      return;
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    statusEl.textContent = "Sending…";
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, elapsed: Date.now() - formOpened }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.ok) {
        form.reset();
        statusEl.textContent = "Thank you. Your message has been sent.";
      } else if (res.status === 400 && out.error) {
        statusEl.textContent = out.error;
      } else {
        statusEl.textContent = "Opening your email app to send this…";
        mailtoFallback(d);
      }
    } catch {
      statusEl.textContent = "Opening your email app to send this…";
      mailtoFallback(d);
    } finally {
      button.disabled = false;
    }
  });

  // Router --------------------------------------------------------------

  const route = () => {
    const [a, b, c] = location.hash.replace(/^#\/?/, "").split("/");
    if (a === "work" && byId[b]) return { name: "project", p: byId[b], n: parseInt(c, 10) || 1 };
    if (a === "thumbnails") return { name: "thumbnails", scope: byId[b] ? b : "" };
    const panel = { index: "works", info: "info", contact: "contact" }[a] || null;
    return { name: "landing", panel };
  };

  const render = () => {
    const r = route();
    const thumbs = r.name === "thumbnails";
    body.classList.toggle("in-project", r.name === "project");
    body.classList.toggle("is-thumbs", thumbs);
    backEl.hidden = r.name === "landing"; // Back in projects and in Thumbnails
    document.title = "Sundar Rajan — Fashion Photographer, India & Europe";
    swapView(thumbs);

    if (thumbs) {
      if (isOpen()) {
        body.classList.remove("panel-open");
        fitStage();
      }
      buildThumbs(r.scope);
      touchName.textContent = "";
      document.title = r.scope ? `${byId[r.scope].title} — Thumbnails — Sundar Rajan` : "Thumbnails — Sundar Rajan";
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
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    if (e.key === "Escape") {
      if (isOpen()) closePanel();
      else if (route().name === "project") backEl.click();
      else if (route().name !== "landing") location.hash = "#/";
      return;
    }
    if (stageEl.hidden || isOpen()) return;
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });

  // Cursor --------------------------------------------------------------

  const cursor = $("cursor");
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

  // Fonts ---------------------------------------------------------------

  const fontsReady = Promise.race([
    document.fonts ? document.fonts.load('400 16px "Cormorant Garamond"') : Promise.resolve(),
    wait(1500),
  ]).catch(() => {});
  fontsReady.then(() => html.classList.remove("fonts-pending"));

  // Opening, in four beats:
  //   1. photographs cut fast in the centre (no text);
  //   2. a clean white page with only the name in the centre;
  //   3. the name dissolves in place;
  //   4. the page clears to the regular slideshow, and the Works list slides in.
  // Once per visit; add ?intro to the URL to see it again.

  const intro = $("intro");
  const introStage = $("intro-stage");
  let seen = false;
  try {
    seen = sessionStorage.getItem("sr-intro") === "1";
  } catch {}
  const firstRoute = route();
  const play = !reduced && (/[?&]intro\b/.test(location.search) || !seen) && firstRoute.name === "landing";

  // Arriving at the slideshow shows the work on the side.
  const showWorkOnSide = () => {
    if (route().name === "landing" && !isOpen()) openPanel("works");
  };

  // Everything below waits for the WebP check (a few milliseconds), so the
  // first photograph is already requested in the right format.
  const start = () => {
  thumbsEl.hidden = true;
  if (play) {
    introPlaying = true;
    body.classList.add("intro-playing");
  }
  render();

  if (!play) {
    intro.remove();
    if (firstRoute.name === "landing" && !firstRoute.panel) setTimeout(showWorkOnSide, 500);
  } else {
    // Twelve frames: one from every project, then four more (the small copies
    // load fast), cut quicker and quicker, then easing off.
    const frames = [
      ...PROJECTS.map((p) => p.photos[1] || p.photos[0]),
      ...PROJECTS.slice(0, 4).map((p) => p.photos[p.photos.length - 1]),
    ].map((ph) => thumbOf(ph.src));
    const HOLD = [230, 170, 130, 105, 92, 86, 86, 92, 105, 130, 170, 220];
    const timers = [];
    let finished = false;
    const nameEl = $("intro-name");

    // Frames are fetched in order; a frame that is not ready by its turn is
    // skipped rather than waited for, so a slow connection never stalls the run.
    const decoded = new Map();
    frames.forEach((f) => prepare(f).then((img) => img.naturalWidth && decoded.set(f, img)));

    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      intro.classList.add("is-out");
      body.classList.remove("intro-playing");
      try {
        sessionStorage.setItem("sr-intro", "1");
      } catch {}
      setTimeout(() => {
        intro.remove();
        introPlaying = false;
        if (route().name === "landing") {
          schedule();
          showWorkOnSide();
        }
      }, 480);
    };

    const cut = (img) => {
      if (!img) return;
      const el = img.cloneNode();
      el.alt = "";
      introStage.replaceChildren(el);
    };

    // The cuts start once the first three frames are in (at most 1.5 s).
    const firstThree = Promise.all(frames.slice(0, 3).map(prepare));
    Promise.race([Promise.all([fontsReady, firstThree]), wait(1500)]).then(() => {
      if (finished) return;
      let t = 0;
      // 1. Fast cuts.
      frames.forEach((f, k) => {
        timers.push(setTimeout(() => cut(decoded.get(f)), t));
        t += HOLD[k] ?? 100;
      });
      // 2. Clean page, then the name alone in the centre.
      timers.push(setTimeout(() => introStage.replaceChildren(), t));
      timers.push(setTimeout(() => intro.classList.add("name-in"), t + 250));
      // 3. After a moment on screen, the name dissolves (1.6 s).
      const dissolveAt = t + 250 + 700 + 700;
      timers.push(setTimeout(() => nameEl.classList.add("is-dissolving"), dissolveAt));
      // 4. Then the page clears to the slideshow.
      timers.push(setTimeout(finish, dissolveAt + 1650));
    });
    intro.addEventListener("click", finish);
    addEventListener("keydown", finish, { once: true });
  }
  };

  (window.__webp || Promise.resolve(false)).then((ok) => {
    webpOK = ok;
    start();
  });
})();
