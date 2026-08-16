# Retailer research matrix

Status of every retailer investigated for the stockist database, per the
brief's original Phase 1/Phase 2 list plus the specific set requested on
14–15 Aug 2026 (John Lewis, Currys, EE, O2, Vodafone, Argos, Sunglass
Hut/Ray-Ban). Nothing here has been ingested, classified, or deployed —
this is a planning document, not a data source.

**How to read "extraction difficulty":**
- **Static** — a plain fetch gets real data, same pattern as Vision
  Express/David Clulow (a script can run unattended).
- **Dynamic (needs DevTools)** — the branch-level data only appears after
  a live interaction (e.g. typing a postcode into a "check stock" box),
  which loads via a JavaScript/AJAX call not present in the initial page
  HTML. A plain fetch script can't capture this — someone needs to open
  the page in a real browser, open DevTools' Network tab, trigger the
  interaction, and copy the resulting request. See the DevTools guide
  below for exact steps.
- **Unknown** — haven't seen real data yet either way.

| Retailer | Sells Ray-Ban Meta? | Branch-level signal exposed? | Extraction difficulty | Priority | Notes |
|---|---|---|---|---|---|
| **Vision Express** | ✅ Confirmed | Directory-level only, no per-branch tag | Static (done) | — | 438 branches committed as `verified_branch` via `first_party_product_specific_directory` (campaign owner's decision) |
| **David Clulow** | ✅ Confirmed | Directory-level only, no per-branch tag | Static (done) | — | 40 branches committed as `verified_branch` via `first_party_product_specific_directory`, corroborated by campaign owner's phone spot-check (15 Aug 2026) — see decision below |
| **Ray-Ban (own store locator)** | ✅ Confirmed (it's their product) | 6/7 stores verified_branch (real per-branch page evidence), Stratford Westfield authorised_chain — see decision below | Static (done — targeted parser + branch-signal merge confirmed) | High | `1-fetch-rayban.mjs` parses a real, small (7-entity) UK directory: Gatwick Airport, Covent Garden, Glasgow Buchanan St, Carnaby St, Battersea Power Station, Brent Cross, Stratford Westfield. These are Ray-Ban's own-brand boutiques, not a stockist list of other shops |
| **Sunglass Hut UK** | ✅ Confirmed (dedicated product page exists) | Blocked — Akamai bot-management block on the store-locations path, confirmed via `errors.edgesuite.net` reference in the 403 body | Static, but actively blocked (Akamai) | High | `1-fetch-sunglasshut.mjs` now runs a 3-step diagnostic (cookies, fuller headers, robots.txt/sitemap discovery); `1b-fetch-sunglasshut-browser.mjs` is a Playwright real-browser fallback if that's still blocked — see finding below |
| **Currys** | ✅ Confirmed (multiple product listings, Gen 1 + Gen 2) | **Parked 15 Aug 2026 — partially solved, not automatable as-is.** Real collection availability confirmed in the live UI (see below), but no clean standalone store-list endpoint was found after two targeted DevTools passes | **Dynamic — investigated, blocked** | High | No official public API; a third-party scraper ecosystem exists around this generally, but this project's own capture attempts didn't land on a reproducible request — see the parking note below for exactly what was tried |
| **Argos** | ✅ Confirmed (multiple product listings) | Yes — per-product postcode stock checker, arguably the most mature version of this pattern in UK retail | **Dynamic (needs DevTools)** | High | Same as Currys: no official public API, but a large third-party scraper ecosystem (Apify, GitHub projects, paid stock-checker APIs) confirms the underlying live per-store data is real and accessible |
| **John Lewis** | ✅ Confirmed (29 models listed) | **Multi-SKU coverage check done 15 Aug 2026** — two deliberately different variants (Wayfarer Gen 1, Skyler Gen 2) both query the same 36 physical stores; merged by storeId, **21 unique branches have positive live stock** on at least one variant, 15 do not on either. Skyler alone showed 0 positive branches nationwide (a real finding, not a bug). A third variant (Headliner) is currently unavailable online with no stock checker, so 2-SKU coverage is what's achievable right now, not a gap left open by choice | **Dynamic — solved and coverage-checked.** `1-fetch-john-lewis.mjs` merges by storeId automatically, ready to run for real | High | Response is XML (not JSON as first assumed), parsed with regex (no new dependency). One real bug found and fixed during testing: shopping-centre branches (e.g. White City) have 4 address lines instead of 3, and a naive "3rd line = postcode" assumption silently grabbed "London" instead of the real postcode for those stores — fixed by taking the postcode from the *last* address line instead of a fixed position |
| **EE** | ✅ Confirmed (sells online with EE ID, dedicated Ray-Ban Meta page) | Ambiguous, re-investigated 15 Aug 2026 — EE Store has an official "How can I check if a product is in stock?" help page, but its own wording ("ship from main warehouse or suppliers' warehouses... readily available to dispatch") reads like **online/delivery fulfillment status, not a per-branch physical-store checker** — a meaningfully weaker signal than O2's | **Unknown, leaning toward "no physical-branch checker"** — needs a direct look at a real product page to confirm either way, not resolvable by search alone | Medium | EE has 550+ UK stores; whether physical branches stock/demo units is still genuinely unclear. If a human visiting `ee.co.uk`'s Ray-Ban Meta product page sees a "check my local store" feature (not just delivery stock status), that changes this to Dynamic/DevTools like O2 |
| **O2** | ✅ Confirmed (dedicated shop pages, Pay Monthly option) | **Found 15 Aug 2026: O2 has a genuine "Stock Checker" tied to physical stores** — "checks availability of a product in your local store... reserve them so they are ready for you" (Click & Collect). A third-party site (clickandcollectuk.co.uk) specifically documents O2's stock-check process — same "real feature, reverse-engineerable" signal that confirmed Currys/Argos were genuine | **Dynamic (needs DevTools)** — reclassified from Unknown | **High** — same tier as Currys/Argos/John Lewis now | Should be added to the DevTools capture queue alongside Currys/Argos/John Lewis, not treated as a lower-priority "Unknown" anymore |
| **Three** | ✅ Confirmed — campaign owner explicitly confirmed (15 Aug 2026) via Three's first-party product collection page: [accessories.three.co.uk/collections/ray-ban-meta](https://accessories.three.co.uk/collections/ray-ban-meta) | Re-investigated 15 Aug 2026 — no evidence found of a stock-checker, reserve-and-collect, or "find in store" feature on `accessories.three.co.uk`. The domain pattern (a separate `accessories.` subdomain) reads like a standalone online storefront, similar in shape to how Very was ruled out — except Three does have physical stores, unlike Very, so "no branch-level feature" isn't fully confirmed, just unevidenced so far | Unknown, leaning "online-only for this storefront" | Medium | This is chain-level evidence only — Three sells Ray-Ban Meta, not evidence that any specific physical Three branch stocks them. Added to Section F (national retailer targets) on this basis. **Not** eligible for the postcode finder's branch-level results without the same per-branch verification standard used for every other source — no change to that standard here |
| **Vodafone** | ❌ Not confirmed | N/A | N/A | Low (as flagged in the original brief) | Re-checked 15 Aug 2026 per campaign owner's request: still no evidence. Vodafone has its own accessories subdomain (`accessories.vodafone.co.uk`, same pattern as Three's confirmed `accessories.three.co.uk/collections/ray-ban-meta`) but a site-restricted search of it for Ray-Ban turned up nothing — no Ray-Ban Meta collection page exists there. Matches the brief's original caution exactly. Needs genuinely new evidence before adding at all, at any verification level |
| **InMotion** | ❌ Not confirmed | N/A | N/A | Low | No evidence found that InMotion's airport stores currently stock Ray-Ban Meta |
| **Very** | ❌ Not confirmed, and structurally moot | N/A — Very has no physical stores at all (online/catalogue retailer) | N/A | Low | Even if confirmed to sell online, Very can never be a local/branch result — same "national retailer" bucket as Amazon, not worth further branch-level investigation |
| **Amazon UK** | ✅ (already established) | N/A by design | N/A | — | Per the campaign owner's explicit instruction: stays a national retailer/action target, not a local postcode result, since there's no meaningful UK physical-store case |

## Findings from the first real Ray-Ban and Sunglass Hut fetches (14–15 Aug 2026)

**Ray-Ban:** the page (`stores.ray-ban.com/united-kingdom`) returns 0 usable
records to a plain-text scan because there's no store markup anywhere in
the visible HTML — it's a Yext "Pages" site that renders client-side.
Crucially, the *initial* HTML response isn't actually empty of data: it
embeds the full directory as a URL-encoded JSON blob fed straight into the
client-side render call (`decodeURIComponent("%7B%22document%22...`).
Decoding that string and walking it (`document.dm_directoryChildren`,
recursively, to leaf nodes with an `address` key) reconstructs the exact
same data the page hydrates from — no JS execution needed. That data
confirms `document.dm_baseEntityCount = "7"`: this is a small, *complete*
list of Ray-Ban's own UK retail boutiques, not a filtered subset and not a
"stockist directory" of other shops. No phone numbers exist anywhere in the
source data (checked: zero occurrences of "phone" in the whole decoded
blob) — that's a genuine absence, not a parsing miss.

Because these are Ray-Ban's own-branded stores, "this is a Ray-Ban store"
is brand/chain-level identity — not, on its own, branch-level evidence that
Ray-Ban Meta specifically is stocked/demoable at each one, per this
project's core verification principle (same reasoning as Vision Express's
first pass). `2-investigate-rayban-branch-signal.mjs` checks all 7
individual store pages (not a sample, since there are only 7) for
Meta-specific text.

