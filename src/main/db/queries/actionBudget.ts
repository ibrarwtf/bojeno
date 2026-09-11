import type { DatabaseSync } from 'node:sqlite'
import type { Source } from '../../../shared/types'

/** Calendar-day bucket ('YYYY-MM-DD') - a simplified rolling window, per the brief's action_budget concept. */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function incrementActionBudget(
  db: DatabaseSync,
  platform: Source,
  actionType: string
): void {
  db.prepare(
    `INSERT INTO action_budget (platform, action_type, window_date, count) VALUES (?, ?, ?, 1)
     ON CONFLICT (platform, action_type, window_date) DO UPDATE SET count = count + 1`
  ).run(platform, actionType, today())
}

export function getActionBudgetToday(
  db: DatabaseSync,
  platform: Source,
  actionType: string
): number {
  const row = db
    .prepare(
      'SELECT count FROM action_budget WHERE platform = ? AND action_type = ? AND window_date = ?'
    )
    .get(platform, actionType, today()) as { count: number } | undefined
  return row?.count ?? 0
}
