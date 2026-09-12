/**
 * Walks a search's job openings one at a time - navigate to results, discover
 * the ordered list of cards, then for each one in turn: select its card,
 * capture its JD from the in-place detail pane, decide apply-or-skip, apply
 * (or not) from that same pane, advance. This is the same path a real user
 * follows on the results page - select a card, read the pane, click its
 * Easy Apply button - never navigating to a separate URL per job (see
 * searchPaneApply.ts). Each step below is its own small function so a
 * caller (the IPC handler) can hook in DB-backed effects - blacklist
 * checks, run-log rows, apply-attempt rows - without this module knowing
 * anything about the database.
 */
import type {
  ApplyResult,
  JobDetails,
  ScannedJobCard,
  SearchUrlParams,
  SequentialRunSummary
} from '../../../shared/types'
import { scanJobs, jobUrlFor } from './adapter'
import { selectJobCard, captureActiveJobDetails, applyFromSearchResults } from './searchPaneApply'

export { jobUrlFor }

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
const paceBetweenJobs = (): Promise<void> => sleep(3000 + Math.floor(Math.random() * 3000))

export interface SequentialRunStep {
  card: ScannedJobCard
  index: number
  total: number
}

export interface SequentialRunHooks {
  /** Called once the ordered job list is known, before the first job is processed. */
  onDiscovered?: (cards: ScannedJobCard[]) => void
  /** Called after a job's JD is captured, before the apply/skip decision. Return a
   *  skip reason to skip the job (e.g. blacklisted company); return undefined to apply. */
  decide: (step: SequentialRunStep, details: JobDetails) => string | undefined
  /** `details` is only present once JD capture has happened - absent for the
   *  cheap already-applied/parse-warning skips that happen before it. */
  onSkipped?: (step: SequentialRunStep, reason: string, details?: JobDetails) => void
  onApplyResult?: (step: SequentialRunStep, result: ApplyResult, details: JobDetails) => void
  /** `details` is present unless capture itself is what threw. */
  onError?: (step: SequentialRunStep, error: unknown, details?: JobDetails) => void
}

/** Cards not worth capturing/deciding on at all - already applied, or too malformed to trust. */
function isEligible(card: ScannedJobCard): boolean {
  return !card.alreadyApplied && !card.parseWarning
}

export async function runSequentialSearch(
  params: SearchUrlParams,
  dryRun: boolean,
  hooks: SequentialRunHooks
): Promise<SequentialRunSummary> {
  const cards = await scanJobs(params)
  hooks.onDiscovered?.(cards)

  const summary: SequentialRunSummary = { total: cards.length, applied: 0, skipped: 0, failed: 0 }

  for (let index = 0; index < cards.length; index++) {
    const card = cards[index]
    const step: SequentialRunStep = { card, index, total: cards.length }

    if (!isEligible(card)) {
      summary.skipped++
      hooks.onSkipped?.(
        step,
        card.alreadyApplied ? 'already applied' : 'card did not parse cleanly'
      )
      continue
    }

    let details: JobDetails | undefined
    try {
      await selectJobCard(card.id)
      details = await captureActiveJobDetails(card.id)
      const skipReason = hooks.decide(step, details)
      if (skipReason) {
        summary.skipped++
        hooks.onSkipped?.(step, skipReason, details)
        continue
      }

      const result = await applyFromSearchResults(dryRun)
      summary.applied += result.outcome === 'error' ? 0 : 1
      summary.failed += result.outcome === 'error' ? 1 : 0
      hooks.onApplyResult?.(step, result, details)
    } catch (error) {
      summary.failed++
      hooks.onError?.(step, error, details)
    }

    if (index < cards.length - 1) await paceBetweenJobs()
  }

  return summary
}
