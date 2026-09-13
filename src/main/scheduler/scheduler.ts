import { isDue, type PriorityScheduleConfig } from './priorityWindow'

/**
 * Wires the priority-window logic (priorityWindow.ts) to a real trigger. This
 * is deliberately generic over how "now"/"last run"/"busy" are read and how
 * a run is actually kicked off - real wiring (runScheduler.ts) supplies
 * those against the live DB and the same run-pipeline function the manual
 * "run now" button calls; tests supply fakes so none of this depends on
 * real wall-clock time or a real LinkedIn run.
 */
export interface SchedulerDeps {
  /** Current time - injected so a tick's due-check is exactly reproducible in tests. */
  now: () => Date
  /** True while a run (manual or scheduled) is already in flight. This is the
   *  same guard the manual "run now" button is already subject to (see
   *  activeRuns in ipc/handlers/linkedin.ts) - a paused/already-running state
   *  blocks a scheduled tick exactly the way it blocks a second manual run:
   *  the tick is simply skipped, not queued or retried early. */
  isBusy: () => boolean
  /** When the scheduler last actually triggered a run, or null if never. */
  getLastTriggeredAt: () => Date | null
  /** Records that a trigger is starting, before it's awaited - so a slow
   *  run in progress doesn't make the next tick think none was ever fired. */
  setLastTriggeredAt: (at: Date) => void
  /** Calls the exact same run-pipeline function manual "run now" uses. Any
   *  error is swallowed by tick() - the run pipeline logs its own outcomes
   *  (run_logs), and a scheduler tick has no user waiting on its result. */
  trigger: () => Promise<void>
  config?: PriorityScheduleConfig
}

export interface Scheduler {
  /** Runs a single check: triggers a run if due and not busy. The setInterval
   *  loop in start() is a thin, deliberately untested wrapper around this -
   *  tests call tick() directly against fake deps instead. */
  tick: () => Promise<void>
  start: () => void
  stop: () => void
}

const CHECK_INTERVAL_MS = 60_000

export function createScheduler(deps: SchedulerDeps): Scheduler {
  let timer: ReturnType<typeof setInterval> | undefined

  async function tick(): Promise<void> {
    if (deps.isBusy()) return
    const now = deps.now()
    if (!isDue(now, deps.getLastTriggeredAt(), deps.config)) return
    deps.setLastTriggeredAt(now)
    try {
      await deps.trigger()
    } catch {
      // Swallowed deliberately: the run pipeline already records its own
      // failure in run_logs, and a scheduled tick has no caller to surface
      // this to - see the docstring on `trigger` above.
    }
  }

  function start(): void {
    if (timer) return
    // Checked roughly every minute - cheap, and fine enough that the
    // peak/off-peak boundary is never missed by more than a minute.
    timer = setInterval(() => void tick(), CHECK_INTERVAL_MS)
  }

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  return { tick, start, stop }
}
