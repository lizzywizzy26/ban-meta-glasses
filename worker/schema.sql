CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO counters (name, value) VALUES
  ('visit', 0),
  ('optician', 0),
  ('mp', 0),
  ('rayban', 0),
  ('petition_click', 0),
  ('petition_share', 0);

-- Tracks the last hit per (counter type, IP) so a single visitor can't
-- inflate a counter by clicking / reloading repeatedly. See COOLDOWN_SECONDS
-- in src/index.js for how long each type is locked out after a hit.
CREATE TABLE IF NOT EXISTS rate_limits (
  rl_key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
