#!/usr/bin/env node
// Ireland counterpart to 1-fetch-vision-express.mjs. Fetches the Vision
// Express Ireland Ray-Ban Meta stockist directory and saves what it finds as
// ONE json file: scripts/ingest/output/vision-express-ireland.json
//
// HOW TO RUN THIS (no coding knowledge needed):
//   1. Install Node.js if you don't already have it: https://nodejs.org (choose the "LTS" version)
//   2. Open Terminal (Mac) or Command Prompt (Windows)
//   3. Type "cd " (with a space after) then drag this project's folder into the window, then press Enter
//   4. Type this and press Enter:
//        node scripts/ingest/1-fetch-vision-express-ireland.mjs
//   5. When it finishes, send back the file it created:
//        scripts/ingest/output/vision-express-ireland.json
//      (and scripts/ingest/output/vision-express-ireland.raw.html too, just in case)
//
// CONFIRMED WORKING against the real live site (16 Aug 2026, run by the
// campaign owner): the /opticians/ray-ban-meta candidate URL (same pattern
// as the UK) returned 6 real records, all in Dublin; the other two
// candidates returned 0, confirming /opticians/ray-ban-meta is the right
// page. Parser correctness verified against the real raw HTML: exactly 6
// store-tile elements exist in the page, matching all 6 extracted records —
// nothing was missed. As expected from the UK page's behaviour, no
// coordinates are embedded in this markup, so 2-normalize-and-geocode.mjs
// places these at a town-centroid coordinate, flagged in each record's
// `notes` field. One open question, NOT yet resolved: all 6 results being
// in Dublin doesn't match earlier research finding real Vision Express
// Ireland branches in Cork/Galway/Athlone — see
// data/stockists/RETAILER-MATRIX.md's "Ireland coverage" section for the
// full writeup on why this might be a genuine curated list rather than a
// gap, and what would settle it.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseVisionExpressStoreList } from './1-fetch-vision-express.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const SITE_ORIGIN = 'https://www.visionexpress.ie';

// Tried in order; first one where the targeted parser finds store markup
// wins. Not a guess about which is "correct" — genuinely unknown without a
// live fetch, so this just tries the plausible candidates rather than
// picking one blind.
const CANDIDATE_URLS = [
  'https://www.visionexpress.ie/opticians/ray-ban-meta',
  'https://www.visionexpress.ie/brands/ray-ban-meta',
  'https://www.visionexpress.ie/ai-glasses/ray-ban',
];

async function fetchCandidate(url) {
  console.log(`Trying ${url} ...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-IE,en;q=0.9',
    },
  });
  console.log(`  Status: ${res.status} ${res.statusText}`);
  const html = await res.text();
  const records = parseVisionExpressStoreList(html, { sourceUrl: url, siteOrigin: SITE_ORIGIN });
  console.log(`  Targeted parser found ${records.length} record(s) on this URL.`);
  return { url, status: res.status, html, records };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const attempts = [];
  let winner = null;
  for (const url of CANDIDATE_URLS) {
    const attempt = await fetchCandidate(url);
    attempts.push(attempt);
    if (attempt.records.length > 0 && !winner) winner = attempt;
  }

  // Save the raw HTML of every candidate tried, not just the winner — makes
  // it possible to fix the parser against whichever page actually has the
  // data, even if this run picks the wrong one or finds nothing at all.
  for (const attempt of attempts) {
    const slug = attempt.url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-');
    await writeFile(join(OUTPUT_DIR, `vision-express-ireland.${slug}.raw.html`), attempt.html, 'utf-8');
  }

  const chosen = winner || attempts[0];
  const outputPath = join(OUTPUT_DIR, 'vision-express-ireland.json');
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        sourceUrl: chosen.url,
        candidatesTried: attempts.map((a) => ({ url: a.url, httpStatus: a.status, recordCount: a.records.length })),
        fetchedAt: new Date().toISOString(),
        httpStatus: chosen.status,
        extractionMethod: winner ? 'targeted_dom_pattern' : 'targeted_dom_pattern_empty',
        recordCount: chosen.records.length,
        records: chosen.records,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`\n--- Summary ---`);
  for (const a of attempts) console.log(`${a.url}: ${a.records.length} record(s)`);
  console.log(`\nUsed: ${chosen.url} (${chosen.records.length} records)`);
  console.log(`Saved: ${outputPath}`);
  console.log(`Raw HTML saved for all ${attempts.length} candidate URL(s) tried.`);

  if (!winner) {
    console.log(
      '\nNote: none of the candidate URLs matched the UK markup pattern. Please send back ALL the ' +
        'vision-express-ireland.*.raw.html files so the real page structure can be checked.'
    );
  }

  console.log('\nPlease send back: scripts/ingest/output/vision-express-ireland.json and the raw.html files.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  });
}
