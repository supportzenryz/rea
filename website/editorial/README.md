# Sundar Rajan — portfolio

A minimal portfolio where the photographs carry the site: static HTML, CSS and
JavaScript, plus a small Cloudflare Worker for enquiries and SEO.

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
(hidden field, too-fast submissions) and then:

1. **Emails it** to `ENQUIRY_TO` (in `wrangler.jsonc`) through
   [Resend](https://resend.com), once a `RESEND_API_KEY` secret is added in
   Cloudflare (Worker → Settings → Variables and Secrets).
2. **Keeps a copy** and rate-limits senders (5 an hour), once a KV namespace
   is bound as `ENQUIRIES` (see `wrangler.jsonc`).

Until one of those is set up, the API answers 503 and the page opens the
visitor's email app with the enquiry filled in, so nothing is lost.

## Editing

- `data.js` lists every photograph and its ratio; regenerate it after adding
  or removing photographs. Add a 700px copy to `thumbs/` (same folder and
  name) for each new project photograph.
- `app.js` holds the bio and contact details (`BIO`, `CONTACT`).
