import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import type {
  ScanJobsArgs,
  CreateSavedSearchArgs,
  RunSequentialSearchArgs
} from '../../../shared/ipc-contract'
import type { ApplyResult, JobDetails, RunMode } from '../../../shared/types'
import { withLock } from '../../lock'
import { ensurePlatformViewLoaded } from '../../window'
import { getDb } from '../../db'
import { insertRunLog } from '../../db/queries/runLogs'
import { insertAppliedCount } from '../../db/queries/appliedCounts'
import { upsertAppliedJob } from '../../db/queries/appliedJobs'
import { insertApplyAttempt } from '../../db/queries/applyAttempts'
import { isCompanyBlacklisted } from '../../db/queries/companyBlacklist'
import { insertJobSnapshot } from '../../db/queries/jobSnapshots'
import { insertUnmatchedQuestion } from '../../db/queries/unmatchedQuestions'
import {
  listSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  touchSavedSearchLastRun
} from '../../db/queries/linkedinSavedSearches'
import {
  checkLogin,
  appliedCount,
  recentAppliedJobs,
  captureJobDetails,
  scanJobs,
  applyToJob as applyToLinkedinJob
} from '../../adapters/linkedin/adapter'
import { runSequentialSearch, jobUrlFor } from '../../adapters/linkedin/sequentialRun'
import { evaluateApplicantPreference } from '../../adapters/linkedin/preferencesGate'
import { buildTitleFilter } from '../../adapters/linkedin/titleFilter'
import { loadPreferences, type JobFilterPreferences } from '../../config/preferences'
import type { DatabaseSync } from 'node:sqlite'

/**
 * The parsed-JD signal worth keeping alongside a log row - lets a run be
 * audited later (e.g. "how many applications went to 1000+ applicant
 * postings") without re-scraping LinkedIn. Not every field is present on
 * every posting, so nulls here are informative, not missing data.
 */
function parsedSignalDetail(details: JobDetails): Record<string, unknown> {
  return {
    applicantCount: details.applicantCount,
    applicantInsightCounts: details.applicantInsightCounts,
    hasFitSignal: details.hasFitSignal,
    yearsRequired: details.yearsRequired,
    descriptionLength: details.descriptionText.length
  }
}

/**
 * Every reason a job gets skipped before ever opening the apply modal - the
 * company blacklist plus the user's own applicant-volume preferences.
 * Neither threshold is hardcoded here: preferences come from preferences.ts
 * (loaded once per run, see loadPreferences), which reads .local/preferences.json.
 */
function decideSkip(
  db: DatabaseSync,
  details: JobDetails,
  preferences: JobFilterPreferences
): string | undefined {
  if (isCompanyBlacklisted(db, details.company)) return `blacklisted company: ${details.company}`
  return evaluateApplicantPreference(details, preferences)
}

