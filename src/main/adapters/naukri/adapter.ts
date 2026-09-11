import type { Adapter } from '../types'
import type { ApplicationMetrics, LoginStatus } from '../../../shared/types'
import { findPageByUrlPart, gotoWithRetry } from '../../cdp'
import { naukriSelectors } from './selectors'

async function checkLogin(): Promise<LoginStatus> {
  const page = await findPageByUrlPart('naukri.com')
  await gotoWithRetry(page, naukriSelectors.loginCheckUrl, { waitUntil: 'commit' })

  // The logged-out redirect is a delayed client-side one, not an immediate
  // HTTP redirect — poll for the login form rather than trusting page.url()
  // right after navigation settles.
  const loggedOut = await page
    .waitForSelector(naukriSelectors.notLoggedInIndicator, { timeout: 4000 })
    .then(() => true)
    .catch(() => false)

  return { platform: 'naukri', loggedIn: !loggedOut, checkedAt: new Date().toISOString() }
}

async function appliedCount(): Promise<ApplicationMetrics> {
  const page = await findPageByUrlPart('naukri.com')
  await gotoWithRetry(page, naukriSelectors.appliedCountUrl, { waitUntil: 'commit' })

  const numbers = page.locator(
    `${naukriSelectors.appStatusContainer} ${naukriSelectors.appStatusNumber}`
  )
  await numbers.first().waitFor({ timeout: 6000 })

  const texts = await numbers.allTextContents()
  if (texts.length < 2) {
    throw new Error(
      `Expected 2 numbers in ${naukriSelectors.appStatusContainer}, found ${texts.length}`
    )
  }
  const [totalApplies, recruiterActions] = texts.map((text) => Number(text.replace(/,/g, '')))

  return { applied: totalApplies, recruiter_actions: recruiterActions }
}

export const naukriAdapter: Adapter = {
  id: 'naukri',
  kind: 'session',
  capabilities: new Set(['checkLogin', 'appliedCount']),
  checkLogin,
  appliedCount
}
