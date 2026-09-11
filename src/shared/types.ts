/** Session-kind platforms only - these have a WebContentsView and a login gate. */
export type Platform = 'linkedin' | 'naukri'

/** Any adapter id that can appear in run_logs/apply_attempts/action_budget rows - session platforms plus api-kind sources like Lever. */
export type Source = Platform | 'lever'

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

/** One job posting returned by an api-kind adapter's discover(), e.g. Lever. */
export interface DiscoveredJob {
  source: string
  externalId: string
  title: string
  company: string
  location: string
  url: string
  description: string
  postedAt: string | null
}

export interface DiscoverParams {
  /** Adapter-specific company identifier, e.g. a Lever board slug. One company per call — orchestration loops over the list, same as checkLogin/appliedCount handle one platform per call. */
  company: string
}

export interface DiscoverResult {
  outcome: RunOutcome
  source: string
  jobs: DiscoveredJob[]
  /** One entry per requested company that failed, so a bad slug doesn't sink the whole batch. */
  errors: { company: string; message: string }[]
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
