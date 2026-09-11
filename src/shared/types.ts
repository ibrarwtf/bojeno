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

/** One row for the live log panel. */
export interface RunLogRow {
  timestamp: string
  script: string
  outcome: RunOutcome
  entityId: string | null
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

/** One job card as read off a LinkedIn search-results page. */
export interface ScannedJobCard {
  id: string
  title: string
  company: string
  location: string
  easyApply: boolean
  alreadyApplied: boolean
  postedRelative: string | null
  parseWarning: boolean
}

/** Result of one attemptToApply pass through an Easy Apply modal. */
export interface ApplyResult {
  outcome: 'applied' | 'dry_run_ok' | 'needs_review' | 'skipped' | 'error'
  reason?: string
  header?: string
}

/** A saved LinkedIn search - name plus the params scanJobs already accepts. */
export interface LinkedinSavedSearch {
  id: number
  name: string
  keywords: string | null
  location: string | null
  sortByRecent: boolean
  easyApplyOnly: boolean
  createdAt: string
  lastRunAt: string | null
}

/** Everything captureJobDetails can read off a LinkedIn job's detail page. */
export interface JobDetails {
  jobUrl: string
  company: string
  title: string
  postedRelative: string | null
  clickedApplyCount: string | null
  applicantCount: string | null
  hasFitSignal: boolean
  yearsRequired: number | null
  descriptionText: string
  applicantInsightsText: string | null
}
