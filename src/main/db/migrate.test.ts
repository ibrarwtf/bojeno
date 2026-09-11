import { describe, it, expect } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations, type Migration } from './migrate'
import initMigrationSql from './migrations/20260911T1900_init.sql?raw'
import appliedCountsMetricSql from './migrations/20260911T2100_applied_counts_metric.sql?raw'
import applyAttemptsSql from './migrations/20260911T2300_apply_attempts.sql?raw'
import companyBlacklistSql from './migrations/20260911T2400_company_blacklist.sql?raw'

const initMigration: Migration = { id: '20260911T1900_init.sql', sql: initMigrationSql }
const metricMigration: Migration = {
  id: '20260911T2100_applied_counts_metric.sql',
  sql: appliedCountsMetricSql
}
const applyAttemptsMigration: Migration = {
  id: '20260911T2300_apply_attempts.sql',
  sql: applyAttemptsSql
}
const companyBlacklistMigration: Migration = {
  id: '20260911T2400_company_blacklist.sql',
  sql: companyBlacklistSql
}

function tableNames(db: DatabaseSync): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string
    }[]
  ).map((row) => row.name)
}

describe('runMigrations', () => {
  it('applies a pending migration to a fresh fixture DB', () => {
    const db = new DatabaseSync(':memory:')
    const applied = runMigrations(db, [initMigration], () => undefined)

    expect(applied).toEqual([initMigration.id])
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['run_logs', 'applied_counts', 'applied_migrations'])
    )
  })

  it('records the migration in applied_migrations', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db, [initMigration], () => undefined)

    const rows = db.prepare('SELECT id FROM applied_migrations').all() as { id: string }[]
    expect(rows.map((row) => row.id)).toEqual([initMigration.id])
  })

  it('does not re-apply an already-applied migration', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db, [initMigration], () => undefined)

    const secondRun = runMigrations(db, [initMigration], () => undefined)
    expect(secondRun).toEqual([])
  })

  it('calls backup once per newly-applied migration, before it runs', () => {
    const db = new DatabaseSync(':memory:')
    let backupCount = 0
    let tableExistedAtBackupTime = true

    runMigrations(db, [initMigration], () => {
      backupCount++
      tableExistedAtBackupTime = tableNames(db).includes('run_logs')
    })

    expect(backupCount).toBe(1)
    expect(tableExistedAtBackupTime).toBe(false)
  })

  it('applies multiple pending migrations in id order', () => {
    const db = new DatabaseSync(':memory:')
    const second: Migration = {
      id: '20260911T2000_add_note.sql',
      sql: 'ALTER TABLE run_logs ADD COLUMN note TEXT'
    }

    const applied = runMigrations(db, [second, initMigration], () => undefined)
    expect(applied).toEqual([initMigration.id, second.id])
  })

  it('adds a metric column to applied_counts, defaulting existing rows to "applied"', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db, [initMigration], () => undefined)
    db.prepare(
      "INSERT INTO applied_counts (platform, count, fetched_at) VALUES ('linkedin', 459, '2026-09-11T00:00:00.000Z')"
    ).run()

    runMigrations(db, [initMigration, metricMigration], () => undefined)

    const row = db.prepare('SELECT metric FROM applied_counts').get() as { metric: string }
    expect(row.metric).toBe('applied')
  })

  it('creates apply_attempts', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db, [initMigration, applyAttemptsMigration], () => undefined)

    expect(tableNames(db)).toContain('apply_attempts')
  })

  it('creates company_blacklist and seeds the two known-bad companies', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db, [initMigration, companyBlacklistMigration], () => undefined)

    const rows = db.prepare('SELECT company_name FROM company_blacklist').all() as {
      company_name: string
    }[]
    expect(rows.map((row) => row.company_name)).toEqual(
      expect.arrayContaining(['Hire Feed', 'Quik Hire Staffing'])
    )
  })
})
