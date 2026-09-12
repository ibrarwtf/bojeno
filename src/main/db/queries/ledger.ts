import type { DatabaseSync } from 'node:sqlite'
import type { Platform, PlatformApplyRate } from '../../../shared/types'

/**
 * Logging/visibility only - see bojeno-project-brief.md §5 and issue #84.
 * No cap, block, or auto-pause is derived from this; it exists purely so
 * the owner can see current pace at a glance (surfaced in AccountHeader).
 * Counts only real submissions (dry_run = 0, outcome = 'applied') - a dry
 * run or a skip/needs_review/error never actually hit "Submit" on
 * LinkedIn, so counting them would overstate real pace against any future
 * per-platform limit.
 */
export function getApplyRateLedger(db: DatabaseSync, now: Date = new Date()): PlatformApplyRate[] {
  const hourAgo = new Date(now.getTime() - 60 * 60_000).toISOString()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000).toISOString()

  const rows = db
    .prepare(
      `SELECT
         platform,
         COUNT(CASE WHEN attempted_at >= ? THEN 1 END) AS last_hour,
         COUNT(*) AS last_24h
       FROM apply_attempts
       WHERE dry_run = 0 AND outcome = 'applied' AND attempted_at >= ?
       GROUP BY platform`
    )
    .all(hourAgo, dayAgo) as unknown as {
    platform: Platform
    last_hour: number
    last_24h: number
  }[]

  return rows.map((row) => ({
    platform: row.platform,
    lastHour: row.last_hour,
    last24h: row.last_24h
  }))
}

/** Convenience for a single platform - AccountHeader only ever needs its own. */
export function getApplyRateForPlatform(
  db: DatabaseSync,
  platform: Platform,
  now: Date = new Date()
): PlatformApplyRate {
  const found = getApplyRateLedger(db, now).find((row) => row.platform === platform)
  return found ?? { platform, lastHour: 0, last24h: 0 }
}
