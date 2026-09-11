CREATE TABLE applied_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  external_job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  applied_at TEXT NOT NULL,
  applied_relative TEXT,
  job_url TEXT,
  captured_at TEXT NOT NULL,
  UNIQUE (platform, external_job_id)
);
