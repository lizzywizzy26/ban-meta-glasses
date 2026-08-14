# Stockist data ingestion pipeline

How verified sellers get into the postcode finder's database. Three steps,
each a separate script, each independently testable — see
`fixtures/vision-express-sample.json` for a worked example you can run
right now without needing real data.

```
1-fetch-vision-express.mjs        RETRIEVE   (must be run somewhere with normal internet access — see below)
2-normalize-and-geocode.mjs       EXTRACT → NORMALISE → VALIDATE → ASSIGN VERIFICATION → GEOCODE
3-generate-sql.mjs                UPSERT (as generated SQL) + REFRESH REPORT
```

## Why this exists as scripts a human runs, not something automatic

This project's Worker calls `postcodes.io` live, in production, on
Cloudflare's network — that's normal and unrestricted. But *building* the
initial dataset means fetching pages like Vision Express's Ray-Ban Meta
directory, and the environment this pipeline was built in sits behind a
strict network egress allowlist that blocks general web fetches entirely
(confirmed by testing — every one of Vision Express, David Clulow,
Ray-Ban's store locator, and even postcodes.io itself came back
`EGRESS_BLOCKED`). That's a constraint of *that build environment*, not of
the architecture — nothing about the finder's design depends on it. It just
means step 1 needs to be run by a human (or a differently-configured CI job)
with normal internet access, not by an AI session with restricted egress.

## Step 1 — fetch

```
node scripts/ingest/1-fetch-vision-express.mjs
```

No arguments. Fetches the Vision Express Ray-Ban Meta directory page and
writes `output/vision-express.json` (best-effort extracted records) plus
`output/vision-express.raw.html` (the full page, so nothing is lost if the
extraction heuristics miss the real data — see the script's own comments
for what to do if the page turns out to be JavaScript-rendered).

## Step 2 — normalize, validate, assign verification, geocode

```
node scripts/ingest/2-normalize-and-geocode.mjs <input.json> \
  --chain-id=vision-express --chain-name="Vision Express" --category=optician \
  [--assume-first-party] [--mock-geocoder]
```

**`--assume-first-party` is the safety gate.** Without it, every record is
forced to `verification_status = 'candidate'`, no matter what the input
says — so a test run (or a run against data you're not sure about) can
never accidentally produce something that looks publicly verified. Pass it
only once you've confirmed the input actually came from a real fetch of the
named retailer's own official page.

Even with the flag, a record only reaches `verified_branch` by default if
it also has branch-specific Meta evidence (`metaEvidenceText` in the
input). A record from a genuine first-party source that only proves "this
chain sells Ray-Ban Meta somewhere" — not this specific branch — is capped
at `authorised_chain`, and `authorised_chain` rows are never returned by
the public `/api/stockists` endpoint. See the `verification_status`
comment in `../../worker/schema.sql` for the full model.

**`--directory-is-product-specific`** is a separate, explicit override for
one documented case (see the Vision Express decision below): when set
(requires `--assume-first-party` too), every record in the run is marked
`verified_branch` with `verification_method =
first_party_product_specific_directory`, regardless of per-record
`metaEvidenceText`. This is a deliberate human judgment call about the
*directory itself* — "this retailer presents this whole page as its
dedicated Ray-Ban Meta store finder" — not a per-branch fact, and it must
be invoked explicitly each time, never assumed as a default for a new
source. Pair it with `--corroboration-note="..."` to record supporting
evidence (e.g. phone spot-checks) directly in every affected record's
`notes` field, so the reasoning lives in the data, not just in a
conversation.

`--mock-geocoder` swaps the real postcodes.io call for a small fixed lookup
table (see `../../worker/src/geocode.js`) — needed for testing in a
network-restricted environment. **Never use it for a real dataset** — every
record geocoded this way gets a fake, mostly-shared fallback coordinate,
which would make distance-based search meaningless in production. Any run
whose output is meant to actually go live needs real network access to
postcodes.io (i.e. run by a human, not from a restricted sandbox).

Try it now against the test fixture (safe — produces `candidate` records
only, since `--assume-first-party` is deliberately omitted here):

```
node 2-normalize-and-geocode.mjs fixtures/vision-express-sample.json \
  --chain-id=vision-express --chain-name="Vision Express" --category=optician --mock-geocoder
```

## Step 3 — generate SQL + refresh report

```
node scripts/ingest/3-generate-sql.mjs <normalized.json> [--previous=<earlier-normalized.json>]
```

Writes `output/<chain-id>.upsert.sql` — safe to run against D1 (`INSERT ...
ON CONFLICT DO UPDATE`, never a blind overwrite). If `--previous` points at
an earlier run's output, records that vanished from the new source get
flagged and marked `inactive` in the generated SQL — **never deleted** —
so a scraper hiccup can't silently erase real data, and there's always a
paper trail a human can review.

Apply the result:

```
npx wrangler d1 execute stop-meta-glasses-db --local --file=output/vision-express.upsert.sql   # test locally first
npx wrangler d1 execute stop-meta-glasses-db --remote --file=output/vision-express.upsert.sql  # then the real database
```

## Proof this actually works

The full chain — parse → normalize → geocode → SQL → real local D1 (via
`wrangler d1 execute --local`) → the real Worker code (via `wrangler dev
--local`) → a real browser hitting the real `/api/stockists` endpoint and
rendering result cards — has been run end-to-end twice: once against the
synthetic test fixture (proves the mechanics), and once against a real
saved copy of Vision Express's page with 440 real branches (proves it at
real scale). Both runs correctly exclude everything that isn't
`verified_branch` from public results — including, in the real run, all
440 real branches at once, none of which incorrectly reached
`verified_branch`. See the finding below for why.

