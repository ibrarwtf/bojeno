import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import type {
  ScanJobsArgs,
  CreateSavedSearchArgs,
  RunSequentialSearchArgs
} from '../../../shared/ipc-contract'
import type { ApplyResult, JobDetails, RunMode, SequentialRunSummary } from '../../../shared/types'
import { withLock } from '../../lock'
import { ensurePlatformViewLoaded } from '../../window'
import { findPageByUrlPart, gotoWithRetry } from '../../cdp'
import { getDb } from '../../db'
import { insertRunLog, findLatestJobLog } from '../../db/queries/runLogs'
import { insertAppliedCount } from '../../db/queries/appliedCounts'
import { upsertAppliedJob } from '../../db/queries/appliedJobs'
import { insertApplyAttempt } from '../../db/queries/applyAttempts'
import { isCompanyBlacklisted, blacklistReason } from '../../db/queries/companyBlacklist'
import { insertJobSnapshot } from '../../db/queries/jobSnapshots'
import { insertUnmatchedQuestionAndNotify } from '../../notifications/unmatchedQuestionNotifier'
import { upsertCompany, getCompanyByName } from '../../db/queries/companies'
import { fetchCompanyAboutInfo, searchCompanyByName } from '../../adapters/linkedin/company'
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
import { cachedLoginStatus, setCachedLoginStatus } from '../../adapters/linkedin/loginStatusCache'
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
  if (isCompanyBlacklisted(db, details.company)) {
    const reason = blacklistReason(db, details.company)
    return `blacklisted company: ${details.company}${reason ? ` (${reason})` : ''}`
  }
  return evaluateApplicantPreference(details, preferences)
}

/**
 * Runs currently in flight, keyed by the caller-supplied runId - lets the
 * Stop button (linkedin:cancelRun) reach a run that's still executing,
 * since the run's own IPC call doesn't resolve until it finishes. A run
 * removes its own entry when it's done, cancelled or not.
 */
const activeRuns = new Map<string, { cancelled: boolean }>()

/** True while a LinkedIn search run - manual or scheduled - is in flight.
 *  The scheduler (scheduler/runScheduler.ts) uses this as the same busy
 *  guard the manual "run now" button is already subject to, so a run in
 *  progress blocks a scheduled tick exactly the way it blocks a second
 *  manual run. */
export function isLinkedinRunActive(): boolean {
  return activeRuns.size > 0
}

/** Cached login check, reused by every script that just needs to know
 *  whether it's safe to proceed - only the explicit "Check" button
 *  (linkedinCheckLogin below) forces a real fresh navigation. */
async function ensureLoggedIn(): ReturnType<typeof checkLogin> {
  const cached = cachedLoginStatus()
  if (cached) return cached
  const status = await checkLogin()
  setCachedLoginStatus(status)
  return status
}

/** Records every question the answer bank couldn't match, for later review - not every 'needs_review' has any. */
function recordUnmatchedQuestionIfAny(
  db: DatabaseSync,
  jobId: string,
  details: Pick<JobDetails, 'title' | 'company'>,
  result: ApplyResult,
  runId?: string
): void {
  for (const question of result.unmatchedQuestions ?? []) {
    insertUnmatchedQuestionAndNotify(db, {
      platform: 'linkedin',
      externalJobId: jobId,
      jobUrl: jobUrlFor(jobId),
      jobTitle: details.title,
      company: details.company,
      questionKind: question.kind,
      questionLabel: question.label,
      runId
    })
  }
}

/**
 * Fires only for a real 'applied' outcome - never dry_run_ok, needs_review,
 * skipped, or error - since a company's /about page is only worth capturing
 * once an application actually went out. This is a real page navigation, so
 * it MUST run using the caller's already-locked page/context rather than
 * taking its own withLock('linkedin', ...) - both call sites below already
 * run inside that lock (linkedinApplyToJob's whole handler body, and
 * runSequentialSearch's hooks object, itself inside the same lock), and
 * withLock (src/main/lock.ts) isn't reentrant: a nested call on the same id
 * would queue behind the still-running outer call and deadlock, since the
 * outer call can't finish until this nested call does.
 *
 * `restoreUrl`, when given, navigates back to it afterward - needed for the
 * sequential-run path, which stays on the search-results page between jobs
 * and would otherwise strand the next selectJobCard() on the company's
 * /about page instead. The single-job apply path passes no restoreUrl since
 * nothing else in that handler depends on the page's URL afterward.
 * Best-effort throughout: a failure here must never fail the apply itself,
 * which has already succeeded by the time this runs.
 */
