#!/usr/bin/env node
// Fetches Ray-Ban's official UK store locator and saves what it finds as
// ONE json file: scripts/ingest/output/rayban.json
//
// HOW TO RUN: same as the other scripts, no arguments.
//   node scripts/ingest/1-fetch-rayban.mjs
//
// UNKNOWN going in (this is a first-pass, generic extraction, same
// starting point David Clulow's script began with before real data showed
// its structure):
//   - Whether this page lists every UK Ray-Ban store, or something
//     filtered.
//   - Whether individual entries carry any Smart Glasses / Ray-Ban Meta
//     availability signal, or whether that only shows up on each store's
//     own individual page (unknown without seeing real data — a follow-up
//     investigation script, matching the pattern used for Vision Express's
//     branch-page signal check, may be needed once this first pass is in).
//   - Ray-Ban is owned by EssilorLuxottica, same group as Vision Express —
//     it's possible (not confirmed) this uses a different store-locator
//     platform than Vision Express/David Clulow's shared one, so no
//     targeted parser is attempted yet.
//
// Send back BOTH output files — the raw HTML matters most here, since the
// generic extraction below is a first guess, not a finished parser.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const SOURCE_URL = 'https://stores.ray-ban.com/united-kingdom';

const UK_POSTCODE_RE = /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})\b/gi;
const UK_PHONE_RE = /\b(0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4})\b/g;
const META_HINT_RE = /ray-?ban meta|smart glasses|ai glasses/i;
const STORE_KEY_HINTS = ['store', 'branch', 'location', 'postcode', 'latitude', 'longitude', 'address'];

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

function looksLikeStoreData(jsonText) {
  const lower = jsonText.toLowerCase();
  return STORE_KEY_HINTS.filter((k) => lower.includes(k)).length >= 3;
}

function recordsFromEmbeddedJson(html) {
  const records = [];
  const re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const content = match[1].trim();
    if (content.length < 200 || !looksLikeStoreData(content)) continue;
    const braceMatch = content.match(/[\{\[][\s\S]*[\}\]]/);
    if (!braceMatch) continue;
    try {
      JSON.parse(braceMatch[0]);
      records.push({
        branchName: null,
        address: null,
        postcode: null,
        phone: null,
        sourceUrl: SOURCE_URL,
        metaEvidenceText: null,
        extractionMethod: 'embedded_json_candidate',
        needsReview: true,
        _rawCandidate: braceMatch[0].slice(0, 5000),
      });
    } catch {
      // not valid JSON once extracted — skip
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

  const jsonLdBlocks = extractJsonLdBlocks(html);
  let records = recordsFromJsonLd(jsonLdBlocks);
  let method = 'json_ld';

  if (records.length === 0) {
    records = recordsFromEmbeddedJson(html);
    method = 'embedded_json_candidate';
  }
  if (records.length === 0) {
    records = recordsFromPostcodeScan(html);
    method = 'postcode_text_scan';
  }

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
  console.log('\nPlease send back BOTH files.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  });
}
