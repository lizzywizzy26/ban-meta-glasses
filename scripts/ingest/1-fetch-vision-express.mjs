#!/usr/bin/env node
// Fetches the Vision Express Ray-Ban Meta stockist directory and saves what
// it finds as ONE json file: scripts/ingest/output/vision-express.json
//
// HOW TO RUN THIS (no coding knowledge needed):
//   1. Install Node.js if you don't already have it: https://nodejs.org (choose the "LTS" version)
//   2. Open Terminal (Mac) or Command Prompt (Windows)
//   3. Type "cd " (with a space after) then drag this project's folder into the window, then press Enter
//   4. Type this and press Enter:
//        node scripts/ingest/1-fetch-vision-express.mjs
//   5. When it finishes, send back the file it created:
//        scripts/ingest/output/vision-express.json
//      (and scripts/ingest/output/vision-express.raw.html too, just in case)
//
// That's it — no arguments, no options, nothing else to configure.
//
// IMPORTANT FINDING FROM THE FIRST REAL RUN (14 Aug 2026): this page's store
// list is genuinely well-structured (440 real branches, clean addresses),
// but it is Vision Express's GENERIC store locator widget reused on the
// Ray-Ban Meta landing page — every one of the 440 stores has the exact
// same set of feature tags ("Wheelchair accessible" only), with no
// per-branch signal distinguishing the "selected stores" the page's own
// marketing copy says actually carry Ray-Ban Meta. So: extractionMethod
// below is deliberately NEVER set to anything that implies branch-level
// Meta evidence — metaEvidenceText is always null for this source until a
// genuine per-branch signal is found (see scripts/ingest/README.md). Step 2
// of the pipeline will therefore cap these at 'authorised_chain', not
// 'verified_branch', even when run with --assume-first-party. That's
// correct, not a bug — don't try to "fix" it by inventing evidence.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const SOURCE_URL = 'https://www.visionexpress.com/opticians/ray-ban-meta';

// Targeted parser for Vision Express's actual store-locator markup, e.g.:
//   <article id="17" class="store-tile ...">
//     ...<a class="store-finder__heading-link" href="/opticians/aberdeen/aberdeen">Vision Express Opticians - Aberdeen</a>
//     ...<address class="address-stores-v2 ..."><span class="address-stores-v2__row">George Street, Bon Accord Centre, Unit 32</span><span class="address-stores-v2__row">Aberdeen</span><span class="address-stores-v2__row">AB25 1HZ</span></address>
//     ...<a class="link--with-icon" href="tel:01224624263">...
// Confirmed against a real saved copy of the page (14 Aug 2026) — 440/440
// stores parsed cleanly, 0 missing phone numbers, 440 unique postcodes.
// If Vision Express changes their page structure, this will find 0 records
// and the caller falls back to the generic heuristics below.
// sourceUrl/siteOrigin are parameterized (defaulting to this file's UK
// constants) so this same markup-pattern parser can be reused for another
// country on the same platform (e.g. visionexpress.ie) — see
// 1-fetch-vision-express-ireland.mjs. The 3rd address row is UK-postcode-
// shaped on the UK site; kept as plain captured text here (not validated)
// since an Ireland run may have a real Eircode, a county name, or nothing
// there — step 2 decides what to do with it per-country.
export function parseVisionExpressStoreList(html, { sourceUrl = SOURCE_URL, siteOrigin = 'https://www.visionexpress.com' } = {}) {
  const chunks = html.split(/<article id="\d+" class="store-tile/).slice(1);
  const records = [];

  for (const chunk of chunks) {
    const nameMatch = chunk.match(/class="store-finder__heading-link" href="([^"]+)">([^<]+)</);
    const addressRows = [...chunk.matchAll(/class="address-stores-v2__row">([^<]*)</g)].map((m) => m[1].trim());
    const phoneMatch = chunk.match(/href="tel:(\d+)"/);

    if (!nameMatch || addressRows.length < 3) continue; // malformed chunk — skip rather than guess

    const [addressLine1, city, postcode] = addressRows;

    records.push({
      branchName: nameMatch[2].trim(),
      address: addressLine1,
      city,
      postcode,
      phone: phoneMatch ? phoneMatch[1] : null,
      sourceUrl,
      // See the "IMPORTANT FINDING" comment above — deliberately null.
      metaEvidenceText: null,
      extractionMethod: 'targeted_dom_pattern',
      needsReview: false,
      // Not part of the shared record shape used by other sources, but
      // useful provenance step 2 can carry through if present.
      branchPageUrl: siteOrigin + nameMatch[1],
    });
  }

  return records;
}

