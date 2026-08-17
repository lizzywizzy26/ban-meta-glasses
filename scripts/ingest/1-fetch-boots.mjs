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
// announcement, not in conflict with it). One of those 205 rows is a
// genuine duplicate of another (both link to the same branchPageUrl —
// Boots' own list carries the Macclesfield/Mill Street branch twice, once
// under its correct name and once under the row that also had the wrong
// "Mill Hill" label) — deduped down to 204 distinct physical branches, see
// the dedupe step at the end of parseBootsStoreList().
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
// CONFLICT_RESOLUTIONS below) — per the campaign owner's explicit rule: the
// linked individual store page is canonical for branch identity/name/
// address/postcode, NEVER the list's display label, whenever the two
// disagree. The list's label is preserved only in `evidenceListLabel`
// (audit/internal use), never in `branchName`/`address`/`city` — those
// fields always carry the corrected identity for a resolved conflict, so
// an erroneous label can never reach a user.
//
// 3 CONFIRMED genuine errors (campaign owner supplied the correction
// directly, 17 Aug 2026): "Ealing" (postcode E15 1NG — actually Stratford,
// not Ealing/W5), "Mill Hill" (postcode SK11 6LT — actually Macclesfield,
// not Mill Hill/NW7), "Whetstone" (postcode NW6 4JD — actually Kilburn,
// not Whetstone/N20). See CONFLICT_RESOLUTIONS for the exact corrected
// identity used for each.
//
// 1 CHECKED AND CONFIRMED NOT AN ERROR: "Newcastle Upon Tyne - Hotspur
// Way" (list label) vs "Newcastle Eldon Square" (slug) — initially held
// out pending review rather than guessed at, per the "flag it, don't
// guess" rule. Campaign owner then manually checked the linked store page
// directly (screenshot, 17 Aug 2026): it confirms branch name "Newcastle
// Eldon Square", address "Hotspur Way, Eldon Square" — Hotspur Way is
// simply the street Eldon Square (the shopping centre) sits on, so both
// names describe the exact same branch, not a conflict at all. Restored
// to the ingestable set using that confirmed identity (see
// CONFLICT_RESOLUTIONS) — back to 205/205.
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
  // Not actually an error, unlike the 3 above — initially held out pending
  // review (the URL slug alone wasn't enough to be sure), then the
  // campaign owner directly checked the linked store page and confirmed
  // both names describe the same branch: "Hotspur Way" is just the street
  // "Eldon Square" (the shopping centre) sits on. Uses the confirmed real
  // branch name/address/phone from that direct check, not slug inference.
  'Newcastle Upon Tyne - Hotspur Way': {
    correctIdentity: 'Newcastle Eldon Square',
    correctCity: 'Newcastle upon Tyne',
    correctAddress: 'Hotspur Way, Eldon Square',
    correctPhone: '01912612475',
    note: 'Smart Eyewear list labelled this row "Newcastle Upon Tyne - Hotspur Way"; the linked store page\'s own name is "Newcastle Eldon Square." Campaign owner directly checked the store page (17 Aug 2026) and confirmed these describe the same branch, not a conflict — "Hotspur Way" is the street Eldon Square sits on. Address and phone below are taken directly from that page.',
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

    const resolution = CONFLICT_RESOLUTIONS[branchName];

    // Canonical identity: the RESOLVED linked-store-page identity for a
    // known conflict, otherwise the list's own display name (validated
    // reliable for every row except the specific conflicts listed above).
    // The list label is NEVER used for a resolved conflict's branchName/
    // address/city — only preserved separately in evidenceListLabel for
    // audit purposes.
    const canonicalIdentity = resolution ? resolution.correctIdentity : branchName;
    const city = resolution ? resolution.correctCity : branchName.split(' - ')[0].split(',')[0].trim();
    const address = resolution
      ? resolution.correctAddress || canonicalIdentity.split(' - ').slice(1).join(' - ') || canonicalIdentity
      : locationDesc || branchName;

    const record = {
      branchName: `Boots Opticians - ${canonicalIdentity}`,
      address,
      city,
      postcode,
      phone: (resolution && resolution.correctPhone) || null,
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

  // Found 17 Aug 2026 QA pass: Boots' own list carries "Macclesfield -
  // Mill Street" and the (corrected) "Mill Hill" row as two separate rows
  // that both link to the exact same branchPageUrl — a genuine duplicate
  // in Boots' own source table, not a naming ambiguity like the 4 conflicts
  // above (those are now settled; this is a different, distinct issue: the
  // same physical branch listed twice). Dedupe by branchPageUrl — the only
  // completely unambiguous identity key available — keeping whichever
  // occurrence lists first and folding the other's evidence into a note on
  // the survivor, rather than silently dropping it.
  const seenByUrl = new Map();
  const deduped = [];
  for (const record of records) {
    const existing = seenByUrl.get(record.branchPageUrl);
    if (!existing) {
      seenByUrl.set(record.branchPageUrl, record);
      deduped.push(record);
      continue;
    }
    const dupeNote = `Boots' own Smart Eyewear Stores List carries this branch (${record.branchPageUrl}) as two separate rows — this one, and a duplicate list row labelled "${record.evidenceListLabel || record.branchName}" — both marked Ray-Ban Meta = Y. Counted once here, not twice.`;
    existing.needsReview = true;
    existing.reviewNote = existing.reviewNote ? `${existing.reviewNote} ${dupeNote}` : dupeNote;
  }

  return deduped;
}

async function main() {
  console.log(`Reading preserved capture: ${FIXTURE_PATH}`);
  const html = await readFile(FIXTURE_PATH, 'utf-8');

  const records = parseBootsStoreList(html, SOURCE_URL);
  console.log(`Extracted ${records.length} Ray-Ban Meta = Y records.`);

  const resolved = records.filter((r) => r.needsReview);
  if (resolved.length) {
    console.log(`\n${resolved.length} record(s) had a list-vs-store-page conflict, resolved to the store page's real identity (list label kept only in evidenceListLabel for audit):`);
    for (const r of resolved) console.log(`  - ${r.evidenceListLabel ? `"${r.evidenceListLabel}"` : '(list-duplicate merged in)'} -> ${r.branchName}`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, 'boots.json');
  await writeFile(outPath, JSON.stringify({ sourceUrl: SOURCE_URL, records }, null, 2));
  console.log(`\nWrote ${outPath} (${records.length} records)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
