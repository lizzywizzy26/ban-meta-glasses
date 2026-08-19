# Domain migration audit — bansmartglasses.com → stopsmartglasses.com

Audit only, per the 19 Aug 2026 brand migration brief. **Nothing below has
been changed.** The live site still points at `bansmartglasses.com`
everywhere, and the Worker's `ALLOWED_ORIGINS` has not been touched — the
exact mistake that broke the finder once already (see
`BETA-TESTING-LOG.md`) is the reason every item below is listed rather than
silently fixed.

**Do not action any of this until `stopsmartglasses.com` is purchased,
DNS-configured, and you've explicitly confirmed it's ready.** Flipping any
one of these without the domain live would break the corresponding piece
of the site.

## Every hard-coded reference found

| # | File | Line(s) | What it is | What it needs to become |
|---|---|---|---|---|
| 1 | `CNAME` | 1 | GitHub Pages custom-domain file — this is what tells GitHub Pages which domain to serve the site on | `stopsmartglasses.com` |
| 2 | `worker/wrangler.toml` | 13 | `ALLOWED_ORIGINS` env var default (CORS allow-list) | Add `https://stopsmartglasses.com,https://www.stopsmartglasses.com` |
| 3 | **Cloudflare dashboard** (not in this repo) | — | The Worker's **live** `ALLOWED_ORIGINS` variable, set directly on the Cloudflare dashboard — this is the copy that actually governs the deployed Worker right now, independent of `wrangler.toml` | Must be updated on the dashboard itself (Workers & Pages → `stop-meta-glasses-counters` → Settings → Variables), same place the original CORS bug was fixed. **This is the single highest-risk step** — miss it and the finder breaks again, exactly as it did on 19 Aug |
| 4 | `index.html` + `redesign/index.html` | 1004, 1036, 1068, 1100, 1158 (each file) | `https://bansmartglasses.com` printed as plain text inside the 5 email-template `<template>` blocks (National retailer x4, MP/Premises share one), read by real recipients | `https://stopsmartglasses.com` |
| 5 | `index.html` + `redesign/index.html` | 1382 / 1381 | `const CAMPAIGN_URL = 'https://bansmartglasses.com'` — the single JS constant the 5 references above are actually built from (they're templated, not hard-coded 5 times in the JS — only the visible `<template>` markup repeats it) | `https://stopsmartglasses.com`. **Note:** update this constant and the markup copies together — they're two different mechanisms (JS constant vs. static template text) that happen to say the same thing today |
| 6 | `js/config.js` + `index.html`/`redesign/index.html` (inline duplicate) | `config.js:7`, `index.html:1257` | `window.API_BASE_URL = 'https://stop-meta-glasses-counters.banmetaglasses.workers.dev'` — the Cloudflare Worker's own `*.workers.dev` account subdomain (`banmetaglasses` is the Cloudflare **account** subdomain, not a campaign-name reference — this is not the same kind of rename as the others) | Only needs to change if you rename the Worker or its account subdomain on Cloudflare — **not part of the bansmartglasses.com → stopsmartglasses.com domain swap**. Flagging so it isn't confused with #3 above; recommend leaving this exactly as-is unless you're deliberately renaming the Worker too |
| 7 | `worker/wrangler.toml` | 13 (same line as #2) | `https://lizzywizzy26.github.io` in the same `ALLOWED_ORIGINS` list | No change — this is the GitHub Pages fallback origin, unrelated to the custom domain, keep it |
| 8 | `README.md` | 21 | `https://lizzywizzy26.github.io/ban-meta-glasses/` — the repo's own GitHub Pages URL, derived from the (deliberately unrenamed) repo name | No change — repo rename is explicitly out of scope |
| 9 | `BETA-TESTING-LOG.md` | 11, 21, 24, 36, 37 | Historical bug-report record naming `bansmartglasses.com` as the domain that was live when the CORS bug happened | **Leave unchanged** — historical record, per your standing instruction not to edit evidence/history to erase the old name |

## Not present — nothing to migrate here

Checked for and found **none** of the following anywhere in the live
site or repo, so there's nothing to prepare on these fronts:
- `sitemap.xml` or any sitemap reference
- `robots.txt`
- A `_redirects` file or any GitHub Pages redirect rule
- `<link rel="canonical">` on any page
- Open Graph (`og:*`) or Twitter Card meta tags
- A `manifest.json` / web app manifest
- Structured data (`application/ld+json`)
- Any analytics snippet (Google Analytics, Plausible, etc.)
- Any campaign email address (e.g. `hello@bansmartglasses.com`) — none
  exists in the codebase; if one exists elsewhere (a real inbox), that's
  outside this repo and outside what I can audit

If any of these get added later (e.g. you set up analytics or an OG
image), add them to this table before the actual migration — this list is
only as complete as what exists in the repo today.

## The actual redirect (bansmartglasses.com → stopsmartglasses.com)

Not yet possible to prepare concretely: GitHub Pages custom domains don't
support path-preserving redirects on their own once a `CNAME` file
points a repo at a single domain — you can't have the same Pages
deployment answer to two domains and 301 one to the other from inside
this repo. The realistic options, for you to decide between when the time
comes (not now):
- Point `bansmartglasses.com`'s DNS at a small redirect service (Cloudflare
  Redirect Rules, on the same Cloudflare account already used for the
  Worker, is the natural fit — free, and keeps everything on one
  dashboard) that 301s every path to the equivalent path on
  `stopsmartglasses.com`, while `stopsmartglasses.com` itself becomes the
  new `CNAME` target for this repo.
- Keep `bansmartglasses.com` registered (don't let it lapse) even after
  the redirect is set up, so existing links (press coverage, the
  petition, anything already shared) keep resolving indefinitely.

## Suggested order of operations, when you're ready

1. Confirm `stopsmartglasses.com` is purchased and DNS is pointed the way
   GitHub Pages needs (same setup `bansmartglasses.com` uses now).
2. Update the **Cloudflare dashboard** `ALLOWED_ORIGINS` variable first
   (item 3) to include both domains simultaneously — do this before
   switching `CNAME`, so the finder never has a window where the
   currently-live domain is blocked.
3. Update `CNAME` (item 1) and push — GitHub Pages starts serving
   `stopsmartglasses.com`.
4. Update `worker/wrangler.toml` (item 2) to match the dashboard, so a
   future `wrangler deploy` doesn't regress it.
5. Update the email-template domain references and `CAMPAIGN_URL`
   (items 4–5) and push.
6. Set up the `bansmartglasses.com` → `stopsmartglasses.com` redirect.
7. Once redirect traffic confirms old links still resolve, remove
   `bansmartglasses.com` from `ALLOWED_ORIGINS` if/when you're confident
   nothing still calls the API from that origin directly.

Every step above needs your explicit go-ahead when the domain is actually
ready — nothing here has been actioned.