// Generic fallbacks, kept for resilience if Vision Express's markup changes,
// or as a starting point when adapting this script for a different source.
function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // skip malformed blocks
    }
  }
  return blocks;
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})\b/gi;
const UK_PHONE_RE = /\b(0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4})\b/g;
const META_HINT_RE = /ray-?ban meta|smart glasses|ai glasses/i;

function recordsFromPostcodeScan(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const records = [];
  let match;
  const re = new RegExp(UK_POSTCODE_RE.source, 'gi');
  while ((match = re.exec(text)) !== null) {
    const postcode = match[1].toUpperCase();
    const start = Math.max(0, match.index - 200);
    const end = Math.min(text.length, match.index + 100);
    const context = text.slice(start, end).trim();
    const phoneMatch = context.match(UK_PHONE_RE);
    records.push({
      branchName: null,
      address: context,
      postcode,
      phone: phoneMatch ? phoneMatch[0] : null,
      sourceUrl: SOURCE_URL,
      metaEvidenceText: META_HINT_RE.test(context) ? context.match(META_HINT_RE)[0] : null,
      extractionMethod: 'postcode_text_scan',
      needsReview: true,
    });
  }
  return records;
}

// Exported so this same extraction logic can be tested against an
// already-saved copy of the page without a live fetch.
export function extractRecords(html) {
  const targeted = parseVisionExpressStoreList(html);
  if (targeted.length > 0) return { records: targeted, method: 'targeted_dom_pattern' };

  const jsonLdBlocks = extractJsonLdBlocks(html);
  if (jsonLdBlocks.length > 0) {
    // Left minimal deliberately — the targeted parser above is what this
    // script relies on for the real page structure; JSON-LD here is
    // company/organization schema, not store listings (confirmed 14 Aug
    // 2026), so it's not mapped to records at all rather than risk
    // producing a misleading single "head office" record again.
  }

  const scanned = recordsFromPostcodeScan(html);
  return { records: scanned, method: 'postcode_text_scan' };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`Fetching ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  const html = await res.text();

  const rawPath = join(OUTPUT_DIR, 'vision-express.raw.html');
  await writeFile(rawPath, html, 'utf-8');

  const { records, method } = extractRecords(html);

  const outputPath = join(OUTPUT_DIR, 'vision-express.json');
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
  console.log(`Also saved raw page HTML (fallback): ${rawPath}`);

  if (method !== 'targeted_dom_pattern') {
    console.log(
      '\nNote: the targeted parser found nothing, so this fell back to a rougher method. Vision Express may have ' +
        'changed their page structure — send back vision-express.raw.html so the parser can be updated.'
    );
  }

  console.log('\nPlease send back: scripts/ingest/output/vision-express.json (and the .raw.html if possible).');
}

// Only run the network fetch when executed directly (not when imported for
// testing against a saved HTML file). Comparing via pathToFileURL rather
// than a plain `file://${...}` string is required for this to work
// correctly on any path containing a space or other character that needs
// URL-encoding (e.g. a folder named "ban-meta-glasses-main 3") — a naive
// string comparison silently fails to match on such paths, which silently
// skips main() entirely with zero output and zero error. Confirmed this
// the hard way: it worked fine in testing from a path with no spaces, and
// failed silently (no error at all) from a real user's Downloads folder.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  });
}
