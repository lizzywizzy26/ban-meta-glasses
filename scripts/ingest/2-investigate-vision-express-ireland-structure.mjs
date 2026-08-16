#!/usr/bin/env node
// Investigation script (not a production fetch/parser) for the Vision
// Express Ireland "Dublin-group" anomaly — see the "Vision Express Ireland:
// the Dublin-group finding" section in data/stockists/RETAILER-MATRIX.md
// for full context on why this exists.
//
// Fetches three URLs and decodes each one's embedded Next.js/Apollo data
// the same way that finding was reached (this is a Next.js site — every
// page embeds a `<script id="__NEXT_DATA__">` blob containing the exact
// GraphQL response the page hydrates from, no JS execution needed):
//
//   1. visionexpress.ie/opticians/cork/cork-douglas-court  (Cork branch page)
//   2. visionexpress.ie/opticians/galway/galway            (Galway branch page)
//   3. visionexpress.ie/store-overview                     (believed to be
//      the general Ireland store directory — unconfirmed until this runs)
//
// For each, this prints: the GraphQL query key(s) found (same place the
// "groupName":"Dublin" finding came from), any store-level fields that look
// like a brand/product list (which would let us check Meta stocking
// programmatically instead of by keyword-guessing), and any raw mention of
// "Ray-Ban Meta" text specifically tied to store-level content. It does NOT
// decide verification status — that's a human judgment call once real
// output exists, per this project's core principle (a branch existing is
// not evidence it stocks Ray-Ban Meta).
//
// HOW TO RUN THIS (no coding knowledge needed):
//   1. Install Node.js if you don't already have it: https://nodejs.org (choose the "LTS" version)
//   2. Open Terminal (Mac) or Command Prompt (Windows)
//   3. Type "cd " (with a space after) then drag this project's folder into the window, then press Enter
//   4. Type this and press Enter:
//        node scripts/ingest/2-investigate-vision-express-ireland-structure.mjs
//   5. When it finishes, send back everything in scripts/ingest/output/ that
//      starts with "ve-ie-structure" — both the .raw.html files and the
//      .summary.json files.
//
// UNTESTED against the live site (16 Aug 2026) — same network-sandbox reason
// as every other fetch script in this project (this session's egress proxy
// blocks direct fetches to retailer domains, confirmed via the proxy status
// endpoint). Needs to be run locally.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

const TARGETS = [
  { slug: 'cork-douglas-court', url: 'https://www.visionexpress.ie/opticians/cork/cork-douglas-court' },
  { slug: 'galway', url: 'https://www.visionexpress.ie/opticians/galway/galway' },
  { slug: 'store-overview', url: 'https://www.visionexpress.ie/store-overview' },
];

function decodeNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// Walks any object/array looking for keys that look like a brand/product
// list on a store-shaped object (has a `name`/`town`/`postalCode`-ish
// sibling), so we don't have to guess the exact field name in advance —
// the real schema is unknown until this actually runs.
function findBrandLikeFields(node, path = '', results = [], seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return results;
  seen.add(node);
  if (Array.isArray(node)) {
    node.forEach((item, i) => findBrandLikeFields(item, `${path}[${i}]`, results, seen));
    return results;
  }
  const looksLikeStore = 'postalCode' in node || 'globalStoreId' in node || 'town' in node;
  for (const [key, value] of Object.entries(node)) {
    if (looksLikeStore && /brand|product|service|tag|feature/i.test(key)) {
      results.push({ path: `${path}.${key}`, storeName: node.name || node.slug || null, value });
    }
    if (value && typeof value === 'object') findBrandLikeFields(value, `${path}.${key}`, results, seen);
  }
  return results;
}

function findRayBanMetaMentions(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const mentions = [];
  const re = /ray-?ban meta/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = Math.max(0, match.index - 100);
    const end = Math.min(text.length, match.index + 100);
    mentions.push(text.slice(start, end).replace(/\s+/g, ' ').trim());
  }
  return [...new Set(mentions)];
}

async function investigate(target) {
  console.log(`\n=== Fetching ${target.url} ===`);
  const res = await fetch(target.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-IE,en;q=0.9',
    },
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  const html = await res.text();

  const rawPath = join(OUTPUT_DIR, `ve-ie-structure.${target.slug}.raw.html`);
  await writeFile(rawPath, html, 'utf-8');

  const nextData = decodeNextData(html);
  const summary = {
    url: target.url,
    httpStatus: res.status,
    fetchedAt: new Date().toISOString(),
    hasNextData: Boolean(nextData),
    page: nextData?.page || null,
    routeQueryParams: nextData?.query || null,
    graphqlQueryKeys: [],
    brandLikeFields: [],
    rayBanMetaTextMentions: findRayBanMetaMentions(html),
  };

  if (nextData) {
    const apolloState = nextData.props?.initialProps?.apolloState;
    const rootQuery = apolloState?.ROOT_QUERY;
    if (rootQuery) {
      summary.graphqlQueryKeys = Object.keys(rootQuery);
      summary.brandLikeFields = findBrandLikeFields(rootQuery).slice(0, 50);
      // Dump the full apolloState too — small enough to be worth keeping in
      // full rather than guessing what matters in advance.
      await writeFile(join(OUTPUT_DIR, `ve-ie-structure.${target.slug}.apollostate.json`), JSON.stringify(apolloState, null, 2), 'utf-8');
    }
  }

  const summaryPath = join(OUTPUT_DIR, `ve-ie-structure.${target.slug}.summary.json`);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  console.log(`GraphQL query keys found: ${JSON.stringify(summary.graphqlQueryKeys)}`);
  console.log(`Ray-Ban Meta text mentions found: ${summary.rayBanMetaTextMentions.length}`);
  console.log(`Brand-like fields found on store objects: ${summary.brandLikeFields.length}`);
  console.log(`Saved: ${rawPath}`);
  console.log(`Saved: ${summaryPath}`);

  return summary;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const summaries = [];
  for (const target of TARGETS) {
    try {
      summaries.push(await investigate(target));
    } catch (err) {
      console.error(`FAILED fetching ${target.url}: ${err.message}`);
      summaries.push({ url: target.url, error: err.message });
    }
  }

  console.log('\n--- Overall summary ---');
  for (const s of summaries) {
    console.log(`${s.url}: ${s.error ? `FAILED (${s.error})` : `${s.graphqlQueryKeys?.length || 0} query key(s), ${s.rayBanMetaTextMentions?.length || 0} Ray-Ban Meta mention(s)`}`);
  }

  console.log(
    '\nPlease send back everything in scripts/ingest/output/ starting with "ve-ie-structure" ' +
      '(.raw.html, .summary.json, and .apollostate.json files).'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Investigation failed:', err.message);
    process.exit(1);
  });
}
