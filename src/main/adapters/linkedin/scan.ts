/**
 * Pure card-parsing logic ported from afterq/tools/find-easy-apply-jobs.mjs's
 * extractCardsClassic. That script found this selector and leaf-walk approach
 * by inspecting the real classic search DOM live; kept as-is rather than
 * re-derived. Card DOM is plain (no shadow root) - each card's leaf text
 * nodes, in document order, are title, company, location, then badges/status
 * in no fixed position, so badges are found by pattern rather than index.
 */

import type { ScannedJobCard } from '../../../shared/types'

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

/**
 * Classic search page, forced via origin= rather than left to LinkedIn's
 * newer semantic-search default - per live walkthrough, classic mode has
 * the "Most recent" sort and real freshness buckets the semantic page
 * doesn't expose.
 */
export function buildSearchUrl(params: {
  keywords?: string
  location?: string
  sortByRecent?: boolean
  easyApplyOnly?: boolean
}): string {
  const url = new URL('https://www.linkedin.com/jobs/search/')
  if (params.keywords) url.searchParams.set('keywords', params.keywords)
  if (params.location) url.searchParams.set('location', params.location)
  url.searchParams.set('origin', 'CLASSIC_SEARCH_MODE_FROM_SEMANTIC')
  // LinkedIn's own "Most recent" sort option - DD (date descending), vs default R (relevance).
  if (params.sortByRecent) url.searchParams.set('sortBy', 'DD')
  // LinkedIn's own "Easy Apply" filter checkbox.
  if (params.easyApplyOnly) url.searchParams.set('f_AL', 'true')
  return url.toString()
}
