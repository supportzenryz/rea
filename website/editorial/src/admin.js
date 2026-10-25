// /admin/api/*: sign-in and the calls the admin page makes.
//
// Sign-in uses one password, set in Cloudflare as the secret ADMIN_PASSWORD
// (never in this repository). A signed-in browser holds a cookie that is
// signed with a key made from that password, so changing the password signs
// everyone out. Sign-in attempts are limited per visitor.

import { CONTENT_KEY, PREVIOUS_KEY, UPLOAD_PATH, cleanContent, loadContent, putImage, saveContent } from "./content.js";

const COOKIE = "sr_admin";
const SESSION_SECONDS = 12 * 3600;
const LOGIN_LIMIT = { max: 8, windowSeconds: 15 * 60 };
const MAX_IMAGE = 15 * 1024 * 1024;

export async function adminApi(request, env, url) {
  const route = url.pathname.replace(/^\/admin\/api\//, "");
  const method = request.method;
  if (!env.CONTENT) return json({ ok: false, error: "Storage is not connected yet (KV binding CONTENT)." }, 503);
  if (!env.ADMIN_PASSWORD) return json({ ok: false, setup: true, error: "Set the ADMIN_PASSWORD secret in Cloudflare first." }, 503);

  // Changes must come from this site's own admin page.
  if (method !== "GET" && request.headers.get("Origin") !== url.origin) return json({ ok: false, error: "Forbidden." }, 403);

  if (route === "login" && method === "POST") return login(request, env, url);
  if (route === "logout" && method === "POST") return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0, url) });

  if (!(await signedIn(request, env))) return json({ ok: false, signedOut: true, error: "Please sign in." }, 401);

  if (route === "session" && method === "GET") return json({ ok: true });
  if (route === "content" && method === "GET") return json({ ok: true, content: await loadContent(env) });
  if (route === "content" && method === "PUT") return putContent(request, env);
  if (route === "restore" && method === "POST") return restore(env);
  if (route === "image" && method === "PUT") return putUpload(request, env, url);
  if (route === "enquiries" && method === "GET") return listEnquiries(env);
  if (route === "enquiries" && method === "DELETE") return deleteEnquiry(env, url);
  return json({ ok: false, error: "Not found." }, 404);
}

// Sign-in ----------------------------------------------------------------

async function login(request, env, url) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `login:${ip}`;
  const tries = Number(await env.CONTENT.get(key)) || 0;
  if (tries >= LOGIN_LIMIT.max) return json({ ok: false, error: "Too many attempts. Try again in 15 minutes." }, 429);

  let password = "";
  try {
    password = String((await request.json()).password || "");
  } catch {}
  if (!(await same(password, env.ADMIN_PASSWORD))) {
    await env.CONTENT.put(key, String(tries + 1), { expirationTtl: LOGIN_LIMIT.windowSeconds });
    return json({ ok: false, error: "That password is not right." }, 401);
  }
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const token = `${exp}.${await sign(env, `admin:${exp}`)}`;
  return json({ ok: true }, 200, { "Set-Cookie": cookie(token, SESSION_SECONDS, url) });
}

async function signedIn(request, env) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([A-Za-z0-9_-]+)`));
  if (!m || Number(m[1]) < Date.now() / 1000) return false;
  return same(m[2], await sign(env, `admin:${m[1]}`));
}

function cookie(value, maxAge, url) {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sign(env, message) {
  const secret = await crypto.subtle.digest("SHA-256", enc.encode(`sr-admin-session|${env.ADMIN_PASSWORD}`));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

// Compares two strings in constant time (by their hashes).
async function same(a, b) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(String(s)))));
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

// Content ----------------------------------------------------------------

async function putContent(request, env) {
  const raw = await request.text();
  if (raw.length > 600_000) return json({ ok: false, error: "That is too much to save at once." }, 413);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Could not read the changes." }, 400);
  }
  const { content, error } = cleanContent(input);
  if (error) return json({ ok: false, error }, 400);
  await saveContent(env, content);
  return json({ ok: true, content });
}

async function restore(env) {
  const previous = await env.CONTENT.get(PREVIOUS_KEY);
  if (!previous) return json({ ok: false, error: "There is no earlier version to go back to." }, 404);
  const current = await env.CONTENT.get(CONTENT_KEY);
  await env.CONTENT.put(CONTENT_KEY, previous);
  if (current) await env.CONTENT.put(PREVIOUS_KEY, current);
  return json({ ok: true, content: JSON.parse(previous) });
}

async function putUpload(request, env, url) {
  const path = url.searchParams.get("path") || "";
  const type = (request.headers.get("Content-Type") || "").split(";")[0];
  if (!UPLOAD_PATH.test(path)) return json({ ok: false, error: "Not a valid photograph address." }, 400);
  if (type !== (path.endsWith(".webp") ? "image/webp" : "image/jpeg")) {
    return json({ ok: false, error: "Only JPEG and WebP files." }, 415);
  }
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE) return json({ ok: false, error: "That file is empty or too large." }, 413);
  await putImage(env, path, type, bytes);
  return json({ ok: true });
}

// Enquiries kept by the contact form -------------------------------------

async function listEnquiries(env) {
  const { keys } = await env.CONTENT.list({ prefix: "enquiry:", limit: 200 });
  const newest = keys.map((k) => k.name).sort().reverse().slice(0, 100);
  const items = await Promise.all(
    newest.map(async (key) => {
      try {
        return { key, ...JSON.parse(await env.CONTENT.get(key)) };
      } catch {
        return null;
      }
    }),
  );
  return json({ ok: true, enquiries: items.filter(Boolean) });
}

async function deleteEnquiry(env, url) {
  const key = url.searchParams.get("key") || "";
  if (!/^enquiry:[\w:.-]+$/.test(key)) return json({ ok: false, error: "Not found." }, 404);
  await env.CONTENT.delete(key);
  return json({ ok: true });
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}
