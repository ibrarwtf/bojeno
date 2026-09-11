import type { DatabaseSync } from 'node:sqlite'
import type { Platform } from '../../../shared/types'

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