## Decision: Ray-Ban — 6 stores verified_branch, 1 stays authorised_chain (15 Aug 2026)

The investigation script initially found nothing on any of the 7 pages —
that was its own bug (it stripped `<script>` tags before searching, but
these Yext pages' real content lives inside a script tag; fixed in commit
`90be223`). Re-run correctly, it found a genuine per-branch difference, not
uniform boilerplate: **6 of 7 stores** (Gatwick Airport, Covent Garden,
Glasgow, Carnaby Street, Battersea Power Station, Brent Cross) carry an
identical first-party content block on their own store page — a "Ray-Ban
Smart Glasses" gallery tile plus "In partnership with Meta, discover our
first generation of smart sunglasses and eyeglasses that keeps you
connected" in their in-store services section. **Stratford Westfield**
has neither — it shows the older, pre-rebrand "Ray-Ban Stories" tile
instead, with no Meta-partnership text anywhere on the page.

This is meaningfully different from Vision Express's first pass (identical
tags on literally every one of 440 records, zero differentiating signal):
here 6 of 7 genuinely differ from the 7th in real first-party page content.
It's still marketing/services copy, not a live stock feed, and Stratford's
gap could reflect a page that simply hasn't been refreshed as recently as
the others rather than a deliberate "we don't do this here" — the leftover
"Ray-Ban Stories" branding supports that reading. The campaign owner
reviewed this and decided: the 6 stores with the content block are
`verified_branch`; Stratford stays at `authorised_chain` rather than being
assumed either way.

