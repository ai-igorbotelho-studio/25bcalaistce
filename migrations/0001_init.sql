-- 25B Calais — Cloudflare D1 schema (database: calais-25b)
-- All app state lives in one JSON document (row id = 1), versioned for
-- optimistic concurrency. Uploaded photos live in `images` (split into
-- ≤1 MB chunks to stay under D1's row limit), referenced from the state
-- as /api/img/<id>.
CREATE TABLE IF NOT EXISTS state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  data          TEXT    NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  last_saved    TEXT,
  last_saved_by TEXT
);

CREATE TABLE IF NOT EXISTS images (
  id         TEXT    NOT NULL,
  seq        INTEGER NOT NULL,
  mime       TEXT    NOT NULL,
  data       BLOB    NOT NULL,
  created_at TEXT    NOT NULL,
  created_by TEXT,
  PRIMARY KEY (id, seq)
);