async function captureCompanyInfoIfApplied(
  db: DatabaseSync,
  mode: RunMode,
  result: ApplyResult,
  details: JobDetails,
  restoreUrl?: string,
  triggerType: 'manual' | 'auto' | 'scheduled' = 'manual'
): Promise<void> {
  if (result.outcome !== 'applied' || !details.companyUrl || mode === 'read-only') return

  try {
    const page = await findPageByUrlPart('linkedin.com')
    const info = await fetchCompanyAboutInfo(page, details.companyUrl, details.company)
    upsertCompany(db, info)
    if (restoreUrl) {
      await gotoWithRetry(page, restoreUrl, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    }
  } catch (error) {
    insertRunLog(db, {
      script: 'linkedin:captureCompanyInfo',
      outcome: 'failed',
      triggerType,
      runMode: mode,
      entityType: 'job',
      entityId: details.jobUrl,
      jobTitle: details.title,
      company: details.company,
      detail: { message: error instanceof Error ? error.message : error }
    })
  }
}

/**
 * Resolves a company name to its LinkedIn numeric id, checking the
 * `companies` table (populated by real applies and the GCC research import
 * - see scripts/import-gcc-companies.cjs) before ever hitting the network.
 * Only live-searches LinkedIn (searchCompanyByName) on a cache miss, and
 * persists what it finds so the next call for the same name is free.
 */
async function resolveCompanyId(db: DatabaseSync, name: string): Promise<string | null> {
  const cached = getCompanyByName(db, name)
  if (cached?.linkedinCompanyId) return cached.linkedinCompanyId

  const page = await findPageByUrlPart('linkedin.com')
  const found = await searchCompanyByName(page, name)
  if (!found) return null

  upsertCompany(db, {
    linkedinCompanyId: found.linkedinCompanyId,
    name: found.name,
    url: found.url,
    website: null,
    industry: null,
    companySize: null,
    founded: null,
    specialties: null,
    overview: null,
    hqCountry: null,
    indiaCities: null,
    careersUrl: null,
    ats: null,
    status: null,
    skipReason: null,
    remark: null
  })
  return found.linkedinCompanyId
}

/**
 * The one run pipeline behind both the manual "run now" (▶) button in
 * SavedSearches.tsx and the priority-window scheduler (scheduler/runScheduler.ts)
 * - see #84. `triggerType` only changes what gets recorded in run_logs
 * (`manual` vs `scheduled`); the guard against a second concurrent run,
 * the login check, the title/blacklist/preference filtering and every DB
 * write are identical either way, so a scheduled trigger is blocked by an
 * in-flight run exactly the way a second manual run already is.
 */
export function runSavedSearchNow(
  { runId, params, dryRun, savedSearchName, maxPages, maxApplications }: RunSequentialSearchArgs,
  mode: RunMode = 'live',
  triggerType: 'manual' | 'scheduled' = 'manual'
): Promise<SequentialRunSummary> {
  // Rejected synchronously, before this call ever reaches withLock's
  // navigation queue - withLock only serializes navigation, so without
  // this check a second run would silently queue behind the first and
  // start on its own once the first's whole body resolved, instead of
  // being refused. activeRuns is only ever populated by this function,
  // so any entry present means a LinkedIn run is already in flight -
  // "per platform" and "any" coincide today because there's only one
  // saved search; real queueing across multiple saved searches is
  // explicitly out of scope until a second one exists (see
  // SavedSearches.tsx). The scheduler relies on this same guard (via
  // isLinkedinRunActive) to skip a tick instead of racing a manual run.
  if (activeRuns.size > 0) {
    throw new Error('A LinkedIn search run is already in progress')
  }
  // Set eagerly (before withLock, not inside it) so this check-then-set
  // is synchronous from the caller's point of view - Electron dispatches
  // one IPC message at a time, so two rapid calls can't interleave here.
  // runId comes from the caller (not generated here) so it's known
  // before the run starts - the only way a Stop button can target a
  // run that's still executing.
  activeRuns.set(runId, { cancelled: false })

  return withLock('linkedin', async () => {
    try {
      ensurePlatformViewLoaded('linkedin')
      const db = getDb()
      const script = 'linkedin:runSequentialSearch'
      const startedAt = Date.now()

      const loginStatus = await ensureLoggedIn()
      if (!loginStatus.loggedIn) {
        insertRunLog(db, {
          runId,
          script,
          outcome: 'auth_required',
          triggerType,
          runMode: mode,
          duration: Date.now() - startedAt,
          detail: { params }
        })
        return {
          total: 0,
          applied: 0,
          dryRunApplied: 0,
          needsReview: 0,
          skipped: 0,
          failed: 0,
          cancelled: false,
          pagesScanned: 0,
          totalPages: null
        }
      }

      const effectiveDryRun = mode === 'live' ? dryRun : true
      const preferences = loadPreferences()
      const titleFilter = buildTitleFilter(preferences.titleFilter)
      // Counts real submissions only (applied + dry_run_ok) - skipped/needs_review/
      // error outcomes never draw down maxApplications, since they never actually
      // applied to anything. Cancelling via activeRuns (rather than a bespoke
      // early-return) reuses the exact same clean-stop path the Stop button already
      // takes - the in-flight job still finishes, remaining cards are left untouched.
      let applicationsSoFar = 0

      const summary = await runSequentialSearch(
        params,
        effectiveDryRun,
        {
          isCancelled: () => activeRuns.get(runId)?.cancelled ?? false,
          // Cheapest check first, before even the title filter: a job id this
          // sweep (or an earlier one) already logged a decision for gets
          // skipped outright instead of re-navigating to it and re-deciding -
          // the 9-search rotation deliberately has overlapping results (same
          // city, different keyword), and this is what makes reruns fast
          // instead of repeating identical work. See findLatestJobLog.
          filterCard: (card) => {
            const cached = findLatestJobLog(db, card.id)
            if (cached) {
              return `cached: already processed in run ${cached.runId ?? 'unknown'} on ${cached.timestamp} (outcome: ${cached.outcome})`
            }
            // Cheap card-level check, before selectJobCard/JD capture ever
            // happens - see titleFilter.ts. Skips a card whose title doesn't
            // pass the user's own positive/negative keyword config.
            return titleFilter(card.title) ? undefined : `title filter rejected: "${card.title}"`
          },
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
              triggerType,
              runMode: mode,
              entityType: 'job',
              entityId: step.card.id,
              jobTitle: details?.title ?? step.card.title,
              company: details?.company ?? step.card.company,
              location: step.card.location,
              detail: { reason, ...(details ? parsedSignalDetail(details) : {}) }
            }),
          onApplyResult: async (step, result, details) => {
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
            // Capture the current search-results URL before any navigation
            // - captureCompanyInfoIfApplied restores this afterward so the
            // next selectJobCard() isn't stranded on the company's /about page.
            const returnUrl = await findPageByUrlPart('linkedin.com')
              .then((page) => page.url())
              .catch(() => undefined)
            await captureCompanyInfoIfApplied(db, mode, result, details, returnUrl, triggerType)
            insertRunLog(db, {
              runId,
              script: `${script}:job`,
              outcome: result.outcome === 'error' ? 'failed' : 'success',
              triggerType,
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
            if (result.outcome === 'applied' || result.outcome === 'dry_run_ok') {
              applicationsSoFar++
              if (maxApplications !== undefined && applicationsSoFar >= maxApplications) {
                const run = activeRuns.get(runId)
                if (run) run.cancelled = true
              }
            }
          },
          onError: (step, error, details) =>
            insertRunLog(db, {
              runId,
              script: `${script}:job`,
              outcome: 'failed',
              triggerType,
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
        },
        maxPages
      )

      insertRunLog(db, {
        runId,
        script,
        outcome: 'success',
        triggerType,
        runMode: mode,
        duration: Date.now() - startedAt,
        detail: { params, dryRun: effectiveDryRun, summary, savedSearchName }
      })
      return summary
    } finally {
      // Guarantees cleanup on every exit path - including a thrown
      // error - not just the two explicit returns above. Without this,
      // an error partway through a run would leave activeRuns
      // permanently non-empty and lock out every future run.
      activeRuns.delete(runId)
    }
  })
}

export function registerLinkedinHandlers(): void {
  ipcMain.handle(IpcChannels.linkedinCheckLogin, () =>
    withLock('linkedin', async () => {
      ensurePlatformViewLoaded('linkedin')
      // The one path that always does a real, fresh navigation-based check -
      // every other script reuses its result via ensureLoggedIn() instead.
      const status = await checkLogin()
      setCachedLoginStatus(status)
      return status
    })
  )

  ipcMain.handle(IpcChannels.linkedinFetchAppliedCount, (_event, mode: RunMode = 'live') =>
    withLock('linkedin', async () => {
      ensurePlatformViewLoaded('linkedin')
      const db = getDb()
      const script = 'linkedin:fetchAppliedCount'
      const startedAt = Date.now()

      const loginStatus = await ensureLoggedIn()
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

      const loginStatus = await ensureLoggedIn()
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

  ipcMain.handle(IpcChannels.linkedinResolveCompanyId, (_event, name: string) =>
    withLock('linkedin', () => {
      ensurePlatformViewLoaded('linkedin')
      return resolveCompanyId(getDb(), name)
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

        const loginStatus = await ensureLoggedIn()
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
          await captureCompanyInfoIfApplied(db, mode, result, details)
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
    (_event, args: RunSequentialSearchArgs, mode: RunMode = 'live') =>
      runSavedSearchNow(args, mode, 'manual')
  )

  ipcMain.handle(IpcChannels.linkedinCancelRun, (_event, runId: string) => {
    const run = activeRuns.get(runId)
    if (run) run.cancelled = true
  })

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
