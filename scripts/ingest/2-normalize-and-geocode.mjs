#!/usr/bin/env node
// Step 2 of the ingestion pipeline: EXTRACT → NORMALISE → VALIDATE →
// ASSIGN VERIFICATION → GEOCODE.
//
// Input: a JSON file shaped like the output of a fetch script (see
// 1-fetch-vision-express.mjs), i.e. { sourceUrl, records: [{ branchName,
// address, postcode, phone, sourceUrl, metaEvidenceText, ... }] }.
// This lets it consume either real fetched data or a test fixture
// interchangeably — see fixtures/vision-express-sample.json.
//
// Usage:
//   node scripts/ingest/2-normalize-and-geocode.mjs <input.json> --chain-id=vision-express --chain-name="Vision Express" --category=optician [--assume-first-party] [--directory-is-product-specific] [--corroboration-note="..."] [--mock-geocoder]
//
// Example against the test fixture (safe — will NOT produce verified_branch
// records, see the safety rule below):
//   node scripts/ingest/2-normalize-and-geocode.mjs fixtures/vision-express-sample.json --chain-id=vision-express --chain-name="Vision Express" --category=optician --mock-geocoder
//
// Example against real fetched data, once available:
//   node scripts/ingest/2-normalize-and-geocode.mjs output/vision-express.json --chain-id=vision-express --chain-name="Vision Express" --category=optician --assume-first-party
//
// SAFETY RULE: --assume-first-party must be passed explicitly, by a human,
// confirming the input file actually came from a real fetch of the named
// retailer's own official page — never set by default. Without it, every
// record is forced to verification_status = 'candidate' regardless of
// content, so test/fixture runs can never accidentally produce data that
// looks publicly verified. By default, even with the flag, a record only
// reaches verified_branch if it also has branch-level Meta-specific
// evidence (metaEvidenceText) — chain-level sourcing alone caps a record
// at 'authorised_chain', per the campaign's core data principle.
//
// --directory-is-product-specific is a SEPARATE, explicit override for a
// specific documented case: a human has judged that the directory ITSELF
// (not each individual record) is the retailer's dedicated product-specific
// store finder, and decided that's sufficient evidence for verified_branch
// across the whole batch — see e.g. the Vision Express decision recorded in
// this repo's commit history and scripts/ingest/README.md. This bypasses
// the per-record metaEvidenceText check entirely, so it must be a
// deliberate, one-off, human-made call each time it's used, never a
// default — pair it with --corroboration-note to record why in the data
// itself, not just in a chat conversation.
//
// --source-is-live-stock-checker is a labelling-only flag, not a new
// verification standard: when a record already qualifies for
// verified_branch via metaEvidenceText, this makes verification_method
// 'first_party_stock_checker' instead of the generic
// 'first_party_stockist_directory' — accurate provenance for sources like
// John Lewis's stock-data API, where the evidence is a live per-branch
// stock count, not text found on a directory page. Doesn't change whether
// anything qualifies as verified_branch, only how it's labelled once it
// does.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePostcode, geocodePostcode } from '../../worker/src/geocode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

