// Routes: #/ (slideshow), #/work/<project>/<n>, #/thumbnails,
// #/index and #/info (slideshow with the panel open on that tab).

(() => {
  const LANDING = window.LANDING;
  const PROJECTS = window.PROJECTS;
  const byId = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
  const body = document.body;
  const stageEl = document.getElementById("stage");
  const thumbsEl = document.getElementById("thumbs");
  const worksEl = document.getElementById("works");
  const infoEl = document.getElementById("info");
  const touchCount = document.getElementById("touch-count");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

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
  const preload = (src) => src && (new Image().src = src);

  // Stage: shows one photograph and crossfades to the next. Shared by the
  // slideshow and the projects, so moving between them is one dissolve.

  let shownSrc = null;
  let shownImg = null;
  const show = (src, alt = "") => {
    if (shownSrc === src) return;
    shownSrc = src;
    const img = new Image();
    img.alt = alt;
    img.decoding = "async";
    img.src = src;
    stageEl.prepend(img);
    const prev = shownImg;
    shownImg = img;
    const reveal = () => {
      if (shownImg !== img) return img.remove();
      img.classList.add("is-shown");
      if (prev) {
        prev.classList.remove("is-shown");
        setTimeout(() => prev.remove(), 1300);
      }
    };
    if (img.complete) requestAnimationFrame(reveal);
    else img.addEventListener("load", reveal, { once: true });
  };

  // Panel ---------------------------------------------------------------

  worksEl.innerHTML = PROJECTS.map(
    (p) =>
      `<li><a href="#/work/${p.id}/1" data-id="${p.id}">` +
      `<span class="title">${esc(p.title)}</span><span class="count">${p.photos.length}</span></a></li>`,
  ).join("");

  infoEl.innerHTML =
    BIO.map((t) => `<p>${esc(t)}</p>`).join("") +
    `<dl>` +
    `<dt>Email</dt><dd><a href="mailto:${CONTACT.email}">${esc(CONTACT.email)}</a></dd>` +
    `<dt>Instagram</dt><dd><a href="${CONTACT.instagram.href}" target="_blank" rel="noopener">${esc(CONTACT.instagram.label)}</a></dd>` +
    `<dt>Based</dt><dd>${esc(CONTACT.based)}</dd>` +
    `</dl>`;

  const setTab = (tab) => {
    document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    document.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab));
  };
  const openPanel = (tab = "works") => {
    setTab(tab);
    body.classList.add("panel-open");
    markSwitch();
  };
  const closePanel = () => {
    body.classList.remove("panel-open");
    markSwitch();
  };

  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  document.querySelector(".tabs .close").addEventListener("click", closePanel);

  // Hovering a project previews its cover; leaving the list restores the view.
  worksEl.addEventListener("pointerover", (e) => {
    const a = e.target.closest("a[data-id]");
    if (a && !stageEl.hidden) show(byId[a.dataset.id].photos[0].src);
  });
  worksEl.addEventListener("pointerleave", () => !stageEl.hidden && showCurrent());
  worksEl.addEventListener("click", () => body.classList.remove("panel-open"));

  // Index — Thumbnails ----------------------------------------------------

  const markSwitch = () => {
    const thumbs = route().name === "thumbnails";
    document.querySelector('[data-view="index"]').classList.toggle("is-active", body.classList.contains("panel-open"));
    document.querySelector('[data-view="thumbnails"]').classList.toggle("is-active", thumbs);
  };

  let lastStageHash = "#/";
  document.querySelector('[data-view="index"]').addEventListener("click", (e) => {
    e.preventDefault();
    if (route().name === "thumbnails") {
      location.hash = lastStageHash;
      requestAnimationFrame(() => openPanel("works"));
    } else if (body.classList.contains("panel-open")) closePanel();
    else openPanel("works");
  });

  // Slideshow -----------------------------------------------------------

  let slide = 0;
  let slideTimer = null;
  let introPlaying = false;

  const showSlide = (i) => {
    slide = (i + LANDING.length) % LANDING.length;
    show(LANDING[slide].src);
    preload(LANDING[(slide + 1) % LANDING.length].src);
    label(`${slide + 1}/${LANDING.length}`);
    clearTimeout(slideTimer);
    if (!reduced) slideTimer = setTimeout(function next() {
      if (introPlaying || route().name !== "landing") return (slideTimer = setTimeout(next, 1000));
      showSlide(slide + 1);
    }, 5200);
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
    show(p.photos[n - 1].src, `${p.title}, ${n} of ${total}`);
    preload(p.photos[n] && p.photos[n].src);
    label(`${p.title} — ${n}/${total}`);
    worksEl.querySelectorAll("a").forEach((a) => a.classList.toggle("is-current", a.dataset.id === p.id));
    document.title = `${p.title} — Sundar Rajan`;
  };

  const showCurrent = () => {
    if (viewing) show(viewing.p.photos[viewing.n - 1].src);
    else show(LANDING[slide].src);
  };

  // Cursor labels for the two halves of the photograph, and the touch count.
  const [zonePrev, zoneNext] = stageEl.querySelectorAll(".zones a");
  function label(text) {
    zonePrev.dataset.cursor = `‹ ${text}`;
    zoneNext.dataset.cursor = `${text} ›`;
    touchCount.textContent = text.replace("/", " / ");
    refreshCursor();
  }

  const step = (d) => {
    if (viewing) location.hash = projectHref(viewing.p, viewing.n + d);
    else showSlide(slide + d);
  };
  // With the panel open, a click on the photograph only closes the panel.
  const onZone = (d) => (e) => {
    e.preventDefault();
    if (body.classList.contains("panel-open")) closePanel();
    else step(d);
  };
  zonePrev.addEventListener("click", onZone(-1));
  zoneNext.addEventListener("click", onZone(1));

  // Any other click outside the panel closes it too, so without a click
  // there is nothing on screen but the photographs.
  document.addEventListener("click", (e) => {
    if (!body.classList.contains("panel-open")) return;
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
      { rootMargin: "0px 0px -5% 0px" },
    );
    thumbsEl.innerHTML = PROJECTS.flatMap((p) =>
      p.photos.map(
        (ph, i) =>
          `<a class="thumb" href="#/work/${p.id}/${i + 1}" data-cursor="${esc(p.title)} — ${i + 1}/${p.photos.length}">` +
          `<img src="${ph.src}" alt="${esc(p.title)}, ${i + 1} of ${p.photos.length}" loading="lazy" decoding="async" style="aspect-ratio:${ph.r}" /></a>`,
      ),
    ).join("");
    thumbsEl.querySelectorAll(".thumb").forEach((t) => io.observe(t));
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
    body.classList.toggle("is-thumbs", thumbs);
    body.classList.toggle("in-project", r.name === "project");
    stageEl.hidden = thumbs;
    thumbsEl.hidden = !thumbs;
    document.title = "Sundar Rajan";

    if (thumbs) {
      body.classList.remove("panel-open");
      buildThumbs();
      window.scrollTo(0, 0);
      touchCount.textContent = "";
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
      if (body.classList.contains("panel-open")) closePanel();
      else if (route().name !== "landing") location.hash = "#/";
      return;
    }
    if (stageEl.hidden) return;
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });

  // Cursor --------------------------------------------------------------

  const cursor = document.getElementById("cursor");
  const cursorLabel = cursor.querySelector(".label");
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
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
      const k = reduced ? 1 : 0.22;
      drawn.x += (pos.x - drawn.x) * k;
      drawn.y += (pos.y - drawn.y) * k;
      cursor.style.transform = `translate(${drawn.x}px, ${drawn.y}px) translateY(-50%)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  // Opening: the name fades in alone, then slowly smudges away (smearing
  // sideways as it melts) while the page clears to the slideshow.
  // Once per visit; add ?intro to the URL to see it again.

  const intro = document.getElementById("intro");
  let seen = false;
  try {
    seen = sessionStorage.getItem("sr-intro") === "1";
  } catch {}
  const play = !reduced && (/[?&]intro\b/.test(location.search) || !seen) && route().name === "landing";

  render();

  if (!play) {
    intro.remove();
  } else {
    introPlaying = true;
    const nameEl = document.getElementById("intro-name");
    const map = document.getElementById("smudge-map");
    let raf = 0;

    const reveal = () => {
      if (intro.classList.contains("is-out")) return;
      intro.classList.add("is-out");
      setTimeout(() => {
        cancelAnimationFrame(raf);
        intro.remove();
        introPlaying = false;
        if (route().name === "landing") showSlide(slide); // the first slide gets its full time
      }, 1700);
      try {
        sessionStorage.setItem("sr-intro", "1");
      } catch {}
    };

    // Smudge: the displacement, blur and letter spacing grow while the name
    // fades; halfway through, the page starts clearing to the slideshow.
    const smudge = () => {
      const D = 2400;
      const start = performance.now();
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      nameEl.classList.add("is-smudging");
      const frame = (now) => {
        const t = Math.min(1, (now - start) / D);
        const e = ease(t);
        map.setAttribute("scale", (18 * e).toFixed(2));
        nameEl.style.filter = `url(#smudge) blur(${(3.2 * e).toFixed(2)}px)`;
        nameEl.style.letterSpacing = `${(0.14 + 0.16 * e).toFixed(3)}em`;
        nameEl.style.transform = `scaleX(${(1 + 0.12 * e).toFixed(3)})`;
        nameEl.style.opacity = (1 - e).toFixed(3);
        if (t > 0.45) reveal();
        if (t < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    requestAnimationFrame(() => requestAnimationFrame(() => intro.classList.add("is-in")));
    const first = new Image();
    first.src = LANDING[0].src;
    const loaded = new Promise((r) => {
      if (first.complete) r();
      first.onload = first.onerror = r;
    });
    // Hold the name for a moment (and until the first photograph is ready).
    Promise.race([
      Promise.all([loaded, new Promise((r) => setTimeout(r, 2000))]),
      new Promise((r) => setTimeout(r, 6000)),
    ]).then(smudge);
    intro.addEventListener("click", reveal);
    addEventListener("keydown", reveal, { once: true });
  }
})();
