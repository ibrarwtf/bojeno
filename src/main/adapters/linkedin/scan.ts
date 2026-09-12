/**
 * Pure card-parsing logic ported from afterq/tools/find-easy-apply-jobs.mjs's
 * extractCardsClassic. That script found this selector and leaf-walk approach
 * by inspecting the real classic search DOM live; kept as-is rather than
 * re-derived. Card DOM is plain (no shadow root) - each card's leaf text
 * nodes, in document order, are title, company, location, then badges/status
 * in no fixed position, so badges are found by pattern rather than index.
 */

import type {
  DatePosted,
  ExperienceLevel,
  JobType,
  ScannedJobCard,
  SearchUrlParams,
  WorkplaceType
} from '../../../shared/types'

const BADGE_PATTERN =
  /connections? work here|school alumni works here|actively reviewing applicants|early applicant|^applicants?$|premium|^viewed$/i

/**
 * The accessible-name duplicate leaf isn't byte-identical to the visible
 * title (it appends " with verification") - strip that before the
 * adjacent-dedup check, or the duplicate won't collapse.
 */
function stripVerification(text: string): string {
  return text.replace(/ with verification$/, '')
}

export function parseCardFromLeaves(id: string, leaves: string[]): ScannedJobCard {
  const deduped = leaves.filter(
    (t, i) => stripVerification(t) !== stripVerification(leaves[i - 1] ?? '')
  )

  const title = stripVerification(deduped[0] ?? '')
  const rest = deduped.slice(1)
  const company = rest[0] || ''
  const location = rest[1] || ''
  const easyApply = deduped.includes('Easy Apply')
  const alreadyApplied = deduped.includes('Applied')
  const postedLeaf = deduped.find((t) => /\bago$/i.test(t))
  const freshBucket = deduped.find((t) => /^Within the past/i.test(t))
  const postedRelative = postedLeaf ?? freshBucket ?? null
  const parseWarning =
    !title || !company || !location || BADGE_PATTERN.test(company) || BADGE_PATTERN.test(location)

  return { id, title, company, location, easyApply, alreadyApplied, postedRelative, parseWarning }
}

const DATE_POSTED_VALUES: Record<DatePosted, string> = {
  past24Hours: 'r86400',
  pastWeek: 'r604800',
  pastMonth: 'r2592000'
}

const EXPERIENCE_LEVEL_VALUES: Record<ExperienceLevel, string> = {
  internship: '1',
  entryLevel: '2',
  associate: '3',
  midSenior: '4',
  director: '5',
  executive: '6'
}

const JOB_TYPE_VALUES: Record<JobType, string> = {
  fullTime: 'F',
  partTime: 'P',
  contract: 'C',
  temporary: 'T',
  volunteer: 'V',
  other: 'O'
}

const WORKPLACE_TYPE_VALUES: Record<WorkplaceType, string> = {
  onSite: '1',
  remote: '2',
  hybrid: '3'
}

/**
 * Classic search page, forced via origin= rather than left to LinkedIn's
 * newer semantic-search default - per live walkthrough, classic mode has
 * the "Most recent" sort and real freshness buckets the semantic page
 * doesn't expose.
 */
/** LinkedIn's own km-per-mile conversion for the "distance" filter, per live walkthrough. */
const KM_PER_MILE = 1.60934

export function buildSearchUrl(params: SearchUrlParams): string {
  const url = new URL('https://www.linkedin.com/jobs/search/')
  if (params.keywords) url.searchParams.set('keywords', params.keywords)
  // geoId is what LinkedIn's own autocomplete actually pins to - prefer it
  // over the free-text location string, which LinkedIn re-resolves itself
  // and can land on the wrong place.
  if (params.geoId) {
    url.searchParams.set('geoId', params.geoId)
  } else if (params.location) {
    url.searchParams.set('location', params.location)
  }
  if (params.distanceKm) {
    url.searchParams.set('distance', String(Math.round(params.distanceKm / KM_PER_MILE)))
  }
  url.searchParams.set('origin', 'CLASSIC_SEARCH_MODE_FROM_SEMANTIC')
  // LinkedIn's own "Most recent" sort option - DD (date descending), vs default R (relevance).
  if (params.sortByRecent) url.searchParams.set('sortBy', 'DD')
  // LinkedIn's own "Easy Apply" filter checkbox.
  if (params.easyApplyOnly) url.searchParams.set('f_AL', 'true')
  if (params.datePosted) url.searchParams.set('f_TPR', DATE_POSTED_VALUES[params.datePosted])
  if (params.experienceLevels?.length) {
    url.searchParams.set(
      'f_E',
      params.experienceLevels.map((level) => EXPERIENCE_LEVEL_VALUES[level]).join(',')
    )
  }
  if (params.jobTypes?.length) {
    url.searchParams.set('f_JT', params.jobTypes.map((type) => JOB_TYPE_VALUES[type]).join(','))
  }
  if (params.workplaceTypes?.length) {
    url.searchParams.set(
      'f_WT',
      params.workplaceTypes.map((type) => WORKPLACE_TYPE_VALUES[type]).join(',')
    )
  }
  return url.toString()
}
