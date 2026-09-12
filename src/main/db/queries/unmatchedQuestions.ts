import type { DatabaseSync } from 'node:sqlite'
import type { Platform, UnmatchedQuestionRow } from '../../../shared/types'

export interface UnmatchedQuestionArgs {
  platform: Platform
  externalJobId: string
  /** Direct link back to the posting - "where we first encountered this". */
  jobUrl: string
  jobTitle?: string | null
  company?: string | null
  questionKind: 'text' | 'select' | 'radio'
  questionLabel: string
  /** Which run found it, if any - a lone applyToJob call has no run. */
  runId?: string | null
}

interface UnmatchedQuestionRowRaw {
  id: number
  platform: Platform
  external_job_id: string
  job_url: string
  job_title: string | null
  company: string | null
  question_kind: 'text' | 'select' | 'radio'
  question_label: string
  detected_at: string
  resolved: number
  answer: string | null
  run_id: string | null
  notified_at: string | null
}

function toRow(row: UnmatchedQuestionRowRaw): UnmatchedQuestionRow {
  return {
    id: row.id,
    platform: row.platform,
    externalJobId: row.external_job_id,
    jobUrl: row.job_url,
    jobTitle: row.job_title,
    company: row.company,
    questionKind: row.question_kind,
    questionLabel: row.question_label,
    detectedAt: row.detected_at,
    resolved: row.resolved === 1,
    answer: row.answer,
    runId: row.run_id,
    notifiedAt: row.notified_at
  }
}

/**
 * One row per apply-modal question the answer bank couldn't match - for
 * later review, not auto-resolved. Returns the new row's id so a caller
 * (see notifications/unmatchedQuestionNotifier.ts) can mark it notified.
 */
export function insertUnmatchedQuestion(db: DatabaseSync, args: UnmatchedQuestionArgs): number {
  const result = db
    .prepare(
      `INSERT INTO unmatched_questions
        (platform, external_job_id, job_url, job_title, company, question_kind, question_label, detected_at, resolved, run_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(
      args.platform,
      args.externalJobId,
      args.jobUrl,
      args.jobTitle ?? null,
      args.company ?? null,
      args.questionKind,
      args.questionLabel,
      new Date().toISOString(),
      args.runId ?? null
    )
  return Number(result.lastInsertRowid)
}

/** Most recent first, for a future review screen. */
export function listUnresolvedUnmatchedQuestions(db: DatabaseSync): UnmatchedQuestionRow[] {
  const rows = db
    .prepare(
      `SELECT id, platform, external_job_id, job_url, job_title, company, question_kind, question_label, detected_at, resolved, answer, run_id, notified_at
       FROM unmatched_questions WHERE resolved = 0 ORDER BY id DESC`
    )
    .all() as unknown as UnmatchedQuestionRowRaw[]
  return rows.map(toRow)
}

export function resolveUnmatchedQuestion(db: DatabaseSync, id: number, answer: string): void {
  db.prepare('UPDATE unmatched_questions SET resolved = 1, answer = ? WHERE id = ?').run(answer, id)
}

/**
 * True when an unresolved row already exists for this exact
 * platform/job/question and was already notified about - guards against
 * re-notifying for the same outstanding question (e.g. a retried apply
 * attempt hitting it again).
 */
export function hasNotifiedUnresolvedQuestion(
  db: DatabaseSync,
  platform: Platform,
  externalJobId: string,
  questionLabel: string
): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM unmatched_questions
       WHERE platform = ? AND external_job_id = ? AND question_label = ?
         AND resolved = 0 AND notified_at IS NOT NULL
       LIMIT 1`
    )
    .get(platform, externalJobId, questionLabel)
  return row !== undefined
}

export function markUnmatchedQuestionNotified(db: DatabaseSync, id: number): void {
  db.prepare('UPDATE unmatched_questions SET notified_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    id
  )
}
