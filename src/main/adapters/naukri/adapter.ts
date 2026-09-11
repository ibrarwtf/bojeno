import type { Adapter } from '../types'
import type { LoginStatus } from '../../../shared/types'
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

export const naukriAdapter: Adapter = {
  id: 'naukri',
  kind: 'session',
  capabilities: new Set(['checkLogin']),
  checkLogin
}
