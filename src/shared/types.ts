export type Platform = 'linkedin' | 'naukri'

export interface LoginStatus {
  platform: Platform
  loggedIn: boolean
  checkedAt: string
}

export interface ActiveTabUrl {
  platform: Platform
  url: string
}
