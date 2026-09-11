export type Platform = 'linkedin' | 'naukri'

export interface LoginStatus {
  platform: Platform
  loggedIn: boolean
  checkedAt: string
}
