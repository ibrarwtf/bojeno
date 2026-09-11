import type { DatabaseSync } from 'node:sqlite'
import type { AppliedCountPoint, Platform } from '../../../shared/types'

export function insertAppliedCount(
  db: DatabaseSync,
  platform: Platform,
  metric: string,
  count: number,
  fetchedAt: string
): void {
  db.prepare(
    'INSERT INTO applied_counts (platform, metric, count, fetched_at) VALUES (?, ?, ?, ?)'
  ).run(platform, metric, count, fetchedAt)
}

/**
 * History for the tracker chart — the 'applied' metric only, since that's
 * the one figure both platforms have in common (Naukri's recruiter_actions
 * has no LinkedIn counterpart to plot against).
 */
export function getAppliedCountHistory(db: DatabaseSync): AppliedCountPoint[] {
  const rows = db
    .prepare(
      "SELECT platform, count, fetched_at FROM applied_counts WHERE metric = 'applied' ORDER BY fetched_at ASC"
    )
    .all() as { platform: Platform; count: number; fetched_at: string }[]
  return rows.map((row) => ({
    platform: row.platform,
    count: row.count,
    fetchedAt: row.fetched_at
  }))
}
