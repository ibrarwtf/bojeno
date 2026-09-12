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
 * Compiles a lowercased keyword into a matcher. A short 2-3 letter keyword
 * ("ai", "ml", "vp") is word-boundary anchored so it can't match inside an
 * unrelated word (e.g. "ai" inside "again" or "domain"); anything else
 * (multi-word phrases, keywords with punctuation like ".net") stays a plain
 * substring match.
 */
export function compileKeyword(keyword: string): (lower: string) => boolean {
  if (/^[a-z]{2,3}$/.test(keyword)) {
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