Implemented via `scripts/ingest/2b-apply-rayban-branch-signal.mjs`, which
recomputes the evidence check from the investigation file's own data
(mentions found > 0) rather than hardcoding which 6 stores — so re-running
the investigation later reproduces the same classification logic
automatically. Verified end-to-end with `--mock-geocoder`: 6
`verified_branch`, 1 `authorised_chain`, as expected. Real (non-mock)
output still needs to be generated by running the pipeline with normal
network access — see `scripts/ingest/README.md`.

**Sunglass Hut:** the 403 response body identifies as an Akamai
edge/bot-management block (`errors.edgesuite.net` reference ID), not a
missing-page or rendering problem — the request was rejected before
reaching the actual site. This is a different problem from Ray-Ban's:
Akamai Bot Manager fingerprints at the TLS/HTTP-handshake level and via
missing challenge-cookie state, so headers alone often can't fix it.
`1-fetch-sunglasshut.mjs` was reworked into a 3-step diagnostic (homepage
cookie pickup, fuller browser-like headers + Referer, robots.txt/sitemap
discovery as an unprotected alternative path) — still zero new
dependencies. If that's still blocked, `1b-fetch-sunglasshut-browser.mjs`
drives a real (Playwright) Chromium browser instead, which is the
realistic way past this kind of block, and also captures any JSON network
responses the page loads (a store-locator API endpoint, if one exists,
would be a more durable source than scraping rendered HTML). This needs
one-time setup (`cd scripts/ingest && npm install`, ~300MB Chromium
download) — the only script in this pipeline that isn't zero-dependency,
kept deliberately separate and opt-in for exactly that reason.

