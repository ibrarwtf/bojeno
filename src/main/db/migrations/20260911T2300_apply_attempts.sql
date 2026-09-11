CREATE TABLE apply_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  external_job_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reason TEXT,
  header TEXT,
  dry_run INTEGER NOT NULL,
  attempted_at TEXT NOT NULL
);
