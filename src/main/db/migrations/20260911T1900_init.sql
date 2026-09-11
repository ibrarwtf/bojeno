CREATE TABLE run_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  step_index INTEGER,
  timestamp TEXT NOT NULL,
  script TEXT NOT NULL,
  selector TEXT,
  outcome TEXT NOT NULL CHECK (
    outcome IN ('success', 'failed', 'auth_required', 'rate_limited', 'awaiting_input', 'skipped')
  ),
  duration INTEGER,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'auto', 'scheduled')),
  triggered_by TEXT,
  entity_type TEXT,
  entity_id TEXT,
  error_detail TEXT,
  run_mode TEXT NOT NULL CHECK (run_mode IN ('read-only', 'dry-run', 'live'))
);

CREATE TABLE applied_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'naukri')),
  count INTEGER NOT NULL,
  fetched_at TEXT NOT NULL
);
