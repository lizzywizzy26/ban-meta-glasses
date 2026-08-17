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
// KNOWN CONFLICTS between the Smart Eyewear list's display name and the
// individual store page it links to (checked by hand, 17 Aug 2026; see
// CONFLICT_RESOLUTIONS and UNRESOLVED_CONFLICTS below) — per the campaign
// owner's explicit rule: the linked individual store page is canonical for
// branch identity/name/address/postcode, NEVER the list's display label,
// whenever the two disagree. The list's label is preserved only in
// `evidenceListLabel` (audit/internal use), never in `branchName`/
// `address`/`city` — those fields always carry the corrected identity for
// a resolved conflict, so an erroneous label can never reach a user.
//
// 3 CONFIRMED and resolved (campaign owner supplied the correction
// directly, 17 Aug 2026): "Ealing" (postcode E15 1NG — actually Stratford,
// not Ealing/W5), "Mill Hill" (postcode SK11 6LT — actually Macclesfield,
// not Mill Hill/NW7), "Whetstone" (postcode NW6 4JD — actually Kilburn,
// not Whetstone/N20). See CONFLICT_RESOLUTIONS for the exact corrected
// identity used for each.
//
// 1 UNRESOLVED, held out of the ingestable set rather than guessed:
// "Newcastle Upon Tyne - Hotspur Way" (postcode NE1 7XE, slug says
// "Newcastle Eldon Square") — NE1 is genuinely central Newcastle either
// way, so unlike the 3 above this isn't a different-town conflict, but
// "Hotspur Way" and "Eldon Square" aren't confirmed to be the same unit
// either. Per the "flag rather than guess" rule, this one is excluded
// from the proposed set pending the campaign owner's input, not
// auto-corrected to either name.
//
// Two further rows (Bracknell/Milton Keynes-style cases generally) have a
// differing STREET/landmark reference but a geographically consistent
// postcode for the stated town (e.g. The Lexicon really is in Bracknell) —
// not treated as conflicts, since the town itself checks out and retail
// developments are legitimately known by more than one name over time.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const FIXTURE_PATH = join(__dirname, 'fixtures', 'boots-smart-eyewear-stores-list.raw.html');
const SOURCE_URL = 'https://www.bootsopticians.com/brands/smart-eyewear/smart-eyewear-stores-list/';

// Confirmed conflicts (campaign owner's explicit correction, 17 Aug 2026):
// the list's display name is replaced entirely by the linked store page's
// real identity (proxied via its URL slug, since the page itself is
// unreachable from this environment) — branchName/address/city ALWAYS come
// from `correctIdentity`/`correctCity` below for these, never from the
// list label. The erroneous label is kept only in `evidenceListLabel`.
const CONFLICT_RESOLUTIONS = {
  Ealing: {
    correctIdentity: 'London - Stratford - The Broadway',
    correctCity: 'London',
    note: 'Smart Eyewear list labelled this row "Ealing," but the linked individual store page (per its URL) is actually London - Stratford - The Broadway (postcode E15 1NG; Ealing would be W5). Campaign owner confirmed 17 Aug 2026: use the store page identity, never the list label.',
  },
  'Mill Hill': {
    correctIdentity: 'Macclesfield - 46 Mill Street',
    correctCity: 'Macclesfield',
    note: 'Smart Eyewear list labelled this row "Mill Hill," but the linked individual store page (per its URL) is actually Macclesfield - 46 Mill Street (postcode SK11 6LT; Mill Hill would be an NW postcode). Campaign owner confirmed 17 Aug 2026: use the store page identity, never the list label.',
  },
  Whetstone: {
    correctIdentity: 'London - Kilburn',
    correctCity: 'London',
    note: 'Smart Eyewear list labelled this row "Whetstone," but the linked individual store page (per its URL) is actually London - Kilburn (postcode NW6 4JD; Whetstone would be N20). Campaign owner confirmed 17 Aug 2026: use the store page identity, never the list label.',
  },
};

