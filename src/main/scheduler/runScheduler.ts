/**
 * Wires the priority-window scheduler (scheduler.ts) to the real app: the
 * live LinkedIn saved searches, the same run-pipeline function the manual
 * "run now" button calls, and the same in-flight guard the manual Stop/Run
 * (▶/■) control already enforces. See #84 / bojeno-project-brief.md §4-5.
 */
import { randomUUID } from 'node:crypto'
import { getDb } from '../db'
import { listSavedSearches, touchSavedSearchLastRun } from '../db/queries/linkedinSavedSearches'
import { runSavedSearchNow, isLinkedinRunActive } from '../ipc/handlers/linkedin'
import { createScheduler, type Scheduler } from './scheduler'
import type { LinkedinSavedSearch } from '../../shared/types'

// Deliberately conservative: a scheduled tick runs in dry-run mode (real
// navigation and apply-flow, no real submission - see the `mode` handling
// in runSavedSearchNow/linkedin.ts) until the owner has watched a few
// scheduled ticks fire correctly and decides to flip this. Flipping it to
// 'live' is the one-line change that makes scheduled runs apply for real;
// nothing else about the wiring changes.
const SCHEDULED_RUN_MODE = 'dry-run' as const

/** Picks the saved search that has gone longest without a run - the closest
 *  thing to fair rotation across multiple saved searches without building a
 *  real per-search schedule (out of scope for #84; today there's only ever
 *  one saved search anyway, per SavedSearches.tsx). Never-run searches
 *  (lastRunAt === null) are treated as most overdue. */
function pickDueSearch(searches: LinkedinSavedSearch[]): LinkedinSavedSearch | undefined {
  return searches.reduce<LinkedinSavedSearch | undefined>((oldest, search) => {
    if (!oldest) return search
    if (!search.lastRunAt) return search
    if (!oldest.lastRunAt) return oldest
    return search.lastRunAt < oldest.lastRunAt ? search : oldest
  }, undefined)
}

async function triggerScheduledRun(): Promise<void> {
  const db = getDb()
  const search = pickDueSearch(listSavedSearches(db))
  if (!search) return // Nothing saved to run yet - nothing to schedule.

  await runSavedSearchNow(
    {
      runId: randomUUID(),
      params: {
        keywords: search.keywords ?? undefined,
        location: search.location ?? undefined,
        geoId: search.geoId ?? undefined,
        distanceKm: search.distanceKm ?? undefined,
        sortByRecent: search.sortByRecent,
        easyApplyOnly: search.easyApplyOnly
      },
      dryRun: true,
      savedSearchName: search.name
    },
    SCHEDULED_RUN_MODE,
    'scheduled'
  )
  touchSavedSearchLastRun(db, search.id)
}

let lastTriggeredAt: Date | null = null

/** Starts the priority-window scheduler against the real app. Call once,
 *  after the main window (and its LinkedIn WebContentsView) exists. */
export function startScheduler(): Scheduler {
  const scheduler = createScheduler({
    now: () => new Date(),
    // Same guard the manual "run now"/Stop (▶/■) control already enforces
    // (see isLinkedinRunActive's docstring in ipc/handlers/linkedin.ts) - a
    // run in progress, whether started manually or by a previous tick,
    // blocks a scheduled tick exactly the way it blocks a second manual run.
    isBusy: isLinkedinRunActive,
    getLastTriggeredAt: () => lastTriggeredAt,
    setLastTriggeredAt: (at) => {
      lastTriggeredAt = at
    },
    trigger: triggerScheduledRun
  })
  scheduler.start()
  return scheduler
}
