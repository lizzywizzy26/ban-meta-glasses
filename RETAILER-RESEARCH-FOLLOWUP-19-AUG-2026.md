# Retailer research — 19 Aug 2026 follow-up

Actioning the campaign owner's 8-point "RETAILER RESEARCH — NEXT ACTIONS"
instruction. Research/documentation only. **No change to the committed
database, the live site, the homepage, About page, finder, or any public
number.** Committed total remains **518 verified_branch**.

## 0. Correction to the earlier same-day report

`RETAILER-EXPANSION-19-AUG-2026.md` (this morning's WebSearch-only pass)
reported Boots as "0 branches added... doesn't cleanly fit
`verified_branch`." That was wrong, not because the WebSearch findings
were false, but because it missed that **Boots was already fully resolved
the day before** — see `RETAILER-MATRIX.md`, "Boots Opticians" section,
17 Aug 2026. On 17 Aug the campaign owner supplied a saved copy of Boots'
own "Smart Eyewear Stores List" page (structured, per-store Y/blank flags
for Ray-Ban Meta), and it was parsed into **204 QA'd candidate branches**
via `scripts/ingest/1-fetch-boots.mjs` — already committed to this repo
(commits `4c463f6`, `11fa217`, `7668d3d`, `c88205e`). Re-ran that script
today; it reproduces exactly 204 records, unchanged. This is a correction
to my own earlier report, not new information from the campaign owner.

## 1. Existing 518 verified_branch records

**Unchanged. Nothing touched.**

## 2. `first_party_aggregate` classification

Defined in `worker/schema.sql` (see comment block under
`verification_method`):

> A retailer or manufacturer explicitly states, in a first-party source,
> the number of physical stores carrying the relevant camera-equipped
> smart-glasses product, but the individual locations have not yet been
> identified.

Recorded only as prose (never as rows in the `stockists` table, since it
can't be geocoded or mapped), in the format:

```
Retailer | Country | Product | claimed store count | first_party_aggregate | exact source quote | date checked
```

**Does this apply to Boots?** No, not any more. Boots' 201-store
press-release figure was exactly this kind of aggregate claim when found
on 15/19 Aug — but it's since been superseded by the real, named,
per-branch 204-store list above, which is stronger evidence
(`first_party_structured_brand_list`, per-branch not chain-level). Boots
should not carry a `first_party_aggregate` entry once the 204 are geocoded
and approved — that would double-count the same underlying stores under a
weaker evidence tier.

**Verbatim source wording:** I don't have it. Every existing reference to
"201 stores" in this repo (mine included) is a paraphrase built from
WebSearch summaries and trade-press coverage, not a direct quote captured
from `boots-uk.com/newsroom` itself — this sandbox cannot reach that
domain to check the original wording ("available in," "stocked in,"
"launched in" vs "sold in" all read as plausible but I can't confirm
which). Given Boots is now resolved via the stronger structured-list
source, I'd recommend not spending further effort chasing this specific
quote unless you want it archived for its own sake — the aggregate claim
is no longer load-bearing for anything.

**Does any other retailer currently need this classification?** No.
Checked EE, O2, Three, Sunglass Hut against `RETAILER-MATRIX.md` — none
of them has a first-party statement of a specific store count; they're
chain-level "sells the product" confirmations only. The classification is
built and ready, but has zero populated entries today.

## 3. MAPPED vs FOOTPRINT — the two numbers

- **MAPPED STOCKISTS** — individually named, geocoded, live in the finder:
  **518**. Unchanged today.
- **EVIDENCED PHYSICAL RETAIL FOOTPRINT** — mapped + non-overlapping
  first-party aggregate claims: **518 + 0 = 518** today, because no
  aggregate-tier claim currently qualifies (see §2).

**A third bucket that doesn't fit either label cleanly: Boots' 204.**
These are not aggregate (they're individually named, addressed, QA'd
branches) and not yet mapped (they don't have real coordinates — the
production geocoder, `postcodes.io`, is one of the domains this sandbox
cannot reach, same restriction as every retailer site). They're evidenced
and QA-complete, blocked on one mechanical step that has to run on a
machine with real network access, then your approval. If you run
`node scripts/ingest/2-normalize-and-geocode.mjs output/boots.json --chain-id=boots-opticians --chain-name="Boots Opticians" --category=optician --country=UK --source-is-structured-brand-list --assume-first-party --corroboration-note="..."` (no `--mock-geocoder`) and send back the output, mapped stockists becomes a **518 → 722** decision for your approval, not new research.

## 4. Boots/existing-4 overlap check

Already done as part of the 17 Aug QA (see `RETAILER-MATRIX.md`, final
bullet of the Boots section): checked all 204 Boots postcodes against the
existing 534-record database (postcode match, not name match, per
standing instruction). **21 of 204 share a postcode** with an existing
Vision Express or David Clulow record — zero overlap with Ray-Ban or John
Lewis. Boots is a separate, competing optical chain from both Vision
Express and David Clulow, so a shared postcode most plausibly means
"different unit, same shopping centre/postcode" (common for UK shopping
centres, several optician chains sharing one postcode), not the same
physical shop double-counted. Recommendation carried over unchanged:
**keep all 21 as distinct branches**, not excluded — this is a judgement
call worth your explicit sign-off before the 204 go live, not something
I'll finalize unilaterally.

## 5. David Clulow re-ingest readiness

`scripts/ingest/1-fetch-david-clulow.mjs` is unchanged, live-fetch-ready
(`SOURCE_URL = davidclulow.com/stores/ray-ban-meta`), same methodology as
the existing 44 committed branches
(`first_party_product_specific_directory`). Not run today — no live
network access in this sandbox, same restriction as everything else.
**Documented unverified leads, not yet ingested or ruled out:**
- Selfridges (4 concessions) — David Clulow's own correctly-scoped
  "Ray-Ban Meta" group does not currently list any Selfridges location,
  but absence from one first-party list isn't proof of absence at the
  physical concession (see `RETAILER-MATRIX.md`, 16 Aug section, for the
  full reasoning — this is a settled distinction, not new).
- House of Fraser, Fenwick, De Gruchy, Brown Thomas (Ireland) —
  referenced on David Clulow's own "About Us" page as concession hosts,
  never checked against the product-specific directory.
Recommended action once network access exists: re-run the script against
the live directory first (cheapest, same method as the existing 44), then
check each of the 5 named leads individually against whatever the
refreshed list contains.

## 6 & 7. Browser-capture readiness — Currys, Argos, Boots

**Boots needs no capture.** The dynamic-locator capture procedure drafted
17 Aug (`RETAILER-MATRIX.md`) was never used — you found a better
first-party source (the structured Smart Eyewear Stores List) the same
day, which is how the 204 branches above exist. Boots' physical-branch
question is fully resolved; nothing further to investigate here.

**Currys and Argos still need a capture.** Both have a confirmed,
genuine postcode-based stock checker (verified via product pages and
third-party scraper ecosystems), but the underlying data only appears
after a live interaction — a plain fetch script can't see it, so this
needs one real browser session per retailer. This is exactly the
"one endpoint, then script it forever" pattern that already worked for
John Lewis.

### The plan — Currys and Argos, step by step

1. Open a Ray-Ban Meta product page — Currys:
   `currys.co.uk/products/rayban-meta-wayfarer-glasses-shiny-black-clear-10256712.html`;
   Argos: any Ray-Ban Meta product page on argos.co.uk.
2. Right-click the page → **Inspect** (or `F12` on Windows, `Cmd+Option+I`
   on Mac). A panel opens.
3. Click the **Network** tab in that panel, then click the **Fetch/XHR**
   filter button.
4. Leaving that panel open, go back to the page and use its "check stock"
   / "check in store" feature normally — enter a real postcode, submit.
5. A new item should appear in the Network panel with a name like
   `availability`, `stock`, `stores`, or `inventory`. Click it, then click
   its **Response** (or **Preview**) tab — you should see a list of stores.
6. Right-click that same item → **Copy** → **Copy as cURL**, paste into a
   text file.
7. Send that text file plus a screenshot of the Response tab. Repeat once
   with a second postcode (anywhere far from the first) if you have time
   — one is enough to start from, two removes all guesswork about how the
   postcode is passed into the request.

That's the whole plan — one captured request per retailer is enough to
build a script that pulls the full current list without repeating any of
this by hand again.

## Report, in the requested format

```
Mapped verified stockists: 518
Additional first-party aggregate physical locations: 0
Combined evidenced physical footprint before deduplication: 518
Known overlap/uncertainty: 21 of Boots' 204 QA'd candidate branches share a postcode with existing Vision Express/David Clulow records — assessed as distinct units (shared shopping-centre postcode), not duplicates; awaiting your sign-off
Retailers still requiring browser capture: Currys, Argos (O2 also queued, same method, lower priority than these two)
```

**Not counted above, awaiting your decision, not mine:** Boots' 204
QA-complete candidate branches — real per-branch evidence, zero further
research needed, blocked only on real geocoding (needs to run outside
this sandbox) and your approval to promote to `verified_branch`. If
approved and geocoded, mapped stockists moves to 722.
