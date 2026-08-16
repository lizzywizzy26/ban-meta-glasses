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
//
// --source-is-structured-brand-list is the same kind of labelling-only
// flag, for the evidence type discovered investigating Vision Express
// Ireland's "Dublin-group" anomaly (see RETAILER-MATRIX.md and
// worker/schema.sql's first_party_structured_brand_list comment): a named
// brand appearing in a structured, per-branch field on the retailer's own
// store-detail data (e.g. `features.availableBrands`), not text found on a
// directory/group page. Preferred over first_party_stockist_directory
// whenever both evidence types are available for the same source — see
// the evidence-ranking rule in scripts/ingest/README.md.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePostcode, geocodePostcode, geocodeIrishTown } from '../../worker/src/geocode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

function parseArgs(argv) {
  const [inputPath, ...rest] = argv;
  const flags = {
    assumeFirstParty: false,
    mockGeocoder: false,
    directoryIsProductSpecific: false,
    sourceIsLiveStockChecker: false,
    sourceIsStructuredBrandList: false,
    corroborationNote: null,
    chainId: null,
    chainName: null,
    category: null,
    country: 'UK', // default preserves every existing documented command (all UK sources so far)
  };
  for (const arg of rest) {
    if (arg === '--assume-first-party') flags.assumeFirstParty = true;
    else if (arg === '--mock-geocoder') flags.mockGeocoder = true;
    else if (arg === '--directory-is-product-specific') flags.directoryIsProductSpecific = true;
    else if (arg === '--source-is-live-stock-checker') flags.sourceIsLiveStockChecker = true;
    else if (arg === '--source-is-structured-brand-list') flags.sourceIsStructuredBrandList = true;
    else if (arg.startsWith('--corroboration-note=')) flags.corroborationNote = arg.slice('--corroboration-note='.length).replace(/^"|"$/g, '');
    else if (arg.startsWith('--chain-id=')) flags.chainId = arg.slice('--chain-id='.length);
    else if (arg.startsWith('--chain-name=')) flags.chainName = arg.slice('--chain-name='.length).replace(/^"|"$/g, '');
    else if (arg.startsWith('--category=')) flags.category = arg.slice('--category='.length);
    else if (arg.startsWith('--country=')) flags.country = arg.slice('--country='.length).toUpperCase();
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
    sourceIsStructuredBrandList,
    corroborationNote,
    chainId,
    chainName,
    category,
    country,
  } = parseArgs(process.argv.slice(2));

  if (!inputPath || !chainId || !chainName || !category) {
    console.error(
      'Usage: node 2-normalize-and-geocode.mjs <input.json> --chain-id=<id> --chain-name=<"Name"> --category=<optician|eyewear|electronics|department_store|carrier|other> [--country=UK|IE] [--assume-first-party] [--directory-is-product-specific] [--source-is-live-stock-checker] [--source-is-structured-brand-list] [--corroboration-note="..."] [--mock-geocoder]'
    );
    process.exit(1);
  }
  if (country !== 'UK' && country !== 'IE') {
    console.error(`--country must be UK or IE (got "${country}").`);
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

    // city is NOT NULL in the D1 schema, and for Ireland it also doubles as
    // the lookup key into the town-centroid table below, so it's resolved
    // first. Prefer an explicit rec.city if the fetch step supplied one;
    // otherwise take the last comma-separated segment of the address as a
    // best-effort guess — flag it for review either way, since this is a
    // heuristic, not confirmed data.
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

    // Some sources (e.g. Ray-Ban's Yext platform) label each entity with its
    // own country. Where that's present, it's a real cross-check against
    // --country — a mismatch means either the wrong flag was used for this
    // run, or the source is listing a branch outside the country its own
    // page claims to cover. Either way, skip rather than mislabel a
    // branch's jurisdiction.
    if (rec.countryCode) {
      const expected = country === 'UK' ? 'GB' : 'IE';
      if (rec.countryCode !== expected) {
        console.log(`SKIP (source countryCode=${rec.countryCode}, expected ${expected} for --country=${country}): ${rec.branchName || '(unnamed)'}`);
        continue;
      }
    }

    // If the fetch step already captured real coordinates directly from the
    // retailer's own system (e.g. John Lewis's stock API, or Ray-Ban's Yext
    // platform), use those instead of re-deriving from the postcode. This is
    // a genuine accuracy upgrade for UK sources (postcodes.io only resolves
    // to a postcode-level centroid, not the actual building) and it's the
    // ONLY coordinate source used for Ireland at all — see geocode.js's
    // Ireland section for why postcode/Eircode-based geocoding isn't used
    // here. Only used when both values are finite numbers, so a
    // malformed/missing source coordinate falls back to the next method
    // rather than silently producing a bad location.
    const hasSourceCoords = typeof rec.latitude === 'number' && typeof rec.longitude === 'number' && Number.isFinite(rec.latitude) && Number.isFinite(rec.longitude);

    let postcodeForStorage;
    let geo;
    let coordinateNote = null;

    if (country === 'UK') {
      const normalizedPostcode = normalizePostcode(rec.postcode);
      if (!normalizedPostcode) {
        report.skippedNoPostcode++;
        console.log(`SKIP (no valid postcode): ${rec.branchName || '(unnamed)'} — raw postcode: ${JSON.stringify(rec.postcode)}`);
        continue;
      }
      postcodeForStorage = normalizedPostcode;
      geo = hasSourceCoords
        ? { error: null, normalized: normalizedPostcode, coords: { latitude: rec.latitude, longitude: rec.longitude, source: 'source_provided' } }
        : await geocodePostcode(normalizedPostcode, env);
    } else {
      // country === 'IE': deliberately NOT UK-postcode-validated (an
      // Eircode doesn't match that shape) and deliberately NOT geocoded via
      // a live Eircode/Nominatim lookup for this MVP — coverage for Ireland
      // on the free options available was found to be unreliable, and this
      // campaign's principle is "verified or don't show it," not "best
      // guess." Whatever postcode/Eircode text the source gave is stored
      // as-is (unvalidated, for display/reference only); the actual
      // coordinate is source-provided data if available, else a
      // town-centroid lookup keyed on `city`, else this record is skipped
      // rather than invented.
      postcodeForStorage = (rec.postcode && rec.postcode.trim()) || city;
      if (hasSourceCoords) {
        geo = { error: null, normalized: postcodeForStorage, coords: { latitude: rec.latitude, longitude: rec.longitude, source: 'source_provided' } };
      } else {
        const townGeo = geocodeIrishTown(city);
        if (townGeo.error === null) {
          geo = townGeo;
          coordinateNote = `Coordinate is a town-level centroid for "${city}" (not this branch's exact address) — this source didn't provide real coordinates, and this MVP doesn't geocode Eircodes. Upgrade when a better Ireland geocoding source is available.`;
        } else {
          geo = { error: 'no_coordinate_source' };
        }
      }
    }

    if (geo.error) {
      report.geocodeFailed++;
      console.log(`SKIP (geocode failed: ${geo.error}): ${rec.branchName || '(unnamed)'} — ${postcodeForStorage}`);
      continue;
    }
    report.geocoded++;

    const hasMetaEvidence = Boolean(rec.metaEvidenceText && rec.metaEvidenceText.trim());

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
      verificationMethod = sourceIsStructuredBrandList
        ? 'first_party_structured_brand_list'
        : sourceIsLiveStockChecker
          ? 'first_party_stock_checker'
          : 'first_party_stockist_directory';
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
      id: `${chainId}-${slugify(rec.branchName || postcodeForStorage)}`,
      chain_id: chainId,
      chain_name: chainName,
      branch_name: rec.branchName || `${chainName} (unnamed branch)`,
      category,
      address_line_1: rec.address || '',
      address_line_2: null,
      city,
      country,
      postcode: postcodeForStorage,
      normalized_postcode: postcodeForStorage.toUpperCase().replace(/\s+/g, ''),
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
          coordinateNote,
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
