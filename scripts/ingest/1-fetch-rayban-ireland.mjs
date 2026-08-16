#!/usr/bin/env node
// Ireland counterpart to 1-fetch-rayban.mjs. Fetches Ray-Ban's official
// Ireland store locator and saves what it finds as ONE json file:
// scripts/ingest/output/rayban-ireland.json
//
// HOW TO RUN THIS (no coding knowledge needed):
//   1. Install Node.js if you don't already have it: https://nodejs.org (choose the "LTS" version)
//   2. Open Terminal (Mac) or Command Prompt (Windows)
//   3. Type "cd " (with a space after) then drag this project's folder into the window, then press Enter
//   4. Type this and press Enter:
//        node scripts/ingest/1-fetch-rayban-ireland.mjs
//   5. When it finishes, send back the file it created:
//        scripts/ingest/output/rayban-ireland.json
//      (and scripts/ingest/output/rayban-ireland.raw.html too, just in case)
//
// CONFIRMED WORKING against the real live site (16 Aug 2026, run by the
// campaign owner): 1 real record — Ray-Ban's own-brand boutique on Grafton
// Street, Dublin. Verified genuine, not a discovery gap: the decoded Yext
// payload's own `document.dm_baseEntityCount` field says "1", matching the
// walk exactly — same evidence pattern that confirmed the UK's count of 7.
// See data/stockists/RETAILER-MATRIX.md's "Ireland coverage" section for
// the full verification writeup.
//
// One thing to watch for that's genuinely different from the UK case: each
// entity's address.countryCode is captured and logged below — if it comes
// back "IE" for every record, the country label is safe to trust; if it's
// missing, or "GB", or mixed, that needs a human look before this data is
// used, since it would mean either the source lists non-Ireland stores on
// this page, or the country field isn't populated the way it is for the UK.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodeYextPageProps, parseYextDirectoryJson } from './1-fetch-rayban.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const SOURCE_URL = 'https://stores.ray-ban.com/ireland';
const SITE_ORIGIN = 'https://stores.ray-ban.com';

export function extractRecords(html) {
  const targeted = parseYextDirectoryJson(html, { sourceUrl: SOURCE_URL, siteOrigin: SITE_ORIGIN });
  if (targeted.length > 0) return { records: targeted, method: 'targeted_yext_directory_json' };

  // Deliberately no generic fallback here (unlike the UK script) — a
  // postcode-text-scan fallback would be tuned to UK postcode shapes and
  // would silently produce garbage for Eircodes. If the targeted parser
  // finds nothing, that's a real signal to look at the raw HTML by hand
  // rather than guess.
  return { records: [], method: 'targeted_yext_directory_json_empty' };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`Fetching ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-IE,en;q=0.9',
    },
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  const html = await res.text();

  const rawPath = join(OUTPUT_DIR, 'rayban-ireland.raw.html');
  await writeFile(rawPath, html, 'utf-8');

  const { records, method } = extractRecords(html);
  const countryCodes = [...new Set(records.map((r) => r.countryCode))];

  const outputPath = join(OUTPUT_DIR, 'rayban-ireland.json');
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
  console.log(`Country codes seen on these records: ${JSON.stringify(countryCodes)}`);
  console.log(`Saved: ${outputPath}`);
  console.log(`Also saved raw page HTML: ${rawPath}`);

  if (records.length === 0) {
    console.log(
      '\nNote: the targeted parser found nothing. This page may use a different structure than the UK one, or ' +
        'the fetch may have been blocked. Please send back rayban-ireland.raw.html so this can be checked.'
    );
  }

  console.log('\nPlease send back BOTH files.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  });
}
