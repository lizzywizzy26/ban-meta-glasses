-- One-off migration for a D1 database created BEFORE 16 Aug 2026 (i.e. before
-- Ireland support), where `stockists` already exists without a `country`
-- column. schema.sql's `CREATE TABLE IF NOT EXISTS` is a no-op against an
-- existing table, so it won't add this column on its own — run this once,
-- manually, against any such database:
--
--   wrangler d1 execute stop-meta-glasses-db --remote --file=./migrate-add-country.sql
--
-- Safe to skip entirely for a brand-new database — schema.sql already
-- creates the column from the start in that case. Do NOT run this twice
-- against the same database: SQLite/D1 errors on adding a column that
-- already exists ("duplicate column name"), which is a harmless error to
-- see (it means this already ran) but will abort the file's remaining
-- statements if any were added below in future, so keep this file to just
-- the one idempotency-unsafe statement.

ALTER TABLE stockists ADD COLUMN country TEXT NOT NULL DEFAULT 'UK';

CREATE INDEX IF NOT EXISTS idx_stockists_country ON stockists(country);
