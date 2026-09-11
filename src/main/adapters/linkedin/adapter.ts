import type { Adapter } from '../types'
import type { LoginStatus } from '../../../shared/types'
import { findPageByUrlPart, gotoWithRetry } from '../../cdp'
import { linkedinSelectors } from './selectors'

async function checkLogin(): Promise<LoginStatus> {
  const page = await findPageByUrlPart('linkedin.com')
  await gotoWithRetry(page, linkedinSelectors.loginCheckUrl, { waitUntil: 'commit' })

  const loggedIn = await page
    .waitForSelector(linkedinSelectors.loggedInIndicator, { timeout: 4000 })
    .then(() => true)
    .catch(() => false)

  return { platform: 'linkedin', loggedIn, checkedAt: new Date().toISOString() }
}

export const linkedinAdapter: Adapter = {
  id: 'linkedin',
  kind: 'session',
  capabilities: new Set(['checkLogin']),
  checkLogin
}
