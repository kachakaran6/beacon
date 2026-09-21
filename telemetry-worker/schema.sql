-- Beacon Anonymous Telemetry Database Schema (Cloudflare D1)

CREATE TABLE IF NOT EXISTS installs (
  install_id TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  app_version TEXT NOT NULL,
  os TEXT NOT NULL,
  arch TEXT NOT NULL,
  country TEXT
);

CREATE TABLE IF NOT EXISTS daily_active (
  day TEXT NOT NULL,
  install_id TEXT NOT NULL,
  PRIMARY KEY (day, install_id)
);

CREATE INDEX IF NOT EXISTS idx_installs_last_seen ON installs(last_seen);
CREATE INDEX IF NOT EXISTS idx_daily_active_day ON daily_active(day);
