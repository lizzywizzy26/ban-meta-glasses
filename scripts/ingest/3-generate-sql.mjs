#!/usr/bin/env node
// Step 3 of the ingestion pipeline: UPSERT (as generated SQL, not a live
// write — see below) + REFRESH REPORT.
//
// Takes the output of 2-normalize-and-geocode.mjs and produces:
//   1. output/<chain-id>.upsert.sql — ready to run via:
//        wrangler d1 execute stop-meta-glasses-db --remote --file=output/<chain-id>.upsert.sql
//      (drop --remote to apply to a local D1 instance instead, for testing)
//   2. A refresh report printed to the console, and saved as
//      output/<chain-id>.refresh-report.json
//
// If --previous=<path to an earlier .normalized.json> is given, the report
// includes records that were present before but are missing now. These are
// NEVER auto-deleted — per the campaign's data principle, a record
// disappearing from a source on one refresh could mean the branch stopped
// selling, or could mean the source page just changed shape and the scraper
// missed it. Either way a human should look, not the pipeline silently
// deciding. Flagged records get appended to the SQL as
// UPDATE ... SET verification_status = 'inactive' — moved out of public
// results, but never DELETEd, so the history/provenance stays intact.
//
// Usage:
//   node scripts/ingest/3-generate-sql.mjs <normalized.json> [--previous=<earlier-normalized.json>]

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

const COLUMNS = [
  'id', 'chain_id', 'chain_name', 'branch_name', 'host_retailer_name', 'category',
  'address_line_1', 'address_line_2', 'city', 'country', 'postcode', 'normalized_postcode',
  'latitude', 'longitude', 'phone_number',
  'contact_type', 'contact_value', 'contact_url', 'booking_url', 'stock_checker_url',
  'prescription_available', 'demo_units_available',
  'verification_status', 'verification_method', 'source_url', 'source_label',
  'verified_product_scope', 'last_verified_at', 'notes',
];

function upsertStatement(record) {
  const values = COLUMNS.map((col) => sqlString(record[col])).join(', ');
  const updates = COLUMNS.filter((c) => c !== 'id')
    .map((col) => `${col} = excluded.${col}`)
    .join(',\n    ');
  return `INSERT INTO stockists (${COLUMNS.join(', ')})\nVALUES (${values})\nON CONFLICT(id) DO UPDATE SET\n    ${updates};`;
}

function deactivateStatement(id) {
  return `UPDATE stockists SET verification_status = 'inactive' WHERE id = ${sqlString(id)};`;
}

async function main() {
  const [inputPath, ...rest] = process.argv.slice(2);
  const previousFlag = rest.find((a) => a.startsWith('--previous='));
  const previousPath = previousFlag ? previousFlag.slice('--previous='.length) : null;

  if (!inputPath) {
    console.error('Usage: node 3-generate-sql.mjs <normalized.json> [--previous=<earlier-normalized.json>]');
    process.exit(1);
  }

  const current = JSON.parse(await readFile(inputPath, 'utf-8'));
  const previous = previousPath ? JSON.parse(await readFile(previousPath, 'utf-8')) : null;

  const currentIds = new Set(current.map((r) => r.id));
  const previousIds = previous ? new Set(previous.map((r) => r.id)) : new Set();
  const previousById = previous ? new Map(previous.map((r) => [r.id, r])) : new Map();

  const added = current.filter((r) => !previousIds.has(r.id));
  const changed = previous
    ? current.filter((r) => previousIds.has(r.id) && JSON.stringify(previousById.get(r.id)) !== JSON.stringify(r))
    : [];
  const possiblyRemoved = previous ? [...previousIds].filter((id) => !currentIds.has(id)) : [];

  const statements = current.map(upsertStatement);
  for (const id of possiblyRemoved) {
    statements.push(deactivateStatement(id));
  }

  const chainId = basename(inputPath).replace(/\.normalized\.json$/, '');
  const sqlPath = join(OUTPUT_DIR, `${chainId}.upsert.sql`);
  await writeFile(sqlPath, statements.join('\n\n') + '\n', 'utf-8');

  const report = {
    source: inputPath,
    comparedAgainst: previousPath,
    recordsInThisRefresh: current.length,
    added: added.map((r) => ({ id: r.id, branchName: r.branch_name })),
    changed: changed.map((r) => ({ id: r.id, branchName: r.branch_name })),
    possibleRemovals: possiblyRemoved.map((id) => ({
      id,
      branchName: previousById.get(id)?.branch_name,
      action: 'marked inactive in generated SQL — NOT deleted, review before next refresh',
    })),
    verificationBreakdown: current.reduce((acc, r) => {
      acc[r.verification_status] = (acc[r.verification_status] || 0) + 1;
      return acc;
    }, {}),
  };

  const reportPath = join(OUTPUT_DIR, `${chainId}.refresh-report.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log('--- Refresh report ---');
  console.log(`Records in this refresh: ${report.recordsInThisRefresh}`);
  console.log(`Added: ${added.length}`);
  console.log(`Changed: ${changed.length}`);
  console.log(`Possibly removed (marked inactive, not deleted): ${possiblyRemoved.length}`);
  console.log('Verification breakdown:', report.verificationBreakdown);
  console.log(`\nSQL written to: ${sqlPath}`);
  console.log(`Report written to: ${reportPath}`);
  console.log(`\nTo apply locally for testing:\n  npx wrangler d1 execute stop-meta-glasses-db --local --file=${sqlPath}`);
  console.log(`To apply to the real production database once you're confident:\n  npx wrangler d1 execute stop-meta-glasses-db --remote --file=${sqlPath}`);
}

main().catch((err) => {
  console.error('SQL generation failed:', err);
  process.exit(1);
});
