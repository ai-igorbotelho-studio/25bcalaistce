-- Failed EDIT sign-in attempts per IP, for brute-force throttling.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip           TEXT    PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL   -- epoch ms
);
