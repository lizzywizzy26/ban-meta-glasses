#!/usr/bin/env node
// Fetches David Clulow's Ray-Ban Meta stockist directory and saves what it
// finds as ONE json file: scripts/ingest/output/david-clulow.json
//
// HOW TO RUN THIS (no coding knowledge needed):
//   1. Same folder you already ran the Vision Express script from.
//   2. Type this and press Enter:
//        node scripts/ingest/1-fetch-david-clulow.mjs
//   3. Send back the file it created:
//        scripts/ingest/output/david-clulow.json
//      (and scripts/ingest/output/david-clulow.raw.html too, just in case)
//
// UNLIKE the Vision Express script, this one does NOT have a targeted
// parser yet — David Clulow's page structure hasn't been seen. It uses the
// same generic multi-strategy extraction the Vision Express script started
// with (JSON-LD, then a "big embedded JSON blob" heuristic, then a
// last-resort postcode text scan), same as before: whatever it finds,
// SEND IT BACK, and a targeted parser gets built from the real structure —
// don't assume the generic output is clean or complete yet.
//
// David Clulow has a much smaller UK footprint than Vision Express (~30
// stores nationally vs 440) and their Ray-Ban Meta page is titled
// "Stockists near me" rather than a generic store locator — that's a
// reason to be hopeful this list might be a genuinely curated Meta-specific
// subset rather than Vision Express's situation (a generic locator reused
// on the Meta page). But that is a hypothesis, not a finding — it needs
// checking the same way Vision Express was checked (look for per-branch
// feature tags/signals, check what the page's own copy claims, don't
// assume "dedicated-sounding URL" means "every listed branch is verified").

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const SOURCE_URL = 'https://www.davidclulow.com/stores/ray-ban-meta';

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
      JSON.parse(braceMatch[0]); // just confirming it's parseable — full mapping needs real structure
      records.push({
        branchName: null,
        address: null,
        postcode: null,
        phone: null,
        sourceUrl: SOURCE_URL,
        metaEvidenceText: null,
        extractionMethod: 'embedded_json_candidate',
        needsReview: true,
        _rawCandidate: braceMatch[0].slice(0, 5000), // truncated preview for manual inspection, not for ingestion
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

  const rawPath = join(OUTPUT_DIR, 'david-clulow.raw.html');
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

  const outputPath = join(OUTPUT_DIR, 'david-clulow.json');
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
  console.log(`Also saved raw page HTML (essential this time — the generic extraction above is a first guess, not a finished parser): ${rawPath}`);
  console.log('\nPlease send back BOTH files.');
}

main().catch((err) => {
  console.error('Fetch failed:', err.message);
  process.exit(1);
});
