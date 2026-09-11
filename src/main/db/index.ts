import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { join, dirname, basename } from 'path'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { instanceId } from '../instance'
import { runMigrations, type Migration } from './migrate'
import initMigrationSql from './migrations/20260911T1900_init.sql?raw'
import appliedCountsMetricSql from './migrations/20260911T2100_applied_counts_metric.sql?raw'
import appliedJobsSql from './migrations/20260911T2200_applied_jobs.sql?raw'
import applyAttemptsSql from './migrations/20260911T2300_apply_attempts.sql?raw'
import companyBlacklistSql from './migrations/20260911T2400_company_blacklist.sql?raw'
import actionBudgetSql from './migrations/20260911T2500_action_budget.sql?raw'

const migrations: Migration[] = [
  { id: '20260911T1900_init.sql', sql: initMigrationSql },
  { id: '20260911T2100_applied_counts_metric.sql', sql: appliedCountsMetricSql },
  { id: '20260911T2200_applied_jobs.sql', sql: appliedJobsSql },
  { id: '20260911T2300_apply_attempts.sql', sql: applyAttemptsSql },
  { id: '20260911T2400_company_blacklist.sql', sql: companyBlacklistSql },
  { id: '20260911T2500_action_budget.sql', sql: actionBudgetSql }
]

let db: DatabaseSync | undefined

function getDbPath(): string {
  return join(app.getPath('userData'), `bojeno-${instanceId}.sqlite`)
}

function backupDbFile(dbPath: string): void {
  // Nothing to back up yet on a brand-new DB file.
  if (!existsSync(dbPath)) return
  const backupDir = join(process.cwd(), 'migration-backups')
  mkdirSync(backupDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  copyFileSync(dbPath, join(backupDir, `${timestamp}_${basename(dbPath)}`))
}

export function getDb(): DatabaseSync {
  if (!db) {
    const dbPath = getDbPath()
    mkdirSync(dirname(dbPath), { recursive: true })
    db = new DatabaseSync(dbPath)
    runMigrations(db, migrations, () => backupDbFile(dbPath))
  }
  return db
}
