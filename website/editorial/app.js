// Routes: #/ (slideshow), #/work, #/work/<project>/<n>, #/info.

(() => {
  const LANDING = window.LANDING;
  const PROJECTS = window.PROJECTS;
  const byId = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
  const body = document.body;
  const view = document.getElementById("view");
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
  const pad2 = (n) => String(n).padStart(2, "0");

  // A stage shows one photograph and crossfades to the next. Only the current
  // image and the one after it are ever loaded.
  const makeStage = (el) => {
    let current = null;
    return (src, alt) => {
      if (current && current.dataset.src === src) return;
      const img = new Image();
      img.dataset.src = src;
      img.alt = alt || "";
      img.decoding = "async";
      img.src = src;
      el.prepend(img);
      const prev = current;
      current = img;
      const reveal = () => {
        if (current !== img) return;
        img.classList.add("is-shown");
        if (prev) {
          prev.classList.remove("is-shown");
          setTimeout(() => prev.remove(), 1500);
        }
      };
      if (img.complete) requestAnimationFrame(reveal);
      else img.addEventListener("load", reveal, { once: true });
    };
  };

  const preload = (src) => {
    if (src) new Image().src = src;
  };

  // Landing slideshow ---------------------------------------------------

  let slideTimer = null;
  let slide = 0;
  let introPlaying = false;

  const renderLanding = () => {
    view.innerHTML =
      `<section class="view landing">` +
      `<div class="stage"><div class="zones"><a href="#/" data-dir="1" data-cursor="Next" aria-label="Next photograph" style="grid-column: 1 / -1"></a></div></div>` +
      `<footer class="foot"><span></span><span class="muted count"></span></footer>` +
      `</section>`;
    const stageEl = view.querySelector(".stage");
    const show = makeStage(stageEl);
    const count = view.querySelector(".count");

    const go = (i) => {
      slide = (i + LANDING.length) % LANDING.length;
      show(LANDING[slide].src);
      count.textContent = `${pad2(slide + 1)} / ${pad2(LANDING.length)}`;
      preload(LANDING[(slide + 1) % LANDING.length].src);
      schedule();
    };
    const schedule = () => {
      clearTimeout(slideTimer);
      if (reduced) return;
      slideTimer = setTimeout(() => (introPlaying ? schedule() : go(slide + 1)), 5200);
    };

    view.querySelector(".zones a").addEventListener("click", (e) => {
      e.preventDefault();
      go(slide + 1);
    });
    landingStep = (d) => go(slide + d);
    go(slide);
  };

  let landingStep = null;

  // Work ----------------------------------------------------------------

  const renderWork = () => {
    view.innerHTML =
      `<section class="view work">` +
      PROJECTS.map(
        (p) =>
          `<a class="cover" href="#/work/${p.id}/1">` +
          `<img src="${p.photos[0].src}" alt="${esc(p.title)}" loading="lazy" decoding="async" style="aspect-ratio:${p.photos[0].r}" />` +
          `<span class="caption"><span>${esc(p.title)}</span><span class="muted">${p.photos.length}</span></span></a>`,
      ).join("") +
      `</section>`;
  };

  // Project -------------------------------------------------------------

  let viewing = null;
  let projectShow = null;

  const projectHref = (p, n) => {
    if (n < 1) {
      const prev = PROJECTS[(PROJECTS.indexOf(p) - 1 + PROJECTS.length) % PROJECTS.length];
      return `#/work/${prev.id}/${prev.photos.length}`;
    }
    if (n > p.photos.length) {
      const next = PROJECTS[(PROJECTS.indexOf(p) + 1) % PROJECTS.length];
      return `#/work/${next.id}/1`;
    }
    return `#/work/${p.id}/${n}`;
  };

  const renderProject = (p, n, sameProject) => {
    const total = p.photos.length;
    n = Math.min(Math.max(n, 1), total);
    viewing = { p, n, total };
    if (!sameProject) {
      view.innerHTML =
        `<section class="view project">` +
        `<div class="stage"><div class="zones"><a data-zone="prev"></a><a data-zone="next"></a></div></div>` +
        `<footer class="foot"><span>${esc(p.title)}</span><span class="muted count"></span></footer>` +
        `</section>`;
      projectShow = makeStage(view.querySelector(".stage"));
    }
    projectShow(p.photos[n - 1].src, `${p.title}, ${n} of ${total}`);
    view.querySelector(".count").textContent = `${n} / ${total}`;
    const prev = view.querySelector('[data-zone="prev"]');
    const next = view.querySelector('[data-zone="next"]');
    prev.href = projectHref(p, n - 1);
    next.href = projectHref(p, n + 1);
    prev.dataset.cursor = "Previous";
    next.dataset.cursor = n === total ? "Next project" : "Next";
    prev.setAttribute("aria-label", "Previous photograph");
    next.setAttribute("aria-label", n === total ? "Next project" : "Next photograph");
    preload(p.photos[n] && p.photos[n].src);
    document.title = `${p.title} — Sundar Rajan`;
  };

  // Info ----------------------------------------------------------------

  const renderInfo = () => {
    view.innerHTML =
      `<section class="view info">` +
      `<div class="bio">${BIO.map((t) => `<p>${esc(t)}</p>`).join("")}</div>` +
      `<dl class="contact">` +
      `<dt>Email</dt><dd><a href="mailto:${CONTACT.email}">${esc(CONTACT.email)}</a></dd>` +
      `<dt>Instagram</dt><dd><a href="${CONTACT.instagram.href}">${esc(CONTACT.instagram.label)}</a></dd>` +
      `<dt>Based</dt><dd>${esc(CONTACT.based)}</dd>` +
      `</dl></section>`;
  };

  // Router --------------------------------------------------------------

  const route = () => {
    const [a, b, c] = location.hash.replace(/^#\/?/, "").split("/");
    if (a === "work" && byId[b]) return { name: "project", p: byId[b], n: parseInt(c, 10) || 1 };
    if (a === "work") return { name: "work" };
    if (a === "info") return { name: "info" };
    return { name: "landing" };
  };

  let last = null;

  const render = () => {
    const r = route();
    const sameProject = r.name === "project" && last && last.name === "project" && last.p === r.p;
    clearTimeout(slideTimer);
    landingStep = null;
    viewing = null;
    body.classList.toggle("scroll", r.name === "work" || r.name === "info");
    document.querySelectorAll("[data-route]").forEach((a) =>
      a.classList.toggle("is-active", a.dataset.route === r.name || (a.dataset.route === "work" && r.name === "project")),
    );
    document.title = "Sundar Rajan";
    if (r.name === "landing") renderLanding();
    else if (r.name === "work") renderWork();
    else if (r.name === "project") renderProject(r.p, r.n, sameProject);
    else renderInfo();
    if (!sameProject) window.scrollTo(0, 0);
    last = r;
    lastTarget = null;
    refreshCursor();
  };

  window.addEventListener("hashchange", render);

  document.addEventListener("keydown", (e) => {
    if (viewing) {
      const { p, n } = viewing;
      if (e.key === "ArrowRight") location.hash = projectHref(p, n + 1);
      if (e.key === "ArrowLeft") location.hash = projectHref(p, n - 1);
      if (e.key === "Escape") location.hash = "#/work";
    } else if (landingStep) {
      if (e.key === "ArrowRight") landingStep(1);
      if (e.key === "ArrowLeft") landingStep(-1);
    }
  });

  // Cursor --------------------------------------------------------------

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
      const k = reduced ? 1 : 0.22;
      drawn.x += (pos.x - drawn.x) * k;
      drawn.y += (pos.y - drawn.y) * k;
      cursor.style.transform = `translate(${drawn.x}px, ${drawn.y}px) translateY(-50%)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  // Opening: the name fades in alone, then the page dissolves to reveal the
  // first photograph. Once per visit; add ?intro to the URL to see it again.

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
    const end = () => {
      if (intro.classList.contains("is-out")) return;
      intro.classList.add("is-out");
      setTimeout(() => {
        intro.remove();
        introPlaying = false;
      }, 1700);
      try {
        sessionStorage.setItem("sr-intro", "1");
      } catch {}
    };
    requestAnimationFrame(() => requestAnimationFrame(() => intro.classList.add("is-in")));
    // Wait for the first photograph, so it is there when the page clears.
    const first = new Image();
    first.src = LANDING[0].src;
    const minHold = new Promise((r) => setTimeout(r, 2200));
    const loaded = new Promise((r) => {
      if (first.complete) r();
      first.onload = first.onerror = r;
    });
    const cap = new Promise((r) => setTimeout(r, 6000));
    Promise.race([Promise.all([minHold, loaded]), cap]).then(end);
    intro.addEventListener("click", end);
    addEventListener("keydown", end, { once: true });
  }
})();
