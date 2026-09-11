import { getDb } from '../db'
import { getMode } from '../modes'
import { getAdapter } from '../adapters/registry'
import { insertRunLog } from '../db/queries/runLogs'
import type { DiscoveredJob, DiscoverResult } from '../../shared/types'

/**
 * Loops one adapter.discover() call per company — same single-unit-per-call
 * shape as checkLogin/appliedCount — so one bad slug can't sink the whole
 * batch; it's collected into `errors` instead of throwing.
 */
export async function discoverJobs(source: string, companies: string[]): Promise<DiscoverResult> {
  const db = getDb()
  const mode = getMode()
  const adapter = getAdapter(source)
  const script = `${source}:discover`
  const startedAt = Date.now()

  if (!adapter.discover) {
    throw new Error(`${source} adapter has no discover capability`)
  }

  const jobs: DiscoveredJob[] = []
  const errors: { company: string; message: string }[] = []

  for (const company of companies) {
    try {
      jobs.push(...(await adapter.discover({ company })))
    } catch (error) {
      errors.push({
        company,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const outcome = errors.length === 0 ? 'success' : jobs.length === 0 ? 'failed' : 'success'

  insertRunLog(db, {
    script,
    outcome,
    triggerType: 'manual',
    runMode: mode,
    duration: Date.now() - startedAt,
    entityType: 'company',
    entityId: companies.join(','),
    errorDetail: errors.length ? errors : undefined
  })

  return { outcome, source, jobs, errors }
}
