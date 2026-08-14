#!/usr/bin/env node
// One-off investigative script — NOT part of the numbered pipeline (that's
// why it isn't "2-" in the sequential sense the other scripts are).
//
// Question: the main Vision Express Ray-Ban Meta locator page lists 440
// stores with no per-branch signal distinguishing which ones actually carry
// Ray-Ban Meta (see README.md). Does an INDIVIDUAL branch's own page show
// that information instead? This fetches a small spread of real branch
// pages (not all 440 — this is a yes/no investigation, not ingestion) and
// reports what it finds.
//
// HOW TO RUN: same as the other scripts — no arguments needed.
//   node scripts/ingest/2-investigate-branch-page-signal.mjs
//
// Sends back: scripts/ingest/output/branch-signal-investigation.json

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

// A spread across the 440-store list (first, ~25%, ~50%, ~75%, last) from
// the real fetch on 14 Aug 2026 — not cherry-picked, just structural
// diversity (different regions, different store-name patterns).
const SAMPLE_URLS = [
  'https://www.visionexpress.com/opticians/aberdeen/aberdeen',
  'https://www.visionexpress.com/opticians/edinburgh/edinburgh-frederickstreet',
  'https://www.visionexpress.com/opticians/mold/mold',
  'https://www.visionexpress.com/opticians/windsor/windsor',
  'https://www.visionexpress.com/opticians/london/london-white-city',
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

  for (const url of SAMPLE_URLS) {
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

  const outputPath = join(OUTPUT_DIR, 'branch-signal-investigation.json');
  await writeFile(outputPath, JSON.stringify({ investigatedAt: new Date().toISOString(), sampleSize: SAMPLE_URLS.length, results }, null, 2), 'utf-8');

  console.log(`\nSaved: ${outputPath}`);
  console.log('Please send this file back.');
}

main().catch((err) => {
  console.error('Investigation failed:', err.message);
  process.exit(1);
});
