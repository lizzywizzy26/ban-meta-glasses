#!/usr/bin/env node
// Fetches John Lewis's real per-branch live stock data for a Ray-Ban Meta
// SKU and saves it as ONE json file: scripts/ingest/output/john-lewis.json
//
// HOW TO RUN: same as the other scripts, no arguments.
//   node scripts/ingest/1-fetch-john-lewis.mjs
//
// HOW THIS WAS FOUND (15 Aug 2026): the campaign owner captured this via
// Chrome DevTools — clicking "Check in-store stock" on a Ray-Ban Meta
// product page immediately fires a request to
// api.johnlewis.com/stock/store-data with productCode/skuId/key query
// params, no postcode needed (it just returns every store's stock for
// that SKU in one go). Confirmed cookie-free: pasting the exact URL into
// a fresh Incognito window (zero existing cookies) returned the same
// data with no login/session required — so this is a plain, public GET,
// same shape as every other fetch script here.
//
// THE RESPONSE IS XML, NOT JSON — confirmed against a real saved capture
// (15 Aug 2026, 36 stores, tags observed: storeId, branchNumber, name,
// location > latitude/longitude/regionName, address (three untagged
// <address> children in a fixed order: street, town, postcode),
// phoneNumber, stockMessage, reservation > enabled/reason). No XML
// library is used — the structure is flat and repetitive enough that
// plain regex extraction (same approach as Vision Express's HTML
// parsing) is reliable and keeps this dependency-free like every other
// script in this pipeline. Tag names may come back lowercase or
// camelCase depending on how a browser/tool re-serializes them (observed
// both in different views of the same capture), so all matching below is
// case-insensitive.
//
// KNOWN CAVEATS from the real capture:
//   - stockMessage values seen: "N in stock" (real numbers, 1-5 in the
//     sample), "Not available", and "Stock information not available".
//     Per the campaign owner's decision, ONLY "N in stock" (N > 0) counts
//     as evidence for verified_branch — "Not available" branches are
//     still included in the output (so they're not silently lost) but
//     with metaEvidenceText left null, which caps them at
//     authorised_chain in step 2, same as any other unconfirmed branch.
//   - This is a LIVE snapshot, not a static fact — a branch showing "Not
//     available" today may have stock next week and vice versa. Unlike
//     Vision Express/David Clulow (one-time, stays valid), this dataset
//     should be re-fetched periodically to stay accurate, not treated as
//     a permanent result.
//   - <phoneNumber> looks to be a small number of shared/central numbers
//     reused across many branches in the sample (2 distinct numbers
//     across 36 stores), not a genuine per-branch direct line — included
//     as-is since it's what the source provides, but don't be surprised
//     if it's the same number on many records.
//   - This query is for a specific SKU (one colour/lens/model variant).
//     John Lewis lists ~29 Ray-Ban Meta models/variants total — a branch
//     with no stock for one SKU might still carry another. This script
//     queries every entry in SKU_QUERIES and merges the results by
//     storeId (John Lewis's own stable per-branch identifier, confirmed
//     consistent across different product queries for the same physical
//     store) — a branch is included with positive evidence if ANY
//     queried SKU shows positive stock there.
//
// MULTI-SKU COVERAGE CHECK (15 Aug 2026): captured two genuinely
// different variants deliberately chosen to maximise coverage
// differences, not near-identical colourways — Wayfarer (Gen 1,
// productCode=85900144) and Skyler (Gen 2, productCode=85900137). Both
// returned the exact same 36 physical stores (same store network queried
// regardless of SKU), but Skyler showed 0 positive-stock branches
// nationwide (35 "Not available", 1 "Stock information not available")
// against Wayfarer's 21 — a real finding, not a bug, confirmed by
// checking the actual response body. So the union is still 21 (Skyler
// added no new positive branches). A third variant (Headliner Gen 1) was
// attempted but is no longer available online at all (no stock checker
// exists for a discontinued listing) — not a data gap, just not a live
// product to query.
//
// Send back BOTH output files for every SKU — the raw XML matters most
// here, since if John Lewis changes this response shape, the regex
// parsing below needs updating to match.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

