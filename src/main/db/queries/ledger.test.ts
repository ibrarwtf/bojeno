import { describe, it, expect } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations, type Migration } from '../migrate'
import initMigrationSql from '../migrations/20260911T1900_init.sql?raw'
import applyAttemptsSql from '../migrations/20260911T2300_apply_attempts.sql?raw'
import { insertApplyAttempt, type ApplyAttemptEntry } from './applyAttempts'
import { getApplyRateLedger, getApplyRateForPlatform } from './ledger'

const migrations: Migration[] = [
  { id: '20260911T1900_init.sql', sql: initMigrationSql },
  { id: '20260911T2300_apply_attempts.sql', sql: applyAttemptsSql }
]

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  runMigrations(db, migrations, () => undefined)
  return db
}

const NOW = new Date('2026-09-12T12:00:00.000Z')
const minutesAgo = (m: number): string => new Date(NOW.getTime() - m * 60_000).toISOString()

function attempt(overrides: Partial<ApplyAttemptEntry> = {}): ApplyAttemptEntry {
  return {
    platform: 'linkedin',
    externalJobId: 'job-1',
    outcome: 'applied',
    dryRun: false,
    attemptedAt: minutesAgo(10),
    ...overrides
  }
}

describe('getApplyRateLedger', () => {
  it('counts real applies in the last hour and last 24h, per platform', () => {
    const db = freshDb()
    insertApplyAttempt(db, attempt({ attemptedAt: minutesAgo(10) })) // within both windows
    insertApplyAttempt(db, attempt({ attemptedAt: minutesAgo(90) })) // within 24h only
    insertApplyAttempt(db, attempt({ attemptedAt: minutesAgo(60 * 30) })) // >24h ago, excluded

    const ledger = getApplyRateLedger(db, NOW)

    expect(ledger).toEqual([{ platform: 'linkedin', lastHour: 1, last24h: 2 }])
  })

  it('excludes dry-run attempts - they never actually submitted anything', () => {
    const db = freshDb()
    insertApplyAttempt(db, attempt({ dryRun: true, attemptedAt: minutesAgo(5) }))

    expect(getApplyRateLedger(db, NOW)).toEqual([])
  })

  it('excludes non-applied outcomes (skipped, needs_review, error)', () => {
    const db = freshDb()
    insertApplyAttempt(db, attempt({ outcome: 'skipped', attemptedAt: minutesAgo(5) }))
    insertApplyAttempt(db, attempt({ outcome: 'needs_review', attemptedAt: minutesAgo(5) }))
    insertApplyAttempt(db, attempt({ outcome: 'error', attemptedAt: minutesAgo(5) }))

    expect(getApplyRateLedger(db, NOW)).toEqual([])
  })

  it('breaks counts out per platform', () => {
    const db = freshDb()
    insertApplyAttempt(db, attempt({ platform: 'linkedin', attemptedAt: minutesAgo(5) }))
    insertApplyAttempt(db, attempt({ platform: 'naukri', attemptedAt: minutesAgo(5) }))
    insertApplyAttempt(db, attempt({ platform: 'naukri', attemptedAt: minutesAgo(5) }))

    const ledger = getApplyRateLedger(db, NOW).sort((a, b) => a.platform.localeCompare(b.platform))

    expect(ledger).toEqual([
      { platform: 'linkedin', lastHour: 1, last24h: 1 },
      { platform: 'naukri', lastHour: 2, last24h: 2 }
    ])
  })

  it('returns an empty array when nothing has been logged', () => {
    const db = freshDb()
    expect(getApplyRateLedger(db, NOW)).toEqual([])
  })
})

describe('getApplyRateForPlatform', () => {
  it('returns zeroed counts for a platform with no rows', () => {
    const db = freshDb()
    expect(getApplyRateForPlatform(db, 'linkedin', NOW)).toEqual({
      platform: 'linkedin',
      lastHour: 0,
      last24h: 0
    })
  })

  it('returns that platform only, ignoring another platform entirely', () => {
    const db = freshDb()
    insertApplyAttempt(db, attempt({ platform: 'naukri', attemptedAt: minutesAgo(5) }))

    expect(getApplyRateForPlatform(db, 'linkedin', NOW)).toEqual({
      platform: 'linkedin',
      lastHour: 0,
      last24h: 0
    })
  })
})
