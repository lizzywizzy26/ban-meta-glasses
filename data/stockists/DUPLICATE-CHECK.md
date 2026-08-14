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
