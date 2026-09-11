import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import type { ScanJobsArgs } from '../../../shared/ipc-contract'
import type { ApplyResult, RunMode } from '../../../shared/types'
import { withLock } from '../../lock'
import { ensurePlatformViewLoaded } from '../../window'
import { getDb } from '../../db'
import { insertRunLog } from '../../db/queries/runLogs'
import { insertAppliedCount } from '../../db/queries/appliedCounts'
import { upsertAppliedJob } from '../../db/queries/appliedJobs'
import { insertApplyAttempt } from '../../db/queries/applyAttempts'
import { isCompanyBlacklisted } from '../../db/queries/companyBlacklist'
import {
  checkLogin,
  appliedCount,
  recentAppliedJobs,
  captureJobDetails,
  scanJobs,
  applyToJob as applyToLinkedinJob
} from '../../adapters/linkedin/adapter'

export function registerLinkedinHandlers(): void {
  ipcMain.handle(IpcChannels.linkedinCheckLogin, () =>
    withLock('linkedin', () => {
      ensurePlatformViewLoaded('linkedin')
      return checkLogin()
    })
  )

  ipcMain.handle(IpcChannels.linkedinFetchAppliedCount, (_event, mode: RunMode = 'live') =>
    withLock('linkedin', async () => {
      ensurePlatformViewLoaded('linkedin')
      const db = getDb()
      const script = 'linkedin:fetchAppliedCount'
      const startedAt = Date.now()

      const loginStatus = await checkLogin()
      if (!loginStatus.loggedIn) {
        insertRunLog(db, {
          script,
          outcome: 'auth_required',
          triggerType: 'manual',
          runMode: mode,
          duration: Date.now() - startedAt
        })
        return { outcome: 'auth_required' as const, platform: 'linkedin' as const }
      }

      try {
        const metrics = await appliedCount()
        const fetchedAt = new Date().toISOString()

        // 'read-only' skips domain writes for pure inspection; the read itself still happens and is still logged.
        if (mode !== 'read-only') {
          for (const [metric, count] of Object.entries(metrics)) {
            insertAppliedCount(db, 'linkedin', metric, count, fetchedAt)
          }
        }
        insertRunLog(db, {
          script,
          outcome: 'success',
          triggerType: 'manual',
          runMode: mode,
          duration: Date.now() - startedAt
        })
        return { outcome: 'success' as const, platform: 'linkedin' as const, metrics, fetchedAt }
      } catch (error) {
        insertRunLog(db, {
          script,
          outcome: 'failed',
          triggerType: 'manual',
          runMode: mode,
          duration: Date.now() - startedAt,
          errorDetail: error instanceof Error ? { message: error.message } : error
        })
        return { outcome: 'failed' as const, platform: 'linkedin' as const }
      }
    })
  )

  ipcMain.handle(IpcChannels.linkedinFetchRecentAppliedJobs, (_event, mode: RunMode = 'live') =>
    withLock('linkedin', async () => {
      ensurePlatformViewLoaded('linkedin')
      const db = getDb()
      const script = 'linkedin:fetchRecentAppliedJobs'
      const startedAt = Date.now()

      const loginStatus = await checkLogin()
      if (!loginStatus.loggedIn) {
        insertRunLog(db, {
          script,
          outcome: 'auth_required',
          triggerType: 'manual',
          runMode: mode,
          duration: Date.now() - startedAt
        })
        return { outcome: 'auth_required' as const, platform: 'linkedin' as const }
      }

      try {
        const jobs = await recentAppliedJobs()
        const capturedAt = new Date().toISOString()

        if (mode !== 'read-only') {
          for (const job of jobs) {
            upsertAppliedJob(db, 'linkedin', job, capturedAt)
          }
        }
        insertRunLog(db, {
          script,
          outcome: 'success',
          triggerType: 'manual',
          runMode: mode,
          duration: Date.now() - startedAt
        })
        return {
          outcome: 'success' as const,
          platform: 'linkedin' as const,
          jobsFound: jobs.length
        }
      } catch (error) {
        insertRunLog(db, {
          script,
          outcome: 'failed',
          triggerType: 'manual',
          runMode: mode,
          duration: Date.now() - startedAt,
          errorDetail: error instanceof Error ? { message: error.message } : error
        })
        return { outcome: 'failed' as const, platform: 'linkedin' as const }
      }
    })
  )

  ipcMain.handle(IpcChannels.linkedinCaptureJobDetails, (_event, jobUrl: string) =>
    withLock('linkedin', () => {
      ensurePlatformViewLoaded('linkedin')
      return captureJobDetails(jobUrl)
    })
  )

  ipcMain.handle(IpcChannels.linkedinScanJobs, (_event, params: ScanJobsArgs) =>
    withLock('linkedin', () => {
      ensurePlatformViewLoaded('linkedin')
      return scanJobs(params)
    })
  )

  ipcMain.handle(
    IpcChannels.linkedinApplyToJob,
    (_event, jobId: string, requestedDryRun: boolean, mode: RunMode = 'live') =>
      withLock('linkedin', async (): Promise<ApplyResult> => {
        ensurePlatformViewLoaded('linkedin')
        const db = getDb()
        const script = 'linkedin:applyToJob'
        const startedAt = Date.now()

        const loginStatus = await checkLogin()
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

        // Checked before ever opening the apply modal - a blacklisted company is never
        // attempted, never burns a shot. Costs one extra page read (captureJobDetails
        // against the job's plain view URL) since applyToJob itself has no reason to
        // know the company otherwise.
        const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`
        const details = await captureJobDetails(jobUrl)
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

        const dryRun = mode === 'live' ? requestedDryRun : true

        try {
          const result = await applyToLinkedinJob(jobId, dryRun)
          const attemptedAt = new Date().toISOString()

          if (mode !== 'read-only') {
            insertApplyAttempt(db, {
              platform: 'linkedin',
              externalJobId: jobId,
              outcome: result.outcome,
              reason: result.reason,
              header: result.header,
              dryRun,
              attemptedAt
            })
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
      })
  )
}