## Decision: David Clulow — all 40 branches upgraded to verified_branch (15 Aug 2026)

The campaign owner phoned a geographically and operationally varied sample
of David Clulow's 40 Ray-Ban Meta directory branches — standalone David
Clulow stores and David Clulow concessions within John Lewis both
included. Every branch called confirmed Ray-Ban Meta in stock.

Combined with the same directory-level reasoning already applied to Vision
Express (David Clulow presents `/stores/ray-ban-meta` as its own dedicated
Ray-Ban Meta store finder, not a generic locator), the campaign owner
approved the same treatment here: all 40 directory locations are now
`verified_branch` via `verification_method = first_party_product_specific_directory`.

**Provenance, recorded precisely:** the phone calls corroborate the
directory-level judgment — they are not, on their own, an individual
verification of all 40 branches (a sample was called, not all 40). Every
affected record's `notes` field says this explicitly, so the distinction
survives independent of this document. Applied via
`scripts/ingest/apply-david-clulow-verified-branch-decision.mjs`, which
patches the already-committed `data/stockists/david-clulow.normalized.json`
directly (no re-fetch needed — the underlying store facts didn't change,
only the verification judgment). Branch names, including the "David Clulow
Opticians at John Lewis — [location]" concessions and "Harrods Opticians",
were already correct in the committed data and are untouched.

Tested locally: applied `worker/schema.sql` + the regenerated
`david-clulow.upsert.sql` to a local D1 instance via `wrangler d1 execute
--local`, then queried it directly — confirms all 40 rows show
`verification_status = 'verified_branch'`, `verification_method =
'first_party_product_specific_directory'`, and that branch names/notes
survived the SQL round-trip intact (spot-checked "Harrods Opticians").
**Not applied to the remote/production database** — that's a separate,
deliberate step for the campaign owner to trigger.

## What this means for next steps

**Status as of 15 Aug 2026 (mission update):** Ray-Ban (6 verified + 1
chain-only) and David Clulow (40 verified) are committed; Vision Express
(438 verified) was already done. Sunglass Hut is parked (Akamai-blocked).
The campaign owner's current priority is the six-retailer push below —
**this is the biggest piece of remaining work**, since these six could
represent substantially more physical sellers than everything ingested so
far combined, and the true scale of the launch database won't be known
until they're worked through.

**Two different technical problems, not one:**

1. **Static-HTML sources:** same playbook as Vision Express/David Clulow —
   already used for Ray-Ban. Run a fetch script, send back both output
   files, a targeted parser gets built from whatever real structure shows
   up.

