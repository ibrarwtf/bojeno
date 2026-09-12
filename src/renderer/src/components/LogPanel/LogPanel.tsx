import { useEffect, useState } from 'react'
import type { RunLogRow } from '../../../../shared/types'

const POLL_MS = 3000

/** Code identifiers -> what a person actually reads. */
const SCRIPT_LABELS: Record<string, string> = {
  'linkedin:runSequentialSearch': 'Search run',
  'linkedin:runSequentialSearch:job': 'Job',
  'linkedin:applyToJob': 'Apply to job',
  'linkedin:fetchAppliedCount': 'Fetch applied count',
  'linkedin:fetchRecentAppliedJobs': 'Fetch recent applied jobs'
}

/**
 * One-word action taken for this row, for the status column - not the raw
 * DB `outcome` enum (which only knows 'success'/'failed'/'skipped'/... and
 * can't tell an actual apply from a dry run from a review-needed case, all
 * three of which are stored as 'success'). Falls back to `outcome` itself
 * for rows with no per-job result (the run's own summary row, auth/rate
 * errors, etc).
 */
function statusWord(row: RunLogRow): string {
  const detail = row.detail as Record<string, unknown> | null
  switch (detail?.resultOutcome) {
    case 'applied':
      return 'applied'
    case 'dry_run_ok':
      return 'dryrun'
    case 'needs_review':
      return 'review'
    case 'skipped':
      return 'skipped'
    case 'error':
      return 'error'
  }
  switch (row.outcome) {
    case 'failed':
      return 'error'
    case 'auth_required':
      return 'auth required'
    case 'rate_limited':
      return 'rate limited'
    case 'awaiting_input':
      return 'awaiting input'
    case 'success':
      return 'done'
    default:
      return row.outcome
  }
}

/** CSS-safe modifier for statusWord()'s text, e.g. "review needed" -> "review-needed". */
function statusWordClass(row: RunLogRow): string {
  return statusWord(row).replace(/\s+/g, '-')
}

function describeRow(row: RunLogRow): string {
  const detail = row.detail as Record<string, unknown> | null
  if (!detail) return SCRIPT_LABELS[row.script] ?? row.script

  if (row.outcome === 'skipped' && typeof detail.reason === 'string') return detail.reason
  if (row.outcome === 'failed' && typeof detail.message === 'string') return detail.message

  if (row.script === 'linkedin:runSequentialSearch' && detail.summary) {
    const s = detail.summary as {
      total: number
      applied: number
      dryRunApplied: number
      needsReview: number
      skipped: number
      failed: number
    }
    const appliedLabel = detail.dryRun ? `${s.dryRunApplied} dryrun` : `${s.applied} applied`
    return `${appliedLabel}/${s.total} · ${s.needsReview} review · ${s.skipped} skipped · ${s.failed} failed`
  }

  if (typeof detail.resultReason === 'string') return detail.resultReason
  if (detail.applicantCount) return `${detail.applicantCount} applicants`

  return SCRIPT_LABELS[row.script] ?? row.script
}

/** "Title @ Company (Location)" - whichever of the three are known. */
function jobLabel(row: RunLogRow): string | null {
  if (!row.jobTitle && !row.company) return null
  const titleCompany = [row.jobTitle, row.company].filter(Boolean).join(' @ ')
  return row.location ? `${titleCompany} (${row.location})` : titleCompany
}

interface RunGroup {
  runId: string | null
  rows: RunLogRow[]
}

/**
 * Consecutive rows sharing a run_id become one group (its rows kept in
 * chronological/job-processing order); ungrouped rows (single-shot actions
 * with no run_id) become a group of one. Groups themselves come back
 * newest-first, so the newest run/action is always at the top - no
 * scrolling to the bottom to see what just happened.
 */
function groupByRun(rowsNewestFirst: RunLogRow[]): RunGroup[] {
  const chronological = [...rowsNewestFirst].reverse()
  const groups: RunGroup[] = []
  for (const row of chronological) {
    const last = groups[groups.length - 1]
    if (row.runId && last?.runId === row.runId) {
      last.rows.push(row)
    } else {
      groups.push({ runId: row.runId, rows: [row] })
    }
  }
  return groups.reverse()
}

export function LogPanel(): React.JSX.Element {
  const [logs, setLogs] = useState<RunLogRow[]>([])
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function poll(): Promise<void> {
      const rows = await window.bojeno.getRunLogs()
      if (!cancelled) setLogs(rows)
    }
    void poll()
    const interval = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const groups = cleared ? [] : groupByRun(logs)

  return (
    <div className="log-panel">
      <div className="log-panel-header">
        <span>Live Logs (Current Run)</span>
        <button
          onClick={() => {
            setCleared(true)
          }}
        >
          Clear
        </button>
      </div>
      <div className="log-panel-body">
        {groups.length === 0 ? (
          <p className="log-panel-empty">No activity yet</p>
        ) : (
          groups.map((group) => {
            const key = group.runId ?? `${group.rows[0].timestamp}-${group.rows[0].script}`

            // A single ungrouped row (no run_id - a one-off action like a
            // manual Apply click) renders as one line, job label included.
            if (!group.runId) {
              const row = group.rows[0]
              return (
                <div key={key} className="log-panel-row">
                  <span className="log-panel-time">
                    {new Date(row.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`log-panel-outcome log-panel-outcome-${statusWordClass(row)}`}>
                    {statusWord(row)}
                  </span>
                  {jobLabel(row) ? (
                    <span className="log-panel-job">{jobLabel(row)}</span>
                  ) : (
                    <span className="log-panel-script">
                      {SCRIPT_LABELS[row.script] ?? row.script}
                    </span>
                  )}
                  <span className="log-panel-detail">{describeRow(row)}</span>
                </div>
              )
            }

            // A real run (run_id set): its own summary row (no entityId)
            // heads the group; per-job rows list underneath, indented. A run
            // that's still going (or was killed before finishing) has no
            // summary row yet - render a synthetic "in progress" header
            // instead of falling back to a job row, which would otherwise
            // print that job twice: once unindented and mislabeled as the
            // header, once correctly further down.
            const summaryRow = group.rows.find((r) => !r.entityId)
            // Newest job on top, matching the newest-run-on-top order groups
            // already have - a run in progress should show what just
            // happened without scrolling down to the bottom of the group.
            const jobRows = group.rows.filter((r) => r.entityId).reverse()

            return (
              <div key={key} className="log-panel-group">
                <div className="log-panel-row">
                  <span className="log-panel-time">
                    {new Date((summaryRow ?? jobRows[0]).timestamp).toLocaleTimeString()}
                  </span>
                  <span className="log-panel-script">
                    {summaryRow
                      ? (SCRIPT_LABELS[summaryRow.script] ?? summaryRow.script)
                      : 'Search run'}
                  </span>
                  <span
                    className={`log-panel-outcome log-panel-outcome-${summaryRow ? summaryRow.outcome : 'pending'}`}
                  >
                    {summaryRow ? summaryRow.outcome : 'in progress'}
                  </span>
                  {summaryRow && (
                    <span className="log-panel-detail">{describeRow(summaryRow)}</span>
                  )}
                </div>
                {jobRows.map((row, i) => (
                  <div key={i} className="log-panel-row log-panel-row-job">
                    <span className="log-panel-time">
                      {new Date(row.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`log-panel-outcome log-panel-outcome-${statusWordClass(row)}`}>
                      {statusWord(row)}
                    </span>
                    <span className="log-panel-job">{jobLabel(row) ?? row.entityId}</span>
                    <span className="log-panel-detail">{describeRow(row)}</span>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
