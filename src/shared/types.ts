export type Platform = 'linkedin' | 'naukri'

export type RunMode = 'read-only' | 'dry-run' | 'live'

export type RunOutcome =
  'success' | 'failed' | 'auth_required' | 'rate_limited' | 'awaiting_input' | 'skipped'

export interface LoginStatus {
  platform: Platform
  loggedIn: boolean
  checkedAt: string
}

export interface ActiveTabUrl {
  platform: Platform
  url: string
}

/** Metric key -> count. LinkedIn has one ('applied'); Naukri has two. */
export type ApplicationMetrics = Record<string, number>

export interface FetchAppliedCountResult {
  outcome: RunOutcome
  platform: Platform
  metrics?: ApplicationMetrics
  fetchedAt?: string
}

/** One point in the applied-count-over-time chart — always the 'applied' metric. */
export interface AppliedCountPoint {
  platform: Platform
  count: number
  fetchedAt: string
}

/** A single scraped job row, before platform/capturedAt are attached by the engine. */
export interface ScrapedJob {
  externalJobId: string
  title: string
  company: string
  location: string
  appliedAt: string
  appliedRelative: string
  jobUrl: string
}

export interface FetchRecentAppliedJobsResult {
  outcome: RunOutcome
  platform: Platform
  jobsFound?: number
}
