import type { Adapter } from '../types'
import type { LoginStatus } from '../../../shared/types'
import { findPageByUrlPart, gotoWithRetry } from '../../cdp'
import { linkedinSelectors } from './selectors'

async function checkLogin(): Promise<LoginStatus> {
  const page = await findPageByUrlPart('linkedin.com')
  await gotoWithRetry(page, linkedinSelectors.loginCheckUrl, { waitUntil: 'commit' })

  const redirectedAwayFromFeed = await page
    .waitForFunction(
      (path) => !window.location.pathname.startsWith(path),
      linkedinSelectors.loginCheckPath,
      { timeout: 4000 }
    )
    .then(() => true)
    .catch(() => false)

  return {
    platform: 'linkedin',
    loggedIn: !redirectedAwayFromFeed,
    checkedAt: new Date().toISOString()
  }
}

async function appliedCount(): Promise<number> {
  const page = await findPageByUrlPart('linkedin.com')
  await gotoWithRetry(page, linkedinSelectors.appliedCountUrl, { waitUntil: 'commit' })

  const label = page.locator('label', { hasText: linkedinSelectors.appliedTabLabelPattern }).first()
  const text = await label.innerText({ timeout: 6000 })
  const match = text.match(/([\d,]+)\s*$/)
  if (!match) throw new Error(`Could not parse applied count from "${text}"`)
  return Number(match[1].replace(/,/g, ''))
}

export const linkedinAdapter: Adapter = {
  id: 'linkedin',
  kind: 'session',
  capabilities: new Set(['checkLogin', 'appliedCount']),
  checkLogin,
  appliedCount
}
