import { getDb } from '../db'
import { getMode } from '../modes'
import { getAdapter } from '../adapters/registry'
import { upsertAppliedJob } from '../db/queries/appliedJobs'
import { insertRunLog } from '../db/queries/runLogs'
import type { FetchRecentAppliedJobsResult, Platform } from '../../shared/types'

/**
 * LinkedIn-only for now — same mode gate + login gate + run_logs convention
 * as fetchAppliedCount, but for the per-job list rather than the aggregate
 * count.
 */
export async function fetchRecentAppliedJobs(
  platform: Platform
): Promise<FetchRecentAppliedJobsResult> {
  const db = getDb()
  const mode = getMode()
  const adapter = getAdapter(platform)
  const script = `${platform}:fetchRecentAppliedJobs`
  const startedAt = Date.now()

  if (!adapter.checkLogin || !adapter.recentAppliedJobs) {
    throw new Error(`${platform} adapter is missing checkLogin/recentAppliedJobs capability`)
  }

  const loginStatus = await adapter.checkLogin()
  if (!loginStatus.loggedIn) {
    insertRunLog(db, {
      script,
      outcome: 'auth_required',
      triggerType: 'manual',
      runMode: mode,
      duration: Date.now() - startedAt
    })
    return { outcome: 'auth_required', platform }
  }

  try {
    const jobs = await adapter.recentAppliedJobs()
    const capturedAt = new Date().toISOString()

    if (mode !== 'read-only') {
      for (const job of jobs) {
        upsertAppliedJob(db, platform, job, capturedAt)
      }
    }
    insertRunLog(db, {
      script,
      outcome: 'success',
      triggerType: 'manual',
      runMode: mode,
      duration: Date.now() - startedAt
    })

    return { outcome: 'success', platform, jobsFound: jobs.length }
  } catch (error) {
    insertRunLog(db, {
      script,
      outcome: 'failed',
      triggerType: 'manual',
      runMode: mode,
      duration: Date.now() - startedAt,
      errorDetail: error instanceof Error ? { message: error.message } : error
    })
    return { outcome: 'failed', platform }
  }
}
