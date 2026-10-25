# Moving the site to Sundar's Cloudflare account

Cloudflare does not move a Worker, its storage or a domain's settings between
accounts: each is recreated in the new account, then the domain is switched
over. Done in this order, visitors see no downtime: the old account keeps
serving the site until the new one is ready.

Everything here is free on the new account too.

## What lives where today (account support@zenryz.com)

| Piece | Name | Notes |
| --- | --- | --- |
| Worker | `francephotography` | Built from GitHub `supportzenryz/rea`, branch `main`, folder `website/editorial` |
| Storage (KV) | `photosbysundar-content`, bound as `CONTENT` | Site content, uploaded photos, enquiries, admin password hash |
| Secret | `ADMIN_PASSWORD` | Must exist (first password, then the fallback) |
| Domain (zone) | `photosbysundar.com`, Free plan | Nameservers `boyd` / `hera`.ns.cloudflare.com, set at GoDaddy |
| Worker domains | `photosbysundar.com`, `www.photosbysundar.com` | |
| Redirect rule | "www and http to https://photosbysundar.com" | See step 7 for the exact rule |
| Email Routing | destination `work.photosbysundar@gmail.com` (verified) | MX, SPF and DKIM records are added by Email Routing |

## 1. Accounts (Sundar)

1. Sundar creates his Cloudflare account with his own email and turns on
   two-factor authentication (My Profile → Authentication).
2. He invites you: Manage account → Members → Invite, role
   **Super Administrator** (or Administrator).

## 2. Code (GitHub)

Either keep `supportzenryz/rea`, or (better for ownership) transfer the
repository to Sundar's GitHub (Settings → Transfer ownership) and keep yourself
as a collaborator. The new Cloudflare account connects to whichever owns it.

## 3. Storage in the new account

1. Storage & databases → Workers KV → Create, name `photosbysundar-content`.
2. Put the new namespace id in `wrangler.jsonc` (`kv_namespaces` → `id`) and
   commit. Until the domain moves, the new Worker only answers on its
   `workers.dev` address.
3. Copy the data from the old namespace to the new one: keys `content`,
   `content:previous`, `content:previous:older`, every `img:…` (uploaded
   photographs), every `enquiry:…`, and `auth:password` (keeps Sundar's
   password). Do not copy `auth:key` (sessions start fresh), `login:…`,
   `forgot:…`, `reset:…` or `rate:…`. With Wrangler logged in to each account
   in turn: `wrangler kv key list`, `wrangler kv key get`, `wrangler kv bulk put`.
   Uploaded photographs are binary: copy them with `get`/`put` per key, not
   through a JSON file.

## 4. Worker in the new account

1. Workers & Pages → Create → Import a repository → the repo from step 2.
2. Settings: Worker name `francephotography` (any name works), root directory
   `website/editorial`, build command `exit 0`, deploy command
   `npx wrangler deploy --config website/editorial/wrangler.jsonc`, production
   branch `main`, build watch paths `*`.
3. Settings → Variables and Secrets → add **Secret** `ADMIN_PASSWORD`.
4. Open the `workers.dev` address and check: the site, the slideshow, an
   uploaded photograph, `/admin/` sign-in (with Sundar's password if
   `auth:password` was copied).

## 5. Domain

1. Before anything else, in the old account: DNS → Records → Export (keep the
   file).
2. New account → Add a site → `photosbysundar.com` → Free → choose **Manually
   enter DNS records** (the Worker and Email Routing add their own).
3. Cloudflare shows two new nameservers. At GoDaddy (Domain → DNS →
   Nameservers → Change → "I'll use my own nameservers"), replace the old two
   with these. Make sure DNSSEC stays off.
4. Wait until the new account shows the domain as **Active** (minutes to a few
   hours). The old account keeps serving the site in the meantime.

## 6. Connect the domain (right after it shows Active)

1. Worker → Settings → Domains & Routes → Add → Custom domain:
   `photosbysundar.com`, then `www.photosbysundar.com`.
2. Email → Email Routing → enable, add the missing DNS records, add destination
   `work.photosbysundar@gmail.com` and click the verification email again.
3. Check `ENQUIRY_TO`, `MAIL_FROM` and `SITE_URL` in `wrangler.jsonc` (they
   stay the same unless the address changes).

## 7. Redirect rule

Rules → Redirect Rules → Create rule:

- Name: `www and http to https://photosbysundar.com`
- If: Custom filter expression
  `(http.host eq "www.photosbysundar.com") or (http.host eq "photosbysundar.com" and not ssl)`
- Then: Dynamic, expression
  `concat("https://photosbysundar.com", http.request.uri.path)`, 301,
  **Preserve query string** on.

## 8. Check, then tidy up

- `http://photosbysundar.com` and `https://www.photosbysundar.com/info` both
  end at `https://photosbysundar.com/…`.
- Site, photographs, Thumbnails, Info, the contact form (an enquiry arrives in
  Gmail and under /admin → Enquiries), /admin sign-in, Forgot password email.
- Then, in the old account: delete the Worker, the KV namespace and the old
  domain entry (it shows "Moved away" once the new account is active).
