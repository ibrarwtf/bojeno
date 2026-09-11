import type { DatabaseSync } from 'node:sqlite'
import type { RunLogRow, RunMode, RunOutcome } from '../../../shared/types'

export interface RunLogEntry {
  script: string
  outcome: RunOutcome
  triggerType: 'manual' | 'auto' | 'scheduled'
  runMode: RunMode
  triggeredBy?: string
  duration?: number
  selector?: string
  entityType?: string
  entityId?: string
  errorDetail?: unknown
  runId?: string
  stepIndex?: number
}

/** Most recent first, for the live log panel. */
export function getRecentRunLogs(db: DatabaseSync, limit = 50): RunLogRow[] {
  const rows = db
    .prepare('SELECT timestamp, script, outcome, entity_id FROM run_logs ORDER BY id DESC LIMIT ?')
    .all(limit) as {
    timestamp: string
    script: string
    outcome: RunOutcome
    entity_id: string | null
  }[]
  return rows.map((row) => ({
    timestamp: row.timestamp,
    script: row.script,
    outcome: row.outcome,
    entityId: row.entity_id
  }))
}

export function insertRunLog(db: DatabaseSync, entry: RunLogEntry): void {
  db.prepare(
    `INSERT INTO run_logs
      (run_id, step_index, timestamp, script, selector, outcome, duration, trigger_type, triggered_by, entity_type, entity_id, error_detail, run_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.runId ?? null,
    entry.stepIndex ?? null,
    new Date().toISOString(),
    entry.script,
    entry.selector ?? null,
    entry.outcome,
    entry.duration ?? null,
    entry.triggerType,
    entry.triggeredBy ?? null,
    entry.entityType ?? null,
    entry.entityId ?? null,
    entry.errorDetail !== undefined ? JSON.stringify(entry.errorDetail) : null,
    entry.runMode
  )
}
