import type { LoginStatus } from '../../../shared/types'
import { findPageByUrlPart, gotoWithRetry, waitForPathname } from '../../cdp'
import { naukriSelectors } from './selectors'

export async function checkLogin(): Promise<LoginStatus> {
  const page = await findPageByUrlPart('naukri.com')
  await gotoWithRetry(page, naukriSelectors.rootUrl, { waitUntil: 'commit' })
  const loggedIn = await waitForPathname(page, naukriSelectors.loggedInPath)

  return { platform: 'naukri', loggedIn, checkedAt: new Date().toISOString() }
}