// Two SKUs confirmed working via the campaign owner's captures (15 Aug
// 2026) — see the file-level comment above for what each contributed.
const SKU_QUERIES = [
  { productCode: '85900144', skuId: '114260874', label: 'Wayfarer (Gen 1), Shiny Black, Clear' },
  { productCode: '85900137', skuId: '114260867', label: 'Skyler (Gen 2), Shiny Black' },
];
const API_KEY = 'AIzaSyDKwq7dHObeBImz7nMKWu_gUTw5CKY9a2M';
const SOURCE_URL = 'https://www.johnlewis.com/ray-ban-meta-wayfarer-glasses/shiny-black-clear-lens/p112066492';

// Merges records from multiple SKU queries into one row per physical
// branch, keyed by John Lewis's own storeId. A branch is kept with its
// positive-stock evidence if ANY queried SKU shows positive stock there;
// if none do, it's kept once with no evidence (caps at authorised_chain
// downstream, same as a single-SKU run).
export function mergeByStore(recordLists) {
  const byStore = new Map();
  for (const records of recordLists) {
    for (const rec of records) {
      const existing = byStore.get(rec._storeId);
      if (!existing) {
        byStore.set(rec._storeId, rec);
      } else if (rec.metaEvidenceText && !existing.metaEvidenceText) {
        // A later SKU found positive stock where an earlier one didn't —
        // upgrade to the positive record, keeping everything else about
        // the branch (address etc.) which should be identical anyway.
        byStore.set(rec._storeId, rec);
      }
    }
  }
  return [...byStore.values()];
}

const POSITIVE_STOCK_RE = /^\s*(\d+)\s+in stock\s*$/i;

// Exported so this same extraction logic can be tested against an
// already-saved copy of the response without a live fetch.
export function parseJohnLewisStoreXml(xml, sourceUrl) {
  const records = [];
  // Each store record runs from its own <storeId> to its own closing
  // </storeStock> — non-greedy so this can't accidentally span into the
  // next store's block. Store records don't nest inside each other, so
  // this is safe despite <storeStock> also being the name of the
  // wrapping array element.
  const storeRe = /<storeid>\s*(\d+)\s*<\/storeid>([\s\S]*?)<\/storestock>/gi;
  let match;
  while ((match = storeRe.exec(xml)) !== null) {
    const storeId = match[1];
    const chunk = match[2];

    // Branch name is the first <name> in the chunk — <name> is reused
    // inside the nested opening-hours structure for day names (Mon, Tue,
    // ...), so only the FIRST match (which always precedes the opening
    // hours section in every observed record) is the branch name.
    const nameMatch = chunk.match(/<name>([^<]*)<\/name>/i);
    const branchName = nameMatch ? `John Lewis ${nameMatch[1].trim()}` : `John Lewis (store ${storeId})`;

    const latMatch = chunk.match(/<latitude>([^<]*)<\/latitude>/i);
    const lonMatch = chunk.match(/<longitude>([^<]*)<\/longitude>/i);

    // The address lines share the exact same tag name with no
    // distinguishing attribute. This regex only matches leaf
    // <address>text</address> pairs (no nested tags allowed inside the
    // capture group), which skips the wrapping <address><address>...
    // outer element automatically, since its opening tag is immediately
    // followed by another tag, not text.
    //
    // BUG FOUND AND FIXED (15 Aug 2026): most stores have exactly 3 lines
    // (street, town, postcode), but shopping-centre branches have 4 (e.g.
    // White City: "White City", "Westfield Ariel Way", "London",
    // "W12 7FU") — an extra unit/centre-name line at the front. Taking a
    // fixed 3rd position as "postcode" silently grabbed "London" instead
    // of the real postcode for every such store. The postcode is
    // reliably the LAST line regardless of how many there are (UK
    // addresses always end with the postcode), so this takes it from the
    // end, not a fixed position.
    const addressLines = [...chunk.matchAll(/<address>([^<]+)<\/address>/gi)].map((m) => m[1].trim());
    const postcode = addressLines.length ? addressLines[addressLines.length - 1] : null;
    const town = addressLines.length > 1 ? addressLines[addressLines.length - 2] : null;
    const street = addressLines.slice(0, Math.max(0, addressLines.length - 2)).join(', ') || null;

    const phoneMatch = chunk.match(/<phonenumber>([^<]*)<\/phonenumber>/i);
    const stockMatch = chunk.match(/<stockmessage>([^<]*)<\/stockmessage>/i);
    const stockMessage = stockMatch ? stockMatch[1].trim() : null;
    const positiveStock = stockMessage ? POSITIVE_STOCK_RE.test(stockMessage) : false;

    if (!postcode) continue; // no usable location without a postcode

    records.push({
      branchName,
      address: [street, town].filter(Boolean).join(', ') || null,
      city: town || null,
      postcode,
      phone: phoneMatch ? phoneMatch[1].trim() : null,
      sourceUrl,
      // Only set when stock is genuinely positive right now — per the
      // campaign owner's explicit decision, "Not available" branches
      // stay in the data (so nothing's silently dropped) but without
      // evidence, which caps them at authorised_chain downstream.
      metaEvidenceText: positiveStock ? stockMessage : null,
      extractionMethod: 'first_party_live_stock_api',
      needsReview: false,
      branchPageUrl: sourceUrl,
      // Real coordinates straight from John Lewis's own store database —
      // step 2 (2-normalize-and-geocode.mjs) uses these directly instead
      // of re-deriving from the postcode via postcodes.io, when present.
      latitude: latMatch ? Number(latMatch[1].trim()) : null,
      longitude: lonMatch ? Number(lonMatch[1].trim()) : null,
      _storeId: storeId,
      _stockMessageRaw: stockMessage,
    });
  }
  return records;
}

