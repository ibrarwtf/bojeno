import type { Adapter } from '../types'
import type { ApplyResult, DiscoveredJob, DiscoverParams } from '../../../shared/types'
import { applyToLeverJob } from './apply'

/**
 * Public, unauthenticated postings endpoint — no pagination, no auth, flat
 * fields. Ported from `afterq/tools/providers/lever.mjs`, which already
 * proved this shape against real boards. Only `api.lever.co` and its EU
 * mirror are ever hit — a slug can't redirect this to an arbitrary host.
 */
type LeverHost = 'api.lever.co' | 'api.eu.lever.co'

export function leverPostingsUrl(slug: string, host: LeverHost = 'api.lever.co'): string {
  return `https://${host}/v0/postings/${encodeURIComponent(slug)}`
}

interface LeverPosting {
  text?: string
  hostedUrl?: string
  categories?: { location?: string }
  descriptionPlain?: string
  createdAt?: number
}

export function mapLeverPosting(company: string, posting: LeverPosting): DiscoveredJob {
  return {
    source: 'lever',
    externalId: posting.hostedUrl ?? '',
    title: posting.text ?? '',
    company,
    location: posting.categories?.location ?? '',
    url: posting.hostedUrl ?? '',
    // Lever's postings list ships the full plain-text description for free
    // in the same payload — no per-job request needed.
    description: typeof posting.descriptionPlain === 'string' ? posting.descriptionPlain : '',
    postedAt:
      typeof posting.createdAt === 'number' ? new Date(posting.createdAt).toISOString() : null
  }
}

async function discover(params: DiscoverParams): Promise<DiscoveredJob[]> {
  const url = leverPostingsUrl(params.company)
  const response = await fetch(url, { redirect: 'error' })

  if (response.status === 404) {
    throw new Error(`lever: unknown company slug "${params.company}"`)
  }
  if (!response.ok) {
    throw new Error(`lever: fetch failed for "${params.company}" (HTTP ${response.status})`)
  }

  const json = (await response.json()) as unknown
  if (!Array.isArray(json)) return []

  return json.map((posting) => mapLeverPosting(params.company, posting as LeverPosting))
}

function applyToJob(jobId: string, dryRun = true): Promise<ApplyResult> {
  return applyToLeverJob(jobId, dryRun)
}

export const leverAdapter: Adapter = {
  id: 'lever',
  kind: 'api',
  capabilities: new Set(['discover', 'apply']),
  discover,
  applyToJob
}
