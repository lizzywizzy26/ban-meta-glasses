# Fixtures

Two kinds of file live here, not to be confused with each other:

- **Synthetic test fixtures** (`*-sample.json`, `ireland-sample.json`) —
  invented data, clearly marked `[TEST FIXTURE]` in every record, used to
  exercise the ingestion pipeline's mechanics without needing real data.
  Never a source of truth about any retailer.

- **Real raw captures** (everything else here) — actual saved pages from
  retailer websites, preserved because they materially underpin a
  verification decision recorded in `data/stockists/RETAILER-MATRIX.md` or
  a committed dataset. Kept so those decisions are independently checkable
  from the repo alone, not just from this project's chat history. Not
  every page ever fetched during investigation is kept here — only ones
  whose findings mattered (see the file-by-file list below); pages that
  were dead ends (e.g. a candidate URL that turned out to have no useful
  data) aren't preserved, since the outcome is already recorded in
  `RETAILER-MATRIX.md`'s narrative.

## What each real capture underpins

- `rayban-uk-directory.raw.html` — Ray-Ban's UK store directory. Source of
  the confirmed `dm_baseEntityCount = "7"` finding (the UK Ray-Ban dataset
  is genuinely complete, not a parser gap).
- `rayban-uk-branch-signal-investigation.json` — the real per-store
  content-block check behind the "6 verified_branch, 1 authorised_chain"
  Ray-Ban UK decision (Stratford Westfield is the one with zero mentions).
- `rayban-ireland-directory.raw.html` — Ray-Ban's Ireland directory.
  Source of `dm_baseEntityCount = "1"`, confirming Ray-Ban Ireland's single
  store is genuine, not a discovery limitation.
- `vision-express-ireland-store-overview.raw.html` — the page whose
  `listStoreGroups` query revealed Vision Express Ireland's full branch/
  group structure (5 single-store towns + the Dublin and "Ray-Ban Meta"
  multi-store groups) — the source for knowing there are 11 branches
  nationally, not just however many any one themed page happens to show.
- `vision-express-ireland-dublin-group-anomaly.raw.html` — the page behind
  this project's central methodology finding: a URL titled/framed as
  "Ray-Ban Meta Glasses Stockists" whose actual query was
  `stores({"groupName":"Dublin"})` — a location group, not a product
  group. See `scripts/ingest/README.md`'s "Core verification principles."
- `vision-express-ireland-branch-*.raw.html` (11 files) — individual
  branch pages, each decoded for its own `features.availableBrands` field.
  8 confirmed "Ray-Ban Meta" present (ingested); 3 marked `-excluded`
  confirmed it absent (Portlaoise, Balbriggan, Maynooth — deliberately
  NOT ingested, and this is the evidence why).
- `david-clulow-ray-ban-meta-group.raw.html` — David Clulow's own
  correctly-scoped `stores({"groupName":"Ray Ban Meta"})` page. Source of
  the 44-store group used to add 4 new branches, confirm Harrods, and
  establish that none of the 4 Selfridges concessions appear in it.
- `selfridges-ray-ban-meta-category.raw.html` — confirms Selfridges'
  current 21-product Ray-Ban Meta catalogue (the evidence behind adding
  Selfridges to the campaign's national retailer target list).
- `selfridges-ray-ban-meta-product-wayfarer-polarised.raw.html` — one
  representative in-stock product page (of three checked, which all
  agreed) — source of the `department: "David Clulow"` finding that
  reframed the whole Selfridges investigation.
