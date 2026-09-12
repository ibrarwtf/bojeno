ALTER TABLE run_logs RENAME COLUMN error_detail TO detail;
ALTER TABLE run_logs ADD COLUMN job_title TEXT;
ALTER TABLE run_logs ADD COLUMN company TEXT;
ALTER TABLE run_logs ADD COLUMN location TEXT;