2. **Dynamic stock-checkers — now confirmed for four of the six mission
   retailers (Currys, Argos, John Lewis, and as of 15 Aug 2026, O2):**
   fundamentally different problem. The branch-level data isn't in the
   page's initial HTML at all — it loads via a JavaScript call after you
   interact with a "check stock" widget. **A fetch script cannot capture
   this, and I cannot capture it either** — it needs an actual browser
   session on the live site, which this sandbox's network restrictions
   block entirely (same restriction documented throughout this file). A
   human needs to open the page in a real browser, use the stock checker
   once by hand, and capture the underlying network request via DevTools —
   see the step-by-step guide below. This is genuinely the strongest
   possible evidence tier (a live "does store X have product Y in stock
   right now" check), so it's worth the extra effort.

**EE and Three still need a two-minute manual look before deciding
anything** — search-based research couldn't determine whether they have a
physical-branch stock checker at all (EE's own stock-status wording reads
like online/delivery fulfillment, not a per-branch feature; Three's
accessories storefront shows no sign of one). Opening EE's and Three's own
Ray-Ban Meta product pages and looking for a "check my local store" /
"reserve and collect" widget (the same thing DevTools step 5 below asks
you to find) settles it either way — if it's there, they join the DevTools
queue; if not, they likely stay online-only, like Very.

**Status update (15 Aug 2026):** John Lewis is solved (see the decision
section above). Currys is parked — investigated and blocked on
Cloudflare/session dependency, see the parking note below. **Argos and O2
are next** — same guide applies to both. Do the EE/Three quick look
whenever convenient — it's fast and unblocks a decision either way.

---

## Parked: Currys (15 Aug 2026) — partially solved, automation unresolved

**What was confirmed real and working, in the live UI (not automatable, but genuinely true):**
- Product tested: `10256708` — Ray-Ban Meta Headliner (Standard), Shiny Black,
  Polarised G15 Green.
- Postcode tested: `E11 2HB`.
- Result: Currys' own UI resolved this to **"Available to collect from Mon
  17 Aug – Leyton"** — real evidence the flow works and the underlying data
  exists.

**What was captured and ruled out:**
- `GET /cart-delivery-collection-status?postalCode=...&latitude=...&longitude=...`
  — this request was identified and its shape inspected. It's a
  cart/session-scoped delivery-eligibility check, not the store-resolver:
  its own response's `selectedStoreIdForCollection` field stayed `null`
  even while the UI displayed Leyton, confirming this isn't where the
  store list comes from.
- A second targeted pass used Chrome's Network-panel content search for
  "Leyton" while the UI was showing it — found only the same
  `cart-delivery-collection-status` request (1/1 match), no separate
  standalone store-list/store-stock endpoint.

**Why this is being parked rather than pursued further:**
- The only request identified so far requires **live browser cart/session
  state** to return anything — not a stateless, reproducible request like
  John Lewis's.
- Currys sits behind **Cloudflare's bot-challenge system** (a
  `cf_clearance` cookie was required in the captured request — noted as a
  structural fact only; no cookie, session, or Cloudflare-clearance value
  from any capture is stored anywhere in this repo or its history).
  Passing that challenge outside a real browser session is exactly the
  kind of access-control bypass this project has deliberately chosen not
  to attempt (same principle that parked Sunglass Hut).
- Two independent targeted capture passes, including a full-text search of
  network traffic for the exact evidence string ("Leyton"), did not
  surface a cleaner alternative.

