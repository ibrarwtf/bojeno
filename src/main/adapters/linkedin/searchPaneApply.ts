/**
 * Applies to a job without ever leaving the search-results page - the same
 * path a real user follows (click a card in the left rail, the right-hand
 * detail pane updates in place with its own visible Easy Apply button)
 * instead of the direct-URL path in adapter.ts (captureJobDetails/
 * applyToJob), which navigates to a separate job-view URL per job. Live
 * confirmed this session: clicking a card changes `currentJobId` via
 * client-side routing with no full page navigation, and the pane's Easy
 * Apply button is real and clickable from there.
 *
 * Assumes the caller already has a search-results page loaded (via
 * scanJobs) and never navigates away from it - this only ever selects
 * within the page that's already open. adapter.ts's applyToJob(jobId)
 * stays the standalone/ad-hoc path for when there's no search context at
 * all; the two share their modal-stepping logic via
 * apply.ts's stepThroughEasyApplyModal.
 */
import type { JobDetails, ApplyResult } from '../../../shared/types'
import { findPageByUrlPart } from '../../cdp'
import {
  parseYearsRequired,
  parseApplicantCount,
  parseApplicantInsightCounts,
  parsePostedRelative,
  parseClickedApplyCount,
  hasFitSignal,
  extractBetween,
  nextHeadingAfter
} from './jobDetails'
import { stepThroughEasyApplyModal } from './apply'
import { jobUrlFor } from './adapter'

const SECTION_STOP_MARKERS = ['More jobs', 'See more jobs like this']

/** The detail pane's own container on a search-results page - distinct from
 *  `main` on a standalone job-view page, which adapter.ts's captureJobDetails
 *  reads from instead. */
const DETAIL_PANE_SELECTOR = '.jobs-search__job-details--container'

/**
 * The pane's own action buttons print as plain text lines ahead of the
 * title ("Company\nShare\nShow more options\nTitle\n..." - confirmed live)
 * - the standalone job-view page's simpler "Company\nTitle" layout doesn't
 * have these, so its firstLine/secondLine heuristic doesn't hold up here.
 * Finds the first line after the company that isn't one of these instead of
 * assuming a fixed position.
 */
const PANE_NOISE_LINES = new Set(['Share', 'Show more options', 'Save', 'Easy Apply'])

export function extractTitleFromPaneLines(text: string, company: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const companyIndex = company ? lines.indexOf(company) : -1
  const start = companyIndex === -1 ? 0 : companyIndex + 1
  for (let i = start; i < lines.length; i++) {
    if (lines[i] !== company && !PANE_NOISE_LINES.has(lines[i])) return lines[i]
  }
  return lines[0] ?? ''
}

/**
 * Clicks a job's card in the currently-loaded results list and waits for
 * the detail pane to update to it. Scrolls the card into view first - a
 * card further down the list can otherwise sit under the pane's own sticky
 * layout and have its click intercepted (confirmed live: a plain click
 * without this failed on the second job in a results list, though not on
 * whichever job LinkedIn had already auto-selected).
 */
export async function selectJobCard(jobId: string): Promise<void> {
  const page = await findPageByUrlPart('linkedin.com')
  const card = page.locator(`li[data-occludable-job-id="${jobId}"]`).first()
  await card.scrollIntoViewIfNeeded()

  const link = card.locator('a').first()
  await link.click({ timeout: 5000 }).catch(() => link.click({ force: true, timeout: 5000 }))

  await page
    .waitForFunction((id) => window.location.href.includes(`currentJobId=${id}`), jobId, {
      timeout: 5000
    })
    .catch(() => undefined)
  // The click updates the URL immediately but the pane's own content can
  // lag a beat behind it - same class of gap captureJobDetails already
  // works around by waiting for "About the job" rather than trusting the URL alone.
  await page
    .waitForFunction(
      () =>
        (
          document.querySelector('.jobs-search__job-details--container') as HTMLElement | null
        )?.innerText.includes('About the job') ?? false,
      { timeout: 5000 }
    )
    .catch(() => undefined)
}

/**
 * Reads JD details from the detail pane already showing on the current
 * search-results page - the same parsing adapter.ts's captureJobDetails
 * does, just scoped to the in-place pane instead of a freshly navigated
 * job-view page's `main`.
 */
export async function captureActiveJobDetails(jobId: string): Promise<JobDetails> {
  const page = await findPageByUrlPart('linkedin.com')

  const { text, company, headings } = await page.evaluate((selector) => {
    const pane = document.querySelector(selector) as HTMLElement | null
    const scope: ParentNode = pane ?? document
    return {
      text: pane?.innerText ?? '',
      company:
        Array.from(scope.querySelectorAll<HTMLAnchorElement>('a[href*="/company/"]'))
          .map((a) => a.textContent?.trim() ?? '')
          .find((value) => value.length > 1) ?? '',
      headings: Array.from(scope.querySelectorAll('h2, h3'))
        .map((el) => el.textContent?.trim() ?? '')
        .filter(Boolean)
    }
  }, DETAIL_PANE_SELECTOR)

  const title = extractTitleFromPaneLines(text, company)
  const firstLine =
    text
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''

  const descriptionStop = nextHeadingAfter(headings, 'About the job')
  const insightsStop = nextHeadingAfter(headings, 'Candidates who clicked apply')
  const applicantsForJobStop = nextHeadingAfter(headings, 'Applicants for this job')
  const applicantsForJobSection = extractBetween(
    text,
    'Applicants for this job',
    applicantsForJobStop ? [applicantsForJobStop] : SECTION_STOP_MARKERS
  )

  return {
    jobUrl: jobUrlFor(jobId),
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
    ),
    applicantInsightCounts: applicantsForJobSection
      ? parseApplicantInsightCounts(applicantsForJobSection)
      : null
  }
}

/**
 * Clicks the detail pane's own Easy Apply button (never navigates to a
 * separate apply URL) and hands off to the shared modal-stepping logic.
 * Caller is expected to have already called selectJobCard for this job.
 * Grabs the JD text for rule-building itself, right after the modal opens
 * - matching adapter.ts's applyToJob, which reads `main`'s text at the same
 * point in its own flow rather than reusing an earlier capture, since the
 * modal overlay can add or shift visible text on the page.
 */
export async function applyFromSearchResults(dryRun: boolean): Promise<ApplyResult> {
  const page = await findPageByUrlPart('linkedin.com')
  const pane = page.locator(DETAIL_PANE_SELECTOR)
  const easyApplyBtn = pane.locator('button', { hasText: 'Easy Apply' }).first()

  if (!(await easyApplyBtn.count())) {
    return { outcome: 'skipped', reason: 'no Easy Apply button in the detail pane' }
  }

  await easyApplyBtn.click()
  // Scoped to the pane, not the whole page - the search-results page's
  // `main` also contains the left-rail card list (title/company text for
  // every visible job), which would otherwise pollute rule-building with
  // unrelated jobs' text.
  const jdText = await pane.innerText().catch(() => '')

  return stepThroughEasyApplyModal(page, jdText, dryRun)
}
