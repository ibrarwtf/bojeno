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

/** One row for the live log panel - the same row a run leaves behind in the DB. */
export interface RunLogRow {
  runId: string | null
  timestamp: string
  script: string
  outcome: RunOutcome
  entityId: string | null
  jobTitle: string | null
  company: string | null
  location: string | null
  /** Freeform context for this row - a skip reason, parsed JD signal, or an error message. */
  detail: unknown
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
  /**
   * Set only when `reason` is specifically an answer-bank miss on a named
   * question (not every 'needs_review' cause has one - e.g. "exceeded max
   * steps" doesn't name a question). Lets a caller log it for review without
   * parsing the freeform `reason` string.
   */
  unmatchedQuestion?: { kind: 'text' | 'select' | 'radio'; label: string }
}

/** A saved LinkedIn search - name plus the params scanJobs already accepts. */
export interface LinkedinSavedSearch {
  id: number
  name: string
  keywords: string | null
  location: string | null
  /** LinkedIn's own numeric id for a resolved place - see SearchUrlParams.geoId. */
  geoId: string | null
  distanceKm: number | null
  sortByRecent: boolean
  easyApplyOnly: boolean
  createdAt: string
  lastRunAt: string | null
}

/** LinkedIn's own "Date posted" filter options (f_TPR). */
export type DatePosted = 'past24Hours' | 'pastWeek' | 'pastMonth'

/** LinkedIn's own "Experience level" filter options (f_E), multi-select. */
export type ExperienceLevel =
  'internship' | 'entryLevel' | 'associate' | 'midSenior' | 'director' | 'executive'

/** LinkedIn's own "Job type" filter options (f_JT), multi-select. */
export type JobType = 'fullTime' | 'partTime' | 'contract' | 'temporary' | 'volunteer' | 'other'

/** LinkedIn's own "Remote" / workplace-type filter options (f_WT), multi-select. */
export type WorkplaceType = 'onSite' | 'remote' | 'hybrid'

/** Params buildSearchUrl turns into a LinkedIn jobs-search URL. */
export interface SearchUrlParams {
  keywords?: string
  /**
   * Free-text location - only used when `geoId` isn't given. LinkedIn
   * re-resolves this string server-side, which can land on the wrong place
   * or a broader region than intended; prefer `geoId` whenever one is known.
   */
  location?: string
  /** LinkedIn's own numeric id for a resolved place - what its location
   * autocomplete actually pins to. Takes precedence over `location` when set. */
  geoId?: string
  /** Search radius in kilometers, as shown in LinkedIn's own UI. Converted to
   * the miles value LinkedIn's `distance` param actually expects. */
  distanceKm?: number
  sortByRecent?: boolean
  easyApplyOnly?: boolean
  datePosted?: DatePosted
  experienceLevels?: ExperienceLevel[]
  jobTypes?: JobType[]
  workplaceTypes?: WorkplaceType[]
}

/** Outcome tally from a runSequentialSearch pass over one search's job list. */
export interface SequentialRunSummary {
  total: number
  applied: number
  skipped: number
  failed: number
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
  /**
   * The separate "Applicants for this job" premium widget (total + last-24h
   * count) - distinct from applicantCount (the rough top-card figure) and
   * from applicantInsightsText (the "Candidates who clicked apply" widget).
   * Only appears on some postings; both fields are null when it's absent.
   */
  applicantInsightCounts: { total: number | null; pastDay: number | null } | null
}
