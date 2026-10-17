// Routing, views, intro and cursor for the editorial site.
// Routes: #/ (index), #/info, #/thumbnails, #/works/<id>/<n>.

(() => {
  const works = window.REA_WORKS;
  const byId = Object.fromEntries(works.map((w) => [w.id, w]));
  const body = document.body;
  const stage = document.getElementById("stage");
  const thumbs = document.getElementById("thumbs");
  const list = document.getElementById("works-list");
  const cursor = document.getElementById("cursor");
  const cursorLabel = cursor.querySelector(".label");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const name = (w) => `${w.title} — ${w.subtitle}`;
  const pad = (n) => String(n);

  const printEl = (plate, opts) => {
    const el = document.createElement("div");
    el.className = "print";
    el.style.setProperty("--r", plate.r);
    el.style.setProperty("--plate-bg", plate.pal.bg);
    el.innerHTML = window.renderPlate(plate, opts);
    return el;
  };

  // Works list ------------------------------------------------------------

  list.innerHTML = works
    .map(
      (w) =>
        `<li><a href="#/works/${w.id}/1" data-id="${w.id}">` +
        `<span class="name">${name(w)}</span>` +
        (w.tag ? `<span class="tag">${w.tag}</span>` : "") +
        `<span class="count">${w.plates.length}</span></a></li>`,
    )
    .join("");

  let hoverId = null;
  list.addEventListener("pointerover", (e) => {
    const a = e.target.closest("a[data-id]");
    if (!a || a.dataset.id === hoverId || route().view !== "index") return;
    hoverId = a.dataset.id;
    showFeatured(byId[hoverId]);
  });
  list.addEventListener("pointerleave", () => {
    hoverId = null;
  });

  // Photo credits, generated from the plates that carry one.
  const credited = works.flatMap((w) => w.plates.filter((p) => p.credit));
  document.getElementById("credits").innerHTML =
    `Photographs from <a href="https://www.pexels.com/" target="_blank" rel="noopener">Pexels</a>: ` +
    credited
      .map((p, i) => `<a href="${p.credit}" target="_blank" rel="noopener" title="${p.alt}">${i + 1}</a>`)
      .join(", ") +
    ".";

  // Panel tabs ------------------------------------------------------------

  const setTab = (tab) => {
    document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    document.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab));
  };
  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      location.hash = b.dataset.tab === "info" ? "#/info" : "#/";
    }),
  );
  document.querySelector(".panel-close").addEventListener("click", () => body.classList.remove("panel-open"));

  document.querySelector("[data-copy]").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const state = btn.querySelector(".cmd-state");
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      state.textContent = "Copied";
    } catch {
      state.textContent = "Select and copy";
    }
    setTimeout(() => (state.textContent = "Copy"), 1600);
  });

  // Index view: one featured print that follows the list ------------------

  let featuredId = null;
  let cycle = null;

  const showFeatured = (w) => {
    if (featuredId === w.id) return;
    featuredId = w.id;
    const inner = document.createElement("div");
    inner.className = "stage-inner";
    const a = document.createElement("a");
    a.href = `#/works/${w.id}/1`;
    a.dataset.cursor = `${name(w)} — View`;
    a.setAttribute("aria-label", `Open ${name(w)}`);
    a.appendChild(printEl(w.plates[0], { eager: true }));
    inner.appendChild(a);
    stage.replaceChildren(inner);
    list.querySelectorAll("a").forEach((x) => x.classList.toggle("is-current", x.dataset.id === w.id));
  };

  const startCycle = () => {
    stopCycle();
    if (reduced) return;
    cycle = setInterval(() => {
      if (hoverId) return;
      const i = works.findIndex((w) => w.id === featuredId);
      showFeatured(works[(i + 1) % works.length]);
    }, 4200);
  };
  const stopCycle = () => clearInterval(cycle);

  // Work view: one plate at a time, click halves to step ------------------

  let viewing = null;

  const showWork = (w, n) => {
    const total = w.plates.length;
    n = ((n - 1 + total) % total) + 1;
    viewing = { w, n, total };
    featuredId = null;
    const inner = document.createElement("div");
    inner.className = "stage-inner";
    const print = printEl(w.plates[n - 1], { eager: true });
    const zones = document.createElement("div");
    zones.className = "zones";
    zones.innerHTML =
      `<a href="#/works/${w.id}/${n === 1 ? total : n - 1}" data-cursor="‹ ${name(w)} — ${n}/${total}" aria-label="Previous"></a>` +
      `<a href="#/works/${w.id}/${n === total ? 1 : n + 1}" data-cursor="${name(w)} — ${n}/${total} ›" aria-label="Next"></a>`;
    print.appendChild(zones);
    const alt = w.plates[n - 1].alt;
    if (alt) print.setAttribute("aria-label", alt);
    const cap = document.createElement("p");
    cap.className = "caption";
    cap.innerHTML =
      (n === 1 ? `${w.text} ` : `${name(w)}, ${w.kind}. `) +
      `<a href="${w.href}" target="_blank" rel="noopener">Read the investigation</a>` +
      (w.plates[n - 1].credit
        ? ` · <a href="${w.plates[n - 1].credit}" target="_blank" rel="noopener">Photo: Pexels</a>`
        : "");
    inner.append(print, cap);
    stage.replaceChildren(inner);
    document.title = `${name(w)} — REA`;
  };

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
      { rootMargin: "0px 0px -6% 0px" },
    );
    works.forEach((w) =>
      w.plates.forEach((p, i) => {
        const a = document.createElement("a");
        a.className = "thumb";
        a.href = `#/works/${w.id}/${i + 1}`;
        a.dataset.cursor = `${name(w)} — ${i + 1}/${w.plates.length}`;
        a.appendChild(printEl(p));
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.innerHTML = `<span>${name(w)}</span><span>${i + 1}/${w.plates.length}</span>`;
        a.appendChild(meta);
        thumbs.appendChild(a);
        io.observe(a);
      }),
    );
  };

  // Router ----------------------------------------------------------------

  const route = () => {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts[0] === "thumbnails") return { view: "thumbnails" };
    if (parts[0] === "works" && byId[parts[1]]) return { view: "work", w: byId[parts[1]], n: parseInt(parts[2], 10) || 1 };
    return { view: "index", tab: parts[0] === "info" ? "info" : "works" };
  };

  const render = () => {
    const r = route();
    body.classList.toggle("is-thumbs", r.view === "thumbnails");
    stage.hidden = r.view === "thumbnails";
    thumbs.hidden = r.view !== "thumbnails";
    document.querySelectorAll("[data-view]").forEach((a) =>
      a.classList.toggle("is-active", a.dataset.view === (r.view === "thumbnails" ? "thumbnails" : "index")),
    );
    stopCycle();
    viewing = null;

    if (r.view === "index") {
      body.classList.add("panel-open");
      setTab(r.tab);
      document.title = "REA — Reverse Engineer Anything";
      showFeatured(byId[featuredId] || works[0]);
      startCycle();
    } else if (r.view === "work") {
      body.classList.remove("panel-open");
      showWork(r.w, r.n);
    } else {
      body.classList.remove("panel-open");
      document.title = "Thumbnails — REA";
      buildThumbs();
      window.scrollTo(0, 0);
    }
    refreshCursor();
  };

  window.addEventListener("hashchange", render);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      location.hash = "#/";
      return;
    }
    if (!viewing) return;
    const { w, n, total } = viewing;
    if (e.key === "ArrowRight") location.hash = `#/works/${w.id}/${n === total ? 1 : n + 1}`;
    if (e.key === "ArrowLeft") location.hash = `#/works/${w.id}/${n === 1 ? total : n - 1}`;
  });

  // Cursor: a 5px dot that eases after the pointer and carries a label ----

  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const drawn = { ...pos };
  let lastTarget = null;

  const refreshCursor = () => {
    const el = lastTarget && lastTarget.isConnected ? lastTarget : document.elementFromPoint(pos.x, pos.y);
    const host = el && el.closest("[data-cursor]");
    const text = host ? host.dataset.cursor : "";
    cursorLabel.textContent = text;
    cursor.classList.toggle("has-label", !!text);
    cursor.classList.toggle("on-print", !!(el && el.closest(".print")));
  };

  if (finePointer) {
    body.classList.add("has-cursor");
    document.addEventListener("pointermove", (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      lastTarget = e.target;
      refreshCursor();
    });
    document.addEventListener("pointerleave", () => cursor.classList.remove("has-label"));
    // Scrolling moves content under a still pointer.
    addEventListener(
      "scroll",
      () => {
        lastTarget = null;
        refreshCursor();
      },
      { passive: true },
    );
    const tick = () => {
      const k = reduced ? 1 : 0.28;
      drawn.x += (pos.x - drawn.x) * k;
      drawn.y += (pos.y - drawn.y) * k;
      cursor.style.transform = `translate(${drawn.x}px, ${drawn.y}px) translateY(-50%)`;
      requestAnimationFrame(tick);
    };
    tick();
    // The element under a still pointer changes when the stage re-renders.
    new MutationObserver(() => {
      lastTarget = null;
      refreshCursor();
    }).observe(stage, { childList: true, subtree: false });
  }

  // Intro: a quick run of prints before the index ------------------------

  const intro = document.getElementById("intro");
  const frame = document.getElementById("intro-frame");
  let seen = false;
  try {
    seen = sessionStorage.getItem("rea-intro") === "1";
  } catch {}

  const endIntro = () => {
    intro.classList.add("is-done");
    setTimeout(() => intro.remove(), 1000);
    try {
      sessionStorage.setItem("rea-intro", "1");
    } catch {}
  };

  render();

  if (reduced || seen || route().view !== "index") {
    intro.remove();
  } else {
    const run = works.flatMap((w) => w.plates.slice(0, 2)).filter((p) => p.type !== "img").slice(0, 12);
    let i = 0;
    const step = () => {
      if (i >= run.length) return endIntro();
      frame.replaceChildren(printEl(run[i++], { eager: true }));
      timer = setTimeout(step, i === 1 ? 700 : 330);
    };
    let timer = setTimeout(step, 450);
    intro.addEventListener("click", () => {
      clearTimeout(timer);
      endIntro();
    });
  }
})();
