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
   * Every question this pass couldn't really answer - each filled with a
   * throwaway placeholder just to keep walking the modal forward (never
   * actually submitted when this is non-empty, dry run or not). Not every
   * 'needs_review' cause has one - e.g. "exceeded max steps" has none. Lets
   * a caller log each one for review without parsing the freeform `reason`
   * string.
   */
  unmatchedQuestions?: { kind: 'text' | 'select' | 'radio'; label: string }[]
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
  /** LinkedIn's own numeric company ids (f_C) - scopes the search to exactly
   *  these companies, comma-joined. Confirmed live: works alongside
   *  keywords/location/etc., no practical limit on how many ids. See
   *  resolveCompanyId in company.ts for turning a plain company name into
   *  one of these. */
  companyIds?: string[]
}

/**
 * Outcome tally from a runSequentialSearch pass over one search's job list.
 * `applied` and `dryRunApplied` are mutually exclusive - which one a given
 * job's ApplyResult counts toward depends on the dryRun flag the run itself
 * was made with, never on the outcome alone, so a dry run can never inflate
 * `applied`. `needsReview` is its own bucket, not folded into either -
 * nothing was actually submitted for those.
 */
export interface SequentialRunSummary {
  total: number
  applied: number
  dryRunApplied: number
  needsReview: number
  skipped: number
  failed: number
  /** True when a Stop request ended the walk before every card was processed. */
  cancelled: boolean
  /** How many of the search's result pages this run actually walked. */
  pagesScanned: number
  /** LinkedIn's own total page count for this search, if the pagination
   *  footer was present at all (a small result set has none) - lets a
   *  caller tell "walked every page" apart from "stopped partway". */
  totalPages: number | null
}

/** One apply-modal question the answer bank couldn't match - queued for review. */
export interface UnmatchedQuestionRow {
  id: number
  platform: Platform
  externalJobId: string
  jobUrl: string
  jobTitle: string | null
  company: string | null
  questionKind: 'text' | 'select' | 'radio'
  questionLabel: string
  detectedAt: string
  resolved: boolean
  answer: string | null
  runId: string | null
  notifiedAt: string | null
}

/**
 * Logging/visibility-only rate readout for a single platform - see #84 and
 * bojeno-project-brief.md §5. Never used to cap, block, or auto-pause a run.
 */
export interface PlatformApplyRate {
  platform: Platform
  /** Real (non-dry-run) applies with outcome 'applied' in the last 60 minutes. */
  lastHour: number
  /** Same, over the last 24 hours. */
  last24h: number
}

/** Everything captureJobDetails can read off a LinkedIn job's detail page. */
export interface JobDetails {
  jobUrl: string
  company: string
  /** The company's own LinkedIn page URL, off the posting's `a[href*="/company/"]` link - null if that link wasn't found. */
  companyUrl: string | null
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
  /** Email addresses found in the JD text - e.g. "Send the following to hiring@company.com". */
  contactEmails: string[]
  /** Phone numbers found in the JD text - conservative match, false negatives are fine. */
  contactPhones: string[]
  /** The "Meet the hiring team" block's person, when present on this posting - absent on many. */
  jobPosterName: string | null
  jobPosterTitle: string | null
  jobPosterProfileUrl: string | null
}

/** Status of a manually-tracked pipeline contact - see PipelineContactRow. */
export type PipelineContactStatus = 'contacted' | 'interview_scheduled' | 'no_response' | 'closed'

/**
 * One manually-logged funnel entry for stages 3-5 (contacted, interview
 * scheduled, outcome) - see bojeno-project-brief.md §2/§9 and issue #85.
 * `externalJobId` optionally links back to a specific applied_jobs/
 * apply_attempts row when the contact is about a known job; left null for a
 * cold recruiter reach-out with no job attached yet.
 */
export interface PipelineContactRow {
  id: number
  platform: Platform
  company: string
  externalJobId: string | null
  contactedAt: string
  contactNote: string | null
  interviewScheduledAt: string | null
  lastFollowUpAt: string | null
  status: PipelineContactStatus
  createdAt: string
}

/** Args for creating a new pipeline_contacts row - see insertPipelineContact. */
export interface CreatePipelineContactArgs {
  platform: Platform
  company: string
  externalJobId?: string | null
  contactedAt: string
  contactNote?: string | null
  interviewScheduledAt?: string | null
  lastFollowUpAt?: string | null
  status?: PipelineContactStatus
}

/** Args for updating an existing pipeline_contacts row - all fields optional except id. */
export interface UpdatePipelineContactArgs {
  id: number
  company?: string
  externalJobId?: string | null
  contactedAt?: string
  contactNote?: string | null
  interviewScheduledAt?: string | null
  lastFollowUpAt?: string | null
  status?: PipelineContactStatus
}

/**
 * One row per company - populated from two independent sources that never
 * overwrite each other's fields (see companies.ts's upsert functions):
 * `fetchCompanyAboutInfo`'s live LinkedIn /about scrape (url/website/
 * industry/companySize/founded/specialties/overview), and the one-time GCC
 * research import (`scripts/import-gcc-companies.cjs`, hqCountry/
 * indiaCities/careersUrl/ats/status/skipReason/remark). `url` is nullable
 * since an imported company may have no resolved LinkedIn id/URL yet.
 */
export interface CompanyAboutInfo {
  linkedinCompanyId: string | null
  name: string | null
  url: string | null
  website: string | null
  industry: string | null
  companySize: string | null
  founded: string | null
  specialties: string | null
  overview: string | null
  hqCountry: string | null
  /** India office cities, when confirmed - e.g. ["Hyderabad", "Bengaluru"]. */
  indiaCities: string[] | null
  careersUrl: string | null
  /** Applicant tracking system, when known - e.g. "greenhouse", "workday". */
  ats: string | null
  /** "active" | "skip" from the GCC research import; null for a company only ever seen via a real apply. */
  status: string | null
  skipReason: string | null
  /** Free-text provenance note, e.g. "GCC imported from file at 2026-09-12". */
  remark: string | null
}
