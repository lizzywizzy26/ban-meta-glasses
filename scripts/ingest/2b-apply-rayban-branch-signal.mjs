#!/usr/bin/env node
// Applies the campaign owner's decision on the Ray-Ban branch-signal
// investigation (15 Aug 2026) to rayban.json, ready for step 2
// (2-normalize-and-geocode.mjs).
//
// THE DECISION: 2-investigate-rayban-branch-signal.mjs found that 6 of
// Ray-Ban's 7 UK store pages carry an identical, genuine per-store content
// block — a "Ray-Ban Smart Glasses" gallery tile plus the sentence "In
// partnership with Meta, discover our first generation of smart sunglasses
// and eyeglasses that keeps you connected" — while the 7th (Stratford
// Westfield) has neither, and instead shows the older pre-rebrand "Ray-Ban
// Stories" tile with no Meta-partnership text. Unlike Vision Express's
// first pass (identical tags on literally every record, zero signal), this
// IS a real per-branch difference in first-party page content, even though
// it's marketing copy rather than a live stock feed. The campaign owner
// reviewed this and decided: the 6 stores with the content block count as
// verified_branch; Stratford stays at authorised_chain rather than being
// assumed either way, since its gap could reflect stale page content as
// easily as an actual absence of the product in that store specifically.
//
// This script doesn't hardcode which 6 — it recomputes the same evidence
// check (mentionsFound.length > 0) from the investigation file's own data
// and writes that as each record's metaEvidenceText, so 2-normalize's
// existing hasMetaEvidence logic produces exactly this split on its own,
// and re-running the investigation later (if Ray-Ban updates the site)
// naturally updates the classification too.
//
// HOW TO RUN:
//   node scripts/ingest/2b-apply-rayban-branch-signal.mjs \
//     scripts/ingest/output/rayban.json \
//     scripts/ingest/output/rayban-branch-signal-investigation.json
//
// Writes back to the same rayban.json (in place) — the original
// step-1 output is fully reproducible by re-running 1-fetch-rayban.mjs, so
// nothing is lost. Then continue with the normal pipeline:
//   node scripts/ingest/2-normalize-and-geocode.mjs scripts/ingest/output/rayban.json \
//     --chain-id=ray-ban --chain-name="Ray-Ban" --category=eyewear --assume-first-party

import { readFile, writeFile } from 'node:fs/promises';

async function main() {
  const [raybanPath, investigationPath] = process.argv.slice(2);
  if (!raybanPath || !investigationPath) {
    console.error('Usage: node 2b-apply-rayban-branch-signal.mjs <rayban.json> <rayban-branch-signal-investigation.json>');
    process.exit(1);
  }

  const rayban = JSON.parse(await readFile(raybanPath, 'utf-8'));
  const investigation = JSON.parse(await readFile(investigationPath, 'utf-8'));

  const evidenceByUrl = new Map();
  for (const result of investigation.results || []) {
    if (!result.url) continue;
    const mentions = result.mentionsFound || [];
    if (mentions.length === 0) continue;
    // Store the first mention's context as the recorded evidence text —
    // real quoted text from the source, not a paraphrase.
    evidenceByUrl.set(result.url, mentions[0].context);
  }

  let updated = 0;
  for (const rec of rayban.records || []) {
    const evidence = rec.branchPageUrl ? evidenceByUrl.get(rec.branchPageUrl) : undefined;
    if (evidence) {
      rec.metaEvidenceText = evidence;
      updated++;
    } else {
      rec.metaEvidenceText = null;
    }
  }

  await writeFile(raybanPath, JSON.stringify(rayban, null, 2), 'utf-8');

  console.log(`Applied branch-signal evidence: ${updated}/${rayban.records.length} records now have metaEvidenceText set.`);
  console.log(`Updated: ${raybanPath}`);
  console.log('\nNext: node scripts/ingest/2-normalize-and-geocode.mjs ' + raybanPath + ' --chain-id=ray-ban --chain-name="Ray-Ban" --category=eyewear --assume-first-party');
}

main().catch((err) => {
  console.error('Merge failed:', err.message);
  process.exit(1);
});
