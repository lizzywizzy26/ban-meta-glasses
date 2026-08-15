# Cross-source duplicate checks

Records any check for the same physical shop appearing under more than one
chain in the database. Run manually after each new source is added — not
automated yet (worth building into `3-generate-sql.mjs` once there are
enough sources for it to matter).

## Vision Express vs David Clulow (14 Aug 2026)

Checked 438 Vision Express records against 40 David Clulow records for:
exact postcode matches, and geographic proximity under 0.3 miles.

**Result: no genuine duplicates found.** 3 exact-postcode matches (Bromley
BR1 1DN, Ealing W5 5JY, Kingston upon Thames KT1 1TR) and 24 close-proximity
pairs, all explained by the same pattern: two different, real, competing
shops located in the same shopping centre (and therefore sharing a
postcode, since UK shopping centres are frequently assigned one postcode
for the whole building regardless of individual retail units) —
confirmed by checking the actual address text, e.g. Bromley's "Unit 230,
The Glades Shopping Centre" (David Clulow) vs "Unit 29, The Glades Mall"
(Vision Express) — same building, different units, different businesses.

Also explains why some pairs show exactly 0.00 miles apart: postcodes.io
geocodes to a postcode-level centroid, not an exact building/unit, so two
different shops sharing a postcode will always show identical coordinates
regardless of how far apart their actual doors are within that postcode
area.

**Practical implication:** don't be alarmed by future exact-postcode or
near-zero-distance matches between chains on their own — check the address
text first. A genuine duplicate would need matching (or near-identical)
street address text, not just a shared postcode.

## John Lewis vs David Clulow (run 15 Aug 2026, real data)

**Why this one is different from the Vision Express/David Clulow check
above, and needs more care, not less:** 13 of David Clulow's 40 committed
branches are explicitly concessions *inside* John Lewis stores — "David
Clulow Opticians at John Lewis - [location]" (Bluewater, Cardiff, Cheadle,
Glasgow, Kingston upon Thames, Leeds, Milton Keynes, Oxford, Oxford
Street, Reading, Stratford, Welwyn Garden City, White City — see
`david-clulow.normalized.json`). Once John Lewis's own branch-level
Ray-Ban Meta data exists (pending the DevTools capture — see
`RETAILER-MATRIX.md`), these 13 are near-certain to produce an
**exact-address match**, not just a shared-postcode coincidence like the
shopping-centre cases above — a concession is physically inside the same
building, often the same address down to the floor.

**The methodology, once John Lewis data exists:**
1. Match David Clulow's 13 "at John Lewis" records against the new John
   Lewis dataset by postcode first, then confirm with address text (same
   process as above).
2. **An exact address match here does NOT automatically mean "delete
   one"** — unlike the shopping-centre cases, this needs a real judgment
   call, not an automated rule, because there are two genuinely different
   possible realities behind an address match:
   - **(a) Same point of sale:** David Clulow's optician concession is the
     only place in that building selling Ray-Ban Meta, and John Lewis's
     own stock-checker is just surfacing the same physical stock through
     the parent store's system. If so, this is a true duplicate — one
     database row, not two, and it should probably stay attributed to
     David Clulow (the more specific, evidenced source) rather than John
     Lewis (the generic one).
   - **(b) Two real, distinct points of sale in one building:** John Lewis
     stores that size typically also have their own general
     electronics/tech department, separate from the in-store optician
     concession — it's entirely possible John Lewis sells Ray-Ban Meta as
     a tech/gadget product through that department, independent of
     whatever David Clulow's optician concession stocks. If so, these are
     two real, separate stockists that happen to share a building — not a
     duplicate at all, the same way the shopping-centre pairs above
     weren't.
   Neither of these can be resolved by the data alone — matching postcodes
   and even matching street addresses can't distinguish (a) from (b) by
   themselves. But see the actual result below — one specific piece of
   evidence in the real data turned out to speak to this directly.

**Result: all 13 David Clulow "at John Lewis" branches matched a John
Lewis branch on exact postcode AND near-identical address text** (e.g.
David Clulow "Bluewater Parkway, Greenhithe" vs John Lewis "Bluewater
Parkway, Greenhithe, Kent" — same building, as expected).

**Real evidence pointing toward (b), not (a):** for 3 of the 13 matched
pairs (Cheadle, Milton Keynes, Oxford), John Lewis's own live stock
checker currently shows **no stock** for the specific SKUs queried
(`authorised_chain`), while David Clulow's parallel branch is
`verified_branch` — confirmed independently via the campaign owner's
phone spot-check (see the David Clulow decision above). If these were the
same underlying stock being surfaced through two different storefronts
(interpretation (a)), John Lewis's live API and David Clulow's confirmed
stock should agree. They don't, for at least 3 of the 13. That's real,
independent evidence the two are tracking **separate inventory** — David
Clulow's optician concession and John Lewis's own general-merchandise
stock appear to be genuinely distinct points of sale that happen to share
a building, the same underlying pattern as the shopping-centre pairs
above, not a database duplicate.

**Action taken: none — no records merged or removed.** Both sources stay
as separate rows for all 13 locations. This reading is well-supported by
the asymmetric stock-status evidence above, but it's still an inference,
not a certainty (the SKUs John Lewis was queried on might simply not be
what its own department stocks, independent of the duplicate question
entirely) — **flagging this for the campaign owner's final sign-off
before treating it as fully closed**, consistent with treating dataset
structure decisions with visible user-facing consequences as needing
human confirmation, not just a confident autonomous inference. If a
finder search near one of these 13 postcodes ever surfaces both a David
Clulow and a John Lewis result and that reads as a visible duplicate to a
real user, revisit this with a phone check of that specific location
before removing either row.
