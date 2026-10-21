// Cloudflare Worker for the Sundar Rajan site.
//
// - Serves the static site from ./public (env.ASSETS).
// - Adds absolute URLs (canonical, og:url, og:image, structured data) for
//   whichever domain the site is served from, and serves robots.txt and
//   sitemap.xml for it.
// - POST /api/enquiry: checks an enquiry, quietly drops bots, then emails it
//   (Resend, if RESEND_API_KEY is set) and/or stores it (KV, if ENQUIRIES is
//   bound). With neither set up it answers 503, and the page falls back to
//   opening the visitor's email app, so no enquiry is lost.

const MAX_BODY = 12_000;
const TYPES = ["Commission", "Editorial", "Collaboration", "Other"];
const RATE_LIMIT = { max: 5, windowSeconds: 3600 };

const BIO =
  "Sundar Rajan is a fashion photographer working between India and Europe. His work explores the relationship between fashion and the human experience, using clothing as a means of expressing identity, emotion and the complexities of being human.";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    switch (url.pathname) {
      case "/api/enquiry":
        return enquiry(request, env, url);
      case "/robots.txt":
        return plain(`User-agent: *\nAllow: /\n\nSitemap: ${url.origin}/sitemap.xml\n`, "text/plain");
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
  const html = (await asset.text()).replace("<!--seo-->", seoTags(url.origin));
  const headers = new Headers(asset.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  // Always revalidate the page, so a new deploy shows at once.
  headers.set("Cache-Control", "no-cache");
  headers.delete("Content-Length");
  headers.delete("ETag");
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(request.method === "HEAD" ? null : html, { status: 200, headers });
}

function seoTags(origin) {
  const home = `${origin}/`;
  const image = `${origin}/photos/landing/01.jpg`;
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Sundar Rajan",
      jobTitle: "Fashion Photographer",
      description: BIO,
      url: home,
      image,
      email: "mailto:sundarrajanparamasivan@accademiaitaliana.it",
      sameAs: ["https://www.instagram.com/photosbysundar/"],
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

async function enquiry(request, env, url) {
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

  // Rate limit per visitor (needs KV).
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (env.ENQUIRIES) {
    const key = `rate:${ip}`;
    const count = Number(await env.ENQUIRIES.get(key)) || 0;
    if (count >= RATE_LIMIT.max) {
      return json({ ok: false, error: "Too many messages for now. Please try again later." }, 429);
    }
    await env.ENQUIRIES.put(key, String(count + 1), { expirationTtl: RATE_LIMIT.windowSeconds });
  }

  const record = { ...d, receivedAt: new Date().toISOString(), country: request.cf?.country || null };
  let delivered = false;

  if (env.ENQUIRIES) {
    await env.ENQUIRIES.put(`enquiry:${record.receivedAt}:${crypto.randomUUID()}`, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    delivered = true;
  }

  if (env.RESEND_API_KEY && env.ENQUIRY_TO) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.ENQUIRY_FROM || "Website <onboarding@resend.dev>",
          to: [env.ENQUIRY_TO],
          reply_to: d.email,
          subject: `${d.type} enquiry — ${d.name}`,
          text: `${d.message}\n\n${d.name}\n${d.email}\n\nSent from the website, ${record.receivedAt}`,
          html: emailHtml(record),
        }),
      });
      if (res.ok) delivered = true;
      else console.error("Resend refused the enquiry", res.status, await res.text());
    } catch (err) {
      console.error("Could not reach Resend", err);
    }
  }

  if (!delivered) return json({ ok: false, fallback: "mailto" }, 503);
  return json({ ok: true });
}

function emailHtml(r) {
  const e = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
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
