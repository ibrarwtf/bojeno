-- Where the question was first encountered: a direct link back to the
-- posting, and which run (if any) found it - a lone applyToJob call has no
-- run_id, so it stays nullable.
ALTER TABLE unmatched_questions ADD COLUMN job_url TEXT;
ALTER TABLE unmatched_questions ADD COLUMN run_id TEXT;
