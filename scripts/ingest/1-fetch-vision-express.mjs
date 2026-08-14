#!/usr/bin/env node
// Fetches the Vision Express Ray-Ban Meta stockist directory and saves what
// it finds as ONE json file: scripts/ingest/output/vision-express.json
//
// HOW TO RUN THIS (no coding knowledge needed):
//   1. Install Node.js if you don't already have it: https://nodejs.org (choose the "LTS" version)
//   2. Open Terminal (Mac) or Command Prompt (Windows)
//   3. Type "cd " (with a space after) then drag this project's folder into the window, then press Enter
//   4. Type this and press Enter:
//        node scripts/ingest/1-fetch-vision-express.mjs
//   5. When it finishes, send back the file it created:
//        scripts/ingest/output/vision-express.json
//      (and scripts/ingest/output/vision-express.raw.html too, just in case)
//
// That's it — no arguments, no options, nothing else to configure.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const SOURCE_URL = 'https://www.visionexpress.com/opticians/ray-ban-meta';

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
      // skip malformed blocks rather than fail the whole run
    }
  }
  return blocks;
}

// Best-effort: walk any parsed JSON-LD looking for schema.org
// Store/LocalBusiness-shaped entries and map their fields to our target shape.
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
    const looksLikeStore = typeof type === 'string' && /store|localbusiness|opticalstore/i.test(type);
    if (looksLikeStore) {
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

// Last-resort heuristic: find every UK postcode mentioned in the visible
// text, and treat the ~300 characters around it as a candidate record. This
// is deliberately marked needsReview: true — it's meant to make sure real
// data doesn't get silently missed if the page has no structured markup,
// not to produce clean records on its own.
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
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  const html = await res.text();

  const rawPath = join(OUTPUT_DIR, 'vision-express.raw.html');
  await writeFile(rawPath, html, 'utf-8');

  const jsonLdBlocks = extractJsonLdBlocks(html);
  let records = recordsFromJsonLd(jsonLdBlocks);
  let method = 'json_ld';

  if (records.length === 0) {
    records = recordsFromPostcodeScan(html);
    method = 'postcode_text_scan';
  }

  const outputPath = join(OUTPUT_DIR, 'vision-express.json');
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        sourceUrl: SOURCE_URL,
        fetchedAt: new Date().toISOString(),
        httpStatus: res.status,
        extractionMethod: method,
        recordCount: records.length,
        records,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`\nFound ${records.length} candidate record(s) via "${method}".`);
  console.log(`Saved: ${outputPath}`);
  console.log(`Also saved raw page HTML (fallback): ${rawPath}`);

  if (method === 'postcode_text_scan' || records.length === 0) {
    console.log(
      '\nNote: no structured store data (JSON-LD) was found, so this used a rougher text scan, or found ' +
        'nothing at all. If vision-express.json looks empty or messy, the page likely loads its store list ' +
        'via JavaScript after the page opens. In that case: open the page in a normal browser, wait for the ' +
        'store list to appear, right-click > "View Page Source" (or press Ctrl/Cmd+U), select all, copy, and ' +
        'paste that into a text file to send back instead — or just send the vision-express.raw.html file ' +
        'that was saved, either way is fine.'
    );
  }

  console.log('\nPlease send back: scripts/ingest/output/vision-express.json (and the .raw.html if possible).');
}

main().catch((err) => {
  console.error('Fetch failed:', err.message);
  process.exit(1);
});
