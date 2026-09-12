import { describe, it, expect, vi } from 'vitest'
import { createScheduler, type SchedulerDeps } from './scheduler'
import { DEFAULT_SCHEDULE_CONFIG } from './priorityWindow'

function baseDeps(overrides: Partial<SchedulerDeps> = {}): SchedulerDeps {
  const deps: SchedulerDeps = {
    now: () => new Date(2026, 8, 12, 10, 0, 0, 0), // 10am - inside the 9-11 peak window
    isBusy: () => false,
    getLastTriggeredAt: () => null,
    setLastTriggeredAt: vi.fn<(at: Date) => void>(),
    trigger: vi.fn<() => Promise<void>>(async () => undefined),
    config: DEFAULT_SCHEDULE_CONFIG,
    ...overrides
  }
  return deps
}

describe('createScheduler tick', () => {
  it('triggers a run when due and not busy', async () => {
    const deps = baseDeps()
    const scheduler = createScheduler(deps)

    await scheduler.tick()

    expect(deps.trigger).toHaveBeenCalledTimes(1)
  })

  it('calls the same trigger function every time - no separate scheduled run path', async () => {
    const deps = baseDeps()
    const scheduler = createScheduler(deps)

    await scheduler.tick()
    await scheduler.tick() // getLastTriggeredAt is still the fake's fixed null, so still "due"

    expect(deps.trigger).toHaveBeenCalledTimes(2)
  })

  it('does not trigger when a run is already in progress (busy)', async () => {
    const deps = baseDeps({ isBusy: () => true })
    const scheduler = createScheduler(deps)

    await scheduler.tick()

    expect(deps.trigger).not.toHaveBeenCalled()
    expect(deps.setLastTriggeredAt).not.toHaveBeenCalled()
  })

  it('does not trigger when not yet due', async () => {
    const lastRun = new Date(2026, 8, 12, 9, 30, 0, 0) // 30 min ago, peak interval is 60
    const deps = baseDeps({ getLastTriggeredAt: () => lastRun })
    const scheduler = createScheduler(deps)

    await scheduler.tick()

    expect(deps.trigger).not.toHaveBeenCalled()
  })

  it('triggers once the interval in effect has elapsed', async () => {
    const lastRun = new Date(2026, 8, 12, 8, 0, 0, 0) // 2h ago, well past the 60min peak interval
    const deps = baseDeps({ getLastTriggeredAt: () => lastRun })
    const scheduler = createScheduler(deps)

    await scheduler.tick()

    expect(deps.trigger).toHaveBeenCalledTimes(1)
  })

  it('records the trigger timestamp before awaiting the run', async () => {
    const deps = baseDeps()
    const scheduler = createScheduler(deps)

    await scheduler.tick()

    expect(deps.setLastTriggeredAt).toHaveBeenCalledWith(deps.now())
  })

  it('swallows a trigger error rather than throwing out of tick()', async () => {
    const deps = baseDeps({
      trigger: vi.fn(async () => {
        throw new Error('boom')
      })
    })
    const scheduler = createScheduler(deps)

    await expect(scheduler.tick()).resolves.toBeUndefined()
  })
})
