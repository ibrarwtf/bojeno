import type { Adapter } from '../types'
import type { ApplicationMetrics, LoginStatus } from '../../../shared/types'
import { findPageByUrlPart, gotoWithRetry, waitForPathname } from '../../cdp'
import { naukriSelectors } from './selectors'

async function checkLogin(): Promise<LoginStatus> {
  const page = await findPageByUrlPart('naukri.com')
  await gotoWithRetry(page, naukriSelectors.rootUrl, { waitUntil: 'commit' })
  const loggedIn = await waitForPathname(page, naukriSelectors.loggedInPath)

  return { platform: 'naukri', loggedIn, checkedAt: new Date().toISOString() }
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
