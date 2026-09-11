import type { DatabaseSync } from 'node:sqlite'
import type { Platform, ScrapedJob } from '../../../shared/types'

/** Upsert on (platform, external_job_id) — re-running the scrape is a no-op for already-captured jobs. */
export function upsertAppliedJob(
  db: DatabaseSync,
  platform: Platform,
  job: ScrapedJob,
  capturedAt: string
): void {
  db.prepare(
    `INSERT INTO applied_jobs
      (platform, external_job_id, title, company, location, applied_at, applied_relative, job_url, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (platform, external_job_id) DO UPDATE SET captured_at = excluded.captured_at`
  ).run(
    platform,
    job.externalJobId,
    job.title,
    job.company,
    job.location,
    job.appliedAt,
    job.appliedRelative,
    job.jobUrl,
    capturedAt
  )
}
