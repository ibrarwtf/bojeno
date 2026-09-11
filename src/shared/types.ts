export type Platform = 'linkedin' | 'naukri'

export type RunMode = 'read-only' | 'dry-run' | 'live'

export type RunOutcome =
  'success' | 'failed' | 'auth_required' | 'rate_limited' | 'awaiting_input' | 'skipped'

export interface LoginStatus {
  platform: Platform
  loggedIn: boolean
  checkedAt: string
}

export interface ActiveTabUrl {
  platform: Platform
  url: string
}

export interface FetchAppliedCountResult {
  outcome: RunOutcome
  platform: Platform
  count?: number
  fetchedAt?: string
}
