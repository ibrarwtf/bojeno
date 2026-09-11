import { getDb } from '../db'
import { getMode } from '../modes'
import { getAdapter } from '../adapters/registry'
import { insertApplyAttempt } from '../db/queries/applyAttempts'
import { insertRunLog } from '../db/queries/runLogs'
import { isCompanyBlacklisted } from '../db/queries/companyBlacklist'
import { incrementActionBudget } from '../db/queries/actionBudget'
import type { ApplyResult, Platform } from '../../shared/types'

/**
 * Same mode gate + login gate + run_logs convention as fetchAppliedCount/
 * fetchRecentAppliedJobs, plus the actual safety-critical part for this
 * action: only 'live' mode can honor a real submit request. 'dry-run' and
 * 'read-only' force dryRun=true regardless of what was requested, so a
 * stray "live" apply call can't submit anything while the global mode
 * switch isn't set to live.
 */
export async function applyToJob(
  platform: Platform,
  jobId: string,
  requestedDryRun: boolean
): Promise<ApplyResult> {
  const db = getDb()
  const mode = getMode()
  const adapter = getAdapter(platform)
  const script = `${platform}:applyToJob`
  const startedAt = Date.now()

  if (!adapter.checkLogin || !adapter.applyToJob) {
    throw new Error(`${platform} adapter is missing checkLogin/applyToJob capability`)
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
    return { outcome: 'error', reason: 'not logged in' }
  }

  // Checked before ever opening the apply modal - a blacklisted company is
  // never attempted, never burns a shot. Costs one extra page read
  // (captureJobDetails against the job's plain view URL) since applyToJob
  // itself has no reason to know the company otherwise.
  if (adapter.captureJobDetails) {
    const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`
    const details = await adapter.captureJobDetails(jobUrl)
    if (isCompanyBlacklisted(db, details.company)) {
      const reason = `blacklisted company: ${details.company}`
      insertRunLog(db, {
        script,
        outcome: 'skipped',
        triggerType: 'manual',
        runMode: mode,
        duration: Date.now() - startedAt,
        entityType: 'job',
        entityId: jobId
      })
      return { outcome: 'skipped', reason }
    }
  }

  const dryRun = mode === 'live' ? requestedDryRun : true

  try {
    const result = await adapter.applyToJob(jobId, dryRun)
    const attemptedAt = new Date().toISOString()

    if (mode !== 'read-only') {
      insertApplyAttempt(db, {
        platform,
        externalJobId: jobId,
        outcome: result.outcome,
        reason: result.reason,
        header: result.header,
        dryRun,
        attemptedAt
      })
      incrementActionBudget(db, platform, 'apply')
    }
    insertRunLog(db, {
      script,
      outcome: result.outcome === 'error' ? 'failed' : 'success',
      triggerType: 'manual',
      runMode: mode,
      duration: Date.now() - startedAt,
      entityType: 'job',
      entityId: jobId
    })

    return result
  } catch (error) {
    insertRunLog(db, {
      script,
      outcome: 'failed',
      triggerType: 'manual',
      runMode: mode,
      duration: Date.now() - startedAt,
      entityType: 'job',
      entityId: jobId,
      errorDetail: error instanceof Error ? { message: error.message } : error
    })
    throw error
  }
}