**Status: `Dynamic — investigated, blocked`.** Not ruled out forever — if
a future pass (by a browser automation approach, e.g. the same Playwright
pattern built for Sunglass Hut's fallback) manages to hold a
Cloudflare-cleared session, this could be revisited. For now, no further
manual capture time should be spent on Currys; move to Argos or O2.

---

## DevTools guide: capturing a dynamic stock-checker (Currys, Argos, John Lewis, O2)

This only needs to be done once per retailer to find the pattern — after
that, a script can call the same request directly, no more manual steps
needed each time. Repeat these same steps independently for each of the
four retailers — the request format will be different every time, so each
one needs its own captured example.

**What you're doing:** opening a product page, using the "check stock"
feature once yourself, and catching the network request your browser makes
behind the scenes when you do — that request's response is the real
per-store stock data.

### Steps (works the same way in Chrome, Edge, or Firefox)

1. Open a Ray-Ban Meta product page on the retailer's site — e.g. for
   Currys, any of the product URLs found during research, such as
   `https://www.currys.co.uk/products/rayban-meta-wayfarer-glasses-shiny-black-clear-10256712.html`.
   For O2, start from [o2.co.uk/shop/ray-ban-meta/wayfarer](https://www.o2.co.uk/shop/ray-ban-meta/wayfarer)
   and look for the Click & Collect / Stock Checker option on that product
   page. For Argos and John Lewis, any Ray-Ban Meta product page on their
   sites works the same way.
2. Right-click anywhere on the page and choose **Inspect** (or press
   `Cmd+Option+I` on Mac / `F12` on Windows) — this opens DevTools as a
   panel, usually on the right or bottom of the window
3. In DevTools, click the **Network** tab near the top of that panel
4. Look for a filter row (often showing buttons like "All", "Fetch/XHR",
   "JS", "CSS"...) and click **Fetch/XHR** — this hides irrelevant traffic
   (images, styling) and shows only the data requests, which is what we
   want
5. **Leave DevTools open** and go back to the actual page. Find the "check
   stock" / "check in your local store" feature and use it normally —
   type in a real postcode (your own is fine) and submit it
6. Watch the Network panel — a new request (or a few) should appear the
   moment you do this. Look for one with a name that suggests stock/store
   data (things like `availability`, `stock`, `stores`, `inventory` in the
   name are good signs)
7. Click on that request in the list. A detail panel opens with tabs
   (often "Headers", "Preview", "Response") — click **Response** (or
   **Preview**) to see what came back. If it looks like a list of stores
   with stock info, that's the one
8. Right-click that request in the list and look for **Copy** → **Copy as
   cURL** (exact wording varies slightly by browser) — this copies the
   full request as a piece of text you can paste
9. Paste that into a text file and send it back, along with a
   screenshot or copy of what the Response tab showed
10. **If you can, repeat steps 5–9 once more with a different postcode**
    (any second real postcode, far from the first — e.g. one in London and
    one in Scotland). One capture is enough to build something, but two
    shows exactly how the postcode gets passed into the request (a URL
    parameter? Part of the path? Inside the POST body?) — without that,
    building the real fetch script means guessing at the pattern instead
    of reading it directly, which is slower and more error-prone. Not a
    blocker if there's only time for one, just meaningfully more useful
    with two.

That's genuinely all that's needed — from that one captured request, a
proper fetch script can be built that calls the same thing directly,
without needing to repeat these manual steps for every future refresh.

If any of this doesn't match what you see on screen (buttons in different
places, no obvious "stock" request appearing, etc.), that's useful
information too — send a screenshot of whatever you do see and it can be
worked out from there rather than guessed at blind.

### Quick look first: EE and Three (before deciding whether they need this at all)

Before running the full capture above for EE or Three, just steps 1–5:
open a Ray-Ban Meta product page on `ee.co.uk` and on
`accessories.three.co.uk`, and look for anything that resembles a "check
in my local store" / "reserve and collect" widget (not just a generic "in
stock, ships in X days" delivery message — that's online fulfillment
status, a different thing). If you find one, come back and do the full
capture (steps 6–9) the same way as Currys/Argos/John Lewis/O2. If there's
genuinely nothing like that on either site, that's a real, useful finding
on its own — it means neither can offer branch-level data no matter what
script gets built, the same way Very was ruled out for having no physical
stores at all (different reason, same practical outcome for this
database).

## Ireland coverage (added 16 Aug 2026)

Priority raised because of press interest (a technology journalist's first
question was whether the campaign covers Ireland). Scope for the Monday
tester build is deliberately narrow: **Ray-Ban Ireland + Vision Express
Ireland only** — reusing the existing UK parsers, not new retailers, and not
Currys.ie (out of scope until these two are working).

| Retailer | Sells Ray-Ban Meta in Ireland? | Status |
|---|---|---|
| **Ray-Ban Ireland** (`stores.ray-ban.com/ireland`) | ✅ Confirmed | **Fetched and verified 16 Aug 2026: 1 real record — Ray-Ban's own-brand boutique on Grafton Street, Dublin.** Confirmed genuine, not a parser/discovery gap: the real raw HTML's decoded Yext payload declares `document.dm_baseEntityCount = "1"` — the source's own stated total for this directory, matching exactly what the recursive walk found. Same evidence pattern that confirmed the UK's count of 7 (`dm_baseEntityCount = "7"` there). As with the UK, this is Ray-Ban's own-brand boutique locator, not a stockist directory — a small number is expected, not suspicious, since Ray-Ban sells in Ireland mainly through opticians/retailers (Vision Express etc.), not its own shops |
| **Vision Express Ireland** (`visionexpress.ie/opticians/ray-ban-meta`) | ✅ Confirmed (6 Dublin branches directly confirmed; national picture still open) | **NOT YET INGESTED — investigation in progress, do not treat 6 as the national total.** See "Vision Express Ireland: the Dublin-group finding" below for the full resolved writeup |
| **Currys Ireland** (`currys.ie`) | ✅ Confirmed (online + "order & collect") | **Explicitly out of scope for now** per campaign owner's instruction — not investigated further |

