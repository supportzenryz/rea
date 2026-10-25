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
- `wrangler.jsonc`: Worker config. `run_worker_first` lists the only paths that
  run the Worker (the page, data.js, the API, /admin, robots, sitemap and
  photographs uploaded in /admin); every other file is served directly, free
  and unlimited. A Cloudflare Redirect Rule sends www. and http:// to
  https://photosbysundar.com (the Worker does the same for its own paths).
- `MIGRATION.md`: how to move everything to another Cloudflare account.
- `.assetsignore` keeps the Worker code, the config, this README and
  MIGRATION.md out of the published files.
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
the cover), the opening slideshow (☆ on any photograph, or upload straight
into it; ⤢ reframes a slide: shape, zoom and position), the bio and contact
details, and the enquiries. Nothing changes on the site until **Publish**;
**Undo last save** goes back one version.

- Sign-in (OWASP authentication, session and forgot-password guidance):
  - The first password is the secret `ADMIN_PASSWORD` (Cloudflare → Worker →
    Settings → Variables and Secrets). Once a new one is chosen in /admin
    (Account) or through a reset link, it is stored only as a salted
    PBKDF2-SHA-256 hash (100,000 rounds, the Workers maximum) and the secret no
    longer signs in.
  - New passwords: 12–128 characters, checked against known breaches (Have I
    Been Pwned, k-anonymity: only 5 characters of a hash leave the server).
  - **Forgot password** emails a single-use link to `ENQUIRY_TO` only (never an
    address from the request): 256-bit token, stored as a hash, valid 15
    minutes, in the URL #fragment. The answer is the same whether or not a mail
    went out. Using it, or changing the password, signs out every device and
    emails a notice. Needs Cloudflare Email working (verified address).
  - Sessions: 12 hours, `__Host-` cookie, HttpOnly, Secure, SameSite=Strict,
    signed with a key that includes a random key in KV (`auth:key`);
    **Sign out everywhere** replaces it.
  - Wrong passwords: 8 per visitor and 50 for everyone together per 15 minutes,
    then sign-in pauses (the reset link still works). Every change also needs
    the site's own Origin.
  - Locked out with no email? Delete the KV keys `auth:password` (back to the
    `ADMIN_PASSWORD` secret) and `auth:key` in the Cloudflare dashboard.
- Storage: the KV namespace bound as `CONTENT`. Saved content replaces
  `data.js` (served by the Worker); uploaded photographs are resized in the
  browser to 2000/1200/700 px, JPEG and WebP, and served from KV at the usual
  `photos/`, `medium/` and `thumbs/` addresses. Photographs no longer used are
  deleted two publishes later (kept for undo).
- Free-plan limits that matter: 1,000 KV writes a day (one photograph is 6
  writes, one publish 3), 1 GB of storage.
- Code: `admin/` (page), `src/admin.js` (sign-in, API), `src/content.js`
  (checks, storage, data.js), `src/mail.js` (email to the owner).
- Uploads are checked by their first bytes (real JPEG or WebP), not just their
  label, and served with `nosniff`.
- Locally: `ADMIN_PASSWORD=anything node dev.mjs`, then open
  http://localhost:4176/admin/ (content is kept in memory).

## Editing without the admin

Until the first publish in /admin the site uses the static `data.js` (every
photograph, its ratio, the bio and contact details). After that, /admin is the
source of truth and `data.js` is only the fallback.
