#!/usr/bin/env node
// Fetches Ray-Ban's official UK store locator and saves what it finds as
// ONE json file: scripts/ingest/output/rayban.json
//
// HOW TO RUN: same as the other scripts, no arguments.
//   node scripts/ingest/1-fetch-rayban.mjs
//
// CONFIRMED FROM THE FIRST REAL RUN (14 Aug 2026): the visible HTML has no
// store markup at all — the page is a Yext "Pages" site (stores.ray-ban.com,
// same platform Yext uses for thousands of brand locators) that renders
// client-side. But the initial HTML response is NOT empty of data: it embeds
// the full directory as a URL-encoded JSON blob, passed straight into the
// client-side render call —
//   pageProps: JSON.parse(decodeURIComponent("%7B%22document%22...
// decodeURIComponent() + JSON.parse() on that string reconstructs the exact
// same `document` object the React/Preact component hydrates from, so there
// is no need to execute JS or render the page — the source data is already
// there, just percent-encoded. Confirmed against a real saved copy of the
// page (14 Aug 2026): document.dm_baseEntityCount = "7", and recursively
// walking document.dm_directoryChildren down to leaf nodes (identified by
// having an `address` key) yields exactly 7 real UK entities with clean
// addresses, postcodes, and lat/long — Gatwick Airport, Covent Garden,
// Glasgow Buchanan Street, Carnaby Street, Battersea Power Station, Brent
// Cross, and Stratford Westfield.
//
// IMPORTANT — these are Ray-Ban's own-brand retail boutiques, not a
// "stockist directory" of other shops selling Ray-Ban product. That means
// this is a SMALL, complete list (all UK Ray-Ban-branded stores, not a
// filtered subset) — but it also means, per this project's core data
// principle, "this is a Ray-Ban store" is chain/brand-level identity, not
// branch-level evidence that Ray-Ban Meta specifically is stocked or
// demoable there. So metaEvidenceText is deliberately left null here too,
// same as Vision Express's first pass — see
// scripts/ingest/2-investigate-rayban-branch-signal.mjs for the follow-up
// check of whether each store's own individual page (URL captured per
// record below as branchPageUrl) says anything more specific. With only 7
// stores, that investigation script checks all of them, not a sample.
//
// No phone number field exists anywhere in the decoded JSON for any of the
// 7 entities (checked: zero occurrences of "phone" in the whole decoded
// blob) — phone is genuinely absent from this source, not a parsing miss.
//
// Generic fallbacks are kept below in case Yext changes this encoding
// scheme in the future, or as a starting point for another Yext-powered
// source.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const SOURCE_URL = 'https://stores.ray-ban.com/united-kingdom';
const SITE_ORIGIN = 'https://stores.ray-ban.com';

// Every page on this Yext "Pages" platform — the country-level directory
// AND each individual store page — embeds its data the same way: a
// `decodeURIComponent("...")` call in a <script type="module"> block,
// containing the exact object the client-side component hydrates from.
// Exported so both the directory parser below and the branch-page signal
// investigation script can decode either kind of page with one function.
export function decodeYextPageProps(html) {
  const marker = 'decodeURIComponent("';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const contentStart = start + marker.length;
  const end = html.indexOf('"))', contentStart);
  if (end === -1) return null;

  try {
    const decoded = decodeURIComponent(html.slice(contentStart, end));
    return JSON.parse(decoded);
  } catch {
    return null; // encoding scheme changed
  }
}

