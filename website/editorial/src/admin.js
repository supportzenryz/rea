// /admin/api/*: sign-in and the calls the admin page makes.
//
// Follows the OWASP Authentication, Session Management and Forgot Password
// cheat sheets:
// - Password: the first one is the Cloudflare secret ADMIN_PASSWORD. Once a
//   new one is chosen in /admin (or through a reset link) it is stored only as
//   a salted PBKDF2-SHA-256 hash, and the secret no longer signs in.
// - Sessions: a signed, expiring token in an HttpOnly, Secure, SameSite=Strict
//   cookie (__Host- prefixed on HTTPS). The signing key includes a random key
//   kept in KV; replacing it (on every password change, or "Sign out
//   everywhere") ends every session at once.
// - Brute force: wrong passwords are limited per visitor and for everyone
//   together; all comparisons are constant-time.
// - Forgot password: a single-use link, 256 bits of randomness, stored only as
//   a hash, valid 15 minutes, sent only to the owner's fixed address
//   (ENQUIRY_TO). The answer is the same whether or not an email went out.
//   Nothing changes until a new password is set with it; then every session
//   ends and the owner is told by email.
// - Every change must come from this site's own pages (Origin check), on top
//   of the SameSite cookie.

import { CONTENT_KEY, PREVIOUS_KEY, UPLOAD_PATH, cleanContent, loadContent, putImage, saveContent } from "./content.js";
import { escapeHtml, sendMail } from "./mail.js";

const SESSION_SECONDS = 12 * 3600;
const RESET_SECONDS = 15 * 60;
const LIMITS = {
  login: { perVisitor: 8, everyone: 50, windowSeconds: 15 * 60 },
  forgot: { perVisitor: 3, everyone: 10, windowSeconds: 3600 },
  reset: { perVisitor: 10, windowSeconds: 15 * 60 },
};
// PBKDF2-SHA-256. 100,000 is the most Cloudflare Workers allow.
const PBKDF2_ITERATIONS = 100_000;
const PASSWORD = { min: 12, max: 128 };
const MAX_IMAGE = 15 * 1024 * 1024;

