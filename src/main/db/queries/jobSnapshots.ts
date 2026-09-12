import type { DatabaseSync } from 'node:sqlite'
import type { JobDetails, Platform } from '../../../shared/types'

export interface JobSnapshotArgs {
  platform: Platform
  externalJobId: string
  location?: string | null
}

/** One row per JD capture - the full text plus every parsed signal, for later audit without re-scraping. */
export function insertJobSnapshot(
  db: DatabaseSync,
  args: JobSnapshotArgs,
  details: JobDetails
): void {
  db.prepare(
    `INSERT INTO job_snapshots
      (platform, external_job_id, job_title, company, location, description_text, applicant_count, applicant_insight_total, applicant_insight_past_day, has_fit_signal, years_required, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    args.platform,
    args.externalJobId,
    details.title,
    details.company,
    args.location ?? null,
    details.descriptionText,
    details.applicantCount,
    details.applicantInsightCounts?.total ?? null,
    details.applicantInsightCounts?.pastDay ?? null,
    details.hasFitSignal ? 1 : 0,
    details.yearsRequired,
    new Date().toISOString()
  )
}
