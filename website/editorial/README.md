# Sundar Rajan — portfolio

A minimal portfolio where the photographs carry the site: static HTML, CSS and
JavaScript, plus a small Cloudflare Worker for enquiries, SEO and the /admin editor.

| Route                  | Page                                                     |
| ---------------------- | -------------------------------------------------------- |
| `#/`                   | Landing slideshow                                        |
| `#/work/<project>/<n>` | One project, one photograph at a time (arrows, swipe, Back) |
| `#/thumbnails`         | Every photograph, centred in an even grid                |
| `#/index`, `#/info`, `#/contact` | Slideshow with the panel open on that tab      |

## Files

- `index.html`, `styles.css`, `app.js`, `boot.js`, `data.js`, `photos/`,
  `thumbs/`: the site. Cloudflare publishes these.
- `src/worker.js`: the Worker. It serves the site, adds canonical and sharing
  URLs plus structured data for whichever domain the site is on, serves
  `robots.txt` and `sitemap.xml`, sets security headers, and handles
  `POST /api/enquiry`.
- `wrangler.jsonc`: Worker config. `.assetsignore` keeps the Worker code, the
  config and this README out of the published files.
- `dev.mjs`: local preview that runs the real Worker: `node dev.mjs`.

## Deploy (Cloudflare)

Deploy command: `npx wrangler deploy --config website/editorial/wrangler.jsonc`
Build command: `exit 0`

## Enquiries

The form posts to `/api/enquiry`, which checks the input, quietly drops bots
(hidden field, too-fast submissions), rate-limits senders (5 an hour), keeps a
copy in KV (listed in /admin → Enquiries) and emails it to `ENQUIRY_TO`
through Cloudflare Email (the address must be verified in the domain's Email
Routing). With no storage and no email set up, the API answers 503 and the page
opens the visitor's email app with the enquiry filled in, so nothing is lost.

## Admin (/admin)

`/admin` edits the site without touching code: projects (add, rename,
reorder, delete), their photographs (upload, reorder by dragging, remove, pick
the cover), the opening slideshow (☆ on any photograph), the bio and contact
details, and the enquiries. Nothing changes on the site until **Publish**;
**Undo last save** goes back one version.

- Sign-in: one password, the secret `ADMIN_PASSWORD` (Cloudflare → Worker →
  Settings → Variables and Secrets). Changing it signs everyone out. Sessions
  last 12 hours; 8 wrong tries lock sign-in for 15 minutes.
- Storage: the KV namespace bound as `CONTENT`. Saved content replaces
  `data.js` (served by the Worker); uploaded photographs are resized in the
  browser to 2000/1200/700 px, JPEG and WebP, and served from KV at the usual
  `photos/`, `medium/` and `thumbs/` addresses. Photographs no longer used are
  deleted two publishes later (kept for undo).
- Free-plan limits that matter: 1,000 KV writes a day (one photograph is 6
  writes, one publish 3), 1 GB of storage.
- Code: `admin/` (page), `src/admin.js` (sign-in, API), `src/content.js`
  (checks, storage, data.js).
- Locally: `ADMIN_PASSWORD=anything node dev.mjs`, then open
  http://localhost:4176/admin/ (content is kept in memory).

## Editing without the admin

Until the first publish in /admin the site uses the static `data.js` (every
photograph, its ratio, the bio and contact details). After that, /admin is the
source of truth and `data.js` is only the fallback.
