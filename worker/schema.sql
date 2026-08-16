CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO counters (name, value) VALUES
  ('visit', 0),
  ('optician', 0),
  ('mp', 0),
  ('rayban', 0),
  ('retailer', 0),
  ('petition_click', 0),
  ('petition_share', 0),
  ('finder_search', 0),
  ('stockist_selected', 0),
  ('retailer_action_started', 0);

-- Tracks the last hit per (counter type, IP) so a single visitor can't
-- inflate a counter by clicking / reloading repeatedly. See COOLDOWN_SECONDS
-- in src/index.js for how long each type is locked out after a hit.
CREATE TABLE IF NOT EXISTS rate_limits (
  rl_key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

-- Stockist directory. A row is a specific physical branch (or, for
-- authorised_chain rows pending branch-level evidence, a placeholder tied to
-- the chain rather than a confirmed address — see verification_status).
-- Only verification_status = 'verified_branch' rows are ever returned by the
-- public /api/stockists endpoint. See scripts/ingest/README.md for how rows
-- get here.
CREATE TABLE IF NOT EXISTS stockists (
  id TEXT PRIMARY KEY,

  chain_id TEXT NOT NULL,
  chain_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,

  category TEXT NOT NULL,
  -- optician | eyewear | electronics | department_store | carrier | other

  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,

  country TEXT NOT NULL DEFAULT 'UK',
  -- UK | IE. Added 16 Aug 2026 for Ireland coverage — every query against
  -- this table must filter on country as well as verification_status (see
  -- src/stockists.js) so a UK search can never surface an Ireland branch or
  -- vice versa. DEFAULT 'UK' exists only so ALTER TABLE ADD COLUMN on an
  -- already-deployed database backfills existing (all-UK) rows correctly —
  -- every INSERT going forward should set this explicitly, never rely on
  -- the default.

  postcode TEXT NOT NULL,
  normalized_postcode TEXT NOT NULL,

  latitude REAL NOT NULL,
  longitude REAL NOT NULL,

  phone_number TEXT,

  contact_type TEXT,
  -- email | contact_form | branch_page | central_contact | phone | stock_checker

  contact_value TEXT,
  contact_url TEXT,

  booking_url TEXT,
  stock_checker_url TEXT,

  prescription_available INTEGER,
  demo_units_available INTEGER,

  verification_status TEXT NOT NULL,
  -- verified_branch | authorised_chain | candidate | inactive

  verification_method TEXT NOT NULL,
  -- first_party_meta_directory
  -- first_party_branch_page
  -- first_party_stockist_directory
  -- first_party_stock_checker
  -- first_party_product_specific_directory
  --   The whole directory is presented by the retailer as ITS product-
  --   specific store finder (e.g. a "Ray-Ban Meta store finder" page,
  --   distinct from a generic "find any store" locator), so every result
  --   it returns counts as verified_branch evidence without a per-record
  --   Meta-specific flag. This is a judgment call about the directory's
  --   own framing, not a per-branch fact — see `notes` on affected records
  --   for the reasoning and any corroborating evidence (e.g. phone spot
  --   checks) behind a specific batch. Requires deliberate human sign-off
  --   per source (see --directory-is-product-specific in
  --   scripts/ingest/2-normalize-and-geocode.mjs) — never a default.
  -- manual_confirmation

  source_url TEXT NOT NULL,
  source_label TEXT,

  verified_product_scope TEXT,
  -- e.g. ray_ban_meta | ray_ban_smart_glasses

  last_verified_at TEXT NOT NULL,

  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_stockists_coords
ON stockists(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_stockists_postcode
ON stockists(normalized_postcode);

CREATE INDEX IF NOT EXISTS idx_stockists_category
ON stockists(category);

CREATE INDEX IF NOT EXISTS idx_stockists_status
ON stockists(verification_status);

CREATE INDEX IF NOT EXISTS idx_stockists_country
ON stockists(country);
