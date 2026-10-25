// The admin page: edits the site's content and publishes it.
//
// Nothing changes on the site until Publish. Photographs are resized here, in
// the browser, into the three sizes the site uses (2000, 1200 and 700 px on
// the long side), each as JPEG and (where the browser can make it) WebP, and
// uploaded straight away; they appear on the site once published.

(() => {
  const $ = (id) => document.getElementById(id);
  const SIZES = { photos: 2000, medium: 1200, thumbs: 700 };
  const QUALITY = { jpeg: 0.86, webp: 0.82 };

  let state = null; // { projects, landing, bio, contact }
  let selected = 0; // project shown on the Projects tab
  let dirty = false;
  let uploading = 0;

  // Small helpers ----------------------------------------------------------

  const h = (tag, props = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    el.append(...kids.flat().filter((k) => k != null && k !== false));
    return el;
  };
  const thumb = (src) => `/${src.replace(/^photos\//, "thumbs/")}`;
  const slug = (s) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "project";
  const move = (list, from, to) => {
    if (to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
  };

  let toastTimer;
  const toast = (text, bad = false) => {
    const t = $("toast");
    t.textContent = text;
    t.classList.toggle("bad", bad);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), bad ? 7000 : 3500);
  };

  const api = async (path, opts = {}) => {
    const res = await fetch(`/admin/api/${path}`, { credentials: "same-origin", ...opts });
    let body = {};
    try {
      body = await res.json();
    } catch {}
    if (res.status === 401 && body.signedOut && path !== "login") {
      showSignin(state ? "Your session ended. Please sign in again." : "");
      throw new Error("signed out");
    }
    if (!res.ok || !body.ok) throw Object.assign(new Error(body.error || `Something went wrong (${res.status}).`), { body, status: res.status });
    return body;
  };

  const markDirty = () => {
    dirty = true;
    renderStatus();
  };
  const renderStatus = () => {
    $("save").disabled = !dirty || uploading > 0;
    $("status").textContent = uploading
      ? `Uploading ${uploading} photograph${uploading > 1 ? "s" : ""}…`
      : dirty
        ? "Unpublished changes"
        : "Everything is published";
    $("status").classList.toggle("warn", dirty || uploading > 0);
  };
  addEventListener("beforeunload", (e) => {
    if (dirty || uploading) e.preventDefault();
  });

  // Start: signed in? -------------------------------------------------------

  const showSignin = (msg = "") => {
    $("app").hidden = true;
    $("setup").hidden = true;
    $("signin").hidden = false;
    $("signin-msg").textContent = msg;
    $("password").focus();
  };

  const start = async () => {
    try {
      await api("session");
      await loadContent();
    } catch (err) {
      if (err.message === "signed out") return;
      if (err.body?.signedOut) return showSignin();
      if (err.status === 503) {
        $("setup").hidden = false;
        $("setup-msg").textContent = err.message;
        return;
      }
      showSignin(err.message);
    }
  };

  $("signin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || e.target.querySelector("button");
    btn.disabled = true;
    try {
      await api("login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("password").value }) });
      $("password").value = "";
      $("signin").hidden = true;
      await loadContent();
    } catch (err) {
      $("signin-msg").textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $("signout").addEventListener("click", async () => {
    if (dirty && !confirm("You have unpublished changes. Sign out anyway?")) return;
    await api("logout", { method: "POST" }).catch(() => {});
    dirty = false;
    showSignin();
  });

  // The content as the site has it now: saved in admin, else data.js.
  const fromSite = () => ({
    projects: structuredClone(window.PROJECTS),
    landing: structuredClone(window.LANDING),
    bio: [...window.SITE.bio],
    contact: {
      email: window.SITE.contact.email,
      instagram: window.SITE.contact.instagram ? window.SITE.contact.instagram.label.replace(/^@/, "") : "",
      based: window.SITE.contact.based || "",
    },
  });

  const loadContent = async () => {
    const { content } = await api("content");
    state = content || fromSite();
    dirty = false;
    $("app").hidden = false;
    renderAll();
  };

  // Tabs ----------------------------------------------------------------------

  const tabs = [...document.querySelectorAll("[data-tab]")];
  const openTab = (name) => {
    tabs.forEach((b) => (b.dataset.tab === name ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    document.querySelectorAll(".tab").forEach((s) => (s.hidden = s.id !== `tab-${name}`));
    if (name === "enquiries") loadEnquiries();
    if (name === "slideshow") renderSlides();
  };
  tabs.forEach((b) => b.addEventListener("click", () => openTab(b.dataset.tab)));

  const renderAll = () => {
    selected = Math.min(selected, state.projects.length - 1);
    renderProjectList();
    renderProject();
    renderSlides();
    renderInfo();
    renderStatus();
  };

  // Projects ------------------------------------------------------------------

  const inSlideshow = (src) => state.landing.some((s) => s.src === src);

  const renderProjectList = () => {
    $("project-list").replaceChildren(
      ...state.projects.map((p, i) =>
        h(
          "li",
          { class: i === selected ? "on" : "" },
          h("button", { type: "button", class: "pick", onclick: () => ((selected = i), renderProjectList(), renderProject()) }, h("span", {}, p.title || "Untitled"), h("small", {}, `${p.photos.length}`)),
          h(
            "span",
            { class: "order" },
            h("button", { type: "button", class: "icon", "aria-label": `Move ${p.title} up`, disabled: i === 0, onclick: () => (move(state.projects, i, i - 1), (selected = i - 1), markDirty(), renderAll()) }, "↑"),
            h("button", { type: "button", class: "icon", "aria-label": `Move ${p.title} down`, disabled: i === state.projects.length - 1, onclick: () => (move(state.projects, i, i + 1), (selected = i + 1), markDirty(), renderAll()) }, "↓"),
          ),
        ),
      ),
    );
  };

  $("add-project").addEventListener("click", () => {
    const title = prompt("Name of the new project:");
    if (!title || !title.trim()) return;
    let id = slug(title);
    const taken = new Set(state.projects.map((p) => p.id));
    for (let n = 2; taken.has(id); n++) id = `${slug(title)}-${n}`;
    state.projects.push({ id, title: title.trim(), photos: [] });
    selected = state.projects.length - 1;
    markDirty();
    renderAll();
    toast("Project added. Upload its photographs, then Publish.");
  });

  const renderProject = () => {
    const p = state.projects[selected];
    const box = $("project");
    if (!p) return box.replaceChildren(h("p", { class: "hint" }, "No projects yet."));

    const title = h("input", { type: "text", value: p.title, "aria-label": "Project title" });
    title.addEventListener("input", () => {
      p.title = title.value;
      markDirty();
      renderProjectList();
    });
    const idInput = h("input", { type: "text", value: p.id, "aria-label": "Address name" });
    idInput.addEventListener("change", () => {
      const id = slug(idInput.value);
      if (state.projects.some((q) => q !== p && q.id === id)) {
        toast("Another project already uses that address.", true);
        idInput.value = p.id;
        return;
      }
      state.landing.forEach((s) => s.project === p.id && (s.project = id));
      p.id = idInput.value = id;
      markDirty();
    });

    const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,image/heif", multiple: true, hidden: true });
    file.addEventListener("change", () => {
      upload(p, [...file.files]);
      file.value = "";
    });

    const grid = h(
      "ol",
      { class: "grid photos" },
      p.photos.map((ph, i) =>
        h(
          "li",
          { class: "tile", draggable: "true", "data-i": i },
          h("img", { src: thumb(ph.src), alt: "", loading: "lazy", draggable: "false" }),
          i === 0 ? h("span", { class: "badge" }, "Cover") : null,
          h(
            "span",
            { class: "tools" },
            h("button", { type: "button", class: "icon", "aria-label": "Move earlier", disabled: i === 0, onclick: () => (move(p.photos, i, i - 1), markDirty(), renderProject()) }, "←"),
            h("button", { type: "button", class: "icon", "aria-label": "Move later", disabled: i === p.photos.length - 1, onclick: () => (move(p.photos, i, i + 1), markDirty(), renderProject()) }, "→"),
            h(
              "button",
              {
                type: "button",
                class: `icon star${inSlideshow(ph.src) ? " on" : ""}`,
                "aria-label": inSlideshow(ph.src) ? "Remove from the slideshow" : "Add to the slideshow",
                title: inSlideshow(ph.src) ? "In the slideshow" : "Add to the slideshow",
                onclick: () => {
                  if (inSlideshow(ph.src)) state.landing = state.landing.filter((s) => s.src !== ph.src);
                  else state.landing.push({ src: ph.src, r: ph.r, project: p.id, n: i + 1 });
                  markDirty();
                  renderProject();
                },
              },
              inSlideshow(ph.src) ? "★" : "☆",
            ),
            h(
              "button",
              {
                type: "button",
                class: "icon",
                "aria-label": "Remove photograph",
                onclick: () => {
                  if (!confirm("Remove this photograph from the project?")) return;
                  p.photos.splice(i, 1);
                  state.landing = state.landing.filter((s) => s.src !== ph.src);
                  markDirty();
                  renderAll();
                },
              },
              "✕",
            ),
          ),
        ),
      ),
      h("li", { class: "tile add" }, h("button", { type: "button", onclick: () => file.click() }, h("span", {}, "+"), h("small", {}, "Add photographs"))),
    );
    dragSort(grid, p.photos, renderProject);
    // Dropping files anywhere on the project uploads them.
    box.ondragover = (e) => e.dataTransfer.types.includes("Files") && (e.preventDefault(), box.classList.add("drop"));
    box.ondragleave = () => box.classList.remove("drop");
    box.ondrop = (e) => {
      box.classList.remove("drop");
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      upload(p, [...e.dataTransfer.files]);
    };

    box.replaceChildren(
      h("div", { class: "fields" }, h("label", {}, "Title", title), h("label", {}, "Address", h("span", { class: "addr" }, "/#/work/", idInput))),
      h("p", { class: "hint" }, "Drag photographs to reorder, or drop files here to add them. The first one is the cover; ☆ puts one in the opening slideshow."),
      grid,
      file,
      h(
        "p",
        { class: "danger-zone" },
        h(
          "button",
          {
            type: "button",
            class: "quiet danger",
            onclick: () => {
              if (state.projects.length === 1) return toast("The site needs at least one project.", true);
              if (!confirm(`Delete the project "${p.title}" and its photographs from the site?`)) return;
              state.landing = state.landing.filter((s) => !p.photos.some((ph) => ph.src === s.src));
              state.projects.splice(selected, 1);
              selected = Math.max(0, selected - 1);
              markDirty();
              renderAll();
            },
          },
          "Delete project",
        ),
      ),
    );
  };

  // Drag to reorder (mouse); the arrows do the same on touch screens.
  const dragSort = (list, items, rerender) => {
    let from = null;
    list.addEventListener("dragstart", (e) => {
      const li = e.target.closest("[data-i]");
      if (!li) return;
      from = Number(li.dataset.i);
      e.dataTransfer.effectAllowed = "move";
      li.classList.add("dragging");
    });
    list.addEventListener("dragover", (e) => {
      if (from === null) return;
      e.preventDefault();
      const li = e.target.closest("[data-i]");
      list.querySelectorAll(".over").forEach((x) => x.classList.remove("over"));
      li?.classList.add("over");
    });
    list.addEventListener("drop", (e) => {
      if (from === null) return;
      e.preventDefault();
      e.stopPropagation();
      const li = e.target.closest("[data-i]");
      if (li) {
        move(items, from, Number(li.dataset.i));
        markDirty();
      }
      from = null;
      rerender();
    });
    list.addEventListener("dragend", () => {
      from = null;
      list.querySelectorAll(".dragging,.over").forEach((x) => x.classList.remove("dragging", "over"));
    });
  };

  // Uploads ---------------------------------------------------------------------

  const upload = async (project, files) => {
    const images = files.filter((f) => /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name));
    if (!images.length) return toast("Those are not photographs.", true);
    uploading += images.length;
    renderStatus();
    const folder = project.id;
    let failed = 0;
    // Two at a time: quick, without running the browser out of memory.
    const queue = [...images];
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift();
        try {
          const photo = await processAndUpload(f, folder);
          project.photos.push(photo);
          markDirty();
          if (state.projects[selected] === project) renderProject();
          renderProjectList();
        } catch (err) {
          failed++;
          console.error(f.name, err);
          toast(`${f.name}: ${err.message}`, true);
        } finally {
          uploading--;
          renderStatus();
        }
      }
    };
    await Promise.all([worker(), worker()]);
    if (!failed) toast(`${images.length} photograph${images.length > 1 ? "s" : ""} added. Publish to show ${images.length > 1 ? "them" : "it"} on the site.`);
  };

  const processAndUpload = async (file, folder) => {
    if (file.size > 60 * 1024 * 1024) throw new Error("larger than 60 MB.");
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      throw new Error("this browser cannot open that file. Try a JPEG.");
    }
    const r = bitmap.width / bitmap.height;
    const name = `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const files = [];
    for (const [dir, edge] of Object.entries(SIZES)) {
      const canvas = resize(bitmap, edge);
      const jpeg = await encode(canvas, "image/jpeg", QUALITY.jpeg);
      files.push({ path: `${dir}/${folder}/${name}.jpg`, blob: jpeg });
      const webp = await encode(canvas, "image/webp", QUALITY.webp);
      // Safari cannot make WebP; the site then serves the JPEG in its place.
      if (webp.type === "image/webp") files.push({ path: `${dir}/${folder}/${name}.webp`, blob: webp });
    }
    bitmap.close?.();
    for (const f of files) {
      await api(`image?path=${encodeURIComponent(f.path)}`, { method: "PUT", headers: { "Content-Type": f.blob.type }, body: f.blob });
    }
    return { src: `photos/${folder}/${name}.jpg`, r: Math.round(r * 1000) / 1000 };
  };

  // Halves the size step by step for a sharp result, then the last step.
  const resize = (src, edge) => {
    const scale = Math.min(1, edge / Math.max(src.width, src.height));
    const w = Math.round(src.width * scale);
    const h = Math.round(src.height * scale);
    let cur = src;
    let cw = src.width;
    let ch = src.height;
    while (cw / 2 >= w && ch / 2 >= h) {
      cw = Math.round(cw / 2);
      ch = Math.round(ch / 2);
      const c = canvasOf(cw, ch);
      draw(c, cur, cw, ch);
      cur = c;
    }
    const out = canvasOf(w, h);
    draw(out, cur, w, h);
    return out;
  };
  const canvasOf = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
  const draw = (canvas, img, w, h) => {
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
  };
  const encode = (canvas, type, q) =>
    new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("could not be converted."))), type, q));

  // Slideshow -------------------------------------------------------------------

  const renderSlides = () => {
    const title = (s) => state.projects.find((p) => p.id === s.project)?.title || "";
    const list = $("slides");
    list.replaceChildren(
      ...state.landing.map((s, i) =>
        h(
          "li",
          { class: "tile", draggable: "true", "data-i": i },
          h("img", { src: thumb(s.src), alt: "", loading: "lazy", draggable: "false" }),
          h("span", { class: "badge" }, `${i + 1}${title(s) ? ` · ${title(s)}` : ""}`),
          h(
            "span",
            { class: "tools" },
            h("button", { type: "button", class: "icon", "aria-label": "Move earlier", disabled: i === 0, onclick: () => (move(state.landing, i, i - 1), markDirty(), renderSlides()) }, "←"),
            h("button", { type: "button", class: "icon", "aria-label": "Move later", disabled: i === state.landing.length - 1, onclick: () => (move(state.landing, i, i + 1), markDirty(), renderSlides()) }, "→"),
            h(
              "button",
              {
                type: "button",
                class: "icon",
                "aria-label": "Take out of the slideshow",
                onclick: () => {
                  if (state.landing.length === 1) return toast("The slideshow needs at least one photograph.", true);
                  state.landing.splice(i, 1);
                  markDirty();
                  renderSlides();
                  renderProject();
                },
              },
              "✕",
            ),
          ),
        ),
      ),
    );
    if (!list.dataset.sortable) {
      list.dataset.sortable = "1";
      // state.landing is replaced on some edits, so look it up on each drop.
      dragSort(list, { get length() { return state.landing.length; }, splice: (...a) => state.landing.splice(...a) }, renderSlides);
    }
  };

  // Info ------------------------------------------------------------------------

  const renderInfo = () => {
    $("bio").value = state.bio.join("\n\n");
    $("email").value = state.contact.email;
    $("instagram").value = state.contact.instagram;
    $("based").value = state.contact.based;
  };
  $("bio").addEventListener("input", (e) => {
    state.bio = e.target.value.split(/\n\s*\n/).map((t) => t.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
    markDirty();
  });
  for (const id of ["email", "instagram", "based"]) {
    $(id).addEventListener("input", (e) => {
      const v = e.target.value.trim();
      state.contact[id] = id === "instagram" ? v.replace(/^@/, "") : v;
      markDirty();
    });
  }

  // Enquiries ---------------------------------------------------------------------

  const loadEnquiries = async () => {
    const list = $("enquiries");
    list.replaceChildren(h("li", { class: "hint" }, "Loading…"));
    try {
      const { enquiries } = await api("enquiries");
      if (!enquiries.length) return list.replaceChildren(h("li", { class: "hint" }, "No enquiries yet."));
      list.replaceChildren(
        ...enquiries.map((q) =>
          h(
            "li",
            { class: "enquiry" },
            h(
              "p",
              { class: "meta" },
              h("strong", {}, q.name),
              " · ",
              h("a", { href: `mailto:${q.email}?subject=${encodeURIComponent(`Re: your ${q.type.toLowerCase()} enquiry`)}` }, q.email),
              " · ",
              q.type,
              " · ",
              new Date(q.receivedAt).toLocaleString(),
            ),
            h("p", { class: "message" }, q.message),
            h(
              "button",
              {
                type: "button",
                class: "quiet danger",
                onclick: async (e) => {
                  if (!confirm("Delete this enquiry?")) return;
                  await api(`enquiries?key=${encodeURIComponent(q.key)}`, { method: "DELETE" });
                  e.target.closest("li").remove();
                },
              },
              "Delete",
            ),
          ),
        ),
      );
    } catch (err) {
      list.replaceChildren(h("li", { class: "hint" }, err.message));
    }
  };

  // Publish and undo ---------------------------------------------------------------

  $("save").addEventListener("click", async () => {
    const btn = $("save");
    btn.disabled = true;
    $("status").textContent = "Publishing…";
    try {
      const { content } = await api("content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
      state = content;
      dirty = false;
      renderAll();
      toast("Published. The site shows the changes now.");
    } catch (err) {
      renderStatus();
      toast(err.message, true);
    }
  });

  $("undo").addEventListener("click", async () => {
    if (!confirm("Put the site back to how it was before the last publish?")) return;
    try {
      const { content } = await api("restore", { method: "POST" });
      state = content;
      dirty = false;
      renderAll();
      toast("Back to the earlier version.");
    } catch (err) {
      toast(err.message, true);
    }
  });

  // Deferred, so the page and data.js are ready.
  start();
})();
