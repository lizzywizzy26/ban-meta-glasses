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
| **David Clulow** | ✅ Confirmed | Directory-level only, no per-branch tag; mixed evidence on whether directory itself counts | Static (done) | — | 40 branches committed as `authorised_chain`, pending campaign owner's phone corroboration |
| **Ray-Ban (own store locator)** | ✅ Confirmed (it's their product) | Unknown — haven't seen real page structure yet | Unknown | High | Fetch script ready (`1-fetch-rayban.mjs`), generic first-pass extraction. Owned by EssilorLuxottica (same group as Vision Express) but locator platform not confirmed to be the same one |
| **Sunglass Hut UK** | ✅ Confirmed (dedicated product page exists) | Unknown — haven't seen real page structure yet | Unknown | High | Fetch script ready (`1-fetch-sunglasshut.mjs`). ~35–46 UK stores per third-party listings (not yet independently confirmed) |
| **Currys** | ✅ Confirmed (multiple product listings, Gen 1 + Gen 2) | Yes — per-product "check stock near you" tool, real per-store results | **Dynamic (needs DevTools)** | High | No official public API; an entire third-party scraper ecosystem exists around this (confirms it's real and reverse-engineerable, but not officially documented) |
| **Argos** | ✅ Confirmed (multiple product listings) | Yes — per-product postcode stock checker, arguably the most mature version of this pattern in UK retail | **Dynamic (needs DevTools)** | High | Same as Currys: no official public API, but a large third-party scraper ecosystem (Apify, GitHub projects, paid stock-checker APIs) confirms the underlying live per-store data is real and accessible |
| **John Lewis** | ✅ Confirmed (29 models listed) | Yes — "check in-store stock" shows a list of shops with the product, and Click & Collect is explicitly "at selected shops" (not all) | **Dynamic (needs DevTools)** | High | The "selected shops" phrasing is a good sign — same kind of signal that helped the Vision Express decision, but here it's tied to a live stock feature, not just marketing copy |
| **EE** | ✅ Confirmed (sells online with EE ID, dedicated Ray-Ban Meta page) | Not established — searches didn't surface in-store-specific stock info | Unknown | Medium | EE has 550+ UK stores; whether physical branches stock/demo units (vs. online-order-only) is genuinely unclear and needs direct investigation |
| **O2** | ✅ Confirmed (dedicated shop pages, Pay Monthly option) | Not established | Unknown | Medium | Same open question as EE — online sales confirmed, in-store stock unconfirmed either way |
| **Three** | ✅ Confirmed (dedicated `accessories.three.co.uk/collections/ray-ban-meta` page) | Not established | Unknown | Medium | Newly confirmed today — wasn't clear from the original brief whether Three currently sells Ray-Ban Meta at all; now confirmed they do online, in-store unconfirmed |
| **Vodafone** | ❌ Not confirmed | N/A | N/A | Low (as flagged in the original brief) | No evidence found today either — searches turned up nothing indicating Vodafone sells Ray-Ban Meta in the UK. Matches the brief's original caution exactly. Needs genuinely new evidence before adding at all, at any verification level |
| **InMotion** | ❌ Not confirmed | N/A | N/A | Low | No evidence found that InMotion's airport stores currently stock Ray-Ban Meta |
| **Very** | ❌ Not confirmed, and structurally moot | N/A — Very has no physical stores at all (online/catalogue retailer) | N/A | Low | Even if confirmed to sell online, Very can never be a local/branch result — same "national retailer" bucket as Amazon, not worth further branch-level investigation |
| **Amazon UK** | ✅ (already established) | N/A by design | N/A | — | Per the campaign owner's explicit instruction: stays a national retailer/action target, not a local postcode result, since there's no meaningful UK physical-store case |

## What this means for next steps

**Two different technical problems, not one:**

1. **Static-HTML sources (Ray-Ban, Sunglass Hut):** same playbook as Vision
   Express/David Clulow. Run the fetch script, send back both output
   files, a targeted parser gets built from whatever real structure shows
   up, and the same "does the directory show branch-level Meta evidence or
   is it generic" question gets asked before any verification decision.

2. **Dynamic stock-checkers (Currys, Argos, John Lewis):** fundamentally
   different problem. The branch-level data isn't in the page's initial
   HTML at all — it loads via a JavaScript call after you interact with a
   "check stock" widget. A fetch script can't capture this the way it did
   for the static directory pages. This needs a human to open the page in
   a real browser, use the stock checker once by hand, and capture the
   underlying network request via DevTools — see the step-by-step guide
   below. This is genuinely the strongest possible evidence tier (a live
   "does store X have product Y in stock right now" check), so it's worth
   the extra effort, but it's a different kind of task than downloading a
   ZIP and running a script.

**Recommended order:** Ray-Ban and Sunglass Hut first (fast, same pattern
as before, can run alongside anything else), then pick one of
Currys/Argos/John Lewis for the DevTools investigation — Currys is
suggested first since it most directly demonstrates the "your nearest
seller might not be an optician" point the campaign proposition is built
around.

---

## DevTools guide: capturing a dynamic stock-checker (Currys, Argos, John Lewis)

This only needs to be done once per retailer to find the pattern — after
that, a script can call the same request directly, no more manual steps
needed each time.

**What you're doing:** opening a product page, using the "check stock"
feature once yourself, and catching the network request your browser makes
behind the scenes when you do — that request's response is the real
per-store stock data.

### Steps (works the same way in Chrome, Edge, or Firefox)

1. Open a Ray-Ban Meta product page on the retailer's site — e.g. for
   Currys, any of the product URLs found during research, such as
   `https://www.currys.co.uk/products/rayban-meta-wayfarer-glasses-shiny-black-clear-10256712.html`
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

That's genuinely all that's needed — from that one captured request, a
proper fetch script can be built that calls the same thing directly,
without needing to repeat these manual steps for every future refresh.

If any of this doesn't match what you see on screen (buttons in different
places, no obvious "stock" request appearing, etc.), that's useful
information too — send a screenshot of whatever you do see and it can be
worked out from there rather than guessed at blind.
