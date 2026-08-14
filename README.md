# Stop the Sale — Smart Glasses Campaign Site

A single-page UK campaign site against smart glasses with hidden recording capability (e.g. Meta Ray-Ban). It drives five actions: find local opticians, email opticians and MPs with editable templates, sign the live UK Parliament petition, and petition Ray-Ban/EssilorLuxottica directly. Plain HTML/CSS/JS, no build step — the site itself needs no backend. An optional Cloudflare Worker (see `worker/`) powers the "campaign impact" counters if you choose to deploy it.

**Before launch — verify the signature count by hand.** Multiple sources in and around this repo disagree by a lot: the build brief said 5,399, a later research pass said 4,997, a live web search turned up 5,367, and a third-party tracker site showed just 1,220 for the same petition (769206). I couldn't fetch petition.parliament.uk directly to resolve this (blocked by this session's network egress rules) — so **don't trust any number currently in this repo**. Open https://petition.parliament.uk/petitions/769206 yourself, read the real count off the page, and set it via `js/main.js` (see below) before pointing anyone at the site. The closing date (9 December 2026) was consistent across every source, so that one's solid.

## Run it locally

No build tools needed. Either:

- Open `index.html` directly in a browser, or
- Serve it with any static server, e.g. `python3 -m http.server` from this folder, then visit `http://localhost:8000`

## Deploy it (GitHub Pages)

This is the simplest option since the code already lives on GitHub:

1. On GitHub, go to the repo's **Settings → Pages**
2. Under "Build and deployment", set **Source** to "Deploy from a branch"
3. Set **Branch** to `main` and folder to `/ (root)`, then **Save**
4. GitHub will publish the site at `https://lizzywizzy26.github.io/ban-meta-glasses/` within a minute or two

Any time you push to `main`, the live site updates automatically — no rebuild step required.

## Update the petition signature count

The count and closing date are **not** live-fetched (by design — no scraping/API for v1). To update them:

1. Check the real numbers at https://petition.parliament.uk/petitions/769206
2. Open `js/main.js`
3. Edit the two constants at the top of the file:
   ```js
   const PETITION_SIGNATURES = '5,399';
   const PETITION_CLOSE_DATE = '9 December 2026';
   ```
4. Save, commit, and push — the hero banner and Action C panel both read from these two values

## Campaign impact counters (optional)

The site can show a live "campaign impact so far" panel — site visits, plus
per-module counts for optician emails, MP emails, Ray-Ban messages, petition
click-throughs, and share-text copies. This needs a small backend (a static
site alone can't hold a shared counter), so it's off by default and the panel
stays hidden until you turn it on:

1. Deploy the Worker in `worker/` — follow `worker/README.md` (free
   Cloudflare account, takes about 10 minutes, no cost at this site's
   expected traffic).
2. Open `js/stats.js` and set `API_BASE_URL` to the Worker URL Wrangler
   gives you.
3. Commit and push — the impact panel and inline per-module counters appear
   automatically.

These are self-reported interaction counts (rate-limited per visitor so
they're harder to casually inflate), not confirmed email deliveries or
verified petition signatures — the panel's own footnote says this, and it's
worth keeping that framing if the numbers get quoted anywhere, e.g. to press.

## Structure

```
index.html          — all page content and section markup
css/style.css        — styles (design tokens as CSS custom properties at the top)
js/main.js           — petition figures config, city chip generation, copy/mailto handlers
js/stats.js          — campaign impact counters: fetches/renders counts, fires hits on actions
worker/               — optional Cloudflare Worker + D1 backend for the counters (see worker/README.md)
meta_rayban_research.md — background research (Gemini Deep Research), not yet fact-checked for site copy
```

## License

The code (HTML/CSS/JS, the Worker) is [MIT licensed](LICENSE) — copy it,
adapt it for your own city or country, fork it for a different campaign, no
need to ask first. Just keep the copyright notice in the LICENSE file.

The campaign copy — evidence summaries, email/message templates, page text —
isn't really "software," so if you're a non-developer wanting to reuse just
the *words* (e.g. lift the optician email template for your own local
campaign), treat it as [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/):
free to reuse and adapt, just say where it came from and keep the BBC/source
citations attached to any factual claims you carry over — don't strip the
sourcing and present the claims as your own research.
