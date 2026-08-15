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
// BUG FIX (15 Aug 2026): the first version of this script stripped
// <script>...</script> content out of the HTML before searching it for
// Meta-related terms. That's exactly backwards for this platform — we
// already confirmed in 1-fetch-rayban.mjs that these Yext Pages sites embed
// their real page data INSIDE a <script type="module"> block as a
// decodeURIComponent(JSON) blob, not in the visible markup. So the first
// run's "0 mentions found on all 7 pages" result is meaningless — it never
// looked at the part of the page that could contain real content (the
// ~400-character text length reported for every page in that run is the
// tell: that's just the static shell, not a rendered store page). This
// version decodes the same embedded JSON 1-fetch-rayban.mjs uses (via the
// shared decodeYextPageProps() it exports) and searches the FULL decoded
// object, not stripped visible text.
//
// HOW TO RUN: same as the other scripts — no arguments needed.
//   node scripts/ingest/2-investigate-rayban-branch-signal.mjs
//
// Sends back: scripts/ingest/output/rayban-branch-signal-investigation.json

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeYextPageProps } from './1-fetch-rayban.mjs';

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

function findMentions(text) {
  const lower = text.toLowerCase();
  const mentions = [];
  for (const term of META_TERMS) {
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      mentions.push({ term, context: text.slice(Math.max(0, idx - 150), idx + 150).trim() });
      idx = lower.indexOf(term, idx + term.length);
    }
  }
  return mentions;
}

function analyze(html, url) {
  const data = decodeYextPageProps(html);

  if (!data) {
    // Encoding scheme didn't match what 1-fetch-rayban.mjs found — fall
    // back to a full (unstripped) text scan rather than silently reporting
    // a false negative like the buggy first version did.
    const mentions = findMentions(html);
    return { url, decodeSucceeded: false, mentionsFound: mentions, htmlLength: html.length };
  }

  const doc = data.document || {};
  const docJson = JSON.stringify(doc);
  const mentions = findMentions(docJson);

  // List every custom field ("c_..." prefix is Yext's convention for
  // per-site custom fields) so a human can review field names even if none
  // of them literally contain our search terms — the real field, if any,
  // might be named something we didn't think to search for (e.g. a
  // "services" or "featuredProducts" list rendered as icons/images rather
  // than text).
  const customFieldKeys = Object.keys(doc).filter((k) => k.startsWith('c_'));
  const customFieldPreview = {};
  for (const key of customFieldKeys) {
    const val = doc[key];
    customFieldPreview[key] = typeof val === 'string' ? val.slice(0, 500) : val;
  }

  return {
    url,
    decodeSucceeded: true,
    mentionsFound: mentions,
    customFieldKeys,
    customFieldPreview,
  };
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
      console.log(
        `  status ${res.status}, decode succeeded: ${result.decodeSucceeded}, Meta-related mentions: ${result.mentionsFound.length}` +
          (result.customFieldKeys ? `, custom fields: ${result.customFieldKeys.join(', ') || '(none)'}` : '')
      );
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
