// Cloudflare Worker for the Sundar Rajan site.
//
// - Serves the static site from ./public (env.ASSETS).
// - Adds absolute URLs (canonical, og:url, og:image, structured data) for
//   whichever domain the site is served from, and serves robots.txt and
//   sitemap.xml for it.
// - POST /api/enquiry: checks an enquiry, quietly drops bots, then emails it
//   (Cloudflare Email, or Resend if RESEND_API_KEY is set) and stores it (KV,
//   CONTENT). With nothing set up it answers 503, and the page falls back to
//   opening the visitor's email app, so no enquiry is lost.
// - /admin: the content editor (see admin.js and content.js). Saved content
//   replaces the static data.js; uploaded photographs are served from KV.

import { adminApi } from "./admin.js";
import { dataScript, getImage, loadContent } from "./content.js";
import { escapeHtml, sendMail } from "./mail.js";

const MAX_BODY = 12_000;
const TYPES = ["Commission", "Editorial", "Collaboration", "Other"];
const RATE_LIMIT = { max: 5, windowSeconds: 3600, perDay: 200 };

const BIO =
  "Sundar Rajan is a fashion photographer working between India and Europe. His work explores the relationship between fashion and the human experience, using clothing as a means of expressing identity, emotion and the complexities of being human.";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // One address for search engines: www.photosbysundar.com -> photosbysundar.com.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    const p = url.pathname;
    if (p.startsWith("/admin/api/")) return adminApi(request, env, url, ctx);
    if (p === "/admin") return Response.redirect(`${url.origin}/admin/`, 301);
    if (p.startsWith("/admin/")) return adminAsset(request, env);
    if (/^\/(photos|medium|thumbs)\/[^/]+\/u-/.test(p)) {
      return (await getImage(env, p.slice(1))) || env.ASSETS.fetch(request);
    }
    switch (p) {
      case "/api/enquiry":
        return enquiry(request, env, url, ctx);
      case "/data.js":
        return data(request, env);
      case "/robots.txt":
        return plain(`User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${url.origin}/sitemap.xml\n`, "text/plain");
      case "/sitemap.xml":
        return plain(sitemap(url.origin), "application/xml");
      case "/":
      case "/index.html":
        return page(request, env, url);
      default:
        return env.ASSETS.fetch(request);
    }
  },
};

// The site's content: what was saved in /admin, else the static data.js.
async function data(request, env) {
  const content = await loadContent(env);
  if (!content) return env.ASSETS.fetch(request);
  return new Response(dataScript(content), {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

// The admin page's own files: never indexed, never framed, always fresh.
async function adminAsset(request, env) {
  const asset = await env.ASSETS.fetch(request);
  const headers = new Headers(asset.headers);
  headers.set("Cache-Control", "no-cache");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' blob: data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'",
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return new Response(asset.body, { status: asset.status, headers });
}

// Page ------------------------------------------------------------------

const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "script-src 'self'",
    "connect-src 'self'",
    "form-action 'self' mailto:",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
};

async function page(request, env, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const asset = await env.ASSETS.fetch(new Request(new URL("/", url), request));
  if (!asset.ok) return asset;
  const content = await loadContent(env);
  let html = (await asset.text()).replace("<!--seo-->", seoTags(url.origin, content));
  // The first slide is preloaded; follow the slideshow saved in /admin.
  const first = content?.landing?.[0]?.src;
  if (first) {
    const webp = `/${first.replace(/\.jpg$/, ".webp")}`;
    html = html
      .replace('href="/medium/landing/01.webp"', `href="${webp.replace(/^\/photos\//, "/medium/")}"`)
      .replace('href="/photos/landing/01.webp"', `href="${webp}"`);
  }
  const headers = new Headers(asset.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  // Always revalidate the page, so a new deploy shows at once.
  headers.set("Cache-Control", "no-cache");
  headers.delete("Content-Length");
  headers.delete("ETag");
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(request.method === "HEAD" ? null : html, { status: 200, headers });
}

function seoTags(origin, content) {
  const home = `${origin}/`;
  const image = `${origin}/${content?.landing?.[0]?.src || "photos/landing/01.jpg"}`;
  const email = content?.contact?.email || "work.photosbysundar@gmail.com";
  const instagram = content ? content.contact.instagram : "photosbysundar";
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Sundar Rajan",
      jobTitle: "Fashion Photographer",
      description: content?.bio?.[0] || BIO,
      url: home,
      image,
      email: `mailto:${email}`,
      sameAs: instagram ? [`https://www.instagram.com/${instagram}/`] : [],
      workLocation: [
        { "@type": "Place", name: "India" },
        { "@type": "Place", name: "Europe" },
      ],
      knowsAbout: ["Fashion photography", "Editorial photography", "Portrait photography"],
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: "Sundar Rajan", url: home },
  ];
  // "<" is escaped so the JSON can never close the script element early.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return [
    `<link rel="canonical" href="${home}" />`,
    `<meta property="og:url" content="${home}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${json}</script>`,
  ].join("\n    ");
}