## What we learned from the first real Vision Express fetch (14 Aug 2026)

The page (`visionexpress.com/opticians/ray-ban-meta`) genuinely has a
well-structured 440-branch store list — real addresses, postcodes, phone
numbers, per-branch page URLs. But it's Vision Express's **generic** store
locator widget, reused on the Ray-Ban Meta landing page. The page's own
copy says Ray-Ban Meta is available "in **selected** Vision Express
stores," but every one of the 440 entries carries the exact same set of
feature tags (only "Wheelchair accessible" ever appears anywhere in the
440) — there is no per-branch signal distinguishing the "selected" subset
from the rest. Importing this data any other way than `authorised_chain`
would mean publicly claiming specific named shops sell something we have
no branch-level evidence for, which is exactly what the verification model
exists to prevent.

At the time, this meant: **all 440 real Vision Express branches sat in D1
as `authorised_chain`, not `verified_branch`.** That data-structure finding
is still accurate — there is no per-branch tag distinguishing "selected"
stores in the locator's own markup. What changed is the interpretation of
what counts as sufficient evidence — see the decision below.

## Decision: Vision Express's 440 branches upgraded to verified_branch (14 Aug 2026)

The campaign owner reviewed the finding above and decided the directory's
own framing — Vision Express explicitly presents this page as its Ray-Ban
Meta store finder, returning 440 selected-store results — counts as
sufficient first-party evidence on its own, treating the "selected stores"
language as describing the 440 results themselves rather than an
unidentified smaller subset within them. This was checked against one
piece of independently verifiable context before proceeding: Vision
Express's total UK store count is roughly 500-533 (third-party count) to
"over 550" (their own site, likely including Ireland) — meaningfully more
than 440, so this directory is not simply "every store nationally,
regardless of product" (which would have been a direct contradiction).
That doesn't independently prove the exclusion criterion is specifically
Ray-Ban Meta stock, but it doesn't contradict the reading either. Combined
with phone spot-checks confirming physical stock at sampled locations
(including a Vision Express inside a Tesco in Northern Ireland, confirmed
to hold multiple models and an in-store demo pair), the campaign owner
judged this sufficient and made the call.

