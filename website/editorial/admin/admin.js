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
    $("reset").hidden = true;
    $("signin").hidden = false;
    $("signin-msg").textContent = msg;
    $("signin-msg").classList.remove("ok");
    $("password").focus();
  };

  // The emailed link opens /admin/#reset=<token>. The token is taken out of
  // the address at once, so it does not stay in history or get copied.
  let resetToken = null;
  const takeResetToken = () => {
    const m = location.hash.match(/^#reset=([A-Za-z0-9_-]{43})$/);
    if (!m) return false;
    resetToken = m[1];
    history.replaceState(null, "", location.pathname);
    return true;
  };
  takeResetToken();
  // The link opened in a tab that already had the admin open.
  addEventListener("hashchange", () => {
    if (!takeResetToken()) return;
    ["app", "signin", "setup"].forEach((id) => ($(id).hidden = true));
    $("reset").hidden = false;
    $("reset-pass").focus();
  });

  const start = async () => {
    if (resetToken) {
      $("reset").hidden = false;
      $("reset-pass").focus();
      return;
    }
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

  $("forgot").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const { message } = await api("forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      $("signin-msg").textContent = message;
      $("signin-msg").classList.add("ok");
    } catch (err) {
      $("signin-msg").textContent = err.message;
    } finally {
      setTimeout(() => (e.target.disabled = false), 30000); // no rapid repeats
    }
  });

  const sameTwice = (a, b, msg) => {
    if ($(a).value !== $(b).value) {
      $(msg).textContent = "The two passwords are not the same.";
      return false;
    }
    return true;
  };

  $("reset-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sameTwice("reset-pass", "reset-pass2", "reset-msg")) return;
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await api("reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, password: $("reset-pass").value }) });
      resetToken = null;
      e.target.reset();
      $("reset").hidden = true;
      await loadContent();
      toast("New password saved. Every other device has been signed out.");
    } catch (err) {
      $("reset-msg").textContent = err.message;
      if (err.body?.expired) {
        resetToken = null;
        setTimeout(() => showSignin("That link has expired. Ask for a new one with “Forgot password?”."), 2500);
      }
    } finally {
      btn.disabled = false;
    }
  });

  $("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("pw-msg").textContent = "";
    if (!sameTwice("pw-new", "pw-new2", "pw-msg")) return;
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await api("password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: $("pw-current").value, next: $("pw-new").value }) });
      e.target.reset();
      toast("Password changed. Every other device has been signed out.");
    } catch (err) {
      $("pw-msg").textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $("signout-all").addEventListener("click", async () => {
    if (!confirm("Sign out on every device, including this one?")) return;
    await api("signout-everywhere", { method: "POST" }).catch(() => {});
    dirty = false;
    state = null;
    showSignin("Signed out everywhere.");
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
  // The project's card in Thumbnails: the chosen cover, else the first photograph.
  const coverSrc = (p) => (p.photos.some((ph) => ph.src === p.cover) ? p.cover : p.photos[0]?.src);

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
          ph.src === coverSrc(p) ? h("span", { class: "badge" }, "Cover") : null,
          h(
            "span",
            { class: "tools" },
            h("button", { type: "button", class: "icon", "aria-label": "Move earlier", disabled: i === 0, onclick: () => (move(p.photos, i, i - 1), markDirty(), renderProject()) }, "←"),
            h("button", { type: "button", class: "icon", "aria-label": "Move later", disabled: i === p.photos.length - 1, onclick: () => (move(p.photos, i, i + 1), markDirty(), renderProject()) }, "→"),
            h(
              "button",
              {
                type: "button",
                class: `icon${ph.src === coverSrc(p) ? " on" : ""}`,
                "aria-label": ph.src === coverSrc(p) ? "This is the cover" : "Make this the cover",
                title: ph.src === coverSrc(p) ? "The cover (its card in Thumbnails)" : "Make this the cover",
                "aria-pressed": String(ph.src === coverSrc(p)),
                onclick: () => {
                  p.cover = ph.src;
                  markDirty();
                  renderProject();
                },
              },
              "◉",
            ),
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
                  if (p.cover === ph.src) delete p.cover;
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
      h("p", { class: "hint" }, "Drag photographs to reorder, or drop files here to add them. ◉ makes a photograph the cover (its card in Thumbnails; the first one until you choose another). ☆ puts one in the opening slideshow."),
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

  // Into a project.
  const upload = (project, files) =>
    runUploads(files, project.id, (photo) => {
      project.photos.push(photo);
      if (state.projects[selected] === project) renderProject();
      renderProjectList();
    });

  // Straight into the opening slideshow (kept in their own folder).
  const uploadSlides = (files) =>
    runUploads(files, "landing", (photo) => {
      state.landing.push({ src: photo.src, r: photo.r });
      renderSlides();
    });

  const runUploads = async (files, folder, added) => {
    const images = files.filter((f) => /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name));
    if (!images.length) return toast("Those are not photographs.", true);
    uploading += images.length;
    renderStatus();
    let failed = 0;
    // Two at a time: quick, without running the browser out of memory.
    const queue = [...images];
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift();
        try {
          added(await processAndUpload(f, folder));
          markDirty();
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
    try {
      return await uploadImage(bitmap, folder);
    } finally {
      bitmap.close?.();
    }
  };

  // Any image (a decoded file, or a reframed canvas) in all three sizes.
  const uploadImage = async (source, folder) => {
    const r = source.width / source.height;
    const name = `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const files = [];
    for (const [dir, edge] of Object.entries(SIZES)) {
      const canvas = resize(source, edge);
      const jpeg = await encode(canvas, "image/jpeg", QUALITY.jpeg);
      files.push({ path: `${dir}/${folder}/${name}.jpg`, blob: jpeg });
      const webp = await encode(canvas, "image/webp", QUALITY.webp);
      // Safari cannot make WebP; the site then serves the JPEG in its place.
      if (webp.type === "image/webp") files.push({ path: `${dir}/${folder}/${name}.webp`, blob: webp });
    }
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
            h("button", { type: "button", class: "icon", "aria-label": "Adjust framing", title: "Adjust framing", onclick: () => openFrame(i) }, "⤢"),
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

  // Upload straight into the slideshow: the button, or files dropped on the tab.
  $("slide-files").addEventListener("change", (e) => {
    uploadSlides([...e.target.files]);
    e.target.value = "";
  });
  $("add-slides").addEventListener("click", () => $("slide-files").click());
  const slideTab = $("tab-slideshow");
  slideTab.addEventListener("dragover", (e) => e.dataTransfer.types.includes("Files") && (e.preventDefault(), slideTab.classList.add("drop")));
  slideTab.addEventListener("dragleave", () => slideTab.classList.remove("drop"));
  slideTab.addEventListener("drop", (e) => {
    slideTab.classList.remove("drop");
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    uploadSlides([...e.dataTransfer.files]);
  });

  // Reframe a slide --------------------------------------------------------------
  // Pick a shape, zoom, and drag the photograph to choose what stays in view.
  // Applying makes a new, cropped copy for the slideshow (the original photo,
  // and the project it comes from, are left as they are).

  const RATIOS = { original: 0, "3:2": 3 / 2, "4:3": 4 / 3, "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9 };
  const fr = { i: -1, img: null, w: 0, h: 0, ratio: "original", zoom: 1, x: 0, y: 0, box: { w: 0, h: 0 } };

  const openFrame = async (i) => {
    const s = state.landing[i];
    fr.i = i;
    $("frame-apply").disabled = true;
    $("frame-project").replaceChildren(
      h("option", { value: "" }, "No project"),
      ...state.projects.map((p) => h("option", { value: p.id, selected: p.id === s.project }, p.title)),
    );
    $("frame").showModal();
    try {
      const blob = await (await fetch(`/${s.src}`)).blob();
      fr.img?.close?.();
      fr.img = await createImageBitmap(blob);
    } catch {
      $("frame").close();
      return toast("Could not open that photograph.", true);
    }
    fr.w = fr.img.width;
    fr.h = fr.img.height;
    $("frame-img").src = `/${s.src}`;
    setRatio("original");
    $("frame-apply").disabled = false;
  };

  const setRatio = (name) => {
    fr.ratio = name;
    document.querySelectorAll("[data-ratio]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ratio === name)));
    const aspect = RATIOS[name] || fr.w / fr.h;
    // The frame: as large as fits the dialog, in the chosen shape.
    const maxW = Math.min(640, innerWidth - 80);
    const maxH = Math.max(200, Math.min(440, innerHeight - 400));
    let w = maxW;
    let hgt = w / aspect;
    if (hgt > maxH) {
      hgt = maxH;
      w = hgt * aspect;
    }
    fr.box = { w: Math.round(w), h: Math.round(hgt) };
    const stage = $("frame-stage");
    stage.style.width = `${fr.box.w}px`;
    stage.style.height = `${fr.box.h}px`;
    fr.zoom = 1;
    $("frame-zoom").value = "1";
    // Centred to start with.
    const sc = scale();
    fr.x = (fr.box.w - fr.w * sc) / 2;
    fr.y = (fr.box.h - fr.h * sc) / 2;
    paint();
  };

  // The photograph always covers the frame; zoom goes up to 3x.
  const scale = () => Math.max(fr.box.w / fr.w, fr.box.h / fr.h) * fr.zoom;
  const clamp = () => {
    const sc = scale();
    fr.x = Math.min(0, Math.max(fr.box.w - fr.w * sc, fr.x));
    fr.y = Math.min(0, Math.max(fr.box.h - fr.h * sc, fr.y));
  };
  const paint = () => {
    clamp();
    const img = $("frame-img");
    const sc = scale();
    img.style.width = `${fr.w * sc}px`;
    img.style.height = `${fr.h * sc}px`;
    img.style.transform = `translate(${fr.x}px, ${fr.y}px)`;
  };
  const zoomTo = (z, cx = fr.box.w / 2, cy = fr.box.h / 2) => {
    const before = scale();
    fr.zoom = Math.min(3, Math.max(1, z));
    const after = scale();
    // Keep the point under the cursor (or the centre) where it is.
    fr.x = cx - ((cx - fr.x) * after) / before;
    fr.y = cy - ((cy - fr.y) * after) / before;
    $("frame-zoom").value = String(fr.zoom);
    paint();
  };

  document.querySelectorAll("[data-ratio]").forEach((b) => b.addEventListener("click", () => setRatio(b.dataset.ratio)));
  $("frame-zoom").addEventListener("input", (e) => zoomTo(Number(e.target.value)));
  const stageEl = $("frame-stage");
  let dragFrom = null;
  stageEl.addEventListener("pointerdown", (e) => {
    dragFrom = { px: e.clientX, py: e.clientY, x: fr.x, y: fr.y };
    stageEl.setPointerCapture(e.pointerId);
  });
  stageEl.addEventListener("pointermove", (e) => {
    if (!dragFrom) return;
    fr.x = dragFrom.x + e.clientX - dragFrom.px;
    fr.y = dragFrom.y + e.clientY - dragFrom.py;
    paint();
  });
  stageEl.addEventListener("pointerup", () => (dragFrom = null));
  stageEl.addEventListener("pointercancel", () => (dragFrom = null));
  stageEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = stageEl.getBoundingClientRect();
      zoomTo(fr.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );
  // Keyboard: arrows move, + and - zoom.
  stageEl.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 40 : 10;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      fr.x += moves[e.key][0];
      fr.y += moves[e.key][1];
      paint();
    } else if (e.key === "+" || e.key === "=") zoomTo(fr.zoom * 1.1);
    else if (e.key === "-") zoomTo(fr.zoom / 1.1);
    else return;
    e.preventDefault();
  });

  $("frame-cancel").addEventListener("click", () => $("frame").close());
  $("frame-apply").addEventListener("click", async () => {
    const s = state.landing[fr.i];
    const project = $("frame-project").value || undefined;
    const untouched = fr.ratio === "original" && fr.zoom === 1;
    const btn = $("frame-apply");
    btn.disabled = true;
    try {
      let next = { src: s.src, r: s.r };
      if (!untouched) {
        // Cut out exactly what the frame shows, at the photograph's own resolution.
        const sc = scale();
        const sx = Math.round(-fr.x / sc);
        const sy = Math.round(-fr.y / sc);
        const sw = Math.min(fr.w - sx, Math.round(fr.box.w / sc));
        const sh = Math.min(fr.h - sy, Math.round(fr.box.h / sc));
        const canvas = canvasOf(sw, sh);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(fr.img, sx, sy, sw, sh, 0, 0, sw, sh);
        btn.textContent = "Saving…";
        next = await uploadImage(canvas, "landing");
      }
      state.landing[fr.i] = { ...next, ...(project ? { project } : {}) };
      markDirty();
      renderSlides();
      renderProject();
      $("frame").close();
      toast(untouched ? "Slide updated. Publish to show it." : "Slide reframed. Publish to show it.");
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Apply";
    }
  });

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
