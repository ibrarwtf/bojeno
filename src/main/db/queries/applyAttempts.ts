import type { DatabaseSync } from 'node:sqlite'
import type { ApplyResult, Source } from '../../../shared/types'

export interface ApplyAttemptEntry {
  platform: Source
  externalJobId: string
  outcome: ApplyResult['outcome']
  reason?: string
  header?: string
  dryRun: boolean
  attemptedAt: string
}

/** Append-only - a job can be attempted more than once over time (e.g. after fixing a needs_review). */
export function insertApplyAttempt(db: DatabaseSync, entry: ApplyAttemptEntry): void {
  db.prepare(
    `INSERT INTO apply_attempts
      (platform, external_job_id, outcome, reason, header, dry_run, attempted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.platform,
    entry.externalJobId,
    entry.outcome,
    entry.reason ?? null,
    entry.header ?? null,
    entry.dryRun ? 1 : 0,
    entry.attemptedAt
  )
}
