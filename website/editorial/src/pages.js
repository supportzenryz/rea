// Every page address the site has, with what search engines and link
// previews should see for it: title, description, canonical address, image,
// structured data. The same index.html serves them all; app.js shows the page.
//
//   /                      home (slideshow)
//   /work/<project>[/<n>]  a project (canonical: /work/<project>)
//   /info, /contact        the panel open on that tab
//   /index, /thumbnails…   views of the same work: not indexed, links followed

import { loadContent } from "./content.js";

const NAME = "Sundar Rajan";
const ROLE = "Fashion Photographer";
const HOME_TITLE = `${NAME} — ${ROLE}, India & Europe`;
const HOME_DESCRIPTION =
  "Sundar Rajan is a fashion photographer working between India and Europe, using clothing to express identity, emotion and the complexities of being human.";

// What the site shows: content published in /admin, else the static data.js.
export async function siteContent(env, url) {
  const saved = await loadContent(env);
  if (saved) return saved;
  try {
    const js = await (await env.ASSETS.fetch(new Request(new URL("/data.js", url)))).text();
    const read = (k) => JSON.parse(js.match(new RegExp(`window\\.${k} = ([\\s\\S]*?);\\n`))[1]);
    const site = read("SITE");
    return {
      projects: read("PROJECTS"),
      landing: read("LANDING"),
      bio: site.bio,
      contact: { email: site.contact.email, instagram: site.contact.instagram?.label?.replace(/^@/, "") || "", based: site.contact.based },
    };
  } catch {
    return null;
  }
}

const coverOf = (p) => p.photos.find((ph) => ph.src === p.cover) || p.photos[0];

// The page for an address, or null when there is no such page.
export function pageFor(pathname, content) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const projects = content?.projects || [];
  if (path === "/" || path === "/index.html") return { kind: "home", canonical: "/", index: true };
  if (path === "/info") return { kind: "info", canonical: "/info", index: true, title: `Info — ${NAME}, ${ROLE}` };
  if (path === "/contact") return { kind: "contact", canonical: "/contact", index: true, title: `Contact — ${NAME}, ${ROLE}` };
  if (path === "/index" || path === "/thumbnails") return { kind: "view", canonical: path, index: false };
  const m = path.match(/^\/(work|thumbnails)\/([a-z0-9-]+)(?:\/(\d{1,3}))?$/);
  if (!m) return null;
  const p = projects.find((x) => x.id === m[2]);
  if (!p) return null;
  if (m[1] === "thumbnails") return m[3] ? null : { kind: "view", canonical: `/thumbnails/${p.id}`, index: false, title: `${p.title} — Thumbnails — ${NAME}` };
  const n = m[3] ? Number(m[3]) : 1;
  if (n < 1 || n > p.photos.length) return null;
  return {
    kind: "project",
    project: p,
    canonical: `/work/${p.id}`,
    index: true,
    title: `${p.title} — ${NAME}, ${ROLE}`,
    description: `${p.title}: a fashion photography series by ${NAME}, photographer working between India and Europe. ${p.photos.length} photographs.`,
    image: coverOf(p).src,
  };
}

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Rewrites index.html's head for the page: title, description, robots,
// sharing tags, canonical address and structured data.
export function headFor(html, page, origin, content) {
  const title = page.title || HOME_TITLE;
  const description = page.description || content?.bio?.[0] || HOME_DESCRIPTION;
  const image = `${origin}/${page.image || content?.landing?.[0]?.src || "photos/landing/01.jpg"}`;
  const url = `${origin}${page.canonical}`;
  const set = (re, value) => (html = html.replace(re, value));
  set(/<title>[\s\S]*?<\/title>/, `<title>${escText(title)}</title>`);
  set(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escAttr(description)}$2`);
  set(/(<meta name="robots" content=")[^"]*(")/, `$1${page.index ? "index, follow, max-image-preview:large" : "noindex, follow"}$2`);
  set(/(<meta property="og:title" content=")[^"]*(")/, `$1${escAttr(title)}$2`);
  set(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${escAttr(description)}$2`);
  set(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escAttr(title)}$2`);
  set(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${escAttr(description)}$2`);
  if (page.kind === "project") {
    // The home page's image size and description do not apply.
    set(/\s*<meta property="og:image:width"[^>]*>/, "");
    set(/\s*<meta property="og:image:height"[^>]*>/, "");
    set(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${escAttr(`${page.project.title}, photograph by ${NAME}`)}$2`);
  }

  const email = content?.contact?.email || "work.photosbysundar@gmail.com";
  const instagram = content ? content.contact?.instagram : "photosbysundar";
  const person = {
    "@type": "Person",
    "@id": `${origin}/#person`,
    name: NAME,
    jobTitle: ROLE,
    description: content?.bio?.[0] || HOME_DESCRIPTION,
    url: `${origin}/`,
    image: `${origin}/${content?.landing?.[0]?.src || "photos/landing/01.jpg"}`,
    email: `mailto:${email}`,
    sameAs: instagram ? [`https://www.instagram.com/${instagram}/`] : [],
    workLocation: [
      { "@type": "Place", name: "India" },
      { "@type": "Place", name: "Europe" },
    ],
    knowsAbout: ["Fashion photography", "Editorial photography", "Portrait photography"],
  };
  const data = [
    { "@context": "https://schema.org", ...person },
    { "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: `${origin}/` },
  ];
  if (page.kind === "project") {
    data.push({
      "@context": "https://schema.org",
      "@type": "ImageGallery",
      name: page.project.title,
      url,
      author: { "@id": `${origin}/#person` },
      image: page.project.photos.map((ph) => `${origin}/${ph.src}`),
    });
    data.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: NAME, item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: page.project.title, item: url },
      ],
    });
  }
  // "<" is escaped so the JSON can never close the script element early.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const tags = [
    `<link rel="canonical" href="${escAttr(url)}" />`,
    `<meta property="og:url" content="${escAttr(url)}" />`,
    `<meta property="og:image" content="${escAttr(image)}" />`,
    `<meta name="twitter:image" content="${escAttr(image)}" />`,
    `<script type="application/ld+json">${json}</script>`,
  ];
  // Crawlers that do not run scripts still find every project.
  const links = (content?.projects || []).map((p) => `<a href="/work/${p.id}">${escText(p.title)}</a>`).join(" · ");
  html = html.replace("<!--seo-->", tags.join("\n    "));
  html = html.replace("<!--projects-->", links);
  return html;
}

// Every indexable page, each project with its photographs (image sitemap).
export function sitemapFor(origin, content) {
  const loc = (path, images = []) =>
    `  <url>\n    <loc>${origin}${path}</loc>\n` +
    images.map((src) => `    <image:image><image:loc>${origin}/${src}</image:loc></image:image>\n`).join("") +
    `  </url>\n`;
  const projects = content?.projects || [];
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    loc("/", (content?.landing || []).map((s) => s.src)) +
    projects.map((p) => loc(`/work/${p.id}`, p.photos.map((ph) => ph.src))).join("") +
    loc("/info") +
    loc("/contact") +
    `</urlset>\n`
  );
}
