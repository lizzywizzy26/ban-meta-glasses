# Retailer/database audit — 16 Aug 2026

Full bird's-eye audit of the stockist database and retailer investigation
pipeline, per the campaign owner's brief. No ingestion, no deletion, no
further material schema changes made during this audit — investigation and
documentation only. (One schema change, `host_retailer_name`, was made
*before* this audit began, with explicit approval to leave it in place —
see `RETAILER-MATRIX.md`'s Selfridges section for that decision.)

For full narrative/investigation detail on any retailer below, see
`RETAILER-MATRIX.md` — this document is the structured summary layered on
top of it, not a replacement.

---

## 0. Bird's-eye numbers

**Currently live in the committed database** (`data/stockists/*.normalized.json`):

| Chain | Country | Total | verified_branch | authorised_chain |
|---|---|---|---|---|
| Vision Express | UK | 438 | 438 | 0 |
| David Clulow | UK | 40 | 40 | 0 |
| John Lewis | UK | 36 | 21 | 15 |
| Vision Express | IE | 8 | 8 | 0 |
| **Total** | | **522** | **507** | **15** |

**Decided but NOT yet in the committed database — a real gap found during
this audit, not a new investigation:**

| Chain | Country | Would add | Status |
|---|---|---|---|
| Ray-Ban (own boutiques) | UK | 6 verified_branch + 1 authorised_chain | Decision made and documented 15 Aug 2026 (`4c03370`); merge script exists (`2b-apply-rayban-branch-signal.mjs`); only ever run with `--mock-geocoder` for testing — **never run against real data, never copied to `data/stockists/`** |
| Ray-Ban | IE | 1 verified_branch | Confirmed 16 Aug 2026 (`dm_baseEntityCount = 1`, matches exactly); **never ingested** |

Running these two through the real pipeline (real data already captured,
no new fetching needed) would bring the live total to **530 verified_branch
+ 16 authorised_chain**, immediately, at effectively zero new investigation
cost. See §6, priority 1.

---

## 1. Selfridges / David Clulow reconciliation — recap (done previous turn)

Already investigated and reported before this audit began; recapped here
for completeness of the bird's-eye view.

- **None** of the 4 Selfridges locations (Oxford Street, Manchester
  Exchange Square, Manchester Trafford Centre, Birmingham Bullring) exist
  in the current 40-branch David Clulow dataset — checked by
  address/postcode as well as name. All 4 would be genuinely new physical
  locations.
- **Zero branch-level Ray-Ban Meta evidence exists yet** for any of the 4 —
  only chain-relationship evidence (Selfridges' own product pages show
  `department.name = "David Clulow"`, catalogue-wide, not per-location).
- **Schema change made and approved:** `host_retailer_name` (nullable)
  added to `stockists`. These would be ingested as David Clulow branches
  (`chain_id: david-clulow`) with `host_retailer_name = "Selfridges"`, not
  a new fake chain.
- **Recommendation (agreed):** physical-store finder gets these as David
  Clulow branches once branch-level evidence exists; the campaign's
  national retailer target list gets Selfridges added separately, same
  precedent as Three.
- **Not fetched, not ingested** — explicitly held per instruction.

---

## 2. Full retailer inventory

### UK

**Verified and ingested:**
- Vision Express — 438 verified_branch
- David Clulow — 40 verified_branch
- John Lewis — 21 verified_branch, 15 authorised_chain

**Verified but not yet ingested (real gap — see §0):**
- Ray-Ban (own boutiques) — 6 verified_branch + 1 authorised_chain, data ready, pipeline never run for real

**Under investigation:**
- Selfridges — sells online (21 products confirmed), physical presence is via David Clulow concessions at all 4 locations; branch-level evidence not yet obtained (see §1)
- Currys — parked 15 Aug 2026: real collection availability confirmed in the live UI, but no reproducible standalone endpoint found after two DevTools passes. Not attempted again since.
- O2 — has a genuine stock-checker tied to physical stores, but appears checkout-flow/session-dependent (same structural risk class as Currys) based on research, not yet attempted with a live capture
- Sunglass Hut — blocked by Akamai bot-management; a Playwright browser-fallback script exists, never run

**Identified as a possible Ray-Ban Meta retailer but not yet investigated at all:**
- **Boots Opticians — found this audit, looks substantial.** 201 stores, 6 Ray-Ban Meta frames, confirmed physical in-store demos and staff training (Boots' own press release + Retail Gazette coverage). Not yet checked for a store-locator/stock-check mechanism. See §4, §6.
- Harrods — confirmed David Clulow concession exists (`davidclulow.com/stores/london/london-harrods`), and is very likely **already** the "Harrods Opticians" record already sitting in the David Clulow dataset (same address pattern) — not yet formally connected/confirmed via `host_retailer_name`, and not yet checked for Ray-Ban Meta specifically
- House of Fraser, Fenwick, De Gruchy — named alongside Selfridges/Harrods in an "David Clulow expands at Selfridges" trade article as having David Clulow concessions too; none checked at all

**Ruled out, with reason:**
- Vodafone — no evidence of selling Ray-Ban Meta at all, rechecked twice (15 Aug 2026)
- InMotion (airport stores) — no evidence found
- Very — no physical stores at all (online/catalogue retailer), structurally can never be a branch-level result
- EE — ambiguous but leaning ruled-out: EE's own "check stock" language reads as online/warehouse fulfilment status, not a physical-branch checker
- Three — chain-level only (confirmed sells via `accessories.three.co.uk`), no evidence of any physical-store feature; added to the campaign's national target list instead, deliberately excluded from branch-level results
- Amazon — explicit campaign-owner instruction: national retailer target only, no physical-store case

### Ireland

**Verified and ingested:**
- Vision Express Ireland — 8 verified_branch (Cork, Galway, Naas, Dublin×5)

**Verified but not yet ingested (real gap — see §0):**
- Ray-Ban Ireland — 1 verified_branch (Grafton Street, Dublin), confirmed 16 Aug 2026, never run through the ingestion pipeline

**Under investigation:** none currently open

**Identified as possible but not yet investigated:**
- Currys Ireland — explicitly out of scope per campaign owner's instruction, parked deliberately, not a gap
- Brown Thomas — named in the same "David Clulow expands" article as the Irish equivalent to Selfridges/Harrods for David Clulow concessions; not checked at all

**Ruled out:** none yet — Ireland's retailer list is short and mostly unexplored beyond the two above by design (scope was deliberately narrow for the Monday deadline)

---

## 3. Named retailer reconciliation (9 retailers, standing 3-question test)

Applying: (1) is the branch/location real? (2) is that specific branch
confirmed to stock Ray-Ban Meta? (3) is the discovered set complete?

| Retailer | Q1: real? | Q2: branch confirmed? | Q3: complete? | Category |
|---|---|---|---|---|
| **Currys** | Yes, extensively documented UK chain | Chain-level yes (online listings); branch-level: real UI evidence seen once (Leyton), but no reproducible capture — parked, not confirmed for any specific branch | Not assessed — blocked before reaching this question | Physical retail (parked, blocked) |
| **John Lewis** | Yes | Yes for 21 of 36 (live stock-checker, real per-branch data); 15 confirmed NOT currently stocking (authorised_chain, not a gap) | Yes — every branch queried via 2 SKUs, complete coverage of the checked set | Physical retail (ingested) |
| **Selfridges** | Yes — 4 real, well-documented UK stores | No — physical sale is via David Clulow concession, no branch-level evidence yet for any of the 4 | Yes for the store count (4, well-documented, closed set); no for Meta-stocking evidence | Concession (host retailer); online-only confirmed, physical unconfirmed |
| **Argos** | Yes, extensively documented UK chain | Not attempted — chain-level online evidence only; a real postcode-based stock checker is documented to exist (third-party scraper ecosystem confirms it), never captured | Not assessed | Physical retail (identified, high-priority, not started) |
| **InMotion** | Airport stores are real | No evidence any InMotion location sells Ray-Ban Meta at all | N/A | Ruled out |
| **EE** | 550+ real UK stores | No — EE's own language describes online/warehouse fulfilment, not a branch stock check; leaning ruled-out, not fully closed | Not assessed | Ambiguous, leaning ruled out |
| **O2** | Real UK stores | No — has a genuine stock-checker, but researched (not captured) as likely checkout-flow/session-dependent, same risk class as Currys | Not assessed | Physical retail (identified, blocked-likely, not attempted) |
| **Amazon UK** | N/A — online only by explicit design decision | N/A | N/A | Online-only, national target only (explicit campaign-owner call) |
| **Very** | N/A — no physical stores at all | N/A | N/A | Ruled out (online/catalogue retailer) |

**Distinguishing online-only vs physical vs concession vs host retailer,
explicitly, per the campaign owner's request:**
- **Online-only:** Amazon, Very, Three (chain-level only)
- **Physical retail, own operation:** Vision Express, David Clulow (standalone branches), John Lewis, Ray-Ban (own boutiques), Boots Opticians (new lead)
- **Concession / shop-in-shop:** David Clulow operating inside John Lewis (13 branches), inside Selfridges (4, unconfirmed for Meta), inside Harrods (1, existing record, unconfirmed connection)
- **Host retailer** (hosts a concession but isn't the seller itself): Selfridges, John Lewis (also independently a seller in its own right — see §5), Harrods

---

## 4. Missing retailer research — with evidence quality distinguished

Per instruction: no retailer gets added to the verified database from a
search snippet alone. Everything below is a *lead*, not a verified fact.

### First-party evidence found this session
- **Boots Opticians own press release** (`boots-uk.com/newsroom`) + **Retail Gazette** coverage: 201 stores, 6 Ray-Ban Meta frames, launched 30 July, in-store demos and trained staff. This is about as strong as evidence gets *before* touching Boots' own site directly — a company's own press release about its own launch. Still chain-level, not yet branch-specific.
- **David Clulow's own dedicated page**: `davidclulow.com/stores/ray-ban-meta` — exists, not yet fetched. This is the David Clulow equivalent of Vision Express's `/opticians/ray-ban-meta` page — could be the single best source for confirming exactly which David Clulow branches (standalone, John Lewis, Selfridges, Harrods) stock Ray-Ban Meta specifically. High-value, not yet used.

### Reliable secondary evidence
- David Clulow operates concessions at Harrods, House of Fraser, Fenwick, and De Gruchy (UK), and Brown Thomas (Ireland) — from a trade publication (*Optician Online*), not David Clulow's own site directly, but a specific, named, plausible trade-press claim, not a vague blog mention.
- Harrods' David Clulow concession has its own confirmed branch page (`davidclulow.com/stores/london/london-harrods`) with a real address matching the "Harrods Opticians" record already in our dataset.

### Search-result leads requiring verification, NOT to be trusted as-is
- **Specsavers "META" glasses** — a Specsavers product page exists (`specsavers.co.uk/glasses/meta`, £89), but this price point is far below Ray-Ban Meta's actual UK pricing (£299–459) and Specsavers has historically had its own unrelated "META" own-brand frame collection. **Likely a false positive, not Ray-Ban Meta at all** — flagged explicitly so it doesn't get treated as a real lead without direct verification.
- Any other retailer name not explicitly listed above and not already in `RETAILER-MATRIX.md` — not researched this session, absence here isn't evidence of absence.

---

## 5. Double-counting / concession audit

### Confirmed, already-live issue: David Clulow × John Lewis (13 branches)

**This was already investigated in a prior session (15 Aug 2026,
`DUPLICATE-CHECK.md`) — re-verified this audit, not a new discovery.**
13 of David Clulow's 40 committed branches are concessions physically
inside John Lewis stores. Re-confirmed this audit: **all 13 match a John
Lewis branch on exact postcode.** Both chains currently carry a live,
separate `verified_branch` (or `authorised_chain`) row for the same 13
buildings.

The prior investigation found real evidence these are likely **two
genuinely separate points of sale** (David Clulow's optician concession vs
John Lewis's own general electronics/tech department), not a database
duplicate — 3 of the 13 (Cheadle, Milton Keynes, Oxford) show David Clulow
`verified_branch` but John Lewis `authorised_chain` for the *same
building*, meaning their stock isn't tracking identically, which is
evidence against "same underlying stock counted twice."

**This was explicitly left open for the campaign owner's final sign-off**
in the prior session and, as far as this audit can tell, that sign-off was
never given. **Re-flagging it here as still open** — this is a
decision-only item (no new investigation needed), a good candidate for a
quick close-out. See §6.

### Related, lower-priority observation
- "Harrods Opticians" (existing David Clulow record, SW1X 7XL) is almost
  certainly the same Harrods David Clulow concession independently
  confirmed via WebSearch this audit (`davidclulow.com/stores/london/london-harrods`).
  Not a duplicate (no separate "Harrods" dataset exists to duplicate
  against), but a candidate for the same `host_retailer_name = "Harrods"`
  treatment once that pattern is approved for broader use beyond Selfridges.

### Checked and found NOT to be a problem
- Vision Express × David Clulow (438 vs 40): checked in a prior session
  (14 Aug 2026) — 3 exact-postcode and 24 close-proximity matches, all
  explained by shared shopping-centre postcodes covering genuinely
  different shop units, not duplicates.
- No other cross-chain overlaps found this audit (Vision Express's ~90
  "at Tesco" branches have no other Tesco-hosted retailer in this database
  to duplicate against; Vision Express Ireland's Tesco-hosted branches,
  same situation).

---

## 6. Prioritised next-action list

1. **Ingest the already-decided Ray-Ban UK (7) and Ray-Ban Ireland (1)
   data.** Zero new investigation needed — decisions made, real data
   already captured, scripts already exist. This is pure pipeline
   execution, the highest-value-for-effort item available. *What's needed
   from you: just a go-ahead.*

2. **Close out the John Lewis × David Clulow 13-branch sign-off** (§5) —
   a prior investigation already did the analytical work and recommended
   keeping both rows; it's been sitting unconfirmed. *What's needed from
   you: read the reasoning in `DUPLICATE-CHECK.md` (or my summary above)
   and say yes/no.*

3. **Investigate Boots Opticians** — the single most promising new
   retailer found this audit: 201 stores, well-documented physical
   presence, real press coverage. *What's needed from you: same
   browser-save pattern as before. Start with
   `https://www.boots.com/opticians/glasses/ray-ban-meta` (category page)
   and `https://www.boots.com/ray-ban-meta-wayfarer-0rw4012-10380992`
   (a real product page) — I'll check both for the same kind of embedded
   store/stock data Vision Express and Selfridges had, and report back
   before asking for more.*

4. **Fetch David Clulow's own `/stores/ray-ban-meta` page.** Could
   resolve Selfridges *and* Harrects *and* the missing House of
   Fraser/Fenwick/De Gruchy question in one shot, since it's David
   Clulow's own equivalent of Vision Express's dedicated stockist page
   (with the same caveat this project already learned the hard way —
   verify what it's actually querying, don't assume the page title). *What's
   needed from you: save `https://www.davidclulow.com/stores/ray-ban-meta`.*

5. **Argos** — already identified as high-priority with strong indirect
   evidence (large third-party scraper ecosystem) but never attempted.
   Different shape of task from the others — likely needs a live DevTools
   capture (postcode-triggered AJAX call), not a static page save, per the
   existing DevTools guide in `RETAILER-MATRIX.md`. *What's needed from
   you: the DevTools capture steps already documented — open a product
   page, Network tab, enter a postcode, copy the resulting request.*

**Deliberately not in the top 5, but noted:** O2 and Currys are both
identified but structurally risky (likely session/checkout-dependent) —
lower expected value per unit of your effort than the 5 above. Selfridges'
4 branch-page fetches are ready to request whenever you want them, held
per your explicit instruction this session.