/** Records a question the answer bank couldn't match, for later review - not every 'needs_review' has one. */
function recordUnmatchedQuestionIfAny(
  db: DatabaseSync,
  jobId: string,
  details: Pick<JobDetails, 'title' | 'company'>,
  result: ApplyResult,
  runId?: string
): void {
  if (!result.unmatchedQuestion) return
  insertUnmatchedQuestion(db, {
    platform: 'linkedin',
    externalJobId: jobId,
    jobUrl: jobUrlFor(jobId),
    jobTitle: details.title,
    company: details.company,
    questionKind: result.unmatchedQuestion.kind,
    questionLabel: result.unmatchedQuestion.label,
    runId
  })
}

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
          detail: error instanceof Error ? { message: error.message } : error
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
          detail: error instanceof Error ? { message: error.message } : error
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

        // Checked before ever opening the apply modal - a blacklisted company or a
        // posting outside the user's own applicant-volume preferences is never
        // attempted, never burns a shot. Costs one extra page read (captureJobDetails
        // against the job's plain view URL) since applyToJob itself has no reason to
        // know the company otherwise.
        const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`
        const details = await captureJobDetails(jobUrl)
        insertJobSnapshot(db, { platform: 'linkedin', externalJobId: jobId }, details)

        const preferences = loadPreferences()
        const skipReason = decideSkip(db, details, preferences)
        if (skipReason) {
          const reason = skipReason
          insertRunLog(db, {
            script,
            outcome: 'skipped',
            triggerType: 'manual',
            runMode: mode,
            duration: Date.now() - startedAt,
            entityType: 'job',
            entityId: jobId,
            jobTitle: details.title,
            company: details.company,
            detail: { reason, ...parsedSignalDetail(details) }
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
          recordUnmatchedQuestionIfAny(db, jobId, details, result)
          insertRunLog(db, {
            script,
            outcome: result.outcome === 'error' ? 'failed' : 'success',
            triggerType: 'manual',
            runMode: mode,
            duration: Date.now() - startedAt,
            entityType: 'job',
            entityId: jobId,
            jobTitle: details.title,
            company: details.company,
            detail: {
              resultOutcome: result.outcome,
              resultReason: result.reason,
              dryRun,
              ...parsedSignalDetail(details)
            }
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
            jobTitle: details.title,
            company: details.company,
            detail: {
              message: error instanceof Error ? error.message : error,
              ...parsedSignalDetail(details)
            }
          })
          throw error
        }
      })
  )

  ipcMain.handle(
    IpcChannels.linkedinRunSequentialSearch,
    (_event, { params, dryRun }: RunSequentialSearchArgs, mode: RunMode = 'live') =>
      withLock('linkedin', async () => {
        ensurePlatformViewLoaded('linkedin')
        const db = getDb()
        const script = 'linkedin:runSequentialSearch'
        const startedAt = Date.now()
        // One id per whole search run, so every row it produces - the
        // discovery summary and each per-job row - can be grouped back
        // together later instead of only being orderable by timestamp.
        const runId = randomUUID()

        const loginStatus = await checkLogin()
        if (!loginStatus.loggedIn) {
          insertRunLog(db, {
            runId,
            script,
            outcome: 'auth_required',
            triggerType: 'manual',
            runMode: mode,
            duration: Date.now() - startedAt,
            detail: { params }
          })
          return { total: 0, applied: 0, dryRunApplied: 0, needsReview: 0, skipped: 0, failed: 0 }
        }

        const effectiveDryRun = mode === 'live' ? dryRun : true
        const preferences = loadPreferences()
        const titleFilter = buildTitleFilter(preferences.titleFilter)

        const summary = await runSequentialSearch(params, effectiveDryRun, {
          // Cheap card-level check, before selectJobCard/JD capture ever
          // happens - see titleFilter.ts. Skips a card whose title doesn't
          // pass the user's own positive/negative keyword config.
          filterCard: (card) =>
            titleFilter(card.title) ? undefined : `title filter rejected: "${card.title}"`,
          // Same gate applyToJob's own handler uses - checked here too since this
          // walk decides per-job whether to apply at all, applyToJob never sees a
          // blacklisted or over-preference job. Also where the JD capture gets
          // persisted - decide() is called exactly once per job, right after capture.
          decide: (step, details) => {
            insertJobSnapshot(
              db,
              { platform: 'linkedin', externalJobId: step.card.id, location: step.card.location },
              details
            )
            return decideSkip(db, details, preferences)
          },
          onSkipped: (step, reason, details) =>
            insertRunLog(db, {
              runId,
              script: `${script}:job`,
              outcome: 'skipped',
              triggerType: 'manual',
              runMode: mode,
              entityType: 'job',
              entityId: step.card.id,
              jobTitle: details?.title ?? step.card.title,
              company: details?.company ?? step.card.company,
              location: step.card.location,
              detail: { reason, ...(details ? parsedSignalDetail(details) : {}) }
            }),
          onApplyResult: (step, result, details) => {
            const attemptedAt = new Date().toISOString()
            if (mode !== 'read-only') {
              insertApplyAttempt(db, {
                platform: 'linkedin',
                externalJobId: step.card.id,
                outcome: result.outcome,
                reason: result.reason,
                header: result.header,
                dryRun: effectiveDryRun,
                attemptedAt
              })
            }
            recordUnmatchedQuestionIfAny(db, step.card.id, details, result, runId)
            insertRunLog(db, {
              runId,
              script: `${script}:job`,
              outcome: result.outcome === 'error' ? 'failed' : 'success',
              triggerType: 'manual',
              runMode: mode,
              entityType: 'job',
              entityId: step.card.id,
              jobTitle: details.title,
              company: details.company,
              location: step.card.location,
              detail: {
                resultOutcome: result.outcome,
                resultReason: result.reason,
                dryRun: effectiveDryRun,
                ...parsedSignalDetail(details)
              }
            })
          },
          onError: (step, error, details) =>
            insertRunLog(db, {
              runId,
              script: `${script}:job`,
              outcome: 'failed',
              triggerType: 'manual',
              runMode: mode,
              entityType: 'job',
              entityId: step.card.id,
              jobTitle: details?.title ?? step.card.title,
              company: details?.company ?? step.card.company,
              location: step.card.location,
              detail: {
                message: error instanceof Error ? error.message : error,
                ...(details ? parsedSignalDetail(details) : {})
              }
            })
        })

        insertRunLog(db, {
          runId,
          script,
          outcome: 'success',
          triggerType: 'manual',
          runMode: mode,
          duration: Date.now() - startedAt,
          detail: { params, dryRun: effectiveDryRun, summary }
        })
        return summary
      })
  )

  ipcMain.handle(IpcChannels.linkedinSavedSearchesList, () => listSavedSearches(getDb()))
  ipcMain.handle(IpcChannels.linkedinSavedSearchesCreate, (_event, args: CreateSavedSearchArgs) =>
    createSavedSearch(getDb(), args)
  )
  ipcMain.handle(IpcChannels.linkedinSavedSearchesDelete, (_event, id: number) =>
    deleteSavedSearch(getDb(), id)
  )
  ipcMain.handle(IpcChannels.linkedinSavedSearchesTouchRun, (_event, id: number) =>
    touchSavedSearchLastRun(getDb(), id)
  )
}
