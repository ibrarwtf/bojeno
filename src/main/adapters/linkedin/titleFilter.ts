/**
 * Card-level title relevance gate, ported from afterq/career-ops's
 * scan.mjs buildTitleFilter/compileKeyword - a keyword_filter that's been
 * battle-tested there against exactly the failure mode seen here: sorting a
 * LinkedIn search by "Most recent" trades relevance for freshness, and
 * off-topic postings (a ".NET Developer" role showing up under an "AI
 * Engineer" search) slip through. Deliberately not the full scan.mjs
 * machinery (no AND-groups, no content/location/visa filters) - just the
 * positive/negative keyword core, which is what this gap actually needs.
 */

export interface TitleFilterConfig {
  /** OR-matched. Empty/absent = every title passes this side. */
  positive?: string[]
  /** OR-matched veto. Any hit rejects the title regardless of positive. */
  negative?: string[]
}

/**
 * Compiles a lowercased keyword into a matcher. A single alphabetic word
 * ("ai", "ml", "vp", "intern", "engineer") is word-boundary anchored so it
 * can't match inside an unrelated word - not just short ones: "intern" as a
 * plain substring wrongly matched "Consumer Internet" (confirmed live,
 * 2026-09-13), the same class of bug the original 2-3 letter case existed to
 * prevent for "ai" inside "again"/"domain". A keyword with a space or
 * punctuation (multi-word phrases, ".net") keeps the substring match, since
 * \b can't anchor across those meaningfully.
 */
export function compileKeyword(keyword: string): (lower: string) => boolean {
  if (/^[a-z]+$/.test(keyword)) {
    const re = new RegExp(`\\b${keyword}\\b`)
    return (lower) => re.test(lower)
  }
  return (lower) => lower.includes(keyword)
}

function normalizeKeywords(values: string[] | undefined): string[] {
  return (values ?? [])
    .filter((k) => typeof k === 'string')
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0)
}

/**
 * Builds a title matcher: passes when (positive is empty, or at least one
 * positive keyword hits) AND no negative keyword hits. An empty/absent
 * config passes every title - this is an opt-in gate, same as the other
 * preference gates.
 */
export function buildTitleFilter(
  config: TitleFilterConfig | undefined
): (title: string) => boolean {
  const positive = normalizeKeywords(config?.positive).map(compileKeyword)
  const negative = normalizeKeywords(config?.negative).map(compileKeyword)

  return (title: string) => {
    const lower = (title || '').toLowerCase()
    const hasPositive = positive.length === 0 || positive.some((match) => match(lower))
    const hasNegative = negative.some((match) => match(lower))
    return hasPositive && !hasNegative
  }
}
