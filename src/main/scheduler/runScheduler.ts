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

// Temporarily back to 'dry-run' while a manual, page-capped, one-search-
// at-a-time campaign (per the owner's explicit request) is driven directly
// via runSavedSearchNow/devcheck instead - the passive every-60s ticker
// here has no page cap and no supervision, and it self-fired an unbounded
// live run mid-campaign the first time this was set to 'live', racing the
// controlled runs. Flip to 'live' once the campaign is done and a query
// config is settled on, so ongoing scheduled runs submit for real too.
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
        easyApplyOnly: search.easyApplyOnly,
        datePosted: search.datePosted ?? undefined,
        workplaceTypes: search.workplaceTypes ?? undefined
      },
      // effectiveDryRun in runSavedSearchNow is `mode === 'live' ? dryRun : true` -
      // this flag has to flip alongside SCHEDULED_RUN_MODE, or 'live' mode
      // silently stays a no-op dry run. `false` here means "submit for real
      // when mode is 'live'"; when mode is 'dry-run' this is ignored anyway.
      dryRun: false,
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
