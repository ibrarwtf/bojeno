-- Full JD-capture snapshot per job seen, so a run can be audited later
-- without re-scraping LinkedIn - run_logs.detail deliberately only keeps a
-- short signal summary (descriptionLength, not the text itself) to stay
-- lightweight per-row; this table holds the one thing that isn't cheap to
-- repeat, once per capture.
CREATE TABLE job_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  external_job_id TEXT NOT NULL,
  job_title TEXT,
  company TEXT,
  location TEXT,
  description_text TEXT,
  applicant_count TEXT,
  applicant_insight_total INTEGER,
  applicant_insight_past_day INTEGER,
  has_fit_signal INTEGER,
  years_required INTEGER,
  captured_at TEXT NOT NULL
);

CREATE INDEX idx_job_snapshots_external_job_id ON job_snapshots (platform, external_job_id);

-- One row per apply-modal question the answer bank couldn't match, for the
-- user to review and (eventually) turn into a new answer-bank rule. Not
-- every 'needs_review' outcome lands here - only the ones apply.ts can name
-- a specific question for (see ApplyResult.unmatchedQuestion).
CREATE TABLE unmatched_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  external_job_id TEXT NOT NULL,
  job_title TEXT,
  company TEXT,
  question_kind TEXT NOT NULL CHECK (question_kind IN ('text', 'select', 'radio')),
  question_label TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  answer TEXT
);
