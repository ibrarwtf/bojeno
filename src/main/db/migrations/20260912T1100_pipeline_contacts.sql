-- Manual pipeline tracking for funnel stages 3-5 (brief §2/§9) - contacted,
-- interview scheduled, outcome. Not automatable, but worth logging since the
-- owner is in the app daily anyway. external_job_id optionally links back to
-- applied_jobs/apply_attempts when the contact is about a specific job.
CREATE TABLE pipeline_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  company TEXT NOT NULL,
  external_job_id TEXT,
  contacted_at TEXT NOT NULL,
  contact_note TEXT,
  interview_scheduled_at TEXT,
  last_follow_up_at TEXT,
  status TEXT NOT NULL DEFAULT 'contacted',
  created_at TEXT NOT NULL
);
