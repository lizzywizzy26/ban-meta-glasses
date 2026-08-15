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

## Planned check: John Lewis vs David Clulow (methodology drafted 15 Aug 2026, not run yet)

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
   and even matching street addresses can't distinguish (a) from (b). This
   needs either a phone check (same kind of spot-check already used for
   the David Clulow verified_branch decision) or a close read of what each
   source's own page says is being sold where, before deciding
   case-by-case — not a blanket rule applied to all 13.
3. Record the outcome here once real John Lewis data exists and this
   actually gets run, the same way the Vision Express check above is
   recorded — including which of (a)/(b) applied and why, not just the
   final count.
