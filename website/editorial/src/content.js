// Site content edited in /admin: the slideshow, the projects and their
// photographs, the bio and the contact details. Kept in KV (env.CONTENT)
// under CONTENT_KEY; until the first save the site uses the static data.js.
//
// Photographs uploaded in /admin are stored in KV too, one key per file
// ("img:photos/<project>/u-<id>.jpg" and its medium/, thumbs/ and .webp
// copies), and served at the same addresses as the photographs in the repo.

export const CONTENT_KEY = "content";
export const PREVIOUS_KEY = "content:previous";
const IMG_PREFIX = "img:";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const SRC = /^photos\/[a-z0-9-]{1,60}\/[A-Za-z0-9._-]{1,80}\.jpg$/;
// Uploaded files: unique names, so they can be cached for good.
export const UPLOAD_PATH = /^(photos|medium|thumbs)\/[a-z0-9-]{1,60}\/u-[a-z0-9]{6,40}\.(jpg|webp)$/;
const MAX_PROJECTS = 60;
const MAX_PHOTOS = 120;
const MAX_LANDING = 60;

const kv = (env) => env.CONTENT || null;

export async function loadContent(env) {
  const store = kv(env);
  if (!store) return null;
  const raw = await store.get(CONTENT_KEY, { cacheTtl: 30 });
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Checks content sent from /admin and returns a clean copy (unknown fields
// dropped), or { error } saying what is wrong in words the admin can show.
export function cleanContent(input) {
  if (!input || typeof input !== "object") return { error: "Nothing to save." };
  const text = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "");
  const ratio = (v) => (typeof v === "number" && v > 0.15 && v < 7 ? Math.round(v * 1000) / 1000 : null);

  if (!Array.isArray(input.projects) || !input.projects.length) return { error: "Add at least one project." };
  if (input.projects.length > MAX_PROJECTS) return { error: `At most ${MAX_PROJECTS} projects.` };
  const ids = new Set();
  const projects = [];
  for (const p of input.projects) {
    const id = text(p?.id, 60);
    const title = text(p?.title, 80);
    if (!SLUG.test(id)) return { error: `A project has an invalid address name ("${id}").` };
    if (ids.has(id)) return { error: `Two projects share the address name "${id}".` };
    if (!title) return { error: "Every project needs a title." };
    if (!Array.isArray(p.photos) || !p.photos.length) return { error: `"${title}" has no photographs.` };
    if (p.photos.length > MAX_PHOTOS) return { error: `"${title}" has more than ${MAX_PHOTOS} photographs.` };
    const photos = [];
    for (const ph of p.photos) {
      const r = ratio(ph?.r);
      if (!SRC.test(ph?.src || "") || !r) return { error: `"${title}" has a photograph that did not upload properly.` };
      photos.push({ src: ph.src, r });
    }
    ids.add(id);
    // The cover (its card in Thumbnails): one of its own photographs, else the first.
    const cover = typeof p.cover === "string" && photos.some((ph) => ph.src === p.cover) ? p.cover : null;
    projects.push({ id, title, photos, ...(cover && cover !== photos[0].src ? { cover } : {}) });
  }

  // Slideshow: a photograph from a project picks up its project and position
  // from where it now sits; a stand-alone slide (uploaded or reframed) keeps
  // the project it is linked to, if that project exists.
  const where = new Map();
  projects.forEach((p) => p.photos.forEach((ph, i) => where.set(ph.src, { project: p.id, n: i + 1 })));
  if (!Array.isArray(input.landing) || !input.landing.length) return { error: "Choose at least one slideshow photograph." };
  if (input.landing.length > MAX_LANDING) return { error: `At most ${MAX_LANDING} slideshow photographs.` };
  const landing = [];
  for (const s of input.landing) {
    const r = ratio(s?.r);
    if (!SRC.test(s?.src || "") || !r) return { error: "A slideshow photograph is not valid." };
    const at = where.get(s.src);
    const own = projects.find((p) => p.id === s.project);
    const validN = own && Number.isInteger(s.n) && s.n >= 1 && s.n <= own.photos.length;
    const link = at || (own ? { project: own.id, ...(validN ? { n: s.n } : {}) } : {});
    landing.push({ src: s.src, r, ...link });
  }

  const bio = (Array.isArray(input.bio) ? input.bio : []).map((t) => text(t, 2000)).filter(Boolean).slice(0, 8);
  if (!bio.length) return { error: "The bio is empty." };
  const c = input.contact || {};
  const email = text(c.email, 200);
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) return { error: "The contact email is not valid." };
  const instagram = text(c.instagram, 60).replace(/^@/, "");
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) return { error: "The Instagram name is not valid." };
  const based = text(c.based, 80);

  return { content: { projects, landing, bio, contact: { email, instagram, based } } };
}