const SECURITY = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function adminApi(request, env, url, ctx) {
  // Emails finish after the answer (same timing whether or not one is sent).
  const later = (p) => (ctx?.waitUntil ? ctx.waitUntil(p) : p);
  const route = url.pathname.replace(/^\/admin\/api\//, "");
  const method = request.method;
  if (!env.CONTENT) return json({ ok: false, error: "Storage is not connected yet (KV binding CONTENT)." }, 503);
  if (!env.ADMIN_PASSWORD) return json({ ok: false, setup: true, error: "Set the ADMIN_PASSWORD secret in Cloudflare first." }, 503);

  // Changes must come from this site's own admin page.
  if (method !== "GET" && request.headers.get("Origin") !== url.origin) return json({ ok: false, error: "Forbidden." }, 403);

  if (route === "login" && method === "POST") return login(request, env, url);
  if (route === "logout" && method === "POST") return json({ ok: true }, 200, { "Set-Cookie": clearCookie(url) });
  if (route === "forgot" && method === "POST") return forgot(request, env, url, later);
  if (route === "reset" && method === "POST") return reset(request, env, url, later);

  if (!(await signedIn(request, env, url))) return json({ ok: false, signedOut: true, error: "Please sign in." }, 401);

  if (route === "session" && method === "GET") return json({ ok: true });
  if (route === "password" && method === "POST") return changePassword(request, env, url, later);
  if (route === "signout-everywhere" && method === "POST") return signOutEverywhere(env, url);
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
  const ip = visitor(request);
  const L = LIMITS.login;
  if ((await count(env, `login:${ip}`)) >= L.perVisitor || (await count(env, "login:all")) >= L.everyone) {
    return json({ ok: false, error: "Too many attempts. Try again in 15 minutes, or use “Forgot password”." }, 429);
  }
  const { password } = await body(request);
  if (!(await checkPassword(env, password))) {
    await Promise.all([bump(env, `login:${ip}`, L.windowSeconds), bump(env, "login:all", L.windowSeconds)]);
    return json({ ok: false, error: "That password is not right." }, 401);
  }
  await env.CONTENT.delete(`login:${ip}`);
  return json({ ok: true }, 200, { "Set-Cookie": await sessionCookie(env, url) });
}

async function checkPassword(env, password) {
  if (typeof password !== "string" || !password || password.length > PASSWORD.max) return false;
  const stored = await env.CONTENT.get("auth:password");
  if (!stored) return same(password, env.ADMIN_PASSWORD);
  const { salt, hash, iterations } = JSON.parse(stored);
  return same(await pbkdf2(password, fromB64(salt), iterations), hash);
}

async function setPassword(env, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  await env.CONTENT.put("auth:password", JSON.stringify({ salt: b64(salt), hash, iterations: PBKDF2_ITERATIONS, setAt: new Date().toISOString() }));
  await rotateSessionKey(env);
}

// Rules from NIST SP 800-63B: long enough, not too long, not a known
// breached password (Have I Been Pwned, k-anonymity: only the first five
// characters of the SHA-1 leave the server).
async function passwordProblem(password) {
  if (typeof password !== "string" || password.length < PASSWORD.min) return `Use at least ${PASSWORD.min} characters.`;
  if (password.length > PASSWORD.max) return `Use at most ${PASSWORD.max} characters.`;
  if (/sundar|rajan|photosbysundar|password|admin/i.test(password) && password.length < 20) {
    return "Avoid the site's name or common words, or make it longer.";
  }
  try {
    const sha1 = hex(await crypto.subtle.digest("SHA-1", enc.encode(password))).toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
    if (res.ok) {
      const found = (await res.text()).split("\n").some((line) => {
        const [suffix, times] = line.trim().split(":");
        return suffix === sha1.slice(5) && Number(times) > 0;
      });
      if (found) return "That password has appeared in a data breach. Choose another.";
    }
  } catch {} // the check is a bonus; never block a change because it is down
  return null;
}

async function changePassword(request, env, url, later) {
  const { current, next } = await body(request);
  if (!(await checkPassword(env, current))) return json({ ok: false, error: "The current password is not right." }, 401);
  const problem = await passwordProblem(next);
  if (problem) return json({ ok: false, error: problem }, 400);
  await setPassword(env, next);
  await later(notifyPasswordChanged(env, url));
  return json({ ok: true }, 200, { "Set-Cookie": await sessionCookie(env, url) });
}

async function signOutEverywhere(env, url) {
  await rotateSessionKey(env);
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie(url) });
}

// Forgot password ------------------------------------------------------------

async function forgot(request, env, url, later) {
  const ip = visitor(request);
  const L = LIMITS.forgot;
  const done = json({ ok: true, message: "If email is set up, a sign-in link is on its way to the site owner's inbox. It works for 15 minutes." });
  if ((await count(env, `forgot:${ip}`)) >= L.perVisitor || (await count(env, "forgot:all")) >= L.everyone) return done;
  await Promise.all([bump(env, `forgot:${ip}`, L.windowSeconds), bump(env, "forgot:all", L.windowSeconds)]);

  const token = b64(crypto.getRandomValues(new Uint8Array(32)));
  await env.CONTENT.put(`reset:${await sha256(token)}`, "1", { expirationTtl: RESET_SECONDS });
  const site = env.SITE_URL || url.origin;
  // The token is in the #fragment, so it never reaches a server log.
  const link = `${site}/admin/#reset=${token}`;
  await later(sendMail(env, {
    subject: "Reset your website password",
    text:
      `Someone asked to reset the password for your website's admin.\n\n` +
      `To choose a new password, open this link within 15 minutes:\n${link}\n\n` +
      `If it wasn't you, ignore this email. Your password stays the same.`,
    html:
      `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1a1a1a">` +
      `<p>Someone asked to reset the password for your website's admin.</p>` +
      `<p><a href="${escapeHtml(link)}" style="color:#1a1a1a">Choose a new password</a> (works for 15 minutes).</p>` +
      `<p style="color:#888">If it wasn't you, ignore this email. Your password stays the same.</p></div>`,
  }));
  return done;
}