### What changed to support Ireland

- `stockists` table gained a `country` column (`UK` \| `IE`) — every public
  query is now scoped by country as well as `verification_status`, so a UK
  search can never surface an Ireland branch or vice versa. See
  `worker/schema.sql` and `worker/migrate-add-country.sql` (only needed if a
  D1 database was already created before this change).
- `2-normalize-and-geocode.mjs` gained `--country=UK|IE`. The UK path is
  unchanged. The Ireland path deliberately does **not** validate/geocode
  Eircodes (see below) — it uses a source's own coordinates when available
  (e.g. Ray-Ban's Yext platform), and otherwise falls back to a town-level
  centroid coordinate (see `IRELAND_TOWN_COORDS` in `worker/src/geocode.js`),
  clearly flagged as such in the record's `notes` field. A record with
  neither is skipped, not invented.
- The finder's search box now accepts a UK postcode OR an Ireland town/city
  name in the same field — `geocodeQuery()` in `worker/src/geocode.js`
  detects which one it's looking at. **Exact Eircode search is explicitly
  not supported yet** (a real, common-shaped input, so it gets a specific
  "we can't search by Eircode yet, try your town/city" message rather than a
  generic "not recognised" error) — this was a deliberate scope decision,
  not an oversight: free Eircode-capable geocoders (Nominatim/OSM) were
  found to have unreliable coverage, and this campaign's principle is
  "verified or don't show it," not "best guess."

## Vision Express Ireland: the Dublin-group finding (16 Aug 2026) — NOT YET INGESTED

**Key technical fact — must not be lost or re-summarised loosely in future
edits: the 6-record result from `visionexpress.ie/opticians/ray-ban-meta`
is generated by the GraphQL query `stores({"groupName":"Dublin"})`, found by
decoding the page's own `__NEXT_DATA__` / Apollo cache.** This is a generic,
reusable store-locator widget (Next.js template `/templates/store-group`,
same component reused elsewhere on the site) hardcoded to the group named
"Dublin" — not a query for "Ray-Ban Meta stockists." Confirmed two more
ways: the page's own on-screen heading is rendered from a template string
`"stores.page.group.storeFinder.title":"Choose your store in {groupName}"`,
literally shown as "Choose your store in Dublin"; and the page's own URL
query params (`data.query` in `__NEXT_DATA__`) were empty — no location,
postcode, or geolocation cookie was involved, so this is what any visitor
gets from that exact URL, not a personalised result.

**Conclusion: 6 is NOT Vision Express Ireland's national Ray-Ban Meta
stockist total, and must never be recorded as one anywhere in this
project.** It's the Dublin group specifically. Independent web search
corroborates this — found real evidence (search-result summaries, not yet
first-party-verified at this project's normal evidence bar) that Vision
Express Cork (Douglas Court) and Galway (William Street) also carry Ray-Ban
Meta, neither of which appears in the Dublin-6.

**Status: investigation in progress, ingestion deliberately paused.** Next
steps agreed with the campaign owner (16 Aug 2026):
1. Fetch the Cork and Galway branch pages directly, to move them from
   "search-result-summary evidence" to this project's normal first-party
   standard (or find they don't actually confirm it, and hold at
   `candidate`/excluded instead — not decided in advance).
2. Fetch `visionexpress.ie/store-overview`, believed to be the general
   Ireland store directory, to find every group/branch that exists — not
   just the three (Dublin, Cork, Galway) known about so far — and check
   whether Vision Express Ireland has any single source that states a real
   national Ray-Ban Meta stockist total.
3. Only branches with genuine first-party Meta evidence (the retailer's own
   page saying so) get `verified_branch`. A branch existing is not evidence
   it stocks Ray-Ban Meta — per this project's core verification principle,
   same standard as everywhere else in this database.

`scripts/ingest/2-investigate-vision-express-ireland-structure.mjs` fetches
all three URLs above and decodes each one's `__NEXT_DATA__`/Apollo state the
same way this finding was reached, printing a summary — same "run locally,
send back the output" pattern as every other fetch script in this project;
untested against the live site for the usual network-sandbox reason.
