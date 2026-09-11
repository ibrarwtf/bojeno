import { getDb } from '../db'
import { getMode } from '../modes'
import { getAdapter } from '../adapters/registry'
import { insertAppliedCount } from '../db/queries/appliedCounts'
import { insertRunLog } from '../db/queries/runLogs'
import type { FetchAppliedCountResult, Platform } from '../../shared/types'

/**
 * Shared by every "fetch applied count" action (LinkedIn, Naukri, ...) —
 * mode gate + login gate + run_logs, per the project's one-shared-helper
 * convention rather than each adapter action re-implementing this.
 */
export async function fetchAppliedCount(platform: Platform): Promise<FetchAppliedCountResult> {
  const db = getDb()
  const mode = getMode()
  const adapter = getAdapter(platform)
  const script = `${platform}:fetchAppliedCount`
  const startedAt = Date.now()

  if (!adapter.checkLogin || !adapter.appliedCount) {
    throw new Error(`${platform} adapter is missing checkLogin/appliedCount capability`)
  }

  const loginStatus = await adapter.checkLogin()
  if (!loginStatus.loggedIn) {
    insertRunLog(db, {
      script,
      outcome: 'auth_required',
      triggerType: 'manual',
      runMode: mode,
      duration: Date.now() - startedAt
    })
    return { outcome: 'auth_required', platform }
  }

  try {
    const metrics = await adapter.appliedCount()
    const fetchedAt = new Date().toISOString()

    // 'read-only' skips domain writes for pure inspection; the read itself
    // still happens and is still logged either way.
    if (mode !== 'read-only') {
      for (const [metric, count] of Object.entries(metrics)) {
        insertAppliedCount(db, platform, metric, count, fetchedAt)
      }
    }
    insertRunLog(db, {
      script,
      outcome: 'success',
      triggerType: 'manual',
      runMode: mode,
      duration: Date.now() - startedAt
    })

    return { outcome: 'success', platform, metrics, fetchedAt }
  } catch (error) {
    insertRunLog(db, {
      script,
      outcome: 'failed',
      triggerType: 'manual',
      runMode: mode,
      duration: Date.now() - startedAt,
      errorDetail: error instanceof Error ? { message: error.message } : error
    })
    return { outcome: 'failed', platform }
  }
}