// Targeted parser for the country-level directory page specifically: walks
// the decoded document's directory tree for leaf entities (stores).
//
// sourceUrl/siteOrigin are parameterized (defaulting to this file's UK
// constants) so the exact same walk/decode logic can be reused for another
// country on the same Yext platform (e.g. stores.ray-ban.com/ireland) without
// duplicating this function — see 1-fetch-rayban-ireland.mjs.
export function parseYextDirectoryJson(html, { sourceUrl = SOURCE_URL, siteOrigin = SITE_ORIGIN } = {}) {
  const data = decodeYextPageProps(html);
  const doc = data?.document;
  if (!doc || typeof doc !== 'object') return [];

  function* walkLeafEntities(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) yield* walkLeafEntities(item);
      return;
    }
    if (node.address && typeof node.address === 'object') {
      yield node;
    }
    if (Array.isArray(node.dm_directoryChildren)) {
      for (const child of node.dm_directoryChildren) yield* walkLeafEntities(child);
    }
  }

  const records = [];
  for (const entity of walkLeafEntities(doc)) {
    const addr = entity.address || {};
    // Yext's field is called postalCode regardless of country — for Ireland
    // this may hold a real Eircode, an empty string, or be absent, depending
    // on how each store's address was entered. Left as-is here (not UK-postcode
    // validated) — 2-normalize-and-geocode.mjs decides per-country what to do
    // with it; this parser's job is just to extract what the source actually
    // has, not to assume a shape.
    const postcode = addr.postalCode || null;

    const label = entity.geomodifier || addr.extraDescription || addr.sublocality || null;
    records.push({
      branchName: label ? `${entity.name || 'Ray-Ban'} – ${label}` : entity.name || 'Ray-Ban',
      address: [addr.line1, addr.line2].filter(Boolean).join(', ') || null,
      city: addr.city || null,
      postcode,
      // Yext stores coordinates on the entity itself — confirmed by decoding
      // the real saved UK capture (fixtures/rayban-uk-directory.raw.html):
      // every leaf entity has both yextDisplayCoordinate and
      // geocodedCoordinate objects. Captured here so step 2 can use real
      // source coordinates instead of depending on postcode-based geocoding
      // — which matters for Ireland, where postcodes.io doesn't apply at all.
      latitude: entity.yextDisplayCoordinate?.latitude ?? entity.geocodedCoordinate?.latitude ?? null,
      longitude: entity.yextDisplayCoordinate?.longitude ?? entity.geocodedCoordinate?.longitude ?? null,
      // Also confirmed present on the real capture (addr.countryCode, e.g.
      // "GB") — carried through so step 2 can sanity-check the --country
      // flag against what the source itself says, rather than trusting the
      // flag blindly.
      countryCode: addr.countryCode || null,
      phone: null, // confirmed absent from this source, see comment above
      sourceUrl,
      // Chain/brand identity only — see the file-level comment for why this
      // stays null pending the branch-page investigation script.
      metaEvidenceText: null,
      extractionMethod: 'targeted_yext_directory_json',
      needsReview: false,
      branchPageUrl: entity.slug ? `${siteOrigin}/${entity.slug}` : sourceUrl,
    });
  }
  return records;
}

// Generic fallbacks, kept for resilience if Yext changes this page's
// encoding, or as a starting point for a different Yext-powered source.
const UK_POSTCODE_RE = /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})\b/gi;
const UK_PHONE_RE = /\b(0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4})\b/g;
const META_HINT_RE = /ray-?ban meta|smart glasses|ai glasses/i;

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

function recordsFromJsonLd(blocks) {
  const records = [];
  const stack = [...blocks];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    const type = node['@type'];
    if (typeof type === 'string' && /store|localbusiness|opticalstore/i.test(type)) {
      const addr = node.address || {};
      records.push({
        branchName: node.name || null,
        address: [addr.streetAddress, addr.addressLocality].filter(Boolean).join(', ') || null,
        postcode: addr.postalCode || null,
        phone: node.telephone || null,
        sourceUrl: SOURCE_URL,
        metaEvidenceText: null,
        extractionMethod: 'json_ld',
        needsReview: false,
      });
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return records;
}

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
  const targeted = parseYextDirectoryJson(html);
  if (targeted.length > 0) return { records: targeted, method: 'targeted_yext_directory_json' };

  const jsonLdBlocks = extractJsonLdBlocks(html);
  const fromJsonLd = recordsFromJsonLd(jsonLdBlocks);
  if (fromJsonLd.length > 0) return { records: fromJsonLd, method: 'json_ld' };

  const scanned = recordsFromPostcodeScan(html);
  return { records: scanned, method: 'postcode_text_scan' };
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

  const rawPath = join(OUTPUT_DIR, 'rayban.raw.html');
  await writeFile(rawPath, html, 'utf-8');

  const { records, method } = extractRecords(html);

  const outputPath = join(OUTPUT_DIR, 'rayban.json');
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
  console.log(`Also saved raw page HTML: ${rawPath}`);

  if (method !== 'targeted_yext_directory_json') {
    console.log(
      '\nNote: the targeted parser found nothing, so this fell back to a rougher method. Ray-Ban/Yext may have ' +
        'changed their page structure — send back rayban.raw.html so the parser can be updated.'
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
