-- Tracks when a native OS notification was fired for a row, so a restart or
-- a repeat of the same outstanding question doesn't re-notify - see
-- src/main/notifications/unmatchedQuestionNotifier.ts.
ALTER TABLE unmatched_questions ADD COLUMN notified_at TEXT;
