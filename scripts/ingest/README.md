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

Even with the flag, a record only reaches `verified_branch` if it also has
branch-specific Meta evidence (`metaEvidenceText` in the input). A record
from a genuine first-party source that only proves "this chain sells Ray-Ban
Meta somewhere" — not this specific branch — is capped at
`authorised_chain`, and `authorised_chain` rows are never returned by the
public `/api/stockists` endpoint. See the `verification_status` comment in
`../../worker/schema.sql` for the full model.

`--mock-geocoder` swaps the real postcodes.io call for a small fixed lookup
table (see `../../worker/src/geocode.js`) — needed for testing in a
network-restricted environment, never used in production.

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

So: **all 440 real Vision Express branches are correctly sitting in D1 as
`authorised_chain`, not `verified_branch`** (real geocoded addresses, real
contact info, ready to upgrade — just not shown to supporters yet). This
isn't a failure of the pipeline; the pipeline did exactly what it should.
It's an open problem: **where would genuine branch-level Ray-Ban Meta
evidence for Vision Express actually come from?** Untried ideas, in
roughly ascending effort:

- An individual branch's own page (e.g. `visionexpress.com/opticians/aberdeen/aberdeen`,
  linked from each store-list entry) might show product availability that
  the aggregate locator view doesn't — untested.
- A "book a Ray-Ban Meta demo" flow, if one exists separately from the
  general appointment booker, might only offer branches that actually have
  demo units — the kind of dynamic stock-checker the master brief
  anticipated as a later-phase signal, not something to force into Phase 1.
- Contacting Vision Express directly (their press/corporate line, not a
  scrape) and asking for the actual "selected stores" list.

None of these have been investigated — flagging them rather than guessing.

## Next Phase 1 sources

Per the master brief: David Clulow next, then Ray-Ban's own store locator
and Boots Opticians. Worth checking early, before investing in the same
targeted-parser effort, whether each source actually distinguishes
Ray-Ban-Meta-carrying branches from its general store list the way Vision
Express's turned out not to — David Clulow's ~30-store national footprint
(versus Vision Express's 440) at least raises the possibility its Ray-Ban
Meta page is a genuinely curated subset rather than a generic locator, but
that needs verifying the same way, not assuming. Phase 2 (Currys, Argos,
EE, InMotion, John Lewis, O2, Three, Very) is chain-level
(`authorised_chain`) evidence only until someone finds a branch-level
signal for each — don't upgrade those to `verified_branch` without one.