function parseArgs(argv) {
  const [inputPath, ...rest] = argv;
  const flags = {
    assumeFirstParty: false,
    mockGeocoder: false,
    directoryIsProductSpecific: false,
    sourceIsLiveStockChecker: false,
    corroborationNote: null,
    chainId: null,
    chainName: null,
    category: null,
  };
  for (const arg of rest) {
    if (arg === '--assume-first-party') flags.assumeFirstParty = true;
    else if (arg === '--mock-geocoder') flags.mockGeocoder = true;
    else if (arg === '--directory-is-product-specific') flags.directoryIsProductSpecific = true;
    else if (arg === '--source-is-live-stock-checker') flags.sourceIsLiveStockChecker = true;
    else if (arg.startsWith('--corroboration-note=')) flags.corroborationNote = arg.slice('--corroboration-note='.length).replace(/^"|"$/g, '');
    else if (arg.startsWith('--chain-id=')) flags.chainId = arg.slice('--chain-id='.length);
    else if (arg.startsWith('--chain-name=')) flags.chainName = arg.slice('--chain-name='.length).replace(/^"|"$/g, '');
    else if (arg.startsWith('--category=')) flags.category = arg.slice('--category='.length);
  }
  return { inputPath, ...flags };
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  const {
    inputPath,
    assumeFirstParty,
    mockGeocoder,
    directoryIsProductSpecific,
    sourceIsLiveStockChecker,
    corroborationNote,
    chainId,
    chainName,
    category,
  } = parseArgs(process.argv.slice(2));

  if (!inputPath || !chainId || !chainName || !category) {
    console.error(
      'Usage: node 2-normalize-and-geocode.mjs <input.json> --chain-id=<id> --chain-name=<"Name"> --category=<optician|eyewear|electronics|department_store|carrier|other> [--assume-first-party] [--directory-is-product-specific] [--source-is-live-stock-checker] [--corroboration-note="..."] [--mock-geocoder]'
    );
    process.exit(1);
  }

  if (directoryIsProductSpecific && !assumeFirstParty) {
    console.error('--directory-is-product-specific requires --assume-first-party (it only makes sense for a confirmed real first-party fetch).');
    process.exit(1);
  }
  if (directoryIsProductSpecific) {
    console.log(
      'NOTE: --directory-is-product-specific is set — every record in this run will be marked verified_branch ' +
        '(verification_method=first_party_product_specific_directory) regardless of per-record metaEvidenceText. ' +
        'This is a deliberate human override for a documented case, not the default path.\n'
    );
  }

  const raw = JSON.parse(await readFile(inputPath, 'utf-8'));
  const sourceUrl = raw.sourceUrl;
  const inputRecords = raw.records || [];

  if (!assumeFirstParty) {
    console.log(
      'NOTE: --assume-first-party was not passed, so every record below will be forced to verification_status="candidate", ' +
        'regardless of content. This run is for testing the pipeline mechanics only, not for producing publishable data.\n'
    );
  }

  const env = mockGeocoder ? { MOCK_GEOCODER: '1' } : {};
  const output = [];
  const report = { processed: 0, geocoded: 0, geocodeFailed: 0, verifiedBranch: 0, authorisedChain: 0, candidate: 0, skippedNoPostcode: 0, skippedNoCity: 0 };

  for (const rec of inputRecords) {
    report.processed++;

    const normalizedPostcode = normalizePostcode(rec.postcode);
    if (!normalizedPostcode) {
      report.skippedNoPostcode++;
      console.log(`SKIP (no valid postcode): ${rec.branchName || '(unnamed)'} — raw postcode: ${JSON.stringify(rec.postcode)}`);
      continue;
    }

    // If the fetch step already captured real coordinates directly from
    // the retailer's own system (e.g. John Lewis's stock API returns
    // per-branch lat/long), use those instead of re-deriving from the
    // postcode via postcodes.io. This is a genuine accuracy upgrade, not
    // a shortcut — postcodes.io only resolves to a postcode-level
    // centroid, while a retailer's own store database points at the
    // actual building. It also means this source doesn't depend on
    // postcodes.io being reachable at all. Only used when both values are
    // finite numbers, so a malformed/missing source coordinate falls back
    // to the normal postcode geocode rather than silently producing a
    // bad location.
    const hasSourceCoords = typeof rec.latitude === 'number' && typeof rec.longitude === 'number' && Number.isFinite(rec.latitude) && Number.isFinite(rec.longitude);

    let geo;
    if (hasSourceCoords) {
      geo = { error: null, normalized: normalizedPostcode, coords: { latitude: rec.latitude, longitude: rec.longitude, source: 'source_provided' } };
    } else {
      geo = await geocodePostcode(normalizedPostcode, env);
    }
    if (geo.error) {
      report.geocodeFailed++;
      console.log(`SKIP (geocode failed: ${geo.error}): ${rec.branchName || '(unnamed)'} — ${normalizedPostcode}`);
      continue;
    }
    report.geocoded++;

    const hasMetaEvidence = Boolean(rec.metaEvidenceText && rec.metaEvidenceText.trim());

    // city is NOT NULL in the D1 schema. Prefer an explicit rec.city if the
    // fetch step supplied one; otherwise take the last comma-separated
    // segment of the address as a best-effort guess — flag it for review
    // either way, since this is a heuristic, not confirmed data.
    let city = rec.city || null;
    let cityIsGuessed = false;
    if (!city && rec.address) {
      const segments = rec.address.split(',').map((s) => s.trim()).filter(Boolean);
      city = segments.length > 1 ? segments[segments.length - 1] : null;
      cityIsGuessed = Boolean(city);
    }
    if (!city) {
      report.skippedNoCity += 1;
      console.log(`SKIP (no city could be determined): ${rec.branchName || '(unnamed)'}`);
      continue;
    }

    let verificationStatus;
    let verificationMethod;
    if (!assumeFirstParty) {
      verificationStatus = 'candidate';
      verificationMethod = 'manual_confirmation';
    } else if (directoryIsProductSpecific) {
      // Explicit human override — see the flag's own comment above.
      verificationStatus = 'verified_branch';
      verificationMethod = 'first_party_product_specific_directory';
    } else if (hasMetaEvidence) {
      verificationStatus = 'verified_branch';
      verificationMethod = sourceIsLiveStockChecker ? 'first_party_stock_checker' : 'first_party_stockist_directory';
    } else {
      // Real first-party source, but no branch-specific Meta signal found —
      // this is exactly the "chain sells it somewhere, this branch unconfirmed"
      // case the brief's core data principle warns about. Do not upgrade this
      // to verified_branch just because the source itself is first-party.
      verificationStatus = 'authorised_chain';
      verificationMethod = 'first_party_stockist_directory';
    }
    const reportKey = { verified_branch: 'verifiedBranch', authorised_chain: 'authorisedChain', candidate: 'candidate' }[verificationStatus];
    report[reportKey] += 1;

    output.push({
      id: `${chainId}-${slugify(rec.branchName || normalizedPostcode)}`,
      chain_id: chainId,
      chain_name: chainName,
      branch_name: rec.branchName || `${chainName} (unnamed branch)`,
      category,
      address_line_1: rec.address || '',
      address_line_2: null,
      city,
      postcode: normalizedPostcode,
      normalized_postcode: normalizedPostcode.replace(/\s+/g, ''),
      latitude: geo.coords.latitude,
      longitude: geo.coords.longitude,
      phone_number: rec.phone || null,
      contact_type: 'branch_page',
      contact_value: null,
      // Prefer this specific branch's own page (e.g. Vision Express's
      // per-store pages) over the generic directory URL, so "Visit branch
      // page" in the finder actually lands somewhere branch-specific.
      contact_url: rec.branchPageUrl || rec.sourceUrl || sourceUrl,
      booking_url: null,
      stock_checker_url: null,
      prescription_available: null,
      demo_units_available: null,
      verification_status: verificationStatus,
      verification_method: verificationMethod,
      source_url: rec.sourceUrl || sourceUrl,
      source_label: `${chainName}'s official Ray-Ban Meta directory`,
      verified_product_scope: hasMetaEvidence || directoryIsProductSpecific ? 'ray_ban_meta' : null,
      last_verified_at: (raw.fetchedAt || new Date().toISOString()).slice(0, 10),
      notes:
        [
          rec.needsReview ? 'Extracted via low-confidence method — needs manual review before trusting.' : null,
          cityIsGuessed ? `City guessed from address text ("${city}") — verify before trusting.` : null,
          directoryIsProductSpecific
            ? 'Verified via directory-level judgment: this retailer presents this directory as its dedicated Ray-Ban Meta store finder, not a generic locator — not an individually-confirmed branch fact.'
            : null,
          corroborationNote || null,
        ]
          .filter(Boolean)
          .join(' ') || null,
    });
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = join(OUTPUT_DIR, `${chainId}.normalized.json`);
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log('\n--- Report ---');
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nSaved ${output.length} normalized record(s) -> ${outputPath}`);
  console.log('Next: node scripts/ingest/3-generate-sql.mjs ' + outputPath);
}

main().catch((err) => {
  console.error('Normalize step failed:', err);
  process.exit(1);
});
