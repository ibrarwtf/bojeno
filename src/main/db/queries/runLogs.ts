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
  jobTitle?: string
  company?: string
  location?: string
  /** Freeform context for this row - a skip reason, parsed JD signal, or an error message. */
  detail?: unknown
  runId?: string
  stepIndex?: number
}

interface RunLogRowRaw {
  run_id: string | null
  timestamp: string
  script: string
  outcome: RunOutcome
  entity_id: string | null
  job_title: string | null
  company: string | null
  location: string | null
  detail: string | null
}

function toRunLogRow(row: RunLogRowRaw): RunLogRow {
  return {
    runId: row.run_id,
    timestamp: row.timestamp,
    script: row.script,
    outcome: row.outcome,
    entityId: row.entity_id,
    jobTitle: row.job_title,
    company: row.company,
    location: row.location,
    detail: row.detail !== null ? JSON.parse(row.detail) : null
  }
}

const SELECT_COLUMNS =
  'run_id, timestamp, script, outcome, entity_id, job_title, company, location, detail'

/**
 * Most recent first, for the live log panel. `since` (an ISO timestamp)
 * scopes it to rows from that point on - the panel uses this to show only
 * the current app session's activity without deleting or otherwise
 * touching older history.
 */
export function getRecentRunLogs(db: DatabaseSync, limit = 50, since?: string): RunLogRow[] {
  const rows = (since
    ? db
        .prepare(
          `SELECT ${SELECT_COLUMNS} FROM run_logs WHERE timestamp >= ? ORDER BY id DESC LIMIT ?`
        )
        .all(since, limit)
    : db
        .prepare(`SELECT ${SELECT_COLUMNS} FROM run_logs ORDER BY id DESC LIMIT ?`)
        .all(limit)) as unknown as RunLogRowRaw[]
  return rows.map(toRunLogRow)
}

export interface JobLogCacheHit {
  runId: string | null
  timestamp: string
  outcome: RunOutcome
}

/**
 * Most recent run_logs row recorded for this job id, across every search
 * that's ever touched it - lets a run skip re-capturing/re-deciding a job
 * it (or a different saved search covering overlapping results) already
 * processed, instead of redoing the same work every time the 9-search
 * rotation re-surfaces the same posting. `undefined` means genuinely new.
 */
export function findLatestJobLog(db: DatabaseSync, entityId: string): JobLogCacheHit | undefined {
  const row = db
    .prepare(
      `SELECT run_id, timestamp, outcome FROM run_logs
       WHERE entity_type = 'job' AND entity_id = ?
       ORDER BY id DESC LIMIT 1`
    )
    .get(entityId) as unknown as
    { run_id: string | null; timestamp: string; outcome: RunOutcome } | undefined
  if (!row) return undefined
  return { runId: row.run_id, timestamp: row.timestamp, outcome: row.outcome }
}

export function insertRunLog(db: DatabaseSync, entry: RunLogEntry): void {
  db.prepare(
    `INSERT INTO run_logs
      (run_id, step_index, timestamp, script, selector, outcome, duration, trigger_type, triggered_by, entity_type, entity_id, job_title, company, location, detail, run_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    entry.jobTitle ?? null,
    entry.company ?? null,
    entry.location ?? null,
    entry.detail !== undefined ? JSON.stringify(entry.detail) : null,
    entry.runMode
  )
}
