-- One-off migration for a D1 database created BEFORE 16 Aug 2026 (before
-- the host_retailer_name column existed). schema.sql's
-- `CREATE TABLE IF NOT EXISTS` is a no-op against an existing table, so it
-- won't add this column on its own — run this once, manually, against any
-- such database:
--
--   wrangler d1 execute stop-meta-glasses-db --remote --file=./migrate-add-host-retailer.sql
--
-- Safe to skip entirely for a brand-new database — schema.sql already
-- creates the column from the start in that case. Do NOT run this twice
-- against the same database: SQLite/D1 errors on adding a column that
-- already exists ("duplicate column name") — harmless (means this already
-- ran), but keep this file to the one statement below regardless.

ALTER TABLE stockists ADD COLUMN host_retailer_name TEXT;
