#!/usr/bin/env node
// Extracts Boots Opticians' Ray-Ban Meta branch list from Boots' own
// first-party "Smart Eyewear Stores List" page and saves it as ONE json
// file: scripts/ingest/output/boots.json
//
// HOW TO RUN THIS (no coding knowledge needed):
//   1. Install Node.js if you don't already have it: https://nodejs.org (choose the "LTS" version)
//   2. Open Terminal (Mac) or Command Prompt (Windows)
//   3. Type "cd " (with a space after) then drag this project's folder into the window, then press Enter
//   4. Type this and press Enter:
//        node scripts/ingest/1-fetch-boots.mjs
//   5. When it finishes, send back the file it created:
//        scripts/ingest/output/boots.json
//
// SOURCE (17 Aug 2026): unlike every other retailer in this pipeline, this
// does NOT fetch live — bootsopticians.com is unreachable from this
// project's usual working environment, so the campaign owner saved the page
// herself ("Webpage, Complete") and supplied it directly. This script parses
// that preserved capture, not a live request, so its result is exactly
// reproducible from the evidence already committed at
// scripts/ingest/fixtures/boots-smart-eyewear-stores-list.raw.html — no
// network access needed to re-run it.
//
// PAGE: https://www.bootsopticians.com/brands/smart-eyewear/smart-eyewear-stores-list/
// Its own text says "Ray-Ban Meta and Nuance are available at the following
// stores" immediately above a table with one row per store and separate
// Ray-Ban Meta / Nuance columns, each cell either "Y" or blank. This is
// genuine first-party, PER-BRANCH structured evidence — the same evidence
// category (first_party_structured_brand_list) as Vision Express Ireland's
// per-store `availableBrands` field, not a chain-level claim or a whole-
// directory judgement call. 216 total rows found; 205 marked Ray-Ban Meta
// = Y (notably more than the 201 figure in Boots' own July 2026 launch
// press release — this table is evidently more current than that
// announcement, not in conflict with it).
//
// ADDRESS DATA CAVEAT: each store name in the table links to its own
// bootsopticians.com store page (also unreachable from here), so this
// script does NOT have true canonical street addresses or coordinates —
// those pages were never fetched. What it DOES have, for every single one
// of the 205 records, is a real postcode and a location description, both
// extracted from Boots' own URL slug for that store (e.g.
// ".../stores/abingdon-bury-street-ox14-3qx-3977" -> postcode "OX14 3QX",
// location "Abingdon Bury Street") — Boots generates these slugs from its
// own address data, so this is still first-party, just coarser than a full
// street-address confirmation. Coordinates come later, from
// 2-normalize-and-geocode.mjs geocoding the extracted postcode for real
// (this script deliberately does not geocode itself, matching every other
// fetch script in this pipeline).
//
// KNOWN ANOMALIES (checked by hand, 17 Aug 2026): for 3 of the 205 rows,
// the store's DISPLAY NAME names a different town than its own postcode/
// URL slug does: "Ealing" (postcode E15 1NG, which is Stratford, not
// Ealing/W5), "Mill Hill" (postcode SK11 6LT, which is Macclesfield, not
// Mill Hill/NW7), and "Whetstone" (postcode NW6 4JD, which is Kilburn, not
// Whetstone/N20). These 3 records are flagged with needsReview=true and a
// note — the postcode/slug (Boots' own structured URL data) is trusted
// over the display name for these, but they're worth a specific human
// glance before treating as settled. Two further rows (Bracknell/
// Newcastle) have a differing STREET/landmark reference but a
// geographically consistent postcode for the stated town (The Lexicon
// really is in Bracknell; Eldon Square really is in Newcastle) — not
// flagged, since the town itself checks out.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const FIXTURE_PATH = join(__dirname, 'fixtures', 'boots-smart-eyewear-stores-list.raw.html');
const SOURCE_URL = 'https://www.bootsopticians.com/brands/smart-eyewear/smart-eyewear-stores-list/';