function sitemap(origin) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    `  <url>\n    <loc>${origin}/</loc>\n    <lastmod>${today}</lastmod>\n` +
    `    <image:image><image:loc>${origin}/photos/landing/01.jpg</image:loc></image:image>\n  </url>\n` +
    `</urlset>\n`
  );
}

// Enquiries -------------------------------------------------------------

async function enquiry(request, env, url, ctx) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405, { Allow: "POST" });
  }
  // Only this site's own page may post here.
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return json({ ok: false, error: "Forbidden." }, 403);
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) {
    return json({ ok: false, error: "Unsupported content type." }, 415);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false, error: "That message is too long." }, 413);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Something went wrong. Please try again." }, 400);
  }
  if (!input || typeof input !== "object") return json({ ok: false, error: "Something went wrong." }, 400);

  // Bots: the hidden "website" field is filled, or the form was sent in under
  // 2.5 s. Answer as if it worked, so they learn nothing; keep nothing.
  if (str(input.website) || Number(input.elapsed) < 2500) return json({ ok: true });

  const clean = (v, max) => str(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
  const d = {
    name: clean(input.name, 120),
    email: clean(input.email, 200),
    type: TYPES.includes(input.type) ? input.type : "Other",
    message: clean(input.message, 4000),
  };
  const missing = [];
  if (!d.name) missing.push("your name");
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(d.email)) missing.push("a valid email");
  if (d.message.length < 10) missing.push("a short message");
  if (missing.length) return json({ ok: false, error: `Please add ${missing.join(", ")}.` }, 400);

  // Rate limits: per visitor, and for everyone together per day (so a flood
  // cannot fill the storage). A copy of every enquiry is kept (shown in /admin).
  const store = env.ENQUIRIES || env.CONTENT;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (store) {
    const day = new Date().toISOString().slice(0, 10);
    const [mine, all] = await Promise.all([store.get(`rate:${ip}`), store.get(`rate:all:${day}`)]);
    if ((Number(mine) || 0) >= RATE_LIMIT.max || (Number(all) || 0) >= RATE_LIMIT.perDay) {
      return json({ ok: false, error: "Too many messages for now. Please try again later." }, 429);
    }
    await Promise.all([
      store.put(`rate:${ip}`, String((Number(mine) || 0) + 1), { expirationTtl: RATE_LIMIT.windowSeconds }),
      store.put(`rate:all:${day}`, String((Number(all) || 0) + 1), { expirationTtl: 2 * 86400 }),
    ]);
  }

  const record = { ...d, receivedAt: new Date().toISOString(), country: request.cf?.country || null };
  let delivered = false;

  if (store) {
    await store.put(`enquiry:${record.receivedAt}:${crypto.randomUUID()}`, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    delivered = true;
  }

  const mail = sendMail(env, {
    subject: `${d.type} enquiry — ${d.name}`,
    text: `${d.message}\n\n${d.name}\n${d.email}\n\nSent from the website, ${record.receivedAt}`,
    html: emailHtml(record),
    replyTo: d.email,
  });
  // Already kept: answer the visitor at once and finish the email afterwards.
  if (delivered && ctx?.waitUntil) {
    ctx.waitUntil(mail);
    return json({ ok: true });
  }
  if (await mail) delivered = true;

  if (!delivered) return json({ ok: false, fallback: "mailto" }, 503);
  return json({ ok: true });
}

function emailHtml(r) {
  const e = escapeHtml;
  return (
    `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1a1a1a">` +
    `<p style="color:#888;margin:0 0 16px">${e(r.type)} enquiry from the website</p>` +
    `<p style="white-space:pre-wrap;margin:0 0 24px">${e(r.message)}</p>` +
    `<p style="margin:0">${e(r.name)}<br><a href="mailto:${e(r.email)}">${e(r.email)}</a></p>` +
    `<p style="color:#888;font-size:13px;margin:24px 0 0">${e(r.receivedAt)}</p></div>`
  );
}

// Helpers ---------------------------------------------------------------

const str = (v) => (typeof v === "string" ? v : "");

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

function plain(body, type) {
  return new Response(body, { headers: { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "public, max-age=3600" } });
}