async function fetchOneSku({ productCode, skuId }) {
  const url = `https://api.johnlewis.com/stock/store-data?productCode=${encodeURIComponent(productCode)}&skuId=${encodeURIComponent(skuId)}&key=${encodeURIComponent(API_KEY)}`;
  console.log(`Fetching ${url} ...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/xml,text/xml,*/*',
    },
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  const xml = await res.text();
  return { xml, status: res.status };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const recordLists = [];
  const rawXmlParts = [];
  let lastStatus = null;

  for (const skuQuery of SKU_QUERIES) {
    console.log(`\n${skuQuery.label || `${skuQuery.productCode}/${skuQuery.skuId}`}:`);
    const { xml, status } = await fetchOneSku(skuQuery);
    lastStatus = status;
    rawXmlParts.push(`<!-- productCode=${skuQuery.productCode} skuId=${skuQuery.skuId} (${skuQuery.label || ''}) -->\n${xml}`);
    const records = parseJohnLewisStoreXml(xml, SOURCE_URL);
    console.log(`  -> ${records.length} store record(s), ${records.filter((r) => r.metaEvidenceText).length} with positive stock`);
    recordLists.push(records);
  }

  const mergedRecords = mergeByStore(recordLists);

  const rawPath = join(OUTPUT_DIR, 'john-lewis.raw.xml');
  await writeFile(rawPath, rawXmlParts.join('\n\n'), 'utf-8');

  const outputPath = join(OUTPUT_DIR, 'john-lewis.json');
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        sourceUrl: SOURCE_URL,
        fetchedAt: new Date().toISOString(),
        httpStatus: lastStatus,
        extractionMethod: 'first_party_live_stock_api',
        recordCount: mergedRecords.length,
        records: mergedRecords,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`\nMerged across ${SKU_QUERIES.length} SKU(s): ${mergedRecords.length} unique physical branch(es), ${mergedRecords.filter((r) => r.metaEvidenceText).length} with positive stock on at least one queried variant.`);
  console.log(`Saved: ${outputPath}`);
  console.log(`Also saved raw XML response(s): ${rawPath}`);
  console.log('\nPlease send back BOTH files.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  });
}
