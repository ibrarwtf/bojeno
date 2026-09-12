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
import linkedinSavedSearchesSql from './migrations/20260912T0000_linkedin_saved_searches.sql?raw'
import runLogsRicherDetailSql from './migrations/20260912T0100_run_logs_richer_detail.sql?raw'
import jobSnapshotsAndUnmatchedQuestionsSql from './migrations/20260912T0200_job_snapshots_and_unmatched_questions.sql?raw'
import unmatchedQuestionsContextSql from './migrations/20260912T0300_unmatched_questions_context.sql?raw'
import savedSearchGeoAndYearsSql from './migrations/20260912T0400_saved_search_geo_and_years.sql?raw'
import blacklistHiredSql from './migrations/20260912T0500_blacklist_hired.sql?raw'
import blacklistReasonSql from './migrations/20260912T0600_blacklist_reason.sql?raw'
import blacklistMoreSpamAgenciesSql from './migrations/20260912T0700_blacklist_more_spam_agencies.sql?raw'
import companiesSql from './migrations/20260912T0800_companies.sql?raw'

const migrations: Migration[] = [
  { id: '20260911T1900_init.sql', sql: initMigrationSql },
  { id: '20260911T2100_applied_counts_metric.sql', sql: appliedCountsMetricSql },
  { id: '20260911T2200_applied_jobs.sql', sql: appliedJobsSql },
  { id: '20260911T2300_apply_attempts.sql', sql: applyAttemptsSql },
  { id: '20260911T2400_company_blacklist.sql', sql: companyBlacklistSql },
  { id: '20260912T0000_linkedin_saved_searches.sql', sql: linkedinSavedSearchesSql },
  { id: '20260912T0100_run_logs_richer_detail.sql', sql: runLogsRicherDetailSql },
  {
    id: '20260912T0200_job_snapshots_and_unmatched_questions.sql',
    sql: jobSnapshotsAndUnmatchedQuestionsSql
  },
  { id: '20260912T0300_unmatched_questions_context.sql', sql: unmatchedQuestionsContextSql },
  { id: '20260912T0400_saved_search_geo_and_years.sql', sql: savedSearchGeoAndYearsSql },
  { id: '20260912T0500_blacklist_hired.sql', sql: blacklistHiredSql },
  { id: '20260912T0600_blacklist_reason.sql', sql: blacklistReasonSql },
  {
    id: '20260912T0700_blacklist_more_spam_agencies.sql',
    sql: blacklistMoreSpamAgenciesSql
  },
  { id: '20260912T0800_companies.sql', sql: companiesSql }
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