// The site's data.js, built from saved content.
export function dataScript(c) {
  const js = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
  const contact = {
    email: c.contact.email,
    instagram: c.contact.instagram
      ? { label: `@${c.contact.instagram}`, href: `https://www.instagram.com/${c.contact.instagram}/` }
      : null,
    based: c.contact.based,
  };
  return (
    `// Generated from the content saved in /admin.\n` +
    `window.LANDING = ${js(c.landing)};\n` +
    `window.PROJECTS = ${js(c.projects)};\n` +
    `window.SITE = ${js({ bio: c.bio, contact })};\n`
  );
}

// Every uploaded file a piece of content uses (all sizes and formats).
export function uploadedFiles(c) {
  const files = new Set();
  const add = (src) => {
    if (!UPLOAD_PATH.test(src)) return;
    for (const dir of ["photos", "medium", "thumbs"]) {
      const base = src.replace(/^photos\//, `${dir}/`);
      files.add(base);
      files.add(base.replace(/\.jpg$/, ".webp"));
    }
  };
  c?.projects?.forEach((p) => p.photos.forEach((ph) => add(ph.src)));
  c?.landing?.forEach((s) => add(s.src));
  return files;
}

export async function saveContent(env, content) {
  const store = kv(env);
  const before = await loadContent(env);
  if (before) await store.put(PREVIOUS_KEY, JSON.stringify(before));
  await store.put(CONTENT_KEY, JSON.stringify(content));
  // Uploaded photographs no longer used by the new content (nor kept for
  // undo in the previous one) are deleted.
  const keep = new Set([...uploadedFiles(content), ...uploadedFiles(before)]);
  const older = await store.get(PREVIOUS_KEY + ":older");
  const stale = [...uploadedFiles(older ? JSON.parse(older) : null)].filter((f) => !keep.has(f));
  await Promise.all(stale.map((f) => store.delete(IMG_PREFIX + f)));
  if (before) await store.put(PREVIOUS_KEY + ":older", JSON.stringify(before));
}

// Uploaded photographs ------------------------------------------------------

export async function putImage(env, path, type, bytes) {
  await kv(env).put(IMG_PREFIX + path, bytes, { metadata: { type } });
}

// Serves an uploaded photograph, or null if there is none at that address.
// A missing .webp falls back to the .jpg (browsers that cannot encode WebP
// upload JPEG only), which every browser shows.
export async function getImage(env, path) {
  const store = kv(env);
  if (!store || !UPLOAD_PATH.test(path)) return null;
  let hit = await store.getWithMetadata(IMG_PREFIX + path, { type: "arrayBuffer", cacheTtl: 86400 });
  if (!hit.value && path.endsWith(".webp")) {
    hit = await store.getWithMetadata(IMG_PREFIX + path.replace(/\.webp$/, ".jpg"), { type: "arrayBuffer", cacheTtl: 86400 });
  }
  if (!hit.value) return null;
  return new Response(hit.value, {
    headers: {
      "Content-Type": hit.metadata?.type || "image/jpeg",
      // Unique names: safe to keep for a year.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
