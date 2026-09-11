import type { Adapter } from '../types'
import type { ApplicationMetrics, JobDetails, LoginStatus, ScrapedJob } from '../../../shared/types'
import { findPageByUrlPart, gotoWithRetry, waitForPathname } from '../../cdp'
import { linkedinSelectors } from './selectors'
import { parseAppliedRelativeText, isWithinPast24Hours } from './relativeTime'
import {
  parseYearsRequired,
  parseApplicantCount,
  parsePostedRelative,
  parseClickedApplyCount,
  hasFitSignal,
  extractBetween,
  nextHeadingAfter
} from './jobDetails'

// Fallback only for when the heading-based boundary (see nextHeadingAfter)
// can't be found - confirmed live that a plain to-end-of-text slice runs
// straight through this recommendation rail, the footer, and the language
// picker along with whatever section it was actually after.
const SECTION_STOP_MARKERS = ['More jobs', 'See more jobs like this']

async function checkLogin(): Promise<LoginStatus> {
  const page = await findPageByUrlPart('linkedin.com')
  await gotoWithRetry(page, linkedinSelectors.rootUrl, { waitUntil: 'commit' })
  const loggedIn = await waitForPathname(page, linkedinSelectors.loggedInPath)

  return { platform: 'linkedin', loggedIn, checkedAt: new Date().toISOString() }
}

async function appliedCount(): Promise<ApplicationMetrics> {
  const page = await findPageByUrlPart('linkedin.com')
  await gotoWithRetry(page, linkedinSelectors.appliedCountUrl, { waitUntil: 'commit' })

  const label = page.locator('label', { hasText: linkedinSelectors.appliedTabLabelPattern }).first()
  const text = await label.innerText({ timeout: 6000 })
  const match = text.match(/([\d,]+)\s*$/)
  if (!match) throw new Error(`Could not parse applied count from "${text}"`)
  return { applied: Number(match[1].replace(/,/g, '')) }
}

interface RawRow {
  externalJobId: string
  title: string
  companyLocation: string
  appliedRelative: string
}

async function extractRows(page: Awaited<ReturnType<typeof findPageByUrlPart>>): Promise<RawRow[]> {
  return page.evaluate((linkSelector) => {
    const links = Array.from(document.querySelectorAll(linkSelector)) as HTMLAnchorElement[]
    const seen = new Set<string>()
    const rows: RawRow[] = []
    for (const link of links) {
      const href = link.getAttribute('href') ?? ''
      const idMatch = href.match(/\/jobs\/view\/(\d+)/)
      const externalJobId = idMatch?.[1]
      if (!externalJobId || seen.has(externalJobId)) continue
      const paragraphs = link.querySelectorAll('p')
      if (paragraphs.length < 3) continue
      seen.add(externalJobId)
      rows.push({
        externalJobId,
        title: paragraphs[0].textContent?.trim() ?? '',
        companyLocation: paragraphs[1].textContent?.trim() ?? '',
        appliedRelative: paragraphs[2].textContent?.trim() ?? ''
      })
    }
    return rows
  }, linkedinSelectors.appliedJobRowLink)
}

const MAX_PAGES = 20

async function recentAppliedJobs(): Promise<ScrapedJob[]> {
  const page = await findPageByUrlPart('linkedin.com')
  await gotoWithRetry(page, linkedinSelectors.appliedCountUrl, { waitUntil: 'commit' })

  const now = new Date()
  const results: ScrapedJob[] = []
  const seen = new Set<string>()

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    await page
      .locator(linkedinSelectors.appliedJobRowLink)
      .first()
      .waitFor({ timeout: 6000 })
      .catch(() => undefined)

    const rows = await extractRows(page)
    let hitCutoff = false

    for (const row of rows) {
      if (seen.has(row.externalJobId)) continue
      const appliedAt = parseAppliedRelativeText(row.appliedRelative, now)
      if (!appliedAt || !isWithinPast24Hours(appliedAt, now)) {
        hitCutoff = true
        break
      }
      seen.add(row.externalJobId)
      const [company, location] = row.companyLocation.split(/[·•]/).map((part) => part.trim())
      results.push({
        externalJobId: row.externalJobId,
        title: row.title,
        company: company ?? '',
        location: location ?? '',
        appliedAt: appliedAt.toISOString(),
        appliedRelative: row.appliedRelative,
        jobUrl: `https://www.linkedin.com/jobs/view/${row.externalJobId}/`
      })
    }

    if (hitCutoff) break

    const nextButton = page.locator(linkedinSelectors.paginationNextButton)
    if ((await nextButton.count()) === 0) break
    await nextButton.click()
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
  }

  return results
}

/**
 * Extracts everything via plain-text regex over `main`'s innerText rather
 * than selectors - see jobDetails.ts for why (class names on this page
 * proved unstable within a single live session, both on this project's own
 * earlier capture and independently in github.com/joeyism/linkedin_scraper's
 * job.py, which falls back to the same kind of plain-text scan for exactly
 * this reason). Company comes from `a[href*="/company/"]` instead of a text
 * heuristic - also independently confirmed by that same project - since an
 * attribute-substring match on a real href holds up better than assuming a
 * fixed line position in the page's text.
 */
async function captureJobDetails(jobUrl: string): Promise<JobDetails> {
  const page = await findPageByUrlPart('linkedin.com')
  await gotoWithRetry(page, jobUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)

  const { text, company, headings } = await page.evaluate(() => ({
    text: (document.querySelector('main') as HTMLElement | null)?.innerText ?? '',
    company:
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/company/"]'))
        .map((a) => a.textContent?.trim() ?? '')
        .find((value) => value.length > 1) ?? '',
    headings: Array.from(document.querySelectorAll('h2, h3'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter(Boolean)
  }))

  const [firstLine = '', secondLine = ''] = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const title = company && firstLine === company ? secondLine : firstLine

  const descriptionStop = nextHeadingAfter(headings, 'About the job')
  const insightsStop = nextHeadingAfter(headings, 'Candidates who clicked apply')

  return {
    jobUrl,
    company: company || firstLine,
    title,
    postedRelative: parsePostedRelative(text),
    clickedApplyCount: parseClickedApplyCount(text),
    applicantCount: parseApplicantCount(text),
    hasFitSignal: hasFitSignal(text),
    yearsRequired: parseYearsRequired(text),
    descriptionText:
      extractBetween(
        text,
        'About the job',
        descriptionStop ? [descriptionStop] : SECTION_STOP_MARKERS
      ) ?? '',
    applicantInsightsText: extractBetween(
      text,
      'Candidates who clicked apply',
      insightsStop ? [insightsStop] : SECTION_STOP_MARKERS
    )
  }
}

export const linkedinAdapter: Adapter = {
  id: 'linkedin',
  kind: 'session',
  capabilities: new Set(['checkLogin', 'appliedCount', 'recentAppliedJobs', 'captureJobDetails']),
  checkLogin,
  appliedCount,
  recentAppliedJobs,
  captureJobDetails
}
