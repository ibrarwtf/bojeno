CREATE TABLE linkedin_saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  keywords TEXT,
  location TEXT,
  sort_by_recent INTEGER NOT NULL DEFAULT 0,
  easy_apply_only INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_run_at TEXT
);