// Town names known (by direct postcode-district cross-check, 17 Aug 2026)
// to disagree with their row's actual postcode/URL slug. See file header.
// `correctCity` is the town the postcode/slug actually indicates — used
// for the city field instead of trusting the (apparently wrong) display
// name, since city drives which town-centroid/search-radius logic the
// rest of the pipeline uses.
const TOWN_MISMATCH_FLAGS = {
  Ealing: {
    correctCity: 'Stratford',
    note: 'Display name says "Ealing" but this row\'s postcode (E15 1NG) and URL slug both indicate Stratford, not Ealing (which would be a W5 postcode). Trusting the postcode/slug; worth a direct check before treating as settled.',
  },
  'Mill Hill': {
    correctCity: 'Macclesfield',
    note: 'Display name says "Mill Hill" but this row\'s postcode (SK11 6LT) and URL slug both indicate Macclesfield, not Mill Hill (which would be an NW postcode). Trusting the postcode/slug; worth a direct check before treating as settled.',
  },
  Whetstone: {
    correctCity: 'Kilburn',
    note: 'Display name says "Whetstone" but this row\'s postcode (NW6 4JD) and URL slug both indicate Kilburn, not Whetstone (which would be an N20 postcode). Trusting the postcode/slug; worth a direct check before treating as settled.',
  },
};

// Exported so this same extraction logic can be tested against an
// already-saved copy of the page without needing the real fixture file.
export function parseBootsStoreList(html, sourceUrl) {
  const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/);
  if (!tableMatch) return [];
  const rows = tableMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];

  const postcodeRe = /-([a-z]{1,2}\d[a-z\d]?)-(\d[a-z]{2})-(\d+)$/;
  const records = [];

  for (const row of rows) {
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length !== 3) continue; // skips the header row (th, not td)

    const [nameCell, rbmCell, nuanceCell] = cells;
    const linkMatch = nameCell.match(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    if (!linkMatch) continue;

    const url = linkMatch[1];
    const branchName = linkMatch[2].trim();
    const rbmClean = rbmCell.replace(/<[^>]+>/g, '').trim();
    const isRayBanMeta = rbmClean === 'Y';
    if (!isRayBanMeta) continue; // exact instruction: only Y in the Ray-Ban Meta column, never Nuance-only rows

    const slug = url.replace(/\/$/, '').split('/stores/').pop();
    const pcMatch = slug.match(postcodeRe);
    if (!pcMatch) {
      console.log(`  WARNING: could not extract postcode from ${url} — skipping (would need manual follow-up)`);
      continue;
    }
    const [, outward, inward] = pcMatch;
    const postcode = `${outward.toUpperCase()} ${inward.toUpperCase()}`;
    const locationDesc = slug
      .slice(0, pcMatch.index)
      .replace(/-/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // City is the leading segment of the display name (e.g. "Aberdeen"
    // from "Aberdeen - Bon Accord Centre") — this is what the rest of the
    // pipeline needs explicitly (see 2-normalize-and-geocode.mjs: it only
    // falls back to guessing a city from a comma in `address`, which this
    // source's addresses don't have).
    let city = branchName.split(' - ')[0].split(',')[0].trim();

    const record = {
      branchName: `Boots Opticians - ${branchName}`,
      address: locationDesc || branchName,
      city,
      postcode,
      phone: null,
      sourceUrl,
      storePageUrl: url,
      metaEvidenceText: `"Ray-Ban Meta" column marked "Y" for this store on Boots' official Smart Eyewear Stores List (${sourceUrl}).`,
    };
    if (TOWN_MISMATCH_FLAGS[branchName]) {
      record.city = TOWN_MISMATCH_FLAGS[branchName].correctCity;
      record.needsReview = true;
      record.reviewNote = TOWN_MISMATCH_FLAGS[branchName].note;
    }
    records.push(record);
  }

  return records;
}

async function main() {
  console.log(`Reading preserved capture: ${FIXTURE_PATH}`);
  const html = await readFile(FIXTURE_PATH, 'utf-8');

  const records = parseBootsStoreList(html, SOURCE_URL);
  console.log(`Extracted ${records.length} Ray-Ban Meta = Y records.`);

  const flagged = records.filter((r) => r.needsReview);
  if (flagged.length) {
    console.log(`\n${flagged.length} record(s) flagged for review (town-name/postcode mismatch):`);
    for (const r of flagged) console.log(`  - ${r.branchName}: ${r.reviewNote}`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, 'boots.json');
  await writeFile(outPath, JSON.stringify({ sourceUrl: SOURCE_URL, records }, null, 2));
  console.log(`\nWrote ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
