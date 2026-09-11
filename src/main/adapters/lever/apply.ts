/**
 * Fills a Lever apply page via Playwright (domFill.ts) and hands off - it
 * never submits. Checkboxes, radio groups, the hCaptcha widget, and the
 * Submit button are always left for the user to finish.
 *
 * Deliberately never imports window.ts/electron directly - same pattern as
 * linkedin/naukri's adapters: the caller (ipc/handlers/ats.ts) is
 * responsible for showLeverTab()-ing the docked pane to the apply URL
 * before invoking this, exactly like linkedin.ts's handlers call
 * ensurePlatformViewLoaded() before their adapter/engine calls. Keeping
 * Electron out of this module's import graph is also what keeps it
 * testable under plain vitest (an 'electron' import here broke
 * adapter.test.ts's otherwise-pure module graph).
 *
 * Owns its complete orchestration (blacklist check, run_logs,
 * apply_attempts, action_budget) rather than routing through
 * engine/applyToJob.ts - that helper is shaped for LinkedIn/Naukri's
 * session+login+DOM-modal-that-actually-submits flow, which this isn't.
 * See the per-platform-independence memory: only the DB, the log/status
 * UI, and the global answer bank (config/answerBank.ts) are shared.
 */
import { getDb } from '../../db'
import { getMode } from '../../modes'
import { insertApplyAttempt } from '../../db/queries/applyAttempts'
import { insertRunLog } from '../../db/queries/runLogs'
import { isCompanyBlacklisted } from '../../db/queries/companyBlacklist'
import { incrementActionBudget } from '../../db/queries/actionBudget'
import { findPageByUrlPart } from '../../cdp'
import type { ApplyResult } from '../../../shared/types'
import { loadAnswerBank } from '../../config/answerBank'
import { fillLeverForm } from './domFill'

export function applyUrlFor(jobUrl: string): string {
  return `${jobUrl.replace(/\/+$/, '')}/apply`
}

async function attemptApply(jobUrl: string): Promise<ApplyResult> {
  const answers = loadAnswerBank()
  if (!answers.full_name || !answers.email) {
    return {
      outcome: 'needs_review',
      reason: 'answer bank is missing full_name/email - fill in .local/easy-apply-answers.json'
    }
  }

  const applyUrl = applyUrlFor(jobUrl)
  const page = await findPageByUrlPart(applyUrl)
  await page.waitForSelector('input[name="name"]', { timeout: 15000 }).catch(() => {})

  const header =
    (
      await page
        .locator('h2')
        .first()
        .textContent()
        .catch(() => null)
    )?.trim() ?? undefined
  const report = await fillLeverForm(page, answers)

  const reason = report.skipped.length
    ? `filled ${report.filled.length} field(s); left for you to finish: ${report.skipped.map((s) => s.label).join(', ')}, plus checkboxes/captcha/submit`
    : `filled ${report.filled.length} field(s) - review and submit yourself`

  return { outcome: 'needs_review', header, reason }
}

/**
 * Same blacklist / run_logs / apply_attempts convention as
 * engine/applyToJob.ts, just owned here instead of shared with it - no
 * login gate (Lever has no session), and the company name is passed in by
 * the caller (from discovery) rather than looked up via a DOM read.
 */
export async function applyToLeverJob(
  jobUrl: string,
  _requestedDryRun: boolean,
  company?: string
): Promise<ApplyResult> {
  const db = getDb()
  const mode = getMode()
  const script = 'lever:applyToJob'
  const startedAt = Date.now()

  if (company && isCompanyBlacklisted(db, company)) {
    const reason = `blacklisted company: ${company}`
    insertRunLog(db, {
      script,
      outcome: 'skipped',
      triggerType: 'manual',
      runMode: mode,
      duration: Date.now() - startedAt,
      entityType: 'job',
      entityId: jobUrl
    })
    return { outcome: 'skipped', reason }
  }

  try {
    const result = await attemptApply(jobUrl)
    const attemptedAt = new Date().toISOString()

    if (mode !== 'read-only') {
      insertApplyAttempt(db, {
        platform: 'lever',
        externalJobId: jobUrl,
        outcome: result.outcome,
        reason: result.reason,
        header: result.header,
        dryRun: true, // this flow never submits - every attempt is effectively a dry run
        attemptedAt
      })
      incrementActionBudget(db, 'lever', 'apply')
    }
    insertRunLog(db, {
      script,
      outcome: result.outcome === 'error' ? 'failed' : 'success',
      triggerType: 'manual',
      runMode: mode,
      duration: Date.now() - startedAt,
      entityType: 'job',
      entityId: jobUrl
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
      entityId: jobUrl,
      errorDetail: error instanceof Error ? { message: error.message } : error
    })
    throw error
  }
}
