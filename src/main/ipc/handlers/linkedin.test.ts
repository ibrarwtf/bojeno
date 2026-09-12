import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IpcChannels } from '../../../shared/ipc-contract'
import type { RunSequentialSearchArgs } from '../../../shared/ipc-contract'
import type { SequentialRunSummary } from '../../../shared/types'

/**
 * registerLinkedinHandlers() pulls in a lot at module scope (electron,
 * sqlite, adapters that themselves drive a real WebContentsView). None of
 * that is relevant here - this test only exercises the concurrency gate
 * added to linkedinRunSequentialSearch, so everything else is stubbed to
 * the minimum that lets the module load and the handler run its logic.
 */
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))

vi.mock('../../window', () => ({
  ensurePlatformViewLoaded: vi.fn()
}))

vi.mock('../../db', () => ({
  getDb: vi.fn(() => ({}))
}))

vi.mock('../../db/queries/runLogs', () => ({
  insertRunLog: vi.fn()
}))
vi.mock('../../db/queries/appliedCounts', () => ({ insertAppliedCount: vi.fn() }))
vi.mock('../../db/queries/appliedJobs', () => ({ upsertAppliedJob: vi.fn() }))
vi.mock('../../db/queries/applyAttempts', () => ({ insertApplyAttempt: vi.fn() }))
vi.mock('../../db/queries/companyBlacklist', () => ({
  isCompanyBlacklisted: vi.fn(() => false),
  blacklistReason: vi.fn(() => undefined)
}))
vi.mock('../../db/queries/jobSnapshots', () => ({ insertJobSnapshot: vi.fn() }))
vi.mock('../../notifications/unmatchedQuestionNotifier', () => ({
  insertUnmatchedQuestionAndNotify: vi.fn()
}))
vi.mock('../../db/queries/linkedinSavedSearches', () => ({
  listSavedSearches: vi.fn(),
  createSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn(),
  touchSavedSearchLastRun: vi.fn()
}))

vi.mock('../../adapters/linkedin/adapter', () => ({
  checkLogin: vi.fn(),
  appliedCount: vi.fn(),
  recentAppliedJobs: vi.fn(),
  captureJobDetails: vi.fn(),
  scanJobs: vi.fn(),
  applyToJob: vi.fn()
}))

const runSequentialSearchMock = vi.fn()
vi.mock('../../adapters/linkedin/sequentialRun', () => ({
  runSequentialSearch: (...args: unknown[]): unknown => runSequentialSearchMock(...args),
  jobUrlFor: (id: string) => `https://www.linkedin.com/jobs/view/${id}/`
}))

vi.mock('../../adapters/linkedin/preferencesGate', () => ({
  evaluateApplicantPreference: vi.fn(() => undefined)
}))
vi.mock('../../adapters/linkedin/titleFilter', () => ({
  buildTitleFilter: vi.fn(() => () => true)
}))
vi.mock('../../config/preferences', () => ({
  loadPreferences: vi.fn(() => ({}))
}))

// Real module - no electron dependency - used to make ensureLoggedIn() see
// an already-logged-in session so the handler runs past the login check.
import { setCachedLoginStatus } from '../../adapters/linkedin/loginStatusCache'
import { insertRunLog } from '../../db/queries/runLogs'
import { registerLinkedinHandlers, runSavedSearchNow, isLinkedinRunActive } from './linkedin'

function summary(overrides: Partial<SequentialRunSummary> = {}): SequentialRunSummary {
  return {
    total: 0,
    applied: 0,
    dryRunApplied: 0,
    needsReview: 0,
    skipped: 0,
    failed: 0,
    cancelled: false,
    pagesScanned: 0,
    totalPages: null,
    ...overrides
  }
}

function runArgs(runId: string): RunSequentialSearchArgs {
  return { runId, params: {}, dryRun: true, savedSearchName: 'Test search' }
}

