/**
 * Company ID resolution + /about page scrape - ported from
 * afterq/tools/find-company-id.mjs's html-regex technique for the ID, and a
 * new label-then-next-line parser (same idea as jobDetails.ts's
 * extractBetween/nextHeadingAfter) for the /about page's structured info
 * block. Unlike find-company-id.mjs, there's no search-then-resolve step
 * here - callers already have the company's own page URL straight off the
 * job posting (an `a[href*="/company/"]` link), so this goes directly to
 * that page rather than searching for it.
 *
 * Confirmed live this session (linkedin.com/company/zetheta/about/) that
 * `main.innerText` has this exact structure, in order:
 *
 *   Technology, Information and Internet Mumbai 564K followers 51-200 employees
 *   Overview
 *   <paragraph>
 *   Website
 *   www.zetheta.com
 *   Phone
 *   +918591450377
 *   ...
 *   Industry
 *   Technology, Information and Internet
 *   Company size
 *   51-200 employees
 *   374 associated members
 *   ...
 *   Founded
 *   2024
 *   Specialties
 *   Internship, Artificial Intelligence, Investment Management,
 */
import type { Page } from 'playwright-core'
import type { CompanyAboutInfo } from '../../../shared/types'
import { gotoWithRetry } from '../../cdp'

/** Every label this parser knows how to stop at - both the ones it reads a
 *  value for and ones (Headquarters, Type, Verified page) it doesn't parse
 *  yet but must still recognize as a boundary so their values don't leak
 *  into whichever field's label comes right before them. */
const KNOWN_LABELS = [
  'Overview',
  'Website',
  'Phone',
  'Industry',
  'Company size',
  'Founded',
  'Specialties',
  'Headquarters',
  'Type',
  'Verified page'
]

function firstLabelIndexFrom(lines: string[], start: number): number {
  for (let i = start; i < lines.length; i++) {
    if (KNOWN_LABELS.includes(lines[i])) return i
  }
  return lines.length
}

function valueAfterLabel(lines: string[], label: string): string | null {
  const index = lines.indexOf(label)
  if (index === -1 || index === lines.length - 1) return null
  return lines[index + 1] || null
}

/**
 * Pure parser over the /about page's `main.innerText` - no navigation, no
 * DOM. `linkedinCompanyId`/`name`/`url` aren't parsed here since they come
 * from elsewhere (the page's own html markup and the caller's already-known
 * company link) - this only covers what's actually printed as page text.
 */
export function parseCompanyAboutText(
  text: string
): Pick<
  CompanyAboutInfo,
  'website' | 'industry' | 'companySize' | 'founded' | 'specialties' | 'overview'
> {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const overviewIndex = lines.indexOf('Overview')
  let overview: string | null = null
  if (overviewIndex !== -1) {
    const end = firstLabelIndexFrom(lines, overviewIndex + 1)
    const joined = lines
      .slice(overviewIndex + 1, end)
      .join(' ')
      .trim()
    overview = joined || null
  }

  const specialtiesRaw = valueAfterLabel(lines, 'Specialties')

  return {
    website: valueAfterLabel(lines, 'Website'),
    industry: valueAfterLabel(lines, 'Industry'),
    companySize: valueAfterLabel(lines, 'Company size'),
    founded: valueAfterLabel(lines, 'Founded'),
    specialties: specialtiesRaw ? specialtiesRaw.replace(/,\s*$/, '').trim() : null,
    overview
  }
}

/**
 * Ported from find-company-id.mjs's regex tally over the page's own html -
 * ranks every numeric id found by occurrence count and returns the most
 * common one, since a page can carry the same id via several different link
 * shapes (currentCompany filter links, urn attributes) and one of those
 * shapes occasionally points at an unrelated id (e.g. a "similar company"
 * card sharing the same html).
 */
export function extractCompanyIdFromHtml(html: string): string | null {
  const tally = new Map<string, number>()
  const add = (id: string): void => {
    tally.set(id, (tally.get(id) ?? 0) + 1)
  }

  for (const m of html.matchAll(/currentCompany=%5B%22(\d+)%22%5D/g)) add(m[1])
  for (const m of html.matchAll(/facetCurrentCompany=%5B%22(\d+)%22%5D/g)) add(m[1])
  for (const m of html.matchAll(/urn:li:fsd_company:(\d+)/g)) add(m[1])
  for (const m of html.matchAll(/urn:li:company:(\d+)/g)) add(m[1])

  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])
  return ranked.length ? ranked[0][0] : null
}

/** Normalizes any of a company's own URL shapes (with or without a trailing
 *  slash, already on /about or not) to its /about page. */
export function toCompanyAboutUrl(companyUrl: string): string {
  const base = companyUrl.replace(/\/$/, '').replace(/\/about\/?$/, '')
  return `${base}/about/`
}

/**
 * Navigates the given (already-obtained) page to the company's /about page
 * and returns its parsed info. Takes `page` directly rather than calling
 * findPageByUrlPart itself, and does NOT wrap itself in withLock - callers
 * that are already inside a locked navigation sequence (see
 * ipc/handlers/linkedin.ts's onApplyResult hook) must reuse that same
 * locked page/context instead of taking a second, nested lock (see
 * src/main/lock.ts - withLock isn't reentrant, so a nested call on the same
 * id would deadlock).
 */
export async function fetchCompanyAboutInfo(
  page: Page,
  companyUrl: string,
  knownName: string | null
): Promise<CompanyAboutInfo> {
  const aboutUrl = toCompanyAboutUrl(companyUrl)
  await gotoWithRetry(page, aboutUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)

  const [html, text] = await Promise.all([
    page.content(),
    page
      .locator('main')
      .innerText()
      .catch(() => '')
  ])

  return {
    linkedinCompanyId: extractCompanyIdFromHtml(html),
    name: knownName,
    url: companyUrl,
    ...parseCompanyAboutText(text),
    // Only ever set by the GCC research import (scripts/import-gcc-companies.cjs) -
    // a live /about scrape has no opinion on these, and upsertCompany never
    // includes them in its SQL, so an existing imported value is untouched.
    hqCountry: null,
    indiaCities: null,
    careersUrl: null,
    ats: null,
    status: null,
    skipReason: null,
    remark: null
  }
}
