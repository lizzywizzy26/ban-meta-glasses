#!/usr/bin/env node
// One-off investigative script — NOT part of the numbered pipeline, same
// pattern as 2-investigate-branch-page-signal.mjs (Vision Express's
// equivalent).
//
// Question: Ray-Ban's UK directory (see 1-fetch-rayban.mjs) lists 7
// own-brand boutiques, but that's chain/brand identity, not branch-level
// evidence that Ray-Ban Meta specifically is stocked or demoable at any of
// them. Does each store's own individual page say anything more specific?
// Unlike Vision Express (440 stores, so a 5-store sample), there are only 7
// Ray-Ban stores total in the UK — this checks all 7, not a sample.
//
// HOW TO RUN: same as the other scripts — no arguments needed.
//   node scripts/ingest/2-investigate-rayban-branch-signal.mjs
//
// Sends back: scripts/ingest/output/rayban-branch-signal-investigation.json

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

// All 7 branch page URLs, taken directly from the branchPageUrl field of
// the real rayban.json produced by 1-fetch-rayban.mjs on 14 Aug 2026 — not
// re-derived or guessed here, so if the directory ever changes, re-run step
// 1 first and update this list from its output.
const ALL_STORE_URLS = [
  'https://stores.ray-ban.com/united-kingdom/west-sussex/crawley/airside-departures-north-terminal',
  'https://stores.ray-ban.com/united-kingdom/greater-london/london/15-james-st',
  'https://stores.ray-ban.com/united-kingdom/scotland/glasgow/buchanan-street',
  'https://stores.ray-ban.com/united-kingdom/london/45-carnaby-st',
  'https://stores.ray-ban.com/united-kingdom/london/circus-rd',
  'https://stores.ray-ban.com/united-kingdom/london/unit-e6-prince-charles-dr',
  'https://stores.ray-ban.com/united-kingdom/london/stratford-westfield-upper',
];

const META_TERMS = ['ray-ban meta', 'smart glasses', 'ai glasses', 'meta ai'];

function analyze(html, url) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const mentions = META_TERMS.filter((term) => text.includes(term));
  // Look for anything that reads like an availability flag near a mention,
  // e.g. "available at this store" / "not available at this store".
  const availabilityHints = [];
  for (const term of mentions) {
    const idx = text.indexOf(term);
    const context = text.slice(Math.max(0, idx - 150), idx + 150);
    if (/available|in stock|demo|try (it|them) (in|at)/i.test(context)) {
      availabilityHints.push(context.trim());
    }
  }
  return { url, mentionsFound: mentions, availabilityHints, textLength: text.length };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const results = [];

  for (const url of ALL_STORE_URLS) {
    console.log(`Fetching ${url} ...`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-GB,en;q=0.9',
        },
      });
      const html = await res.text();
      const result = analyze(html, url);
      result.httpStatus = res.status;
      results.push(result);
      console.log(`  status ${res.status}, Meta-related terms found: ${result.mentionsFound.join(', ') || '(none)'}`);
    } catch (err) {
      results.push({ url, error: err.message });
      console.log(`  FAILED: ${err.message}`);
    }
  }

  const outputPath = join(OUTPUT_DIR, 'rayban-branch-signal-investigation.json');
  await writeFile(
    outputPath,
    JSON.stringify({ investigatedAt: new Date().toISOString(), sampleSize: ALL_STORE_URLS.length, isCompleteSet: true, results }, null, 2),
    'utf-8'
  );

  console.log(`\nSaved: ${outputPath}`);
  console.log('Please send this file back.');
}

main().catch((err) => {
  console.error('Investigation failed:', err.message);
  process.exit(1);
});
