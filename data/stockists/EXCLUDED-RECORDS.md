# Excluded / unresolved stockist records

Records that were found by a source's fetch step but couldn't be included
in a finalized dataset — kept here on purpose, rather than silently
dropped, so they don't get lost and can be revisited if a fix or a
different data source becomes available. Not shown in the finder either
way; the difference from a normal `authorised_chain`/`candidate` row in D1
is that these never even made it into geocoded, database-ready form.

## Vision Express (14 Aug 2026)

Two of the 440 branches found by `scripts/ingest/1-fetch-vision-express.mjs`
couldn't be geocoded, so they're excluded from
`data/stockists/vision-express.normalized.json` (438 records) pending a fix:

### Vision Express Opticians - Chichester

```json
{
  "branchName": "Vision Express Opticians - Chichester",
  "address": "74 South Street",
  "city": "Chichester",
  "postcode": "PO19 1EG",
  "phone": "01243380098",
  "sourceUrl": "https://www.visionexpress.com/opticians/ray-ban-meta",
  "branchPageUrl": "https://www.visionexpress.com/opticians/chichester/chichester"
}
```

**Why excluded:** postcodes.io returned "not found" for `PO19 1EG` — a
validly-formatted postcode, but not one it has a database record for
(could be a data-entry quirk on Vision Express's side, a very new postcode
not yet in the ONS Postcode Directory, or a decommissioned one). Not
something a retry would fix.

**To revisit:** manually verify `PO19 1EG` is the correct current postcode
for this branch (e.g. via Royal Mail's postcode finder or the branch's own
page at the URL above), correct it if needed, and re-run this one record
through step 2 by hand, or wait for the next full Vision Express refresh
and see if it resolves itself.

### Vision Express Opticians - Jersey, St. Helier

```json
{
  "id": "vision-express-vision-express-opticians-jersey-st-helier",
  "branch_name": "Vision Express Opticians - Jersey, St. Helier",
  "address_line_1": "Queen Street 20",
  "city": "Jersey",
  "postcode": "JE2 4WD",
  "phone_number": "01534752000",
  "contact_url": "https://www.visionexpress.com/opticians/jersey/jersey-st-helier",
  "source_url": "https://www.visionexpress.com/opticians/ray-ban-meta",
  "verification_status": "verified_branch",
  "verification_method": "first_party_product_specific_directory",
  "last_verified_at": "2026-08-14"
}
```

**Why excluded:** postcodes.io returned a result for `JE2 4WD`, but with
no latitude/longitude in it. Jersey is a Crown Dependency, not part of the
UK for ONS geocoding purposes, despite JE postcodes existing and being
valid. This isn't a bug to retry — postcodes.io's dataset structurally
doesn't cover Jersey addresses the same way as GB ones.

**To revisit:** would need a different geocoding source that covers the
Channel Islands (e.g. a general-purpose geocoder, not postcodes.io
specifically), or a manually-sourced lat/long for this one address. Low
priority given it's a single record, but worth fixing before claiming full
UK+Islands coverage in any public messaging.
