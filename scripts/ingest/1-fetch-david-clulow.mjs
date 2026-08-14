#!/usr/bin/env node
// Fetches the David Clulow Ray-Ban Meta stockist directory and saves what
// it finds as ONE json file: scripts/ingest/output/david-clulow.json
//
// HOW TO RUN THIS: same as the other scripts, no arguments.
//   node scripts/ingest/1-fetch-david-clulow.mjs
//
// UPDATE (14 Aug 2026): after seeing real data, David Clulow's page turned
// out to run on the exact same store-locator platform as Vision Express —
// identical markup (store-tile articles, address-stores-v2 rows, the same
// gv-stores-v2.imgix.net image CDN), which also explains why their listed
// customer service phone number matched Vision Express's exactly. This
// script now uses a targeted parser for that shared structure, the same
// approach that worked for Vision Express.
//
// IMPORTANT — evidence is more ambiguous here than Vision Express, not
// resolved. Two things point different ways:
//   - David Clulow's intro copy says "Ray-Ban Meta AI Glasses available in
//     David Clulow stores" — no "selected stores" qualifier the way Vision
//     Express's page explicitly had one. That's a point in favour of this
//     being a genuinely Meta-specific list.
//   - But there's no per-branch tag distinguishing anything here either
//     (same "Wheelchair accessible"-only limitation as Vision Express), and
//     the total-store-count comparison that helped with Vision Express is
//     inconclusive here: David Clulow's own site says "over thirty optical
//     stores" as a general figure, but this locator returns 44 — MORE than
//     their stated total, not fewer, so it doesn't cleanly indicate
//     filtering happened the way Vision Express's 440-of-533 did.
// So: extractionMethod stays targeted_dom_pattern, but metaEvidenceText
// stays null, same as Vision Express — this data is real and clean, but
// whether the whole directory counts as product-specific evidence is a
// judgment call for a human to make with the full picture, not something
// to assume here.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const SOURCE_URL = 'https://www.davidclulow.com/stores/ray-ban-meta';
const BASE_URL = 'https://www.davidclulow.com';

// Same shared store-locator platform as Vision Express — see
// 1-fetch-vision-express.mjs's parseVisionExpressStoreList for the
// original version of this parser.
export function parseStoreList(html) {
  const chunks = html.split(/<article id="\d+" class="store-tile/).slice(1);
  const records = [];

  for (const chunk of chunks) {
    const nameMatch = chunk.match(/class="store-finder__heading-link" href="([^"]+)">([^<]+)</);
    const addressRows = [...chunk.matchAll(/class="address-stores-v2__row">([^<]*)</g)].map((m) => m[1].trim());
    const phoneMatch = chunk.match(/href="tel:(\d+)"/);

    if (!nameMatch || addressRows.length < 3) continue;

    const [addressLine1, city, postcode] = addressRows;

    records.push({
      branchName: nameMatch[2].trim(),
      address: addressLine1,
      city,
      postcode,
      phone: phoneMatch ? phoneMatch[1] : null,
      sourceUrl: SOURCE_URL,
      metaEvidenceText: null, // see the ambiguity note above — deliberately not assumed
      extractionMethod: 'targeted_dom_pattern',
      needsReview: false,
      branchPageUrl: BASE_URL + nameMatch[1],
    });
  }

  return records;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`Fetching ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  const html = await res.text();

  const rawPath = join(OUTPUT_DIR, 'david-clulow.raw.html');
  await writeFile(rawPath, html, 'utf-8');

  const records = parseStoreList(html);
  const method = records.length > 0 ? 'targeted_dom_pattern' : 'none_found';

  const outputPath = join(OUTPUT_DIR, 'david-clulow.json');
  await writeFile(
    outputPath,
    JSON.stringify(
      { sourceUrl: SOURCE_URL, fetchedAt: new Date().toISOString(), httpStatus: res.status, extractionMethod: method, recordCount: records.length, records },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`\nFound ${records.length} candidate record(s) via "${method}".`);
  console.log(`Saved: ${outputPath}`);

  if (records.length === 0) {
    console.log('\nNote: the targeted parser found nothing — David Clulow may have changed their page structure. Send back david-clulow.raw.html so the parser can be updated.');
  }

  console.log('\nPlease send back: scripts/ingest/output/david-clulow.json (and the .raw.html if possible).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  });
}
