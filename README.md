# Stop the Sale — Smart Glasses Campaign Site

## Take Stop Smart Glasses global

Smart glasses are a global problem, so Stop Smart Glasses has been built to travel. We've made the campaign website open source so people in other countries can use what we've already built rather than starting from scratch. You can copy it, adapt it for your country, add your own retailers, laws and political actions, and build a Stop Smart Glasses campaign where you live.

You don't need to be a developer to get involved. The resources below are there to help you understand what's available and how to get started.

A single-page UK campaign site against smart glasses with hidden recording capability (e.g. Meta Ray-Ban). It drives six actions: find verified sellers near you by postcode, email opticians/MPs/major retailers with editable templates, sign the live UK Parliament petition, and petition Ray-Ban/EssilorLuxottica directly. Plain HTML/CSS/JS, no build step — the site itself needs no backend for actions B–F. The postcode finder (Action A) and the "campaign impact" counters both need the optional Cloudflare Worker + D1 backend in `worker/` — without it deployed, both features degrade gracefully (finder shows a "search is being set up" message, impact panel hides) and the rest of the site works normally.

**Petition signature count:** a few different snapshots showed up across this repo's source material (5,399 / 4,997 / 5,367 / 1,220, all supposedly for petition 769206). Since a live petition's count only ever goes up until it closes, the largest of those (5,399) is the most recent real snapshot, and that's the value currently set in `js/main.js` — the 1,220 figure looks like a stale or mismatched read from a third-party tracker, not a real data point. Time will have passed since that snapshot was taken, though, so do a final live check at https://petition.parliament.uk/petitions/769206 before any major push (e.g. a press mention) and bump the number up if it's grown. The closing date (9 December 2026) was consistent across every source.

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

## The postcode finder (Action A)

Replaces the old "search Google Maps yourself" hand-off with a real
postcode search against a database of **first-party-verified** stockists —
shops we can point to actual evidence for, not a guess. Ask a postcode,
get back only branches with `verification_status = 'verified_branch'` in
D1: real evidence tied to that specific physical branch, not just "this
chain sells it somewhere" (`authorised_chain`) — see
`worker/schema.sql` for the full verification model and
`scripts/ingest/README.md` for how data gets from a retailer's own website
into that table without ever silently promoting weaker evidence into a
"verified" badge.

**Status: architecture built and tested; first real dataset ready, not yet
deployed.** The full pipeline (fetch → normalize → geocode → SQL → D1 →
`/api/stockists` → frontend) has been proven end-to-end against the real
Worker code, first with a synthetic test fixture, then with real data.
`data/stockists/vision-express.normalized.json` holds 438 real,
first-party-verified Vision Express branches with real coordinates — see
`data/stockists/README.md` for what that file is and
`scripts/ingest/README.md` for the full source-by-source status (David
Clulow next, Ray-Ban's own locator after that). None of this is loaded
into the real production database yet — that's a deliberate, separate,
not-yet-taken step.

Same deploy dependency as the counters below: this needs the Worker in
`worker/` deployed and `js/config.js`'s `API_BASE_URL` set. Until then, the
finder shows a plain "search is being set up" message and the rest of the
page works normally.

## Campaign impact counters (optional)

The site can show a live "campaign impact so far" panel — site visits, plus
per-module counts for optician/MP/Ray-Ban/retailer messages, finder
searches, and petition clicks/shares. This needs a small backend (a static
site alone can't hold a shared counter), so it's off by default and the panel
stays hidden until you turn it on. This is the **same Worker deploy** the
postcode finder above needs — you only have to do this once for both
features:

1. Deploy the Worker in `worker/` — follow `worker/README.md` (free
   Cloudflare account, takes about 10 minutes, no cost at this site's
   expected traffic).
2. Open `js/config.js` and set `window.API_BASE_URL` to the Worker URL
   Wrangler gives you.
3. Commit and push — the impact panel, inline per-module counters, and the
   postcode finder all come alive automatically.

These are self-reported interaction counts (rate-limited per visitor so
they're harder to casually inflate), not confirmed email deliveries or
verified petition signatures — the panel's own footnote says this, and it's
worth keeping that framing if the numbers get quoted anywhere, e.g. to press.

## Structure

```
index.html               — all page content and section markup
css/style.css             — styles (design tokens as CSS custom properties at the top)
js/config.js              — API_BASE_URL, shared by stats.js and finder.js
js/main.js                — petition figures config, copy/mailto handlers for actions B–F
js/stats.js               — campaign impact counters: fetches/renders counts, fires hits on actions
js/finder.js              — postcode finder (Action A): search, result cards, contact routing
worker/                    — optional Cloudflare Worker + D1 backend (see worker/README.md)
  src/index.js               — routes: /api/stats, /api/hit, /api/stockists
  src/stockists.js           — the finder's search logic (geocode → distance → sort → shape)
  src/geocode.js             — postcode validation + postcodes.io client (shared with ingestion scripts)
  src/distance.js            — Haversine distance + bounding-box helpers
  schema.sql                  — counters + rate_limits + stockists tables
scripts/ingest/             — the stockist-data pipeline (see scripts/ingest/README.md)
data/stockists/             — finalized, committed per-source datasets ready to load into D1 (see data/stockists/README.md)
meta_rayban_research.md   — background research (Gemini Deep Research), not yet fact-checked for site copy
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
