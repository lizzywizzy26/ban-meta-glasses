# Finalized stockist datasets

This is the durable, committed home for stockist data that's been through
the full ingestion pipeline and accepted as a source's current dataset —
distinct from `scripts/ingest/output/`, which is gitignored scratch space
regenerated every time someone runs the pipeline scripts.

```
vision-express.normalized.json   438 verified_branch records (14 Aug 2026)
EXCLUDED-RECORDS.md              Records found but not included, and why — not lost, just not ready
```

**This directory is not automatically applied to the live database.**
Getting a file into this folder means "this is our current best dataset for
this source." Actually loading it into D1 (local or production) is still a
separate, deliberate step — see `../../scripts/ingest/README.md` step 3
(`3-generate-sql.mjs`) and `../../worker/README.md`.

When a source gets refreshed later (a re-run of its fetch script), diff the
new normalized output against the file already here using
`3-generate-sql.mjs --previous=<this file>` before overwriting it — that
produces a refresh report (added/changed/possibly-removed) and generates
SQL that marks vanished records `inactive` rather than silently deleting
them, per the campaign's data principles.
