import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import type {
  CreatePipelineContactArgs,
  PipelineContactRow,
  UpdatePipelineContactArgs
} from '../../../shared/types'

interface PipelineContactRowRaw {
  id: number
  platform: PipelineContactRow['platform']
  company: string
  external_job_id: string | null
  contacted_at: string
  contact_note: string | null
  interview_scheduled_at: string | null
  last_follow_up_at: string | null
  status: PipelineContactRow['status']
  created_at: string
}

function toRow(row: PipelineContactRowRaw): PipelineContactRow {
  return {
    id: row.id,
    platform: row.platform,
    company: row.company,
    externalJobId: row.external_job_id,
    contactedAt: row.contacted_at,
    contactNote: row.contact_note,
    interviewScheduledAt: row.interview_scheduled_at,
    lastFollowUpAt: row.last_follow_up_at,
    status: row.status,
    createdAt: row.created_at
  }
}

/** Manual funnel-tracking entry (contacted / interview scheduled / outcome) - see #85. */
export function insertPipelineContact(
  db: DatabaseSync,
  args: CreatePipelineContactArgs,
  now: Date = new Date()
): number {
  const result = db
    .prepare(
      `INSERT INTO pipeline_contacts
        (platform, company, external_job_id, contacted_at, contact_note, interview_scheduled_at, last_follow_up_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      args.platform,
      args.company,
      args.externalJobId ?? null,
      args.contactedAt,
      args.contactNote ?? null,
      args.interviewScheduledAt ?? null,
      args.lastFollowUpAt ?? null,
      args.status ?? 'contacted',
      now.toISOString()
    )
  return Number(result.lastInsertRowid)
}

export function getPipelineContact(db: DatabaseSync, id: number): PipelineContactRow | undefined {
  const row = db
    .prepare(
      `SELECT id, platform, company, external_job_id, contacted_at, contact_note, interview_scheduled_at, last_follow_up_at, status, created_at
       FROM pipeline_contacts WHERE id = ?`
    )
    .get(id) as PipelineContactRowRaw | undefined
  return row ? toRow(row) : undefined
}

/** Most recent first, for the pipeline panel's list. */
export function listPipelineContacts(db: DatabaseSync): PipelineContactRow[] {
  const rows = db
    .prepare(
      `SELECT id, platform, company, external_job_id, contacted_at, contact_note, interview_scheduled_at, last_follow_up_at, status, created_at
       FROM pipeline_contacts ORDER BY id DESC`
    )
    .all() as unknown as PipelineContactRowRaw[]
  return rows.map(toRow)
}

/** Partial update - only fields present in `args` are changed. */
export function updatePipelineContact(db: DatabaseSync, args: UpdatePipelineContactArgs): void {
  const fields: string[] = []
  const values: SQLInputValue[] = []

  function set(column: string, value: SQLInputValue): void {
    fields.push(`${column} = ?`)
    values.push(value)
  }

  if (args.company !== undefined) set('company', args.company)
  if (args.externalJobId !== undefined) set('external_job_id', args.externalJobId)
  if (args.contactedAt !== undefined) set('contacted_at', args.contactedAt)
  if (args.contactNote !== undefined) set('contact_note', args.contactNote)
  if (args.interviewScheduledAt !== undefined) {
    set('interview_scheduled_at', args.interviewScheduledAt)
  }
  if (args.lastFollowUpAt !== undefined) set('last_follow_up_at', args.lastFollowUpAt)
  if (args.status !== undefined) set('status', args.status)

  if (fields.length === 0) return

  values.push(args.id)
  db.prepare(`UPDATE pipeline_contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deletePipelineContact(db: DatabaseSync, id: number): void {
  db.prepare('DELETE FROM pipeline_contacts WHERE id = ?').run(id)
}

/**
 * Entries where a follow-up is overdue: contacted, no interview scheduled
 * yet, and it's been at least `thresholdDays` since the last follow-up (or
 * since the initial contact, if none has been logged) - see brief §2 row 4
 * ("no invite within N days of a contact -> surfaced as a reminder").
 */
export function listFollowUpsDue(
  db: DatabaseSync,
  thresholdDays = 3,
  now: Date = new Date()
): PipelineContactRow[] {
  const cutoff = new Date(now.getTime() - thresholdDays * 24 * 60 * 60_000).toISOString()
  const rows = db
    .prepare(
      `SELECT id, platform, company, external_job_id, contacted_at, contact_note, interview_scheduled_at, last_follow_up_at, status, created_at
       FROM pipeline_contacts
       WHERE interview_scheduled_at IS NULL
         AND status != 'closed'
         AND COALESCE(last_follow_up_at, contacted_at) <= ?
       ORDER BY COALESCE(last_follow_up_at, contacted_at) ASC`
    )
    .all(cutoff) as unknown as PipelineContactRowRaw[]
  return rows.map(toRow)
}