// Unresolved: held out of the ingestable set entirely (see main()) rather
// than guessed at, per "stop and flag it for review rather than guessing."
const UNRESOLVED_CONFLICT_LABELS = new Set(['Newcastle Upon Tyne - Hotspur Way']);
const UNRESOLVED_CONFLICT_NOTE =
  'List label says "Newcastle Upon Tyne - Hotspur Way," but the linked store page URL says "Newcastle Eldon Square." NE1 is genuinely central Newcastle either way (not a different-town conflict like the 3 resolved ones), but "Hotspur Way" and "Eldon Square" are not confirmed to be the same unit. Held out of the proposed ingestion set pending a direct answer, not auto-corrected to either name.';

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

    // Held out entirely — not auto-corrected, not shown with its
    // unconfirmed label either. See UNRESOLVED_CONFLICT_NOTE.
    if (UNRESOLVED_CONFLICT_LABELS.has(branchName)) {
      records.push({
        excluded: true,
        evidenceListLabel: branchName,
        postcode,
        branchPageUrl: url,
        reviewNote: UNRESOLVED_CONFLICT_NOTE,
      });
      continue;
    }

    const resolution = CONFLICT_RESOLUTIONS[branchName];

    // Canonical identity: the RESOLVED linked-store-page identity for a
    // known conflict, otherwise the list's own display name (validated
    // reliable for every row except the specific conflicts listed above).
    // The list label is NEVER used for a resolved conflict's branchName/
    // address/city — only preserved separately in evidenceListLabel for
    // audit purposes.
    const canonicalIdentity = resolution ? resolution.correctIdentity : branchName;
    const city = resolution ? resolution.correctCity : branchName.split(' - ')[0].split(',')[0].trim();

    const record = {
      branchName: `Boots Opticians - ${canonicalIdentity}`,
      address: resolution ? canonicalIdentity.split(' - ').slice(1).join(' - ') || canonicalIdentity : locationDesc || branchName,
      city,
      postcode,
      phone: null,
      sourceUrl,
      branchPageUrl: url,
      metaEvidenceText: `"Ray-Ban Meta" column marked "Y" for this store on Boots' official Smart Eyewear Stores List (${sourceUrl}).`,
    };
    if (resolution) {
      // Audit-only — never surfaced as branchName/address/city.
      record.evidenceListLabel = branchName;
      record.needsReview = true;
      record.reviewNote = resolution.note;
    }
    records.push(record);
  }

  return records;
}

async function main() {
  console.log(`Reading preserved capture: ${FIXTURE_PATH}`);
  const html = await readFile(FIXTURE_PATH, 'utf-8');

  const allRecords = parseBootsStoreList(html, SOURCE_URL);
  const excluded = allRecords.filter((r) => r.excluded);
  const records = allRecords.filter((r) => !r.excluded);

  console.log(`Extracted ${allRecords.length} Ray-Ban Meta = Y rows total.`);
  console.log(`  ${records.length} in the ingestable set.`);
  console.log(`  ${excluded.length} held out (unresolved list-vs-store-page conflict, not guessed):`);
  for (const r of excluded) console.log(`    - "${r.evidenceListLabel}": ${r.reviewNote}`);

  const resolved = records.filter((r) => r.needsReview);
  if (resolved.length) {
    console.log(`\n${resolved.length} record(s) had a resolved list-vs-store-page conflict (using the corrected identity, list label kept only in evidenceListLabel for audit):`);
    for (const r of resolved) console.log(`  - "${r.evidenceListLabel}" -> ${r.branchName}`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, 'boots.json');
  await writeFile(outPath, JSON.stringify({ sourceUrl: SOURCE_URL, records, excluded }, null, 2));
  console.log(`\nWrote ${outPath} (${records.length} records + ${excluded.length} excluded, kept for the audit trail)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
