#!/usr/bin/env node
// Applies the campaign owner's David Clulow verification decision (15 Aug
// 2026) directly to the already-committed data/stockists/david-clulow.normalized.json.
//
// Unlike the Ray-Ban branch-signal merge (2b-apply-rayban-branch-signal.mjs),
// this doesn't re-run the fetch/normalize pipeline: nothing about the
// underlying store facts changed (same 40 branches, same addresses, same
// coordinates) — only the verification judgment on data already ingested
// on 14 Aug 2026. Re-deriving from scratch would need the original raw
// fetch output, which was never committed (scripts/ingest/output/ is
// gitignored), and would risk re-fetching different data than what was
// actually reviewed. So this is a direct, scripted, auditable patch to the
// committed dataset instead — same field-setting logic
// 2-normalize-and-geocode.mjs uses for --directory-is-product-specific,
// applied here without needing the raw source file as input.
//
// THE DECISION: the campaign owner phoned a geographically and
// operationally varied sample of David Clulow's 40 Ray-Ban Meta directory
// branches (standalone stores and John Lewis concessions both included).
// Every branch called confirmed Ray-Ban Meta in stock. Combined with the
// directory-level judgment already applied to Vision Express (this page is
// David Clulow's own dedicated Ray-Ban Meta store finder, not a generic
// locator), the campaign owner approved the same treatment: all 40
// directory locations -> verified_branch, verification_method =
// first_party_product_specific_directory.
//
// IMPORTANT — what the phone calls do and don't prove: the campaign owner
// called a SAMPLE, not all 40 branches. The primary evidence for
// verified_branch status is the directory-level judgment (David Clulow
// presents this page as ITS Ray-Ban Meta finder); the phone calls are
// corroborating evidence for that judgment, not an individual confirmation
// of every single branch. The notes field on every record says exactly
// that — see NOTES_TEXT below — specifically so this isn't later
// misread as "all 40 were individually phone-verified."
//
// Branch names (including "David Clulow Opticians at John Lewis - ..." and
// "Harrods Opticians") are untouched — they were already correct in the
// committed file and are not derived or reconstructed here.
//
// HOW TO RUN:
//   node scripts/ingest/apply-david-clulow-verified-branch-decision.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET_PATH = join(__dirname, '..', '..', 'data', 'stockists', 'david-clulow.normalized.json');

const DECISION_DATE = '2026-08-15';

const NOTES_TEXT =
  'Verified via directory-level judgment: David Clulow presents this directory (davidclulow.com/stores/ray-ban-meta) ' +
  'as its dedicated Ray-Ban Meta store finder, not a generic locator — not an individually-confirmed branch fact on ' +
  'its own. Corroborating evidence: campaign owner phone spot-check (15 Aug 2026) of a geographically and ' +
  'operationally varied sample of these 40 branches, including standalone David Clulow stores and David Clulow ' +
  'concessions within John Lewis — every branch called confirmed Ray-Ban Meta in stock. This corroborates the ' +
  'directory-level judgment above; it is a sample corroboration, not an individual phone verification of all 40 ' +
  'branches.';

async function main() {
  const records = JSON.parse(await readFile(TARGET_PATH, 'utf-8'));

  let changed = 0;
  for (const rec of records) {
    if (rec.verification_status === 'verified_branch') continue; // already done — don't touch
    rec.verification_status = 'verified_branch';
    rec.verification_method = 'first_party_product_specific_directory';
    rec.verified_product_scope = 'ray_ban_meta';
    rec.last_verified_at = DECISION_DATE;
    rec.notes = rec.notes ? `${rec.notes} ${NOTES_TEXT}` : NOTES_TEXT;
    changed++;
  }

  await writeFile(TARGET_PATH, JSON.stringify(records, null, 2), 'utf-8');

  console.log(`Updated ${changed}/${records.length} record(s) to verified_branch.`);
  console.log(`Written: ${TARGET_PATH}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