describe('linkedinRunSequentialSearch concurrency gate', () => {
  beforeEach(() => {
    handlers.clear()
    runSequentialSearchMock.mockReset()
    setCachedLoginStatus({
      platform: 'linkedin',
      loggedIn: true,
      checkedAt: new Date().toISOString()
    })
    // Safe to call repeatedly - it only (re-)populates the ipcMain.handle
    // mock's map; activeRuns and the navigation lock are module-level state
    // outside this function and are expected to be empty between tests
    // since every run below cleans up after itself.
    registerLinkedinHandlers()
  })

  function runHandler(runId: string): Promise<SequentialRunSummary> {
    const handler = handlers.get(IpcChannels.linkedinRunSequentialSearch)
    if (!handler) throw new Error('handler not registered')
    return handler({}, runArgs(runId), 'live') as Promise<SequentialRunSummary>
  }

  function cancelHandler(runId: string): void {
    const handler = handlers.get(IpcChannels.linkedinCancelRun)
    if (!handler) throw new Error('cancel handler not registered')
    handler({}, runId)
  }

  it('rejects a second run for the same platform while one is active', async () => {
    let resolveFirst!: (value: SequentialRunSummary) => void
    runSequentialSearchMock.mockReturnValueOnce(
      new Promise<SequentialRunSummary>((resolve) => {
        resolveFirst = resolve
      })
    )

    const first = runHandler('run-1')

    expect(() => runHandler('run-2')).toThrow(/already in progress/i)

    resolveFirst(summary({ total: 1, applied: 1 }))
    await expect(first).resolves.toEqual(summary({ total: 1, applied: 1 }))
  })

  it('allows a new run once the previous one finishes', async () => {
    runSequentialSearchMock.mockResolvedValueOnce(summary({ total: 1 }))
    await runHandler('run-1')

    runSequentialSearchMock.mockResolvedValueOnce(summary({ total: 2 }))
    await expect(runHandler('run-2')).resolves.toEqual(summary({ total: 2 }))
  })

  it('allows a new run once the previous one is cancelled and cleans up', async () => {
    let resolveFirst!: (value: SequentialRunSummary) => void
    runSequentialSearchMock.mockReturnValueOnce(
      new Promise<SequentialRunSummary>((resolve) => {
        resolveFirst = resolve
      })
    )

    const first = runHandler('run-1')
    cancelHandler('run-1')
    resolveFirst(summary({ cancelled: true }))
    await first

    runSequentialSearchMock.mockResolvedValueOnce(summary({ total: 3 }))
    await expect(runHandler('run-2')).resolves.toEqual(summary({ total: 3 }))
  })

  it('cleans up and allows a new run even if the previous one throws', async () => {
    runSequentialSearchMock.mockRejectedValueOnce(new Error('boom'))
    await expect(runHandler('run-1')).rejects.toThrow('boom')

    runSequentialSearchMock.mockResolvedValueOnce(summary({ total: 4 }))
    await expect(runHandler('run-2')).resolves.toEqual(summary({ total: 4 }))
  })
})

describe('runSavedSearchNow - the function both manual and scheduled triggers call', () => {
  beforeEach(() => {
    handlers.clear()
    runSequentialSearchMock.mockReset()
    vi.mocked(insertRunLog).mockClear()
    setCachedLoginStatus({
      platform: 'linkedin',
      loggedIn: true,
      checkedAt: new Date().toISOString()
    })
  })

  it('records triggerType "scheduled" in run_logs when called by the scheduler', async () => {
    runSequentialSearchMock.mockResolvedValueOnce(summary({ total: 1, applied: 1 }))

    await runSavedSearchNow(runArgs('sched-1'), 'live', 'scheduled')

    const summaryLogCall = vi
      .mocked(insertRunLog)
      .mock.calls.find(([, entry]) => entry.script === 'linkedin:runSequentialSearch')
    expect(summaryLogCall?.[1].triggerType).toBe('scheduled')
  })

  it('isLinkedinRunActive reflects a run in flight, then clears once it finishes', async () => {
    expect(isLinkedinRunActive()).toBe(false)

    let resolveRun!: (value: SequentialRunSummary) => void
    runSequentialSearchMock.mockReturnValueOnce(
      new Promise<SequentialRunSummary>((resolve) => {
        resolveRun = resolve
      })
    )

    const pending = runSavedSearchNow(runArgs('sched-2'), 'live', 'scheduled')
    expect(isLinkedinRunActive()).toBe(true)

    resolveRun(summary({ total: 1 }))
    await pending

    expect(isLinkedinRunActive()).toBe(false)
  })

  it('a scheduled call is rejected the same way a second manual call is, while one is active', async () => {
    let resolveRun!: (value: SequentialRunSummary) => void
    runSequentialSearchMock.mockReturnValueOnce(
      new Promise<SequentialRunSummary>((resolve) => {
        resolveRun = resolve
      })
    )

    const manual = runSavedSearchNow(runArgs('manual-1'), 'live', 'manual')
    expect(() => runSavedSearchNow(runArgs('sched-3'), 'live', 'scheduled')).toThrow(
      /already in progress/i
    )

    resolveRun(summary({ total: 1 }))
    await manual
  })
})