async function reset(request, env, url, later) {
  const ip = visitor(request);
  if ((await count(env, `reset:try:${ip}`)) >= LIMITS.reset.perVisitor) {
    return json({ ok: false, error: "Too many attempts. Try again in 15 minutes." }, 429);
  }
  const { token, password } = await body(request);
  const key = typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token) ? `reset:${await sha256(token)}` : null;
  if (!key || !(await env.CONTENT.get(key))) {
    await bump(env, `reset:try:${ip}`, LIMITS.reset.windowSeconds);
    return json({ ok: false, expired: true, error: "This link has expired or was already used. Ask for a new one." }, 400);
  }
  const problem = await passwordProblem(password);
  if (problem) return json({ ok: false, error: problem }, 400);
  await env.CONTENT.delete(key); // single use
  await setPassword(env, password);
  await later(notifyPasswordChanged(env, url));
  return json({ ok: true }, 200, { "Set-Cookie": await sessionCookie(env, url) });
}

async function notifyPasswordChanged(env, url) {
  const site = env.SITE_URL || url.origin;
  await sendMail(env, {
    subject: "Your website password was changed",
    text:
      `The password for your website's admin was just changed, and every device was signed out.\n\n` +
      `If this wasn't you, reset it now: ${site}/admin/ → Forgot password.`,
    html:
      `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1a1a1a">` +
      `<p>The password for your website's admin was just changed, and every device was signed out.</p>` +
      `<p style="color:#888">If this wasn't you, reset it now: <a href="${escapeHtml(site)}/admin/" style="color:#1a1a1a">open the admin</a> → Forgot password.</p></div>`,
  });
}

// Sessions -------------------------------------------------------------------

const cookieName = (url) => (url.protocol === "https:" ? "__Host-sr_admin" : "sr_admin");

async function sessionCookie(env, url) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const token = `${exp}.${await sign(env, `admin:${exp}`)}`;
  return `${cookieName(url)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${url.protocol === "https:" ? "; Secure" : ""}`;
}

function clearCookie(url) {
  return `${cookieName(url)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${url.protocol === "https:" ? "; Secure" : ""}`;
}

async function signedIn(request, env, url) {
  const name = cookieName(url).replace(/[-_]/g, "\\$&");
  // A browser can hold more than one (e.g. an older one with another path):
  // any valid one counts.
  const all = (request.headers.get("Cookie") || "").matchAll(new RegExp(`(?:^|;\\s*)${name}=(\\d+)\\.([A-Za-z0-9_-]+)`, "g"));
  for (const m of [...all].slice(0, 4)) {
    if (Number(m[1]) >= Date.now() / 1000 && (await same(m[2], await sign(env, `admin:${m[1]}`)))) return true;
  }
  return false;
}

async function sessionKey(env) {
  let key = await env.CONTENT.get("auth:key");
  if (!key) {
    key = b64(crypto.getRandomValues(new Uint8Array(32)));
    await env.CONTENT.put("auth:key", key);
  }
  return key;
}

async function rotateSessionKey(env) {
  await env.CONTENT.put("auth:key", b64(crypto.getRandomValues(new Uint8Array(32))));
}

async function sign(env, message) {
  const secret = await crypto.subtle.digest("SHA-256", enc.encode(`sr-admin-session|${env.ADMIN_PASSWORD}|${await sessionKey(env)}`));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

// Helpers ----------------------------------------------------------------------

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const visitor = (request) => request.headers.get("CF-Connecting-IP") || "unknown";

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
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

const count = async (env, key) => Number(await env.CONTENT.get(key)) || 0;
const bump = async (env, key, ttl) => env.CONTENT.put(key, String((await count(env, key)) + 1), { expirationTtl: ttl });

async function body(request) {
  try {
    const raw = await request.text();
    if (raw.length > 4096) return {};
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
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
  // Must really be a JPEG or WebP (checked by its first bytes, not just the label).
  const h = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength));
  const isJpeg = h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  const isWebp = String.fromCharCode(...h.slice(0, 4)) === "RIFF" && String.fromCharCode(...h.slice(8, 12)) === "WEBP";
  if (type === "image/jpeg" ? !isJpeg : !isWebp) return json({ ok: false, error: "That file is not a real photograph." }, 415);
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
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SECURITY, ...extra },
  });
}
