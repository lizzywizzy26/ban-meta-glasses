# Stockist database expansion research — 19 Aug 2026

Research-only pass. No changes made to the committed database
(`data/stockists/*.normalized.json`), the live site, or any public claim.
Current committed total remains **518 verified_branch** across 4 retailers
(Vision Express UK 438, David Clulow UK 44, John Lewis UK 21, Ray-Ban UK 6,
Vision Express IE 8, Ray-Ban IE 1).

## Environment constraint (read this before repeating this research)

This research pass ran with WebSearch as the only real tool. Direct `curl`
and WebFetch to every retailer domain tested (davidclulow.com, boots.com,
currys.co.uk, visionexpress.com) returned connection failures — this
sandbox has no live network access to retailer sites. WebSearch returns
third-party summaries and static snippets only; it cannot execute a store
locator, a postcode-based stock-checker, or any JS-driven tool. Every
dynamic-checker retailer below (Currys, Argos, and likely Boots' own
booking tool) needs an actual human browser session with DevTools to
capture — the same requirement documented in `RETAILER-MATRIX.md` since
15 Aug, still unresolved.

## Findings

### Boots Opticians (UK)
- Sells Ray-Ban Meta (6 styles) — confirmed via Boots' own press release
  (boots-uk.com/newsroom) and product pages.
- Press release states **201 stores** carry Ray-Ban Meta nationally, with
  a further 42-store subset also carrying Nuance Audio (a hearing-aid
  product — out of campaign scope, not camera-equipped).
- No named list of the 201 stores found. No store-locator or "find in
  store" filter tool identified via WebSearch.
- **0 branches added.** Doesn't cleanly fit `verified_branch` (can't name/
  geocode individual stores) or the existing shape of `authorised_chain`
  (which has so far always been tied to an identifiable branch). Flagged
  to campaign owner as a methodology question — see report sent 19 Aug.
- Next step: check whether bootsopticians.com's appointment-booking tool
  names participating branches when you search a postcode — needs a real
  browser session.

### EE (UK)
- Sells Ray-Ban Meta online (ee.co.uk/wearables/eyewear).
- No first-party physical-store stock mechanism found. Same ambiguity as
  the 15 Aug finding: EE's own language reads as online/delivery
  fulfilment, not a per-branch check.
- **0 branches added.** Flagged as "national/online sale confirmed,
  branch-level availability cannot be responsibly established" per the
  campaign owner's own instruction for this exact case.

### Currys (UK/IE)
- Sells Ray-Ban Meta Wayfarer Gen 1/2 — first-party product pages confirm
  a genuine store-level availability checker and click-and-collect flow
  ("collect within an hour").
- Same mechanism identified 15 Aug — still not captured; needs live
  DevTools.
- **0 branches added.**

### Argos (UK)
- Same pattern as Currys — a "check stock" delivery/collection tool tied
  to physical stores, confirmed to exist via product pages, not captured.
- **0 branches added.**

### O2 (UK)
- Sells Ray-Ban Meta online (o2.co.uk/shop/ray-ban-meta) with Pay Monthly
  financing. No physical-store confirmation found.
- **0 branches added.** Same "online confirmed, branch unconfirmed" flag.

### Three (UK)
- No change from the existing finding: chain-level online storefront only
  (accessories.three.co.uk), correctly already on the national-retailer
  target list, not branch-eligible.

### Sunglass Hut (UK)
- Confirmed sells Ray-Ban Meta; no store count or locator found via
  search. Akamai bot-blocking (documented 15 Aug) still presumed to apply
  to any scripted fetch attempt.

### David Clulow (UK) — real lead for follow-up
- `davidclulow.com/stores/london/london-selfridges` now exists as an
  individually-named branch page — not present in the current 44-branch
  committed dataset (the 16 Aug audit specifically found no Selfridges
  location in that dataset).
- David Clulow's own "About Us" page also references concessions at House
  of Fraser, Fenwick, De Gruchy, and Brown Thomas (Ireland).
- **Cheapest legitimate path to new verified branches**: same domain,
  same `first_party_product_specific_directory` methodology already used
  for the existing 44 — just needs the existing ingest script re-run
  against the live `/stores/ray-ban-meta` directory to see if the list has
  grown. Not run today (no network access). Recommended first action for
  the next research session. Likely single digits to low tens of
  branches, not a large jump.

### Ireland
- No new stockists found beyond the existing Vision Express Ireland (8)
  and Ray-Ban Dublin Grafton Street (1) already committed.

## The 1,000+ question

Not defensible today, and not from more WebSearch. Every plausible path to
a materially larger number (Boots' 201, a share of Currys' and Argos'
store networks) sits behind dynamic tools this environment cannot operate.
A rough, heavily-caveated *estimate* — explicitly not a target, not
evidence, not to be repeated as a claim — put the realistic combined
ceiling if those were fully captured somewhere in the 750–950 range,
not confidently over 1,000.

**What would actually move this forward:** live DevTools capture sessions
against Currys, Argos, and Boots' booking/locator tools, run by a human on
a real browser — the same one-time-capture process that already worked
for John Lewis and Ray-Ban earlier in this project.
