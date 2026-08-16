#!/usr/bin/env node
// Follow-up to 2-investigate-vision-express-ireland-structure.mjs (read that
// script's comments and data/stockists/RETAILER-MATRIX.md's "Vision Express
// Ireland: the Dublin-group finding" section first — this builds directly on
// what that investigation found).
//
// That investigation discovered a much stronger evidence source than the
// broken "Ray-Ban Meta" group page: each individual branch's own page data
// includes a structured `features.availableBrands` field, confirmed (for
// Cork and Galway) to explicitly list "Ray-Ban Meta" by name when stocked.
//
// This script fetches the remaining 9 branches not yet checked at that same
// standard — the 6 Dublin-group branches (currently only evidenced by
// appearing on the mislabeled Dublin page, a weaker evidence type) plus the
// 3 single-store towns nobody has looked at yet (Portlaoise, Naas,
// Maynooth) — and reports, for each, whether "Ray-Ban Meta" appears in its
// own availableBrands list. This does NOT assign verification status
// itself — that stays a human call, per this project's core verification
// principle (a branch existing, or even appearing on a themed page, is not
// the same as this specific branch's own data confirming the product).
//
// HOW TO RUN THIS (no coding knowledge needed):
//   1. Install Node.js if you don't already have it: https://nodejs.org (choose the "LTS" version)
//   2. Open Terminal (Mac) or Command Prompt (Windows)
//   3. Type "cd " (with a space after) then drag this project's folder into the window, then press Enter
//   4. Type this and press Enter:
//        node scripts/ingest/2-fetch-vision-express-ireland-branch-details.mjs
//   5. Send back everything in scripts/ingest/output/ starting with "ve-ie-branch"
//
// If running this in this project's sandboxed session hits "403 Forbidden" /
// "Host not in allowlist" for every URL, that's this session's network
// egress policy, not a bug — see RETAILER-MATRIX.md. In that case, use the
// no-terminal fallback instead: open each URL below in a normal browser,
// save the page (Ctrl+S / Cmd+S, "Webpage, HTML Only"), and send the saved
// files back the same way as before.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

// Dublin branchPageUrls come directly from the already-fetched
// vision-express-ireland.json (see the earlier "Dublin group" fetch).
// Portlaoise/Naas/Maynooth URLs are CONSTRUCTED from their slugs in
// listStoreGroups.singleStoreGroups, following the /opticians/{town}/{slug}
// pattern confirmed for Cork and Galway — unverified until this actually
// runs; if one 404s, that's useful information too, send back the raw HTML.
const TARGETS = [
  { slug: 'dublin-blanchardstown', url: 'https://www.visionexpress.ie/opticians/dublin/dublin-blanchardstown' },
  { slug: 'dublin-henry-street', url: 'https://www.visionexpress.ie/opticians/dublin/dublin-henry-street' },
  { slug: 'dublin-tallaght', url: 'https://www.visionexpress.ie/opticians/dublin/dublin-tallaght' },
  { slug: 'dublin-liffey-valley', url: 'https://www.visionexpress.ie/opticians/dublin/dublin-liffey-valley' },
  { slug: 'dublin-clarehall', url: 'https://www.visionexpress.ie/opticians/dublin/clarehall' },
  { slug: 'dublin-balbriggan', url: 'https://www.visionexpress.ie/opticians/dublin/balbriggan-vision-express-at-tesco' },
  { slug: 'portlaoise', url: 'https://www.visionexpress.ie/opticians/portlaoise/portlaoise-vision-express-at-tesco' },
  { slug: 'naas', url: 'https://www.visionexpress.ie/opticians/naas/naas-vision-express-at-tesco' },
  { slug: 'maynooth', url: 'https://www.visionexpress.ie/opticians/maynooth/maynooth-vision-express-at-tesco' },
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

function extractStoreFromRootQuery(rootQuery) {
  if (!rootQuery) return null;
  const key = Object.keys(rootQuery).find((k) => k.startsWith('store('));
  return key ? rootQuery[key] : null;
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

  const rawPath = join(OUTPUT_DIR, `ve-ie-branch.${target.slug}.raw.html`);
  await writeFile(rawPath, html, 'utf-8');

  const nextData = decodeNextData(html);
  const rootQuery = nextData?.props?.initialProps?.apolloState?.ROOT_QUERY;
  const store = extractStoreFromRootQuery(rootQuery);

  const brands = store?.features?.availableBrands?.map((b) => b.name) || null;
  const hasRayBanMeta = Array.isArray(brands) ? brands.includes('Ray-Ban Meta') : null;

  const summary = {
    url: target.url,
    httpStatus: res.status,
    fetchedAt: new Date().toISOString(),
    hasNextData: Boolean(nextData),
    storeFound: Boolean(store),
    storeName: store?.name || null,
    slug: store?.slug || null,
    postalCode: store?.postalCode || null,
    lat: store?.lat ?? null,
    lon: store?.lon ?? null,
    phone: store?.phone || null,
    town: store?.town || null,
    province: store?.province || null,
    availableBrands: brands,
    hasRayBanMeta,
  };

  const summaryPath = join(OUTPUT_DIR, `ve-ie-branch.${target.slug}.summary.json`);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  console.log(`Store found: ${summary.storeFound} (${summary.storeName || 'n/a'})`);
  console.log(`Ray-Ban Meta in availableBrands: ${hasRayBanMeta === null ? 'UNKNOWN (no store data found)' : hasRayBanMeta}`);
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
    if (s.error) {
      console.log(`${s.url}: FAILED (${s.error})`);
    } else {
      console.log(`${s.storeName || s.url}: Ray-Ban Meta = ${s.hasRayBanMeta === null ? 'UNKNOWN' : s.hasRayBanMeta}`);
    }
  }

  console.log('\nPlease send back everything in scripts/ingest/output/ starting with "ve-ie-branch" (.raw.html and .summary.json files).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  });
}
