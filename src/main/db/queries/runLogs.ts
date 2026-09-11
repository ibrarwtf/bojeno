import type { DatabaseSync } from 'node:sqlite'
import type { RunMode, RunOutcome } from '../../../shared/types'

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
