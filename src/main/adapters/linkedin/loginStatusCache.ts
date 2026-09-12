/**
 * checkLogin() is a real page navigation (root URL + pathname wait) - not
 * free, and every script (fetchAppliedCount, applyToJob, runSequentialSearch,
 * ...) was calling it fresh on its own before this existed, each one paying
 * that cost and visibly flashing the LinkedIn homepage before getting on
 * with whatever it actually came to do. A short TTL cache means only the
 * first script in a burst pays for a real check; the explicit "Check" button
 * (AccountHeader) always bypasses this and re-primes it with a fresh result.
 */
import type { LoginStatus } from '../../../shared/types'

const CACHE_TTL_MS = 5 * 60 * 1000

let cached: LoginStatus | undefined

export function cachedLoginStatus(): LoginStatus | undefined {
  if (!cached) return undefined
  const age = Date.now() - new Date(cached.checkedAt).getTime()
  return age < CACHE_TTL_MS ? cached : undefined
}

export function setCachedLoginStatus(status: LoginStatus): void {
  cached = status
}
