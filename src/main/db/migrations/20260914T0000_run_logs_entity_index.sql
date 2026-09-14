-- Speeds up the "have we already processed this job id" cache lookup
-- (findLatestJobLog in runLogs.ts) - without it, that query would be a full
-- table scan on every card of every search, which gets slow once run_logs
-- has thousands of rows across a recurring 9-search sweep.
CREATE INDEX idx_run_logs_entity ON run_logs (entity_type, entity_id);