This introduced a new verification method,
`first_party_product_specific_directory` (see `../../worker/schema.sql`
and the `--directory-is-product-specific` flag documented above), reserved
specifically for this kind of directory-level judgment call — distinct
from `first_party_stockist_directory`, which requires actual per-record
evidence. All 440 records now carry `verification_method =
'first_party_product_specific_directory'`, source URL + verification date
as provenance, and a `notes` field recording both the directory-level
reasoning and the corroborating phone-check evidence — so anyone asking
"why does this site say this shop sells Meta Ray-Bans" gets a real,
specific answer, not just "trust us."

**Before this goes to production: re-run step 2 without `--mock-geocoder`.**
The 440 records currently sitting in local D1 (proven end-to-end against
the real Worker code) were geocoded using the mock lookup table, since this
build environment can't reach postcodes.io — meaning their stored
coordinates are fake placeholders, not real branch locations. Real
geocoding requires a human running the pipeline with normal network
access, exactly like the fetch step. Applying the current mock-geocoded SQL
to the real production database would make every branch's proximity search
meaningless.

If the same "directory-is-product-specific" reasoning turns out not to
apply to a future source (David Clulow, Ray-Ban, Boots), it needs its own
explicit human decision each time, on its own facts — not inherited from
this one. The still-open leads below remain open for cases where a real
per-branch signal is worth finding, independent of this decision:

- An individual branch's own page (e.g. `visionexpress.com/opticians/aberdeen/aberdeen`,
  linked from each store-list entry) might show product availability that
  the aggregate locator view doesn't — untested.
- A "book a Ray-Ban Meta demo" flow, if one exists separately from the
  general appointment booker, might only offer branches that actually have
  demo units — the kind of dynamic stock-checker the master brief
  anticipated as a later-phase signal, not something to force into Phase 1.
- Contacting Vision Express directly (their press/corporate line, not a
  scrape) and asking for the actual "selected stores" list.

These are being actively worked, not just flagged — see the four
workstreams below.

## Four active workstreams (as of 14 Aug 2026)

**1. David Clulow** — `1-fetch-david-clulow.mjs` targets
`davidclulow.com/stores/ray-ban-meta`. Unlike the Vision Express script,
this one does NOT have a targeted parser yet (its page structure hasn't
been seen) — it uses the same generic multi-strategy extraction Vision
Express started with. Run it, send back both output files, and a targeted
parser gets built from the real structure the same way it was for Vision
Express. David Clulow's much smaller UK footprint (~30 stores vs Vision
Express's 440) and its "Stockists near me" page title are reasons to be
*hopeful* this list is a genuinely curated Ray-Ban Meta subset rather than
a reused generic locator — but that's a hypothesis to check the same
rigorous way (real per-branch feature tags? does the page's own copy claim
"selected stores" the way Vision Express's did?), not something to assume
just because the URL sounds more specific.

**2. Vision Express branch-page / booking-flow signal** —
`2-investigate-branch-page-signal.mjs` fetches a small spread of 5 real
individual branch pages (not all 440 — this is a yes/no investigation) and
checks each for Ray-Ban Meta mentions and any nearby availability language.
Already ruled out one lead from the main locator page's own markup: a
`storeId`-specific booking link existed, but turned out to be for "video
contact lens check up" in the main nav — unrelated to Ray-Ban Meta,
confirmed by checking its context rather than assuming.

**3. Contact Vision Express directly** — see `../outreach/vision-express-data-request.md`
for a draft message and their verified press contact (`PR@visionexpress.com`,
a role inbox, not a named individual). Could unlock the real "selected
stores" list — the phrase is straight from their own marketing copy —
faster than any amount of further scraping. Not something I can send
myself; it's a real-world outreach action for a human.

**4. Ray-Ban's own store locator + Boots Opticians** — next in line per the
master brief once the above resolve, same rigor applies (branch-level
signal required, not just chain presence).

Phase 2 (Currys, Argos, EE, InMotion, John Lewis, O2, Three, Very) stays
`authorised_chain`-only evidence until someone finds a branch-level signal
for each — don't upgrade those to `verified_branch` without one.
